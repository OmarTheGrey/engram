// The vendored LongMemEval subset (fixtures/bench/longmemeval), loaded once for the tests.
import { fileURLToPath } from "node:url";
import { loadQuestions } from "../../src/longmemeval/load.ts";

export const FIXTURE = fileURLToPath(
  new URL("../../../../fixtures/bench/longmemeval", import.meta.url),
);
export const questions = loadQuestions(FIXTURE);
