"use client";

import { useOrganization } from "@clerk/nextjs";
import { IconBulb, IconCheck, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

interface Connection {
	id: string;
	name: string;
}

interface Suggestion {
	id: string;
	suggestionText: string;
	suggestionType: string;
	priority: string;
	status: string;
	createdAt: string;
	queryExecution: {
		id: string;
		queryText: string;
	} | null;
}

export default function SuggestionsPage() {
	const { organization } = useOrganization();
	const [connections, setConnections] = useState<Connection[]>([]);
	const [selectedConnection, setSelectedConnection] = useState<string | null>(
		null,
	);
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
	const [loading, setLoading] = useState(false);
	const [generating, setGenerating] = useState(false);
	const [filterStatus, setFilterStatus] = useState<string | null>(null);
	const [filterPriority, setFilterPriority] = useState<string | null>(null);

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
						setSuggestions([]);
					}
				});
		}
	}, [organization]);

	useEffect(() => {
		if (selectedConnection) {
			setLoading(true);
			const params = new URLSearchParams();
			if (filterStatus) params.append("status", filterStatus);
			if (filterPriority) params.append("priority", filterPriority);

			fetch(`/api/suggestions/${selectedConnection}?${params.toString()}`)
				.then((res) => res.json())
				.then((data) => {
					setSuggestions(data);
					setLoading(false);
				})
				.catch((error) => {
					console.error(error);
					toast.error("Failed to load suggestions");
					setLoading(false);
				});
		}
	}, [selectedConnection, filterStatus, filterPriority]);

	const handleGenerate = async () => {
		if (!selectedConnection) return;

		setGenerating(true);
		try {
			const response = await fetch(
				`/api/suggestions/${selectedConnection}/generate`,
				{
					method: "POST",
				},
			);

			if (response.ok) {
				toast.success("Suggestion generation started");
				setTimeout(() => {
					if (selectedConnection) {
						const params = new URLSearchParams();
						if (filterStatus) params.append("status", filterStatus);
						if (filterPriority) params.append("priority", filterPriority);
						fetch(`/api/suggestions/${selectedConnection}?${params.toString()}`)
							.then((res) => res.json())
							.then((data) => setSuggestions(data));
					}
				}, 5000);
			}
		} catch (error) {
			console.error(error);
			toast.error("Failed to generate suggestions");
		} finally {
			setGenerating(false);
		}
	};

	const handleUpdateStatus = async (id: string, status: string) => {
		try {
			const response = await fetch(`/api/suggestions/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status }),
			});

			if (response.ok) {
				setSuggestions((prev) =>
					prev.map((s) => (s.id === id ? { ...s, status } : s)),
				);
				toast.success("Suggestion status updated");
			} else {
				toast.error("Failed to update suggestion");
			}
		} catch (error) {
			console.error(error);
			toast.error("Failed to update suggestion");
		}
	};

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "HIGH":
				return "bg-red-500";
			case "MEDIUM":
				return "bg-yellow-500";
			case "LOW":
				return "bg-blue-500";
			default:
				return "bg-gray-500";
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "NEW":
				return "bg-blue-500";
			case "REVIEWED":
				return "bg-yellow-500";
			case "APPLIED":
				return "bg-green-500";
			case "DISMISSED":
				return "bg-gray-500";
			default:
				return "bg-gray-500";
		}
	};

	return (
		<div className="container mx-auto p-8">
			<div className="flex justify-between items-center mb-8">
				<h1 className="text-3xl font-bold">Optimization Suggestions</h1>
				<div className="flex items-center space-x-4">
					<select
						value={selectedConnection ?? ""}
						onChange={(e) => setSelectedConnection(e.target.value)}
						className="p-2 border rounded-md w-72 bg-white text-gray-900 border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
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
					<button
						type="button"
						onClick={handleGenerate}
						disabled={generating || !selectedConnection}
						className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center disabled:bg-gray-400 hover:cursor-pointer disabled:cursor-not-allowed"
					>
						<IconBulb className="w-4 h-4 mr-2" />
						{generating ? "Generating..." : "Generate Suggestions"}
					</button>
				</div>
			</div>

			{selectedConnection && (
				<div className="flex space-x-4 mb-4">
					<select
						value={filterStatus ?? ""}
						onChange={(e) => setFilterStatus(e.target.value || null)}
						className="p-2 border rounded-md bg-white text-gray-900 border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
					>
						<option value="">Filter by status</option>
						<option value="NEW">New</option>
						<option value="REVIEWED">Reviewed</option>
						<option value="APPLIED">Applied</option>
						<option value="DISMISSED">Dismissed</option>
					</select>
					<select
						value={filterPriority ?? ""}
						onChange={(e) => setFilterPriority(e.target.value || null)}
						className="p-2 border rounded-md bg-white text-gray-900 border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
					>
						<option value="">Filter by priority</option>
						<option value="HIGH">High</option>
						<option value="MEDIUM">Medium</option>
						<option value="LOW">Low</option>
					</select>
				</div>
			)}

			{loading && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 text-white">
					Loading...
				</div>
			)}

			<div className="space-y-4">
				{suggestions.map((suggestion) => (
					<div
						key={suggestion.id}
						className="bg-white rounded-lg shadow-md p-6 border border-gray-100"
					>
						<div className="flex justify-between items-center mb-2">
							<div className="flex items-center space-x-2">
								<span
									className={`px-2 py-1 text-xs font-semibold text-white rounded-full ${getPriorityColor(suggestion.priority)}`}
								>
									{suggestion.priority}
								</span>
								<span
									className={`px-2 py-1 text-xs font-semibold text-white rounded-full ${getStatusColor(suggestion.status)}`}
								>
									{suggestion.status}
								</span>
								<span className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-200 rounded-full">
									{suggestion.suggestionType}
								</span>
							</div>
							<div className="flex space-x-2">
								{suggestion.status === "NEW" && (
									<>
										<button
											type="button"
											onClick={() =>
												handleUpdateStatus(suggestion.id, "APPLIED")
											}
											className="p-2 rounded-full hover:bg-gray-100 text-green-600 transition-colors cursor-pointer"
										>
											<IconCheck className="w-4 h-4" />
										</button>
										<button
											type="button"
											onClick={() =>
												handleUpdateStatus(suggestion.id, "DISMISSED")
											}
											className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
										>
											<IconX className="w-4 h-4" />
										</button>
									</>
								)}
							</div>
						</div>
						<p className="text-sm my-4 whitespace-pre-wrap text-gray-700">
							{suggestion.suggestionText}
						</p>
						{suggestion.queryExecution && (
							<div className="bg-gray-50 rounded p-3 mb-4 border border-gray-200">
								<p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wider">
									Related Query
								</p>
								<pre className="text-xs font-mono whitespace-pre-wrap text-gray-800 bg-white p-2 rounded border border-gray-100 overflow-x-auto">
									{suggestion.queryExecution.queryText.substring(0, 200)}
									{suggestion.queryExecution.queryText.length > 200
										? "..."
										: ""}
								</pre>
							</div>
						)}
						<p className="text-xs text-gray-400">
							Created: {new Date(suggestion.createdAt).toLocaleString()}
						</p>
					</div>
				))}
			</div>

			{!loading && suggestions.length === 0 && (
				<div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-100">
					<div className="text-gray-300 mb-4">
						<IconBulb className="w-16 h-16 mx-auto" stroke={1} />
					</div>
					<h3 className="text-lg font-medium text-gray-900 mb-1">
						No Suggestions Found
					</h3>
					<p className="text-gray-500">
						{selectedConnection
							? 'Click "Generate Suggestions" to analyze your database.'
							: "Select a connection above to view optimization suggestions."}
					</p>
				</div>
			)}
		</div>
	);
}
