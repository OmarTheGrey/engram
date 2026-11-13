import { describe, expect, test } from "vitest";
import type { QuestionType } from "../../src/longmemeval/schema.ts";
import { categoryBreakdown } from "../../src/longmemeval/score.ts";

const row = (question_id: string, question_type: QuestionType, label: boolean) => ({
  question: { question_id, question_type },
  label,
});

describe("the LongMemEval category breakdown (print_qa_metrics.py)", () => {
  test("gives per-type, task-averaged, overall and abstention accuracy", () => {
    const b = categoryBreakdown([
      row("a", "single-session-user", true),
      row("b", "single-session-user", false),
      row("c_abs", "single-session-user", true),
      row("d", "temporal-reasoning", true),
    ]);
    expect(b.by_type["single-session-user"]).toEqual({ accuracy: 2 / 3, n: 3 });
    expect(b.by_type["temporal-reasoning"]).toEqual({ accuracy: 1, n: 1 });
    expect(b.task_averaged).toBeCloseTo((2 / 3 + 1) / 2);
    expect(b.types_present).toBe(2);
    expect(b.overall).toEqual({ accuracy: 3 / 4, n: 4 });
    expect(b.abstention).toEqual({ accuracy: 1, n: 1 });
  });

  test("an absent type has a null accuracy and does not enter the task average", () => {
    const b = categoryBreakdown([row("a", "multi-session", false)]);
    expect(b.by_type["knowledge-update"]).toEqual({ accuracy: null, n: 0 });
    expect(b.task_averaged).toBe(0);
    expect(b.types_present).toBe(1);
    expect(b.abstention).toEqual({ accuracy: null, n: 0 });
  });

  test("an empty run has no accuracy anywhere", () => {
    const b = categoryBreakdown([]);
    expect(b.overall.accuracy).toBeNull();
    expect(b.task_averaged).toBeNull();
  });
});
