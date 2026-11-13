// Acceptance for step-0 task S0.10 (ADR 0017): a second identical call makes
// zero underlying calls, offline mode refuses a miss, and usage is recorded.
// The code under test lives in @engram/model since ADR 0033; this file stays at
// its path because immutable log entries cite it as evidence.
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModelCall, ModelRequest } from "@engram/core";
import { cached, cacheKey, fileCache, memoryCache, OfflineMissError } from "@engram/model";
import { describe, expect, test } from "vitest";

const request: ModelRequest = {
  model: "scripted/scripted-1",
  messages: [{ role: "user", content: "Is the deploy key still valid?" }],
  seed: 1,
  temperature: 0,
};
const context = {
  item: "gatemem/ckpt-0001",
  condition: "enforced",
  preset: "medium",
  store: "files",
};

/** A real ModelCall that counts how often it is reached. */
function counting(): ModelCall & { calls: number } {
  const call = Object.assign(
    async (r: ModelRequest) => {
      call.calls++;
      return {
        text: `answer to ${r.messages.at(-1)?.content}`,
        usage: { input_tokens: 12, output_tokens: 3, cost_usd: 0.0002 },
      };
    },
    { calls: 0 },
  );
  return call;
}

describe("cached", () => {
  test("a second identical call makes zero underlying calls", async () => {
    const inner = counting();
    const call = cached(inner, { cache: memoryCache(), context, offline: false });
    const first = await call(request);
    const second = await call(request);
    expect(inner.calls).toBe(1);
    expect(second).toEqual(first);
  });

  test("a different seed, condition or prompt is a different key", async () => {
    const inner = counting();
    const cache = memoryCache();
    await cached(inner, { cache, context, offline: false })(request);
    await cached(inner, { cache, context, offline: false })({ ...request, seed: 2 });
    await cached(inner, {
      cache,
      context: { ...context, condition: "instruction" },
      offline: false,
    })(request);
    await cached(inner, { cache, context, offline: false })({
      ...request,
      messages: [{ role: "user", content: "Something else" }],
    });
    expect(inner.calls).toBe(4);
  });

  test("offline mode throws on a miss and never reaches the model", async () => {
    const inner = counting();
    const call = cached(inner, { cache: memoryCache(), context, offline: true });
    await expect(call(request)).rejects.toBeInstanceOf(OfflineMissError);
    expect(inner.calls).toBe(0);
  });

  test("offline mode answers a hit from the cache", async () => {
    const cache = memoryCache();
    await cached(counting(), { cache, context, offline: false })(request);
    const inner = counting();
    await expect(cached(inner, { cache, context, offline: true })(request)).resolves.toMatchObject({
      text: "answer to Is the deploy key still valid?",
    });
    expect(inner.calls).toBe(0);
  });

  test("a miss records the call's usage; a hit records zero new usage and keeps the cached usage apart", async () => {
    const usage: unknown[] = [];
    const call = cached(counting(), {
      cache: memoryCache(),
      context,
      offline: false,
      onUsage: (u) => usage.push(u),
    });
    await call(request);
    await call(request);
    expect(usage).toEqual([
      expect.objectContaining({ hit: false, input_tokens: 12, output_tokens: 3, cost_usd: 0.0002 }),
      expect.objectContaining({
        hit: true,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        cached: { input_tokens: 12, output_tokens: 3, cost_usd: 0.0002 },
      }),
    ]);
  });

  test("ENGRAM_OFFLINE is read on every call, not when the wrapper is built", async () => {
    const before = process.env.ENGRAM_OFFLINE;
    delete process.env.ENGRAM_OFFLINE;
    const inner = counting();
    const call = cached(inner, { cache: memoryCache(), context });
    process.env.ENGRAM_OFFLINE = "1";
    try {
      await expect(call(request)).rejects.toBeInstanceOf(OfflineMissError);
      expect(inner.calls).toBe(0);
    } finally {
      if (before === undefined) delete process.env.ENGRAM_OFFLINE;
      else process.env.ENGRAM_OFFLINE = before;
    }
  });

  test("a file cache survives a new process: entries are cassettes on disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "engram-cassettes-"));
    await cached(counting(), { cache: fileCache(dir), context, offline: false })(request);
    const inner = counting();
    await cached(inner, { cache: fileCache(dir), context, offline: true })(request);
    expect(inner.calls).toBe(0);
  });

  test("concurrent identical calls reach the model once", async () => {
    const inner = counting();
    const call = cached(inner, { cache: memoryCache(), context, offline: false });
    const [a, b] = await Promise.all([call(request), call(request)]);
    expect(inner.calls).toBe(1);
    expect(b).toEqual(a);
  });

  test("a corrupt cassette is an error, not a miss that silently pays again", async () => {
    const dir = mkdtempSync(join(tmpdir(), "engram-cassettes-"));
    writeFileSync(join(dir, `${cacheKey(context, request)}.json`), "{ truncated");
    const inner = counting();
    await expect(
      cached(inner, { cache: fileCache(dir), context, offline: false })(request),
    ).rejects.toThrow(/corrupt cassette/);
    expect(inner.calls).toBe(0);
  });

  test("a file cache leaves only complete cassettes behind", async () => {
    const dir = mkdtempSync(join(tmpdir(), "engram-cassettes-"));
    await cached(counting(), { cache: fileCache(dir), context, offline: false })(request);
    expect(readdirSync(dir)).toEqual([`${cacheKey(context, request)}.json`]);
  });
});
