"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";
import { Activity, Database, LayoutDashboard } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navigation = [
	// { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
	{ name: "Connections", href: "/dashboard/connections", icon: Database },
	{ name: "Analytics", href: "/dashboard/analytics", icon: Activity },
	// { name: "Suggestions", href: "/dashboard/suggestions", icon: Zap },
	// { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
	const pathname = usePathname();

	return (
		<div className="flex h-full w-64 flex-col border-r bg-card">
			<div className="flex h-14 items-center border-b px-6 gap-2">
				<Image
					alt="Logo"
					width={24}
					height={24}
					className="rounded-md"
					src="/icon.png"
				/>
				<span className="font-semibold">MeshAG</span>
			</div>
			<div className="p-4">
				<OrganizationSwitcher
					hidePersonal
					afterSelectOrganizationUrl="/dashboard"
					afterCreateOrganizationUrl="/dashboard"
					appearance={{
						elements: {
							rootBox: "w-full",
							organizationSwitcherTrigger: "w-full justify-between",
						},
					}}
				/>
			</div>
			<div className="flex-1 overflow-y-auto py-2">
				<nav className="grid gap-1 px-2">
					{navigation.map((item) => {
						const isActive = pathname === item.href;
						return (
							<Link
								key={item.name}
								href={item.href}
								className={cn(
									"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
									isActive
										? "bg-primary/10 text-primary"
										: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
								)}
							>
								<item.icon className="h-4 w-4" />
								{item.name}
							</Link>
						);
					})}
				</nav>
			</div>
		</div>
	);
}
