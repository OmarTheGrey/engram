// The supersession plan and its application through the real Plane (card
// L6), over the fake store. A replacement that names the old version only in
// its lineage leaves both admitted (card A5's finding,
// docs/log/2026-11-21-a5-finding-lineage-alone-admits-both.md); the plan
// proposes closing the old window, and an accepted close is an ordinary
// write of a new version in place, which the write gate decides and the log
// records. The plan names nothing the actor cannot read.
import { describe, expect, test } from "vitest";
import { InvalidCallError } from "../../../src/actor.ts";
import { appendEvent } from "../../../src/events.ts";
import { itemById } from "../../../src/items.ts";
import type { Actor } from "../../../src/plane.ts";
import { WRITE_MEMBERSHIP_ID } from "../../../src/policy/evaluate.ts";
import type { MemoryItem } from "../../../src/schema.ts";
import {
  acceptedClosures,
  closedVersion,
  planSupersession,
  writeClosures,
} from "../../../src/supersede.ts";
import { AT, fresh, id, item } from "./helpers.ts";

const omar: Actor = {
  id: "person:omar",
  level: "person",
  memberships: ["person:omar", "team:platform"],
  source: "user",
};
const LATER = "2026-11-01T00:00:00Z";
const NOW = "2026-11-20T00:00:00Z";

/** Old version 1 and its replacement 2, which names 1 only in its lineage. */
async function replaced(over: Partial<Pick<MemoryItem, "grants" | "valid_from">> = {}) {
  const env = fresh();
  for (const it of [
    item(1, { content: "The deploy window is Tuesday.", ...over }),
    item(2, { content: "The deploy window is Thursday.", valid_from: LATER, lineage: [id(1)] }),
  ]) {
    const { event } = await env.plane.write(omar, it, AT);
    expect(event.decision).toBe("allow");
  }
  return env;
}

describe("planSupersession", () => {
  test("proposes closing the old version at the replacement's valid_from", async () => {
    const env = await replaced();
    const plan = planSupersession(env.db, env.policy, omar, id(2), NOW);
    expect(plan).toEqual({
      item_id: id(2),
      head: { ok: true, head_id: id(2), chain: [id(2)] },
      proposals: [
        expect.objectContaining({
          item_id: id(1),
          action: "close",
          relation: "finishedBy",
          valid_to: LATER,
        }),
      ],
    });
  });

  test("asked about the old version, it names the head and proposes nothing for it", async () => {
    const env = await replaced();
    const plan = planSupersession(env.db, env.policy, omar, id(1), NOW);
    expect(plan.head).toEqual({ ok: true, head_id: id(2), chain: [id(1), id(2)] });
    expect(plan.proposals).toEqual([]);
  });

  test("an item the actor cannot read is unknown, and so is an ancestor out of its reach", async () => {
    const env = await replaced();
    const sam: Actor = { id: "person:sam", level: "person", memberships: ["person:sam"] };
    expect(planSupersession(env.db, env.policy, sam, id(2), NOW)).toEqual({
      item_id: id(2),
      head: { ok: false, error: "unknown_id", chain: [] },
      proposals: [],
    });
    // Sam's own replacement of the team's item, whose lineage names it.
    const mine = item(3, {
      scope: "person:sam",
      owner: sam.id,
      valid_from: LATER,
      lineage: [id(1)],
    });
    expect((await env.plane.write({ ...sam, source: "user" }, mine, AT)).event.decision).toBe(
      "allow",
    );
    const plan = planSupersession(env.db, env.policy, sam, id(3), NOW);
    expect(plan.head).toMatchObject({ ok: true, head_id: id(3) });
    expect(plan.proposals).toEqual([]);
  });

  test("a retired successor is no link: the head of a version it names is that version (L6-2)", async () => {
    const env = fresh();
    expect((await env.plane.write(omar, item(1), AT)).event.decision).toBe("allow");
    // Version 2 names version 1 and was retired: it supersedes nothing.
    const retired = item(2, { valid_from: LATER, lineage: [id(1)], status: "retired" });
    appendEvent(env.db, {
      id: id(9000),
      ts: AT,
      op: "write",
      item_id: retired.id,
      actor: omar.id,
      scope_from: null,
      scope_to: retired.scope,
      decision: "allow",
      reason: "seeded",
      policy_id: "seed",
      item: retired,
      schema_version: 1,
    });
    const plan = planSupersession(env.db, env.policy, omar, id(1), NOW);
    expect(plan.head).toEqual({ ok: true, head_id: id(1), chain: [id(1)] });
    expect(plan.proposals).toEqual([]);
    // Asked about itself, the retired version is an unknown id (L6-1).
    expect(planSupersession(env.db, env.policy, omar, id(2), NOW).head).toEqual({
      ok: false,
      error: "unknown_id",
      chain: [],
    });
  });

  test("a lineage cycle is reported and proposes nothing", async () => {
    const env = fresh();
    await env.plane.write(omar, item(1, { lineage: [id(2)] }), AT);
    await env.plane.write(omar, item(2, { valid_from: LATER, lineage: [id(1)] }), AT);
    const plan = planSupersession(env.db, env.policy, omar, id(2), NOW);
    expect(plan.head).toEqual({ ok: false, error: "cycle_detected", chain: [id(2), id(1)] });
    expect(plan.proposals).toEqual([]);
  });
});

