"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "react-hot-toast";

const isClerkEnabled =
	typeof window !== "undefined" &&
	process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function Providers({ children }: { children: React.ReactNode }) {
	if (isClerkEnabled) {
		return (
			<ClerkProvider>
				{children}
				<Toaster />
			</ClerkProvider>
		);
	}

	return (
		<>
			{children}
			<Toaster />
		</>
	);
}
