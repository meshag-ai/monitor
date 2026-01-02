import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
	console.log("🌱 Seeding database...");

	// Create demo admin user
	const adminEmail = "admin@example.com";
	const existingAdmin = await prisma.user.findFirst({
		where: { email: adminEmail },
	});

	if (!existingAdmin) {
		const passwordHash = await bcrypt.hash("admin123", 10);
		const admin = await prisma.user.create({
			data: {
				id: crypto.randomUUID(),
				email: adminEmail,
				name: "Admin User",
				passwordHash,
			},
		});
		console.log(`✅ Created admin user: ${admin.email}`);
	} else {
		console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
	}

	// Create demo regular user
	const demoEmail = "demo@example.com";
	const existingDemo = await prisma.user.findFirst({
		where: { email: demoEmail },
	});

	if (!existingDemo) {
		const passwordHash = await bcrypt.hash("demo123", 10);
		const demo = await prisma.user.create({
			data: {
				id: crypto.randomUUID(),
				email: demoEmail,
				name: "Demo User",
				passwordHash,
			},
		});
		console.log(`✅ Created demo user: ${demo.email}`);
	} else {
		console.log(`ℹ️  Demo user already exists: ${demoEmail}`);
	}

	console.log("✨ Seeding complete!");
}

main()
	.catch((e) => {
		console.error("❌ Error seeding database:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
