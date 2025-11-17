import * as activities from '@temporalio/activity';
import { prisma } from '../lib/prisma';
import { decryptCredentials } from '../lib/encryption';
import { PostgresConnector } from '../lib/db-connectors/postgres';
import { MySQLConnector } from '../lib/db-connectors/mysql';

export async function getConnection(connectionId: string) {
  return await prisma.connection.findUnique({
    where: { id: connectionId },
    include: {
      user: true,
    },
  });
}

export async function fetchDatabaseStats(connectionId: string, dbType: string, host: string, port: number, database: string, username: string, encryptedPassword: string, encryptionKeyId: string) {
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

    return {
      queryStats,
      schema,
      tablePatterns,
      indexUsage,
    };
  } catch (error) {
    await connector.close();
    throw error;
  }
}

export async function saveDatabaseStats(connectionId: string, stats: { queryStats: any[]; schema: any; tablePatterns: any[]; indexUsage: any[] }) {
  await prisma.$transaction(async () => {
    for (const stat of stats.queryStats) {
      const query = await prisma.query.upsert({
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

      await prisma.queryStats.create({
        data: {
          queryId: query.id,
          executionCount: stat.executionCount,
          totalExecutionTimeMs: stat.avgExecutionTimeMs * Number(stat.executionCount),
        },
      });
    }

    const snapshot = await prisma.schemaSnapshot.create({
      data: {
        connectionId,
      },
    });

    for (const table of stats.schema.tables) {
      const createdTable = await prisma.schemaTable.create({
        data: {
          snapshotId: snapshot.id,
          tableName: table.name,
        },
      });

      await prisma.schemaColumn.createMany({
        data: table.columns.map((col: any) => ({
          tableId: createdTable.id,
          columnName: col.name,
          dataType: col.type,
          isNullable: col.nullable,
        })),
      });
    }

    for (const pattern of stats.tablePatterns) {
      await prisma.tableAccessPattern.upsert({
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
      await prisma.indexUsage.upsert({
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

    await prisma.connection.update({
      where: { id: connectionId },
      data: { lastSyncedAt: new Date(), status: 'ACTIVE' },
    });
  });
}

export async function updateConnectionStatus(connectionId: string, status: 'ACTIVE' | 'ERROR' | 'INACTIVE' | 'TESTING') {
  await prisma.connection.update({
    where: { id: connectionId },
    data: { status },
  });
}

export async function fetchSlowQueries(connectionId: string) {
  return await prisma.query.findMany({
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
}

export async function fetchIndexUsage(connectionId: string) {
  return await prisma.indexUsage.findMany({
    where: { connectionId },
    orderBy: { scans: 'desc' },
    take: 10,
  });
}

export async function fetchTablePatterns(connectionId: string) {
  return await prisma.tableAccessPattern.findMany({
    where: { connectionId },
    orderBy: { accessCount: 'desc' },
    take: 10,
  });
}

export async function generateLLMSuggestions(context: any) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
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
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '[]';
  return JSON.parse(content);
}

export async function saveSuggestions(connectionId: string, userId: string, suggestions: any[]) {
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
}
