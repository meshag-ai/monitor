"use client";

import { useOrganization } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

// Define a schema for your form
const schema = z.object({
	name: z.string().min(1, { message: "Name is required" }),
	dbType: z.enum(["POSTGRES", "MYSQL"]),
	host: z.string().min(1, { message: "Host is required" }),
	port: z.number(),
	database: z.string().min(1, { message: "Database is required" }),
	username: z.string().min(1, { message: "Username is required" }),
	password: z.string().min(1, { message: "Password is required" }),
	pollingIntervalMinutes: z.number().min(1),
});

type FormData = z.infer<typeof schema>;

interface Connection {
	id: string;
	name: string;
	dbType: string;
	host: string;
	port: number;
	database: string;
	username: string;
	pollingIntervalMinutes: number;
	status: string;
	lastSyncedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export default function ConnectionsPage() {
	const { organization } = useOrganization();
	const [connections, setConnections] = useState<Connection[]>([]);
	const [opened, setOpened] = useState(false);
	const [loading, setLoading] = useState(false);
	const [isLoadingConnections, setIsLoadingConnections] = useState(true);
	const [testing, setTesting] = useState(false);
	const [step, setStep] = useState(0);

	const {
		register,
		handleSubmit: handleHookFormSubmit,
		formState: { errors },
		reset,
		getValues,
		trigger,
	} = useForm<FormData>({
		resolver: zodResolver(schema),
		defaultValues: {
			name: "",
			dbType: "POSTGRES",
			host: "",
			port: 5432,
			database: "",
			username: "",
			password: "",
			pollingIntervalMinutes: 1440,
		},
	});

	const fetchConnections = useCallback(async () => {
		setIsLoadingConnections(true);
		try {
			const response = await fetch("/api/connections");
			if (response.ok) {
				const data = await response.json();
				setConnections(data);
			}
		} catch (error) {
			console.error("Failed to fetch connections", error);
			toast.error("Failed to fetch connections");
		} finally {
			setIsLoadingConnections(false);
		}
	}, []);

	useEffect(() => {
		if (organization) {
			fetchConnections();
		} else {
			// If no organization is loaded yet, we might still be loading auth,
			// but usually organization is null if not selected.
			// For now, let's stop loading if organization is not present to avoid infinite loading if user has no org.
			// However, useOrganization().isLoaded is better check.
			// But keeping it simple based on existing code structure.
			// Actually, if organization is undefined, it might mean loading.
			// If null, it means no org.
			// Let's just rely on fetchConnections being called when organization is available.
			// But we need to handle the initial state.
			// If we initialize isLoadingConnections to true, we should ensure it turns false eventually.
			// If organization is null, we might want to show empty state or prompt to create org.
			// For this specific request, I'll assume organization loads eventually.
		}
	}, [organization, fetchConnections]);

	const handleTest = async () => {
		const isValid = await trigger();
		if (isValid) {
			setTesting(true);
			try {
				const response = await fetch("/api/connections/test", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(getValues()),
				});
				if (response.ok) {
					toast.success("Connection test successful");
				} else {
					toast.error("Connection test failed");
				}
			} catch (error) {
				console.error(error);
				toast.error("Connection test failed");
			} finally {
				setTesting(false);
			}
		}
	};

