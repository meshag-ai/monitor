import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
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

    const { searchParams } = new URL(req.url);
    const threshold = parseFloat(searchParams.get('threshold') || '1000');

    const slowQueries = await prisma.query.findMany({
      where: {
        connectionId,
        stats: {
          some: {
            totalExecutionTimeMs: { gt: threshold }, // Simplified logic
          },
        },
      },
      orderBy: {
        lastSeenAt: 'desc'
      },
      take: 50,
      select: {
        id: true,
        queryText: true,
        queryHash: true,
        firstSeenAt: true,
        lastSeenAt: true,
        stats: {
          select: {
            executionCount: true,
            totalExecutionTimeMs: true,
            capturedAt: true,
          }
        }
      },
    });

    return NextResponse.json(slowQueries);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch slow queries' }, { status: 500 });
  }
}

