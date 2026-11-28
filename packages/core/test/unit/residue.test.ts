// The erasure-residue scan (card X19, proposal U7): before an offboarding it
// finds a person's content in every log tier and the store, and calls none of
// it retained; after, it finds none of the erased content but what the plane
// keeps by decision, each hit labelled with why, and it reports as residue a
// record left in a store that refuses the plane's delete. On SQLite and
// Postgres (ADR 0024).
import { readFileSync } from "node:fs";
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import { type Adapter, NotDeletableError, type StoreRef } from "../../src/adapter.ts";
import { mergingContentHash, strictContentHash } from "../../src/content-hash.ts";
import type { Db } from "../../src/db/db.ts";
import { migrate } from "../../src/db/migrate.ts";
import { appendEvent, currentItems } from "../../src/events.ts";
import { type Actor, createPlane, offboard } from "../../src/plane.ts";
import { parsePolicy } from "../../src/policy/load.ts";
import { findResidue, needlesIn, type ResidueNeedle, scanBytes } from "../../src/residue.ts";
import type { MemoryItem } from "../../src/schema.ts";
import { forEachBackend } from "../db/backends.ts";
import { id, item } from "./plane/helpers.ts";

const PROFILE = new URL("../../../pi-package/profiles/twin.yaml", import.meta.url);
const twin = () => parsePolicy(readFileSync(PROFILE, "utf8"), "twin.yaml");
const AT = "2026-10-25T12:00:00.000Z";
const LATER = "2026-10-26T12:00:00.000Z";
const PERSON = "person:dana";
const dana: Actor = {
  id: PERSON,
  level: "person",
  memberships: [PERSON, "role:lead", "team:core"],
  source: "user",
};
const lee: Actor = {
  id: "person:lee",
  level: "person",
  memberships: ["person:lee", "team:core"],
  source: "user",
};
const hr: Actor = {
  id: "person:hr",
  level: "person",
  memberships: ["person:hr", PERSON, "team:core"],
  source: "user",
};
const FACTS = {
  plain: "Dana keeps canary-amber-otter-1001 in her notes.",
  promoted: "Dana keeps canary-brisk-heron-1002 in her notes.",
  shared: "Dana keeps canary-civic-lynx-1003 in her notes.",
  left: "Dana keeps canary-dusky-wren-1004 in her notes.",
} as const;
type Fact = keyof typeof FACTS;
const N: Record<Fact, number> = { plain: 1, promoted: 2, shared: 3, left: 4 };
const canary = (f: Fact) => /canary-[a-z]+-[a-z]+-\d+/.exec(FACTS[f])?.[0] as string;
const hex = (f: Fact) => strictContentHash(FACTS[f]).slice("sha256:".length);
const NEEDLES: ResidueNeedle[] = (Object.keys(FACTS) as Fact[]).flatMap((f) => [
  { key: `${f}/text`, text: canary(f) },
  { key: `${f}/hash`, text: hex(f) },
  { key: `${f}/merging`, text: mergingContentHash(FACTS[f]).slice("sha256:".length) },
]);
const NEVER: ResidueNeedle = { key: "never/text", text: "canary-eerie-moth-1999" };

/** A store that refuses for good to let the plane delete the refs `refused` picks: a fault-injecting store. */
function readOnlyDeletes(adapter: Adapter, refused: (ref: StoreRef) => boolean) {
  const remove = adapter.delete.bind(adapter);
  adapter.delete = async (ref) => {
    if (refused(ref)) throw new NotDeletableError(`${ref.key} is read-only to the plane`);
    return remove(ref);
  };
}

async function seeded(db: Db) {
  migrate(db);
  const adapter = createFakeAdapter();
  let n = 0;
  const deps = { db, adapter, policy: twin(), newId: () => id(900_000 + ++n) };
  const plane = createPlane(deps);
  for (const f of Object.keys(FACTS) as Fact[]) {
    const grants =
      f === "plain"
        ? [{ to: lee.id, class: "semantic" as const, mode: "read" as const, expires: LATER }]
        : [];
    const w = await plane.write(
      dana,
      item(N[f], { scope: PERSON, owner: PERSON, content: FACTS[f], grants }),
      AT,
    );
    expect(w.event.decision, f).toBe("allow");
  }
  // Lee reads the granted fact, so the explanations table holds a row for it.
  const read = await plane.read(lee, { at: AT });
  expect(read.items.map((i) => i.id)).toContain(id(N.plain));
  // A reviewer the harness makes a member of Dana's scope (memberships are the
  // harness's, ADR 0027) promotes one fact into the team: under twin a
  // widening out of a person scope needs a user-sourced reviewer other than
  // the owner who belongs to both scopes.
  const p = await plane.promote(hr, id(N.promoted), "team:core", AT, { review: true });
  expect(`${p.decision}: ${p.event.reason}`).toMatch(/^allow/);
  // A team item holding the shared fact's store ref (a version of the same
  // record, as adoption makes; offboard-edges.test.ts builds it the same way).
  const person = currentItems(db).find((i) => i.id === id(N.shared)) as MemoryItem;
  const team = {
    ...person,
    id: id(50),
    scope: "team:core",
    lineage: [person.id],
    version: person.version + 1,
  } as MemoryItem;
  appendEvent(db, {
    id: id(800_001),
    ts: AT,
    op: "write",
    item_id: team.id,
    actor: PERSON,
    scope_from: null,
    scope_to: team.scope,
    decision: "allow",
    reason: "a version shared into the team",
    policy_id: "test/fixture",
    item: team,
    schema_version: 1,
  });
  const left = currentItems(db).find((i) => i.id === id(N.left)) as MemoryItem;
  readOnlyDeletes(adapter, (ref) => ref.key === left.store_ref?.key);
  return { db, adapter, deps, plane };
}

