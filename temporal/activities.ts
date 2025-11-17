import { Context } from '@temporalio/activity';
import { prisma, PrismaTransactionalClient } from '../lib/prisma';
import { decryptCredentials } from '../lib/encryption';
import { PostgresConnector } from '../lib/db-connectors/postgres';
import { MySQLConnector } from '../lib/db-connectors/mysql';

function getLogger() {
  return Context.current().log;
}


export async function getConnection(connectionId: string) {
  const log = getLogger();
  log.info('Getting connection', { connectionId });
  try {
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
      include: {
        user: true,
      },
    });
    log.info('Successfully got connection', { connectionId });
    return connection;
  } catch (error) {
    log.error('Failed to get connection', { connectionId, error: String(error) });
    throw error;
  }
}

export async function fetchDatabaseStats(connectionId: string, dbType: string, host: string, port: number, database: string, username: string, encryptedPassword: string, encryptionKeyId: string) {
  const log = getLogger();
  log.info('Fetching database stats', { connectionId, dbType, host });
  const password = decryptCredentials(encryptedPassword, encryptionKeyId);

  let connector;
  if (dbType === 'POSTGRES') {
    connector = new PostgresConnector({
      host,
      port,
      database,
      username,
      password,
    });
  } else {
    connector = new MySQLConnector({
      host,
      port,
      database,
      username,
      password,
    });
  }

  try {
    const queryStats = await connector.fetchQueryStats();
    const schema = await connector.fetchSchema();
    const tablePatterns = await connector.fetchTableAccessPatterns();
    const indexUsage = await connector.fetchIndexUsage();

    await connector.close();

    log.info('Successfully fetched database stats', { connectionId });
    return {
      queryStats,
      schema,
      tablePatterns,
      indexUsage,
    };
  } catch (error) {
    await connector.close();
    log.error('Failed to fetch database stats', { connectionId, error: String(error) });
    throw error;
  }
}

export async function saveDatabaseStats(connectionId: string, stats: { queryStats: any[]; schema: any; tablePatterns: any[]; indexUsage: any[] }) {
  const log = getLogger();
  log.info('Saving database stats', { connectionId, queryCount: stats.queryStats.length, tableCount: stats.schema.tables.length });
  try {
    await prisma.$transaction(async (tx: PrismaTransactionalClient) => {
      for (const stat of stats.queryStats) {
        const query = await tx.query.upsert({
          where: {
            connectionId_queryHash: {
              connectionId,
              queryHash: stat.queryHash,
            },
          },
          update: {
            lastSeenAt: new Date(),
          },
          create: {
            connectionId,
            queryText: stat.queryText,
            queryHash: stat.queryHash,
          },
        });

        await tx.queryStats.create({
          data: {
            queryId: query.id,
            executionCount: stat.executionCount,
            totalExecutionTimeMs: stat.avgExecutionTimeMs * Number(stat.executionCount),
          },
        });
      }

      const snapshot = await tx.schemaSnapshot.create({
        data: {
          connectionId,
        },
      });

      for (const table of stats.schema.tables) {
        const createdTable = await tx.schemaTable.create({
          data: {
            snapshotId: snapshot.id,
            tableName: table.name,
          },
        });

        await tx.schemaColumn.createMany({
          data: table.columns.map((col: any) => ({
            tableId: createdTable.id,
            columnName: col.name,
            dataType: col.type,
            isNullable: col.nullable,
          })),
        });
      }

      for (const pattern of stats.tablePatterns) {
        await tx.tableAccessPattern.upsert({
          where: {
            connectionId_tableName: {
              connectionId,
              tableName: pattern.tableName,
            },
          },
          update: {
            accessCount: pattern.accessCount,
            lastAccessedAt: pattern.lastAccessedAt,
          },
          create: {
            connectionId,
            tableName: pattern.tableName,
            accessCount: pattern.accessCount,
            lastAccessedAt: pattern.lastAccessedAt,
          },
        });
      }

      for (const index of stats.indexUsage) {
        await tx.indexUsage.upsert({
          where: {
            connectionId_tableName_indexName: {
              connectionId,
              tableName: index.tableName,
              indexName: index.indexName,
            },
          },
          update: {
            scans: index.scans,
            tuplesRead: index.tuplesRead,
            tuplesFetched: index.tuplesFetched,
          },
          create: {
            connectionId,
            tableName: index.tableName,
            indexName: index.indexName,
            scans: index.scans,
            tuplesRead: index.tuplesRead,
            tuplesFetched: index.tuplesFetched,
          },
        });
      }

      await tx.connection.update({
        where: { id: connectionId },
        data: { lastSyncedAt: new Date(), status: 'ACTIVE' },
      });
    });
    log.info('Successfully saved database stats', { connectionId });
  } catch (error) {
    log.error('Failed to save database stats', { connectionId, error: String(error) });
    throw error;
  }
}

