// The review of PR #50 (card E2.6): the reviewer's orderings RV1 to RV9, on
// two handles of one log and one store, on SQLite and embedded Postgres,
// turned from probes that printed into assertions. RV1, RV6 and RV9 held
// already; RV1b (a second offboarding's report closing the first one's
// mark), RV2 (a handover giving up silently), RV3 to RV5 (a writer that
// throws or whose repair fails, leaving bytes in an offboarded scope), RV7 (a
// gate's deny counted as a change) and RV8 (an adoption of a stale writer's
// bytes bringing a removed grant back) are findings P50-1 to P50-5 of that
// review. The helpers are those of cross-handle.test.ts.
import { readFileSync } from "node:fs";
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import type { Adapter, StoreRef } from "../../../src/adapter.ts";
import type { Db } from "../../../src/db/db.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { allEvents, appendEvent, ERASURE_ID, eventsByItem, rebuild } from "../../../src/events.ts";
import { itemById } from "../../../src/items.ts";
import {
  type Actor,
  adoptStoreItems,
  createPlane,
  HANDOVER_ID,
  offboard,
  type PlaneDeps,
} from "../../../src/plane.ts";
import { parsePolicy } from "../../../src/policy/load.ts";
import type { Grant, MemoryItem } from "../../../src/schema.ts";
import { visibleEvents } from "../../../src/visible.ts";
import { type Backend, forEachBackend } from "../../db/backends.ts";
import { reply, scriptedLintModel } from "../../fakes/lint-model.ts";
import { id, item } from "./helpers.ts";

const PROFILE = new URL("../../../../pi-package/profiles/twin.yaml", import.meta.url);
const twin = () => parsePolicy(readFileSync(PROFILE, "utf8"), "twin.yaml");
const AT = "2026-11-19T10:00:00Z";
const LATER = "2026-11-19T11:00:00Z";
const UNTIL = "2026-12-19T00:00:00Z";
const SECRET = "Dana's sister is Mira.";

const WRITE_CONFLICT = "engram/write/conflict";
const GRANT_CONFLICT = "engram/grant/conflict";
const PROMOTE_CONFLICT = "engram/promote/conflict";
const HANDOVER_CONFLICT = "engram/offboard/conflict";
const ERASING = "engram/offboard/erasing";

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
const allowedVersions = (env: Env, itemId: string) =>
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

