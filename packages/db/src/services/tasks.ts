/** Background tasks. Each task name maps to one handler in apps/worker; payloads hold ids only — never phone numbers. */
export interface TaskPayloads {
  'inbound.process': { providerMessageId: string; channel: string; raw: string };
  'delivery.status': { providerMessageId: string; status: string; error?: string };
  'media.process': { mediaId: string };
  'ai.process': { jobId: string; attempt?: number };
  'confirmation.send': { jobId: string };
  'confirmation.remind': { confirmationId: string; n: number };
  'confirmation.expire': { confirmationId: string };
  'outbound.send': { recipient: Recipient; messages: unknown[]; purpose: string; relatedEntity?: string; relatedId?: string; ref?: string };
  'levels.recalculate': { artisanId: string; reason: string; notify: boolean };
  'workrequest.followup': { workRequestId: string };
  'maintenance.purge': Record<string, never>;
}

export type TaskName = keyof TaskPayloads;

/** Who to message. Resolved to a phone number (decrypted) only inside the outbound worker. */
export type Recipient =
  | { kind: 'artisan'; id: string }
  | { kind: 'client'; id: string }
  | { kind: 'buyer'; id: string };

export interface TaskQueue {
  enqueue<K extends TaskName>(name: K, data: TaskPayloads[K], opts?: { delayMs?: number; jobId?: string }): Promise<void>;
  cancel(jobId: string): Promise<void>;
}

export type TaskHandlers = { [K in TaskName]: (data: TaskPayloads[K]) => Promise<void> };

/**
 * In-process queue for tests, seeding and single-process demos. Tasks run when `drain()` is called; delayed tasks run
 * once the injected clock reaches their due time.
 */
export class InlineQueue implements TaskQueue {
  private pending: { name: TaskName; data: unknown; due: number; jobId?: string }[] = [];
  private handlers: Partial<TaskHandlers> = {};
  readonly log: { name: TaskName; data: unknown }[] = [];
  constructor(private readonly now: () => Date) {}
  setHandlers(h: Partial<TaskHandlers>) {
    this.handlers = h;
  }
  async enqueue<K extends TaskName>(name: K, data: TaskPayloads[K], opts?: { delayMs?: number; jobId?: string }) {
    if (opts?.jobId && this.pending.some((p) => p.jobId === opts.jobId)) return;
    this.pending.push({ name, data, due: this.now().getTime() + (opts?.delayMs ?? 0), ...(opts?.jobId ? { jobId: opts.jobId } : {}) });
  }
  async cancel(jobId: string) {
    this.pending = this.pending.filter((p) => p.jobId !== jobId);
  }
  pendingTasks() {
    return this.pending.map((p) => ({ name: p.name, data: p.data, due: new Date(p.due) }));
  }
  /** Runs every due task (and tasks they enqueue) until none are due. */
  async drain(max = 500): Promise<number> {
    let ran = 0;
    for (;;) {
      const now = this.now().getTime();
      const idx = this.pending.findIndex((p) => p.due <= now);
      if (idx < 0 || ran >= max) return ran;
      const [task] = this.pending.splice(idx, 1);
      const handler = this.handlers[task!.name] as ((d: unknown) => Promise<void>) | undefined;
      this.log.push({ name: task!.name, data: task!.data });
      if (handler) await handler(task!.data);
      ran++;
    }
  }
}
