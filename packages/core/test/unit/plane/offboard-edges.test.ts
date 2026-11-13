// Offboarding's edges (card E9.7, review of PR #33): a store failure during
// handover is a decision with its own event (AGENTS.md rule 3) and stops the
// offboarding before anything is erased; a store ref that an item outside
// the person scope still holds is not deleted; and the erasure's redaction of
// the log, and its removal of explanation rows, come out the same on SQLite
// and Postgres (ADR 0024).
import { readFileSync } from "node:fs";
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import { type Adapter, NotDeletableError, type StoreRef } from "../../../src/adapter.ts";
import { strictContentHash } from "../../../src/content-hash.ts";
import type { Db } from "../../../src/db/db.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { openSqlite } from "../../../src/db/sqlite.ts";
import { allEvents, appendEvent, currentItems, ERASURE_ID, rebuild } from "../../../src/events.ts";
import {
  type Actor,
  adoptStoreItems,
  createPlane,
  HANDOVER_ID,
  offboard,
} from "../../../src/plane.ts";
import { STORE_FAILURE_ID } from "../../../src/policy/evaluate.ts";
import { parsePolicy } from "../../../src/policy/load.ts";
import { itemsAt } from "../../../src/replay.ts";
import type { Grant, MemoryItem } from "../../../src/schema.ts";
import { forEachBackend, sqliteBackend } from "../../db/backends.ts";
import { counting, id, item } from "./helpers.ts";

const PROFILE = new URL("../../../../pi-package/profiles/twin.yaml", import.meta.url);
const FIXTURE = new URL("../../../../../fixtures/profiles/offboarding.json", import.meta.url);

interface Seed {
  n: number;
  as: string;
  content: string;
  class?: "episodic" | "semantic";
  confidence?: number;
  grants?: Grant[];
}
interface Fixture {
  at: string;
  later: string;
  actors: Record<string, Actor>;
  person: Seed[];
  role: Seed[];
  secrets: string[];
}

const fixture = () => JSON.parse(readFileSync(FIXTURE, "utf8")) as Fixture;
const twin = () => parsePolicy(readFileSync(PROFILE, "utf8"), "twin.yaml");
const LEAVE = { person: "person:dana", roles: [{ scope: "role:lead", successor: "person:sam" }] };

/** The fixture's memory written through the plane over `db`, and one read by Sam through his grant. */
async function seeded(db: Db) {
  const f = fixture();
  migrate(db);
  const adapter = counting(createFakeAdapter());
  let n = 0;
  const deps = { db, adapter, policy: twin(), newId: () => id(900_000 + ++n) };
  const plane = createPlane(deps);
  for (const [scope, seeds] of [
    ["person:dana", f.person],
    ["role:lead", f.role],
  ] as const)
    for (const s of seeds) {
      const actor = f.actors[s.as] as Actor;
      const { event } = await plane.write(
        actor,
        item(s.n, {
          scope,
          owner: actor.id,
          content: s.content,
          class: s.class ?? "semantic",
          confidence: s.confidence ?? 0.9,
          grants: s.grants ?? [],
        }),
        f.at,
      );
      expect(event.decision, `seed ${s.n}`).toBe("allow");
    }
  // Sam reads Dana's granted note, so the explanations table holds a row for it.
  const read = await plane.read(f.actors.sam as Actor, { at: f.at });
  expect(read.items.map((i) => i.id)).toContain(id(4));
  return { db, adapter, deps, plane, f };
}

