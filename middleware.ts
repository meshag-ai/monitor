import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
	process.env.JWT_SECRET || "development-secret-key-change-in-production",
);

const isClerkEnabled = !!(
	process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

async function verifyBasicAuth(token: string): Promise<boolean> {
	try {
		await jwtVerify(token, JWT_SECRET);
		return true;
	} catch {
		return false;
	}
}

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Skip middleware for public routes
	if (
		pathname.startsWith("/_next") ||
		pathname.startsWith("/api") ||
		pathname.startsWith("/static") ||
		pathname === "/favicon.ico"
	) {
		return NextResponse.next();
	}

	// If Clerk is enabled, let Clerk handle auth
	if (isClerkEnabled) {
		return NextResponse.next();
	}

	// Basic auth handling
	const isAuthRoute =
		pathname.startsWith("/sign-in") ||
		pathname.startsWith("/sign-up") ||
		pathname.startsWith("/basic-login");

	const token = request.cookies.get("auth-token");
	const isAuthenticated = token ? await verifyBasicAuth(token.value) : false;

	// Redirect to login if not authenticated and trying to access protected route
	if (!isAuthenticated && !isAuthRoute) {
		const loginUrl = new URL("/basic-login", request.url);
		return NextResponse.redirect(loginUrl);
	}

	// Redirect to dashboard if authenticated and trying to access login page
	if (isAuthenticated && isAuthRoute) {
		const dashboardUrl = new URL("/dashboard", request.url);
		return NextResponse.redirect(dashboardUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
