import { Connection, Client } from '@temporalio/client';

const connection = Connection.connect({
  address: process.env.TEMPORAL_ADDRESS!,
});

export const temporal = new Client({
  connection,
  namespace: process.env.TEMPORAL_NAMESPACE || 'default',
});
