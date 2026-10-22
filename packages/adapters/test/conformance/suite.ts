// The Adapter conformance suite (ADR 0013, testing layer 4). Every adapter
// calls `conformance(name, factory)` from its own test file; the contract is
// the same for every store, and a failing case is never marked
// adapter-specific (AGENTS.md, "What not to do").
//
//   import { conformance } from "../conformance/suite.ts";
//   conformance("mem0", () => createMem0Adapter(config));
//
// Optional methods (search, history) are tested when the adapter has them; a
// capability flag that claims native search or history requires the method.
import type { MemoryItem } from "@engram/core";
import { beforeEach, describe, expect, test } from "vitest";
import type { Adapter } from "../../src/contract.ts";

const BASE: Extract<MemoryItem, { class: "episodic" | "semantic" }> = {
  id: "01920000-0000-7000-8000-000000000001",
  class: "semantic",
  scope: "team:platform",
  owner: "person:omar",
  content: "Deploys happen on Tuesdays.",
  provenance: {
    kind: "user",
    ref: "doc/1",
    hash: `sha256:${"ab".repeat(32)}`,
    actor: "person:omar",
  },
  confidence: 0.9,
  valid_from: "2026-10-22T09:00:00Z",
  valid_to: null,
  ttl: null,
  grants: [],
  version: 1,
  lineage: [],
  status: "active",
  store_ref: null,
  schema_version: 0,
};

const item = (n: number, patch: Partial<MemoryItem> = {}): MemoryItem =>
  ({
    ...BASE,
    id: `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`,
    ...patch,
  }) as MemoryItem;

/** A small corpus for scope filtering and recall. */
const CORPUS: MemoryItem[] = [
  item(1, { scope: "team:platform", content: "Deploys happen on Tuesdays." }),
  item(2, { scope: "team:platform", content: "The deploy key rotates monthly." }),
  item(3, { scope: "person:omar", content: "Omar prefers deploy notes in Arabic." }),
  item(4, { scope: "org", content: "The office closes at six." }),
  item(5, {
    scope: "team:research",
    class: "procedural",
    content: { body: "Run the deploy checklist.", tools: ["bash"] },
  }),
];

