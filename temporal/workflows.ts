import * as wf from '@temporalio/workflow';
import type * as activities from './activities';

const {
  getConnection,
  fetchDatabaseStats,
  saveDatabaseStats,
  updateConnectionStatus,
  fetchSlowQueries,
  fetchIndexUsage,
  fetchTablePatterns,
  generateLLMSuggestions,
  saveSuggestions,
} = wf.proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
});

export async function syncDatabaseStats(connectionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const connection = await getConnection(connectionId);

    if (!connection || connection.status !== 'ACTIVE') {
      return { success: false, error: 'Connection not active' };
    }

    const stats = await fetchDatabaseStats(
      connection.id,
      connection.dbType,
      connection.host,
      connection.port,
      connection.database,
      connection.username,
      connection.encryptedPassword,
      connection.encryptionKeyId
    );

    await saveDatabaseStats(connection.id, stats);

    return { success: true };
  } catch (error) {
    try {
      await updateConnectionStatus(connectionId, 'ERROR');
    } catch {
    }
    return { success: false, error: String(error) };
  }
}

export async function generateSuggestions(connectionId: string): Promise<{ success: boolean; suggestions?: number; error?: string }> {
  try {
    const connection = await getConnection(connectionId);

    if (!connection) {
      return { success: false, error: 'Connection not found' };
    }

    const [slowQueries, indexUsage, tablePatterns] = await Promise.all([
      fetchSlowQueries(connectionId),
      fetchIndexUsage(connectionId),
      fetchTablePatterns(connectionId),
    ]);

    if (slowQueries.length === 0) {
      return { success: true, suggestions: 0 };
    }

    const context = {
      slowQueries: slowQueries.map((q) => ({
        query: q.queryText,
        avgTime: q.avgExecutionTimeMs,
        executionCount: Number(q.executionCount),
      })),
      indexUsage: indexUsage.map((idx) => ({
        table: idx.tableName,
        index: idx.indexName,
        scans: Number(idx.scans),
      })),
      tablePatterns: tablePatterns.map((t) => ({
        table: t.tableName,
        accessCount: Number(t.accessCount),
      })),
    };

    const suggestions = await generateLLMSuggestions(context);

    await saveSuggestions(connection.id, connection.userId, suggestions);

    return { success: true, suggestions: suggestions.length };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
