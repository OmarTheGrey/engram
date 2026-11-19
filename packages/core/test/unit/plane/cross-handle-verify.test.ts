// The verification of PR #50's review fix pass (card E2.6): the verifier's
// probes V1 to V9 as assertions, on two handles of one log and one store, on
// SQLite and embedded Postgres, and one test for each mutant it found
// surviving (M7b, M7c, M12 to M14; M15, M16 and M19 are pinned by V6, V7
// and the version checks). The design rule they hold the plane to: a
// committed decision by the owner is never undone by the plane's own
// recovery; when the plane cannot tell whose bytes are whose it narrows,
// never widens. The helpers are those of cross-handle-review.test.ts.
import { readFileSync } from "node:fs";
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import { type Adapter, NotDeletableError, type StoreRef } from "../../../src/adapter.ts";
import type { Db } from "../../../src/db/db.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { dogfoodReport } from "../../../src/dogfood.ts";
import { allEvents, appendEvent, eventsByItem, rebuild } from "../../../src/events.ts";
import { itemById } from "../../../src/items.ts";
import { erasureOpen } from "../../../src/plane/commit.ts";
import {
  type Actor,
  adoptStoreItems,
  createPlane,
  offboard,
  type PlaneDeps,
} from "../../../src/plane.ts";
import { parsePolicy } from "../../../src/policy/load.ts";
import type { Grant, MemoryItem } from "../../../src/schema.ts";
import { type Backend, forEachBackend } from "../../db/backends.ts";
import { id, item } from "./helpers.ts";

const PROFILE = new URL("../../../../pi-package/profiles/twin.yaml", import.meta.url);
const twin = () => parsePolicy(readFileSync(PROFILE, "utf8"), "twin.yaml");
const AT = "2026-11-19T10:00:00Z";
const LATER = "2026-11-19T11:00:00Z";
const UNTIL = "2026-12-19T00:00:00Z";
const SECRET = "Dana's sister is Mira.";

const WRITE_CONFLICT = "engram/write/conflict";
const GRANT_CONFLICT = "engram/grant/conflict";
const _HANDOVER_CONFLICT = "engram/offboard/conflict";
const STORE_FAILURE = "engram/write/store-failure";

const dana: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana", "role:release", "team:x"],
  source: "user",
};
const hr: Actor = {
  id: "person:hr",
  level: "person",
  memberships: ["person:hr", "person:dana", "role:release"],
  source: "user",
};
const sam: Actor = {
  id: "person:sam",
  level: "person",
  memberships: ["person:sam"],
  source: "user",
};
const lee: Actor = {
  id: "person:lee",
  level: "person",
  memberships: ["person:lee", "role:release", "team:x"],
  source: "user",
};
const toSam: Grant = { to: "person:sam", class: "semantic", mode: "read", expires: UNTIL };
const toLee: Grant = { ...toSam, to: "person:lee" };

type Method = "write" | "delete" | "list" | "read";
interface Pause {
  /** Resolves when the paused call arrives. */
  arrived: Promise<void>;
  release(): void;
}

/**
 * One handle's view of the shared store: `pause(method, when)` holds the next
 * call of that method before or after it reaches the store, until released.
 */