describe("a store failure while handing a role over", () => {
  test("appends one deny event naming the item, throws, and erases nothing", async () => {
    const env = await seeded(openSqlite(":memory:"));
    const { db, adapter, f } = env;
    const before = currentItems(db);
    const n = allEvents(db).length;
    adapter.fault = async () => {
      throw new Error("store unreachable");
    };
    await expect(offboard(env.deps, f.actors.dana as Actor, LEAVE, f.later)).rejects.toThrow(
      /store unreachable/,
    );
    const appended = allEvents(db).slice(n);
    expect(appended).toHaveLength(1);
    const [event] = appended;
    expect(event?.decision).toBe("deny");
    expect(event?.policy_id).toBe(STORE_FAILURE_ID);
    expect(event?.item_id).toBe(id(6));
    expect(event?.reason).toMatch(/store unreachable/);
    expect(event?.reason).toContain(HANDOVER_ID);
    // Nothing was handed over or erased: the person scope is intact.
    expect(currentItems(db)).toEqual(before);
    expect(await adapter.list("person:dana")).toHaveLength(f.person.length);
  });

  test("a second offboarding after the store recovers completes it", async () => {
    const env = await seeded(openSqlite(":memory:"));
    const { db, adapter, f } = env;
    let calls = 0;
    adapter.fault = async (it, store) => {
      if (++calls === 2) throw new Error("store unreachable");
      return store.write(it);
    };
    await expect(offboard(env.deps, f.actors.dana as Actor, LEAVE, f.later)).rejects.toThrow();
    adapter.fault = null;
    const report = await offboard(env.deps, f.actors.dana as Actor, LEAVE, f.later);
    expect(report.decision).toBe("allow");
    // The item handed over before the failure is already Sam's, so only the other moves now.
    expect(report.handover[0]?.items).toEqual([id(7)]);
    const role = currentItems(db).filter((i) => i.scope === "role:lead");
    expect(role.map((i) => i.owner)).toEqual(["person:sam", "person:sam"]);
  });
});

describe("a store ref that an item outside the person scope still holds", () => {
  test("is kept, and the report says so", async () => {
    const env = await seeded(openSqlite(":memory:"));
    const { db, adapter, f } = env;
    const person = currentItems(db).find((i) => i.id === id(1)) as MemoryItem;
    const ref = person.store_ref;
    expect(ref).not.toBeNull();
    // A team item holding the same ref, as a version of the person item
    // (adoption gives a store's record one ref across versions).
    const team = {
      ...person,
      id: id(50),
      scope: "team:core",
      lineage: [person.id],
      version: person.version + 1,
    } as MemoryItem;
    appendEvent(db, {
      id: id(800_001),
      ts: f.at,
      op: "write",
      item_id: team.id,
      actor: "person:dana",
      scope_from: null,
      scope_to: team.scope,
      decision: "allow",
      reason: "a version shared into the team",
      policy_id: "test/fixture",
      item: team,
      schema_version: 1,
    });
    const report = await offboard(env.deps, f.actors.dana as Actor, LEAVE, f.later);
    expect(report.erased.items).toContain(id(1));
    expect(report.erased.store_refs).not.toContainEqual(ref);
    expect(await adapter.read(ref as NonNullable<typeof ref>)).toBeDefined();
    expect(report.not_reached.join(" ")).toMatch(/1 store ref .*held by an item outside/);
    expect(currentItems(db).find((i) => i.id === id(50))?.store_ref).toEqual(ref);
  });
});

forEachBackend((backend) => {
  test("the erased log, projection and explanations are the same as on SQLite", async () => {
    const run = async (db: Db) => {
      const env = await seeded(db);
      const done = await offboard(env.deps, env.f.actors.dana as Actor, LEAVE, env.f.later);
      expect(done.erased.explanation_rows).toBeGreaterThan(0);
      const log = allEvents(db);
      const items = currentItems(db);
      rebuild(db);
      expect(currentItems(db)).toEqual(items);
      // Rows of the items Sam's read returned that were not erased (the role items) stay.
      const explanations = done.erased.items.reduce(
        (sum, erased) =>
          sum +
          Number(
            db.prepare("SELECT count(*) AS n FROM explanations WHERE item_id = ?").get(erased)?.n ??
              -1,
          ),
        0,
      );
      return { done, log, items, explanations, secrets: env.f.secrets };
    };
    const here = await run(backend.open());
    const reference = await run(openSqlite(":memory:"));
    for (const secret of here.secrets) expect(JSON.stringify(here.log)).not.toContain(secret);
    expect(here.explanations).toBe(0);
    expect(here.log).toEqual(reference.log);
    expect(here.items).toEqual(reference.items);
    expect(here.done).toEqual(reference.done);
  });
});

