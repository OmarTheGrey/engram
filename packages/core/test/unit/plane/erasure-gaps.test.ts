// Card E1.7: the erasure gaps the Quint model found (card E1.5) and the trace
// replay reproduced (card E1.8), closed, on two handles of one log and one
// store, on SQLite and embedded Postgres. Each test is the interleaving that
// showed a gap, driven on the real Plane, ending in the state the fix
// reaches; on the code before the fix each one fails.
//
// - E1.5-1: the sweep's put-back across a third offboarding left erased
//   content in the store; it now deletes what it wrote once the item is gone.
// - E1.5-8: a write under a swept id was allowed and lost its record to
//   adoption's purge; it is now refused, and each purge rechecks under the
//   lock before its delete.
// - E18-F4: a purge an earlier adoption decided ran again from a listing
//   older than a change; it is now left to the next adoption.
// - E18-F1: adoption retracted an item while its person scope was being
//   erased; it no longer does.
// - E18-F2: a record refused while its scope was being erased was never
//   adopted after; it is gated again once the erasure completes.
import { readFileSync } from "node:fs";
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import type { Adapter, StoreRef } from "../../../src/adapter.ts";
import type { Db } from "../../../src/db/db.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { allEvents, appendEvent, eventsByItem } from "../../../src/events.ts";
import { itemById } from "../../../src/items.ts";
import {
  type Actor,
  adoptStoreItems,
  createPlane,
  offboard,
  type PlaneDeps,
} from "../../../src/plane.ts";
import { parsePolicy } from "../../../src/policy/load.ts";
import type { MemoryItem } from "../../../src/schema.ts";
import { type Backend, forEachBackend } from "../../db/backends.ts";
import { id, item } from "./helpers.ts";

const PROFILE = new URL("../../../../pi-package/profiles/twin.yaml", import.meta.url);
const twin = () => parsePolicy(readFileSync(PROFILE, "utf8"), "twin.yaml");
const AT = "2026-11-28T10:00:00Z";
const LATER = "2026-11-28T11:00:00Z";
const PERSON = "person:dana";
const SECRET = "Dana's sister is Mira.";

const dana: Actor = { id: PERSON, level: "person", memberships: [PERSON], source: "user" };
const hr: Actor = {
  id: "person:hr",
  level: "person",
  memberships: ["person:hr", PERSON],
  source: "user",
};

type Method = "write" | "delete" | "list";
interface Pause {
  arrived: Promise<void>;
  release(): void;
}

/** One handle's view of the shared store; `pause` holds that method's next call until released. */
function pausable(store: Adapter) {
  const armed = new Map<string, { arrive: () => void; gate: Promise<void> }>();
  let failDelete = false;
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
      return store.write(it);
    },
    delete: async (ref: StoreRef) => {
      await at("delete:before");
      if (failDelete) {
        failDelete = false;
        throw new Error("the store is unavailable");
      }
      await store.delete(ref);
      await at("delete:after");
    },
    list: async (scope: string) => {
      const listed = await store.list(scope);
      await at("list:after");
      return listed;
    },
  });
  const pause = (method: Method, when: "before" | "after"): Pause => {
    let arrive = () => {};
    let release = () => {};
    const arrived = new Promise<void>((r) => {
      arrive = r;
    });
    const gate = new Promise<void>((r) => {
      release = r;
    });
    armed.set(`${method}:${when}`, { arrive, gate });
    return { arrived, release };
  };
  /** The next delete through this handle fails, as a transient store failure does. */
  const failNextDelete = () => {
    failDelete = true;
  };
  return { adapter, pause, failNextDelete };
}

/** The handle `db`, whose `n`-th outermost transaction from now first runs `hook`: another process committing then. */
function hooked(db: Db) {
  let hook: { n: number; run: () => void } | null = null;
  let depth = 0;
  const wrapped: Db = {
    dialect: db.dialect,
    exec: (sql) => db.exec(sql),
    prepare: (sql) => db.prepare(sql),
    transaction<T>(fn: () => T): T {
      if (depth === 0 && hook && --hook.n === 0) {
        const h = hook;
        hook = null;
        h.run();
      }
      depth++;
      try {
        return db.transaction(fn);
      } finally {
        depth--;
      }
    },
    close: () => db.close(),
  };
  return { db: wrapped, onTransaction: (n: number, run: () => void) => (hook = { n, run }) };
}

