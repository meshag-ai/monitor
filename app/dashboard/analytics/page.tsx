/** biome-ignore-all lint/suspicious/noArrayIndexKey: <explanation> */
"use client";

import { useOrganization } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface Connection {
	id: string;
	name: string;
}

interface AnalyticsData {
	totalQueries: string;
	avgExecutionTime: number;
	slowQueries: number;
	mostFrequent: any[];
	slowest: any[];
	tablePatterns: any[];
	indexUsage: any[];
}

export default function AnalyticsPage() {
	const { organization } = useOrganization();
	const [connections, setConnections] = useState<Connection[]>([]);
	const [selectedConnection, setSelectedConnection] = useState<string | null>(
		null,
	);
	const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (organization) {
			fetch("/api/connections")
				.then((res) => res.json())
				.then((data) => {
					setConnections(data);
					if (data.length > 0) {
						setSelectedConnection(data[0].id);
					} else {
						setSelectedConnection(null);
						setAnalytics(null);
					}
				});
		}
	}, [organization]);

	useEffect(() => {
		if (selectedConnection) {
			setLoading(true);
			fetch(`/api/analytics/${selectedConnection}`)
				.then((res) => res.json())
				.then((data) => {
					if (data.indexUsage.length === 0 && data.mostFrequent.length === 0) {
						toast(
							"Come back in 20 mins, we are evaluating the DB query executions",
							{
								icon: "⏳",
								duration: 5000,
								id: "evaluation-toast",
							},
						);
					}
					setAnalytics(data);
					setLoading(false);
				})
				.catch(() => {
					toast.error("Failed to load analytics");
					setLoading(false);
				});
		}
	}, [selectedConnection]);

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
				<div className="w-[280px]">
					<Select
						value={selectedConnection ?? ""}
						onValueChange={(value) => setSelectedConnection(value)}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select connection" />
						</SelectTrigger>
						<SelectContent>
							{connections.map((c) => (
								<SelectItem key={c.id} value={c.id}>
									{c.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{loading && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
					{[...Array(3)].map((_, i) => (
						<div
							key={`stat-skeleton-${i}`}
							className="bg-muted rounded-xl h-32"
						></div>
					))}
					{[...Array(4)].map((_, i) => (
						<div
							key={`table-skeleton-${i}`}
							className={`bg-muted rounded-xl h-96 ${i < 2 ? "md:col-span-2 lg:col-span-3" : ""}`}
						></div>
					))}
				</div>
			)}

			{analytics && selectedConnection && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Total Queries
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{Number(analytics.totalQueries ?? 0).toLocaleString()}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Avg Execution Time
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{analytics?.avgExecutionTime?.toFixed(2) || 0} ms
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Slow Queries
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-destructive">
								{analytics.slowQueries ?? 0}
							</div>
						</CardContent>
					</Card>

					<Card className="md:col-span-2 lg:col-span-3">
						<CardHeader>
							<CardTitle>Most Frequent Queries</CardTitle>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Query</TableHead>
										<TableHead>Executions</TableHead>
										<TableHead>Avg Time</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{(analytics.mostFrequent ?? []).slice(0, 5).map((q: any) => (
										<TableRow key={q.id}>
											<TableCell className="font-mono text-xs max-w-xs truncate">
												{q.queryText}
											</TableCell>
											<TableCell>
												{Number(q.executionCount).toLocaleString()}
											</TableCell>
											<TableCell>
												{q.avgExecutionTimeMs.toFixed(2)} ms
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>

					<Card className="md:col-span-2 lg:col-span-3">
						<CardHeader>
							<CardTitle>Slowest Queries</CardTitle>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Query</TableHead>
										<TableHead>Executions</TableHead>
										<TableHead>Avg Time</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{(analytics.slowest ?? []).slice(0, 5).map((q: any) => (
										<TableRow key={q.id}>
											<TableCell className="font-mono text-xs max-w-xs truncate">
												{q.queryText}
											</TableCell>
											<TableCell>
												{Number(q.executionCount).toLocaleString()}
											</TableCell>
											<TableCell>
												<Badge variant="destructive">
													{q.avgExecutionTimeMs.toFixed(2)} ms
												</Badge>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Table Access Patterns</CardTitle>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Table</TableHead>
										<TableHead>Access Count</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{(analytics.tablePatterns ?? [])
										.slice(0, 10)
										.map((t: any) => (
											<TableRow key={t.id}>
												<TableCell className="font-medium">
													{t.tableName}
												</TableCell>
												<TableCell>
													{Number(t.accessCount).toLocaleString()}
												</TableCell>
											</TableRow>
										))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Index Usage</CardTitle>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Table</TableHead>
										<TableHead>Index</TableHead>
										<TableHead>Scans</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{(analytics.indexUsage ?? []).slice(0, 10).map((idx: any) => (
										<TableRow key={idx.id}>
											<TableCell className="font-medium">
												{idx.tableName}
											</TableCell>
											<TableCell className="font-mono text-xs">
												{idx.indexName}
											</TableCell>
											<TableCell>
												{Number(idx.scans).toLocaleString()}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</div>
			)}

			{!analytics && !loading && (
				<div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50 min-h-[400px]">
					<div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
						<h3 className="mt-4 text-lg font-semibold">No Data to Display</h3>
						<p className="mb-4 mt-2 text-sm text-muted-foreground">
							Select a database connection above to view analytics.
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
