// Typed loader for the vendored LongMemEval subset: questions.jsonl in a
// fixture directory, one upstream question record per line (card B5).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Question } from "./schema.ts";

/** Every question of `dir`/questions.jsonl, in file order; throws on a line the schema refuses or a repeated id. */
export function loadQuestions(dir: string): Question[] {
  const path = join(dir, "questions.jsonl");
  const seen = new Set<string>();
  return readFileSync(path, "utf8")
    .split("\n")
    .flatMap((line, i) => {
      if (line.trim() === "") return [];
      const parsed = Question.safeParse(JSON.parse(line));
      if (!parsed.success) throw new Error(`${path}:${i + 1}: ${parsed.error.message}`);
      if (seen.has(parsed.data.question_id))
        throw new Error(`${path}:${i + 1}: repeated question id ${parsed.data.question_id}`);
      seen.add(parsed.data.question_id);
      return [parsed.data];
    });
}

/** One question by id. */
export function findQuestion(questions: readonly Question[], id: string): Question {
  const found = questions.find((q) => q.question_id === id);
  if (!found) throw new Error(`no LongMemEval question ${id}`);
  return found;
}