// Post-merge review of 2026-11-13 (cards E9.7 and L1): a lint event carries
// its evidence in `reason` and its item only by id, so erasure must redact
// the reason of every lint event about an erased item, and of every lint
// event whose evidence names one, keeping its lint id, severity and rule.
const SALARY = "Dana's salary is 9000.";
const DRAFT = "Dana's first draft of the plan.";

/** Dana duplicates a person note, cites another from the role, rewrites it, and lints both scopes. */
async function linted(env: Awaited<ReturnType<typeof seeded>>) {
  const { plane, f } = env;
  const dana = f.actors.dana as Actor;
  const write = async (n: number, over: Partial<MemoryItem>) => {
    const { event } = await plane.write(
      dana,
      item(n, { owner: "person:dana", confidence: 0.9, ...over }),
      f.at,
    );
    expect(event.decision, `item ${n}: ${event.reason}`).toBe("allow");
  };
  await write(20, { scope: "person:dana", content: SALARY });
  await write(21, { scope: "person:dana", content: SALARY });
  await write(22, { scope: "person:dana", content: DRAFT });
  // A role note derived from Dana's person note 22, which she then rewrites.
  await write(30, {
    scope: "role:lead",
    content: "The plan is due in March.",
    provenance: {
      kind: "user",
      ref: id(22),
      hash: strictContentHash(DRAFT),
      actor: "person:dana",
    },
  });
  await write(22, { scope: "person:dana", content: SALARY, version: 2 });
  const person = await plane.lint(dana, f.at, "person:dana");
  const role = await plane.lint(dana, f.at, "role:lead");
  expect(person.findings.map((x) => [x.lint_id, x.item_id])).toContainEqual(["duplicate", id(21)]);
  expect(role.findings.map((x) => [x.lint_id, x.item_id])).toContainEqual([
    "source-changed",
    id(30),
  ]);
  return [...person.events, ...role.events];
}

describe("lint evidence about an erased item", () => {
  test("is redacted from every lint event, keeping the lint id, severity and rule", async () => {
    const env = await seeded(openSqlite(":memory:"));
    const lints = await linted(env);
    expect(JSON.stringify(allEvents(env.db))).toContain(strictContentHash(SALARY));
    await offboard(env.deps, env.f.actors.dana as Actor, LEAVE, env.f.later);
    const log = allEvents(env.db);
    expect(JSON.stringify(log)).not.toContain(strictContentHash(SALARY));
    for (const lint of lints) {
      const now = log.find((e) => e.id === lint.id);
      const [lintId, severity] = /^(\S+) \((\w+)\): /.exec(lint.reason)?.slice(1) ?? [];
      expect(now?.reason, lint.reason).toBe(`${lintId} (${severity}): [erased]`);
      expect(now?.policy_id).toBe(lint.policy_id);
      expect(now?.item_id).toBe(lint.item_id);
    }
  });
});

/** The adapter's deletes of refs `refused` picks fail while `down` is set: a fault-injecting store, not a mock. */
function failingDeletes(adapter: Adapter, refused: (ref: StoreRef) => boolean) {
  const state = { down: true };
  const remove = adapter.delete.bind(adapter);
  adapter.delete = async (ref) => {
    if (state.down && refused(ref)) throw new Error("store offline");
    return remove(ref);
  };
  return state;
}

