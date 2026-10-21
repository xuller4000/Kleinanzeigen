import { DurableObject } from "cloudflare:workers";

export type JobType = "contact" | "inbox" | "conversation" | "reply";

export interface Job {
  id: string;
  type: JobType;
  payload: Record<string, string>;
  status: "pending" | "running" | "done" | "failed";
  createdAt: number;
  claimedAt?: number;
  finishedAt?: number;
  result?: string;
  error?: string;
  debug?: string;
}

/** A job the extension claimed but never reported back on is handed out again after this. */
const LEASE_MS = 3 * 60_000;
/** Jobs nobody picked up are dropped instead of being sent hours later. */
const PENDING_TTL_MS = 10 * 60_000;
const KEEP_MS = 24 * 60 * 60_000;

/**
 * Single instance holding the job queue between Claude and the browser extension.
 * A Durable Object instead of KV because both sides poll from different locations and need to see writes at once.
 */
export class Hub extends DurableObject {
  async createJob(type: JobType, payload: Record<string, string>): Promise<Job> {
    await this.cleanup();
    const job: Job = { id: crypto.randomUUID().slice(0, 8), type, payload, status: "pending", createdAt: Date.now() };
    await this.ctx.storage.put(`job:${job.id}`, job);
    return job;
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.ctx.storage.get<Job>(`job:${id}`);
  }

  async claimJob(): Promise<Job | null> {
    const now = Date.now();
    await this.ctx.storage.put("lastSeen", now);
    const jobs = [...(await this.ctx.storage.list<Job>({ prefix: "job:" })).values()].sort((a, b) => a.createdAt - b.createdAt);
    const job = jobs.find(
      (j) =>
        (j.status === "pending" && now - j.createdAt < PENDING_TTL_MS) ||
        (j.status === "running" && now - (j.claimedAt ?? 0) > LEASE_MS && now - j.createdAt < PENDING_TTL_MS),
    );
    if (!job) return null;
    job.status = "running";
    job.claimedAt = now;
    await this.ctx.storage.put(`job:${job.id}`, job);
    return job;
  }

  async finishJob(id: string, report: { ok: boolean; result?: string; error?: string; debug?: string }): Promise<boolean> {
    const job = await this.getJob(id);
    if (!job) return false;
    job.status = report.ok ? "done" : "failed";
    job.finishedAt = Date.now();
    job.result = report.result?.slice(0, 30_000);
    job.error = report.error?.slice(0, 1_000);
    job.debug = report.debug?.slice(0, 4_000);
    await this.ctx.storage.put(`job:${id}`, job);
    return true;
  }

  async lastSeen(): Promise<number | undefined> {
    return this.ctx.storage.get<number>("lastSeen");
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    const old = [...(await this.ctx.storage.list<Job>({ prefix: "job:" })).values()].filter((j) => now - j.createdAt > KEEP_MS);
    if (old.length) await this.ctx.storage.delete(old.map((j) => `job:${j.id}`));
  }
}
