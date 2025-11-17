import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startWorkflow } from '@/lib/temporal-client';

export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID required' }, { status: 400 });
    }

    const connection = await prisma.connection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const handle = await startWorkflow('generateSuggestions', [connectionId], {
      workflowId: `suggestions-${connectionId}-${Date.now()}`,
    });

    return NextResponse.json({ workflowId: handle.workflowId, connectionId });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to trigger suggestion workflow' }, { status: 500 });
  }
}