describe("a store failure while erasing", () => {
  test("keeps the item with one deny event, and erases it when offboarding again", async () => {
    const env = await seeded(openSqlite(":memory:"));
    const { db, adapter, f } = env;
    const dana = f.actors.dana as Actor;
    const kept = currentItems(db).find((i) => i.id === id(1)) as MemoryItem;
    const store = failingDeletes(adapter, (ref) => ref.key === kept.store_ref?.key);
    const n = allEvents(db).length;

    const report = await offboard(env.deps, dana, LEAVE, f.later);
    expect(report.erased.store_failures).toEqual([
      { ref: kept.store_ref, error: "store offline", items: [id(1)] },
    ]);
    expect(report.erased.items).not.toContain(id(1));
    expect(report.erased.items).toContain(id(2));
    // The item stays in the projection, unredacted, and no event says it was erased.
    expect(currentItems(db).find((i) => i.id === id(1))).toEqual(kept);
    const appended = allEvents(db).slice(n);
    const about = appended.filter((e) => e.item_id === id(1));
    expect(about).toHaveLength(1);
    expect(about[0]).toMatchObject({ op: "retire", decision: "deny", policy_id: STORE_FAILURE_ID });
    expect(about[0]?.reason).toMatch(/store offline/);
    expect(about[0]?.reason).toContain(ERASURE_ID);
    // Each erase event says what happened to its item in the store.
    for (const e of appended.filter((x) => x.policy_id === ERASURE_ID))
      expect(e.reason).toMatch(/deleted from the store/);
    // Re-adoption brings no erased item back: the store lists only the kept one.
    await adoptStoreItems(env.deps, dana, "person:dana", f.later);
    const person = currentItems(db).filter((i) => i.scope === "person:dana");
    expect(person.map((i) => i.id)).toEqual([id(1)]);

    store.down = false;
    const again = await offboard(env.deps, dana, LEAVE, f.later);
    expect(again.erased.items).toEqual([id(1)]);
    expect(again.erased.store_failures).toEqual([]);
    expect(currentItems(db).filter((i) => i.scope === "person:dana")).toEqual([]);
    expect(await adapter.list("person:dana")).toEqual([]);
    expect(JSON.stringify(allEvents(db))).not.toContain("peanuts");
    const items = currentItems(db);
    rebuild(db);
    expect(currentItems(db)).toEqual(items);
  });

  test("an erase event whose ref is kept as shared says it was kept, not deleted", async () => {
    const env = await seeded(openSqlite(":memory:"));
    const { db, f } = env;
    const person = currentItems(db).find((i) => i.id === id(1)) as MemoryItem;
    appendEvent(db, {
      id: id(800_002),
      ts: f.at,
      op: "write",
      item_id: id(51),
      actor: "person:dana",
      scope_from: null,
      scope_to: "team:core",
      decision: "allow",
      reason: "a version shared into the team",
      policy_id: "test/fixture",
      item: { ...person, id: id(51), scope: "team:core", lineage: [person.id] } as MemoryItem,
      schema_version: 1,
    });
    const report = await offboard(env.deps, f.actors.dana as Actor, LEAVE, f.later);
    const erase = report.events.find((e) => e.policy_id === ERASURE_ID && e.item_id === id(1));
    expect(erase?.reason).toMatch(/kept in the store/);
    expect(erase?.reason).not.toMatch(/deleted from the store/);
    const other = report.events.find((e) => e.policy_id === ERASURE_ID && e.item_id === id(2));
    expect(other?.reason).toMatch(/deleted from the store/);
  });
});

forEachBackend((backend) => {
  test("lint redaction at erasure keeps replay and the rebuilt projection equal to the incremental one", async () => {
    const run = async (db: Db) => {
      const env = await seeded(db);
      await linted(env);
      await offboard(env.deps, env.f.actors.dana as Actor, LEAVE, env.f.later);
      const log = allEvents(db);
      const items = currentItems(db);
      const replayed = itemsAt(db, log.at(-1)?.seq ?? 0);
      rebuild(db);
      return { log, items, replayed, rebuilt: currentItems(db) };
    };
    const here = await run(backend.open());
    const reference = await run(openSqlite(":memory:"));
    expect(JSON.stringify(here.log)).not.toContain(strictContentHash(SALARY));
    expect(here.rebuilt).toEqual(here.items);
    expect(here.replayed).toEqual(here.items);
    expect(here.log).toEqual(reference.log);
    expect(here.items).toEqual(reference.items);
  });
});

