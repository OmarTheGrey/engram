// LongMemEval's question record (arXiv 2410.10813, ICLR 2025; card B5), as the
// cleaned release at the pin in packages/bench/PINS.md holds it (README.md
// "Dataset Format" at upstream commit 9e0b455). Derived from LongMemEval, MIT
// licence, Copyright (c) 2024 Di Wu; see fixtures/bench/longmemeval/UPSTREAM-LICENSE.
import { z } from "zod";

/** The six question types upstream scores (print_qa_metrics.py `type2acc`), in its order. */
export const QUESTION_TYPES = [
  "single-session-user",
  "single-session-preference",
  "single-session-assistant",
  "multi-session",
  "temporal-reasoning",
  "knowledge-update",
] as const;
export const QuestionType = z.enum(QUESTION_TYPES);
export type QuestionType = z.infer<typeof QuestionType>;

/** One turn of a history session; `has_answer` marks an evidence turn (a label). */
export const Turn = z.strictObject({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  has_answer: z.boolean().optional(),
});
export type Turn = z.infer<typeof Turn>;

export const Question = z
  .strictObject({
    question_id: z.string().min(1),
    question_type: QuestionType,
    question: z.string(),
    /** A string, or a number for some counting questions; upstream formats it with str(). */
    answer: z.union([z.string(), z.number()]),
    /** `YYYY/MM/DD (Day) HH:MM`. */
    question_date: z.string(),
    haystack_dates: z.array(z.string()),
    haystack_session_ids: z.array(z.string()),
    haystack_sessions: z.array(z.array(Turn)),
    answer_session_ids: z.array(z.string()),
  })
  .refine(
    (q) =>
      q.haystack_dates.length === q.haystack_sessions.length &&
      q.haystack_session_ids.length === q.haystack_sessions.length,
    { message: "haystack_dates, haystack_session_ids and haystack_sessions differ in length" },
  );
export type Question = z.infer<typeof Question>;

/** Upstream's abstention rule (evaluate_qa.py): the question id contains `_abs`. */
export const isAbstention = (q: Pick<Question, "question_id">) => q.question_id.includes("_abs");

/**
 * The category a question is reported under: its type, with `+abstention`
 * for an abstention question. The fixture is stratified on these ten.
 */
export const categoryOf = (q: Pick<Question, "question_id" | "question_type">) =>
  isAbstention(q) ? `${q.question_type}+abstention` : q.question_type;
