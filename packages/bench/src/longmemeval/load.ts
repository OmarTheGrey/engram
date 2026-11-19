// Typed loader for LongMemEval questions (cards B5 and B6): a fixture
// directory's questions.jsonl, one upstream question record per line (B5's
// vendored subset); upstream's cleaned file as it is published, one JSON
// array (`longmemeval_s_cleaned.json`, the S split B6's experiment configs
// name); or a JSON Lines file (a research script's part of that file).
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Question } from "./schema.ts";

/** Each record parsed by the schema, ids unique; `where(i)` names record i in an error. */
function parsed(records: readonly unknown[], where: (i: number) => string): Question[] {
  const seen = new Set<string>();
  return records.map((record, i) => {
    const result = Question.safeParse(record);
    if (!result.success) throw new Error(`${where(i)}: ${result.error.message}`);
    if (seen.has(result.data.question_id))
      throw new Error(`${where(i)}: repeated question id ${result.data.question_id}`);
    seen.add(result.data.question_id);
    return result.data;
  });
}

/** The non-blank lines of a JSON Lines file with their line numbers, parsed. */
function jsonLines(path: string): { records: unknown[]; lines: number[] } {
  const records: unknown[] = [];
  const lines: number[] = [];
  readFileSync(path, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (line.trim() === "") return;
      records.push(JSON.parse(line));
      lines.push(i + 1);
    });
  return { records, lines };
}

/**
 * Every question at `path`, in file order: a directory's questions.jsonl, a
 * `.json` file holding one array, or a `.jsonl` file. Throws on a record the
 * schema refuses or a repeated id, naming the line (or the array index).
 */
export function loadQuestions(path: string): Question[] {
  if (statSync(path).isDirectory()) return loadQuestions(join(path, "questions.jsonl"));
  if (path.endsWith(".json")) {
    const all = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!Array.isArray(all)) throw new Error(`${path}: a LongMemEval file holds one array`);
    return parsed(all, (i) => `${path}[${i}]`);
  }
  const { records, lines } = jsonLines(path);
  return parsed(records, (i) => `${path}:${lines[i]}`);
}

/** One question by id. */
export function findQuestion(questions: readonly Question[], id: string): Question {
  const found = questions.find((q) => q.question_id === id);
  if (!found) throw new Error(`no LongMemEval question ${id}`);
  return found;
}
