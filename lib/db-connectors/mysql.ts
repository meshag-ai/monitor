import mysql from 'mysql2/promise';
import type {
  ConnectionConfig,
  DbConnector,
  QueryStat,
  SchemaInfo,
  QueryPlan,
  IndexUsage,
  TableAccessPattern
} from './base';

export class MySQLConnector implements DbConnector {
  private pool: mysql.Pool;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
    this.pool = mysql.createPool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      connectTimeout: 5000,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const connection = await this.pool.getConnection();
      await connection.query('SELECT 1');
      connection.release();
      return true;
    } catch {
      return false;
    }
  }

  async fetchQueryStats(): Promise<QueryStat[]> {
    const connection = await this.pool.getConnection();
    try {
      try {
        await connection.query(`SET GLOBAL performance_schema = ON`);
      } catch {
      }

      const [rows] = await connection.query<any[]>(`
        SELECT
          DIGEST_TEXT as query_text,
          DIGEST as query_hash,
          AVG_TIMER_WAIT / 1000000000000 as avg_execution_time_ms,
          COUNT_STAR as execution_count,
          MAX_TIMER_WAIT / 1000000000000 as max_execution_time_ms
        FROM performance_schema.events_statements_summary_by_digest
        WHERE SCHEMA_NAME = ?
        AND DIGEST_TEXT IS NOT NULL
        AND DIGEST_TEXT NOT LIKE '%performance_schema%'
        ORDER BY SUM_TIMER_WAIT DESC
        LIMIT 1000
      `, [this.config.database]);

      const now = new Date();
      return rows.map(row => ({
        queryText: row.query_text || '',
        queryHash: row.query_hash || '',
        executionTimeMs: parseFloat(row.max_execution_time_ms) || 0,
        executionCount: BigInt(row.execution_count || 0),
        avgExecutionTimeMs: parseFloat(row.avg_execution_time_ms) || 0,
        firstSeenAt: now,
        lastSeenAt: now,
      }));
    } catch (error) {
      return [];
    } finally {
      connection.release();
    }
  }

  async fetchSchema(): Promise<SchemaInfo> {
    const connection = await this.pool.getConnection();
    try {
      const [tables] = await connection.query<any[]>(`
      SELECT TABLE_NAME as table_name
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `, [this.config.database]);

    const tableList = await Promise.all(
      tables.map(async (table) => {
        const [columns] = await connection.query<any[]>(`
          SELECT
            COLUMN_NAME as column_name,
            DATA_TYPE as data_type,
            IS_NULLABLE as is_nullable
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `, [this.config.database, table.table_name]);

        return {
          name: table.table_name,
          columns: columns.map(col => ({
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable === 'YES',
          })),
        };
      })
    );

    return { tables: tableList };
    } finally {
      connection.release();
    }
  }

  async fetchQueryPlans(queryHashes?: string[]): Promise<Map<string, QueryPlan[]>> {
    const plansMap = new Map<string, QueryPlan[]>();

    if (!queryHashes || queryHashes.length === 0) {
      return plansMap;
    }

    const connection = await this.pool.getConnection();
    try {
      const placeholders = queryHashes.map(() => '?').join(',');
      const [rows] = await connection.query<any[]>(`
        SELECT DIGEST_TEXT as query_text, DIGEST as query_hash
        FROM performance_schema.events_statements_summary_by_digest
        WHERE DIGEST IN (${placeholders})
        AND SCHEMA_NAME = ?
        LIMIT 50
      `, [...queryHashes, this.config.database]);

      for (const row of rows) {
        try {
          const [explainRows] = await connection.query<any[]>(`EXPLAIN FORMAT=JSON ${row.query_text}`);
          const plans: QueryPlan[] = explainRows.map((planRow: any) => {
            const planData = planRow['EXPLAIN'];
            return {
              planJson: planData,
              costEstimate: this.extractCostEstimate(planData),
            };
          });
          plansMap.set(row.query_hash, plans);
        } catch {
        }
      }
    } catch {
    } finally {
      connection.release();
    }

    return plansMap;
  }

  private extractCostEstimate(plan: any): number | undefined {
    if (plan?.query_block?.cost_info?.query_cost) {
      return parseFloat(plan.query_block.cost_info.query_cost);
    }
    return undefined;
  }

  async fetchIndexUsage(): Promise<IndexUsage[]> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.query<any[]>(`
        SELECT
          TABLE_NAME as table_name,
          INDEX_NAME as index_name,
          CARDINALITY as scans,
          0 as tuples_read,
          0 as tuples_fetched
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = ?
        ORDER BY INDEX_NAME
      `, [this.config.database]);

      return rows.map(row => ({
        tableName: row.table_name,
        indexName: row.index_name,
        scans: BigInt(row.scans || 0),
        tuplesRead: BigInt(row.tuples_read || 0),
        tuplesFetched: BigInt(row.tuples_fetched || 0),
      }));
    } catch {
      return [];
    } finally {
      connection.release();
    }
  }

  async fetchTableAccessPatterns(): Promise<TableAccessPattern[]> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.query<any[]>(`
        SELECT
          TABLE_NAME as table_name,
          TABLE_ROWS as access_count,
          UPDATE_TIME as last_accessed_at
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
        AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_ROWS DESC
      `, [this.config.database]);

      return rows.map(row => ({
        tableName: row.table_name,
        accessCount: BigInt(row.access_count || 0),
        lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at) : null,
      }));
    } catch {
      return [];
    } finally {
      connection.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