describe("a read in flight while offboarding erases", () => {
  test("neither returns nor explains an item erased before its read event lands", async () => {
    const env = await seeded(openSqlite(":memory:"));
    const { db, adapter, plane, f } = env;
    const dana = f.actors.dana as Actor;
    // A store whose search finds its hits, then lets the offboarding finish
    // before it answers: the read has taken its snapshot of the projection
    // and awaits the store.
    const search = adapter.search?.bind(adapter);
    expect(search).toBeDefined();
    let erasure: ReturnType<typeof offboard> | undefined;
    adapter.search = async (query, scopes) => {
      const hits = (await search?.(query, scopes)) ?? [];
      erasure = offboard(env.deps, dana, LEAVE, f.later);
      await erasure;
      return hits;
    };
    const read = await plane.read(dana, { text: "the", at: f.later });
    const report = await (erasure as ReturnType<typeof offboard>);
    const erased = new Set(report.erased.items);
    expect(erased.size).toBe(f.person.length);
    // The read still returns what survived: the role items, which hold "the".
    expect(read.items.length).toBeGreaterThan(0);
    expect(read.items.filter((i) => erased.has(i.id))).toEqual([]);
    expect(read.explanations.filter((e) => erased.has(e.item_id))).toEqual([]);
    expect(read.event.item_ids?.filter((i) => erased.has(i))).toEqual([]);
    expect(read.explanations.map((e) => e.rank)).toEqual(read.items.map((_, i) => i + 1));
    const rows = db
      .prepare("SELECT item_id FROM explanations WHERE read_id = ?")
      .all(read.event.id)
      .map((r) => String(r.item_id));
    expect(rows.filter((i) => erased.has(i))).toEqual([]);
    for (const secret of f.secrets) expect(JSON.stringify(read)).not.toContain(secret);
  });

  test("drops an item another process erased between the store search and the read's transaction", async () => {
    // Two connections to one log file, as the CLI and `engram serve` share
    // one. The other process commits an erasure just before this read's
    // transaction begins: after the search, before the lock.
    const [mine, theirs] = sqliteBackend.pair();
    const env = await seeded(mine);
    const { f } = env;
    const victim = id(1);
    let armed = true;
    const db: Db = {
      ...mine,
      transaction: (fn) => {
        if (armed) {
          armed = false;
          appendEvent(theirs, {
            id: id(800_100),
            ts: f.later,
            op: "retire",
            item_id: victim,
            actor: "person:dana",
            scope_from: "person:dana",
            scope_to: null,
            decision: "allow",
            reason: "erased by another process",
            policy_id: ERASURE_ID,
            schema_version: 1,
          });
        }
        return mine.transaction(fn);
      },
    };
    const plane = createPlane({ ...env.deps, db });
    const read = await plane.read(f.actors.dana as Actor, { text: "dana", at: f.later });
    expect(read.items.map((i) => i.id)).not.toContain(victim);
    expect(read.explanations.map((e) => e.item_id)).not.toContain(victim);
    expect(read.event.item_ids).not.toContain(victim);
    expect(read.explanations.map((e) => e.rank)).toEqual(read.items.map((_, i) => i + 1));
    expect(read.items.length).toBeGreaterThan(0);
  });
});

/** The store's delete refuses for good refs `refused` picks: a store the plane may not delete from. */
function readOnlyDeletes(adapter: Adapter, refused: (ref: StoreRef) => boolean) {
  const remove = adapter.delete.bind(adapter);
  adapter.delete = async (ref) => {
    if (refused(ref)) throw new NotDeletableError(`${ref.key} is read-only to the plane`);
    return remove(ref);
  };
}

