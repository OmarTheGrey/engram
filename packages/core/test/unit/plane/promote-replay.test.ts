// Card D3 on the real Plane: a procedural candidate becomes active through
// Plane.promote only with a replay, from which the plane derives the
// validation record itself (distill/validate.ts); the event's reason carries
// the counts and the replay's sha256; a replay below replay_k of replay_n
// leaves it a candidate with one deny event. The replay is bound to the item
// (its id and content hash) and its induction tasks to the item's own distill
// ref, read through the injected session index: a replay of another item, or
// one whose split is not the ref's, is refused with one deny event under its
// own rule. A malformed replay is refused before the log is touched; an
// agent presenting a replay is refused.
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import { strictContentHash } from "../../../src/content-hash.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { openSqlite } from "../../../src/db/sqlite.ts";
import { type ReplayEvidence, replayDigest } from "../../../src/distill/validate.ts";
import { itemById } from "../../../src/items.ts";
import { type Actor, createPlane, InvalidCallError } from "../../../src/plane.ts";
import {
  PROMOTE_NO_EVIDENCE_ID,
  PROMOTE_REPLAY_ITEM_ID,
  PROMOTE_REPLAY_SPLIT_ID,
  PROMOTE_VALIDATION_SOURCE_ID,
} from "../../../src/policy/promotion.ts";
import type { MemoryItem } from "../../../src/schema.ts";
import { AT, id, item, testPolicy } from "./helpers.ts";

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

/** Card D1's index, as the runner injects it: session id to task id. */
const SESSIONS = new Map([
  ["s1", "t1"],
  ["s2", "t2"],
]);

const CONTENT = { body: "Look the order up before changing it.", tools: ["get_order"] };

const skill = (ref = "distill:awm:s1,s2") =>
  ({
    ...item(1, { kind: "model" }),
    class: "procedural",
    scope: "person:omar",
    status: "candidate",
    content: CONTENT,
    provenance: { ...item(1).provenance, kind: "model", ref },
  }) as MemoryItem;

/** Five held-out tasks, `passes` passing with the candidate and `base` without it. */
const replay = (
  passes: number,
  base: number,
  over: Partial<ReplayEvidence> = {},
): ReplayEvidence => ({
  item_id: id(1),
  content_hash: strictContentHash(CONTENT),
  induced_from: ["t1", "t2"],
  threshold: 1,
  outcomes: ["t3", "t4", "t5", "t6", "t7"].map((task, i) => ({
    task,
    seed: 1,
    without: i < base ? 1 : 0,
    with: i < passes ? 1 : 0,
  })),
  ...over,
});

async function withCandidate(
  ref?: string,
  sessions: ReadonlyMap<string, string> | null = SESSIONS,
) {
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const plane = createPlane({
    db,
    adapter: createFakeAdapter(),
    policy: POLICY,
    newId: () => id(900_000 + ++n),
    ...(sessions === null ? {} : { distillTasks: sessions }),
  });
  const written = await plane.write(distiller, skill(ref), AT);
  expect(written.event.decision).toBe("allow");
  expect(itemById(db, id(1))?.status).toBe("candidate");
  return { plane, db };
}

describe("acceptance (card D3): replay admission through Plane.promote", () => {
  test("a replay at replay_k of replay_n makes the candidate active, the counts and its sha256 in the reason", async () => {
    const { plane, db } = await withCandidate();
    const presented = replay(4, 2);
    const result = await plane.promote(omar, id(1), "person:omar", AT, { replay: presented });
    expect(result.decision).toBe("allow");
    expect(result.event).toMatchObject({ op: "promote", policy_id: "test/promotion/procedural" });
    expect(result.event.reason).toContain(
      "the validation record 4 of 5 held-out tasks at or above 1 with the procedure (2 of 5 without it) meets 4 of 5",
    );
    expect(result.event.reason).toContain(`replay ${replayDigest(presented)}`);
    expect(itemById(db, id(1))).toMatchObject({ status: "active", version: 2 });
  });

  test("a replay below it leaves the candidate a candidate, with one deny event", async () => {
    const { plane, db } = await withCandidate();
    const before = plane.events().length;
    const presented = replay(3, 4);
    const result = await plane.promote(omar, id(1), "person:omar", AT, { replay: presented });
    expect(result).toMatchObject({ decision: "deny", item: null });
    expect(result.event.policy_id).toBe(PROMOTE_NO_EVIDENCE_ID);
    expect(result.event.reason).toBe(
      `not promoted: the validation record 3 of 5 held-out tasks at or above 1 with the procedure (4 of 5 without it) does not meet 4 of 5; replay ${replayDigest(presented)}`,
    );
    expect(plane.events().length).toBe(before + 1);
    expect(itemById(db, id(1))?.status).toBe("candidate");
  });

  test("a replay naming a task the candidate was induced from is one deny event", async () => {
    const { plane, db } = await withCandidate();
    const before = plane.events().length;
    const leaked = replay(5, 0, { induced_from: ["t1", "t2", "t4"] });
    const result = await plane.promote(omar, id(1), "person:omar", AT, { replay: leaked });
    expect(result).toMatchObject({ decision: "deny", item: null });
    expect(result.event.policy_id).toBe(PROMOTE_REPLAY_SPLIT_ID);
    expect(result.event.reason).toContain("t4");
    expect(plane.events().length).toBe(before + 1);
    expect(itemById(db, id(1))?.status).toBe("candidate");
  });

  test("an empty induced_from against a ref naming t1, with t1 replayed, is refused", async () => {
    const { plane, db } = await withCandidate("distill:rule:s1");
    const hidden = replay(5, 0, {
      induced_from: [],
      outcomes: ["t1", "t3", "t4", "t5", "t6"].map((task) => ({
        task,
        seed: 1,
        without: 0,
        with: 1,
      })),
    });
    const result = await plane.promote(omar, id(1), "person:omar", AT, { replay: hidden });
    expect(result.event.policy_id).toBe(PROMOTE_REPLAY_SPLIT_ID);
    expect(itemById(db, id(1))?.status).toBe("candidate");
  });

  test("a replay presented for another item is refused", async () => {
    const { plane, db } = await withCandidate();
    const other = replay(5, 0, { item_id: id(2) });
    const result = await plane.promote(omar, id(1), "person:omar", AT, { replay: other });
    expect(result.event.policy_id).toBe(PROMOTE_REPLAY_ITEM_ID);
    expect(itemById(db, id(1))?.status).toBe("candidate");
  });

  test("without a session index the plane cannot check a distill ref, and refuses", async () => {
    const { plane, db } = await withCandidate(undefined, null);
    const result = await plane.promote(omar, id(1), "person:omar", AT, { replay: replay(5, 0) });
    expect(result.event.policy_id).toBe(PROMOTE_REPLAY_SPLIT_ID);
    expect(result.event.reason).toContain("no session index");
    expect(itemById(db, id(1))?.status).toBe("candidate");
  });

  test("a malformed replay is refused before the log", async () => {
    const { plane } = await withCandidate();
    const before = plane.events().length;
    const twice = replay(5, 0);
    const bad = {
      ...twice,
      outcomes: [...twice.outcomes, { task: "t3", seed: 1, without: 0, with: 2 }],
    };
    await expect(plane.promote(omar, id(1), "person:omar", AT, { replay: bad })).rejects.toThrow(
      InvalidCallError,
    );
    expect(plane.events().length).toBe(before);
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
