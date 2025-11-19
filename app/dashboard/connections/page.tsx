"use client";

import { useOrganization } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { z } from "zod";

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
		try {
			const response = await fetch("/api/connections");
			if (response.ok) {
				const data = await response.json();
				setConnections(data);
			}
		} catch (error) {
			console.error("Failed to fetch connections", error);
			// You can replace this with a toast notification library compatible with Tailwind
			toast.error("Failed to fetch connections");
		}
	}, []);

	useEffect(() => {
		if (organization) {
			fetchConnections();
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
				// Start initial sync
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

	const getStatusColor = (status: string) => {
		switch (status) {
			case "ACTIVE":
				return "bg-green-500";
			case "ERROR":
				return "bg-red-500";
			case "TESTING":
				return "bg-yellow-500";
			default:
				return "bg-gray-500";
		}
	};

	return (
		<div className="container mx-auto p-8">
			<div className="flex justify-between items-center mb-8">
				<h1 className="text-3xl font-bold">Connections</h1>
				<button
					type="button"
					onClick={() => setOpened(true)}
					className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center hover:cursor-pointer"
				>
					<IconPlus className="w-4 h-4 mr-2" />
					Add Connection
				</button>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
				{connections.map((conn) => (
					<div
						key={conn.id}
						className="bg-white rounded-lg shadow-md p-6 border border-gray-100"
					>
						<div className="flex justify-between items-center mb-2">
							<h2 className="text-xl font-semibold text-gray-800">
								{conn.name}
							</h2>
							<span
								className={`px-2 py-1 text-xs font-semibold text-white rounded-full ${getStatusColor(
									conn.status,
								)}`}
							>
								{conn.status}
							</span>
						</div>
						<p className="text-sm text-gray-600 mb-1">
							{conn.dbType} - {conn.host}:{conn.port}
						</p>
						<p className="text-sm text-gray-600 mb-4">
							Database: {conn.database}
						</p>
						{conn.lastSyncedAt && (
							<p className="text-xs text-gray-500 mb-4">
								Last synced: {new Date(conn.lastSyncedAt).toLocaleString()}
							</p>
						)}
						<div className="flex justify-end space-x-2">
							<button
								type="button"
								onClick={() => handleSync(conn.id)}
								className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
							>
								<IconRefresh className="w-4 h-4" />
							</button>
							<button
								type="button"
								onClick={() => handleDelete(conn.id)}
								className="p-2 rounded-full hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors cursor-pointer"
							>
								<IconTrash className="w-4 h-4" />
							</button>
						</div>
					</div>
				))}
			</div>

			{connections.length === 0 && (
				<div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500 border border-gray-100">
					No connections yet. Click "Add Connection" to get started.
				</div>
			)}

			{opened && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/30">
					<div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-8 relative animate-in fade-in zoom-in duration-200">
						<div className="flex justify-between items-center mb-6 border-b pb-4">
							<h2 className="text-2xl font-bold text-gray-900">
								{step === 0 ? "Setup Instructions" : "Connection Details"}
							</h2>
							<span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
								Step {step + 1} / 2
							</span>
						</div>
						{step === 0 && (
							<div className="space-y-6">
								<div className="bg-blue-50 border border-blue-100 rounded-lg p-5">
									<h3 className="font-semibold text-blue-900 mb-3 text-lg">
										PostgreSQL Setup
									</h3>
									<div className="space-y-4 text-gray-700">
										<p className="text-sm">
											Follow these steps to configure your PostgreSQL database
											for monitoring:
										</p>
										<ol className="list-decimal list-inside space-y-3 text-sm marker:font-bold marker:text-blue-600">
											<li>
												<strong className="text-gray-900">
													Enable pg_stat_statements extension
												</strong>
												<p className="text-gray-600 mt-1 ml-4">
													This extension tracks execution statistics of all SQL
													statements.
												</p>
												<pre className="bg-gray-900 text-gray-100 p-3 rounded-md text-xs mt-2 overflow-x-auto font-mono">
													CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
												</pre>
											</li>
											<li>
												<strong className="text-gray-900">
													Create a read-only user
												</strong>
												<p className="text-gray-600 mt-1 ml-4">
													This user needs specific grants to read performance
													data.
												</p>
												<pre className="bg-gray-900 text-gray-100 p-3 rounded-md text-xs mt-2 overflow-x-auto font-mono leading-relaxed">
													{`CREATE USER monitoring_user WITH PASSWORD 'your_secure_password';
GRANT CONNECT ON DATABASE your_db TO monitoring_user;
GRANT USAGE ON SCHEMA public TO monitoring_user;
GRANT SELECT ON pg_stat_statements TO monitoring_user;`}
												</pre>
											</li>
											<li>
												<strong className="text-gray-900">
													Whitelist our IP addresses
												</strong>
												<p className="text-gray-600 mt-1 ml-4">
													Ensure your firewall and `pg_hba.conf` file allow
													connections from our servers.
												</p>
											</li>
										</ol>
									</div>
								</div>
								<div className="flex justify-end pt-2">
									<button
										type="button"
										onClick={() => setStep(1)}
										className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm cursor-pointer"
									>
										Next Step
									</button>
								</div>
							</div>
						)}
						{step === 1 && (
							<form
								onSubmit={handleHookFormSubmit(onSubmit)}
								className="space-y-6"
							>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
									<div className="col-span-full md:col-span-1">
										<label
											htmlFor="name"
											className="block text-sm font-medium text-gray-700 mb-1"
										>
											Connection Name
										</label>
										<input
											type="text"
											placeholder="My Production DB"
											{...register("name")}
											className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
										/>
										{errors.name && (
											<p className="text-red-600 text-xs mt-1">
												{errors.name.message}
											</p>
										)}
									</div>
									<div className="col-span-full md:col-span-1">
										<label
											htmlFor="dbType"
											className="block text-sm font-medium text-gray-700 mb-1"
										>
											Database Type
										</label>
										<select
											{...register("dbType")}
											className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
										>
											<option value="POSTGRES">PostgreSQL</option>
											<option value="MYSQL" disabled>
												MySQL (Coming Soon)
											</option>
										</select>
										{errors.dbType && (
											<p className="text-red-600 text-xs mt-1">
												{errors.dbType.message}
											</p>
										)}
									</div>
									<div className="col-span-full md:col-span-2">
										<label
											htmlFor="host"
											className="block text-sm font-medium text-gray-700 mb-1"
										>
											Host
										</label>
										<input
											type="text"
											placeholder="db.example.com"
											{...register("host")}
											className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
										/>
										{errors.host && (
											<p className="text-red-600 text-xs mt-1">
												{errors.host.message}
											</p>
										)}
									</div>
									<div>
										<label
											htmlFor="port"
											className="block text-sm font-medium text-gray-700 mb-1"
										>
											Port
										</label>
										<input
											type="number"
											placeholder="5432"
											{...register("port", { valueAsNumber: true })}
											className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
										/>
										{errors.port && (
											<p className="text-red-600 text-xs mt-1">
												{errors.port.message}
											</p>
										)}
									</div>
									<div>
										<label
											htmlFor="database"
											className="block text-sm font-medium text-gray-700 mb-1"
										>
											Database Name
										</label>
										<input
											type="text"
											placeholder="postgres"
											{...register("database")}
											className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
										/>
										{errors.database && (
											<p className="text-red-600 text-xs mt-1">
												{errors.database.message}
											</p>
										)}
									</div>
									<div>
										<label
											htmlFor="username"
											className="block text-sm font-medium text-gray-700 mb-1"
										>
											Username
										</label>
										<input
											type="text"
											placeholder="monitoring_user"
											{...register("username")}
											className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
										/>
										{errors.username && (
											<p className="text-red-600 text-xs mt-1">
												{errors.username.message}
											</p>
										)}
									</div>
									<div>
										<label
											htmlFor="password"
											className="block text-sm font-medium text-gray-700 mb-1"
										>
											Password
										</label>
										<input
											type="password"
											placeholder="••••••••"
											{...register("password")}
											className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
										/>
										{errors.password && (
											<p className="text-red-600 text-xs mt-1">
												{errors.password.message}
											</p>
										)}
									</div>
									<div className="col-span-full">
										<label
											htmlFor="pollingIntervalMinutes"
											className="block text-sm font-medium text-gray-700 mb-1"
										>
											Polling Interval (minutes)
										</label>
										<input
											type="number"
											disabled
											{...register("pollingIntervalMinutes", {
												valueAsNumber: true,
											})}
											className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
										/>
										<p className="text-xs text-gray-500 mt-1">
											Fixed at 1440 minutes (24 hours) for the free tier.
										</p>
									</div>
								</div>
								<div className="flex justify-end pt-4 space-x-3 border-t mt-6">
									<button
										type="button"
										onClick={() => setStep(0)}
										className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors cursor-pointer"
									>
										Back
									</button>
									<button
										type="button"
										onClick={handleTest}
										disabled={testing}
										className="px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
									>
										{testing ? "Testing..." : "Test Connection"}
									</button>
									<button
										type="submit"
										disabled={loading}
										className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
									>
										{loading ? "Creating..." : "Create Connection"}
									</button>
								</div>
							</form>
						)}
						<button
							type="button"
							onClick={() => {
								setOpened(false);
								reset();
								setStep(0);
							}}
							className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<title>Close</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
