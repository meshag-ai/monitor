import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrganizationIdByUserId } from "@/lib/crud";
import type { DbConnector } from "@/lib/db-connectors/base";
import { MySQLConnector } from "@/lib/db-connectors/mysql";
import { PostgresConnector } from "@/lib/db-connectors/postgres";
import { decryptCredentials } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

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
		path: "/api/connections/[id]/test",
	});

	if (!userId) {
		log.warn("Unauthorized access attempt");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		log.info("Testing connection");
		const organizationId = await getOrganizationIdByUserId(userId);
		const connection = await prisma.connection.findFirst({
			where: { id, organizationId },
		});

		if (!connection) {
			log.warn("Connection not found");
			return NextResponse.json(
				{ error: "Connection not found" },
				{ status: 404 },
			);
		}

		const password = decryptCredentials(
			connection.encryptedPassword,
			connection.encryptionKeyId,
		);

		let connector: DbConnector;
		if (connection.dbType === "POSTGRES") {
			connector = new PostgresConnector({
				host: connection.host,
				port: connection.port,
				database: connection.database,
				username: connection.username,
				password,
			});
		} else {
			connector = new MySQLConnector({
				host: connection.host,
				port: connection.port,
				database: connection.database,
				username: connection.username,
				password,
			});
		}

		const isValid = await connector.testConnection();
		await connector.close();

		if (isValid) {
			log.info("Connection test successful");
			await prisma.connection.update({
				where: { id },
				data: { status: "ACTIVE" },
			});
		} else {
			log.warn("Connection test failed");
			await prisma.connection.update({
				where: { id },
				data: { status: "ERROR" },
			});
		}

		return NextResponse.json({ success: isValid });
	} catch (error) {
		log.error({ error }, "Failed to test connection");
		return NextResponse.json(
			{ error: "Failed to test connection" },
			{ status: 500 },
		);
	}
}
