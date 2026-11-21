// The supersession plan and its application through the real Plane (card
// L6), over the fake store. A replacement that names the old version only in
// its lineage leaves both admitted (card A5's finding,
// docs/log/2026-11-21-a5-finding-lineage-alone-admits-both.md); the plan
// proposes closing the old window, and an accepted close is an ordinary
// write of a new version in place, which the write gate decides and the log
// records. The plan names nothing the actor cannot read.
import { describe, expect, test } from "vitest";
import { InvalidCallError } from "../../../src/actor.ts";
import { itemById } from "../../../src/items.ts";
import type { Actor } from "../../../src/plane.ts";
import { WRITE_MEMBERSHIP_ID } from "../../../src/policy/evaluate.ts";
import type { MemoryItem } from "../../../src/schema.ts";
import { acceptedClosures, closedVersion, planSupersession } from "../../../src/supersede.ts";
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
