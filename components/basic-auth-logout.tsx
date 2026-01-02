"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BasicAuthLogoutButton() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);

	const handleLogout = async () => {
		setIsLoading(true);
		try {
			await fetch("/api/auth/logout", { method: "POST" });
			router.push("/basic-login");
			router.refresh();
		} catch (error) {
			console.error("Logout error:", error);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<button
			onClick={handleLogout}
			disabled={isLoading}
			className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
		>
			{isLoading ? "Logging out..." : "Logout"}
		</button>
	);
}
