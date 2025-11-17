import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  const { id: connectionId } = await params;
  const log = logger.child({ userId, connectionId, method: 'GET', path: '/api/suggestions/[id]' });

  if (!userId) {
    log.warn('Unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    log.info('Fetching suggestions');

    const connection = await prisma.connection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      log.warn('Connection not found');
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const type = searchParams.get('type');

    const where: any = { connectionId, userId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (type) where.suggestionType = type;

    log.info({ filters: { status, priority, type } }, 'Querying suggestions');

    const suggestions = await prisma.optimizationSuggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        query: {
          select: {
            id: true,
            queryText: true,
          },
        },
      },
    });

    log.info({ count: suggestions.length }, 'Successfully fetched suggestions');
    return NextResponse.json(suggestions);
  } catch (error) {
    log.error({ error }, 'Failed to fetch suggestions');
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
