import { createFakeAdapter } from "@engram/adapters";
import { createPlane, loadPreset, migrate, openSqlite } from "@engram/core";
import { describe, expect, test } from "vitest";
import {
  historyWrites,
  longMemEvalTime,
  questionRead,
  readTime,
  turnActor,
  USER,
  writePhase,
} from "../../src/longmemeval/plane.ts";
import type { Question } from "../../src/longmemeval/schema.ts";
import { visibleQuestion } from "../../src/longmemeval/strip.ts";
import { questions } from "./fixture.ts";

const ids = () => {
  let n = 0;
  return () => `01920000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
};

/** One question through a fresh plane on the fake store: the write phase, then the read at the question date. */
async function run(q: Question) {
  const db = openSqlite(":memory:");
  migrate(db);
  const newId = ids();
  const plane = createPlane({
    db,
    adapter: createFakeAdapter(),
    policy: loadPreset("medium"),
    newId,
  });
  const view = visibleQuestion(q);
  const writes = await writePhase(plane, view, newId);
  const read = await questionRead(plane, view, q.question);
  const events = plane.events();
  db.close();
  return { writes, read, events };
}

describe("LongMemEval's dates", () => {
  test("read upstream's `YYYY/MM/DD (Day) HH:MM` as UTC", () => {
    expect(longMemEvalTime("2023/04/10 (Mon) 17:50")).toBe("2023-04-10T17:50:00.000Z");
  });

  test("refuse any other shape", () => {
    expect(() => longMemEvalTime("2023-04-10 17:50")).toThrow("is not YYYY/MM/DD (Day) HH:MM");
  });

  test("the read is at the question's date, or after the last turn when a session is dated later", () => {
    const later = questions.find((q) => q.question_id === "c8090214_abs") as Question;
    // Upstream dates its second session 18:16, after the question at 17:02.
    expect(later.question_date).toBe("2023/05/27 (Sat) 17:02");
    const view = visibleQuestion(later);
    const lastTurns = (view.sessions[1]?.turns.length ?? 0) - 1;
    expect(readTime(view)).toBe(new Date(Date.UTC(2023, 4, 27, 18, 16, lastTurns)).toISOString());
    const plain = visibleQuestion(questions[0] as Question);
    expect(Date.parse(readTime(plain))).toBeGreaterThanOrEqual(
      Date.parse(longMemEvalTime(plain.question_date)),
    );
  });
});

describe("LongMemEval through the plane (card B5)", () => {
  test("a user turn is user content and an assistant turn model content, both in the user's person scope", () => {
    expect(turnActor({ role: "user" }).source).toBe("user");
    expect(turnActor({ role: "assistant" }).source).toBe("model");
    const q = questions[0] as Question;
    const writes = historyWrites(visibleQuestion(q), ids());
    expect(writes.every((w) => w.item.scope === USER && w.item.class === "episodic")).toBe(true);
    expect(writes.map((w) => w.item.provenance.kind)).toEqual(
      q.haystack_sessions.flat().map((t) => (t.role === "user" ? "user" : "model")),
    );
  });

  test("no item carries a label: no answer, no evidence flag, no session or question id", () => {
    for (const q of questions) {
      const items = historyWrites(visibleQuestion(q), ids()).map((w) => JSON.stringify(w.item));
      for (const label of [q.question_id, ...q.haystack_session_ids, "has_answer"]) {
        expect(items.some((i) => i.includes(label))).toBe(false);
      }
    }
  });

  test.each(questions.map((q) => [q.question_id, q] as const))(
    "%s: under medium every turn is admitted, and the read after the last turn returns the history",
    async (_id, q) => {
      const { writes, read, events } = await run(q);
      expect(writes.map((w) => w.result.event.decision)).toEqual(writes.map(() => "allow"));
      expect(writes).toHaveLength(q.haystack_sessions.flat().length);
      expect(read.event.decision).toBe("allow");
      // Every decision is one event with a reason and a policy id (AGENTS.md rule 3).
      expect(events.every((e) => e.reason !== "" && e.policy_id !== "")).toBe(true);
      expect(read.items.every((i) => i.scope === USER)).toBe(true);
      expect(Date.parse(readTime(visibleQuestion(q)))).toBeGreaterThanOrEqual(
        Math.max(...writes.map((w) => Date.parse(w.result.item?.valid_from ?? ""))),
      );
    },
  );
});
