"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ClerkProvider>
			{children}
			<Toaster />
		</ClerkProvider>
	);
}
