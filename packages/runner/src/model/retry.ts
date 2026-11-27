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
import { TransientCallError, type UsageRecord } from "@engram/model";

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

/**
 * The HTTP status pi-ai's error message starts with, if any: the one parse
 * the retry, the refusal and the stop read (card X20, review X20-5).
 */
export function httpStatus(errorMessage: string | undefined): number | undefined {
  const status = STATUS.exec((errorMessage ?? "").trim());
  return status ? Number(status[1]) : undefined;
}

/** Whether a failed reply's error is transient under `policy` (see the module comment). */
export function isTransient(errorMessage: string | undefined, policy: RetryPolicy): boolean {
  const status = httpStatus(errorMessage);
  if (status !== undefined) return policy.statuses.includes(status);
  return NETWORK.test((errorMessage ?? "").trim());
}

/**
 * The statuses that stop a run at any model call it makes (card X20): a key
 * (401), credit (402) or key-limit (403) problem, the operator's to fix (the
 * coordinator's decision of 2026-11-21), and a pinned endpoint or model that
 * is gone (404; with R6's `allow_fallbacks: false` it fails every call).
 */
export const STOP_STATUSES: readonly number[] = [401, 402, 403, 404];

/** A status in an error body pi-ai folded into the message (OpenRouter's `"code": 402`). */
const BODY_CODE = /"code"\s*:\s*"?(\d{3})(?!\d)/g;

const bodyCodes = (message: string): number[] =>
  [...message.matchAll(BODY_CODE)].map((m) => Number(m[1]));

/**
 * Whether the error is OpenRouter's moderation refusal: a 403 whose body
 * carries its documented ModerationErrorMetadata (`reasons` and
 * `flagged_input`). It refuses one prompt, not the key, so it does not stop
 * the run (review X20-2); a 403 without that body does.
 */
export function isModerationFlag(errorMessage: string | undefined): boolean {
  const message = (errorMessage ?? "").trim();
  const is403 = httpStatus(message) === 403 || bodyCodes(message).includes(403);
  return is403 && /"flagged_input"\s*:/.test(message) && /"reasons"\s*:/.test(message);
}

/**
 * The status that stops the run, if the error carries one (card X20): its
 * leading status, or a `"code"` in its body, in STOP_STATUSES, unless it is
 * a moderation flag. A doubt between a stop and anything else is a stop.
 */
export function stoppingStatus(errorMessage: string | undefined): number | undefined {
  if (isModerationFlag(errorMessage)) return undefined;
  const message = (errorMessage ?? "").trim();
  const leading = httpStatus(message);
  if (leading !== undefined && STOP_STATUSES.includes(leading)) return leading;
  return bodyCodes(message).find((code) => STOP_STATUSES.includes(code));
}

/**
 * A model call the provider answered with a stopping status (card X20): the
 * run stops, the call is never recorded in a cassette and never a
 * per-session exclusion, and the outer session retry does not retry it;
 * RESUME=1 runs the session once the key, the credit or the endpoint is
 * fixed.
 */
export class ProviderStopError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    const what =
      status === 404
        ? "the model or its pinned endpoint is not served"
        : "a key or credit problem, the operator's to fix";
    super(
      `the provider answered a model call with HTTP ${status}, ${what}; the run stops with this session unrecorded: fix it, then rerun with RESUME=1 (${message})`,
    );
    this.name = "ProviderStopError";
    this.status = status;
  }
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
  /** Told of each reply that is retried (not the last), so its usage reaches the ledger (RV1-3). */
  onRetried?: (reply: AssistantMessage) => void,
): Promise<{ reply: AssistantMessage; attempts: number }> {
  for (let attempt = 1; ; attempt++) {
    const reply = await once();
    const retry =
      reply.stopReason === "error" &&
      attempt < policy.attempts &&
      isTransient(reply.errorMessage, policy);
    if (!retry) return { reply, attempts: attempt };
    onRetried?.(reply);
    await sleep(policy.delayMs(attempt - 1));
  }
}

/** A failed attempt's usage as a ledger record: paid, and never a cassette (card RV1, review RV1-3). */
export function attemptUsage(key: string, model: string, reply: AssistantMessage): UsageRecord {
  return {
    key,
    model,
    hit: false,
    input_tokens: reply.usage.input,
    output_tokens: reply.usage.output,
    cost_usd: reply.usage.cost.total,
  };
}

/**
 * The outer session retry of a live run (card RV1, review RV1-6): a session
 * that stopped on a TransientCallError (its call's own retry exhausted) is run
 * again from the start after these waits, its recorded calls replayed from
 * the cassettes, so it is out of every cache key. Six runs of the session in
 * all, waiting 30 s, 1, 2, 4 and 5 minutes: an outage of about 12 minutes
 * is waited out. Neither upstream client honours Retry-After, nor does this.
 */
export const SESSION_RETRY: RetryPolicy = {
  attempts: 6,
  statuses: [],
  delayMs: (i) => Math.min(30 * 2 ** i, 300) * 1000,
};

/** `session` run until it does not stop on a TransientCallError, at most `policy.attempts` times. */
export async function retrySession<T>(
  session: () => Promise<T>,
  policy: RetryPolicy | undefined,
  sleep: Sleep,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await session();
    } catch (e) {
      if (!(e instanceof TransientCallError) || !policy || attempt >= policy.attempts) throw e;
      await sleep(policy.delayMs(attempt - 1));
    }
  }
}