export async function updateConnectionStatus(connectionId: string, status: 'ACTIVE' | 'ERROR' | 'INACTIVE' | 'TESTING') {
  const log = getLogger();
  log.info('Updating connection status', { connectionId, status });
  try {
    await prisma.connection.update({
      where: { id: connectionId },
      data: { status },
    });
    log.info('Successfully updated connection status', { connectionId, status });
  } catch (error) {
    log.error('Failed to update connection status', { connectionId, status, error: String(error) });
    throw error;
  }
}

export async function fetchSlowQueries(connectionId: string) {
  const log = getLogger();
  log.info('Fetching slow queries', { connectionId });
  try {
    const queries = await prisma.query.findMany({
      where: {
        connectionId,
        stats: {
          some: {
            totalExecutionTimeMs: { gt: 1000 }, // This logic might need refinement
          },
        },
      },
      orderBy: {
        stats: {
          _count: 'desc', // Placeholder for a better metric
        },
      },
      include: {
        stats: true,
      },
      take: 10,
    });
    log.info('Successfully fetched slow queries', { connectionId, count: queries.length });
    return queries;
  } catch (error) {
    log.error('Failed to fetch slow queries', { connectionId, error: String(error) });
    throw error;
  }
}

export async function fetchIndexUsage(connectionId: string) {
  const log = getLogger();
  log.info('Fetching index usage', { connectionId });
  try {
    const usage = await prisma.indexUsage.findMany({
      where: { connectionId },
      orderBy: { scans: 'desc' },
      take: 10,
    });
    log.info('Successfully fetched index usage', { connectionId, count: usage.length });
    return usage;
  } catch (error) {
    log.error('Failed to fetch index usage', { connectionId, error: String(error) });
    throw error;
  }
}

export async function fetchTablePatterns(connectionId: string) {
  const log = getLogger();
  log.info('Fetching table patterns', { connectionId });
  try {
    const patterns = await prisma.tableAccessPattern.findMany({
      where: { connectionId },
      orderBy: { accessCount: 'desc' },
      take: 10,
    });
    log.info('Successfully fetched table patterns', { connectionId, count: patterns.length });
    return patterns;
  } catch (error) {
    log.error('Failed to fetch table patterns', { connectionId, error: String(error) });
    throw error;
  }
}

export async function generateLLMSuggestions(context: any) {
  const log = getLogger();
  log.info('Generating LLM suggestions');
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    log.error('OpenAI API key not configured');
    throw new Error('OpenAI API key not configured');
  }

  const prompt = `Analyze the following database performance metrics and provide optimization suggestions:

Slow Queries:
${context.slowQueries.map((q: any) => `- Query: ${q.query.substring(0, 200)}... Avg Time: ${q.avgTime}ms, Executions: ${q.executionCount}`).join('\n')}

Index Usage:
${context.indexUsage.map((idx: any) => `- Table: ${idx.table}, Index: ${idx.index}, Scans: ${idx.scans}`).join('\n')}

Table Access Patterns:
${context.tablePatterns.map((t: any) => `- Table: ${t.table}, Accesses: ${t.accessCount}`).join('\n')}

Provide specific, actionable optimization suggestions in JSON format:
[
  {
    "suggestionType": "INDEX_OPTIMIZATION" | "QUERY_OPTIMIZATION" | "SCHEMA_OPTIMIZATION" | "CONNECTION_OPTIMIZATION",
    "priority": "HIGH" | "MEDIUM" | "LOW",
    "suggestionText": "Detailed suggestion text here",
    "queryId": "optional query ID if related to specific query"
  }
]`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a database performance optimization expert. Provide specific, actionable suggestions based on the provided metrics.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      log.error('OpenAI API error', { status: response.status, statusText: response.statusText });
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '[]';
    const suggestions = JSON.parse(content);
    log.info('Successfully generated LLM suggestions', { count: suggestions.length });
    return suggestions;
  } catch (error) {
    log.error('Failed to generate LLM suggestions', { error: String(error) });
    throw error;
  }
}

export async function saveSuggestions(connectionId: string, userId: string, suggestions: any[]) {
  const log = getLogger();
  log.info('Saving suggestions', { connectionId, userId, count: suggestions.length });
  try {
    for (const suggestion of suggestions) {
      await prisma.optimizationSuggestion.create({
        data: {
          connectionId,
          userId,
          queryId: suggestion.queryId || null,
          suggestionText: suggestion.suggestionText,
          suggestionType: suggestion.suggestionType,
          priority: suggestion.priority,
          status: 'NEW',
        },
      });
    }
    log.info('Successfully saved suggestions', { connectionId, userId, count: suggestions.length });
  } catch (error) {
    log.error('Failed to save suggestions', { connectionId, userId, error: String(error) });
    throw error;
  }
}