function setup(backend: Backend) {
  const [mine, theirs] = backend.pair();
  migrate(mine);
  const store = createFakeAdapter({ history: false });
  const a = pausable(store);
  const b = pausable(store);
  const hook = hooked(mine);
  let n = 0;
  const policy = twin();
  const depsMine: PlaneDeps = {
    db: hook.db,
    adapter: a.adapter,
    policy,
    newId: () => id(800_000 + ++n),
  };
  const depsTheirs: PlaneDeps = {
    db: theirs,
    adapter: b.adapter,
    policy,
    newId: () => id(700_000 + ++n),
  };
  return { mine, theirs, store, a, b, hook, depsMine, depsTheirs };
}
type Env = ReturnType<typeof setup>;

const ref = (env: Env, n: number) => ({ adapter: env.store.name, key: id(n) }) as StoreRef;
const personItem = (n: number, content: string) =>
  item(n, { scope: PERSON, owner: PERSON, content });
const rules = (db: Db, n: number) => eventsByItem(db, id(n)).map((e) => e.policy_id);

/** A record under item 9 no allowed event ever recorded, offboarded on `theirs`: the sweep takes it out. */
async function sweptNine(env: Env) {
  await env.store.write(personItem(9, "Never committed."));
  await offboard(env.depsTheirs, hr, { person: PERSON, roles: [] }, AT);
  expect(rules(env.mine, 9)).toEqual(["engram/offboard/swept"]);
  expect(await env.store.read(ref(env, 9))).toBeUndefined();
}

