// Card B6: the clock problem card L2 found, measured by the plane's own read
// filter. A synthetic question whose history spans more than preset medium's
// 90-day ttl, with its evidence in the oldest session, read at each clock
// under the three presets.
import type { longMemEval } from "@engram/bench";
import { describe, expect, test } from "vitest";
import { clockRow, clockTimes } from "../../src/research/longmemeval-clock.ts";

const DAY = 86_400;
const turns = (answer = false): longMemEval.Turn[] => [
  {
    role: "user",
    content: "I graduated with a degree in Business Administration.",
    has_answer: answer,
  },
  { role: "assistant", content: "Congratulations on your degree." },
];

/** Evidence in the oldest session, 91 days before the question; then 34 and 5 days before it. */
const question: longMemEval.Question = {
  question_id: "q-clock",
  question_type: "single-session-user",
  question: "What degree did I graduate with?",
  answer: "Business Administration",
  question_date: "2023/05/10 (Wed) 12:00",
  haystack_dates: ["2023/02/08 (Wed) 12:00", "2023/04/06 (Thu) 12:00", "2023/05/05 (Fri) 12:00"],
  haystack_session_ids: ["answer_q_1", "s_2", "s_3"],
  haystack_sessions: [turns(true), turns(), turns()],
  answer_session_ids: ["answer_q_1"],
};
const REAL = "2026-11-19T00:00:00.000Z";

describe("the clocks", () => {
  test("read_time is B5's read time, last_session the last turn's time, real_time the fixed instant", () => {
    const view = {
      question_id: question.question_id,
      question: question.question,
      question_date: question.question_date,
      sessions: question.haystack_sessions.map((t, i) => ({
        date: question.haystack_dates[i] as string,
        turns: t.map(({ role, content }) => ({ role, content })),
      })),
    };
    expect(clockTimes(view, REAL)).toEqual({
      read_time: "2023-05-10T12:00:00.000Z",
      last_session: "2023-05-05T12:00:01.000Z",
      real_time: REAL,
    });
  });
});

describe("what the read filter hides at each clock", () => {
  test("preset medium hides the evidence session at the question's date, by its ttl, and not at the last session", async () => {
    const row = await clockRow(question, ["medium"], REAL);
    expect(row).toMatchObject({ turns: 6, evidence_turns: 1, evidence_session_turns: 2 });
    const medium = row.presets.medium;
    expect(medium?.writes).toEqual({ allow: 6 });
    expect(medium?.clocks.read_time).toEqual({
      at: "2023-05-10T12:00:00.000Z",
      returned: 4,
      hidden: 2,
      expired: 2,
      outside_validity: 0,
      not_active: 0,
      evidence_turns_hidden: 1,
      evidence_session_turns_hidden: 2,
      oldest_age_seconds: 91 * DAY,
    });
    expect(medium?.clocks.last_session).toMatchObject({ hidden: 0, evidence_turns_hidden: 0 });
    expect(medium?.clocks.real_time).toMatchObject({ hidden: 6, expired: 6, returned: 0 });
  });

  test("preset strict's 30 days hide more, and preset permissive, with no ttl, hides nothing", async () => {
    const row = await clockRow(question, ["strict", "permissive"], REAL);
    const hidden = (p: string) =>
      Object.fromEntries(
        Object.entries(row.presets[p]?.clocks ?? {}).map(([c, cell]) => [c, cell.hidden]),
      );
    expect(hidden("strict")).toEqual({ read_time: 4, last_session: 2, real_time: 6 });
    expect(hidden("permissive")).toEqual({ read_time: 0, last_session: 0, real_time: 0 });
  });

  test("a session dated after the question is read at its last turn, so validity hides nothing", async () => {
    const late = {
      ...question,
      question_id: "q-late",
      haystack_dates: [
        "2023/02/08 (Wed) 12:00",
        "2023/04/06 (Thu) 12:00",
        "2023/05/11 (Thu) 09:00",
      ],
    };
    const cell = (await clockRow(late, ["medium"], REAL)).presets.medium?.clocks.read_time;
    expect(cell).toMatchObject({ at: "2023-05-11T09:00:01.000Z", outside_validity: 0 });
  });
});
