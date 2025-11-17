export interface ConnectionConfig {
	host: string;
	port: number;
	database: string;
	username: string;
	password: string;
}

export type QueryStat = {
	queryText: string;
	queryHash: string;
	executionCount: number;
	avgExecutionTimeMs: number;
	totalExecutionTimeMs: number;
	firstSeenAt: Date;
	lastSeenAt: Date;
};

export type TableAccessPattern = {
	tableName: string;
	accessCount: number;
	lastAccessedAt: Date | null;
};

export type IndexUsage = {
	tableName: string;
	indexName: string;
	scans: number;
	tuplesRead: number;
	tuplesFetched: number;
};

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
