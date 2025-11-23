"use client";

import { UserButton } from "@clerk/nextjs";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
	return (
		<header className="flex h-14 items-center gap-4 border-b bg-background px-6">
			<div className="flex-1">
				<h1 className="text-lg font-semibold">Dashboard</h1>
			</div>
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="icon" className="text-muted-foreground">
					<Bell className="h-5 w-5" />
				</Button>
				<UserButton />
			</div>
		</header>
	);
}
