import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: connectionId } = await params;
    const connection = await prisma.connection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const slowQueries = await prisma.query.findMany({
      where: {
        connectionId,
        stats: {
          some: {
            totalExecutionTimeMs: { gt: 1000 },
          },
        },
      },
      take: 10,
    });

    if (slowQueries.length === 0) {
      return NextResponse.json({ message: 'No slow queries found' });
    }

    return NextResponse.json({ message: 'Suggestion generation queued', connectionId });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}

