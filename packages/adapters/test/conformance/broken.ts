// Deliberately broken adapters for the conformance meta-test (meta.test.ts,
// review finding R4-1). Each is the fake with one plausible store bug planted
// in a small wrapper, and names the cases that must catch it (`fails`, each
// "group: case name" as `runCases` reports it), so a weakened case or corpus
// item shows up even when an incidental case still fails. They are never
// registered in registry.ts, so the normal conformance run does not see them.
// The capability-honesty ones (card A5) are the validity double or the fake
// claiming a capability they do not keep.
import { isDeepStrictEqual } from "node:util";
import type { MemoryItem } from "@engram/core";
import type { Adapter, StoreRef } from "../../src/contract.ts";
import { createFakeAdapter } from "../../src/fake/index.ts";
import { createValidityAdapter } from "./validity.ts";

type Patch = (inner: Adapter) => Partial<Adapter>;

/** The fake (search and history on), or another honest adapter, with some methods replaced. */
function broken(patch: Patch, base: () => Adapter = () => createFakeAdapter()): () => Adapter {
  return () => {
    const inner = base();
    return { ...inner, ...patch(inner) } as Adapter;
  };
}

/** The validity double with some methods replaced: a store claiming native validity. */
const brokenValidity = (patch: Patch) => broken(patch, () => createValidityAdapter());

/** The fake claiming more than it has. */
const claiming = (capabilities: Partial<Adapter["capabilities"]>, options = {}) =>
  broken(
    (inner) => ({ capabilities: { ...inner.capabilities, ...capabilities } }),
    () => createFakeAdapter(options),
  );

/** Is the item outside its validity window at the wall clock: the store's own clock, not the reader's. */
const outsideNow = (item: MemoryItem) => {
  const now = Date.now();
  return (
    Date.parse(item.valid_from) > now ||
    (item.valid_to !== null && Date.parse(item.valid_to) <= now)
  );
};

/** A capability-honesty case, by its `runCases` label. */
const honesty = (name: string) => `capability honesty: ${name}`;

/** The fake keys items by id, so a wrapper can build the ref an id lives under. */
const refOf = (inner: Adapter, id: string): StoreRef => ({ adapter: inner.name, key: id });

const onWrite = (change: (item: MemoryItem) => MemoryItem): Patch => {
  return (inner) => ({ write: (item) => inner.write(change(item)) });
};

const textChange = (change: (text: string) => string) =>
  onWrite((item) =>
    typeof item.content === "string"
      ? ({ ...item, content: change(item.content) } as MemoryItem)
      : item,
  );

/** The round-trip case of the corpus item with this label. */
const roundTrip = (label: string) => `write and read: round-trips every field of ${label}`;
const BASE_ITEM = "the base item, with grants, a closed validity window, a ttl and a session entry";
const LINEAGE_3 = "a fourth version with a three-entry lineage in no sorted order";

export interface BrokenAdapter {
  name: string;
  factory: () => Adapter;
  /** The cases that must fail, by their `runCases` label. */
  fails: string[];
}

