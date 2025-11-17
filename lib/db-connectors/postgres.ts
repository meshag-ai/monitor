import { Pool, Client } from 'pg';
import crypto from 'crypto';
import type {
  ConnectionConfig,
  DbConnector,
  QueryStat,
  SchemaInfo,
  QueryPlan,
  IndexUsage,
  TableAccessPattern
} from './base';

export class PostgresConnector implements DbConnector {
  private pool: Pool;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch {
      return false;
    }
  }

  async fetchQueryStats(): Promise<QueryStat[]> {
    const client = await this.pool.connect();
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS pg_stat_statements');
      
      const result = await client.query(`
        SELECT
          query,
          md5(query) as query_hash,
          mean_exec_time as avg_execution_time_ms,
          calls as execution_count,
          total_exec_time as total_execution_time_ms,
          min_exec_time as min_execution_time_ms,
          max_exec_time as max_execution_time_ms
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_statements%'
        ORDER BY total_exec_time DESC
        LIMIT 1000
      `);

      const now = new Date();
      return result.rows.map(row => ({
        queryText: row.query,
        queryHash: row.query_hash,
        executionTimeMs: parseFloat(row.max_execution_time_ms) || 0,
        executionCount: BigInt(row.execution_count),
        avgExecutionTimeMs: parseFloat(row.avg_execution_time_ms) || 0,
        firstSeenAt: now,
        lastSeenAt: now,
      }));
    } finally {
      client.release();
    }
  }

  async fetchSchema(): Promise<SchemaInfo> {
    const client = await this.pool.connect();
    try {
      const tablesResult = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const tables = await Promise.all(
        tablesResult.rows.map(async (table) => {
          const columnsResult = await client.query(`
            SELECT
              column_name,
              data_type,
              is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = $1
            ORDER BY ordinal_position
          `, [table.table_name]);

          return {
            name: table.table_name,
            columns: columnsResult.rows.map(col => ({
              name: col.column_name,
              type: col.data_type,
              nullable: col.is_nullable === 'YES',
            })),
          };
        })
      );

      return { tables };
    } finally {
      client.release();
    }
  }

  async fetchQueryPlans(queryHashes?: string[]): Promise<Map<string, QueryPlan[]>> {
    const client = await this.pool.connect();
    const plansMap = new Map<string, QueryPlan[]>();

    try {
      if (!queryHashes || queryHashes.length === 0) {
        return plansMap;
      }

      const statsResult = await client.query(`
        SELECT query, md5(query) as query_hash
        FROM pg_stat_statements
        WHERE md5(query) = ANY($1)
        LIMIT 50
      `, [queryHashes]);

      for (const row of statsResult.rows) {
        try {
          const explainResult = await client.query(`EXPLAIN (FORMAT JSON) ${row.query}`);
          const plans: QueryPlan[] = explainResult.rows.map(planRow => ({
            planJson: planRow['QUERY PLAN'],
            costEstimate: this.extractCostEstimate(planRow['QUERY PLAN']),
          }));
          plansMap.set(row.query_hash, plans);
        } catch {
        }
      }
    } finally {
      client.release();
    }

    return plansMap;
  }

  private extractCostEstimate(plan: any): number | undefined {
    if (Array.isArray(plan) && plan[0]?.Plan?.Total_Cost) {
      return parseFloat(plan[0].Plan.Total_Cost);
    }
    return undefined;
  }

  async fetchIndexUsage(): Promise<IndexUsage[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT
          schemaname,
          tablename as table_name,
          indexname as index_name,
          idx_scan as scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
      `);

      return result.rows.map(row => ({
        tableName: row.table_name,
        indexName: row.index_name,
        scans: BigInt(row.scans || 0),
        tuplesRead: BigInt(row.tuples_read || 0),
        tuplesFetched: BigInt(row.tuples_fetched || 0),
      }));
    } finally {
      client.release();
    }
  }

  async fetchTableAccessPatterns(): Promise<TableAccessPattern[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT
          schemaname,
          relname as table_name,
          seq_scan + idx_scan as access_count,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY seq_scan + idx_scan DESC
      `);

      return result.rows.map(row => ({
        tableName: row.table_name,
        accessCount: BigInt(row.access_count || 0),
        lastAccessedAt: row.last_analyze || row.last_autoanalyze || null,
      }));
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
