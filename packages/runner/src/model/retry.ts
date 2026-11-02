// Retrying a live call that failed for a transient reason, as the benchmarks'
// own clients do (PR #25 review round 3, V-4). pi-ai's chat-completions
// adapter retries nothing by default (maxRetries 0) and its own retry sleeps
// on real timers with random jitter, so the runner retries itself, with an
// injected sleep: tests run instantly and every delay is deterministic.
//
// A failure is transient when pi-ai's error message starts with an HTTP
// status in the policy's list (pi-ai writes "<status> <message>" or
// "<status>: <body>"), or when the call never got an HTTP response (a
// connection error or a timeout, which upstream's clients retry as an
// exception). An error the provider reports inside a 200 response ("Provider
// finish_reason: ...") and any other status are not retried, as upstream
// does not retry them.
import type { AssistantMessage } from "@earendil-works/pi-ai";

export interface RetryPolicy {
  /** How many times the call is made at most, the first included. */
  attempts: number;
  /** The HTTP statuses retried. */
  statuses: readonly number[];
  /** The wait after the `failure`-th transient failure (0-based), before the next attempt. */
  delayMs: (failure: number) => number;
}

/**
 * MEM-INV-Bench's `driver.call` at the pin: four attempts, statuses 429, 500,
 * 502, 503 and 524 and network errors retried, waiting min(2^i, 20) seconds.
 */
export const NOTE_RETRY: RetryPolicy = {
  attempts: 4,
  statuses: [429, 500, 502, 503, 524],
  delayMs: (i) => Math.min(2 ** i, 20) * 1000,
};

/**
 * GateMem's LLM router at the pin (`max_retries` 3, `backoff_sleep`): three
 * attempts, statuses 429, 500, 502, 503 and 504 and network errors retried,
 * waiting min(2^i, 10) seconds.
 */
export const JUDGE_RETRY: RetryPolicy = {
  attempts: 3,
  statuses: [429, 500, 502, 503, 504],
  delayMs: (i) => Math.min(2 ** i, 10) * 1000,
};

export type Sleep = (ms: number) => Promise<void>;

/** A real wait; tests inject their own. */
export const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STATUS = /^(?:HTTP )?(\d{3})\b/;
const NETWORK =
  /^(?:connection error|request timed out)|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed/i;

/** Whether a failed reply's error is transient under `policy` (see the module comment). */
export function isTransient(errorMessage: string | undefined, policy: RetryPolicy): boolean {
  const message = (errorMessage ?? "").trim();
  const status = STATUS.exec(message);
  if (status) return policy.statuses.includes(Number(status[1]));
  return NETWORK.test(message);
}

/**
 * `once` called until its reply is not a transient failure, at most
 * `policy.attempts` times, waiting `policy.delayMs` between attempts: the
 * last reply, and how many calls were made. An aborted reply is returned at
 * once, never retried.
 */
export async function withRetry(
  once: () => Promise<AssistantMessage>,
  policy: RetryPolicy,
  sleep: Sleep,
): Promise<{ reply: AssistantMessage; attempts: number }> {
  for (let attempt = 1; ; attempt++) {
    const reply = await once();
    const retry =
      reply.stopReason === "error" &&
      attempt < policy.attempts &&
      isTransient(reply.errorMessage, policy);
    if (!retry) return { reply, attempts: attempt };
    await sleep(policy.delayMs(attempt - 1));
  }
}
