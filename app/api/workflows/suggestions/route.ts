import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { temporal } from '@/lib/temporal-client';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  const { userId } = await auth();
  const log = logger.child({ userId, method: 'POST', path: '/api/workflows/suggestions' });

  if (!userId) {
    log.warn('Unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { connectionId } = body;
    log.info({ connectionId }, 'Received request to generate suggestions');

    if (!connectionId) {
      log.warn('Connection ID is required');
      return NextResponse.json({ error: 'Connection ID required' }, { status: 400 });
    }

    const connection = await prisma.connection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      log.warn({ connectionId }, 'Connection not found');
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const workflowId = `suggestions-${connectionId}-${Date.now()}`;
    await temporal.workflow.start('generateSuggestions', {
      taskQueue: 'default',
      workflowId,
      args: [connectionId],
    });

    log.info({ connectionId, workflowId }, 'Successfully started suggestion generation workflow');
    return NextResponse.json({ workflowId, connectionId });
  } catch (error) {
    log.error({ error }, 'Failed to trigger suggestion workflow');
    return NextResponse.json({ error: 'Failed to trigger suggestion workflow' }, { status: 500 });
  }
}
