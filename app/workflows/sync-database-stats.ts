import type {
	DbConnector,
	IndexUsage,
	QueryStat,
	SchemaInfo,
	TableAccessPattern,
} from "@/lib/db-connectors/base";
import { MySQLConnector } from "@/lib/db-connectors/mysql";
import { PostgresConnector } from "@/lib/db-connectors/postgres";
import { decryptCredentials } from "@/lib/encryption";
import { type PrismaTransactionalClient, prisma } from "@/lib/prisma";

export async function syncDatabaseStats(connectionId: string) {
	"use workflow";

	try {
		const connection = await getConnection(connectionId);

		if (!connection || connection.status !== "ACTIVE") {
			console.warn("Connection not active, aborting sync", {
				connectionId,
				status: connection?.status,
			});
			return { success: false, error: "Connection not active" };
		}

		console.info("Fetching database stats", { connectionId });
		const stats = await fetchDatabaseStats(
			connection.id,
			connection.dbType,
			connection.host,
			connection.port,
			connection.database,
			connection.username,
			connection.encryptedPassword,
			connection.encryptionKeyId,
		);

		console.info("Saving database stats", { connectionId });
		await saveDatabaseStats(connection.id, stats);

		console.info("Finished syncDatabaseStats workflow successfully", {
			connectionId,
		});
		return { success: true };
	} catch (error) {
		console.error("syncDatabaseStats workflow failed", {
			connectionId,
			error: String(error),
		});
		try {
			await updateConnectionStatus(connectionId, "ERROR");
		} catch (e) {
			console.error("Failed to update connection status to ERROR", {
				connectionId,
				error: String(e),
			});
		}
		return { success: false, error: String(error) };
	}
}

async function getConnection(connectionId: string) {
	"use step";
	console.info("Getting connection", { connectionId });
	try {
		const connection = await prisma.connection.findUnique({
			where: { id: connectionId },
			include: {
				organization: {
					include: {
						users: true,
					},
				},
			},
		});
		console.info("Successfully got connection", { connectionId });
		return connection;
	} catch (error) {
		console.error("Failed to get connection", {
			connectionId,
			error: String(error),
		});
		throw error;
	}
}

async function fetchDatabaseStats(
	connectionId: string,
	dbType: string,
	host: string,
	port: number,
	database: string,
	username: string,
	encryptedPassword: string,
	encryptionKeyId: string,
) {
	"use step";
	console.info("Fetching database stats", { connectionId, dbType, host });
	const password = decryptCredentials(encryptedPassword, encryptionKeyId);

	let connector: DbConnector;
	if (dbType === "POSTGRES") {
		connector = new PostgresConnector({
			host,
			port,
			database,
			username,
			password,
		});
	} else {
		connector = new MySQLConnector({
			host,
			port,
			database,
			username,
			password,
		});
	}

	try {
		const queryStats = await connector.fetchQueryStats();
		const schema = await connector.fetchSchema();
		const tablePatterns = await connector.fetchTableAccessPatterns();
		const indexUsage = await connector.fetchIndexUsage();

		await connector.close();

		console.info("Successfully fetched database stats", { connectionId });
		return {
			queryStats,
			schema,
			tablePatterns,
			indexUsage,
		};
	} catch (error) {
		await connector.close();
		console.error("Failed to fetch database stats", {
			connectionId,
			error: String(error),
		});
		throw error;
	}
}