describe("applying an accepted close", () => {
  test("is a governed write of a new version in place, closing the old window", async () => {
    const env = await replaced();
    const plan = planSupersession(env.db, env.policy, omar, id(2), NOW);
    const [closed] = acceptedClosures(env.db, plan, [id(1)]);
    expect(closed).toMatchObject({ id: id(1), valid_to: LATER, version: 2, status: "active" });
    const { event, item: stored } = await env.plane.write(omar, closed as never, NOW);
    expect(event).toMatchObject({ op: "write", decision: "allow", item_id: id(1) });
    expect(event.policy_id).toBe("test/write/team");
    expect(stored).toMatchObject({ valid_to: LATER, version: 2, status: "active" });
    expect(itemById(env.db, id(1))).toMatchObject({ valid_to: LATER, status: "active" });
    // A read after the replacement's start now returns the replacement alone.
    const read = await env.plane.read(omar, { text: "deploy window", at: NOW });
    expect(read.items.map((i) => i.id)).toEqual([id(2)]);
    // Applied once, it is done.
    const again = planSupersession(env.db, env.policy, omar, id(2), NOW);
    expect(again.proposals).toEqual([]);
  });

  test("is refused by the gate for a grantee, who may read the item but not write it", async () => {
    const grant = {
      to: "person:sam",
      class: "semantic" as const,
      mode: "read" as const,
      expires: "2027-01-01T00:00:00Z",
    };
    const env = await replaced({ grants: [grant] });
    const sam: Actor = {
      id: "person:sam",
      level: "person",
      memberships: ["person:sam"],
      source: "user",
    };
    // Sam's own replacement, in Sam's scope, names the team's item it replaces.
    const mine = item(3, {
      scope: "person:sam",
      owner: sam.id,
      valid_from: LATER,
      lineage: [id(1)],
    });
    expect((await env.plane.write(sam, mine, AT)).event.decision).toBe("allow");
    const plan = planSupersession(env.db, env.policy, sam, id(3), NOW);
    const [closed] = acceptedClosures(env.db, plan, [id(1)]);
    const { event } = await env.plane.write(sam, closed as never, NOW);
    expect(event).toMatchObject({ op: "write", decision: "deny", policy_id: WRITE_MEMBERSHIP_ID });
    expect(itemById(env.db, id(1))).toMatchObject({ valid_to: null, version: 1 });
  });

  // RD1 review finding 6: the answer is disclosed in core, so no surface
  // that writes closes has to remember to.
  test("writeClosures answers with each close as the actor is shown it: its own grant, no hidden ancestor", async () => {
    const grant = (to: string) => ({
      to,
      class: "semantic" as const,
      mode: "read" as const,
      expires: "2027-01-01T00:00:00Z",
    });
    const sam: Actor = {
      id: "person:sam",
      level: "person",
      memberships: ["person:sam"],
      source: "user",
    };
    const env = fresh();
    for (const it of [
      item(5, {
        scope: "person:omar",
        content: "Omar's own note.",
        valid_from: "2026-09-01T00:00:00Z",
        valid_to: "2026-09-15T00:00:00Z",
      }),
      item(1, {
        content: "The deploy window is Tuesday.",
        grants: [grant("person:eve"), grant(sam.id)],
        lineage: [id(5)],
      }),
    ])
      expect((await env.plane.write(omar, it, AT)).event.decision).toBe("allow");
    const mine = item(3, {
      scope: "person:sam",
      owner: sam.id,
      valid_from: LATER,
      lineage: [id(1)],
    });
    expect((await env.plane.write(sam, mine, AT)).event.decision).toBe("allow");
    const plan = planSupersession(env.db, env.policy, sam, id(3), NOW);
    const closes = acceptedClosures(env.db, plan, [id(1)]);
    expect(closes[0]?.grants.map((g) => g.to)).toEqual(["person:eve", sam.id]);
    expect(closes[0]?.lineage).toEqual([id(5)]);
    const out = await writeClosures(env, sam, closes, NOW);
    expect(out.submitted.map((i) => [i.id, i.lineage, i.grants.map((g) => g.to)])).toEqual([
      [id(1), [], [sam.id]],
    ]);
    expect(out.applied[0]?.event).toMatchObject({ decision: "deny", item_id: id(1) });
    expect(JSON.stringify(out)).not.toContain("person:eve");
    expect(JSON.stringify(out)).not.toContain(id(5));
    // The owner's own close comes back whole.
    const own = item(4, { valid_from: LATER, lineage: [id(1)] });
    expect((await env.plane.write(omar, own, AT)).event.decision).toBe("allow");
    const omars = acceptedClosures(env.db, planSupersession(env.db, env.policy, omar, id(4), NOW), [
      id(1),
    ]);
    const whole = await writeClosures(env, omar, omars, NOW);
    expect(whole.applied[0]?.item?.grants.map((g) => g.to)).toEqual(["person:eve", sam.id]);
    expect(whole.applied[0]?.item?.lineage).toEqual([id(5)]);
  });

  test("refuses an id the plan proposes no close for, before anything is written", async () => {
    const env = await replaced();
    const plan = planSupersession(env.db, env.policy, omar, id(2), NOW);
    expect(() => acceptedClosures(env.db, plan, [id(1), id(7)])).toThrow(InvalidCallError);
    expect(() => acceptedClosures(env.db, plan, [id(2)])).toThrow(/no close is proposed/);
    expect(acceptedClosures(env.db, plan, [])).toEqual([]);
  });

  test("closedVersion refuses a review proposal", async () => {
    const env = await replaced({ valid_from: LATER });
    const plan = planSupersession(env.db, env.policy, omar, id(2), NOW);
    const [review] = plan.proposals;
    expect(review).toMatchObject({ action: "review", relation: "equals" });
    const candidate = itemById(env.db, id(1));
    expect(() => closedVersion(candidate as never, review as never)).toThrow(InvalidCallError);
  });
});
