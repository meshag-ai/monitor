import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptCredentials } from '@/lib/encryption';
import { PostgresConnector } from '@/lib/db-connectors/postgres';
import { MySQLConnector } from '@/lib/db-connectors/mysql';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let id: string | undefined;
  try {
    const paramsData = await params;
    id = paramsData.id;
    const connection = await prisma.connection.findFirst({
      where: { id, userId },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const password = decryptCredentials(connection.encryptedPassword, connection.encryptionKeyId);

    let connector;
    if (connection.dbType === 'POSTGRES') {
      connector = new PostgresConnector({
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        password,
      });
    } else {
      connector = new MySQLConnector({
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        password,
      });
    }

    const queryStats = await connector.fetchQueryStats();
    const schema = await connector.fetchSchema();
    const tablePatterns = await connector.fetchTableAccessPatterns();
    const indexUsage = await connector.fetchIndexUsage();

    await prisma.$transaction(async () => {
      for (const stat of queryStats) {
        await prisma.queryExecution.upsert({
          where: {
            connectionId_queryHash: {
              connectionId: id,
              queryHash: stat.queryHash,
            },
          },
          update: {
            executionTimeMs: stat.executionTimeMs,
            executionCount: stat.executionCount,
            avgExecutionTimeMs: stat.avgExecutionTimeMs,
            lastSeenAt: stat.lastSeenAt,
          },
          create: {
            connectionId: id,
            queryText: stat.queryText,
            queryHash: stat.queryHash,
            executionTimeMs: stat.executionTimeMs,
            executionCount: stat.executionCount,
            avgExecutionTimeMs: stat.avgExecutionTimeMs,
            firstSeenAt: stat.firstSeenAt,
            lastSeenAt: stat.lastSeenAt,
          },
        });
      }

      await prisma.dbSchema.create({
        data: {
          connectionId: id,
          schemaJson: schema,
        },
      });

      for (const pattern of tablePatterns) {
        await prisma.tableAccessPattern.upsert({
          where: {
            connectionId_tableName: {
              connectionId: id,
              tableName: pattern.tableName,
            },
          },
          update: {
            accessCount: pattern.accessCount,
            lastAccessedAt: pattern.lastAccessedAt,
          },
          create: {
            connectionId: id,
            tableName: pattern.tableName,
            accessCount: pattern.accessCount,
            lastAccessedAt: pattern.lastAccessedAt,
          },
        });
      }

      for (const index of indexUsage) {
        await prisma.indexUsage.upsert({
          where: {
            connectionId_tableName_indexName: {
              connectionId: id,
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
            connectionId: id,
            tableName: index.tableName,
            indexName: index.indexName,
            scans: index.scans,
            tuplesRead: index.tuplesRead,
            tuplesFetched: index.tuplesFetched,
          },
        });
      }

      await prisma.connection.update({
        where: { id },
        data: { lastSyncedAt: new Date(), status: 'ACTIVE' },
      });
    });

    await connector.close();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (id) {
      try {
        await prisma.connection.update({
          where: { id },
          data: { status: 'ERROR' },
        });
      } catch {
      }
    }
    return NextResponse.json({ error: 'Failed to sync connection' }, { status: 500 });
  }
}
