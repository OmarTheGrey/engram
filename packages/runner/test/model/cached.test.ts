// Acceptance for step-0 task S0.10 (ADR 0017): a second identical call makes
// zero underlying calls, offline mode refuses a miss, and usage is recorded.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModelCall, ModelRequest } from "@engram/core";
import { describe, expect, test } from "vitest";
import { cached, fileCache, memoryCache, OfflineMissError } from "../../src/model/cached.ts";

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

  test("records usage and cost per call, with hits counted apart from misses", async () => {
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
      expect.objectContaining({ hit: true, input_tokens: 12, output_tokens: 3, cost_usd: 0.0002 }),
    ]);
  });

  test("a file cache survives a new process: entries are cassettes on disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "engram-cassettes-"));
    await cached(counting(), { cache: fileCache(dir), context, offline: false })(request);
    const inner = counting();
    await cached(inner, { cache: fileCache(dir), context, offline: true })(request);
    expect(inner.calls).toBe(0);
  });
});
