import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrganizationIdByUserId } from "@/lib/crud";
import { prisma } from "@/lib/prisma";

export async function GET(
	req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { userId } = await auth();

	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const organizationId = await getOrganizationIdByUserId(userId);
		const { id: connectionId } = await params;
		const connection = await prisma.connection.findFirst({
			where: { id: connectionId, organizationId },
		});

		if (!connection) {
			return NextResponse.json(
				{ error: "Connection not found" },
				{ status: 404 },
			);
		}

		const queries = await prisma.query.findMany({
			where: { connectionId },
			orderBy: { lastSeenAt: "desc" },
			take: 100,
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
					},
				},
			},
		});

		return NextResponse.json(queries);
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to fetch queries" },
			{ status: 500 },
		);
	}
}
