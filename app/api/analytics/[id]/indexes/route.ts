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

		const indexes = await prisma.indexUsage.findMany({
			where: { connectionId },
			orderBy: { scans: "desc" },
			select: {
				id: true,
				tableName: true,
				indexName: true,
				scans: true,
				tuplesRead: true,
				tuplesFetched: true,
				updatedAt: true,
			},
		});

		return NextResponse.json(indexes);
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to fetch index usage" },
			{ status: 500 },
		);
	}
}
