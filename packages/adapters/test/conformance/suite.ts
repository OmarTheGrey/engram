// The Adapter conformance suite (ADR 0013, testing layer 4). Every adapter is
// one entry in `registry.ts`, and `conformance.test.ts` runs
// `conformance(name, factory)` over each entry; the contract is the same for
// every store, and a failing case is never marked adapter-specific (AGENTS.md,
// "What not to do"). The corpus is the committed fixture
// fixtures/stores/conformance-corpus.json.
//
// The cases are plain data (`CASES`), so `meta.test.ts` can run them on
// deliberately broken adapters and require each to fail the cases it names.
//
// Every item an adapter returns, from read, list, search or history, is
// compared whole with what was written (plus the store_ref the write
// returned): a store that drops, nulls, truncates or re-encodes any field
// fails. Optional methods (search, history) are tested when the adapter has
// them; a capability flag that claims native search or history requires the
// method.
import { readFileSync } from "node:fs";
import { MemoryItem } from "@engram/core";
import { beforeEach, describe, expect, test } from "vitest";
import type { Adapter, StoreRef } from "../../src/contract.ts";

/**
 * The fixture corpus (fixtures/stores/conformance-corpus.json): a base item,
 * the items written for round trips, scope filtering and recall (each a patch
 * over the base), and the search cases with their expected ids. Synthetic
 * content only.
 */
interface Corpus {
  base: unknown;
  items: Record<string, unknown>[];
  cases: {
    list_scope: { scope: string; expected_ids: string[] };
    scope_filter: { query: string; scopes: string[] };
    unique_phrase: { query: string; scopes: string[]; expected_id: string };
    non_active: { query: string; scopes: string[]; expected_id: string }[];
    lexical_recall: { query: string; scopes: string[]; expected_ids: string[] };
  };
}

const CORPUS_PATH = new URL("../../../../fixtures/stores/conformance-corpus.json", import.meta.url);
const RAW = JSON.parse(readFileSync(CORPUS_PATH, "utf8")) as Corpus;

/** A corpus patch as an item: `label` and `content_repeat` are fixture keys, not item fields. */
function fixtureItem(patch: Record<string, unknown>): { label: string; item: MemoryItem } {
  const { label, content_repeat: repeat, ...fields } = patch;
  const content = isRepeat(repeat) ? repeat.text.repeat(repeat.times) : undefined;
  const item = MemoryItem.parse({
    ...(RAW.base as object),
    ...fields,
    ...(content === undefined ? {} : { content }),
  });
  return { label: String(label), item };
}
const isRepeat = (v: unknown): v is { text: string; times: number } =>
  typeof v === "object" && v !== null && "text" in v && "times" in v;

/** Every fixture item is parsed by the core schema, so the corpus cannot drift from it. */
const BASE = MemoryItem.parse(RAW.base) as Extract<MemoryItem, { class: "episodic" | "semantic" }>;
const LABELLED = RAW.items.map(fixtureItem);
const CORPUS: MemoryItem[] = LABELLED.map((l) => l.item);
const CASES_DATA = RAW.cases;
const SCOPES = [...new Set(CORPUS.map((i) => i.scope))].sort();

const stored = (item: MemoryItem, ref: StoreRef): MemoryItem => ({ ...item, store_ref: ref });
const byId = (a: MemoryItem, b: MemoryItem) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Writes the whole corpus and returns each item as the adapter must give it back, by id. */
async function writeCorpus(adapter: Adapter): Promise<Map<string, MemoryItem>> {
  const written = new Map<string, MemoryItem>();
  for (const item of CORPUS) written.set(item.id, stored(item, await adapter.write(item)));
  return written;
}

/** Every hit must be exactly an item the corpus wrote, store_ref included. */
function expectWritten(hits: MemoryItem[], written: Map<string, MemoryItem>) {
  for (const hit of hits) expect(hit).toEqual(written.get(hit.id));
}

/** A call on a foreign ref must reject, never throw before returning a promise. */
async function expectRejected(call: () => Promise<unknown>) {
  let pending: Promise<unknown> | undefined;
  expect(() => {
    pending = call();
  }).not.toThrow();
  await expect(pending).rejects.toThrow();
}

