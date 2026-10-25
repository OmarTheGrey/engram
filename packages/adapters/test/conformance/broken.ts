// Deliberately broken adapters for the conformance meta-test (meta.test.ts,
// review finding R4-1). Each is the fake with one plausible store bug planted
// in a small wrapper; the suite must fail every one of them. They are never
// registered in registry.ts, so the normal conformance run does not see them.
import { isDeepStrictEqual } from "node:util";
import type { MemoryItem } from "@engram/core";
import type { Adapter, StoreRef } from "../../src/contract.ts";
import { createFakeAdapter } from "../../src/fake/index.ts";

type Patch = (inner: Adapter) => Partial<Adapter>;

/** The fake (search and history on) with some methods replaced. */
function broken(patch: Patch): () => Adapter {
  return () => {
    const inner = createFakeAdapter();
    return { ...inner, ...patch(inner) } as Adapter;
  };
}

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

export const BROKEN_ADAPTERS: { name: string; factory: () => Adapter }[] = [
  { name: "drops grants", factory: broken(onWrite((i) => ({ ...i, grants: [] }))) },
  {
    name: "stores valid_to and ttl as null",
    factory: broken(onWrite((i) => ({ ...i, valid_to: null, ttl: null }))),
  },
  { name: "drops lineage", factory: broken(onWrite((i) => ({ ...i, lineage: [] }))) },
  {
    name: "stores JSON content as a string",
    factory: broken(
      onWrite((i) =>
        i.class !== "procedural" && typeof i.content !== "string"
          ? ({ ...i, content: JSON.stringify(i.content) } as MemoryItem)
          : i,
      ),
    ),
  },
  {
    name: "truncates content to 200 characters",
    factory: broken(textChange((t) => t.slice(0, 200))),
  },
  {
    name: "replaces non-ASCII characters with ?",
    factory: broken(textChange((t) => t.replace(/\P{ASCII}/gu, "?"))),
  },
  {
    name: "drops the optional provenance fields",
    factory: broken(
      onWrite((i) => {
        const { session_entry_id: _s, model: _m, ...provenance } = i.provenance;
        return { ...i, provenance } as MemoryItem;
      }),
    ),
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
  },
  {
    name: "lists items with a null store_ref",
    factory: broken((inner) => ({
      list: async (scope) => (await inner.list(scope)).map((i) => ({ ...i, store_ref: null })),
    })),
  },
  {
    name: "search returns items with an altered field",
    factory: broken((inner) => ({
      search: async (query, scopes) =>
        ((await inner.search?.(query, scopes)) ?? []).map((i) => ({ ...i, confidence: 0 })),
    })),
  },
  {
    name: "delete accepts another adapter's ref",
    factory: broken((inner) => ({
      delete: (ref) => inner.delete({ adapter: inner.name, key: ref.key }),
    })),
  },
];
