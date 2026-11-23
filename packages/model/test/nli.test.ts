// Card L7: the NLI scorer's cache (AGENTS.md rules 6 and 7), its cassettes,
// the scripted scorer, and the fetch of the pinned model by sha256. No test
// loads the runtime or reaches the network: the fetch is given a fake fetch.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, type NliRequest, sha256 } from "@engram/core";
import { afterEach, describe, expect, test } from "vitest";
import {
  cachedNli,
  fetchNliModel,
  memoryNliCache,
  NLI_MODEL,
  NLI_RUNTIME,
  NLI_SCORER_VERSION,
  NliMissError,
  nliCacheKey,
  nliCacheKeyOf,
  nliFileCache,
  nliKeyParts,
  nliPairHash,
  scriptedNliScore,
  softmax,
  truncatePair,
  verifyNliModel,
} from "../src/nli.ts";

const SCRIPTED = "scripted/nli-1";
const ask = (premise: string, hypothesis: string, model: string = NLI_MODEL.id): NliRequest => ({
  model,
  premise,
  hypothesis,
});

/**
 * Runs `fn` with ENGRAM_OFFLINE set to `value` (unset when undefined), then
 * restores it. CI sets ENGRAM_OFFLINE=1; a test of the fetch or recording path
 * with a fake fetch or a scripted scorer clears it, and a test of the guard
 * sets it (review of card L7, the offline failure).
 */
async function withOffline<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const before = process.env.ENGRAM_OFFLINE;
  if (value === undefined) delete process.env.ENGRAM_OFFLINE;
  else process.env.ENGRAM_OFFLINE = value;
  try {
    return await fn();
  } finally {
    if (before === undefined) delete process.env.ENGRAM_OFFLINE;
    else process.env.ENGRAM_OFFLINE = before;
  }
}