const foreign = (adapter: Adapter, ref: StoreRef): StoreRef => ({
  ...ref,
  adapter: `${adapter.name}-other`,
});

export type Factory = () => Adapter | Promise<Adapter>;

/** One conformance case: a group, a name, the optional method it needs, and its body. */
export interface ConformanceCase {
  group: string;
  name: string;
  needs?: "search" | "history";
  run(adapter: Adapter): Promise<void> | void;
}

export const CASES: ConformanceCase[] = [
  ...LABELLED.map(
    ({ label, item }): ConformanceCase => ({
      group: "write and read",
      name: `round-trips every field of ${label}`,
      async run(adapter) {
        const ref = await adapter.write(item);
        expect(await adapter.read(ref)).toEqual(stored(item, ref));
      },
    }),
  ),
  {
    group: "write and read",
    name: "write is idempotent per item id: same ref, one item",
    async run(adapter) {
      const first = await adapter.write(BASE);
      const second = await adapter.write(BASE);
      expect(second).toEqual(first);
      expect(await adapter.list(BASE.scope)).toEqual([stored(BASE, first)]);
    },
  },
  {
    group: "write and read",
    name: "concurrent writes of one item id leave one item under one ref",
    async run(adapter) {
      const refs = await Promise.all([1, 2, 3, 4].map(() => adapter.write(BASE)));
      for (const ref of refs) expect(ref).toEqual(refs[0]);
      expect(await adapter.list(BASE.scope)).toEqual([stored(BASE, refs[0] as StoreRef)]);
    },
  },
  {
    group: "write and read",
    name: "concurrent writes of different ids each keep their own item",
    async run(adapter) {
      const refs = await Promise.all(CORPUS.map((i) => adapter.write(i)));
      for (const [n, item] of CORPUS.entries()) {
        const ref = refs[n] as StoreRef;
        expect(await adapter.read(ref)).toEqual(stored(item, ref));
      }
    },
  },
  {
    group: "write and read",
    name: "a later write under the same id replaces the whole item read back",
    async run(adapter) {
      const ref = await adapter.write(BASE);
      const next: MemoryItem = {
        ...BASE,
        version: 2,
        content: "Deploys moved to Wednesdays.",
        confidence: 0.7,
        grants: [],
        valid_to: null,
        ttl: null,
      };
      expect(await adapter.write(next)).toEqual(ref);
      expect(await adapter.read(ref)).toEqual(stored(next, ref));
      expect(await adapter.list(BASE.scope)).toEqual([stored(next, ref)]);
    },
  },
  {
    group: "write and read",
    name: "a rewrite that changes only the status is stored",
    async run(adapter) {
      const ref = await adapter.write(BASE);
      const retired: MemoryItem = { ...BASE, status: "retired" };
      await adapter.write(retired);
      expect(await adapter.read(ref)).toEqual(stored(retired, ref));
      expect(await adapter.list(BASE.scope)).toEqual([stored(retired, ref)]);
    },
  },
  {
    group: "write and read",
    name: "two item ids are two items under two refs",
    async run(adapter) {
      const [a, b] = CORPUS as [MemoryItem, MemoryItem];
      const refA = await adapter.write(a);
      const refB = await adapter.write(b);
      expect(refB).not.toEqual(refA);
      expect(await adapter.read(refA)).toEqual(stored(a, refA));
      expect(await adapter.read(refB)).toEqual(stored(b, refB));
    },
  },
  {
    group: "store_ref opacity",
    name: "a ref names this adapter and survives JSON serialisation",
    async run(adapter) {
      const ref = await adapter.write(BASE);
      expect(ref.adapter).toBe(adapter.name);
      expect(await adapter.read(JSON.parse(JSON.stringify(ref)))).toEqual(stored(BASE, ref));
    },
  },
  {
    group: "store_ref opacity",
    name: "read refuses a ref from another adapter with a rejected promise",
    async run(adapter) {
      const ref = await adapter.write(BASE);
      await expectRejected(() => adapter.read(foreign(adapter, ref)));
    },
  },
  {
    group: "store_ref opacity",
    name: "delete refuses a ref from another adapter and deletes nothing",
    async run(adapter) {
      const ref = await adapter.write(BASE);
      await expectRejected(() => adapter.delete(foreign(adapter, ref)));
      expect(await adapter.read(ref)).toEqual(stored(BASE, ref));
    },
  },
  {
    group: "store_ref opacity",
    name: "history refuses a ref from another adapter with a rejected promise",
    needs: "history",
    async run(adapter) {
      const ref = await adapter.write(BASE);
      const history = adapter.history as NonNullable<Adapter["history"]>;
      await expectRejected(() => history.call(adapter, foreign(adapter, ref)));
    },
  },
  {
    group: "delete",
    name: "a deleted item is gone from read and list, and its neighbour stays",
    async run(adapter) {
      const written = await writeCorpus(adapter);
      const gone = written.get(BASE.id) as MemoryItem;
      await adapter.delete(gone.store_ref as StoreRef);
      expect(await adapter.read(gone.store_ref as StoreRef)).toBeUndefined();
      const left = [...written.values()].filter((i) => i.scope === BASE.scope && i.id !== BASE.id);
      expect((await adapter.list(BASE.scope)).sort(byId)).toEqual(left.sort(byId));
    },
  },
  {
    group: "delete",
    name: "deleting twice is not an error",
    async run(adapter) {
      const ref = await adapter.write(BASE);
      await adapter.delete(ref);
      await expect(adapter.delete(ref)).resolves.toBeUndefined();
    },
  },
  {
    group: "list",
    name: "returns exactly the items in one scope",
    async run(adapter) {
      for (const i of CORPUS) await adapter.write(i);
      const ids = (await adapter.list(CASES_DATA.list_scope.scope)).map((i) => i.id).sort();
      expect(ids).toEqual([...CASES_DATA.list_scope.expected_ids].sort());
    },
  },
  {
    group: "list",
    name: "every scope lists exactly its own items, every field intact",
    async run(adapter) {
      const written = await writeCorpus(adapter);
      for (const scope of SCOPES) {
        const expected = [...written.values()].filter((i) => i.scope === scope).sort(byId);
        expect((await adapter.list(scope)).sort(byId)).toEqual(expected);
      }
    },
  },
  {
    group: "list",
    name: "a prefix of a scope name lists nothing",
    async run(adapter) {
      await writeCorpus(adapter);
      expect(await adapter.list("team:plat")).toEqual([]);
      expect(await adapter.list("team:")).toEqual([]);
    },
  },
  {
    group: "search (when supported)",
    name: "a capability claiming native search has a search method",
    run(adapter) {
      if (adapter.capabilities.native_search) expect(adapter.search).toBeTypeOf("function");
    },
  },
  {
    group: "search (when supported)",
    name: "never returns an item outside the scope filter, and every hit is the written item",
    needs: "search",
    async run(adapter) {
      const written = await writeCorpus(adapter);
      const { query, scopes } = CASES_DATA.scope_filter;
      const hits = (await adapter.search?.(query, scopes)) ?? [];
      for (const hit of hits) expect(scopes).toContain(hit.scope);
      expectWritten(hits, written);
    },
  },
  {
    group: "search (when supported)",
    name: "an empty scope filter returns nothing, never everything",
    needs: "search",
    async run(adapter) {
      await writeCorpus(adapter);
      expect(await adapter.search?.(CASES_DATA.scope_filter.query, [])).toEqual([]);
    },
  },
  {
    group: "search (when supported)",
    name: "finds an item by a unique exact phrase inside the filter, every field intact",
    needs: "search",
    async run(adapter) {
      const written = await writeCorpus(adapter);
      const { query, scopes, expected_id } = CASES_DATA.unique_phrase;
      const hits = (await adapter.search?.(query, scopes)) ?? [];
      expect(hits.map((h) => h.id)).toContain(expected_id);
      expectWritten(hits, written);
    },
  },
  {
    // Search is the store's recall; status is the plane's read filter, so a
    // store that drops candidate or retired items hides them from the plane.
    group: "search (when supported)",
    name: "finds a candidate and a retired item, whatever their status",
    needs: "search",
    async run(adapter) {
      const written = await writeCorpus(adapter);
      for (const { query, scopes, expected_id } of CASES_DATA.non_active) {
        expect(written.get(expected_id)?.status).not.toBe("active");
        const hits = (await adapter.search?.(query, scopes)) ?? [];
        expect(hits.map((h) => h.id)).toContain(expected_id);
        expectWritten(hits, written);
      }
    },
  },
  {
    group: "search (when supported)",
    name: "does not return deleted items",
    needs: "search",
    async run(adapter) {
      const ref = await adapter.write(CORPUS[0] as MemoryItem);
      await adapter.delete(ref);
      expect(
        await adapter.search?.(CASES_DATA.scope_filter.query, CASES_DATA.scope_filter.scopes),
      ).toEqual([]);
    },
  },
  {
    group: "history (when supported)",
    name: "a capability claiming native history has a history method",
    run(adapter) {
      if (adapter.capabilities.native_history) expect(adapter.history).toBeTypeOf("function");
    },
  },
  {
    group: "history (when supported)",
    name: "returns every distinct version written under a ref, oldest first, whole",
    needs: "history",
    async run(adapter) {
      const ref = await adapter.write(BASE);
      const next: MemoryItem = { ...BASE, version: 2, content: "v2" };
      await adapter.write(next);
      expect(await adapter.history?.(ref)).toEqual([stored(BASE, ref), stored(next, ref)]);
    },
  },
  {
    group: "history (when supported)",
    name: "rewriting identical content adds no version",
    needs: "history",
    async run(adapter) {
      const ref = await adapter.write(BASE);
      await adapter.write(BASE);
      expect(await adapter.history?.(ref)).toHaveLength(1);
    },
  },
];

