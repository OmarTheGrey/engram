// Offboarding's edges (card E9.7, review of PR #33): a store failure during
// handover is a decision with its own event (AGENTS.md rule 3) and stops the
// offboarding before anything is erased; a store ref that an item outside
// the person scope still holds is not deleted; and the erasure's redaction of
// the log, and its removal of explanation rows, come out the same on SQLite
// and Postgres (ADR 0024).
import { readFileSync } from "node:fs";
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import type { Db } from "../../../src/db/db.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { openSqlite } from "../../../src/db/sqlite.ts";
import { allEvents, appendEvent, currentItems, rebuild } from "../../../src/events.ts";
import { type Actor, createPlane, HANDOVER_ID, offboard } from "../../../src/plane.ts";
import { STORE_FAILURE_ID } from "../../../src/policy/evaluate.ts";
import { parsePolicy } from "../../../src/policy/load.ts";
import type { Grant, MemoryItem } from "../../../src/schema.ts";
import { forEachBackend } from "../../db/backends.ts";
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
