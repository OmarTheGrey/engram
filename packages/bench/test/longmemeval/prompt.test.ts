// The port's prompt strings are upstream's byte for byte: each one, written as
// a Python string literal, appears in the vendored upstream source it was
// taken from (fixtures/bench/longmemeval/upstream, hashed in the manifest).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  JUDGE_TEMPLATES,
  judgeTemplate,
  pyFormat,
  pyStrAnswer,
  READER_TEMPLATE,
  renderJudgePrompt,
  renderReaderPrompt,
} from "../../src/longmemeval/prompt.ts";
import { visibleQuestion } from "../../src/longmemeval/strip.ts";
import { FIXTURE, questions } from "./fixture.ts";

const upstream = (path: string) => readFileSync(join(FIXTURE, "upstream", path), "utf8");
/** A template as it is written inside a Python string literal. */
const asPythonLiteral = (s: string) => s.replaceAll("\\", "\\\\").replaceAll("\n", "\\n");

describe("the reader prompt", () => {
  test("is upstream's non-CoT template for retrieved history (run_generation.py)", () => {
    expect(upstream("src/generation/run_generation.py")).toContain(
      `answer_prompt_template = '${asPythonLiteral(READER_TEMPLATE)}'`,
    );
  });

  test("fills history, current date and question in one pass", () => {
    const q = questions[0];
    if (!q) throw new Error("no fixture question");
    const { system, user } = renderReaderPrompt(visibleQuestion(q), "HISTORY {}");
    expect(system).toBe("You are a helpful assistant.");
    expect(user).toContain("History Chats:\n\nHISTORY {}\n\nCurrent Date: ");
    expect(user).toContain(`Current Date: ${q.question_date}\nQuestion: ${q.question}\nAnswer:`);
  });
});

describe("the judge prompts", () => {
  test.each(Object.entries(JUDGE_TEMPLATES))(
    "the %s template is upstream's (evaluate_qa.py)",
    (_name, template) => {
      expect(upstream("src/evaluation/evaluate_qa.py")).toContain(
        `template = "${asPythonLiteral(template)}"`,
      );
    },
  );

  test("each question type gets get_anscheck_prompt's branch, and `_abs` overrides it", () => {
    const pick = (question_id: string, question_type: string) =>
      judgeTemplate({ question_id, question_type } as Parameters<typeof judgeTemplate>[0]);
    for (const t of ["single-session-user", "single-session-assistant", "multi-session"]) {
      expect(pick("x", t)).toBe(JUDGE_TEMPLATES.standard);
    }
    expect(pick("x", "temporal-reasoning")).toBe(JUDGE_TEMPLATES["temporal-reasoning"]);
    expect(pick("x", "knowledge-update")).toBe(JUDGE_TEMPLATES["knowledge-update"]);
    expect(pick("x", "single-session-preference")).toBe(
      JUDGE_TEMPLATES["single-session-preference"],
    );
    expect(pick("x_abs", "temporal-reasoning")).toBe(JUDGE_TEMPLATES.abstention);
  });

  test("renders question, str(answer) and response, a number as Python prints an int", () => {
    const prompt = renderJudgePrompt(
      { question_id: "q", question_type: "multi-session", question: "How many?", answer: 3 },
      "three {}",
    );
    expect(prompt).toContain(
      "Question: How many?\n\nCorrect Answer: 3\n\nModel Response: three {}",
    );
    expect(pyStrAnswer("x")).toBe("x");
    expect(() => pyStrAnswer(2.5)).toThrow("not an integer");
  });

  test("pyFormat refuses too few or too many values, as str.format does", () => {
    expect(() => pyFormat("{} {}", ["a"])).toThrow("IndexError");
    expect(() => pyFormat("{}", ["a", "b"])).toThrow("given 2");
  });
});