/**
 * Full recall on the fixture corpus, for lexical stores only. A semantic store
 * may legitimately rank or miss items, so this is not part of the contract;
 * adapters whose search is exact term matching opt in.
 */
export const LEXICAL_CASES: ConformanceCase[] = [
  {
    group: "lexical search recall",
    name: "finds every matching item inside the filter, every field intact",
    needs: "search",
    async run(adapter) {
      const written = await writeCorpus(adapter);
      const { query, scopes, expected_ids } = CASES_DATA.lexical_recall;
      const hits = (await adapter.search?.(query, scopes)) ?? [];
      expect(hits.map((h) => h.id).sort()).toEqual([...expected_ids].sort());
      expectWritten(hits, written);
    },
  },
];

const lacks = (adapter: Adapter, c: ConformanceCase) =>
  c.needs !== undefined && typeof adapter[c.needs] !== "function";

export function conformance(name: string, factory: Factory): void {
  describe(`adapter conformance: ${name}`, () => {
    let adapter: Adapter;
    beforeEach(async () => {
      adapter = await factory();
    });
    const groups = [...new Set(CASES.map((c) => c.group))];
    for (const group of groups) {
      describe(group, () => {
        for (const c of CASES.filter((x) => x.group === group)) {
          test(c.name, async ({ skip }) => {
            if (lacks(adapter, c)) return skip(`no ${c.needs}`);
            await c.run(adapter);
          });
        }
      });
    }
  });
}

