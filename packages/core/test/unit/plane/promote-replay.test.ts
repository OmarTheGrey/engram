// Card D3 on the real Plane: a procedural candidate becomes active through
// Plane.promote only with a replay, from which the plane derives the
// validation record itself (distill/validate.ts); the event's reason carries
// the counts; a replay below replay_k of replay_n leaves it a candidate with
// one deny event; a replay that names an induction task is refused before the
// log is touched; an agent presenting a replay is refused.
import { describe, expect, test } from "vitest";
import type { ReplayEvidence } from "../../../src/distill/validate.ts";
import { itemById } from "../../../src/items.ts";
import { type Actor, InvalidCallError } from "../../../src/plane.ts";
import {
  PROMOTE_NO_EVIDENCE_ID,
  PROMOTE_VALIDATION_SOURCE_ID,
} from "../../../src/policy/promotion.ts";
import type { MemoryItem } from "../../../src/schema.ts";
import { AT, fresh, id, item, testPolicy } from "./helpers.ts";

const SCOPES = ["person:omar", "team:platform", "org"];
/** The operator who ran the replay: the candidate's owner, user-sourced. */
const omar: Actor = { id: "person:omar", level: "person", memberships: SCOPES, source: "user" };
/** The distiller that wrote the candidate, acting for omar with source model. */
const distiller: Actor = { ...omar, source: "model" };

const POLICY = testPolicy({
  write: testPolicy().write.map((r) =>
    r.scope === "person" ? { ...r, confidence_floor: 0, forbidden_classes: [] } : r,
  ),
});

const skill = () =>
  item(1, {
    class: "procedural",
    scope: "person:omar",
    status: "candidate",
    kind: "model",
    content: { body: "Look the order up before changing it.", tools: ["get_order"] },
  } as Partial<MemoryItem> & { kind: "model" });

/** Five held-out tasks, `passes` passing with the candidate and `base` without it. */
const replay = (passes: number, base: number, induced = ["t1", "t2"]): ReplayEvidence => ({
  induced_from: induced,
  threshold: 1,
  outcomes: ["t3", "t4", "t5", "t6", "t7"].map((task, i) => ({
    task,
    seed: 1,
    without: i < base ? 1 : 0,
    with: i < passes ? 1 : 0,
  })),
});

async function withCandidate() {
  const f = fresh(POLICY);
  const written = await f.plane.write(distiller, skill(), AT);
  expect(written.event.decision).toBe("allow");
  expect(itemById(f.db, id(1))?.status).toBe("candidate");
  return f;
}

describe("acceptance (card D3): replay admission through Plane.promote", () => {
  test("a replay at replay_k of replay_n makes the candidate active, the counts in the reason", async () => {
    const { plane, db } = await withCandidate();
    const result = await plane.promote(omar, id(1), "person:omar", AT, { replay: replay(4, 2) });
    expect(result.decision).toBe("allow");
    expect(result.event).toMatchObject({ op: "promote", policy_id: "test/promotion/procedural" });
    expect(result.event.reason).toContain(
      "the validation record 4 of 5 held-out tasks at or above 1 with the procedure (2 of 5 without it) meets 4 of 5",
    );
    expect(itemById(db, id(1))).toMatchObject({ status: "active", version: 2 });
  });

  test("a replay below it leaves the candidate a candidate, with one deny event", async () => {
    const { plane, db } = await withCandidate();
    const before = plane.events().length;
    const result = await plane.promote(omar, id(1), "person:omar", AT, { replay: replay(3, 4) });
    expect(result).toMatchObject({ decision: "deny", item: null });
    expect(result.event.policy_id).toBe(PROMOTE_NO_EVIDENCE_ID);
    expect(result.event.reason).toBe(
      "not promoted: the validation record 3 of 5 held-out tasks at or above 1 with the procedure (4 of 5 without it) does not meet 4 of 5",
    );
    expect(plane.events().length).toBe(before + 1);
    expect(itemById(db, id(1))?.status).toBe("candidate");
  });

  test("a replay naming a task the candidate was induced from is refused before the log", async () => {
    const { plane, db } = await withCandidate();
    const before = plane.events().length;
    await expect(
      plane.promote(omar, id(1), "person:omar", AT, { replay: replay(5, 0, ["t1", "t4"]) }),
    ).rejects.toThrow(InvalidCallError);
    await expect(
      plane.promote(omar, id(1), "person:omar", AT, { replay: replay(5, 0, ["t1", "t4"]) }),
    ).rejects.toThrow("t4 is a task the candidate was induced from");
    expect(plane.events().length).toBe(before);
    expect(itemById(db, id(1))?.status).toBe("candidate");
  });

  test("the agent that wrote the candidate cannot present its replay", async () => {
    const { plane, db } = await withCandidate();
    const result = await plane.promote(distiller, id(1), "person:omar", AT, {
      replay: replay(5, 0),
    });
    expect(result).toMatchObject({ decision: "deny", item: null });
    expect(result.event.policy_id).toBe(PROMOTE_VALIDATION_SOURCE_ID);
    expect(itemById(db, id(1))?.status).toBe("candidate");
  });

  test("a review never stands in for the replay", async () => {
    const { plane, db } = await withCandidate();
    const sara: Actor = { ...omar, id: "person:sara" };
    const result = await plane.promote(sara, id(1), "person:omar", AT, { review: true });
    expect(result.event.policy_id).toBe(PROMOTE_NO_EVIDENCE_ID);
    expect(itemById(db, id(1))?.status).toBe("candidate");
  });
});
