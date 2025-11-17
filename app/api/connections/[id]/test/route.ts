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

  try {
    const { id } = await params;
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

    const isValid = await connector.testConnection();
    await connector.close();

    if (isValid) {
      await prisma.connection.update({
        where: { id },
        data: { status: 'ACTIVE' },
      });
    } else {
      await prisma.connection.update({
        where: { id },
        data: { status: 'ERROR' },
      });
    }

    return NextResponse.json({ success: isValid });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to test connection' }, { status: 500 });
  }
}
