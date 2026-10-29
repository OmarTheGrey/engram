// The lock file a store's writers share, across adapter instances and
// processes (card A3's review round 2, V4 defect 3; reused by card A2). The
// files adapter holds `.engram.lock` in its folder; the Letta adapter holds
// `engram.lock` in the repository's git directory. Written once, here, so the
// two stores cannot drift apart on the rules below.
//
// The lock file holds its holder's pid, host name, a per-instance token and
// the wall-clock time it was taken (JSON). The adapters have no injected
// clock; that time is a fact of store I/O, read by other writers, never a
// policy input. A waiting writer breaks the lock when it is stale: its host is
// this machine and its pid is not alive (a crashed writer), or it is older
// than LOCK_STALE_MS. A lock with no readable holder (a writer that stopped
// between creating and filling it) is judged by its file time. Otherwise the
// writer waits up to `waitMs` by the wall clock, then refuses, naming the
// holder. Breaking is serialised through a second file (`<lock>.break`), so
// two waiters never remove each other's fresh lock; a holder removes the lock
// only while it still holds its own token. Tests replace the clock and add
// pause points through `seams` (test seams only; the defaults are the wall
// clock and no-ops).
import { randomUUID } from "node:crypto";
import { lstat, open, readFile, rm } from "node:fs/promises";
import { hostname } from "node:os";
import { codeOf, isMissing, isRecord, sleep } from "./fs-safe.ts";

/**
 * A lock older than this is stale whoever holds it. A live holder keeps the
 * lock for one write or delete: for the files adapter a directory listing, a
 * read of one item file and of MEMORY.md, and two atomic writes whose renames
 * retry at most five times over 300 ms; for the Letta adapter the same plus a
 * `git add` and a `git commit` (tens of milliseconds each, more with slow
 * hooks). That takes well under a second on a local disk, so a minute leaves
 * two orders of magnitude for a live writer, while a writer that crashed on
 * another machine (whose pid this machine cannot check) blocks the store for
 * one minute at most.
 */
export const LOCK_STALE_MS = 60_000;
/** Default wait for a live lock, by the wall clock. */
export const LOCK_WAIT_MS = 10_000;
const BUSY = ["EEXIST", "EPERM", "EACCES", "EBUSY"];

/** Test seams for a store lock, never set in production. */
export interface LockSeams {
  /** Milliseconds since the epoch for lock times and ages. Default `Date.now`. */
  now?: () => number;
  /** Called after a waiter judged the lock text stale and before it tries to break it. */
  beforeBreak?: (lockText: string) => Promise<void>;
  /** Called once this instance holds the lock, before the write or delete runs. */
  afterAcquire?: () => Promise<void>;
}

export interface StoreLockOptions {
  /** The lock file's path. */
  path: string;
  /** How long to wait for a live lock, in ms. */
  waitMs: number;
  /** Starts the refusal message, for example `files adapter`. */
  label: string;
  /** What the lock guards, for the refusal message, for example `folder`. */
  guards: string;
  /** The age after which a lock is stale whoever holds it. Default LOCK_STALE_MS (files adapter). */
  staleMs?: number;
  seams?: LockSeams;
}

/** What a lock file says about its holder. */
interface LockHolder {
  pid: number;
  host: string;
  token: string;
  started: string;
}

const isLockHolder = (v: unknown): v is LockHolder =>
  isRecord(v) &&
  Number.isInteger(v.pid) &&
  typeof v.host === "string" &&
  typeof v.token === "string" &&
  typeof v.started === "string" &&
  !Number.isNaN(Date.parse(v.started));

/** Whether a process with this pid runs on this machine (EPERM: it runs, as another user). */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return codeOf(e) === "EPERM";
  }
}

/** Runs `fn` while holding the lock file; one instance, one token. */
export type StoreLock = <T>(fn: () => Promise<T>) => Promise<T>;

