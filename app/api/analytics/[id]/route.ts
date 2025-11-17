import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function GET(
	req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { userId } = await auth();

	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const { id: connectionId } = await params;
		const connection = await prisma.connection.findFirst({
			where: { id: connectionId, userId },
		});

		if (!connection) {
			return NextResponse.json(
				{ error: "Connection not found" },
				{ status: 404 },
			);
		}

		// Use raw SQL queries for efficient aggregations at the database level
		const [
			totalQueriesResult,
			avgExecutionTimeResult,
			slowQueriesResult,
			mostFrequentResult,
			slowestResult,
			tablePatternsResult,
			indexUsageResult,
		] = await Promise.all([
			// Total execution count across all queries
			prisma.$queryRaw<[{ total: number }]>`
				SELECT COALESCE(SUM("executionCount"), 0)::int as total
				FROM "QueryStats" qs
				INNER JOIN "Query" q ON q.id = qs."queryId"
				WHERE q."connectionId" = ${connectionId}
			`,
			// Average execution time
			prisma.$queryRaw<[{ avg: number }]>`
				SELECT COALESCE(AVG("totalExecutionTimeMs"), 0)::float as avg
				FROM "QueryStats" qs
				INNER JOIN "Query" q ON q.id = qs."queryId"
				WHERE q."connectionId" = ${connectionId}
			`,
			// Count of slow queries (avg > 1000ms)
			prisma.$queryRaw<[{ count: number }]>`
				SELECT COUNT(DISTINCT q.id)::int as count
				FROM "Query" q
				INNER JOIN "QueryStats" qs ON qs."queryId" = q.id
				WHERE q."connectionId" = ${connectionId}
				GROUP BY q.id
				HAVING AVG(qs."totalExecutionTimeMs") > 1000
			`,
			// Most frequent queries (top 10 by execution count)
			prisma.$queryRaw<
				Array<{
					id: string;
					queryText: string;
					executionCount: number;
					avgExecutionTimeMs: number;
				}>
			>`
				SELECT 
					q.id,
					q."queryText",
					SUM(qs."executionCount")::int as "executionCount",
					(SUM(qs."totalExecutionTimeMs") / SUM(qs."executionCount"))::float as "avgExecutionTimeMs"
				FROM "Query" q
				INNER JOIN "QueryStats" qs ON qs."queryId" = q.id
				WHERE q."connectionId" = ${connectionId}
				GROUP BY q.id, q."queryText"
				ORDER BY SUM(qs."executionCount") DESC
				LIMIT 10
			`,
			// Slowest queries (top 10 by avg execution time)
			prisma.$queryRaw<
				Array<{
					id: string;
					queryText: string;
					executionCount: number;
					avgExecutionTimeMs: number;
				}>
			>`
				SELECT 
					q.id,
					q."queryText",
					SUM(qs."executionCount")::int as "executionCount",
					(SUM(qs."totalExecutionTimeMs") / SUM(qs."executionCount"))::float as "avgExecutionTimeMs"
				FROM "Query" q
				INNER JOIN "QueryStats" qs ON qs."queryId" = q.id
				WHERE q."connectionId" = ${connectionId}
				GROUP BY q.id, q."queryText"
				ORDER BY (SUM(qs."totalExecutionTimeMs") / SUM(qs."executionCount")) DESC
				LIMIT 10
			`,
			// Table access patterns with accessCount as int
			prisma.$queryRaw<
				Array<{
					id: string;
					connectionId: string;
					tableName: string;
					accessCount: number;
					lastAccessedAt: Date | null;
				}>
			>`
				SELECT 
					id,
					"connectionId",
					"tableName",
					"accessCount"::int as "accessCount",
					"lastAccessedAt"
				FROM "TableAccessPattern"
				WHERE "connectionId" = ${connectionId}
				ORDER BY "accessCount" DESC
				LIMIT 20
			`,
			// Index usage with numeric fields as int
			prisma.$queryRaw<
				Array<{
					id: string;
					connectionId: string;
					tableName: string;
					indexName: string;
					scans: number;
					tuplesRead: number;
					tuplesFetched: number;
					createdAt: Date;
					updatedAt: Date;
				}>
			>`
				SELECT 
					id,
					"connectionId",
					"tableName",
					"indexName",
					scans::int as scans,
					"tuplesRead"::int as "tuplesRead",
					"tuplesFetched"::int as "tuplesFetched",
					"createdAt",
					"updatedAt"
				FROM "IndexUsage"
				WHERE "connectionId" = ${connectionId}
				ORDER BY scans DESC
				LIMIT 20
			`,
		]);

		// All values are already cast to numbers in SQL, ready for JSON serialization
		return NextResponse.json({
			totalQueries: totalQueriesResult[0]?.total || 0,
			avgExecutionTime: avgExecutionTimeResult[0]?.avg || 0,
			slowQueries: slowQueriesResult[0]?.count || 0,
			mostFrequent: mostFrequentResult,
			slowest: slowestResult,
			tablePatterns: tablePatternsResult,
			indexUsage: indexUsageResult,
		});
	} catch (error) {
		console.error(error);
		logger.error({ error }, "Failed to fetch analytics");
		return NextResponse.json(
			{ error: "Failed to fetch analytics" },
			{ status: 500 },
		);
	}
}
