import bcrypt from "bcrypt";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const JWT_SECRET = new TextEncoder().encode(
	process.env.JWT_SECRET || "development-secret-key-change-in-production",
);

export interface User {
	id: string;
	email: string;
	name?: string | null;
}

export async function createToken(user: User): Promise<string> {
	return await new SignJWT({ userId: user.id, email: user.email })
		.setProtectedHeader({ alg: "HS256" })
		.setExpirationTime("7d")
		.setIssuedAt()
		.sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<User | null> {
	try {
		const { payload } = await jwtVerify(token, JWT_SECRET);
		return {
			id: payload.userId as string,
			email: payload.email as string,
		};
	} catch {
		return null;
	}
}

export async function login(
	email: string,
	password: string,
): Promise<User | null> {
	try {
		const user = await prisma.user.findFirst({
			where: { email },
			select: {
				id: true,
				email: true,
				name: true,
				passwordHash: true,
			},
		});

		if (!user || !user.passwordHash) {
			return null;
		}

		const isValidPassword = await bcrypt.compare(password, user.passwordHash);

		if (!isValidPassword) {
			return null;
		}

		return {
			id: user.id,
			email: user.email,
			name: user.name,
		};
	} catch (error) {
		console.error("Login error:", error);
		return null;
	}
}

export async function createUser(
	email: string,
	password: string,
	name?: string,
): Promise<User | null> {
	try {
		const passwordHash = await bcrypt.hash(password, 10);

		const user = await prisma.user.create({
			data: {
				id: crypto.randomUUID(),
				email,
				name,
				passwordHash,
			},
		});

		return {
			id: user.id,
			email: user.email,
			name: user.name,
		};
	} catch (error) {
		console.error("Create user error:", error);
		return null;
	}
}

export async function getCurrentUser(): Promise<User | null> {
	const cookieStore = await cookies();
	const token = cookieStore.get("auth-token");

	if (!token) {
		return null;
	}

	return verifyToken(token.value);
}

export async function setAuthCookie(token: string) {
	const cookieStore = await cookies();
	cookieStore.set("auth-token", token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 60 * 60 * 24 * 7, // 7 days
		path: "/",
	});
}

export async function clearAuthCookie() {
	const cookieStore = await cookies();
	cookieStore.delete("auth-token");
}

export function isClerkEnabled(): boolean {
	return !!(
		process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
		process.env.CLERK_SECRET_KEY
	);
}
