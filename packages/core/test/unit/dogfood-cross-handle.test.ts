// The twin dogfood's violation report (card E9.5, src/dogfood.ts) over a log
// card E2.6's events fill: two handles of one log, as `engram serve` and the
// CLI share a member's workspace, driven through the real Plane under the
// twin profile. The log holds a withdrawal that puts back a grant an
// adoption of a stale write had removed, an adoption deferred by a change
// committed after its listing, an offboarding with its begin mark, its
// erasure and its report, and the deletion of a crashed write's record and
// of a record under an erased id. The report must find no violation in it,
// and must still find one violation planted after all of it.
import { readFileSync } from "node:fs";
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import type { Actor } from "../../src/actor.ts";
import type { Adapter } from "../../src/adapter.ts";
import type { Db } from "../../src/db/db.ts";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { dogfoodReport } from "../../src/dogfood.ts";
import { allEvents, appendEvent } from "../../src/events.ts";
import { itemById } from "../../src/items.ts";
import { adoptStoreItems, createPlane, offboard, type PlaneDeps } from "../../src/plane.ts";
import { parsePolicy } from "../../src/policy/load.ts";
import type { Grant, MemoryEvent, MemoryItem } from "../../src/schema.ts";

const PROFILE = new URL("../../../pi-package/profiles/twin.yaml", import.meta.url);
const AT = "2026-11-19T10:00:00Z";
const LATER = "2026-11-19T11:00:00Z";
const DANA: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana"],
  source: "user",
};
const HR: Actor = {
  id: "person:hr",
  level: "person",
  memberships: ["person:hr", "person:dana"],
  source: "user",
};
const SAM: Actor = { id: "person:sam", level: "person", memberships: ["person:sam"] };
const ID = (n: number) => `01980000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const TO_SAM: Grant = {
  to: "person:sam",
  class: "semantic",
  mode: "read",
  expires: "2026-12-19T00:00:00Z",
};

function note(id: string, content: string): MemoryItem {
  return {
    id,
    class: "semantic",
    scope: "person:dana",
    owner: DANA.id,
    content,
    provenance: { kind: "user", ref: "cli", hash: `sha256:${"0".repeat(64)}`, actor: DANA.id },
    confidence: 0.9,
    valid_from: "2026-11-01T00:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
  } as MemoryItem;
}

/** One handle's view of the shared store, which can hold its next call of a method. */
function pausable(store: Adapter) {
  const armed = new Map<string, { arrive: () => void; gate: Promise<void> }>();
  const at = async (key: string) => {
    const hold = armed.get(key);
    if (!hold) return;
    armed.delete(key);
    hold.arrive();
    await hold.gate;
  };
  const adapter: Adapter = Object.assign(Object.create(store) as Adapter, {
    write: async (it: MemoryItem) => {
      await at("write:before");
      const ref = await store.write(it);
      await at("write:after");
      return ref;
    },
    list: async (scope: string) => {
      const listed = await store.list(scope);
      await at("list:after");
      return listed;
    },
  });
  const pause = (key: "write:before" | "write:after" | "list:after") => {
    let arrive = () => {};
    let release = () => {};
    const arrived = new Promise<void>((r) => {
      arrive = r;
    });
    const gate = new Promise<void>((r) => {
      release = r;
    });
    armed.set(key, { arrive, gate });
    return { arrived, release };
  };
  return { adapter, pause };
}

/** The log of the scenario in the file's header, and the db it lives in. */
async function crossHandleLog() {
  const base = openSqlite(":memory:");
  migrate(base);
  // Two Db objects over one log: two write queues, as two processes have.
  const handle = (): Db => ({
    dialect: base.dialect,
    exec: (sql) => base.exec(sql),
    prepare: (sql) => base.prepare(sql),
    transaction: (fn) => base.transaction(fn),
    close: () => {},
  });
  const store = createFakeAdapter({ history: false });
  const a = pausable(store);
  const b = pausable(store);
  const policy = parsePolicy(readFileSync(PROFILE, "utf8"), "twin.yaml");
  let n = 0;
  const newId = () => ID(900_000 + ++n);
  const depsA: PlaneDeps = { db: handle(), adapter: a.adapter, policy, newId };
  const depsB: PlaneDeps = { db: handle(), adapter: b.adapter, policy, newId };
  const planeA = createPlane(depsA);
  const planeB = createPlane(depsB);
  const fact = note(ID(1), "Mira visits in December.");

  expect((await planeA.write(DANA, fact, AT)).event.decision).toBe("allow");
  // Dana's rewrite on A is decided, then held at its store write.
  const before = a.pause("write:before");
  const stale = planeA.write(
    DANA,
    { ...fact, version: 2, content: "Mira visits in January." } as MemoryItem,
    AT,
  );
  await before.arrived;
  // On B she grants Sam the fact: committed.
  expect((await planeB.changeGrants(DANA, fact.id, { add: [TO_SAM] }, AT)).decision).toBe("allow");
  // A's stale bytes land; B adopts them, which removes the grant as an import.
  const after = a.pause("write:after");
  before.release();
  await after.arrived;
  expect((await adoptStoreItems(depsB, DANA, "person:dana", AT)).allowed).toBe(1);
  after.release();
  // A's commit is stale: it withdraws the adoption, putting the grant back.
  expect((await stale).event.policy_id).toBe("engram/write/conflict");
  expect(itemById(base, fact.id)?.grants).toEqual([TO_SAM]);
  expect((await planeB.read(SAM, { at: LATER })).items.map((i) => i.id)).toEqual([fact.id]);

  // An adoption on A listed the store before a grant change on B: deferred.
  const listed = a.pause("list:after");
  const adopting = adoptStoreItems(depsA, DANA, "person:dana", LATER);
  await listed.arrived;
  expect((await planeB.changeGrants(DANA, fact.id, { remove: [TO_SAM] }, LATER)).decision).toBe(
    "allow",
  );
  listed.release();
  expect((await adopting).deferred).toBe(1);
  expect((await planeA.read(SAM, { at: LATER })).items).toEqual([]);

  // The offboarding: its mark, the erasure and the report.
  const report = await offboard(depsB, HR, { person: "person:dana", roles: [] }, LATER);
  expect(report.erased.items).toEqual([fact.id]);

  // A crashed write's record and a restored copy under the erased id: deleted.
  await store.write(note(ID(7), "Mira's new address."));
  await store.write({ ...fact, version: 3 } as MemoryItem);
  const purge = await adoptStoreItems(depsA, DANA, "person:dana", LATER);
  expect(purge.denials.map((d) => d.policy_id).sort()).toEqual([
    "engram/adopt/erased",
    "engram/adopt/offboarded",
  ]);
  expect(await store.list("person:dana")).toEqual([]);
  expect((await planeA.read(DANA, { at: LATER })).items).toEqual([]);
  return { base, policy, newId, fact };
}

describe("the violation report over card E2.6's events", () => {
  test("a withdrawal, a deferred adoption, deleted records and an offboarding's mark: no violation", async () => {
    const { base, policy } = await crossHandleLog();
    const events = allEvents(base);
    for (const rule of [
      "engram/adopt/withdrawn",
      "engram/write/conflict",
      "engram/offboard/begin",
      "engram/offboard/report",
      "engram/adopt/erased",
      "engram/adopt/offboarded",
    ])
      expect(
        events.some((e) => e.policy_id === rule),
        `the log holds ${rule}`,
      ).toBe(true);
    const { report, details } = dogfoodReport(events, policy, [DANA]);
    expect(details).toEqual([]);
    expect(report.violations).toEqual({ read: 0, grant_change: 0, total: 0 });
    // The withdrawal restored the grant: Sam's read of the fact then was allowed.
    expect(report.reads.items_via_grant).toBe(1);
    // It is no narrowing by someone other than the owner.
    expect(report.watch.narrowed).toBe(0);
    // Every new rule is printed by its id, never as other.
    expect(report.denials.other ?? 0).toBe(0);
    expect(report.denials["engram/write/conflict"]).toBe(1);
    expect(report.denials["engram/adopt/erased"]).toBe(1);
    expect(report.denials["engram/adopt/offboarded"]).toBe(1);
    base.close();
  });

  test("a violation planted after all of it is still found", async () => {
    const { base, policy, newId, fact } = await crossHandleLog();
    appendEvent(base, {
      id: newId(),
      ts: LATER,
      op: "read",
      item_id: null,
      actor: SAM.id,
      scope_from: null,
      scope_to: null,
      decision: "allow",
      reason: "planted",
      policy_id: "profile.twin/read/person",
      item_ids: [fact.id],
      schema_version: 1,
    } as Omit<MemoryEvent, "seq">);
    const { report } = dogfoodReport(allEvents(base), policy, [DANA]);
    expect(report.violations).toEqual({ read: 1, grant_change: 0, total: 1 });
    base.close();
  });

  test("a withdrawal that puts back no earlier version is a violation", async () => {
    const { base, policy, newId, fact } = await crossHandleLog();
    const other = note(ID(8), "A note no event wrote before.");
    appendEvent(base, {
      id: newId(),
      ts: LATER,
      op: "write",
      item_id: other.id,
      actor: DANA.id,
      scope_from: null,
      scope_to: other.scope,
      decision: "allow",
      reason: "planted",
      policy_id: "profile.twin/write/person",
      item: other,
      schema_version: 1,
    });
    appendEvent(base, {
      id: newId(),
      ts: LATER,
      op: "update",
      item_id: other.id,
      actor: SAM.id,
      scope_from: other.scope,
      scope_to: other.scope,
      decision: "allow",
      reason: "planted",
      policy_id: "engram/adopt/withdrawn",
      item: { ...other, grants: [TO_SAM] },
      schema_version: 1,
    });
    const { report } = dogfoodReport(allEvents(base), policy, [DANA]);
    expect(report.violations).toEqual({ read: 0, grant_change: 1, total: 1 });
    expect(fact.id).not.toBe(other.id);
    base.close();
  });
});
