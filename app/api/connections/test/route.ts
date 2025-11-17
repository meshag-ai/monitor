import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PostgresConnector } from '@/lib/db-connectors/postgres';
import { MySQLConnector } from '@/lib/db-connectors/mysql';

const testConnectionSchema = z.object({
  dbType: z.enum(['POSTGRES', 'MYSQL']),
  host: z.string().min(1),
  port: z.number().int().positive(),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = testConnectionSchema.parse(body);

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
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Connection test failed' }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to test connection' }, { status: 500 });
  }
}