const LEAVE = { person: PERSON, roles: [{ scope: "role:lead", successor: "person:sam" }] };
const found = (hits: { needle: string }[]) => [...new Set(hits.map((h) => h.needle))].sort();

forEachBackend((backend) => {
  describe("the residue scan", () => {
    test("before offboarding finds every fact in the projection, the events and the store, none retained but what lives outside the person scope", async () => {
      const env = await seeded(backend.open());
      const scan = await findResidue(env, { person: PERSON, needles: [...NEEDLES, NEVER] });
      const tier = (t: string) => scan.hits.filter((h) => h.tier === t);
      expect(found(tier("projection").filter((h) => h.needle.endsWith("/text")))).toEqual([
        "left/text",
        "plain/text",
        "promoted/text",
        "shared/text",
      ]);
      expect(found(tier("events"))).toContain("plain/text");
      // An explanation row names its item by id and holds no content (schema.ts).
      expect(scan.searched.explanations).toBe(1);
      expect(found(tier("explanations"))).toEqual([]);
      expect(found(tier("store-records"))).toContain("left/text");
      // The plain fact, still in the person scope, is retained by nothing.
      expect(scan.hits.filter((h) => h.needle === "plain/text").map((h) => h.retained)).toEqual(
        scan.hits.filter((h) => h.needle === "plain/text").map(() => null),
      );
      expect(found(scan.hits)).not.toContain(NEVER.key);
      expect(scan.searched.projection).toBeGreaterThan(0);
    });

    test("after offboarding finds only what is retained by decision, and the record a read-only store kept as residue", async () => {
      const env = await seeded(backend.open());
      const report = await offboard(env.deps, dana, LEAVE, LATER);
      expect(report.erased.left_in_store.flatMap((l) => l.items)).toEqual([id(N.left)]);
      const scan = await findResidue(env, { person: PERSON, needles: [...NEEDLES, NEVER] });
      const residue = scan.hits.filter((h) => h.retained === null);
      // The plain fact is gone from every tier, text and hash.
      expect(found(scan.hits)).not.toContain("plain/text");
      expect(found(scan.hits)).not.toContain("plain/hash");
      // The one residue: the record the store would not let the plane delete.
      expect(residue.map((h) => [h.tier, h.needle, h.item_id])).toEqual([
        ["store-records", "left/text", id(N.left)],
      ]);
      // Retained by decision, each with its kind.
      const kinds = (needle: string) =>
        [...new Set(scan.hits.filter((h) => h.needle === needle).map((h) => h.retained))].sort();
      expect(kinds("promoted/text")).toEqual(["promoted"]);
      expect(kinds("shared/text")).toEqual(["outside-person-scope", "shared-store-ref"]);
      // The left record's merging hash, kept in its erase event's reason.
      expect(kinds("left/merging")).toEqual(["erased-content-hash"]);
      expect(found(scan.hits)).not.toContain(NEVER.key);
    });
  });
});

describe("scanBytes", () => {
  test("finds a needle's UTF-8 bytes anywhere in a buffer, and nothing else", () => {
    const bytes = Buffer.concat([
      Buffer.from([0, 255, 3]),
      Buffer.from("x canary-amber-otter-1001 été", "utf8"),
    ]);
    expect(
      scanBytes(bytes, [
        { key: "a", text: "canary-amber-otter-1001" },
        { key: "b", text: "été" },
        { key: "c", text: "canary-eerie-moth-1999" },
        { key: "d", text: "" },
      ]),
    ).toEqual(["a", "b"]);
  });
});

describe("needlesIn", () => {
  test("names the needles a text holds, in the needles' order, and never an empty one", () => {
    expect(
      needlesIn("b then a", [
        { key: "a", text: "a" },
        { key: "b", text: "b" },
        { key: "z", text: "z" },
        { key: "empty", text: "" },
      ]),
    ).toEqual(["a", "b"]);
  });
});
