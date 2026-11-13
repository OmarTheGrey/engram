// What of a LongMemEval question the plane and the model under test may see
// (card B5): the history sessions with their dates, the question and its date.
// The answer, the evidence labels (`has_answer`, `answer_session_ids`), the
// question type and the session ids are labels or carry them (an id such as
// `answer_4be1b6b4_2` names an evidence session, and a question id with
// `_abs` names an abstention question), so none of them reaches a write, a
// read or a prompt. Only the judge and the score read the full record.
import type { Question } from "./schema.ts";

export interface VisibleTurn {
  role: "user" | "assistant";
  content: string;
}

export interface VisibleSession {
  /** Upstream's `YYYY/MM/DD (Day) HH:MM`. */
  date: string;
  turns: VisibleTurn[];
}

export interface VisibleQuestion {
  /** Kept for the cache key and the results only; never written, read or prompted. */
  question_id: string;
  question: string;
  question_date: string;
  sessions: VisibleSession[];
}

export function visibleQuestion(q: Question): VisibleQuestion {
  return {
    question_id: q.question_id,
    question: q.question,
    question_date: q.question_date,
    sessions: q.haystack_sessions.map((turns, i) => ({
      date: q.haystack_dates[i] as string,
      turns: turns.map(({ role, content }) => ({ role, content })),
    })),
  };
}
