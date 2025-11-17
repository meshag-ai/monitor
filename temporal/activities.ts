import { Context } from "@temporalio/activity";
import type {
	DbConnector,
	IndexUsage,
	QueryStat,
	SchemaInfo,
	TableAccessPattern,
} from "@/lib/db-connectors/base";
import { MySQLConnector } from "../lib/db-connectors/mysql";
import { PostgresConnector } from "../lib/db-connectors/postgres";
import { decryptCredentials } from "../lib/encryption";
import { type PrismaTransactionalClient, prisma } from "../lib/prisma";

function getLogger() {
	return Context.current().log;
}

export async function getConnection(connectionId: string) {
	const log = getLogger();
	log.info("Getting connection", { connectionId });
	try {
		const connection = await prisma.connection.findUnique({
			where: { id: connectionId },
			include: {
				user: true,
			},
		});
		log.info("Successfully got connection", { connectionId });
		return connection;
	} catch (error) {
		log.error("Failed to get connection", {
			connectionId,
			error: String(error),
		});
		throw error;
	}
}

export async function fetchDatabaseStats(
	connectionId: string,
	dbType: string,
	host: string,
	port: number,
	database: string,
	username: string,
	encryptedPassword: string,
	encryptionKeyId: string,
) {
	const log = getLogger();
	log.info("Fetching database stats", { connectionId, dbType, host });
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

		log.info("Successfully fetched database stats", { connectionId });
		return {
			queryStats,
			schema,
			tablePatterns,
			indexUsage,
		};
	} catch (error) {
		await connector.close();
		log.error("Failed to fetch database stats", {
			connectionId,
			error: String(error),
		});
		throw error;
	}
}