const dirs: string[] = [];
const temp = () => {
  const d = mkdtempSync(join(tmpdir(), "engram-nli-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("nliCacheKey", () => {
  test("is the hash of the model's and tokenizer's sha256, the runtime, the scorer and the pair", () => {
    const r = ask("the freeze starts friday", "the freeze starts monday");
    expect(nliCacheKey(r)).toBe(
      sha256(
        canonicalJson({
          model: NLI_MODEL.files["onnx/model.onnx"],
          tokenizer: NLI_MODEL.files["tokenizer.json"],
          runtime: NLI_RUNTIME,
          scorer: NLI_SCORER_VERSION,
          pair: sha256(canonicalJson({ premise: r.premise, hypothesis: r.hypothesis })),
        }),
      ),
    );
    expect(nliPairHash(r)).toBe(
      sha256(canonicalJson({ hypothesis: r.hypothesis, premise: r.premise })),
    );
  });

  test("changes when the tokenizer's hash or the scorer's version changes (review L7-5)", () => {
    const r = ask("a", "b");
    const parts = nliKeyParts(r);
    expect(nliCacheKeyOf(parts)).toBe(nliCacheKey(r));
    expect(nliCacheKeyOf({ ...parts, tokenizer: "0".repeat(64) })).not.toBe(nliCacheKey(r));
    expect(nliCacheKeyOf({ ...parts, scorer: `${NLI_SCORER_VERSION}-next` })).not.toBe(
      nliCacheKey(r),
    );
    expect(nliCacheKeyOf({ ...parts, runtime: "other" })).not.toBe(nliCacheKey(r));
    expect(nliCacheKeyOf({ ...parts, model: "0".repeat(64) })).not.toBe(nliCacheKey(r));
  });

  test("differs by direction, and refuses a model with no pinned hash", () => {
    expect(nliCacheKey(ask("a", "b"))).not.toBe(nliCacheKey(ask("b", "a")));
    expect(() => nliCacheKey(ask("a", "b", "other/model"))).toThrow(/no pinned hash/);
  });
});

describe("cachedNli", () => {
  const scripted = () => {
    let calls = 0;
    const inner = scriptedNliScore(SCRIPTED, (p) => (p === "x" ? [3, 0, 0] : undefined));
    return {
      inner: async (r: NliRequest) => {
        calls++;
        return inner(r);
      },
      calls: () => calls,
    };
  };

  test("a miss is scored once and recorded; the same pair again is a hit", async () => {
    const cache = memoryNliCache();
    const s = scripted();
    const seen: boolean[] = [];
    const score = cachedNli(s.inner, {
      cache,
      offline: false,
      onScore: ({ hit }) => seen.push(hit),
    });
    const first = await score(ask("x", "y", SCRIPTED));
    const again = await score(ask("x", "y", SCRIPTED));
    expect(again).toEqual(first);
    expect(s.calls()).toBe(1);
    expect(seen).toEqual([false, true]);
    expect(first).toEqual({
      contradiction: softmax([3, 0, 0])[0],
      entailment: softmax([3, 0, 0])[1],
      neutral: softmax([3, 0, 0])[2],
    });
    const entry = cache.get(nliCacheKey(ask("x", "y", SCRIPTED)));
    expect(entry?.response.logits).toEqual([3, 0, 0]);
    expect(entry?.runtime).toBe(NLI_RUNTIME);
  });

  test("offline, a miss is an error and nothing is scored", async () => {
    const s = scripted();
    const score = cachedNli(s.inner, { cache: memoryNliCache(), offline: true });
    await expect(score(ask("x", "y", SCRIPTED))).rejects.toBeInstanceOf(NliMissError);
    expect(s.calls()).toBe(0);
  });

  test("ENGRAM_OFFLINE=1 refuses a miss when offline is unset", async () => {
    const s = scripted();
    const score = cachedNli(s.inner, { cache: memoryNliCache() });
    await withOffline("1", () =>
      expect(score(ask("x", "y", SCRIPTED))).rejects.toThrow(/make nli-scores/),
    );
    expect(s.calls()).toBe(0);
    // Unset, the same miss is scored and recorded.
    await withOffline(undefined, () => score(ask("x", "y", SCRIPTED)));
    expect(s.calls()).toBe(1);
  });
});

describe("nliFileCache", () => {
  test("one JSON file per key, read back as written", async () => {
    const dir = temp();
    const score = cachedNli(
      scriptedNliScore(SCRIPTED, () => [0, 1, 2]),
      {
        cache: nliFileCache(dir),
        offline: false,
      },
    );
    const scored = await score(ask("a", "b", SCRIPTED));
    const replay = cachedNli(
      scriptedNliScore(SCRIPTED, () => undefined),
      {
        cache: nliFileCache(dir),
        offline: true,
      },
    );
    await expect(replay(ask("a", "b", SCRIPTED))).resolves.toEqual(scored);
    expect(existsSync(join(dir, `${nliCacheKey(ask("a", "b", SCRIPTED))}.json`))).toBe(true);
  });

  test("a file that does not parse is an error, never a miss", () => {
    const dir = temp();
    writeFileSync(join(dir, "k.json"), "{not json");
    expect(() => nliFileCache(dir).get("k")).toThrow(/corrupt NLI cassette/);
  });
});

describe("scriptedNliScore", () => {
  test("answers as logits, and fails loudly on an unknown pair or another model", async () => {
    const s = scriptedNliScore(SCRIPTED, (p, h) =>
      p === "a" && h === "b" ? [1, 2, 3] : undefined,
    );
    await expect(s(ask("a", "b", SCRIPTED))).resolves.toMatchObject({ logits: [1, 2, 3] });
    await expect(s(ask("b", "a", SCRIPTED))).rejects.toThrow(/no answer/);
    await expect(s(ask("a", "b", "scripted/other"))).rejects.toThrow(/not scripted\/other/);
    expect(() => scriptedNliScore(NLI_MODEL.id, () => undefined)).toThrow(/scripted\/<id>/);
  });
});

describe("softmax and truncatePair", () => {
  test("softmax sums to one and does not overflow", () => {
    const p = softmax([1000, 999, 0]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(p[0]).toBeGreaterThan(p[1] as number);
  });

  test("truncatePair cuts the longer list first, the second on a tie", () => {
    expect(truncatePair([1, 2, 3, 4], [5, 6], 4)).toEqual([
      [1, 2],
      [5, 6],
    ]);
    expect(truncatePair([1, 2, 3], [4, 5, 6], 4)).toEqual([
      [1, 2],
      [4, 5],
    ]);
    expect(truncatePair([1], [2], 4)).toEqual([[1], [2]]);
  });
});

describe("fetchNliModel and verifyNliModel", () => {
  const bytesOf = (file: string) => Buffer.from(`fake ${file}`);
  const fakeFetch = (bad?: string) =>
    (async (url: string | URL | Request) => {
      const file = String(url).split(`${NLI_MODEL.revision}/`)[1] as string;
      return new Response(file === bad ? Buffer.from("tampered") : bytesOf(file));
    }) as typeof fetch;

  test("a file whose sha256 differs from the pin is never kept", async () => {
    const dir = temp();
    await withOffline(undefined, () =>
      expect(fetchNliModel(dir, { fetch: fakeFetch() })).rejects.toThrow(/not the pinned/),
    );
    expect(existsSync(join(dir, "onnx", "model.onnx"))).toBe(false);
  });

  test("fetches from the pinned revision, and is refused offline", async () => {
    const urls: string[] = [];
    const recording = (async (url: string | URL | Request) => {
      urls.push(String(url));
      return new Response("x");
    }) as typeof fetch;
    await withOffline(undefined, () =>
      expect(fetchNliModel(temp(), { fetch: recording })).rejects.toThrow(/not the pinned/),
    );
    expect(urls[0]).toBe(
      `https://huggingface.co/${NLI_MODEL.repository}/resolve/${NLI_MODEL.revision}/onnx/model.onnx`,
    );
    // The guard: offline, nothing is fetched, the fake included.
    await withOffline("1", () =>
      expect(fetchNliModel(temp(), { fetch: recording })).rejects.toThrow(/offline/),
    );
    expect(urls).toHaveLength(1);
  });

  test("verify names a missing file and a file that differs", async () => {
    const dir = temp();
    await expect(verifyNliModel(dir)).rejects.toThrow(/model\.onnx is missing/);
    mkdirSync(join(dir, "onnx"));
    writeFileSync(join(dir, "onnx", "model.onnx"), "not the model");
    const got = createHash("sha256").update("not the model").digest("hex");
    await expect(verifyNliModel(dir)).rejects.toThrow(`has sha256 ${got}, not the pinned`);
  });

  test("the pin names the fp32 ONNX export and the labels in config.json's order", () => {
    expect(NLI_MODEL.id).toBe(`${NLI_MODEL.repository}@${NLI_MODEL.revision}`);
    expect(Object.keys(NLI_MODEL.files)).toContain("onnx/model.onnx");
    expect(NLI_MODEL.labels).toEqual(["contradiction", "entailment", "neutral"]);
  });
});
