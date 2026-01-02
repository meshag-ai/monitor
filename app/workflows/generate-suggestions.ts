import { prisma } from "@/lib/prisma";

export async function generateSuggestions(connectionId: string) {
	"use workflow";
	console.info("Starting generateSuggestions workflow", { connectionId });
	try {
		const connection = await getConnection(connectionId);

		if (!connection) {
			console.warn("Connection not found, aborting suggestion generation", {
				connectionId,
			});
			return { success: false, error: "Connection not found" };
		}

		console.info("Fetching data for suggestions", { connectionId });
		const [slowQueries, indexUsage, tablePatterns] = await Promise.all([
			fetchSlowQueries(connectionId),
			fetchIndexUsage(connectionId),
			fetchTablePatterns(connectionId),
		]);

		if (slowQueries.length === 0) {
			console.info("No slow queries found, skipping suggestion generation", {
				connectionId,
			});
			return { success: true, suggestions: 0 };
		}

		const context = {
			slowQueries: slowQueries.map((q: any) => ({
				query: q.queryText,
				avgTime: q.avgExecutionTimeMs,
				executionCount: Number(q.executionCount),
			})),
			indexUsage: indexUsage.map((idx: any) => ({
				table: idx.tableName,
				index: idx.indexName,
				scans: Number(idx.scans),
			})),
			tablePatterns: tablePatterns.map((t: any) => ({
				table: t.tableName,
				accessCount: Number(t.accessCount),
			})),
		};

		console.info("Generating LLM suggestions", { connectionId });
		const suggestions = await generateLLMSuggestions(context);

		console.info("Saving suggestions", {
			connectionId,
			count: suggestions.length,
		});

		await saveSuggestions(
			connection.id,
			connection.organizationId,
			suggestions,
		);

		console.info("Finished generateSuggestions workflow successfully", {
			connectionId,
		});
		return { success: true, suggestions: suggestions.length };
	} catch (error) {
		console.error("generateSuggestions workflow failed", {
			connectionId,
			error: String(error),
		});
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

async function fetchSlowQueries(connectionId: string) {
	"use step";
	console.info("Fetching slow queries", { connectionId });
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
		console.info("Successfully fetched slow queries", {
			connectionId,
			count: queries.length,
		});
		return queries;
	} catch (error) {
		console.error("Failed to fetch slow queries", {
			connectionId,
			error: String(error),
		});
		throw error;
	}
}

async function fetchIndexUsage(connectionId: string) {
	"use step";
	console.info("Fetching index usage", { connectionId });
	try {
		const usage = await prisma.indexUsage.findMany({
			where: { connectionId },
			orderBy: { scans: "desc" },
			take: 10,
		});
		console.info("Successfully fetched index usage", {
			connectionId,
			count: usage.length,
		});
		return usage;
	} catch (error) {
		console.error("Failed to fetch index usage", {
			connectionId,
			error: String(error),
		});
		throw error;
	}
}

async function fetchTablePatterns(connectionId: string) {
	"use step";
	console.info("Fetching table patterns", { connectionId });
	try {
		const patterns = await prisma.tableAccessPattern.findMany({
			where: { connectionId },
			orderBy: { accessCount: "desc" },
			take: 10,
		});
		console.info("Successfully fetched table patterns", {
			connectionId,
			count: patterns.length,
		});
		return patterns;
	} catch (error) {
		console.error("Failed to fetch table patterns", {
			connectionId,
			error: String(error),
		});
		throw error;
	}
}

async function generateLLMSuggestions(context: any) {
	"use step";
	console.info("Generating LLM suggestions");
	const openaiApiKey = process.env.OPENAI_API_KEY;
	if (!openaiApiKey) {
		console.error("OpenAI API key not configured");
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
			console.error("OpenAI API error", {
				status: response.status,
				statusText: response.statusText,
			});
			throw new Error(`OpenAI API error: ${response.statusText}`);
		}

		const data = await response.json();
		const content = data.choices[0]?.message?.content || "[]";
		const suggestions = JSON.parse(content);
		console.info("Successfully generated LLM suggestions", {
			count: suggestions.length,
		});
		return suggestions;
	} catch (error) {
		console.error("Failed to generate LLM suggestions", {
			error: String(error),
		});
		throw error;
	}
}

async function saveSuggestions(
	connectionId: string,
	userId: string,
	suggestions: any[],
) {
	"use step";
	console.info("Saving suggestions", {
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
		console.info("Successfully saved suggestions", {
			connectionId,
			userId,
			count: suggestions.length,
		});
	} catch (error) {
		console.error("Failed to save suggestions", {
			connectionId,
			userId,
			error: String(error),
		});
		throw error;
	}
}