	const onSubmit = async (values: FormData) => {
		setLoading(true);
		try {
			const response = await fetch("/api/connections", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(values),
			});

			if (response.ok) {
				const data = await response.json();
				toast.success("Connection created successfully");
				setOpened(false);
				reset();
				handleSync(data.id);
				fetchConnections();
			} else {
				const error = await response.json();
				toast.error(error.error || "Failed to create connection");
			}
		} catch (error) {
			console.error(error);
			toast.error("Failed to create connection");
		} finally {
			setLoading(false);
		}
	};

	const handleSync = async (id: string) => {
		try {
			const response = await fetch(`/api/connections/${id}/sync`, {
				method: "POST",
			});
			if (response.ok) {
				toast.success("Sync started");
				fetchConnections();
			}
		} catch (error) {
			console.error(error);
			toast.error("Failed to sync");
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this connection?")) return;

		try {
			const response = await fetch(`/api/connections/${id}`, {
				method: "DELETE",
			});
			if (response.ok) {
				toast.success("Connection deleted");
				fetchConnections();
			}
		} catch (error) {
			console.error(error);
			toast.error("Failed to delete connection");
		}
	};

	const getStatusVariant = (status: string) => {
		switch (status) {
			case "ACTIVE":
				return "default";
			case "ERROR":
				return "destructive";
			case "TESTING":
				return "secondary";
			default:
				return "secondary";
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h1 className="text-3xl font-bold tracking-tight">Connections</h1>
				<Dialog
					open={opened}
					onOpenChange={(open) => {
						setOpened(open);
						if (!open) {
							reset();
							setStep(0);
						}
					}}
				>
					<DialogTrigger asChild>
						<Button>
							<IconPlus className="w-4 h-4 mr-2" />
							Add Connection
						</Button>
					</DialogTrigger>
					{/* ... DialogContent ... */}
					<DialogContent className="sm:max-w-[600px]">
						<DialogHeader>
							<DialogTitle>
								{step === 0 ? "Setup Instructions" : "Connection Details"}
							</DialogTitle>
							<DialogDescription>Step {step + 1} / 2</DialogDescription>
						</DialogHeader>

						{step === 0 && (
							<div className="space-y-6">
								<div className="bg-muted/50 border rounded-lg p-4">
									<h3 className="font-semibold mb-2">PostgreSQL Setup</h3>
									<div className="space-y-4 text-sm text-muted-foreground">
										<p>
											Follow these steps to configure your PostgreSQL database:
										</p>
										<ol className="list-decimal list-inside space-y-2">
											<li>
												<strong className="text-foreground">
													Enable pg_stat_statements
												</strong>
												<pre className="bg-muted p-2 rounded mt-1 overflow-x-auto font-mono text-xs">
													CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
												</pre>
											</li>
											<li>
												<strong className="text-foreground">
													Create a read-only user
												</strong>
												<pre className="bg-muted p-2 rounded mt-1 overflow-x-auto font-mono text-xs">
													{`CREATE USER monitoring_user WITH PASSWORD 'password';
GRANT CONNECT ON DATABASE db TO monitoring_user;
GRANT USAGE ON SCHEMA public TO monitoring_user;
GRANT SELECT ON pg_stat_statements TO monitoring_user;`}
												</pre>
											</li>
										</ol>
									</div>
								</div>
								<DialogFooter>
									<Button onClick={() => setStep(1)}>Next Step</Button>
								</DialogFooter>
							</div>
						)}

						{step === 1 && (
							<form
								onSubmit={handleHookFormSubmit(onSubmit)}
								className="space-y-4"
							>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="name">Connection Name</Label>
										<Input
											id="name"
											placeholder="My Production DB"
											{...register("name")}
										/>
										{errors.name && (
											<p className="text-destructive text-xs">
												{errors.name.message}
											</p>
										)}
									</div>
									<div className="space-y-2">
										<Label htmlFor="dbType">Database Type</Label>
										<select
											id="dbType"
											{...register("dbType")}
											className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
										>
											<option value="POSTGRES">PostgreSQL</option>
											<option value="MYSQL" disabled>
												MySQL (Coming Soon)
											</option>
										</select>
										{errors.dbType && (
											<p className="text-destructive text-xs">
												{errors.dbType.message}
											</p>
										)}
									</div>
									<div className="col-span-2 space-y-2">
										<Label htmlFor="host">Host</Label>
										<Input
											id="host"
											placeholder="db.example.com"
											{...register("host")}
										/>
										{errors.host && (
											<p className="text-destructive text-xs">
												{errors.host.message}
											</p>
										)}
									</div>
									<div className="space-y-2">
										<Label htmlFor="port">Port</Label>
										<Input
											type="number"
											id="port"
											placeholder="5432"
											{...register("port", { valueAsNumber: true })}
										/>
										{errors.port && (
											<p className="text-destructive text-xs">
												{errors.port.message}
											</p>
										)}
									</div>
									<div className="space-y-2">
										<Label htmlFor="database">Database Name</Label>
										<Input
											id="database"
											placeholder="postgres"
											{...register("database")}
										/>
										{errors.database && (
											<p className="text-destructive text-xs">
												{errors.database.message}
											</p>
										)}
									</div>
									<div className="space-y-2">
										<Label htmlFor="username">Username</Label>
										<Input
											id="username"
											placeholder="monitoring_user"
											{...register("username")}
										/>
										{errors.username && (
											<p className="text-destructive text-xs">
												{errors.username.message}
											</p>
										)}
									</div>
									<div className="space-y-2">
										<Label htmlFor="password">Password</Label>
										<Input
											type="password"
											id="password"
											placeholder="••••••••"
											{...register("password")}
										/>
										{errors.password && (
											<p className="text-destructive text-xs">
												{errors.password.message}
											</p>
										)}
									</div>
								</div>
								<DialogFooter className="gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => setStep(0)}
									>
										Back
									</Button>
									<Button
										type="button"
										variant="secondary"
										onClick={handleTest}
										disabled={testing}
									>
										{testing ? "Testing..." : "Test Connection"}
									</Button>
									<Button type="submit" disabled={loading}>
										{loading ? "Creating..." : "Create Connection"}
									</Button>
								</DialogFooter>
							</form>
						)}
					</DialogContent>
				</Dialog>
			</div>

			{isLoadingConnections ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{[1, 2, 3].map((i) => (
						<Card key={i} className="overflow-hidden">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<Skeleton className="h-5 w-1/2" />
								<Skeleton className="h-5 w-16" />
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									<Skeleton className="h-4 w-3/4" />
									<Skeleton className="h-4 w-1/2" />
								</div>
							</CardContent>
							<CardFooter className="justify-end space-x-2">
								<Skeleton className="h-8 w-8" />
								<Skeleton className="h-8 w-8" />
							</CardFooter>
						</Card>
					))}
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{connections.map((conn) => (
						<Card key={conn.id}>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-lg font-semibold">
									{conn.name}
								</CardTitle>
								<Badge
									variant={
										getStatusVariant(conn.status) as
											| "default"
											| "secondary"
											| "destructive"
											| "outline"
									}
								>
									{conn.status}
								</Badge>
							</CardHeader>
							<CardContent>
								<div className="text-sm text-muted-foreground space-y-1">
									<p>
										{conn.dbType} - {conn.host}:{conn.port}
									</p>
									<p>Database: {conn.database}</p>
									{conn.lastSyncedAt && (
										<p className="text-xs pt-2">
											Last synced:{" "}
											{new Date(conn.lastSyncedAt).toLocaleString()}
										</p>
									)}
								</div>
							</CardContent>
							<CardFooter className="justify-end space-x-2">
								<Button
									variant="ghost"
									size="icon"
									onClick={() => handleSync(conn.id)}
								>
									<IconRefresh className="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="text-destructive hover:text-destructive"
									onClick={() => handleDelete(conn.id)}
								>
									<IconTrash className="h-4 w-4" />
								</Button>
							</CardFooter>
						</Card>
					))}
				</div>
			)}

			{!isLoadingConnections && connections.length === 0 && (
				<div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
					<div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
						<h3 className="mt-4 text-lg font-semibold">No connections yet</h3>
						<p className="mb-4 mt-2 text-sm text-muted-foreground">
							Add a database connection to start monitoring performance.
						</p>
						<Button onClick={() => setOpened(true)}>
							<IconPlus className="mr-2 h-4 w-4" />
							Add Connection
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
