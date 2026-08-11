import type { AssetRef, GenerationMode, GenerationRun } from "@/types/domain";
import { createRun, updateRunStatus } from "@/lib/store";
import { runGeneration, runRemix } from "@/lib/workflows";

export const generationQueueName = "sparkplay:generation";

export interface GenerationJobInput {
  prompt: string;
  mode: GenerationMode;
  assets?: AssetRef[];
  projectId?: string;
  ownerId?: string;
}

export interface RemixJobInput {
  projectId: string;
  versionId?: string;
  prompt: string;
  assets?: AssetRef[];
  ownerId?: string;
}

export type GenerationQueueJob =
  | {
      kind: "generation";
      runId: string;
      input: GenerationJobInput;
    }
  | {
      kind: "remix";
      runId: string;
      input: RemixJobInput;
    };

const inFlight = new Set<string>();

export async function enqueueGeneration(input: GenerationJobInput): Promise<GenerationRun> {
  assertQueueAdapterConfigured();
  const run = await createRun({
    projectId: input.projectId ?? "pending",
    mode: input.mode,
    prompt: input.prompt,
    status: "queued"
  });
  await enqueueJobSafely(run.id, {
    kind: "generation",
    runId: run.id,
    input
  });
  return run;
}

export async function enqueueRemix(input: RemixJobInput): Promise<GenerationRun> {
  assertQueueAdapterConfigured();
  const run = await createRun({
    projectId: input.projectId,
    mode: "remix",
    prompt: input.prompt,
    status: "queued"
  });
  await enqueueJobSafely(run.id, {
    kind: "remix",
    runId: run.id,
    input
  });
  return run;
}

export async function processGenerationQueueJob(job: GenerationQueueJob): Promise<void> {
  if (job.kind === "generation") {
    await runGeneration({
      ...job.input,
      runId: job.runId
    });
    return;
  }
  await runRemix({
    ...job.input,
    runId: job.runId
  });
}

export function getQueueAdapter(): "in-process" | "bullmq" {
  return process.env.SPARKPLAY_QUEUE_ADAPTER === "bullmq" ? "bullmq" : "in-process";
}

export function getRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("SPARKPLAY_QUEUE_ADAPTER=bullmq requires REDIS_URL");
  }
  return redisUrl;
}

function assertQueueAdapterConfigured(): void {
  if (getQueueAdapter() === "bullmq") {
    getRedisUrl();
  }
}

async function enqueueJobSafely(runId: string, job: GenerationQueueJob): Promise<void> {
  try {
    await enqueueJob(job);
  } catch (error) {
    await updateRunStatus(runId, "failed", {
      error: error instanceof Error ? error.message : "任务入队失败"
    }).catch(() => undefined);
    throw error;
  }
}

async function enqueueJob(job: GenerationQueueJob): Promise<void> {
  if (getQueueAdapter() === "bullmq") {
    await enqueueBullMqJob(job);
    return;
  }
  scheduleInProcess(job.runId, () => processGenerationQueueJob(job));
}

async function enqueueBullMqJob(job: GenerationQueueJob): Promise<void> {
  const { Queue } = await import("bullmq");
  const IORedis = (await import("ioredis")).default;
  const connection = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null
  });
  const queue = new Queue<GenerationQueueJob>(generationQueueName, {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 1500
      },
      removeOnComplete: 200,
      removeOnFail: 500
    }
  });
  try {
    await queue.add(job.kind, job, {
      jobId: job.runId
    });
  } finally {
    await queue.close();
    await connection.quit();
  }
}

function scheduleInProcess(runId: string, worker: () => Promise<unknown>) {
  if (inFlight.has(runId)) return;
  inFlight.add(runId);
  setTimeout(() => {
    void worker()
      .catch(async (error: unknown) => {
        await updateRunStatus(runId, "failed", {
          error: error instanceof Error ? error.message : "生成任务失败"
        }).catch(() => undefined);
      })
      .finally(() => {
        inFlight.delete(runId);
      });
  }, 0);
}
