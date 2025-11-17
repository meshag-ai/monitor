import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PostgresConnector } from '@/lib/db-connectors/postgres';
import { MySQLConnector } from '@/lib/db-connectors/mysql';
import { logger } from '@/lib/logger';
import { auth } from '@clerk/nextjs/server';

const testConnectionSchema = z.object({
  dbType: z.enum(['POSTGRES', 'MYSQL']),
  host: z.string().min(1),
  port: z.number().int().positive(),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  const log = logger.child({ userId, method: 'POST', path: '/api/connections/test' });

  if (!userId) {
    log.warn('Unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = testConnectionSchema.parse(body);
    log.info({ dbType: data.dbType, host: data.host }, 'Testing new connection');

    let connector;
    if (data.dbType === 'POSTGRES') {
      connector = new PostgresConnector({
        host: data.host,
        port: data.port,
        database: data.database,
        username: data.username,
        password: data.password,
      });
    } else {
      connector = new MySQLConnector({
        host: data.host,
        port: data.port,
        database: data.database,
        username: data.username,
        password: data.password,
      });
    }

    const isValid = await connector.testConnection();
    await connector.close();

    if (isValid) {
      log.info({ dbType: data.dbType, host: data.host }, 'Connection test successful');
      return NextResponse.json({ success: true });
    } else {
      log.warn({ dbType: data.dbType, host: data.host }, 'Connection test failed');
      return NextResponse.json({ error: 'Connection test failed' }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.warn({ error: error.errors }, 'Invalid input for testing a connection');
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    log.error({ error }, 'Failed to test connection');
    return NextResponse.json({ error: 'Failed to test connection' }, { status: 500 });
  }
}
