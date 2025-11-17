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

    const [
      totalQueries,
      avgExecutionTime,
      slowQueries,
      mostFrequent,
      slowest,
      tablePatterns,
      indexUsage,
    ] = await Promise.all([
      prisma.queryStats.aggregate({
        where: { query: { connectionId } },
        _sum: { executionCount: true },
      }),
      prisma.queryStats.aggregate({
        where: { query: { connectionId } },
        _avg: { totalExecutionTimeMs: true }, // This is not avg exec time per query, but per stat record
      }),
      prisma.query.count({
        where: {
          connectionId,
          stats: {
            some: {
              totalExecutionTimeMs: { gt: 1000 },
            },
          },
        },
      }),
      prisma.query.findMany({
        where: { connectionId },
        orderBy: {
          stats: {
            _sum: {
              executionCount: 'desc',
            },
          },
        },
        take: 10,
        select: {
          id: true,
          queryText: true,
          stats: {
            select: {
              executionCount: true,
              totalExecutionTimeMs: true,
            },
          },
        },
      }),
      prisma.query.findMany({
        where: { connectionId },
        orderBy: {
          stats: {
            _avg: {
              totalExecutionTimeMs: 'desc',
            },
          },
        },
        take: 10,
        select: {
          id: true,
          queryText: true,
          stats: {
            select: {
              executionCount: true,
              totalExecutionTimeMs: true,
            },
          },
        },
      }),
      prisma.tableAccessPattern.findMany({
        where: { connectionId },
        orderBy: { accessCount: 'desc' },
        take: 20,
      }),
      prisma.indexUsage.findMany({
        where: { connectionId },
        orderBy: { scans: 'desc' },
        take: 20,
      }),
    ]);

    // Manual aggregation for avg execution time and transforming query results
    const mostFrequentFormatted = mostFrequent.map(q => ({
      id: q.id,
      queryText: q.queryText,
      executionCount: q.stats.reduce((acc, s) => acc + Number(s.executionCount), 0),
      avgExecutionTimeMs: q.stats.reduce((acc, s) => acc + s.totalExecutionTimeMs, 0) / q.stats.reduce((acc, s) => acc + Number(s.executionCount), 1),
    }));

    const slowestFormatted = slowest.map(q => ({
      id: q.id,
      queryText: q.queryText,
      executionCount: q.stats.reduce((acc, s) => acc + Number(s.executionCount), 0),
      avgExecutionTimeMs: q.stats.reduce((acc, s) => acc + s.totalExecutionTimeMs, 0) / q.stats.reduce((acc, s) => acc + Number(s.executionCount), 1),
    }));


    return NextResponse.json({
      totalQueries: totalQueries._sum.executionCount || BigInt(0),
      avgExecutionTime: avgExecutionTime._avg.totalExecutionTimeMs || 0,
      slowQueries,
      mostFrequent: mostFrequentFormatted,
      slowest: slowestFormatted,
      tablePatterns,
      indexUsage,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