export async function saveDatabaseStats(
	connectionId: string,
	stats: {
		queryStats: QueryStat[];
		schema: SchemaInfo;
		tablePatterns: TableAccessPattern[];
		indexUsage: IndexUsage[];
	},
) {
	const log = getLogger();
	log.info("Saving database stats", {
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

		log.info("Successfully saved database stats", { connectionId });
	} catch (error) {
		log.error("Failed to save database stats", {
			connectionId,
			error: String(error),
		});
		throw error;
	}
}

export async function updateConnectionStatus(
	connectionId: string,
	status: "ACTIVE" | "ERROR" | "INACTIVE" | "TESTING",
) {
	const log = getLogger();
	log.info("Updating connection status", { connectionId, status });
	try {
		await prisma.connection.update({
			where: { id: connectionId },
			data: { status },
		});
		log.info("Successfully updated connection status", {
			connectionId,
			status,
		});
	} catch (error) {
		log.error("Failed to update connection status", {
			connectionId,
			status,
			error: String(error),
		});
		throw error;
	}
}

export async function fetchSlowQueries(connectionId: string) {
	const log = getLogger();
	log.info("Fetching slow queries", { connectionId });
	try {
		const queries = await prisma.query.findMany({
			where: {
				connectionId,
				stats: {
					some: {
						totalExecutionTimeMs: { gt: 1000 }, // This logic might need refinement
					},
				},
			},
			orderBy: {
				stats: {
					_count: "desc", // Placeholder for a better metric
				},
			},
			include: {
				stats: true,
			},
			take: 10,
		});
		log.info("Successfully fetched slow queries", {
			connectionId,
			count: queries.length,
		});
		return queries;
	} catch (error) {
		log.error("Failed to fetch slow queries", {
			connectionId,
			error: String(error),
		});
		throw error;
	}
}

export async function fetchIndexUsage(connectionId: string) {
	const log = getLogger();
	log.info("Fetching index usage", { connectionId });
	try {
		const usage = await prisma.indexUsage.findMany({
			where: { connectionId },
			orderBy: { scans: "desc" },
			take: 10,
		});
		log.info("Successfully fetched index usage", {
			connectionId,
			count: usage.length,
		});
		return usage;
	} catch (error) {
		log.error("Failed to fetch index usage", {
			connectionId,
			error: String(error),
		});
		throw error;
	}
}

export async function fetchTablePatterns(connectionId: string) {
	const log = getLogger();
	log.info("Fetching table patterns", { connectionId });
	try {
		const patterns = await prisma.tableAccessPattern.findMany({
			where: { connectionId },
			orderBy: { accessCount: "desc" },
			take: 10,
		});
		log.info("Successfully fetched table patterns", {
			connectionId,
			count: patterns.length,
		});
		return patterns;
	} catch (error) {
		log.error("Failed to fetch table patterns", {
			connectionId,
			error: String(error),
		});
		throw error;
	}
}

export async function generateLLMSuggestions(context: any) {
	const log = getLogger();
	log.info("Generating LLM suggestions");
	const openaiApiKey = process.env.OPENAI_API_KEY;
	if (!openaiApiKey) {
		log.error("OpenAI API key not configured");
		throw new Error("OpenAI API key not configured");
	}

	const prompt = `Analyze the following database performance metrics and provide optimization suggestions:

Slow Queries:
${context.slowQueries.map((q: any) => `- Query: ${q.query.substring(0, 200)}... Avg Time: ${q.avgTime}ms, Executions: ${q.executionCount}`).join("\n")}

Index Usage:
${context.indexUsage.map((idx: any) => `- Table: ${idx.table}, Index: ${idx.index}, Scans: ${idx.scans}`).join("\n")}

Table Access Patterns:
${context.tablePatterns.map((t: any) => `- Table: ${t.table}, Accesses: ${t.accessCount}`).join("\n")}

Provide specific, actionable optimization suggestions in JSON format:
[
  {
    "suggestionType": "INDEX_OPTIMIZATION" | "QUERY_OPTIMIZATION" | "SCHEMA_OPTIMIZATION" | "CONNECTION_OPTIMIZATION",
    "priority": "HIGH" | "MEDIUM" | "LOW",
    "suggestionText": "Detailed suggestion text here",
    "queryId": "optional query ID if related to specific query"
  }
]`;

	try {
		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${openaiApiKey}`,
			},
			body: JSON.stringify({
				model: "gpt-4",
				messages: [
					{
						role: "system",
						content:
							"You are a database performance optimization expert. Provide specific, actionable suggestions based on the provided metrics.",
					},
					{
						role: "user",
						content: prompt,
					},
				],
				temperature: 0.7,
			}),
		});

		if (!response.ok) {
			log.error("OpenAI API error", {
				status: response.status,
				statusText: response.statusText,
			});
			throw new Error(`OpenAI API error: ${response.statusText}`);
		}

		const data = await response.json();
		const content = data.choices[0]?.message?.content || "[]";
		const suggestions = JSON.parse(content);
		log.info("Successfully generated LLM suggestions", {
			count: suggestions.length,
		});
		return suggestions;
	} catch (error) {
		log.error("Failed to generate LLM suggestions", { error: String(error) });
		throw error;
	}
}

export async function saveSuggestions(
	connectionId: string,
	userId: string,
	suggestions: any[],
) {
	const log = getLogger();
	log.info("Saving suggestions", {
		connectionId,
		userId,
		count: suggestions.length,
	});
	try {
		for (const suggestion of suggestions) {
			await prisma.optimizationSuggestion.create({
				data: {
					connectionId,
					userId,
					queryId: suggestion.queryId || null,
					suggestionText: suggestion.suggestionText,
					suggestionType: suggestion.suggestionType,
					priority: suggestion.priority,
					status: "NEW",
				},
			});
		}
		log.info("Successfully saved suggestions", {
			connectionId,
			userId,
			count: suggestions.length,
		});
	} catch (error) {
		log.error("Failed to save suggestions", {
			connectionId,
			userId,
			error: String(error),
		});
		throw error;
	}
}
