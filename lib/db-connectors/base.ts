export interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface QueryStat {
  queryText: string;
  queryHash: string;
  executionTimeMs: number;
  executionCount: bigint;
  avgExecutionTimeMs: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface TableAccessPattern {
  tableName: string;
  accessCount: bigint;
  lastAccessedAt: Date | null;
}

export interface IndexUsage {
  tableName: string;
  indexName: string;
  scans: bigint;
  tuplesRead: bigint;
  tuplesFetched: bigint;
}

export interface QueryPlan {
  planJson: any;
  costEstimate?: number;
}

export interface SchemaInfo {
  tables: {
    name: string;
    columns: {
      name: string;
      type: string;
      nullable: boolean;
    }[];
  }[];
}

export interface DbConnector {
  testConnection(): Promise<boolean>;
  fetchQueryStats(): Promise<QueryStat[]>;
  fetchSchema(): Promise<SchemaInfo>;
  fetchQueryPlans(queryHashes?: string[]): Promise<Map<string, QueryPlan[]>>;
  fetchIndexUsage(): Promise<IndexUsage[]>;
  fetchTableAccessPatterns(): Promise<TableAccessPattern[]>;
  close(): Promise<void>;
}