export function createStoreLock(options: StoreLockOptions): StoreLock {
  const { path: lockPath, waitMs } = options;
  const staleMs = options.staleMs ?? LOCK_STALE_MS;
  const breakPath = `${lockPath}.break`;
  const now = options.seams?.now ?? Date.now;
  const beforeBreak = options.seams?.beforeBreak ?? (async () => undefined);
  const afterAcquire = options.seams?.afterAcquire ?? (async () => undefined);
  const token = `${process.pid}-${randomUUID()}`;
  const host = hostname();

  /** The lock file's text, or undefined when it is gone or briefly unreadable. */
  async function readLock(): Promise<string | undefined> {
    try {
      return await readFile(lockPath, "utf8");
    } catch (e) {
      if (isMissing(e) || BUSY.includes(codeOf(e) ?? "")) return undefined;
      throw e;
    }
  }

  /** Whether the lock whose text is `text` is stale, and who holds it, for the refusal. */
  async function judgeLock(text: string): Promise<{ stale: boolean; holder: string }> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    if (isLockHolder(parsed)) {
      const age = now() - Date.parse(parsed.started);
      const stale =
        parsed.token === token || age > staleMs || (parsed.host === host && !isAlive(parsed.pid));
      return {
        stale,
        holder: `pid ${parsed.pid} on ${parsed.host} since ${parsed.started}`,
      };
    }
    // No readable holder: a writer between creating and filling the lock, or one that stopped there.
    try {
      const age = now() - (await lstat(lockPath)).mtimeMs;
      return { stale: age > staleMs, holder: "a writer that has not recorded itself" };
    } catch (e) {
      if (isMissing(e)) return { stale: false, holder: "nobody" };
      throw e;
    }
  }

  /**
   * Removes the stale lock whose text was `text`, unless another writer has
   * replaced it meanwhile. Only one waiter breaks at a time (the break file);
   * a break file left by a crashed waiter is removed once it is stale.
   */
  async function breakLock(text: string): Promise<boolean> {
    try {
      await (await open(breakPath, "wx")).close();
    } catch (e) {
      if (!BUSY.includes(codeOf(e) ?? "")) throw e;
      const info = await lstat(breakPath).catch(() => undefined);
      if (info && now() - info.mtimeMs > staleMs) await rm(breakPath, { force: true });
      return false;
    }
    try {
      if ((await readLock()) !== text) return false;
      await rm(lockPath, { force: true });
      return true;
    } finally {
      await rm(breakPath, { force: true, maxRetries: 10, retryDelay: 10 });
    }
  }

  /** Creates the lock with this writer's record; false when another writer holds it. */
  async function tryLock(): Promise<boolean> {
    let handle: Awaited<ReturnType<typeof open>>;
    try {
      handle = await open(lockPath, "wx");
    } catch (e) {
      // EEXIST: another writer holds it. EPERM, EACCES, EBUSY: on Windows, a
      // lock being deleted by its holder.
      if (BUSY.includes(codeOf(e) ?? "")) return false;
      throw e;
    }
    const holder: LockHolder = {
      pid: process.pid,
      host,
      token,
      started: new Date(now()).toISOString(),
    };
    try {
      await handle.writeFile(JSON.stringify(holder), "utf8");
    } catch (e) {
      await handle.close();
      await rm(lockPath, { force: true });
      throw e;
    }
    await handle.close();
    return true;
  }

  function holderToken(text: string | undefined): string | undefined {
    try {
      const parsed: unknown = text === undefined ? undefined : JSON.parse(text);
      return isLockHolder(parsed) ? parsed.token : undefined;
    } catch {
      return undefined;
    }
  }

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    const deadline = now() + waitMs;
    for (let attempt = 0; !(await tryLock()); attempt++) {
      const text = await readLock();
      const judged = text === undefined ? undefined : await judgeLock(text);
      if (text !== undefined && judged?.stale) {
        await beforeBreak(text);
        if (await breakLock(text)) continue;
      }
      if (now() >= deadline) {
        throw new Error(
          `${options.label}: ${lockPath} is held by ${judged?.holder ?? "another writer"}; another Engram writer is using this ${options.guards} (a lock older than ${staleMs / 1000} s, or one from a pid no longer running on this machine, is broken automatically)`,
        );
      }
      await sleep(Math.min(2 + attempt, 25));
    }
    try {
      await afterAcquire();
      return await fn();
    } finally {
      // Never remove a lock another writer took after breaking ours as stale.
      if (holderToken(await readLock()) === token) {
        await rm(lockPath, { force: true, maxRetries: 10, retryDelay: 10 });
      }
    }
  };
}
