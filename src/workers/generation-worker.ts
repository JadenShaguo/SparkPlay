import { Worker } from "bullmq";
import IORedis from "ioredis";
import {
  generationQueueName,
  getRedisUrl,
  processGenerationQueueJob,
  type GenerationQueueJob
} from "@/lib/generation-queue";
import { updateRunStatus } from "@/lib/store";

void main().catch((error: unknown) => {
  console.error(`[generation-worker] ${error instanceof Error ? error.message : "启动失败"}`);
  process.exit(1);
});

async function main() {
  const concurrency = readPositiveInteger(process.env.SPARKPLAY_WORKER_CONCURRENCY, 2);
  const connection = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null
  });

  const worker = new Worker<GenerationQueueJob>(
    generationQueueName,
    async (job) => {
      await processGenerationQueueJob(job.data);
    },
    {
      connection,
      concurrency
    }
  );

  worker.on("completed", (job) => {
    console.log(`[generation-worker] completed ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    const runId = job?.data.runId;
    console.error(`[generation-worker] failed ${job?.id ?? "unknown"}: ${error.message}`);
    if (runId) {
      void updateRunStatus(runId, "failed", {
        error: error.message
      }).catch((statusError) => {
        console.error(`[generation-worker] failed to persist error for ${runId}:`, statusError);
      });
    }
  });

  console.log(`[generation-worker] listening on ${generationQueueName}, concurrency=${concurrency}`);

  process.on("SIGINT", () => {
    void shutdown("SIGINT", worker, connection);
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM", worker, connection);
  });
}

async function shutdown(signal: string, worker: Worker<GenerationQueueJob>, connection: IORedis) {
  console.log(`[generation-worker] received ${signal}, shutting down`);
  await worker.close();
  await connection.quit();
  process.exit(0);
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
