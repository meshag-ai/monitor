import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrganizationIdByUserId } from "@/lib/crud";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getTemporalClient } from "@/lib/temporal-client";

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

		const workflowId = `generate-suggestions-${connectionId}-${Date.now()}`;
		log.info({ workflowId }, "Starting suggestion generation workflow");

		const temporal = getTemporalClient();

		if (!process.env.TEMPORAL_TASK_QUEUE) {
			throw new Error(
				"TEMPORAL_TASK_QUEUE is not defined in the environment variables",
			);
		}

		await temporal.workflow.start("generateSuggestions", {
			taskQueue: process.env.TEMPORAL_TASK_QUEUE,
			workflowId,
			args: [connectionId],
		});

		log.info(
			{ workflowId },
			"Successfully started suggestion generation workflow",
		);
		return NextResponse.json({ success: true, workflowId });
	} catch (error) {
		log.error({ error }, "Failed to start suggestion generation workflow");
		return NextResponse.json(
			{ error: "Failed to start suggestion generation workflow" },
			{ status: 500 },
		);
	}
}
