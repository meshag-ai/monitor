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
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const type = searchParams.get('type');

    const where: any = { connectionId, userId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (type) where.suggestionType = type;

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

    return NextResponse.json(suggestions);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
