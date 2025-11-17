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

const log = wf.log;

export async function syncDatabaseStats(connectionId: string): Promise<{ success: boolean; error?: string }> {
  log.info('Starting syncDatabaseStats workflow', { connectionId });
  try {
    const connection = await getConnection(connectionId);

    if (!connection || connection.status !== 'ACTIVE') {
      log.warn('Connection not active, aborting sync', { connectionId, status: connection?.status });
      return { success: false, error: 'Connection not active' };
    }

    log.info('Fetching database stats', { connectionId });
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

    log.info('Saving database stats', { connectionId });
    await saveDatabaseStats(connection.id, stats);

    log.info('Finished syncDatabaseStats workflow successfully', { connectionId });
    return { success: true };
  } catch (error) {
    log.error('syncDatabaseStats workflow failed', { connectionId, error: String(error) });
    try {
      await updateConnectionStatus(connectionId, 'ERROR');
    } catch (e) {
      log.error('Failed to update connection status to ERROR', { connectionId, error: String(e) });
    }
    return { success: false, error: String(error) };
  }
}

export async function generateSuggestions(connectionId: string): Promise<{ success: boolean; suggestions?: number; error?: string }> {
  log.info('Starting generateSuggestions workflow', { connectionId });
  try {
    const connection = await getConnection(connectionId);

    if (!connection) {
      log.warn('Connection not found, aborting suggestion generation', { connectionId });
      return { success: false, error: 'Connection not found' };
    }

    log.info('Fetching data for suggestions', { connectionId });
    const [slowQueries, indexUsage, tablePatterns] = await Promise.all([
      fetchSlowQueries(connectionId),
      fetchIndexUsage(connectionId),
      fetchTablePatterns(connectionId),
    ]);

    if (slowQueries.length === 0) {
      log.info('No slow queries found, skipping suggestion generation', { connectionId });
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

    log.info('Generating LLM suggestions', { connectionId });
    const suggestions = await generateLLMSuggestions(context);

    log.info('Saving suggestions', { connectionId, count: suggestions.length });
    await saveSuggestions(connection.id, connection.userId, suggestions);

    log.info('Finished generateSuggestions workflow successfully', { connectionId });
    return { success: true, suggestions: suggestions.length };
  } catch (error) {
    log.error('generateSuggestions workflow failed', { connectionId, error: String(error) });
    return { success: false, error: String(error) };
  }
}
