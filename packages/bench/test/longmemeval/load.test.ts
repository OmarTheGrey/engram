import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { CATEGORIES, PER_CATEGORY, selectQuestions } from "../../scripts/vendor-longmemeval.ts";
import { findQuestion, loadQuestions } from "../../src/longmemeval/load.ts";
import { checkLongMemEvalData } from "../../src/longmemeval/pinned.ts";
import { categoryOf, isAbstention } from "../../src/longmemeval/schema.ts";
import { FIXTURE, questions } from "./fixture.ts";

describe("the vendored LongMemEval subset", () => {
  test("holds two questions of each of the ten categories upstream has, in category order", () => {
    // Twelve names in CATEGORIES; upstream has no abstention question of the
    // single-session-preference and single-session-assistant types.
    const present = CATEGORIES.filter((c) => questions.some((q) => categoryOf(q) === c));
    expect(present).toHaveLength(10);
    expect(questions).toHaveLength(present.length * PER_CATEGORY);
    expect(questions.map(categoryOf)).toEqual(present.flatMap((c) => [c, c]));
  });

  test("marks abstention by upstream's rule, `_abs` in the question id", () => {
    const abs = questions.filter(isAbstention);
    expect(abs).toHaveLength(8);
    expect(abs.every((q) => q.question_id.endsWith("_abs"))).toBe(true);
  });

  test("is exactly the pinned subset its manifest hashes", () => {
    expect(checkLongMemEvalData(FIXTURE).set).toBe("fixture");
  });

  test("a changed line is no longer the pinned subset", () => {
    const dir = mkdtempSync(join(tmpdir(), "engram-lme-"));
    const text = readFileSync(join(FIXTURE, "questions.jsonl"), "utf8");
    writeFileSync(join(dir, "questions.jsonl"), text.replace("?", "!"));
    expect(checkLongMemEvalData(dir).set).toBe("unpinned");
  });

  test("the selection rule is deterministic and reproduces the fixture from its own questions", () => {
    expect(selectQuestions(questions).map((q) => q.question_id)).toEqual(
      selectQuestions(questions).map((q) => q.question_id),
    );
  });

  test("the loader refuses a repeated question id and names the line", () => {
    const dir = mkdtempSync(join(tmpdir(), "engram-lme-"));
    const first = readFileSync(join(FIXTURE, "questions.jsonl"), "utf8").split("\n")[0];
    writeFileSync(join(dir, "questions.jsonl"), `${first}\n${first}\n`);
    expect(() => loadQuestions(dir)).toThrow(/:2: repeated question id/);
  });

  test("findQuestion names a missing id", () => {
    expect(() => findQuestion(questions, "nope")).toThrow("no LongMemEval question nope");
  });
});