forEachBackend((backend) => {
  describe("reviewer orderings", () => {
    test("RV1: two offboardings of the same scope on two handles leave nothing erased", async () => {
      const env = setup(backend);
      await seedPerson(env, [toSam]);
      const d = env.b.pause("delete", "after");
      const first = offboardTheirs(env);
      await d.arrived;
      const second = await offboard(env.depsMine, hr, { person: "person:dana", roles: [] }, AT);
      d.release();
      const firstReport = await first;
      // one of them erased item 1
      expect([...firstReport.erased.items, ...second.erased.items]).toEqual([id(1)]);
      await nothingErasedReturns(env);
      const marks = allEvents(env.mine).filter((e) =>
        ["engram/offboard/begin", "engram/offboard/report"].includes(e.policy_id),
      );
      expect(marks.map((e) => e.policy_id)).toEqual([
        "engram/offboard/begin",
        "engram/offboard/begin",
        "engram/offboard/report",
        "engram/offboard/report",
      ]);
    });

    test("RV1b: a second offboarding's report does not close the first one's mark while it is still erasing", async () => {
      const env = setup(backend);
      await seedPerson(env);
      const d = env.b.pause("delete", "after");
      const slow = offboardTheirs(env); // begin #1
      await d.arrived;
      // a second offboarding on the other handle: begin #2, report #2
      await offboard(env.depsMine, hr, { person: "person:dana", roles: [] }, AT);
      // slow is still between its delete and its report; is person:dana open?
      const w = await env.plane.write(
        dana,
        item(5, { scope: "person:dana", owner: dana.id, content: "Mira visits in May." }),
        AT,
      );
      expect(w.event).toMatchObject({ decision: "deny", policy_id: ERASING });
      d.release();
      await slow;
      expect(itemById(env.mine, id(5))).toBeUndefined();
      expect(await env.store.list("person:dana")).toEqual([]);
    });

    test("RV2: a handover whose item changes on every attempt gives up after four with a deny, and the report says so", async () => {
      const env = setup(backend);
      const role = await seedRole(env, [toSam]);
      const st = steerable(env.depsTheirs.adapter);
      const deps: PlaneDeps = { ...env.depsTheirs, adapter: st.adapter };
      let attempts = 0;
      st.onWrite((it) => {
        if (it.id !== role.id || it.owner !== "person:lee") return undefined;
        attempts++;
        // Before each handover's store write lands, the owner changes the item on the other handle.
        return (async () => {
          const held = itemById(env.mine, role.id) as MemoryItem;
          const r = await env.plane.changeGrants(
            dana,
            role.id,
            held.grants.length ? { remove: [held.grants[0] as Grant] } : { add: [toSam] },
            AT,
          );
          expect(r.decision).toBe("allow");
        })();
      });
      const report = await offboard(
        deps,
        hr,
        { person: "person:dana", roles: [{ scope: "role:release", successor: "person:lee" }] },
        AT,
      );
      const now = itemById(env.mine, role.id) as MemoryItem;
      const conflicts = eventsByItem(env.mine, role.id).filter(
        (e) => e.policy_id === HANDOVER_CONFLICT,
      );
      expect(attempts).toBe(4);
      expect(conflicts).toHaveLength(4);
      expect(conflicts.at(-1)?.reason).not.toMatch(/handed over as it now stands/);
      expect(conflicts.at(-1)?.reason).toMatch(/no further attempt/);
      expect(now.owner).toBe(dana.id);
      expect(report.handover).toEqual([
        { scope: "role:release", successor: "person:lee", items: [] },
      ]);
      const left = eventsByItem(env.mine, role.id).filter(
        (e) => e.policy_id === "engram/offboard/not-handed-over",
      );
      expect(left).toHaveLength(1);
      expect(left[0]).toMatchObject({ decision: "deny", op: "update" });
      expect(left[0]?.reason).toMatch(/not handed over/);
      expect(report.reason).toMatch(/1 not handed over/);
      expect(report.not_reached.join(" ")).toContain(role.id);
      await storeMatches(env, role.id);
    });

    test("RV3: a first write into the person scope that throws between its store write and its commit, during an offboarding, is deleted by the next adoption", async () => {
      const env = setup(backend);
      await seedPerson(env);
      const w = env.a.pause("write", "after");
      const pending = env.plane.write(
        dana,
        item(5, { scope: "person:dana", owner: dana.id, content: "Mira visits in May." }),
        AT,
      );
      await w.arrived;
      await offboardTheirs(env);
      env.hook.onNextTransaction(() => {
        throw new Error("simulated crash before the commit");
      });
      w.release();
      await expect(pending).rejects.toThrow(/simulated crash/);
      const report = await adoptStoreItems(env.depsMine, dana, "person:dana", LATER);
      expect(report.allowed).toBe(0);
      expect(report.denials.map((d) => d.policy_id)).toEqual(["engram/adopt/offboarded"]);
      expect(report.denials[0]?.reason).not.toContain("Mira");
      expect(await env.store.list("person:dana")).toEqual([]);
      expect(itemById(env.mine, id(5))).toBeUndefined();
      expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
      expect((await env.plane.read(dana, { at: LATER })).items).toEqual([]);
    });

    test("RV4: a rewrite of an erased item that throws before its commit has its bytes deleted by the next adoption", async () => {
      const env = setup(backend);
      const seeded = await seedPerson(env);
      const w = env.a.pause("write", "before");
      const pending = env.plane.write(
        dana,
        { ...seeded, version: 2, content: `${SECRET} Still.`, store_ref: null } as MemoryItem,
        AT,
      );
      await w.arrived;
      await offboardTheirs(env);
      env.hook.onNextTransaction(() => {
        throw new Error("simulated crash before the commit");
      });
      w.release();
      await expect(pending).rejects.toThrow(/simulated crash/);
      await adoptStoreItems(env.depsMine, dana, "person:dana", LATER);
      await offboardTheirs(env); // rerunning offboarding does not reach it either
      expect(await env.store.list("person:dana")).toEqual([]);
      expect(itemById(env.mine, id(1))).toBeUndefined();
      expect(
        allEvents(env.mine).filter(
          (e) => e.item_id === id(1) && e.policy_id === "engram/adopt/erased",
        ),
      ).toHaveLength(1);
      expect(JSON.stringify(allEvents(env.mine))).not.toContain("Still");
    });

    test("RV5: a repair whose store delete fails has its bytes deleted by the next adoption", async () => {
      const env = setup(backend);
      const seeded = await seedPerson(env);
      const st = steerable(env.depsMine.adapter);
      const deps: PlaneDeps = { ...env.depsMine, adapter: st.adapter };
      let release = () => {};
      const gate = new Promise<void>((r) => {
        release = r;
      });
      let arrived = () => {};
      const there = new Promise<void>((r) => {
        arrived = r;
      });
      st.onWrite((it) => {
        if (it.version !== 2) return undefined;
        arrived();
        return gate;
      });
      const pending = createPlane(deps).write(
        dana,
        { ...seeded, version: 2, content: `${SECRET} Still.`, store_ref: null } as MemoryItem,
        AT,
      );
      await there;
      // the write is decided; the offboarding completes; then the write lands
      await offboardTheirs(env);
      st.onWrite(null);
      st.failNextDelete();
      release();
      await expect(pending).rejects.toThrow(/simulated crash/);
      await adoptStoreItems(env.depsMine, dana, "person:dana", LATER);
      expect(await env.store.list("person:dana")).toEqual([]);
      expect(itemById(env.mine, id(1))).toBeUndefined();
      expect(JSON.stringify(allEvents(env.mine))).not.toContain("Still");
    });

    test("RV6: an unrelated item's event does not make a decision stale", async () => {
      const env = setup(backend);
      await seedRole(env);
      const w = env.a.pause("write");
      const change = env.plane.changeGrants(dana, id(2), { add: [toLee] }, AT);
      await w.arrived;
      const other = await env.planeTheirs.write(
        dana,
        item(7, { scope: "role:release", owner: dana.id, content: "Unrelated." }),
        AT,
      );
      expect(other.event.decision).toBe("allow");
      await env.planeTheirs.read(lee, { at: AT });
      w.release();
      expect((await change).decision).toBe("allow");
    });

    test("RV7: a gate-denied write by another member under the item's id does not make the owner's decision stale", async () => {
      const env = setup(backend);
      const seeded = await seedPerson(env);
      const w = env.a.pause("write");
      const change = env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT);
      await w.arrived;
      const denied = await env.planeTheirs.write(
        sam,
        {
          ...seeded,
          owner: sam.id,
          version: 2,
          content: "Sam's guess.",
          store_ref: null,
        } as MemoryItem,
        AT,
      );
      expect(denied.event.decision).toBe("deny");
      w.release();
      const r = await change;
      expect(r.decision).toBe("allow");
      expect((await storeMatches(env, id(1))).grants).toEqual([toSam]);
    });

    test("RV8: an adoption of a stale writer's bytes does not bring a removed grant back", async () => {
      const env = setup(backend);
      const role = await seedRole(env, [toSam]);
      const before = env.a.pause("write", "before");
      // Dana rewrites the role item with its grant (decided now, on the version holding the grant).
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
      // On the other handle Dana removes Sam's grant: committed.
      const removal = await env.planeTheirs.changeGrants(dana, role.id, { remove: [toSam] }, AT);
      expect(removal.decision).toBe("allow");
      const after = env.a.pause("write", "after");
      before.release();
      await after.arrived;
      // The stale bytes are in the store; the other handle adopts the role scope now.
      const adopted = await adoptStoreItems(env.depsTheirs, dana, "role:release", AT);
      expect(adopted.listed).toBe(1);
      after.release();
      const r = await stale;
      expect(r.event).toMatchObject({ decision: "deny", policy_id: WRITE_CONFLICT });
      const now = await storeMatches(env, role.id);
      expect(now.grants).toEqual([]);
      expect(now.content).toBe("The release train leaves at 3.");
      expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
      // The removal stands; an adoption of the stale bytes, if one happened, was withdrawn.
      expect(allowedVersions(env, role.id)).toContain("engram/grant/change:v2");
    });

    test("RV9: a repair racing another repair settles both, and the store matches the log", async () => {
      const env = setup(backend);
      await seedPerson(env);
      // both handles' grant changes decided on v1 and held at their store writes
      const wa = env.a.pause("write");
      const wb = env.b.pause("write");
      const ca = env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT);
      const cb = env.planeTheirs.changeGrants(dana, id(1), { add: [toLee] }, AT);
      await Promise.all([wa.arrived, wb.arrived]);
      // a third writer (a raw event as another process) commits a newer version
      const now = itemById(env.mine, id(1)) as MemoryItem;
      await env.store.write({
        ...now,
        version: 2,
        grants: [],
        content: "v2 by C",
        store_ref: null,
      } as MemoryItem);
      appendEvent(env.theirs, {
        id: env.newTheirsId(),
        ts: AT,
        op: "update",
        item_id: id(1),
        actor: dana.id,
        scope_from: "person:dana",
        scope_to: "person:dana",
        decision: "allow",
        reason: "simulated third process",
        policy_id: "profile.twin/write/person",
        item: { ...now, version: 2, grants: [], content: "v2 by C" } as MemoryItem,
        schema_version: 1,
      });
      // both stale writers now settle at once, their repairs interleaving
      const ra2 = env.a.pause("write");
      const rb2 = env.b.pause("write");
      wa.release();
      wb.release();
      await Promise.all([ra2.arrived, rb2.arrived]);
      ra2.release();
      rb2.release();
      const [a, b] = await Promise.all([ca, cb]);
      expect([a.event.policy_id, b.event.policy_id]).toEqual([GRANT_CONFLICT, GRANT_CONFLICT]);
      const final = await storeMatches(env, id(1));
      expect(final.content).toBe("v2 by C");
    });
  });

  describe("a model lint across an erasure (P50-8)", () => {
    test("a model lint awaited while an offboarding erases its items appends no finding about them", async () => {
      const env = setup(backend);
      for (const [n, content] of [
        [11, "Mira's birthday is in May."],
        [12, "Mira's birthday is in June."],
      ] as const)
        expect(
          (
            await env.plane.write(
              dana,
              item(n, { scope: "person:dana", owner: dana.id, content }),
              AT,
            )
          ).event.decision,
        ).toBe("allow");
      const scripted = scriptedLintModel(() => reply("contradiction", "different months"));
      let release = () => {};
      const gate = new Promise<void>((r) => {
        release = r;
      });
      let arrived = () => {};
      const there = new Promise<void>((r) => {
        arrived = r;
      });
      const held: typeof scripted.call = async (request) => {
        arrived();
        await gate;
        return scripted.call(request);
      };
      const policy = { ...twin(), lints: { enabled: ["contradiction"], thresholds: {} } };
      const linting = createPlane({
        ...env.depsMine,
        policy,
        lintModel: { call: held, model: "scripted/lint-1", seed: 1 },
      }).lint(dana, AT, "person:dana");
      await there;
      await offboardTheirs(env);
      release();
      const report = await linting;
      expect(report.findings).toEqual([]);
      const lints = allEvents(env.mine).filter((e) => e.op === "lint");
      expect(lints).toEqual([]);
      expect(JSON.stringify(allEvents(env.mine))).not.toContain("Mira");
    });
  });
});