forEachBackend((backend) => {
  describe("card E1.7: the erasure gaps, closed", () => {
    test("E1.5-1: the sweep's put-back across a third offboarding deletes the erased item's record it wrote back", async () => {
      const env = setup(backend);
      // A record no allowed event recorded, in the store when the first
      // offboarding (mine) lists it, gone by the time the second (theirs)
      // does (a stale writer's settle deleted it).
      await env.store.write(personItem(2, "Never committed."));
      const listed = env.a.pause("list", "after");
      const first = offboard(env.depsMine, hr, { person: PERSON, roles: [] }, AT);
      await listed.arrived;
      await env.store.delete(ref(env, 2));
      const sweepDelete = env.a.pause("delete", "before");
      listed.release();
      await sweepDelete.arrived;
      // The second offboarding closes both marks; the owner then writes b.
      await offboard(env.depsTheirs, hr, { person: PERSON, roles: [] }, AT);
      const w = await createPlane(env.depsTheirs).write(dana, personItem(2, SECRET), AT);
      expect(w.event.decision).toBe("allow");
      // The sweep deletes that record, finds b changed under the lock, and
      // reads b to put it back; it waits at its store write.
      const putBack = env.a.pause("write", "before");
      sweepDelete.release();
      await putBack.arrived;
      // A third offboarding erases b meanwhile.
      const third = await offboard(env.depsTheirs, hr, { person: PERSON, roles: [] }, AT);
      expect(third.erased.items).toEqual([id(2)]);
      // The put-back writes b's erased content back, finds b erased on its
      // next round, and deletes what it wrote.
      putBack.release();
      const report = await first;
      expect(report.decision).toBe("allow");
      expect(await env.store.read(ref(env, 2))).toBeUndefined();
      expect(await env.store.list(PERSON)).toEqual([]);
      expect(itemById(env.mine, id(2))).toBeUndefined();
      expect(JSON.stringify(await env.store.list(PERSON))).not.toContain("Mira");
    });

    test("known limit: a put-back whose delete fails leaves the erased record; adoption refuses it and never serves it, and it stays in the store", async () => {
      const env = setup(backend);
      await env.store.write(personItem(2, "Never committed."));
      const listed = env.a.pause("list", "after");
      const first = offboard(env.depsMine, hr, { person: PERSON, roles: [] }, AT);
      await listed.arrived;
      await env.store.delete(ref(env, 2));
      const sweepDelete = env.a.pause("delete", "before");
      listed.release();
      await sweepDelete.arrived;
      await offboard(env.depsTheirs, hr, { person: PERSON, roles: [] }, AT);
      expect(
        (await createPlane(env.depsTheirs).write(dana, personItem(2, SECRET), AT)).event.decision,
      ).toBe("allow");
      const putBack = env.a.pause("write", "before");
      sweepDelete.release();
      await putBack.arrived;
      const third = await offboard(env.depsTheirs, hr, { person: PERSON, roles: [] }, AT);
      // The third erasure finds no record at b's ref: the sweep deleted it.
      expect(third.erased.not_found_in_store.flatMap((r) => r.items)).toEqual([id(2)]);
      // The put-back writes b back; its next round's delete fails and throws.
      env.a.failNextDelete();
      putBack.release();
      await expect(first).rejects.toThrow(/the store is unavailable/);
      expect((await env.store.read(ref(env, 2)))?.content).toBe(SECRET);
      // Adoption refuses it (engram/adopt/erased), so the plane never projects
      // or serves it, but does not purge it: the not-found erasure's rule
      // (E18-F7, kept by card E1.7). A later offboarding's sweep leaves it
      // too. It is the residue card X19 measures.
      const r = await adoptStoreItems(env.depsMine, dana, PERSON, LATER);
      expect(r.denials.map((d) => d.policy_id)).toEqual(["engram/adopt/erased"]);
      expect(itemById(env.mine, id(2))).toBeUndefined();
      expect((await createPlane(env.depsMine).read(dana, { at: LATER })).items).toEqual([]);
      await offboard(env.depsMine, hr, { person: PERSON, roles: [] }, LATER);
      expect((await env.store.read(ref(env, 2)))?.content).toBe(SECRET);
    });

    test("E1.5-8: a new write under a swept id is refused as under an erased one, naming the sweep", async () => {
      const env = setup(backend);
      await sweptNine(env);
      const w = await createPlane(env.depsMine).write(dana, personItem(9, "A new memory."), LATER);
      expect(w.event).toMatchObject({ decision: "deny", policy_id: "engram/write/erased" });
      expect(w.event.reason).toMatch(
        /item id .* was swept out of the store of person:dana by an offboarding of person:dana \(engram\/offboard\/swept\)/,
      );
      expect(await env.store.read(ref(env, 9))).toBeUndefined();
      // A non-member is told only that the id is held.
      const sam: Actor = { ...dana, id: "person:sam", memberships: ["person:sam"] };
      const s = await createPlane(env.depsMine).checkWrite(
        sam,
        item(9, { scope: "person:sam", owner: "person:sam", content: "Mine." }),
        LATER,
      );
      expect(s).toMatchObject({ decision: "deny", policy_id: "engram/write/erased" });
      expect(s.reason).toMatch(/^the item id is held by an item you cannot access/);
    });

    test("E1.5-8: a write under an id swept from a team scope names the offboarded person scope only to its member", async () => {
      const env = setup(backend);
      const danaTeam: Actor = { ...dana, memberships: [PERSON, "team:x"] };
      const lee: Actor = { ...dana, id: "person:lee", memberships: ["person:lee", "team:x"] };
      // team:x is a scope the log names, so the sweep lists it.
      await createPlane(env.depsMine).write(
        danaTeam,
        item(40, { scope: "team:x", owner: PERSON, content: "Team note." }),
        AT,
      );
      await env.store.write(personItem(9, "Never committed."));
      await env.store.write(
        item(53, { scope: "team:x", owner: PERSON, content: "Copied.", lineage: [id(9)] }),
      );
      await offboard(env.depsTheirs, hr, { person: PERSON, roles: [] }, AT);
      expect(rules(env.mine, 53)).toEqual(["engram/offboard/swept"]);
      const fresh = (who: Actor) =>
        createPlane(env.depsMine).checkWrite(
          who,
          item(53, { scope: "team:x", owner: who.id, content: "Mine now." }),
          LATER,
        );
      const asLee = await fresh(lee);
      expect(asLee).toMatchObject({ decision: "deny", policy_id: "engram/write/erased" });
      expect(asLee.reason).toMatch(/swept out of the store of team:x by an offboarding \(/);
      expect(asLee.reason).not.toContain(PERSON);
      const asDana = await fresh(danaTeam);
      expect(asDana.reason).toMatch(
        /swept out of the store of team:x by an offboarding of person:dana \(/,
      );
    });

    test("E1.5-8: the purge checks under the lock before its delete: a change since the refusal leaves the record", async () => {
      const env = setup(backend);
      await sweptNine(env);
      await env.store.write(personItem(9, "Dropped in by hand."));
      // Between the refusal's transaction and the purge's check, another
      // process appends a change to item 9 (its own adoption's refusal).
      env.hook.onTransaction(2, () =>
        appendEvent(env.theirs, {
          id: id(600_001),
          ts: LATER,
          op: "write",
          item_id: id(9),
          actor: PERSON,
          scope_from: null,
          scope_to: PERSON,
          decision: "deny",
          reason: "another handle's refusal",
          policy_id: "engram/adopt/erased",
          schema_version: 1,
        }),
      );
      const r = await adoptStoreItems(env.depsMine, dana, PERSON, LATER);
      expect(r).toMatchObject({ denied: 1, deferred: 1 });
      expect(await env.store.read(ref(env, 9))).toBeDefined();
      // The next adoption, its listing after that change, deletes it.
      await adoptStoreItems(env.depsMine, dana, PERSON, LATER);
      expect(await env.store.read(ref(env, 9))).toBeUndefined();
    });

    test("E18-F4: a purge an earlier adoption decided is left to the next adoption when the listing predates that refusal", async () => {
      const env = setup(backend);
      await sweptNine(env);
      await env.store.write(personItem(9, "Dropped in by hand."));
      // Theirs lists the record and waits; mine refuses and purges it.
      const listed = env.b.pause("list", "after");
      const late = adoptStoreItems(env.depsTheirs, dana, PERSON, LATER);
      await listed.arrived;
      const first = await adoptStoreItems(env.depsMine, dana, PERSON, LATER);
      expect(first).toMatchObject({ denied: 1 });
      expect(await env.store.read(ref(env, 9))).toBeUndefined();
      // Other bytes are dropped in under the id; theirs never listed them.
      await env.store.write(personItem(9, "Dropped in again, other bytes."));
      const before = allEvents(env.mine).length;
      listed.release();
      const second = await late;
      expect(second).toMatchObject({ deferred: 1, unchanged: 0 });
      expect((await env.store.read(ref(env, 9)))?.content).toBe("Dropped in again, other bytes.");
      expect(allEvents(env.mine)).toHaveLength(before);
      // The next adoption gates the new bytes: refused, with its event, and purged.
      const third = await adoptStoreItems(env.depsMine, dana, PERSON, LATER);
      expect(third.denials.map((d) => d.policy_id)).toEqual(["engram/adopt/erased"]);
      expect(await env.store.read(ref(env, 9))).toBeUndefined();
    });

    test("E18-F1: no retraction while the scope is being erased; the erasure takes the item out", async () => {
      const env = setup(backend);
      const w = await createPlane(env.depsMine).write(dana, personItem(1, SECRET), AT);
      expect(w.event.decision).toBe("allow");
      // The erasure has deleted item 1's record and not yet committed.
      const deleted = env.a.pause("delete", "after");
      const erasure = offboard(env.depsMine, hr, { person: PERSON, roles: [] }, AT);
      await deleted.arrived;
      const r = await adoptStoreItems(env.depsTheirs, dana, PERSON, LATER);
      expect(r.retired).toBe(0);
      deleted.release();
      const report = await erasure;
      expect(report.erased.items).toEqual([id(1)]);
      expect(rules(env.mine, 1)).not.toContain("engram/adopt/retract");
      expect(rules(env.mine, 1).at(-1)).toBe("engram/offboard/erase");
    });

    test("E18-F2: a record refused while its scope was being erased is adopted once the erasure completes", async () => {
      const env = setup(backend);
      const listed = env.a.pause("list", "after");
      const erasure = offboard(env.depsMine, hr, { person: PERSON, roles: [] }, AT);
      await listed.arrived;
      await env.store.write(personItem(5, "Written during the offboarding."));
      const during = await adoptStoreItems(env.depsTheirs, dana, PERSON, LATER);
      expect(during.denials.map((d) => d.policy_id)).toEqual(["engram/offboard/erasing"]);
      // Still erasing: the same bytes are not gated again.
      const again = await adoptStoreItems(env.depsTheirs, dana, PERSON, LATER);
      expect(again).toMatchObject({ unchanged: 1, denied: 0, allowed: 0 });
      listed.release();
      await erasure;
      const after = await adoptStoreItems(env.depsTheirs, dana, PERSON, LATER);
      expect(after).toMatchObject({ allowed: 1, denied: 0 });
      expect(itemById(env.mine, id(5))?.content).toBe("Written during the offboarding.");
    });
  });
});