async function saveDatabaseStats(
	connectionId: string,
	stats: {
		queryStats: QueryStat[];
		schema: SchemaInfo;
		tablePatterns: TableAccessPattern[];
		indexUsage: IndexUsage[];
	},
) {
	"use step";
	console.info("Saving database stats", {
		connectionId,
		queryCount: stats.queryStats.length,
		tableCount: stats.schema.tables.length,
	});
	try {
		await prisma.$transaction(
			async (tx: PrismaTransactionalClient) => {
				// Step 1: Batch insert/update queries using raw SQL for performance
				const now = new Date();
				if (stats.queryStats.length > 0) {
					// Deduplicate by queryHash to avoid ON CONFLICT errors
					const uniqueQueries = Array.from(
						new Map(
							stats.queryStats.map((stat) => [stat.queryHash, stat]),
						).values(),
					);

					if (uniqueQueries.length > 0) {
						// Generate CUIDs for each query (Prisma's default is client-side)
						const { createId } = await import("@paralleldrive/cuid2");
						const queryValues = uniqueQueries
							.map(
								(stat) =>
									`('${createId()}', '${connectionId}', '${stat.queryHash.replace(/'/g, "''")}', '${stat.queryText.replace(/'/g, "''")}', '${now.toISOString()}', '${now.toISOString()}')`,
							)
							.join(",");

						await tx.$executeRawUnsafe(`
							INSERT INTO "Query" ("id", "connectionId", "queryHash", "queryText", "firstSeenAt", "lastSeenAt")
							VALUES ${queryValues}
							ON CONFLICT ("connectionId", "queryHash")
							DO UPDATE SET "lastSeenAt" = EXCLUDED."lastSeenAt"
						`);
					}
				}

				// Step 2: Fetch all query IDs we just created/updated
				const queryHashes = stats.queryStats.map((s) => s.queryHash);
				const queries = await tx.query.findMany({
					where: {
						connectionId,
						queryHash: { in: queryHashes },
					},
					select: { id: true, queryHash: true },
				});

				const queryIdMap = new Map<string, string>();
				for (const q of queries) {
					queryIdMap.set(q.queryHash, q.id);
				}

				// Step 3: Batch-create query stats
				const queryStatsToCreate = stats.queryStats.map((stat) => ({
					queryId: queryIdMap.get(stat.queryHash)!,
					executionCount: BigInt(stat.executionCount),
					totalExecutionTimeMs: stat.totalExecutionTimeMs,
					capturedAt: now,
				}));

				if (queryStatsToCreate.length > 0) {
					await tx.queryStats.createMany({
						data: queryStatsToCreate,
					});
				}

				// Step 4: Create schema snapshot and batch-create its tables and columns
				const snapshot = await tx.schemaSnapshot.create({
					data: { connectionId },
				});

				for (const table of stats.schema.tables) {
					const createdTable = await tx.schemaTable.create({
						data: {
							snapshotId: snapshot.id,
							tableName: table.name,
						},
					});

					if (table.columns && table.columns.length > 0) {
						const columnsToCreate = table.columns.map((col: any) => ({
							tableId: createdTable.id,
							columnName: col.name,
							dataType: col.type,
							isNullable: col.nullable,
						}));
						await tx.schemaColumn.createMany({ data: columnsToCreate });
					}
				}

				// Step 5: Batch-upsert table access patterns using raw SQL
				if (stats.tablePatterns.length > 0) {
					// Deduplicate by tableName to avoid ON CONFLICT errors
					const uniquePatterns = Array.from(
						new Map(stats.tablePatterns.map((p) => [p.tableName, p])).values(),
					);

					if (uniquePatterns.length > 0) {
						const { createId } = await import("@paralleldrive/cuid2");
						const patternValues = uniquePatterns
							.map(
								(p) =>
									`('${createId()}', '${connectionId}', '${p.tableName.replace(/'/g, "''")}', ${p.accessCount}, ${p.lastAccessedAt ? `'${p.lastAccessedAt.toISOString()}'` : "NULL"})`,
							)
							.join(",");

						await tx.$executeRawUnsafe(`
							INSERT INTO "TableAccessPattern" ("id", "connectionId", "tableName", "accessCount", "lastAccessedAt")
							VALUES ${patternValues}
							ON CONFLICT ("connectionId", "tableName")
							DO UPDATE SET 
								"accessCount" = EXCLUDED."accessCount",
								"lastAccessedAt" = EXCLUDED."lastAccessedAt"
						`);
					}
				}

				// Step 6: Batch-upsert index usage using raw SQL
				if (stats.indexUsage.length > 0) {
					// Deduplicate by tableName+indexName to avoid ON CONFLICT errors
					const uniqueIndexUsage = Array.from(
						new Map(
							stats.indexUsage.map((idx) => [
								`${idx.tableName}:${idx.indexName}`,
								idx,
							]),
						).values(),
					);

					if (uniqueIndexUsage.length > 0) {
						const { createId } = await import("@paralleldrive/cuid2");
						const indexValues = uniqueIndexUsage
							.map(
								(idx) =>
									`('${createId()}', '${connectionId}', '${idx.tableName.replace(/'/g, "''")}', '${idx.indexName.replace(/'/g, "''")}', ${idx.scans}, ${idx.tuplesRead}, ${idx.tuplesFetched}, '${now.toISOString()}', '${now.toISOString()}')`,
							)
							.join(",");

						await tx.$executeRawUnsafe(`
							INSERT INTO "IndexUsage" ("id", "connectionId", "tableName", "indexName", "scans", "tuplesRead", "tuplesFetched", "createdAt", "updatedAt")
							VALUES ${indexValues}
							ON CONFLICT ("connectionId", "tableName", "indexName")
							DO UPDATE SET 
								"scans" = EXCLUDED."scans",
								"tuplesRead" = EXCLUDED."tuplesRead",
								"tuplesFetched" = EXCLUDED."tuplesFetched",
								"updatedAt" = EXCLUDED."updatedAt"
						`);
					}
				}

				// Step 7: Update connection status
				await tx.connection.update({
					where: { id: connectionId },
					data: { lastSyncedAt: new Date(), status: "ACTIVE" },
				});
			},
			{ timeout: 30000 },
		);

		console.info("Successfully saved database stats", { connectionId });
	} catch (error) {
		console.error("Failed to save database stats", {
			connectionId,
			error: String(error),
		});
		throw error;
	}
}

async function updateConnectionStatus(
	connectionId: string,
	status: "ACTIVE" | "ERROR" | "INACTIVE" | "TESTING",
) {
	"use step";
	console.info("Updating connection status", { connectionId, status });
	try {
		await prisma.connection.update({
			where: { id: connectionId },
			data: { status },
		});
		console.info("Successfully updated connection status", {
			connectionId,
			status,
		});
	} catch (error) {
		console.error("Failed to update connection status", {
			connectionId,
			status,
			error: String(error),
		});
		throw error;
	}
}
