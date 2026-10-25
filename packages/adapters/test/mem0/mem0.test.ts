// Mem0-specific behaviour beyond the shared contract (card A1): the adapter
// runs offline and writes nothing outside its own vector store, its file store
// survives a new adapter instance, and its namespace keeps two adapters on one
// file apart. The contract itself is in ../conformance/.
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryItem } from "@engram/core";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createHashingEmbedder } from "../../src/fake/embedder.ts";
import { createMem0Adapter } from "../../src/mem0/index.ts";

const ITEM = MemoryItem.parse({
  id: "01920000-0000-7000-8000-0000000000a1",
  class: "semantic",
  scope: "team:platform",
  owner: "person:omar",
  content: "The staging cluster restarts at noon.",
  provenance: {
    kind: "user",
    ref: "doc/a1",
    hash: `sha256:${"cd".repeat(32)}`,
    actor: "person:omar",
  },
  confidence: 0.8,
  valid_from: "2026-10-25T09:00:00Z",
  valid_to: null,
  ttl: null,
  grants: [],
  version: 1,
  lineage: [],
  status: "active",
  store_ref: null,
  schema_version: 0,
});

let dir: string;
let mem0Dir: string;
const fetchCalls: string[] = [];
const realFetch = globalThis.fetch;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "engram-mem0-"));
  mem0Dir = join(dir, "mem0-home");
  // Where Mem0 would write its config and telemetry id; it must stay empty.
  process.env.MEM0_DIR = mem0Dir;
  globalThis.fetch = (async (input: string | URL | Request) => {
    fetchCalls.push(String(input instanceof Request ? input.url : input));
    throw new Error("mem0 test: network access refused");
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
  delete process.env.MEM0_DIR;
  // SQLite may still hold the file on Windows; the OS temp dir is cleaned eventually.
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
});

describe("mem0 adapter", () => {
  test("a write, search and delete cycle makes no network call and writes nothing to Mem0's home", async () => {
    const adapter = await createMem0Adapter({ embedder: createHashingEmbedder() });
    const ref = await adapter.write(ITEM);
    expect(await adapter.search?.("staging cluster restarts", [ITEM.scope])).toHaveLength(1);
    await adapter.delete(ref);
    expect(fetchCalls).toEqual([]);
    expect(process.env.MEM0_TELEMETRY).toBe("false");
    expect(() => readdirSync(mem0Dir)).toThrow();
  });

  test("a file vector store keeps items for a new adapter instance on the same file", async () => {
    const dbPath = join(dir, "vectors.db");
    const first = await createMem0Adapter({ embedder: createHashingEmbedder(), dbPath });
    const ref = await first.write(ITEM);
    const second = await createMem0Adapter({ embedder: createHashingEmbedder(), dbPath });
    expect(await second.read(ref)).toEqual({ ...ITEM, store_ref: ref });
    expect(await second.list(ITEM.scope)).toHaveLength(1);
  });

  test("two namespaces on one file do not see each other's items", async () => {
    const dbPath = join(dir, "shared.db");
    const a = await createMem0Adapter({
      embedder: createHashingEmbedder(),
      dbPath,
      namespace: "a",
    });
    const b = await createMem0Adapter({
      embedder: createHashingEmbedder(),
      dbPath,
      namespace: "b",
    });
    const ref = await a.write(ITEM);
    expect(await b.read(ref)).toBeUndefined();
    expect(await b.list(ITEM.scope)).toEqual([]);
    expect(await b.search?.("staging cluster restarts", [ITEM.scope])).toEqual([]);
    await b.delete(ref);
    expect(await a.read(ref)).toEqual({ ...ITEM, store_ref: ref });
  });
});
