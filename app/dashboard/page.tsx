import { Activity, Database, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-3xl font-bold tracking-tight">Overview</h2>
				<p className="text-muted-foreground">
					Monitor your database performance and health.
				</p>
			</div>
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Active Connections
						</CardTitle>
						<Database className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">3</div>
						<p className="text-xs text-muted-foreground">+1 from last month</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Slow Queries</CardTitle>
						<Activity className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">12</div>
						<p className="text-xs text-muted-foreground">-4 from yesterday</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Optimization Suggestions
						</CardTitle>
						<Zap className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">7</div>
						<p className="text-xs text-muted-foreground">2 high priority</p>
					</CardContent>
				</Card>
			</div>
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
				<Card className="col-span-4">
					<CardHeader>
						<CardTitle>Query Performance</CardTitle>
					</CardHeader>
					<CardContent className="pl-2">
						<div className="h-[200px] flex items-center justify-center text-muted-foreground">
							Chart Placeholder
						</div>
					</CardContent>
				</Card>
				<Card className="col-span-3">
					<CardHeader>
						<CardTitle>Recent Activity</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-8">
							<div className="flex items-center">
								<div className="space-y-1">
									<p className="text-sm font-medium leading-none">
										New index suggested
									</p>
									<p className="text-sm text-muted-foreground">
										users_email_idx on public.users
									</p>
								</div>
								<div className="ml-auto font-medium">2m ago</div>
							</div>
							<div className="flex items-center">
								<div className="space-y-1">
									<p className="text-sm font-medium leading-none">
										High CPU usage detected
									</p>
									<p className="text-sm text-muted-foreground">
										Connection: Production DB
									</p>
								</div>
								<div className="ml-auto font-medium">1h ago</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
