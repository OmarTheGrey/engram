// LongMemEval's category breakdown, ported from upstream at commit 9e0b455
// (card B5): src/evaluation/print_qa_metrics.py reports accuracy per question
// type in its fixed order, the task-averaged accuracy (the mean of the
// per-type means), the overall accuracy and the abstention accuracy.
// Derived from LongMemEval, MIT licence, Copyright (c) 2024 Di Wu; see
// fixtures/bench/longmemeval/UPSTREAM-LICENSE.
//
// Upstream's np.mean of an empty list is nan (with a warning), which would
// make the task average nan whenever a type is absent; here an absent type
// has a null accuracy and the task average is over the types present, which
// the breakdown states (`types_present`). Rounding to four places, as
// upstream prints, is left to the reader of the numbers.
import { isAbstention, QUESTION_TYPES, type Question, type QuestionType } from "./schema.ts";

export interface LabelledAnswer {
  question: Pick<Question, "question_id" | "question_type">;
  label: boolean;
}

export interface CategoryBreakdown {
  by_type: Record<QuestionType, { accuracy: number | null; n: number }>;
  /** The mean of the per-type accuracies over the types present. */
  task_averaged: number | null;
  types_present: number;
  overall: { accuracy: number | null; n: number };
  abstention: { accuracy: number | null; n: number };
}

const mean = (xs: readonly number[]) =>
  xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;

export function categoryBreakdown(rows: readonly LabelledAnswer[]): CategoryBreakdown {
  const byType = Object.fromEntries(
    QUESTION_TYPES.map((t) => {
      const v = rows.filter((r) => r.question.question_type === t).map((r) => (r.label ? 1 : 0));
      return [t, { accuracy: mean(v), n: v.length }];
    }),
  ) as CategoryBreakdown["by_type"];
  const present = QUESTION_TYPES.flatMap((t) => {
    const a = byType[t].accuracy;
    return a === null ? [] : [a];
  });
  const all = rows.map((r) => (r.label ? 1 : 0));
  const abs = rows.filter((r) => isAbstention(r.question)).map((r) => (r.label ? 1 : 0));
  return {
    by_type: byType,
    task_averaged: mean(present),
    types_present: present.length,
    overall: { accuracy: mean(all), n: all.length },
    abstention: { accuracy: mean(abs), n: abs.length },
  };
}
