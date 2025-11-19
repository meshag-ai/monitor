import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { DbConnector } from "@/lib/db-connectors/base";
import { MySQLConnector } from "@/lib/db-connectors/mysql";
import { PostgresConnector } from "@/lib/db-connectors/postgres";
import { encryptCredentials } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const createConnectionSchema = z.object({
	name: z.string().min(1),
	dbType: z.enum(["POSTGRES", "MYSQL"]),
	host: z.string().min(1),
	port: z.number().int().positive(),
	database: z.string().min(1),
	username: z.string().min(1),
	password: z.string().min(1),
	pollingIntervalMinutes: z.number().int().positive().default(1440),
});

export async function GET() {
	const { userId, orgId } = await auth();

	if (!userId) {
		logger.warn("Unauthorized access attempt to GET /api/connections");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!orgId) {
		logger.warn({ userId }, "User is not part of an organization");
		return NextResponse.json(
			{ error: "User is not part of an organization" },
			{ status: 400 },
		);
	}

	logger.info({ userId, orgId }, "Fetching connections");

	const connections = await prisma.connection.findMany({
		where: { organizationId: orgId },
		select: {
			id: true,
			name: true,
			dbType: true,
			host: true,
			port: true,
			database: true,
			username: true,
			pollingIntervalMinutes: true,
			status: true,
			lastSyncedAt: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy: { createdAt: "desc" },
	});

	logger.info(
		{ userId, orgId, count: connections.length },
		"Successfully fetched connections",
	);

	return NextResponse.json(connections);
}

export async function POST(req: Request) {
	const { userId, orgId } = await auth();

	if (!userId) {
		logger.warn("Unauthorized access attempt to POST /api/connections");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!orgId) {
		logger.warn({ userId }, "User is not part of an organization");
		return NextResponse.json(
			{ error: "User is not part of an organization" },
			{ status: 400 },
		);
	}

	try {
		const body = await req.json();
		const data = createConnectionSchema.parse(body);

		logger.info(
			{ userId, orgId, dbType: data.dbType, host: data.host },
			"Attempting to create a new connection",
		);

		const { encrypted, encryptionKeyId } = encryptCredentials(data.password);

		let connector: DbConnector;
		if (data.dbType === "POSTGRES") {
			connector = new PostgresConnector({
				host: data.host,
				port: data.port,
				database: data.database,
				username: data.username,
				password: data.password,
			});
		} else {
			connector = new MySQLConnector({
				host: data.host,
				port: data.port,
				database: data.database,
				username: data.username,
				password: data.password,
			});
		}

		const isValid = await connector.testConnection();
		await connector.close();

		if (!isValid) {
			logger.warn(
				{ userId, orgId, dbType: data.dbType, host: data.host },
				"Connection test failed",
			);
			return NextResponse.json(
				{ error: "Invalid credentials or connection failed" },
				{ status: 400 },
			);
		}

		const connection = await prisma.connection.create({
			data: {
				organizationId: orgId,
				name: data.name,
				dbType: data.dbType,
				host: data.host,
				port: data.port,
				database: data.database,
				username: data.username,
				encryptedPassword: encrypted,
				encryptionKeyId,
				pollingIntervalMinutes: data.pollingIntervalMinutes,
				status: "ACTIVE",
			},
		});

		logger.info(
			{ userId, orgId, connectionId: connection.id },
			"Successfully created a new connection",
		);

		return NextResponse.json({
			id: connection.id,
			name: connection.name,
			dbType: connection.dbType,
			host: connection.host,
			port: connection.port,
			database: connection.database,
			username: connection.username,
			pollingIntervalMinutes: connection.pollingIntervalMinutes,
			status: connection.status,
			lastSyncedAt: connection.lastSyncedAt,
			createdAt: connection.createdAt,
			updatedAt: connection.updatedAt,
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			logger.warn(
				{ userId, orgId, error: error.errors },
				"Invalid input for creating a connection",
			);
			return NextResponse.json(
				{ error: "Invalid input", details: error.errors },
				{ status: 400 },
			);
		}
		logger.error({ userId, orgId, error }, "Failed to create connection");
		return NextResponse.json(
			{ error: "Failed to create connection" },
			{ status: 500 },
		);
	}
}
