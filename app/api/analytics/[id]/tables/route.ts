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

		const tables = await prisma.tableAccessPattern.findMany({
			where: { connectionId },
			orderBy: { accessCount: "desc" },
			select: {
				id: true,
				tableName: true,
				accessCount: true,
				lastAccessedAt: true,
			},
		});

		return NextResponse.json(tables);
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to fetch table patterns" },
			{ status: 500 },
		);
	}
}