export function conformance(name: string, factory: () => Adapter | Promise<Adapter>): void {
  describe(`adapter conformance: ${name}`, () => {
    let adapter: Adapter;
    beforeEach(async () => {
      adapter = await factory();
    });

    describe("write and read", () => {
      test("read returns what was written, with the store_ref the write returned", async () => {
        const ref = await adapter.write(BASE);
        expect(await adapter.read(ref)).toEqual({ ...BASE, store_ref: ref });
      });

      test("write is idempotent per item id: same ref, one item", async () => {
        const first = await adapter.write(BASE);
        const second = await adapter.write(BASE);
        expect(second).toEqual(first);
        expect(await adapter.list(BASE.scope)).toHaveLength(1);
      });

      test("a later write under the same id replaces the content read back", async () => {
        const ref = await adapter.write(BASE);
        await adapter.write({ ...BASE, version: 2, content: "Deploys moved to Wednesdays." });
        expect(await adapter.read(ref)).toMatchObject({
          version: 2,
          content: "Deploys moved to Wednesdays.",
        });
      });

      test("procedural content round-trips", async () => {
        const procedure = CORPUS[4] as MemoryItem;
        const ref = await adapter.write(procedure);
        expect(await adapter.read(ref)).toEqual({ ...procedure, store_ref: ref });
      });
    });

    describe("store_ref opacity", () => {
      test("a ref names this adapter and survives JSON serialisation", async () => {
        const ref = await adapter.write(BASE);
        expect(ref.adapter).toBe(adapter.name);
        expect(await adapter.read(JSON.parse(JSON.stringify(ref)))).toEqual({
          ...BASE,
          store_ref: ref,
        });
      });

      test("a ref from another adapter is refused", async () => {
        const ref = await adapter.write(BASE);
        await expect(adapter.read({ ...ref, adapter: `${adapter.name}-other` })).rejects.toThrow();
      });
    });

    describe("delete", () => {
      test("a deleted item is gone from read and list", async () => {
        const ref = await adapter.write(BASE);
        await adapter.delete(ref);
        expect(await adapter.read(ref)).toBeUndefined();
        expect(await adapter.list(BASE.scope)).toEqual([]);
      });

      test("deleting twice is not an error", async () => {
        const ref = await adapter.write(BASE);
        await adapter.delete(ref);
        await expect(adapter.delete(ref)).resolves.toBeUndefined();
      });
    });

    describe("list", () => {
      test("returns exactly the items in one scope", async () => {
        for (const i of CORPUS) await adapter.write(i);
        const ids = (await adapter.list("team:platform")).map((i) => i.id).sort();
        expect(ids).toEqual([CORPUS[0]?.id, CORPUS[1]?.id].sort());
      });
    });

    describe("search (when supported)", () => {
      test("a capability claiming native search has a search method", () => {
        if (adapter.capabilities.native_search) expect(adapter.search).toBeTypeOf("function");
      });

      test("never returns an item outside the scope filter", async ({ skip }) => {
        if (!adapter.search) return skip("no search");
        for (const i of CORPUS) await adapter.write(i);
        const hits = await adapter.search("deploy", ["team:platform"]);
        for (const hit of hits) expect(hit.scope).toBe("team:platform");
      });

      test("an empty scope filter returns nothing, never everything", async ({ skip }) => {
        if (!adapter.search) return skip("no search");
        for (const i of CORPUS) await adapter.write(i);
        expect(await adapter.search("deploy", [])).toEqual([]);
      });

      test("finds an item by a unique exact phrase inside the filter", async ({ skip }) => {
        if (!adapter.search) return skip("no search");
        for (const i of CORPUS) await adapter.write(i);
        const hits = await adapter.search("deploy key rotates monthly", ["team:platform"]);
        expect(hits.map((h) => h.id)).toContain(CORPUS[1]?.id);
      });

      test("does not return deleted items", async ({ skip }) => {
        if (!adapter.search) return skip("no search");
        const ref = await adapter.write(CORPUS[0] as MemoryItem);
        await adapter.delete(ref);
        expect(await adapter.search("deploy", ["team:platform"])).toEqual([]);
      });
    });

    describe("history (when supported)", () => {
      test("a capability claiming native history has a history method", () => {
        if (adapter.capabilities.native_history) expect(adapter.history).toBeTypeOf("function");
      });

      test("returns every distinct version written under a ref, oldest first", async ({ skip }) => {
        if (!adapter.history) return skip("no history");
        const ref = await adapter.write(BASE);
        await adapter.write({ ...BASE, version: 2, content: "v2" });
        const versions = await adapter.history(ref);
        expect(versions.map((v) => v.version)).toEqual([1, 2]);
      });

      test("rewriting identical content adds no version", async ({ skip }) => {
        if (!adapter.history) return skip("no history");
        const ref = await adapter.write(BASE);
        await adapter.write(BASE);
        expect(await adapter.history(ref)).toHaveLength(1);
      });
    });
  });
}

/**
 * Full recall on the fixture corpus, for lexical stores only. A semantic store
 * may legitimately rank or miss items, so this is not part of the contract;
 * adapters whose search is exact term matching opt in.
 */
export function lexicalSearchRecall(name: string, factory: () => Adapter | Promise<Adapter>): void {
  test(`lexical search recall: ${name} finds every matching item inside the filter`, async () => {
    const adapter = await factory();
    if (!adapter.search) throw new Error(`${name} has no search`);
    for (const i of CORPUS) await adapter.write(i);
    const hits = await adapter.search("deploy", ["team:platform", "person:omar", "team:research"]);
    expect(hits.map((h) => h.id).sort()).toEqual(
      [CORPUS[0], CORPUS[1], CORPUS[2], CORPUS[4]].map((i) => i?.id).sort(),
    );
  });
}
