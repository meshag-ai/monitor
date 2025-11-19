/** biome-ignore-all lint/suspicious/noArrayIndexKey: <explanation> */
"use client";

import { useOrganization } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

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
		<div className="container mx-auto p-8">
			<div className="flex justify-between items-center mb-8">
				<h1 className="text-3xl font-bold">Analytics</h1>
				<select
					value={selectedConnection ?? ""}
					onChange={(e) => setSelectedConnection(e.target.value)}
					className="p-2 border rounded-md w-72 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 cursor-pointer"
				>
					<option value="" disabled>
						Select connection
					</option>
					{connections.map((c) => (
						<option key={c.id} value={c.id}>
							{c.name}
						</option>
					))}
				</select>
			</div>

			{loading && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-pulse">
					{[...Array(3)].map((_, i) => (
						<div
							key={`stat-skeleton-${i}`}
							className="bg-white rounded-lg shadow-md p-6 border border-gray-100 h-32"
						>
							<div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
							<div className="h-8 bg-gray-200 rounded w-1/3"></div>
						</div>
					))}
					{[...Array(4)].map((_, i) => (
						<div
							key={`table-skeleton-${i}`}
							className={`bg-white rounded-lg shadow-md p-6 border border-gray-100 h-96 ${i < 2 ? "md:col-span-2 lg:col-span-3" : ""}`}
						>
							<div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
							<div className="space-y-4">
								{[...Array(5)].map((_, j) => (
									<div
										key={j}
										className="h-12 bg-gray-100 rounded w-full"
									></div>
								))}
							</div>
						</div>
					))}
				</div>
			)}

			{analytics && selectedConnection && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
					<div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
						<h2 className="text-lg font-semibold mb-2 text-gray-800">
							Total Queries
						</h2>
						<p className="text-2xl font-bold text-gray-900">
							{Number(analytics.totalQueries ?? 0).toLocaleString()}
						</p>
					</div>

					<div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
						<h2 className="text-lg font-semibold mb-2 text-gray-800">
							Avg Execution Time
						</h2>
						<p className="text-2xl font-bold text-gray-900">
							{analytics?.avgExecutionTime?.toFixed(2) || 0} ms
						</p>
					</div>

					<div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
						<h2 className="text-lg font-semibold mb-2 text-gray-800">
							Slow Queries
						</h2>
						<p className="text-2xl font-bold text-red-600">
							{analytics.slowQueries ?? 0}
						</p>
					</div>

					<div className="md:col-span-2 lg:col-span-3 bg-white rounded-lg shadow-md p-6 border border-gray-100">
						<h2 className="text-lg font-semibold mb-4 text-gray-800">
							Most Frequent Queries
						</h2>
						<table className="w-full text-sm text-left">
							<thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
								<tr>
									<th scope="col" className="px-6 py-3 font-medium">
										Query
									</th>
									<th scope="col" className="px-6 py-3 font-medium">
										Executions
									</th>
									<th scope="col" className="px-6 py-3 font-medium">
										Avg Time
									</th>
								</tr>
							</thead>
							<tbody className="text-gray-600">
								{(analytics.mostFrequent ?? []).slice(0, 5).map((q: any) => (
									<tr
										key={q.id}
										className="bg-white border-b hover:bg-gray-50 transition-colors"
									>
										<td className="px-6 py-4 truncate max-w-xs font-mono text-xs text-gray-700">
											{q.queryText}
										</td>
										<td className="px-6 py-4">
											{Number(q.executionCount).toLocaleString()}
										</td>
										<td className="px-6 py-4">
											{q.avgExecutionTimeMs.toFixed(2)} ms
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<div className="md:col-span-2 lg:col-span-3 bg-white rounded-lg shadow-md p-6 border border-gray-100">
						<h2 className="text-lg font-semibold mb-4 text-gray-800">
							Slowest Queries
						</h2>
						<table className="w-full text-sm text-left">
							<thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
								<tr>
									<th scope="col" className="px-6 py-3 font-medium">
										Query
									</th>
									<th scope="col" className="px-6 py-3 font-medium">
										Executions
									</th>
									<th scope="col" className="px-6 py-3 font-medium">
										Avg Time
									</th>
								</tr>
							</thead>
							<tbody className="text-gray-600">
								{(analytics.slowest ?? []).slice(0, 5).map((q: any) => (
									<tr
										key={q.id}
										className="bg-white border-b hover:bg-gray-50 transition-colors"
									>
										<td className="px-6 py-4 truncate max-w-xs font-mono text-xs text-gray-700">
											{q.queryText}
										</td>
										<td className="px-6 py-4">
											{Number(q.executionCount).toLocaleString()}
										</td>
										<td className="px-6 py-4">
											<span className="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-red-200">
												{q.avgExecutionTimeMs.toFixed(2)} ms
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
						<h2 className="text-lg font-semibold mb-4 text-gray-800">
							Table Access Patterns
						</h2>
						<table className="w-full text-sm text-left">
							<thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
								<tr>
									<th scope="col" className="px-6 py-3 font-medium">
										Table
									</th>
									<th scope="col" className="px-6 py-3 font-medium">
										Access Count
									</th>
								</tr>
							</thead>
							<tbody className="text-gray-600">
								{(analytics.tablePatterns ?? []).slice(0, 10).map((t: any) => (
									<tr
										key={t.id}
										className="bg-white border-b hover:bg-gray-50 transition-colors"
									>
										<td className="px-6 py-4 font-medium text-gray-900">
											{t.tableName}
										</td>
										<td className="px-6 py-4">
											{Number(t.accessCount).toLocaleString()}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
						<h2 className="text-lg font-semibold mb-4 text-gray-800">
							Index Usage
						</h2>
						<table className="w-full text-sm text-left">
							<thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
								<tr>
									<th scope="col" className="px-6 py-3 font-medium">
										Table
									</th>
									<th scope="col" className="px-6 py-3 font-medium">
										Index
									</th>
									<th scope="col" className="px-6 py-3 font-medium">
										Scans
									</th>
								</tr>
							</thead>
							<tbody className="text-gray-600">
								{(analytics.indexUsage ?? []).slice(0, 10).map((idx: any) => (
									<tr
										key={idx.id}
										className="bg-white border-b hover:bg-gray-50 transition-colors"
									>
										<td className="px-6 py-4 font-medium text-gray-900">
											{idx.tableName}
										</td>
										<td className="px-6 py-4 font-mono text-xs">
											{idx.indexName}
										</td>
										<td className="px-6 py-4">
											{Number(idx.scans).toLocaleString()}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{!analytics && !loading && (
				<div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-100">
					<div className="text-gray-300 mb-4">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-16 w-16 mx-auto"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<title>No data to display</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1}
								d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
							/>
						</svg>
					</div>
					<h3 className="text-lg font-medium text-gray-900 mb-1">
						No Data to Display
					</h3>
					<p className="text-gray-500">
						Select a database connection above to view analytics
					</p>
				</div>
			)}
		</div>
	);
}