function pausable(store: Adapter) {
  const armed = new Map<string, { arrive: () => void; gate: Promise<void> }>();
  const at = async (method: Method, when: "before" | "after") => {
    const key = `${method}:${when}`;
    const hold = armed.get(key);
    if (!hold) return;
    armed.delete(key);
    hold.arrive();
    await hold.gate;
  };
  const adapter: Adapter = Object.assign(Object.create(store) as Adapter, {
    write: async (it: MemoryItem) => {
      await at("write", "before");
      const ref = await store.write(it);
      await at("write", "after");
      return ref;
    },
    delete: async (ref: StoreRef) => {
      await at("delete", "before");
      await store.delete(ref);
      await at("delete", "after");
    },
    list: async (scope: string) => {
      await at("list", "before");
      const listed = await store.list(scope);
      await at("list", "after");
      return listed;
    },
    read: async (ref: StoreRef) => {
      await at("read", "before");
      const got = await store.read(ref);
      await at("read", "after");
      return got;
    },
  });
  const pause = (method: Method, when: "before" | "after" = "before"): Pause => {
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
  return { adapter, pause };
}

/**
 * The handle `db`, whose next outermost transaction first runs `hook`: what
 * another process commits between a decision read outside the lock and the
 * commit that follows it.
 */
function hooked(db: Db) {
  let hook: (() => void) | null = null;
  let depth = 0;
  const wrapped: Db = {
    dialect: db.dialect,
    exec: (sql) => db.exec(sql),
    prepare: (sql) => db.prepare(sql),
    transaction<T>(fn: () => T): T {
      if (depth === 0 && hook) {
        const h = hook;
        hook = null;
        h();
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
  return { db: wrapped, onNextTransaction: (h: () => void) => (hook = h) };
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
  return {
    mine,
    theirs,
    store,
    a,
    b,
    hook,
    depsMine,
    depsTheirs,
    plane: createPlane(depsMine),
    planeTheirs: createPlane(depsTheirs),
    newTheirsId: () => id(700_000 + ++n),
  };
}
type Env = ReturnType<typeof setup>;

async function seedPerson(env: Env, grants: Grant[] = []) {
  const r = await env.plane.write(
    dana,
    item(1, { scope: "person:dana", owner: dana.id, content: SECRET, grants }),
    AT,
  );
  expect(r.event.decision).toBe("allow");
  return r.item as MemoryItem;
}

async function seedRole(env: Env, grants: Grant[] = []) {
  const r = await env.plane.write(
    dana,
    item(2, {
      scope: "role:release",
      owner: dana.id,
      content: "The release train leaves at 3.",
      grants,
    }),
    AT,
  );
  expect(r.event.decision).toBe("allow");
  return r.item as MemoryItem;
}

/** Offboards Dana on the other handle: her person scope erased, nothing handed over. */
const offboardTheirs = (env: Env) =>
  offboard(env.depsTheirs, hr, { person: "person:dana", roles: [] }, AT);

/**
 * Nothing of item 1 (erased with person:dana) is anywhere: projection, store,
 * a rebuild, a read by the grantee or the owner, before and after the next
 * adoption, or any event's text.
 */
async function nothingErasedReturns(env: Env) {
  expect(itemById(env.mine, id(1))).toBeUndefined();
  expect((await env.store.list("person:dana")).map((i) => i.content)).toEqual([]);
  rebuild(env.mine);
  expect(itemById(env.mine, id(1))).toBeUndefined();
  expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
  await adoptStoreItems(env.depsMine, dana, "person:dana", LATER);
  expect(itemById(env.mine, id(1))).toBeUndefined();
  expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
  expect((await env.plane.read(dana, { at: LATER })).items.map((i) => i.id)).not.toContain(id(1));
  expect(JSON.stringify(allEvents(env.mine))).not.toContain("Mira");
}

/** The store holds exactly the projected item, as the log has it. */
async function storeMatches(env: Env, itemId: string) {
  const now = itemById(env.mine, itemId) as MemoryItem;
  expect(now).toBeDefined();
  expect(await env.store.read(now.store_ref as StoreRef)).toEqual(now);
  return now;
}

/** The allowed events of an item, as `<policy_id>:v<version>`. */
const _allowedVersions = (env: Env, itemId: string) =>
  eventsByItem(env.mine, itemId)
    .filter((e) => e.decision === "allow" && e.item)
    .map((e) => `${e.policy_id}:v${e.item?.version}`);

// ---------------------------------------------------------------- reviewer's orderings

/** An adapter over `inner` whose writes matching `when` wait on `hold()` first, and whose next delete may fail once. */
function steerable(inner: Adapter) {
  let hold: ((it: MemoryItem) => Promise<void> | undefined) | null = null;
  let failDelete = 0;
  let failWrite = 0;
  const adapter: Adapter = Object.assign(Object.create(inner) as Adapter, {
    write: async (it: MemoryItem) => {
      const h = hold?.(it);
      if (h) await h;
      if (failWrite > 0) {
        failWrite--;
        throw new Error("simulated crash at a store write");
      }
      return inner.write(it);
    },
    delete: async (ref: StoreRef) => {
      if (failDelete > 0) {
        failDelete--;
        throw new Error("simulated crash at a store delete");
      }
      return inner.delete(ref);
    },
  });
  return {
    adapter,
    onWrite: (h: typeof hold) => {
      hold = h;
    },
    failNextDelete: () => {
      failDelete = 1;
    },
    failNextWrite: () => {
      failWrite = 1;
    },
  };
}

const versionsOf = (env: Env, itemId: string) =>
  eventsByItem(env.mine, itemId)
    .filter((e) => e.decision === "allow" && e.item)
    .map((e) => e.item?.version as number);

/** Each allowed version of an item is at least the one before, and the plane's own recovery always raises it. */
function monotonic(env: Env, itemId: string) {
  const events = eventsByItem(env.mine, itemId).filter((e) => e.decision === "allow" && e.item);
  for (let i = 1; i < events.length; i++) {
    const was = events[i - 1]?.item?.version as number;
    const now = events[i]?.item?.version as number;
    expect(now, `version at event ${events[i]?.seq}`).toBeGreaterThanOrEqual(was);
    if ((events[i]?.policy_id ?? "").startsWith("engram/adopt/"))
      expect(now, `the plane's own ${events[i]?.policy_id} raises the version`).toBeGreaterThan(
        was,
      );
  }
}

const OFFBOARD_WITH_ROLE = {
  person: "person:dana",
  roles: [{ scope: "role:release", successor: "person:lee" }],
};

forEachBackend((backend) => {
  describe("verification of PR #50's review fix pass", () => {
    test("V1: an offboarding that stopped after its mark is closed by the rerun's report, and the rerun deletes what was left", async () => {
      const env = setup(backend);
      await seedPerson(env);
      await seedRole(env);
      const st = steerable(env.depsTheirs.adapter);
      st.failNextWrite();
      await expect(
        offboard({ ...env.depsTheirs, adapter: st.adapter }, hr, OFFBOARD_WITH_ROLE, AT),
      ).rejects.toThrow(/simulated crash/);
      expect(erasureOpen(env.mine, "person:dana")).toBe(true);
      // A write that never committed, left in the store while the scope was frozen.
      await env.store.write(
        item(9, { scope: "person:dana", owner: dana.id, content: "Mira again." }),
      );
      const rerun = await offboard(env.depsTheirs, hr, OFFBOARD_WITH_ROLE, AT);
      expect(rerun.decision).toBe("allow");
      expect(erasureOpen(env.mine, "person:dana")).toBe(false);
      expect(await env.store.list("person:dana")).toEqual([]);
      await adoptStoreItems(env.depsMine, dana, "person:dana", LATER);
      expect(await env.store.list("person:dana")).toEqual([]);
      expect(itemById(env.mine, id(9))).toBeUndefined();
      expect(JSON.stringify(allEvents(env.mine))).not.toContain("Mira");
    });

    test("V2: a stale writer does not withdraw an adoption the owner has built on since; their later edit stands", async () => {
      const env = setup(backend);
      const role = await seedRole(env, [toSam, toLee]);
      const before = env.a.pause("write", "before");
      const stale = env.plane.write(
        dana,
        {
          ...role,
          version: 2,
          content: "The release train leaves at 4.",
          store_ref: null,
        } as MemoryItem,
        AT,
      );
      await before.arrived;
      expect(
        (await env.planeTheirs.changeGrants(dana, role.id, { remove: [toSam] }, AT)).decision,
      ).toBe("allow");
      const after = env.a.pause("write", "after");
      before.release();
      await after.arrived;
      await adoptStoreItems(env.depsTheirs, dana, "role:release", AT);
      const cur = itemById(env.mine, role.id) as MemoryItem;
      await env.store.write({
        ...cur,
        version: cur.version + 1,
        grants: [],
        content: "Hand edit: train at 5, no grants.",
        store_ref: null,
      } as MemoryItem);
      expect((await adoptStoreItems(env.depsTheirs, dana, "role:release", AT)).allowed).toBe(1);
      after.release();
      expect((await stale).event.policy_id).toBe(WRITE_CONFLICT);
      const now = await storeMatches(env, role.id);
      expect(now.content).toBe("Hand edit: train at 5, no grants.");
      expect(now.grants).toEqual([]);
      expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
      monotonic(env, role.id);
    });

    test("V3 and V8: a withdrawal raises the version, a write after it lands, and the dogfood report finds nothing", async () => {
      const env = setup(backend);
      const role = await seedRole(env, [toSam]);
      const before = env.a.pause("write", "before");
      const stale = env.plane.write(
        dana,
        {
          ...role,
          version: 2,
          content: "The release train leaves at 4.",
          store_ref: null,
        } as MemoryItem,
        AT,
      );
      await before.arrived;
      await env.planeTheirs.changeGrants(dana, role.id, { remove: [toSam] }, AT);
      const after = env.a.pause("write", "after");
      before.release();
      await after.arrived;
      await adoptStoreItems(env.depsTheirs, dana, "role:release", AT);
      after.release();
      await stale;
      expect(
        eventsByItem(env.mine, role.id).filter((e) => e.policy_id === "engram/adopt/withdrawn"),
      ).toHaveLength(1);
      monotonic(env, role.id);
      const versions = versionsOf(env, role.id);
      expect(versions.at(-1)).toBe(3);
      const now = itemById(env.mine, role.id) as MemoryItem;
      const w = await env.plane.write(
        dana,
        { ...now, version: now.version + 1, content: "next", store_ref: null } as MemoryItem,
        AT,
      );
      expect(w.event.decision).toBe("allow");
      const rep = dogfoodReport(allEvents(env.mine), env.depsMine.policy, [dana, hr, sam, lee]);
      expect(rep.details).toEqual([]);
      expect(rep.report.violations.total).toBe(0);
      // The withdrawal narrowed the grants, but it is no narrowing by another (M12).
      expect(rep.report.watch.narrowed).toBe(0);
    });

    test("V4: a planted withdrawal that restores a grant the owner removed is a violation", async () => {
      const env = setup(backend);
      const role = await seedRole(env, [toSam]);
      expect((await env.plane.changeGrants(dana, role.id, { remove: [toSam] }, AT)).decision).toBe(
        "allow",
      );
      const now = itemById(env.mine, role.id) as MemoryItem;
      appendEvent(env.mine, {
        id: env.newTheirsId(),
        ts: LATER,
        op: "update",
        item_id: role.id,
        actor: "person:mallory",
        scope_from: now.scope,
        scope_to: now.scope,
        decision: "allow",
        reason: "planted",
        policy_id: "engram/adopt/withdrawn",
        item: { ...role, version: now.version + 1 } as MemoryItem,
        schema_version: 1,
      });
      const rep = dogfoodReport(allEvents(env.mine), env.depsMine.policy, [dana, hr, sam, lee]);
      expect(rep.report.violations.grant_change).toBe(1);
    });

    test("V5: after a completed offboarding, a write and a new hand-written record in the person scope are treated alike", async () => {
      const env = setup(backend);
      await seedPerson(env);
      await offboardTheirs(env);
      const w = await env.plane.write(
        dana,
        item(20, { scope: "person:dana", owner: dana.id, content: "New job notes." }),
        LATER,
      );
      expect(w.event.decision).toBe("allow");
      await env.store.write(
        item(21, { scope: "person:dana", owner: dana.id, content: "Hand-written after rehire." }),
      );
      const rep = await adoptStoreItems(env.depsMine, dana, "person:dana", LATER);
      expect(rep.denials).toEqual([]);
      expect((await env.store.list("person:dana")).map((i) => i.content).sort()).toEqual([
        "Hand-written after rehire.",
        "New job notes.",
      ]);
      expect(itemById(env.mine, id(21))?.status).toBe("active");
    });

    test("V6, V9, V10: a purge whose delete fails is recorded once per error, and its reasons say what happened", async () => {
      const env = setup(backend);
      const seeded = await seedPerson(env);
      await offboardTheirs(env);
      await env.store.write({
        ...seeded,
        version: 2,
        content: "leftover",
        store_ref: null,
      } as MemoryItem);
      let mode: "transient" | "ok" | "always" = "transient";
      const inner = env.depsMine.adapter;
      const adapter: Adapter = Object.assign(Object.create(inner) as Adapter, {
        delete: async (ref: StoreRef) => {
          if (mode === "transient") {
            mode = "ok";
            throw new Error("EBUSY");
          }
          if (mode === "always") throw new Error("EACCES");
          return inner.delete(ref);
        },
      });
      const deps = { ...env.depsMine, adapter };
      const n0 = allEvents(env.mine).length;
      await adoptStoreItems(deps, dana, "person:dana", LATER);
      const first = allEvents(env.mine).slice(n0);
      expect(first.map((e) => e.policy_id)).toEqual(["engram/adopt/erased", STORE_FAILURE]);
      expect(first[0]?.reason).not.toMatch(/the record is deleted/);
      expect(first[1]?.reason).toMatch(/EBUSY/);
      expect(await env.store.list("person:dana")).toHaveLength(1);
      // The retry deletes it, and says so once.
      await adoptStoreItems(deps, dana, "person:dana", LATER);
      expect(await env.store.list("person:dana")).toEqual([]);
      await env.store.write({
        ...seeded,
        version: 3,
        content: "leftover2",
        store_ref: null,
      } as MemoryItem);
      mode = "always";
      const n1 = allEvents(env.mine).length;
      for (let i = 0; i < 5; i++) await adoptStoreItems(deps, dana, "person:dana", LATER);
      const failing = allEvents(env.mine).slice(n1);
      expect(failing.map((e) => e.policy_id)).toEqual(["engram/adopt/erased", STORE_FAILURE]);
      expect(JSON.stringify(allEvents(env.mine))).not.toContain("leftover");
    });

    test("V7: a store refusing the delete for good keeps the record refused, with one event saying so and none after", async () => {
      const env = setup(backend);
      const seeded = await seedPerson(env);
      await offboardTheirs(env);
      await env.store.write({
        ...seeded,
        version: 2,
        content: "leftover",
        store_ref: null,
      } as MemoryItem);
      const adapter: Adapter = Object.assign(Object.create(env.depsMine.adapter) as Adapter, {
        delete: async () => {
          throw new NotDeletableError("read-only memory file");
        },
      });
      const deps = { ...env.depsMine, adapter };
      const n0 = allEvents(env.mine).length;
      await adoptStoreItems(deps, dana, "person:dana", LATER);
      const first = allEvents(env.mine).slice(n0);
      expect(first.map((e) => e.policy_id)).toEqual(["engram/adopt/erased", STORE_FAILURE]);
      expect(first[1]?.reason).toMatch(/refuses the delete for good/);
      const n1 = allEvents(env.mine).length;
      for (let i = 0; i < 3; i++) await adoptStoreItems(deps, dana, "person:dana", LATER);
      expect(allEvents(env.mine)).toHaveLength(n1);
      expect(await env.store.list("person:dana")).toHaveLength(1);
      expect(itemById(env.mine, id(1))).toBeUndefined();
    });

    test("V8b: new ids in role and team scopes after an erasure are judged by the gate, never deleted", async () => {
      const env = setup(backend);
      await seedPerson(env);
      await offboardTheirs(env);
      await env.store.write(
        item(30, { scope: "role:release", owner: lee.id, content: "Lee note." }),
      );
      await env.store.write(
        item(31, { scope: "team:x", owner: lee.id, content: "Lee team note." }),
      );
      expect((await adoptStoreItems(env.depsMine, lee, "role:release", LATER)).allowed).toBe(1);
      // The twin profile's team rule takes no import: refused by the gate, never deleted.
      const team = await adoptStoreItems(env.depsMine, lee, "team:x", LATER);
      expect(team.denials.map((d) => d.policy_id)).toEqual(["profile.twin/write/team"]);
      expect(await env.store.list("role:release")).toHaveLength(1);
      expect(await env.store.list("team:x")).toHaveLength(1);
    });

    test("V9: stale bytes adopted and built on: the plane removes the grant they reintroduced, and says so", async () => {
      const env = setup(backend);
      const role = await seedRole(env, [toSam, toLee]);
      const before = env.a.pause("write", "before");
      const stale = env.plane.write(
        dana,
        {
          ...role,
          version: 2,
          content: "The release train leaves at 4.",
          store_ref: null,
        } as MemoryItem,
        AT,
      );
      await before.arrived;
      await env.planeTheirs.changeGrants(dana, role.id, { remove: [toSam] }, AT);
      const after = env.a.pause("write", "after");
      before.release();
      await after.arrived;
      await adoptStoreItems(env.depsTheirs, dana, "role:release", AT);
      expect(
        (await env.planeTheirs.changeGrants(dana, role.id, { remove: [toLee] }, AT)).decision,
      ).toBe("allow");
      after.release();
      const r = await stale;
      expect(r.event.policy_id).toBe(WRITE_CONFLICT);
      expect(r.event.reason).toMatch(/removed the grant to person:sam/);
      const now = await storeMatches(env, role.id);
      expect(now.grants).toEqual([]);
      // The edit the adoption carried in stays; only the grant goes.
      expect(now.content).toBe("The release train leaves at 4.");
      const narrowed = eventsByItem(env.mine, role.id).filter(
        (e) => e.policy_id === "engram/adopt/narrowed",
      );
      expect(narrowed).toHaveLength(1);
      expect(narrowed[0]?.decision).toBe("allow");
      expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
      monotonic(env, role.id);
      const rep = dogfoodReport(allEvents(env.mine), env.depsMine.policy, [dana, hr, sam, lee]);
      expect(rep.report.violations.total).toBe(0);
    });

    test("M13: a writer whose own bytes were adopted before its commit commits them as its own", async () => {
      const env = setup(backend);
      const after = env.a.pause("write", "after");
      const pending = env.plane.write(
        dana,
        item(40, { scope: "person:dana", owner: dana.id, content: "A new note." }),
        AT,
      );
      await after.arrived;
      expect((await adoptStoreItems(env.depsTheirs, dana, "person:dana", AT)).allowed).toBe(1);
      after.release();
      const r = await pending;
      expect(r.event.decision).toBe("allow");
      const now = await storeMatches(env, id(40));
      expect(now).toMatchObject({ status: "active", provenance: { kind: "user" } });
    });

    test("M14: a repair landing after an offboarding began deleting is deleted again", async () => {
      const env = setup(backend);
      await seedPerson(env);
      const w1 = env.a.pause("write", "before");
      const stale = env.plane.changeGrants(dana, id(1), { add: [toLee] }, AT);
      await w1.arrived;
      expect((await env.planeTheirs.changeGrants(dana, id(1), { add: [toSam] }, AT)).decision).toBe(
        "allow",
      );
      w1.release();
      // The stale change found its conflict; its repair write is held.
      const w2 = env.a.pause("write", "before");
      await w2.arrived;
      const d = env.b.pause("delete", "after");
      const off = offboardTheirs(env);
      await d.arrived;
      w2.release();
      expect((await stale).event.policy_id).toBe(GRANT_CONFLICT);
      // The erasure has not committed yet: the repair that landed after the
      // offboarding began is deleted by its own writer, not left for later.
      expect(await env.store.list("person:dana")).toEqual([]);
      d.release();
      await off;
      await nothingErasedReturns(env);
    });

    for (const [name, policy_id] of [
      ["M7c: another process's conflict deny", WRITE_CONFLICT],
      ["M7b: another process's store failure", STORE_FAILURE],
    ] as const)
      test(`${name} on the item makes a pending decision stale`, async () => {
        const env = setup(backend);
        await seedPerson(env);
        const w = env.a.pause("write");
        const pending = env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT);
        await w.arrived;
        appendEvent(env.theirs, {
          id: env.newTheirsId(),
          ts: AT,
          op: "write",
          item_id: id(1),
          actor: dana.id,
          scope_from: null,
          scope_to: "person:dana",
          decision: "deny",
          reason: "simulated: another process's store write for this item did not stand",
          policy_id,
          schema_version: 1,
        });
        w.release();
        expect((await pending).event.policy_id).toBe(GRANT_CONFLICT);
        await storeMatches(env, id(1));
      });
  });
});