export const BROKEN_ADAPTERS: BrokenAdapter[] = [
  {
    name: "drops grants",
    factory: broken(onWrite((i) => ({ ...i, grants: [] }))),
    fails: [roundTrip(BASE_ITEM), roundTrip("a procedure")],
  },
  {
    name: "stores valid_to and ttl as null",
    factory: broken(onWrite((i) => ({ ...i, valid_to: null, ttl: null }))),
    fails: [roundTrip(BASE_ITEM)],
  },
  {
    name: "drops lineage",
    factory: broken(onWrite((i) => ({ ...i, lineage: [] }))),
    fails: [roundTrip("a second version with lineage"), roundTrip(LINEAGE_3)],
  },
  {
    name: "reverses lineage",
    factory: broken(onWrite((i) => ({ ...i, lineage: [...i.lineage].reverse() }))),
    fails: [roundTrip(LINEAGE_3)],
  },
  {
    name: "sorts lineage",
    factory: broken(onWrite((i) => ({ ...i, lineage: [...i.lineage].sort() }))),
    fails: [roundTrip(LINEAGE_3)],
  },
  {
    name: "defaults a confidence of 0 to 0.5",
    factory: broken(onWrite((i) => ({ ...i, confidence: i.confidence || 0.5 }))),
    fails: [roundTrip("confidence 0")],
  },
  {
    name: "clamps a confidence of 1 below 1",
    factory: broken(onWrite((i) => ({ ...i, confidence: Math.min(i.confidence, 0.99) }))),
    fails: [roundTrip("confidence 1")],
  },
  {
    name: "stores JSON content as a string",
    factory: broken(
      onWrite((i) =>
        i.class !== "procedural" && typeof i.content !== "string"
          ? ({ ...i, content: JSON.stringify(i.content) } as MemoryItem)
          : i,
      ),
    ),
    fails: [roundTrip("semantic JSON content")],
  },
  {
    name: "truncates content to 200 characters",
    factory: broken(textChange((t) => t.slice(0, 200))),
    fails: [roundTrip("content longer than 100,000 characters")],
  },
  {
    name: "replaces non-ASCII characters with ?",
    factory: broken(textChange((t) => t.replace(/\P{ASCII}/gu, "?"))),
    fails: [
      roundTrip("Unicode, CRLF line ends and a frontmatter delimiter line"),
      roundTrip("a lone surrogate"),
    ],
  },
  {
    name: "strips leading whitespace from content",
    factory: broken(textChange((t) => t.replace(/^\s+/, ""))),
    fails: [roundTrip("content with leading and trailing whitespace")],
  },
  {
    name: "drops the optional provenance fields",
    factory: broken(
      onWrite((i) => {
        const { session_entry_id: _s, model: _m, ...provenance } = i.provenance;
        return { ...i, provenance } as MemoryItem;
      }),
    ),
    fails: [roundTrip(BASE_ITEM), roundTrip("a model-written item naming its model")],
  },
  {
    name: "rewrites a role scope as a person scope",
    factory: broken(
      onWrite((i) =>
        i.scope.startsWith("role:") ? { ...i, scope: `person:${i.scope.slice(5)}` } : i,
      ),
    ),
    fails: [roundTrip("a role-scoped item")],
  },
  {
    name: "ignores a rewrite that changes only the status",
    factory: broken((inner) => ({
      async write(item) {
        const current = await inner.read(refOf(inner, item.id));
        const statusOnly =
          current !== undefined &&
          current.status !== item.status &&
          isDeepStrictEqual(
            { ...current, status: item.status, store_ref: null },
            {
              ...item,
              store_ref: null,
            },
          );
        return statusOnly ? refOf(inner, item.id) : inner.write(item);
      },
    })),
    fails: ["write and read: a rewrite that changes only the status is stored"],
  },
  {
    name: "lists by scope prefix",
    factory: broken((inner) => {
      const scopes = new Set<string>();
      return {
        write(item) {
          scopes.add(item.scope);
          return inner.write(item);
        },
        async list(scope) {
          const lists = await Promise.all(
            [...scopes].filter((s) => s.startsWith(scope)).map((s) => inner.list(s)),
          );
          return lists.flat();
        },
      };
    }),
    fails: [
      "list: a prefix of a scope name lists nothing",
      "list: returns exactly the items in one scope",
    ],
  },
  {
    name: "lists items with a null store_ref",
    factory: broken((inner) => ({
      list: async (scope) => (await inner.list(scope)).map((i) => ({ ...i, store_ref: null })),
    })),
    fails: ["list: every scope lists exactly its own items, every field intact"],
  },
  {
    name: "search returns items with an altered field",
    factory: broken((inner) => ({
      search: async (query, scopes) =>
        ((await inner.search?.(query, scopes)) ?? []).map((i) => ({ ...i, confidence: 0 })),
    })),
    fails: [
      "search (when supported): finds an item by a unique exact phrase inside the filter, every field intact",
      "lexical search recall: finds every matching item inside the filter, every field intact",
    ],
  },
  {
    name: "search drops candidate and retired items",
    factory: broken((inner) => ({
      search: async (query, scopes) =>
        ((await inner.search?.(query, scopes)) ?? []).filter((i) => i.status === "active"),
    })),
    fails: ["search (when supported): finds a candidate and a retired item, whatever their status"],
  },
  {
    name: "delete accepts another adapter's ref",
    factory: broken((inner) => ({
      delete: (ref) => inner.delete({ adapter: inner.name, key: ref.key }),
    })),
    fails: ["store_ref opacity: delete refuses a ref from another adapter and deletes nothing"],
  },
  {
    name: "claims native validity and keeps the first window it was given",
    factory: brokenValidity((inner) => ({
      async write(item) {
        const current = await inner.read(refOf(inner, item.id));
        const window = current && { valid_from: current.valid_from, valid_to: current.valid_to };
        return inner.write(window ? ({ ...item, ...window } as MemoryItem) : item);
      },
    })),
    fails: [
      honesty(
        "a store claiming native validity stores a rewrite that only closes or reopens the window",
      ),
    ],
  },
  {
    name: "claims native validity and hides what is outside its window at its own clock",
    factory: brokenValidity((inner) => ({
      list: async (scope) => (await inner.list(scope)).filter((i) => !outsideNow(i)),
      search: async (query, scopes) =>
        ((await inner.search?.(query, scopes)) ?? []).filter((i) => !outsideNow(i)),
    })),
    fails: [
      honesty(
        "a store claiming native validity hides nothing from list or search for being outside its window",
      ),
    ],
  },
  {
    name: "claims native validity and derives valid_from from its own bookkeeping",
    factory: brokenValidity(() => ({ derivedFields: () => ["valid_from"] })),
    fails: [
      honesty("a store claiming native validity derives no window field from its own bookkeeping"),
    ],
  },
  {
    name: "claims native validity and stamps every past version with the latest window",
    factory: brokenValidity((inner) => ({
      async history(ref) {
        const latest = await inner.read(ref);
        const versions = (await inner.history?.(ref)) ?? [];
        return latest
          ? versions.map(
              (v) =>
                ({ ...v, valid_from: latest.valid_from, valid_to: latest.valid_to }) as MemoryItem,
            )
          : versions;
      },
    })),
    fails: [
      honesty(
        "a store claiming native validity keeps each version's own window in history, oldest first",
      ),
    ],
  },
  {
    name: "claims native graph",
    factory: claiming({ native_graph: true }),
    fails: [honesty("a claim of native graph is refused while the contract has no graph method")],
  },
  {
    name: "claims native history without a history method",
    factory: claiming({ native_history: true }, { history: false }),
    fails: ["history (when supported): a capability claiming native history has a history method"],
  },
  {
    name: "claims native search without a search method",
    factory: claiming({ native_search: true }, { search: false }),
    fails: ["search (when supported): a capability claiming native search has a search method"],
  },
];
