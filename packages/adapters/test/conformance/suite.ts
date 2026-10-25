// The Adapter conformance suite (ADR 0013, testing layer 4). Every adapter is
// one entry in `registry.ts`, and `conformance.test.ts` runs
// `conformance(name, factory)` over each entry; the contract is the same for
// every store, and a failing case is never marked adapter-specific (AGENTS.md,
// "What not to do"). The corpus is the committed fixture
// fixtures/stores/conformance-corpus.json.
//
// Optional methods (search, history) are tested when the adapter has them; a
// capability flag that claims native search or history requires the method.
import { readFileSync } from "node:fs";
import { MemoryItem } from "@engram/core";
import { beforeEach, describe, expect, test } from "vitest";
import type { Adapter } from "../../src/contract.ts";

/**
 * The fixture corpus (fixtures/stores/conformance-corpus.json): a base item,
 * the items written for scope filtering and recall (each a patch over the
 * base), and the search cases with their expected ids. Synthetic content only.
 */
interface Corpus {
  base: unknown;
  items: Record<string, unknown>[];
  cases: {
    list_scope: { scope: string; expected_ids: string[] };
    scope_filter: { query: string; scopes: string[] };
    unique_phrase: { query: string; scopes: string[]; expected_id: string };
    lexical_recall: { query: string; scopes: string[]; expected_ids: string[] };
  };
}

const CORPUS_PATH = new URL("../../../../fixtures/stores/conformance-corpus.json", import.meta.url);
const RAW = JSON.parse(readFileSync(CORPUS_PATH, "utf8")) as Corpus;

/** Every fixture item is parsed by the core schema, so the corpus cannot drift from it. */
const BASE = MemoryItem.parse(RAW.base) as Extract<MemoryItem, { class: "episodic" | "semantic" }>;
const CORPUS: MemoryItem[] = RAW.items.map((patch) =>
  MemoryItem.parse({ ...(RAW.base as object), ...patch }),
);
const CASES = RAW.cases;

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
        const ids = (await adapter.list(CASES.list_scope.scope)).map((i) => i.id).sort();
        expect(ids).toEqual([...CASES.list_scope.expected_ids].sort());
      });
    });

    describe("search (when supported)", () => {
      test("a capability claiming native search has a search method", () => {
        if (adapter.capabilities.native_search) expect(adapter.search).toBeTypeOf("function");
      });

      test("never returns an item outside the scope filter", async ({ skip }) => {
        if (!adapter.search) return skip("no search");
        for (const i of CORPUS) await adapter.write(i);
        const { query, scopes } = CASES.scope_filter;
        const hits = await adapter.search(query, scopes);
        for (const hit of hits) expect(scopes).toContain(hit.scope);
      });

      test("an empty scope filter returns nothing, never everything", async ({ skip }) => {
        if (!adapter.search) return skip("no search");
        for (const i of CORPUS) await adapter.write(i);
        expect(await adapter.search(CASES.scope_filter.query, [])).toEqual([]);
      });

      test("finds an item by a unique exact phrase inside the filter", async ({ skip }) => {
        if (!adapter.search) return skip("no search");
        for (const i of CORPUS) await adapter.write(i);
        const { query, scopes, expected_id } = CASES.unique_phrase;
        const hits = await adapter.search(query, scopes);
        expect(hits.map((h) => h.id)).toContain(expected_id);
      });

      test("does not return deleted items", async ({ skip }) => {
        if (!adapter.search) return skip("no search");
        const ref = await adapter.write(CORPUS[0] as MemoryItem);
        await adapter.delete(ref);
        expect(await adapter.search(CASES.scope_filter.query, CASES.scope_filter.scopes)).toEqual(
          [],
        );
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
    const { query, scopes, expected_ids } = CASES.lexical_recall;
    const hits = await adapter.search(query, scopes);
    expect(hits.map((h) => h.id).sort()).toEqual([...expected_ids].sort());
  });
}
