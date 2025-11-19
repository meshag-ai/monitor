import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
	const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

	if (!WEBHOOK_SECRET) {
		throw new Error(
			"Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local",
		);
	}

	const headerPayload = await headers();
	const svix_id = headerPayload.get("svix-id");
	const svix_timestamp = headerPayload.get("svix-timestamp");
	const svix_signature = headerPayload.get("svix-signature");

	if (!svix_id || !svix_timestamp || !svix_signature) {
		logger.warn("Clerk webhook called with missing svix headers");
		return new Response("Error occurred -- no svix headers", {
			status: 400,
		});
	}

	const payload = await req.json();
	const body = JSON.stringify(payload);

	const wh = new Webhook(WEBHOOK_SECRET);

	let evt: WebhookEvent;

	try {
		evt = wh.verify(body, {
			"svix-id": svix_id,
			"svix-timestamp": svix_timestamp,
			"svix-signature": svix_signature,
		}) as WebhookEvent;
	} catch (err) {
		logger.error({ err }, "Error verifying Clerk webhook");
		return new Response("Error occurred", {
			status: 400,
		});
	}

	const log = logger.child({ webhookId: evt.data.id, eventType: evt.type });

	try {
		if (evt.type === "user.created") {
			log.info("Processing user.created webhook");
			await prisma.user.create({
				data: {
					id: evt.data.id,
					email: evt.data.email_addresses[0]?.email_address || "",
				},
			});
			log.info("User created successfully");
		}

		if (evt.type === "user.updated") {
			log.info("Processing user.updated webhook");
			await prisma.user.update({
				where: { id: evt.data.id },
				data: {
					email: evt.data.email_addresses[0]?.email_address || "",
				},
			});
			log.info("User updated successfully");
		}

		if (evt.type === "user.deleted") {
			log.info("Processing user.deleted webhook");
			await prisma.user.delete({
				where: { id: evt.data.id! },
			});
			log.info("User deleted successfully");
		}

		if (evt.type === "organization.created") {
			log.info("Processing organization.created webhook");
			await prisma.organization.create({
				data: {
					id: evt.data.id,
					name: evt.data.name,
				},
			});
			log.info("Organization created successfully");
		}

		if (evt.type === "organization.updated") {
			log.info("Processing organization.updated webhook");
			await prisma.organization.update({
				where: { id: evt.data.id },
				data: {
					name: evt.data.name,
				},
			});
			log.info("Organization updated successfully");
		}

		if (evt.type === "organization.deleted") {
			log.info("Processing organization.deleted webhook");
			await prisma.organization.delete({
				where: { id: evt.data.id },
			});
			log.info("Organization deleted successfully");
		}

		if (evt.type === "organizationMembership.created") {
			log.info("Processing organizationMembership.created webhook");
			await prisma.organizationUser.create({
				data: {
					organizationId: evt.data.organization.id,
					userId: evt.data.public_user_data.user_id,
					role: evt.data.role,
				},
			});
			log.info("Organization membership created successfully");
		}

		if (evt.type === "organizationMembership.updated") {
			log.info("Processing organizationMembership.updated webhook");
			await prisma.organizationUser.update({
				where: {
					organizationId_userId: {
						organizationId: evt.data.organization.id,
						userId: evt.data.public_user_data.user_id,
					},
				},
				data: {
					role: evt.data.role,
				},
			});
			log.info("Organization membership updated successfully");
		}

		if (evt.type === "organizationMembership.deleted") {
			log.info("Processing organizationMembership.deleted webhook");
			await prisma.organizationUser.delete({
				where: {
					organizationId_userId: {
						organizationId: evt.data.organization.id,
						userId: evt.data.public_user_data.user_id,
					},
				},
			});
			log.info("Organization membership deleted successfully");
		}
	} catch (error) {
		log.error({ error }, "Error processing Clerk webhook");
		return new Response("Error occurred", { status: 500 });
	}

	return new Response("", { status: 200 });
}
