-- CreateEnum
CREATE TYPE "DbType" AS ENUM ('POSTGRES', 'MYSQL');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR', 'TESTING');

-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('INDEX_OPTIMIZATION', 'QUERY_OPTIMIZATION', 'SCHEMA_OPTIMIZATION', 'CONNECTION_OPTIMIZATION');

-- CreateEnum
CREATE TYPE "SuggestionPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('NEW', 'REVIEWED', 'APPLIED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dbType" "DbType" NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "database" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "encryptionKeyId" TEXT NOT NULL,
    "pollingIntervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'TESTING',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Query" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Query_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryStats" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executionCount" BIGINT NOT NULL,
    "totalExecutionTimeMs" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "QueryStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryPlan" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "planJson" JSONB NOT NULL,
    "costEstimate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueryPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableAccessPattern" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "accessCount" BIGINT NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),

    CONSTRAINT "TableAccessPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexUsage" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "indexName" TEXT NOT NULL,
    "scans" BIGINT NOT NULL DEFAULT 0,
    "tuplesRead" BIGINT NOT NULL DEFAULT 0,
    "tuplesFetched" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptimizationSuggestion" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "queryId" TEXT,
    "suggestionText" TEXT NOT NULL,
    "suggestionType" "SuggestionType" NOT NULL,
    "priority" "SuggestionPriority" NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "OptimizationSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemaSnapshot" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchemaSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemaTable" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,

    CONSTRAINT "SchemaTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemaColumn" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "columnName" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "isNullable" BOOLEAN NOT NULL,

    CONSTRAINT "SchemaColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemaIndex" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "indexName" TEXT NOT NULL,
    "definition" TEXT NOT NULL,

    CONSTRAINT "SchemaIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Connection_userId_idx" ON "Connection"("userId");

-- CreateIndex
CREATE INDEX "Connection_status_idx" ON "Connection"("status");

-- CreateIndex
CREATE INDEX "Connection_lastSyncedAt_idx" ON "Connection"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "Query_connectionId_idx" ON "Query"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Query_connectionId_queryHash_key" ON "Query"("connectionId", "queryHash");

-- CreateIndex
CREATE INDEX "QueryStats_queryId_capturedAt_idx" ON "QueryStats"("queryId", "capturedAt");

-- CreateIndex
CREATE INDEX "QueryPlan_queryId_idx" ON "QueryPlan"("queryId");

-- CreateIndex
CREATE INDEX "QueryPlan_createdAt_idx" ON "QueryPlan"("createdAt");

-- CreateIndex
CREATE INDEX "TableAccessPattern_connectionId_accessCount_idx" ON "TableAccessPattern"("connectionId", "accessCount");

-- CreateIndex
CREATE INDEX "TableAccessPattern_connectionId_lastAccessedAt_idx" ON "TableAccessPattern"("connectionId", "lastAccessedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TableAccessPattern_connectionId_tableName_key" ON "TableAccessPattern"("connectionId", "tableName");

-- CreateIndex
CREATE INDEX "IndexUsage_connectionId_scans_idx" ON "IndexUsage"("connectionId", "scans");

-- CreateIndex
CREATE UNIQUE INDEX "IndexUsage_connectionId_tableName_indexName_key" ON "IndexUsage"("connectionId", "tableName", "indexName");

-- CreateIndex
CREATE INDEX "OptimizationSuggestion_connectionId_status_idx" ON "OptimizationSuggestion"("connectionId", "status");

-- CreateIndex
CREATE INDEX "OptimizationSuggestion_connectionId_priority_idx" ON "OptimizationSuggestion"("connectionId", "priority");

-- CreateIndex
CREATE INDEX "OptimizationSuggestion_connectionId_createdAt_idx" ON "OptimizationSuggestion"("connectionId", "createdAt");

-- CreateIndex
CREATE INDEX "OptimizationSuggestion_userId_idx" ON "OptimizationSuggestion"("userId");

-- CreateIndex
CREATE INDEX "SchemaSnapshot_connectionId_capturedAt_idx" ON "SchemaSnapshot"("connectionId", "capturedAt");

-- CreateIndex
CREATE INDEX "SchemaTable_snapshotId_idx" ON "SchemaTable"("snapshotId");

-- CreateIndex
CREATE INDEX "SchemaColumn_tableId_idx" ON "SchemaColumn"("tableId");

-- CreateIndex
CREATE INDEX "SchemaIndex_tableId_idx" ON "SchemaIndex"("tableId");

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Query" ADD CONSTRAINT "Query_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryStats" ADD CONSTRAINT "QueryStats_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "Query"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryPlan" ADD CONSTRAINT "QueryPlan_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "Query"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAccessPattern" ADD CONSTRAINT "TableAccessPattern_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndexUsage" ADD CONSTRAINT "IndexUsage_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptimizationSuggestion" ADD CONSTRAINT "OptimizationSuggestion_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptimizationSuggestion" ADD CONSTRAINT "OptimizationSuggestion_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "Query"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptimizationSuggestion" ADD CONSTRAINT "OptimizationSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaSnapshot" ADD CONSTRAINT "SchemaSnapshot_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaTable" ADD CONSTRAINT "SchemaTable_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SchemaSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaColumn" ADD CONSTRAINT "SchemaColumn_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "SchemaTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaIndex" ADD CONSTRAINT "SchemaIndex_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "SchemaTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
