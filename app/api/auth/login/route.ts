import { NextResponse } from "next/server";
import { createToken, login, setAuthCookie } from "@/lib/auth";

export async function POST(request: Request) {
	try {
		const { email, password } = await request.json();

		if (!email || !password) {
			return NextResponse.json(
				{ error: "Email and password are required" },
				{ status: 400 },
			);
		}

		const user = await login(email, password);

		if (!user) {
			return NextResponse.json(
				{ error: "Invalid credentials" },
				{ status: 401 },
			);
		}

		const token = await createToken(user);
		await setAuthCookie(token);

		return NextResponse.json({
			user: { id: user.id, email: user.email, name: user.name },
		});
	} catch (error) {
		console.error("Login error:", error);
		return NextResponse.json(
			{ error: "An error occurred during login" },
			{ status: 500 },
		);
	}
}