describe("a store that refuses the plane's delete for good", () => {
  test("still erases the item, names the ref left in the store, and re-adoption brings nothing back", async () => {
    const env = await seeded(openSqlite(":memory:"));
    const { db, adapter, f } = env;
    const dana = f.actors.dana as Actor;
    const kept = currentItems(db).find((i) => i.id === id(1)) as MemoryItem;
    readOnlyDeletes(adapter, (ref) => ref.key === kept.store_ref?.key);
    const report = await offboard(env.deps, dana, LEAVE, f.later);
    expect(report.erased.items).toContain(id(1));
    expect(report.erased.store_failures).toEqual([]);
    expect(report.erased.left_in_store).toEqual([
      {
        ref: kept.store_ref,
        error: `${kept.store_ref?.key} is read-only to the plane`,
        items: [id(1)],
      },
    ]);
    expect(report.events.filter((e) => e.decision === "deny")).toEqual([]);
    const erase = report.events.find((e) => e.policy_id === ERASURE_ID && e.item_id === id(1));
    expect(erase?.reason).toMatch(/left in the store/);
    expect(JSON.stringify(allEvents(db))).not.toContain("peanuts");
    // The store still lists it; adoption must not bring it back.
    expect((await adapter.list("person:dana")).map((i) => i.id)).toEqual([id(1)]);
    const again = await adoptStoreItems(env.deps, dana, "person:dana", f.later);
    expect(again.allowed).toBe(0);
    expect(again.unchanged).toBe(1);
    expect(currentItems(db).filter((i) => i.scope === "person:dana")).toEqual([]);
  });
});

describe("lint redaction at erasure reaches only evidence about erased items (review of PR #41)", () => {
  const RELEASE = "The release checklist lives in the wiki.";

  test("a duplicate finding among surviving items with the same text as an erased item stays", async () => {
    const env = await seeded(openSqlite(":memory:"));
    const { plane, f } = env;
    const sam = f.actors.sam as Actor;
    const dana = f.actors.dana as Actor;
    for (const [n, who, scope] of [
      [60, sam, "role:lead"],
      [61, sam, "role:lead"],
      [62, dana, "person:dana"],
    ] as const) {
      const { event } = await plane.write(
        who,
        item(n, { scope, owner: who.id, content: RELEASE, confidence: 0.9 }),
        f.at,
      );
      expect(event.decision, event.reason).toBe("allow");
    }
    const lint = await plane.lint(sam, f.at, "role:lead");
    const dup = lint.events.find((e) => e.item_id === id(61));
    expect(dup?.reason).toContain(strictContentHash(RELEASE));
    await offboard(env.deps, dana, LEAVE, f.later);
    expect(allEvents(env.db).find((e) => e.id === dup?.id)?.reason).toBe(dup?.reason);
  });

  test("a source-changed finding on a surviving item citing a source an erased item also cited stays", async () => {
    const env = await seeded(openSqlite(":memory:"));
    const { plane, f } = env;
    const sam = f.actors.sam as Actor;
    const dana = f.actors.dana as Actor;
    const OLD = "The on-call rota changes on Mondays.";
    const cite = { kind: "user" as const, ref: id(70), hash: strictContentHash(OLD) };
    const writes: [number, Actor, string, Partial<MemoryItem>][] = [
      [70, sam, "role:lead", { content: OLD }],
      [71, sam, "role:lead", { content: "Rota: Mondays.", provenance: { ...cite, actor: sam.id } }],
      [
        72,
        dana,
        "person:dana",
        { content: "My rota note.", provenance: { ...cite, actor: dana.id } },
      ],
      [70, sam, "role:lead", { content: "The on-call rota changes on Tuesdays.", version: 2 }],
    ];
    for (const [n, who, scope, over] of writes) {
      const { event } = await plane.write(
        who,
        item(n, { scope, owner: who.id, confidence: 0.9, ...over }),
        f.at,
      );
      expect(event.decision, event.reason).toBe("allow");
    }
    const lint = await plane.lint(sam, f.at, "role:lead");
    const changed = lint.events.find((e) => e.item_id === id(71));
    expect(changed?.reason).toMatch(/^source-changed/);
    await offboard(env.deps, dana, LEAVE, f.later);
    expect(allEvents(env.db).find((e) => e.id === changed?.id)?.reason).toBe(changed?.reason);
  });
});
