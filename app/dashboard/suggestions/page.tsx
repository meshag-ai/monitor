"use client";

import { useOrganization } from "@clerk/nextjs";
import { IconBulb, IconCheck, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

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

	const getPriorityVariant = (priority: string) => {
		switch (priority) {
			case "HIGH":
				return "destructive";
			case "MEDIUM":
				return "default"; // Using default (primary color) for medium
			case "LOW":
				return "secondary";
			default:
				return "outline";
		}
	};

	const getStatusVariant = (status: string) => {
		switch (status) {
			case "NEW":
				return "default";
			case "REVIEWED":
				return "secondary";
			case "APPLIED":
				return "outline"; // Greenish usually, but outline works for applied
			case "DISMISSED":
				return "ghost";
			default:
				return "outline";
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
				<h1 className="text-3xl font-bold tracking-tight">
					Optimization Suggestions
				</h1>
				<div className="flex items-center gap-2 w-full md:w-auto">
					<div className="w-full md:w-[280px]">
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
					<Button
						onClick={handleGenerate}
						disabled={generating || !selectedConnection}
					>
						<IconBulb className="w-4 h-4 mr-2" />
						{generating ? "Generating..." : "Generate"}
					</Button>
				</div>
			</div>

			{selectedConnection && (
				<div className="flex flex-wrap gap-4">
					<div className="w-[200px]">
						<Select
							value={filterStatus ?? "ALL"}
							onValueChange={(value) =>
								setFilterStatus(value === "ALL" ? null : value)
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Filter by status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ALL">All Statuses</SelectItem>
								<SelectItem value="NEW">New</SelectItem>
								<SelectItem value="REVIEWED">Reviewed</SelectItem>
								<SelectItem value="APPLIED">Applied</SelectItem>
								<SelectItem value="DISMISSED">Dismissed</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="w-[200px]">
						<Select
							value={filterPriority ?? "ALL"}
							onValueChange={(value) =>
								setFilterPriority(value === "ALL" ? null : value)
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Filter by priority" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ALL">All Priorities</SelectItem>
								<SelectItem value="HIGH">High</SelectItem>
								<SelectItem value="MEDIUM">Medium</SelectItem>
								<SelectItem value="LOW">Low</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			)}

			{loading && (
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
				</div>
			)}

			<div className="grid gap-6">
				{suggestions.map((suggestion) => (
					<Card key={suggestion.id}>
						<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
							<div className="flex items-center gap-2">
								<Badge variant={getPriorityVariant(suggestion.priority) as any}>
									{suggestion.priority}
								</Badge>
								<Badge variant={getStatusVariant(suggestion.status) as any}>
									{suggestion.status}
								</Badge>
								<Badge variant="outline">{suggestion.suggestionType}</Badge>
							</div>
							<div className="flex gap-2">
								{suggestion.status === "NEW" && (
									<>
										<Button
											size="icon"
											variant="ghost"
											className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
											onClick={() =>
												handleUpdateStatus(suggestion.id, "APPLIED")
											}
											title="Mark as Applied"
										>
											<IconCheck className="h-4 w-4" />
										</Button>
										<Button
											size="icon"
											variant="ghost"
											className="h-8 w-8 text-muted-foreground hover:text-foreground"
											onClick={() =>
												handleUpdateStatus(suggestion.id, "DISMISSED")
											}
											title="Dismiss"
										>
											<IconX className="h-4 w-4" />
										</Button>
									</>
								)}
							</div>
						</CardHeader>
						<CardContent>
							<p className="text-sm whitespace-pre-wrap mb-4">
								{suggestion.suggestionText}
							</p>
							{suggestion.queryExecution && (
								<div className="bg-muted/50 rounded-lg p-3 border">
									<p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
										Related Query
									</p>
									<pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto">
										{suggestion.queryExecution.queryText.substring(0, 200)}
										{suggestion.queryExecution.queryText.length > 200
											? "..."
											: ""}
									</pre>
								</div>
							)}
							<p className="text-xs text-muted-foreground mt-4">
								Created: {new Date(suggestion.createdAt).toLocaleString()}
							</p>
						</CardContent>
					</Card>
				))}
			</div>

			{!loading && suggestions.length === 0 && (
				<div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50 min-h-[400px]">
					<div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
						<div className="rounded-full bg-muted p-4 mb-4">
							<IconBulb className="h-8 w-8 text-muted-foreground" />
						</div>
						<h3 className="text-lg font-semibold">No Suggestions Found</h3>
						<p className="mb-4 mt-2 text-sm text-muted-foreground">
							{selectedConnection
								? 'Click "Generate" to analyze your database.'
								: "Select a connection above to view optimization suggestions."}
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
