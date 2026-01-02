import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
	process.env.JWT_SECRET || "development-secret-key-change-in-production",
);

const isClerkEnabled = !!(
	process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

const isProtectedRoute = createRouteMatcher([
	"/dashboard(.*)",
	"/api/connections(.*)",
	"/api/analytics(.*)",
	"/api/suggestions(.*)",
]);

async function verifyBasicAuth(token: string): Promise<boolean> {
	try {
		await jwtVerify(token, JWT_SECRET);
		return true;
	} catch {
		return false;
	}
}

async function handleBasicAuth(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Skip middleware for public routes
	if (
		pathname.startsWith("/_next") ||
		pathname.startsWith("/api/auth") || // Allow auth endpoints
		pathname.startsWith("/static") ||
		pathname === "/favicon.ico"
	) {
		return NextResponse.next();
	}

	const isAuthRoute =
		pathname.startsWith("/sign-in") ||
		pathname.startsWith("/sign-up") ||
		pathname.startsWith("/basic-login");

	const token = req.cookies.get("auth-token");
	const isAuthenticated = token ? await verifyBasicAuth(token.value) : false;

	// Redirect to login if not authenticated and trying to access protected route
	if (!isAuthenticated && !isAuthRoute) {
		const loginUrl = new URL("/basic-login", req.url);
		return NextResponse.redirect(loginUrl);
	}

	// Redirect to dashboard if authenticated and trying to access login page
	if (isAuthenticated && isAuthRoute) {
		const dashboardUrl = new URL("/dashboard", req.url);
		return NextResponse.redirect(dashboardUrl);
	}

	return NextResponse.next();
}

export default async function middleware(req: NextRequest) {
	if (isClerkEnabled) {
		// Use Clerk middleware
		return clerkMiddleware(async (auth) => {
			if (isProtectedRoute(req)) {
				await auth.protect();
			}
		})(req);
	}

	// Use basic auth
	return handleBasicAuth(req);
}

export const config = {
	matcher: ["/((?!_next|[^?]*\\.(?:html?|ico|png|svg|jpg|jpeg|gif|webp)).*)"],
};
