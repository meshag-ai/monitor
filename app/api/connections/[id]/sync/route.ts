import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getTemporalClient } from "@/lib/temporal-client";

export async function POST(
	req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { userId } = await auth();
	const { id } = await params;
	const log = logger.child({
		userId,
		connectionId: id,
		method: "POST",
		path: "/api/connections/[id]/sync",
	});

	if (!userId) {
		log.warn("Unauthorized access attempt");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const organization = await prisma.organizationUser.findFirst({
			where: { userId },
			include: {
				organization: true,
			},
		});

		if (!organization) {
			log.warn("Organization not found");
			return NextResponse.json(
				{ error: "Organization not found" },
				{ status: 404 },
			);
		}

		const connection = await prisma.connection.findFirst({
			where: { id, organizationId: organization.organizationId },
		});

		if (!connection) {
			log.warn("Connection not found");
			return NextResponse.json(
				{ error: "Connection not found" },
				{ status: 404 },
			);
		}

		const workflowId = `sync-${id}-${Date.now()}`;
		log.info({ workflowId }, "Starting sync workflow");

		const temporal = getTemporalClient();

		const temporalTaskQueue = process.env.TEMPORAL_TASK_QUEUE;
		if (!temporalTaskQueue) {
			throw new Error(
				"TEMPORAL_TASK_QUEUE is not defined in the environment variables",
			);
		}

		await temporal.workflow.start("syncDatabaseStats", {
			taskQueue: temporalTaskQueue,
			workflowId,
			args: [id],
		});

		log.info({ workflowId }, "Successfully started sync workflow");
		return NextResponse.json({ success: true, workflowId });
	} catch (error) {
		log.error({ error }, "Failed to start sync workflow");
		return NextResponse.json(
			{ error: "Failed to start sync workflow" },
			{ status: 500 },
		);
	}
}
