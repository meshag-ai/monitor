import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptCredentials } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const updateConnectionSchema = z.object({
	name: z.string().min(1).optional(),
	host: z.string().min(1).optional(),
	port: z.number().int().positive().optional(),
	database: z.string().min(1).optional(),
	username: z.string().min(1).optional(),
	password: z.string().min(1).optional(),
	pollingIntervalMinutes: z.number().int().positive().optional(),
});

export async function GET(
	req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { userId, orgId } = await auth();
	const { id } = await params;
	const log = logger.child({ userId, orgId, connectionId: id, method: "GET" });

	if (!userId) {
		log.warn("Unauthorized access attempt");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!orgId) {
		log.warn("User is not part of an organization");
		return NextResponse.json(
			{ error: "User is not part of an organization" },
			{ status: 400 },
		);
	}

	log.info("Fetching connection");

	const connection = await prisma.connection.findFirst({
		where: { id, organizationId: orgId },
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
	});

	if (!connection) {
		log.warn("Connection not found");
		return NextResponse.json(
			{ error: "Connection not found" },
			{ status: 404 },
		);
	}

	log.info("Successfully fetched connection");
	return NextResponse.json(connection);
}

export async function PUT(
	req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { userId, orgId } = await auth();
	const { id } = await params;
	const log = logger.child({ userId, orgId, connectionId: id, method: "PUT" });

	if (!userId) {
		log.warn("Unauthorized access attempt");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!orgId) {
		log.warn("User is not part of an organization");
		return NextResponse.json(
			{ error: "User is not part of an organization" },
			{ status: 400 },
		);
	}

	try {
		const body = await req.json();
		const data = updateConnectionSchema.parse(body);

		log.info({ data: Object.keys(data) }, "Attempting to update connection");

		const existing = await prisma.connection.findFirst({
			where: { id, organizationId: orgId },
		});

		if (!existing) {
			log.warn("Connection not found");
			return NextResponse.json(
				{ error: "Connection not found" },
				{ status: 404 },
			);
		}

		const updateData: Prisma.ConnectionUpdateInput = {};
		if (data.name) updateData.name = data.name;
		if (data.host) updateData.host = data.host;
		if (data.port) updateData.port = data.port;
		if (data.database) updateData.database = data.database;
		if (data.username) updateData.username = data.username;
		if (data.pollingIntervalMinutes)
			updateData.pollingIntervalMinutes = data.pollingIntervalMinutes;

		if (data.password) {
			const { encrypted, encryptionKeyId } = encryptCredentials(data.password);
			updateData.encryptedPassword = encrypted;
			updateData.encryptionKeyId = encryptionKeyId;
		}

		const connection = await prisma.connection.update({
			where: { id },
			data: updateData,
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
		});

		log.info("Successfully updated connection");
		return NextResponse.json(connection);
	} catch (error) {
		if (error instanceof z.ZodError) {
			log.warn(
				{ error: error.errors },
				"Invalid input for updating a connection",
			);
			return NextResponse.json(
				{ error: "Invalid input", details: error.errors },
				{ status: 400 },
			);
		}
		log.error({ error }, "Failed to update connection");
		return NextResponse.json(
			{ error: "Failed to update connection" },
			{ status: 500 },
		);
	}
}

export async function DELETE(
	req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { userId, orgId } = await auth();
	const { id } = await params;
	const log = logger.child({
		userId,
		orgId,
		connectionId: id,
		method: "DELETE",
	});

	if (!userId) {
		log.warn("Unauthorized access attempt");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!orgId) {
		log.warn("User is not part of an organization");
		return NextResponse.json(
			{ error: "User is not part of an organization" },
			{ status: 400 },
		);
	}

	try {
		log.info("Attempting to delete connection");
		const connection = await prisma.connection.findFirst({
			where: { id, organizationId: orgId },
		});

		if (!connection) {
			log.warn("Connection not found");
			return NextResponse.json(
				{ error: "Connection not found" },
				{ status: 404 },
			);
		}

		await prisma.connection.delete({
			where: { id },
		});

		log.info("Successfully deleted connection");
		return NextResponse.json({ success: true });
	} catch (error) {
		log.error({ error }, "Failed to delete connection");
		return NextResponse.json(
			{ error: "Failed to delete connection" },
			{ status: 500 },
		);
	}
}
