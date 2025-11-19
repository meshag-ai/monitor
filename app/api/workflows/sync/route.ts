import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getTemporalClient } from "@/lib/temporal-client";

export async function POST(req: Request) {
	const { userId } = await auth();
	const log = logger.child({
		userId,
		method: "POST",
		path: "/api/workflows/sync",
	});

	if (!userId) {
		log.warn("Unauthorized access attempt");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await req.json();
		const { connectionId } = body;
		log.info({ connectionId }, "Received request to sync database stats");

		if (!connectionId) {
			log.warn("Connection ID is required");
			return NextResponse.json(
				{ error: "Connection ID required" },
				{ status: 400 },
			);
		}

		const organization = await prisma.organizationUser.findFirst({
			where: { user: { id: userId } },
		});

		if (!organization) {
			log.warn({ userId }, "User is not a member of any organization");
			return NextResponse.json(
				{ error: "Organization not found" },
				{ status: 404 },
			);
		}

		const connection = await prisma.connection.findFirst({
			where: { id: connectionId, organizationId: organization.organizationId },
		});

		if (!connection) {
			log.warn({ connectionId }, "Connection not found");
			return NextResponse.json(
				{ error: "Connection not found" },
				{ status: 404 },
			);
		}

		const workflowId = `sync-${connectionId}-${Date.now()}`;
		const temporal = getTemporalClient();
		if (!process.env.TEMPORAL_TASK_QUEUE) {
			throw new Error(
				"TEMPORAL_TASK_QUEUE is not defined in the environment variables",
			);
		}

		await temporal.workflow.start("syncDatabaseStats", {
			taskQueue: process.env.TEMPORAL_TASK_QUEUE,
			workflowId,
			args: [connectionId],
		});

		log.info(
			{ connectionId, workflowId },
			"Successfully started sync workflow",
		);
		return NextResponse.json({ workflowId, connectionId });
	} catch (error) {
		log.error({ error }, "Failed to trigger sync workflow");
		return NextResponse.json(
			{ error: "Failed to trigger sync workflow" },
			{ status: 500 },
		);
	}
}
