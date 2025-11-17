import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';

async function run() {
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

  const connection = await NativeConnection.connect(connectionOptions);

  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'plotweft-task-queue',
    workflowsPath: require.resolve('./workflows.ts'),
    activities,
  });

  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
