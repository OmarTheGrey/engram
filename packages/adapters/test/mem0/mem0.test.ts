// Mem0-specific behaviour beyond the shared contract (card A1): the adapter
// runs offline and writes nothing outside its own vector store, its file store
// survives a new adapter instance, and its namespace keeps two adapters on one
// file apart. The contract itself is in ../conformance/.
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { MemoryItem } from "@engram/core";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createHashingEmbedder } from "../../src/fake/embedder.ts";
import {
  createMem0Adapter,
  createMem0Memory,
  PLACEHOLDER_REACHED,
  REFUSAL,
} from "../../src/mem0/index.ts";

const run = promisify(execFile);

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
  schema_version: 1,
});

let dir: string;
let mem0Dir: string;
const fetchCalls: string[] = [];
const realFetch = globalThis.fetch;

// Loading `mem0ai/oss` costs 2 to 6 s on a loaded machine and happens once per
// file, on the first Mem0 instance; every later instance takes about 0.1 s
// (docs/log/2026-10-25-a1-mem0-test-timeout.md). The hook pays it, under the
// fetch stub and MEM0_DIR like the tests, so no test's 5 s budget includes it.
const MODULE_LOAD_TIMEOUT_MS = 60_000;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "engram-mem0-"));
  mem0Dir = join(dir, "mem0-home");
  // Where Mem0 would write its config and telemetry id; it must stay empty.
  process.env.MEM0_DIR = mem0Dir;
  globalThis.fetch = (async (input: string | URL | Request) => {
    fetchCalls.push(String(input instanceof Request ? input.url : input));
    throw new Error("mem0 test: network access refused");
  }) as typeof fetch;
  await createMem0Memory({ embedder: createHashingEmbedder() });
}, MODULE_LOAD_TIMEOUT_MS);

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
    // The first adapter loads mem0ai, which takes over 5 s when the whole suite runs at once.
  }, 30_000);

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

describe("mem0 adapter, review fixes", () => {
  test.each(["mem0-first", "adapters-first"])(
    "telemetry stays off and Mem0's home stays untouched when %s is imported first",
    async (order) => {
      const home = join(dir, `mem0-home-${order}`);
      const child = fileURLToPath(new URL("./import-order.child.ts", import.meta.url));
      const { stdout } = await run(process.execPath, [child, order], {
        cwd: fileURLToPath(new URL("../..", import.meta.url)),
        env: { ...process.env, MEM0_DIR: home, MEM0_TELEMETRY: "" },
      });
      expect(JSON.parse(stdout)).toEqual({ calls: [], mem0DirCreated: false });
    },
    30_000,
  );

  test("Mem0's model slot refuses with Engram's own error when Mem0 tries to infer", async () => {
    const memory = await createMem0Memory({ embedder: createHashingEmbedder() });
    await expect(
      memory.add("Dana moved to the platform team.", { userId: "engram", infer: true }),
    ).rejects.toThrow(REFUSAL);
  });

  test("the refusal comes from the replaced model slot, not from the placeholder in Mem0's config", async () => {
    expect(REFUSAL).not.toContain(PLACEHOLDER_REACHED);
    const memory = await createMem0Memory({ embedder: createHashingEmbedder() });
    const llm = (memory as unknown as { llm: { generateResponse(m: unknown[]): Promise<unknown> } })
      .llm;
    // The slot itself refuses, with the exact error and no model module loaded.
    await expect(llm.generateResponse([{ role: "user", content: "hi" }])).rejects.toThrow(
      new Error(REFUSAL),
    );
  });

  test("a file vector store keeps its entity index beside it, as <name>_entities.db", async () => {
    const sub = join(dir, "entities");
    mkdirSync(sub);
    const adapter = await createMem0Adapter({
      embedder: createHashingEmbedder(),
      dbPath: join(sub, "vectors.db"),
    });
    const ref = await adapter.write(ITEM);
    await adapter.search?.("staging cluster restarts", [ITEM.scope]);
    await adapter.delete(ref);
    expect(readdirSync(sub).sort()).toEqual(["vectors.db", "vectors_entities.db"]);
  });

  test("a dbPath that is neither :memory: nor a .db file is refused", async () => {
    await expect(
      createMem0Adapter({ embedder: createHashingEmbedder(), dbPath: join(dir, "vectors.sqlite") }),
    ).rejects.toThrow(/dbPath/);
  });
});
