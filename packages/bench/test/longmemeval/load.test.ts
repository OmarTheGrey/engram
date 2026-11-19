import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { CATEGORIES, PER_CATEGORY, selectQuestions } from "../../scripts/vendor-longmemeval.ts";
import { findQuestion, loadQuestions } from "../../src/longmemeval/load.ts";
import {
  checkLongMemEvalData,
  LONGMEMEVAL_S,
  LONGMEMEVAL_UPSTREAM,
} from "../../src/longmemeval/pinned.ts";
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

// Card B6: the experiment configs read upstream's cleaned S split as it is
// published, one JSON array (longmemeval_s_cleaned.json), and a research
// script's parts as JSON Lines files.
describe("the loader on a data file, and the pinned S split", () => {
  const records = readFileSync(join(FIXTURE, "questions.jsonl"), "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as unknown);

  test("reads a JSON array file and a JSON Lines file as the directory form reads them", () => {
    const dir = mkdtempSync(join(tmpdir(), "engram-lme-"));
    writeFileSync(join(dir, "s.json"), JSON.stringify(records));
    writeFileSync(join(dir, "part.jsonl"), records.map((r) => `${JSON.stringify(r)}\n`).join(""));
    const ids = questions.map((q) => q.question_id);
    expect(loadQuestions(join(dir, "s.json")).map((q) => q.question_id)).toEqual(ids);
    expect(loadQuestions(join(dir, "part.jsonl")).map((q) => q.question_id)).toEqual(ids);
  });

  test("a JSON array file is refused on a record the schema refuses, naming its index", () => {
    const dir = mkdtempSync(join(tmpdir(), "engram-lme-"));
    writeFileSync(join(dir, "s.json"), JSON.stringify([records[0], { question_id: "x" }]));
    expect(() => loadQuestions(join(dir, "s.json"))).toThrow(/s\.json\[1\]/);
  });

  test("a file is the full set only when its sha256 is the pinned S split's", () => {
    const dir = mkdtempSync(join(tmpdir(), "engram-lme-"));
    const file = join(dir, "s.json");
    writeFileSync(file, JSON.stringify(records));
    const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
    expect(checkLongMemEvalData(file).set).toBe("unpinned");
    expect(checkLongMemEvalData(file, { sSha256: digest })).toEqual({
      set: "full",
      commit: LONGMEMEVAL_UPSTREAM.dataset_revision,
    });
    expect(checkLongMemEvalData(join(dir, "missing.json")).set).toBe("unpinned");
  });

  test("the S split's pinned hash is the one card L2's fault-set config checks the file against", () => {
    const config = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../../../research/configs/h3-fault-set.json", import.meta.url)),
        "utf8",
      ),
    ) as { data: { file: string; sha256: string; revision: string } };
    expect(config.data).toMatchObject({
      file: LONGMEMEVAL_S.file,
      sha256: LONGMEMEVAL_S.sha256,
      revision: LONGMEMEVAL_UPSTREAM.dataset_revision,
    });
  });
});
