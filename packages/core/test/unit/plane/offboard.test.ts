// Card E9.7's acceptance: offboarding hands the role scope to a successor and
// erases the person scope with a deletion report. Fixture: the successor
// reads the role items; the person items are gone from the store and the
// index (the projection, a projection rebuilt from the log, and every
// event's copy of them). Under the twin profile, over the fake store.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { allEvents, currentItems, ERASURE_ID, rebuild } from "../../../src/events.ts";
import {
  type Actor,
  HANDOVER_ID,
  InvalidCallError,
  OFFBOARD_MEMBERSHIP_ID,
  OFFBOARD_REPORT_ID,
  offboard,
} from "../../../src/plane.ts";
import { parsePolicy } from "../../../src/policy/load.ts";
import { itemsAt } from "../../../src/replay.ts";
import type { Grant, MemoryItem } from "../../../src/schema.ts";
import { fresh, id, item } from "./helpers.ts";

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

/** The fixture's memory, written through the plane. */
async function seeded() {
  const f = fixture();
  const env = fresh(twin());
  const write = async (s: Seed, scope: string) => {
    const actor = f.actors[s.as] as Actor;
    const { event } = await env.plane.write(
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
  };
  for (const s of f.person) await write(s, "person:dana");
  for (const s of f.role) await write(s, "role:lead");
  return { ...env, f };
}

const leave = (_f: Fixture) => ({
  person: "person:dana",
  roles: [{ scope: "role:lead", successor: "person:sam" }],
});

describe("acceptance (card E9.7): offboarding Dana, Sam succeeds her in role:lead", () => {
  test("the successor reads the role items, and they are his", async () => {
    const env = await seeded();
    const { plane, f } = env;
    const report = await offboard(env.deps, f.actors.dana as Actor, leave(f), f.later);
    expect(report.decision).toBe("allow");
    const roleIds = f.role.map((s) => id(s.n)).sort();
    expect([...(report.handover[0]?.items ?? [])].sort()).toEqual(roleIds);
    const read = await plane.read(f.actors.sam as Actor, { at: f.later });
    const roleItems = read.items.filter((i) => i.scope === "role:lead");
    expect(roleItems.map((i) => i.id).sort()).toEqual(roleIds);
    for (const i of roleItems) expect(i.owner).toBe("person:sam");
    // Sam may now rewrite them: a rewrite keeps the owner, and the owner is Sam.
    const [first] = roleItems as MemoryItem[];
    const rewrite = await plane.write(
      f.actors.sam as Actor,
      {
        ...(first as MemoryItem),
        version: (first?.version ?? 1) + 1,
        content: "The lead signs off on Thursdays.",
      } as MemoryItem,
      f.later,
    );
    expect(rewrite.event.decision).toBe("allow");
  });

  test("the person items are gone from the store and the index, and stay gone", async () => {
    const env = await seeded();
    const { db, adapter, f } = env;
    const before = currentItems(db)
      .filter((i) => i.scope === "person:dana")
      .map((i) => i.id);
    expect(before.length).toBe(f.person.length);
    const report = await offboard(env.deps, f.actors.dana as Actor, leave(f), f.later);
    expect(report.erased.items).toEqual([...before].sort());
    expect(report.erased.store_failures).toEqual([]);
    // The store.
    expect(await adapter.list("person:dana")).toEqual([]);
    // The index: the projection, and a projection rebuilt from the log alone.
    expect(currentItems(db).filter((i) => i.scope === "person:dana")).toEqual([]);
    rebuild(db);
    expect(currentItems(db).filter((i) => i.scope === "person:dana")).toEqual([]);
    expect(itemsAt(db, allEvents(db).length - 1).filter((i) => i.scope === "person:dana")).toEqual(
      [],
    );
    // No event carries what was remembered.
    const log = JSON.stringify(allEvents(db));
    for (const secret of f.secrets) expect(log).not.toContain(secret);
    expect(db.prepare("SELECT count(*) AS n FROM explanations").get()?.n).toBe(0);
  });

  test("the deletion report names what was done and what it cannot reach, by id only", async () => {
    const env = await seeded();
    const { f } = env;
    const report = await offboard(env.deps, f.actors.dana as Actor, leave(f), f.later);
    expect(report.erased.store_refs).toHaveLength(f.person.length);
    expect(report.erased.events_redacted).toBeGreaterThanOrEqual(f.person.length);
    expect(report.not_reached.join(" ")).toMatch(/pi session files/);
    expect(JSON.stringify(report)).not.toMatch(new RegExp(f.secrets.join("|")));
    const ops = report.events.map((e) => e.policy_id);
    expect(ops.filter((p) => p === HANDOVER_ID)).toHaveLength(
      report.handover[0]?.items.length ?? 0,
    );
    expect(ops.filter((p) => p === ERASURE_ID)).toHaveLength(f.person.length);
    expect(ops.at(-1)).toBe(OFFBOARD_REPORT_ID);
  });
});

describe("who may offboard", () => {
  test("an agent cannot: one deny event and nothing changes", async () => {
    const env = await seeded();
    const { db, f } = env;
    const items = currentItems(db);
    const report = await offboard(env.deps, f.actors["dana-agent"] as Actor, leave(f), f.later);
    expect(report.decision).toBe("deny");
    expect(report.events.map((e) => e.policy_id)).toEqual([OFFBOARD_MEMBERSHIP_ID]);
    expect(currentItems(db)).toEqual(items);
  });

  test("a colleague who is not a member of the person scope cannot", async () => {
    const env = await seeded();
    const { f } = env;
    const report = await offboard(env.deps, f.actors.sam as Actor, leave(f), f.later);
    expect(report.decision).toBe("deny");
    expect(report.reason).toMatch(/not a member of person:dana/);
  });

  test("a malformed request is refused before anything is touched", async () => {
    const env = await seeded();
    const { db, f } = env;
    const n = allEvents(db).length;
    const dana = f.actors.dana as Actor;
    for (const bad of [
      { person: "team:core", roles: [] },
      { person: "person:dana", roles: [{ scope: "team:core", successor: "person:sam" }] },
      { person: "person:dana", roles: [{ scope: "role:lead", successor: "person:dana" }] },
    ])
      await expect(offboard(env.deps, dana, bad, f.later)).rejects.toThrow(InvalidCallError);
    expect(allEvents(db)).toHaveLength(n);
  });
});
