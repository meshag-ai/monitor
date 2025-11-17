import { defineConfig } from '@temporalio/workflow';

export default defineConfig({
  bundles: {
    workflows: {
      path: './temporal/workflows.ts',
    },
  },
});
