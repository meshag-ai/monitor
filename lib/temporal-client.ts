import { Connection, Client } from '@temporalio/client';

let client: Client | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (client) {
    return client;
  }

  const namespace = process.env.TEMPORAL_NAMESPACE || 'default';
  const address = process.env.TEMPORAL_ADDRESS;
  const apiKey = process.env.TEMPORAL_API_KEY;

  if (!address) {
    throw new Error('TEMPORAL_ADDRESS environment variable is required');
  }

  const connectionOptions: any = {
    address,
    tls: apiKey
      ? {
          clientCertPair: process.env.TEMPORAL_CLIENT_CERT && process.env.TEMPORAL_CLIENT_KEY
            ? {
                crt: Buffer.from(process.env.TEMPORAL_CLIENT_CERT),
                key: Buffer.from(process.env.TEMPORAL_CLIENT_KEY),
              }
            : undefined,
        }
      : undefined,
  };

  if (apiKey && !connectionOptions.tls?.clientCertPair) {
    connectionOptions.metadata = {
      authorization: `Bearer ${apiKey}`,
    };
  }

  const connection = await Connection.connect(connectionOptions);

  client = new Client({
    connection,
    namespace,
  });

  return client;
}

export async function startWorkflow<T extends any[]>(
  workflowType: string,
  args: T,
  options?: {
    taskQueue?: string;
    workflowId?: string;
  }
) {
  const temporalClient = await getTemporalClient();
  const taskQueue = options?.taskQueue || process.env.TEMPORAL_TASK_QUEUE || 'plotweft-task-queue';
  const workflowId = options?.workflowId || `${workflowType}-${Date.now()}`;

  const handle = await temporalClient.workflow.start(workflowType, {
    args,
    taskQueue,
    workflowId,
  });

  return handle;
}