export function lexicalSearchRecall(name: string, factory: Factory): void {
  for (const c of LEXICAL_CASES) {
    test(`lexical search recall: ${name} ${c.name}`, async () => {
      const adapter = await factory();
      if (lacks(adapter, c)) throw new Error(`${name} has no ${c.needs}`);
      await c.run(adapter);
    });
  }
}

export interface CaseOutcome {
  case: string;
  outcome: "pass" | "fail" | "skip";
  error?: string;
}

/**
 * Runs every case outside vitest's test registry, each on a fresh adapter, and
 * reports the outcome of each. Used by the meta-test on broken adapters.
 */
export async function runCases(
  factory: Factory,
  options: { lexical?: boolean } = {},
): Promise<CaseOutcome[]> {
  const outcomes: CaseOutcome[] = [];
  for (const c of [...CASES, ...(options.lexical ? LEXICAL_CASES : [])]) {
    const label = `${c.group}: ${c.name}`;
    const adapter = await factory();
    if (lacks(adapter, c)) {
      outcomes.push({ case: label, outcome: "skip" });
      continue;
    }
    try {
      await c.run(adapter);
      outcomes.push({ case: label, outcome: "pass" });
    } catch (e) {
      outcomes.push({ case: label, outcome: "fail", error: (e as Error).message.split("\n")[0] });
    }
  }
  return outcomes;
}
