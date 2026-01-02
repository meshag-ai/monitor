import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { generateSuggestions } from "@/app/workflows/generate-suggestions";
import { getOrganizationIdByUserId } from "@/lib/crud";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function POST(
	req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { userId } = await auth();
	const { id: connectionId } = await params;
	const log = logger.child({
		userId,
		connectionId,
		method: "POST",
		path: "/api/suggestions/[id]/generate",
	});

	if (!userId) {
		log.warn("Unauthorized access attempt");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const organizationId = await getOrganizationIdByUserId(userId);
		const connection = await prisma.connection.findFirst({
			where: { id: connectionId, organizationId },
		});

		if (!connection) {
			log.warn("Connection not found");
			return NextResponse.json(
				{ error: "Connection not found" },
				{ status: 404 },
			);
		}

		log.info("Starting suggestion generation workflow");

		const { runId } = await start(generateSuggestions, [connectionId]);

		log.info({ runId }, "Successfully started suggestion generation workflow");
		return NextResponse.json({ success: true, runId });
	} catch (error) {
		log.error({ error }, "Failed to start suggestion generation workflow");
		return NextResponse.json(
			{ error: "Failed to start suggestion generation workflow" },
			{ status: 500 },
		);
	}
}
