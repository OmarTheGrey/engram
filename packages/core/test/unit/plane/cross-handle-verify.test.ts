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
import {
  allEvents,
  appendEvent,
  currentItems,
  eventsByItem,
  rebuild,
} from "../../../src/events.ts";
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

    // Card RV4: adoption keeps only the grants the plane's item of that id
    // carries, so the adoption of the stale bytes drops Sam's grant itself
    // and says so; nothing is reintroduced, and the stale writer's narrowing
    // (engram/adopt/narrowed) has nothing left to remove.
    test("V9: stale bytes adopted and built on: the adoption drops the grant they would reintroduce, and says so", async () => {
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
      const adoption = eventsByItem(env.mine, role.id).at(-1);
      expect(adoption?.decision).toBe("allow");
      expect(adoption?.reason).toMatch(/adoption dropped the grant to person:sam/);
      expect(adoption?.item?.grants).toEqual([toLee]);
      expect(
        (await env.planeTheirs.changeGrants(dana, role.id, { remove: [toLee] }, AT)).decision,
      ).toBe("allow");
      after.release();
      const r = await stale;
      expect(r.event.policy_id).toBe(WRITE_CONFLICT);
      const now = await storeMatches(env, role.id);
      expect(now.grants).toEqual([]);
      // The edit the adoption carried in stays; the grant never came back.
      expect(now.content).toBe("The release train leaves at 4.");
      expect(
        eventsByItem(env.mine, role.id).filter((e) => e.policy_id === "engram/adopt/narrowed"),
      ).toEqual([]);
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

const withTimeout = <T>(p: Promise<T>, ms: number, what: string) =>
  Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timeout: ${what}`)), ms)),
  ]);

/** A reviewer of Dana's person scope who is also in the team: a promotion to team:x needs one. */
const REVIEWER: Actor = {
  id: "person:rev",
  level: "person",
  memberships: ["person:rev", "person:dana", "team:x"],
  source: "user",
};

/** Dana's stale rewrite of `role`, decided now, its bytes landed and held before its commit. */
async function staleBytesLanded(env: Env, role: MemoryItem, content: string) {
  const before = env.a.pause("write", "before");
  const stale = env.plane.write(
    dana,
    { ...role, version: role.version + 1, content, store_ref: null } as MemoryItem,
    AT,
  );
  await before.arrived;
  return {
    stale,
    land: async () => {
      const after = env.a.pause("write", "after");
      before.release();
      await after.arrived;
      return after;
    },
  };
}

forEachBackend((backend) => {
  describe("verification pass 3 of PR #50", () => {
    test("Q2a: a crashed promotion of an erased item to a fresh id in the person scope is refused and deleted by adoption", async () => {
      const env = setup(backend);
      expect(
        (
          await env.plane.write(
            dana,
            item(1, { scope: "person:dana", owner: dana.id, content: SECRET, class: "episodic" }),
            AT,
          )
        ).event.decision,
      ).toBe("allow");
      const before = env.a.pause("write", "before");
      const p = env.plane.promote(hr, id(1), "person:dana", AT, { review: true });
      p.catch(() => {});
      await withTimeout(before.arrived, 3000, "the promotion never reached the store");
      expect((await offboardTheirs(env)).decision).toBe("allow");
      env.hook.onNextTransaction(() => {
        throw new Error("simulated crash at commit");
      });
      before.release();
      await expect(p).rejects.toThrow(/simulated crash/);
      const report = await adoptStoreItems(env.depsMine, dana, "person:dana", LATER);
      expect(report.allowed).toBe(0);
      expect(report.denials.map((d) => d.policy_id)).toEqual(["engram/adopt/erased"]);
      expect(await env.store.list("person:dana")).toEqual([]);
      expect(JSON.stringify(currentItems(env.mine))).not.toContain("Mira");
      expect((await env.plane.read(dana, { at: LATER })).items).toEqual([]);
    });

    test("Q2b: a crashed promotion of a person item to the team scope, landing after the erasure, is refused and deleted by adoption", async () => {
      const env = setup(backend);
      await seedPerson(env);
      const before = env.a.pause("write", "before");
      const p = env.plane.promote(REVIEWER, id(1), "team:x", AT, { review: true });
      p.catch(() => {});
      const got = await Promise.race([
        before.arrived.then(() => "arrived"),
        p.then((r) => `decided ${r.decision} ${r.event.policy_id}`),
      ]);
      expect(got).toBe("arrived");
      await offboardTheirs(env);
      env.hook.onNextTransaction(() => {
        throw new Error("simulated crash at commit");
      });
      before.release();
      await expect(p).rejects.toThrow(/simulated crash/);
      const report = await adoptStoreItems(env.depsMine, lee, "team:x", LATER);
      expect(report.allowed).toBe(0);
      expect(report.denials.map((d) => d.policy_id)).toEqual(["engram/adopt/erased"]);
      expect(await env.store.list("team:x")).toEqual([]);
      expect(JSON.stringify(currentItems(env.mine))).not.toContain("Mira");
    });

    test("Q2c: the same crash landing before the sweep is swept from the team scope by the offboarding", async () => {
      const env = setup(backend);
      await seedPerson(env);
      const after = env.a.pause("write", "after");
      const p = env.plane.promote(REVIEWER, id(1), "team:x", AT, { review: true });
      p.catch(() => {});
      await withTimeout(after.arrived, 3000, "the promotion never reached the store");
      env.hook.onNextTransaction(() => {
        throw new Error("simulated crash at commit");
      });
      after.release();
      await expect(p).rejects.toThrow(/simulated crash/);
      expect(await env.store.list("team:x")).toHaveLength(1);
      await offboardTheirs(env);
      expect(await env.store.list("team:x")).toEqual([]);
      expect(
        allEvents(env.mine).filter((e) => e.policy_id === "engram/offboard/swept"),
      ).toHaveLength(1);
    });

    test("Q2d: a write whose lineage names an erased item is refused", async () => {
      const env = setup(backend);
      await seedPerson(env);
      await offboardTheirs(env);
      const derived = item(40, {
        scope: "team:x",
        owner: lee.id,
        content: SECRET,
        lineage: [id(1)],
      });
      // Refused at the decision, before any store write: the pi extension's
      // tool_call check gives the same refusal (decision D12).
      expect((await env.plane.checkWrite(lee, derived, LATER)).policy_id).toBe(
        "engram/write/erased",
      );
      const writes: string[] = [];
      const counted = createPlane({
        ...env.depsMine,
        adapter: Object.assign(Object.create(env.depsMine.adapter) as Adapter, {
          write: async (it: MemoryItem) => {
            writes.push(it.id);
            return env.depsMine.adapter.write(it);
          },
        }),
      });
      const w = await counted.write(lee, derived, LATER);
      expect(w.event).toMatchObject({ decision: "deny", policy_id: "engram/write/erased" });
      expect(writes).toEqual([]);
      expect(await env.store.list("team:x")).toEqual([]);
    });

    test("Q1/Q4: an overlapping offboarding's sweep never deletes a write committed meanwhile", async () => {
      const env = setup(backend);
      await seedPerson(env);
      const listA = env.b.pause("list", "before");
      const A = offboardTheirs(env);
      await withTimeout(listA.arrived, 3000, "A never reached its sweep");
      expect(erasureOpen(env.mine, "person:dana")).toBe(true);
      expect(
        (await offboard(env.depsMine, hr, { person: "person:dana", roles: [] }, AT)).decision,
      ).toBe("allow");
      const wAfter = env.a.pause("write", "after");
      const W = env.plane.write(
        dana,
        item(30, { scope: "person:dana", owner: dana.id, content: "Fresh after rehire." }),
        LATER,
      );
      await withTimeout(wAfter.arrived, 3000, "W never reached the store");
      const delA = env.b.pause("delete", "before");
      listA.release();
      await withTimeout(delA.arrived, 3000, "A never deleted");
      wAfter.release();
      expect((await W).event.decision).toBe("allow");
      delA.release();
      await A;
      expect((await storeMatches(env, id(30))).status).toBe("active");
      expect(
        eventsByItem(env.mine, id(30)).filter((e) => e.policy_id === "engram/offboard/swept"),
      ).toEqual([]);
    });

    test("V3-5: a report closes only the marks open when its own began: A begins, B begins, A reports, and the scope stays frozen", async () => {
      const env = setup(backend);
      await seedPerson(env);
      const listA = env.b.pause("list", "before");
      const A = offboardTheirs(env);
      await withTimeout(listA.arrived, 3000, "A never reached its sweep");
      const listB = env.a.pause("list", "before");
      const B = offboard(env.depsMine, hr, { person: "person:dana", roles: [] }, AT);
      await withTimeout(listB.arrived, 3000, "B never reached its sweep");
      listA.release();
      await A;
      expect(erasureOpen(env.mine, "person:dana")).toBe(true);
      const w = await env.planeTheirs.write(
        dana,
        item(31, { scope: "person:dana", owner: dana.id, content: "Too early." }),
        LATER,
      );
      expect(w.event).toMatchObject({ decision: "deny", policy_id: "engram/offboard/erasing" });
      listB.release();
      await B;
      expect(erasureOpen(env.mine, "person:dana")).toBe(false);
    });

    test("Q3b: a narrowing keeps a grant the owner removed and then deliberately added again after the adoption", async () => {
      const env = setup(backend);
      const role = await seedRole(env, [toSam]);
      const { stale, land } = await staleBytesLanded(env, role, "The release train leaves at 4.");
      expect(
        (await env.planeTheirs.changeGrants(dana, role.id, { remove: [toSam] }, AT)).decision,
      ).toBe("allow");
      const after = await land();
      await adoptStoreItems(env.depsTheirs, dana, "role:release", AT);
      // The adoption did not reintroduce the removed grant (card RV4: it
      // keeps only grants the plane's item carries); the owner grants Sam
      // again on purpose.
      expect(itemById(env.mine, role.id)?.grants).toEqual([]);
      expect(
        (await env.planeTheirs.changeGrants(dana, role.id, { add: [toSam] }, AT)).decision,
      ).toBe("allow");
      after.release();
      expect((await stale).event.policy_id).toBe(WRITE_CONFLICT);
      const now = await storeMatches(env, role.id);
      expect(now.grants).toEqual([toSam]);
      expect(
        eventsByItem(env.mine, role.id).filter((e) => e.policy_id === "engram/adopt/narrowed"),
      ).toEqual([]);
    });

    test("Q3: planted narrowings and withdrawals that change content or add grants are each a violation", async () => {
      const env = setup(backend);
      const role = await seedRole(env, [toSam]);
      const now = itemById(env.mine, role.id) as MemoryItem;
      const plant = (policy_id: string, it: MemoryItem, reason = "planted") =>
        appendEvent(env.mine, {
          id: env.newTheirsId(),
          ts: LATER,
          op: "update",
          item_id: role.id,
          actor: "person:mallory",
          scope_from: now.scope,
          scope_to: now.scope,
          decision: "allow",
          reason,
          policy_id,
          item: it,
          schema_version: 1,
        });
      const count = () =>
        dogfoodReport(allEvents(env.mine), env.depsMine.policy, [dana, hr, sam, lee]).report
          .violations.grant_change;
      plant("engram/adopt/narrowed", {
        ...now,
        version: now.version + 1,
        content: "planted content",
      } as MemoryItem);
      expect(count()).toBe(1);
      plant("engram/adopt/narrowed", {
        ...now,
        version: now.version + 2,
        content: "planted content",
      } as MemoryItem);
      expect(count()).toBe(2);
      plant("engram/adopt/narrowed", {
        ...now,
        version: now.version + 3,
        content: "planted content",
        grants: [toSam, toLee],
      } as MemoryItem);
      expect(count()).toBe(3);
      plant(
        "engram/adopt/withdrawn",
        {
          ...now,
          version: now.version + 4,
          content: "anything",
          grants: [toSam, toLee],
        } as MemoryItem,
        "planted withdrawal naming nothing",
      );
      expect(count()).toBe(4);
    });

    test("V3-7: a record the sweep could not delete for good is adopted again once the person edits it", async () => {
      const env = setup(backend);
      await seedPerson(env);
      await env.store.write(item(9, { scope: "person:dana", owner: dana.id, content: "Left." }));
      const adapter: Adapter = Object.assign(Object.create(env.depsTheirs.adapter) as Adapter, {
        delete: async (ref: StoreRef) => {
          if (ref.key === id(9)) throw new NotDeletableError("read-only memory file");
          return env.depsTheirs.adapter.delete(ref);
        },
      });
      await offboard({ ...env.depsTheirs, adapter }, hr, { person: "person:dana", roles: [] }, AT);
      const first = await adoptStoreItems(env.depsMine, dana, "person:dana", LATER);
      expect(first.allowed).toBe(0);
      await env.store.write(
        item(9, { scope: "person:dana", owner: dana.id, content: "Edited after leaving." }),
      );
      const again = await adoptStoreItems(env.depsMine, dana, "person:dana", LATER);
      expect(again.allowed).toBe(1);
      expect(itemById(env.mine, id(9))?.content).toBe("Edited after leaving.");
    });
  });
});

forEachBackend((backend) => {
  describe("verification pass 4 of PR #50", () => {
    test("P8: a derived team write decided before the mark and committed after the offboarding is refused, and its record deleted", async () => {
      const env = setup(backend);
      await seedPerson(env, [toLee]);
      const before = env.a.pause("write", "before");
      const w = env.plane.write(
        lee,
        item(50, { scope: "team:x", owner: lee.id, content: SECRET, lineage: [id(1)] }),
        AT,
      );
      await withTimeout(before.arrived, 3000, "the write never reached the store");
      expect((await offboardTheirs(env)).decision).toBe("allow");
      before.release();
      const r = await w;
      expect(r.item).toBeNull();
      expect(r.event).toMatchObject({ decision: "deny", policy_id: "engram/write/erased" });
      expect(await env.store.list("team:x")).toEqual([]);
      expect(itemById(env.mine, id(50))).toBeUndefined();
      expect((await env.plane.read(lee, { at: LATER })).items).toEqual([]);
      expect(JSON.stringify(currentItems(env.mine))).not.toContain("Mira");
    });

    test("P8b: the same write landing before the sweep and committing between the sweep's delete and its check is refused", async () => {
      const env = setup(backend);
      await seedPerson(env, [toLee]);
      const after = env.a.pause("write", "after");
      const w = env.plane.write(
        lee,
        item(51, { scope: "team:x", owner: lee.id, content: SECRET, lineage: [id(1)] }),
        AT,
      );
      await withTimeout(after.arrived, 3000, "the write never reached the store");
      const del = env.b.pause("delete", "after");
      const off = offboardTheirs(env);
      await withTimeout(del.arrived, 3000, "no erasure delete");
      const del2 = env.b.pause("delete", "after");
      del.release();
      await Promise.race([del2.arrived, off]);
      after.release();
      const r = await w;
      expect(r.event).toMatchObject({ decision: "deny", policy_id: "engram/write/erased" });
      del2.release();
      await off;
      expect(await env.store.list("team:x")).toEqual([]);
      expect(itemById(env.mine, id(51))).toBeUndefined();
      expect(JSON.stringify(currentItems(env.mine))).not.toContain("Mira");
    });

    test("V4-4: a lineage naming a swept id is refused at a write and at adoption", async () => {
      const env = setup(backend);
      await seedPerson(env);
      // A never-committed record the offboarding sweeps.
      await env.store.write(item(9, { scope: "person:dana", owner: dana.id, content: "Left." }));
      await offboardTheirs(env);
      expect(
        eventsByItem(env.mine, id(9)).filter((e) => e.policy_id === "engram/offboard/swept"),
      ).toHaveLength(1);
      const w = await env.plane.write(
        lee,
        item(52, { scope: "team:x", owner: lee.id, content: "Copied.", lineage: [id(9)] }),
        LATER,
      );
      expect(w.event).toMatchObject({ decision: "deny", policy_id: "engram/write/erased" });
      await env.store.write(
        item(53, { scope: "role:release", owner: lee.id, content: "Copied.", lineage: [id(9)] }),
      );
      const report = await adoptStoreItems(env.depsMine, lee, "role:release", LATER);
      expect(report.denials.map((d) => d.policy_id)).toEqual(["engram/adopt/erased"]);
      expect(await env.store.list("role:release")).toEqual([]);
    });
  });
});
