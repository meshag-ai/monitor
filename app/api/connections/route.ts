import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { encryptCredentials } from '@/lib/encryption';
import { PostgresConnector } from '@/lib/db-connectors/postgres';
import { MySQLConnector } from '@/lib/db-connectors/mysql';

const createConnectionSchema = z.object({
  name: z.string().min(1),
  dbType: z.enum(['POSTGRES', 'MYSQL']),
  host: z.string().min(1),
  port: z.number().int().positive(),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  pollingIntervalMinutes: z.number().int().positive().default(5),
});

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const connections = await prisma.connection.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      dbType: true,
      host: true,
      port: true,
      database: true,
      username: true,
      pollingIntervalMinutes: true,
      status: true,
      lastSyncedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(connections);
}

export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createConnectionSchema.parse(body);

    const { encrypted, encryptionKeyId } = encryptCredentials(data.password);

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

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials or connection failed' }, { status: 400 });
    }

    const connection = await prisma.connection.create({
      data: {
        userId,
        name: data.name,
        dbType: data.dbType,
        host: data.host,
        port: data.port,
        database: data.database,
        username: data.username,
        encryptedPassword: encrypted,
        encryptionKeyId,
        pollingIntervalMinutes: data.pollingIntervalMinutes,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      id: connection.id,
      name: connection.name,
      dbType: connection.dbType,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      pollingIntervalMinutes: connection.pollingIntervalMinutes,
      status: connection.status,
      lastSyncedAt: connection.lastSyncedAt,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 });
  }
}
