"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { IconChartBar, IconDatabase } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
	{
		icon: IconDatabase,
		label: "Connections",
		href: "/dashboard/connections",
	},
	{ icon: IconChartBar, label: "Analytics", href: "/dashboard/analytics" },
	// { icon: IconBulb, label: "Suggestions", href: "/dashboard/suggestions" },
];

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();

	return (
		<div className="flex h-screen bg-gray-100">
			<aside className="w-64 bg-white p-4 flex flex-col border-r border-gray-200">
				<div className="mb-8">
					<h1 className="text-2xl font-bold text-gray-800">MeshAG</h1>
				</div>
				<div className="mb-8">
					<OrganizationSwitcher
						hidePersonal
						afterSelectOrganizationUrl="/dashboard/connections"
						afterCreateOrganizationUrl="/dashboard/connections"
					/>
				</div>
				<nav className="grow">
					<ul>
						{navItems.map((item) => {
							const Icon = item.icon;
							const isActive = pathname === item.href;
							return (
								<li key={item.href} className="mb-2">
									<Link
										href={item.href}
										className={`flex items-center p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors ${
											isActive ? "bg-gray-100 text-blue-600 font-medium" : ""
										}`}
									>
										<Icon className="w-5 h-5 mr-3" stroke={1.5} />
										{item.label}
									</Link>
								</li>
							);
						})}
					</ul>
				</nav>
				<div className="pt-4 border-t border-gray-200">
					<UserButton showName />
				</div>
			</aside>
			<main className="flex-1 p-8 overflow-y-auto">{children}</main>
		</div>
	);
}
