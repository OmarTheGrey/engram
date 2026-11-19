// Card L2: the committed fixture-size fault set (fixtures/bench/longmemeval-faults/)
// is what the generator writes for B5's vendored subset under the seed and
// count of H3's config, research/configs/h3-fault-set.json. `make fixtures`
// regenerates it with packages/bench/scripts/fault-set.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { open, readQuestions } from "../../scripts/fault-set.ts";
import { generateFaultSet } from "../../src/faults/generate.ts";
import { FaultLabel } from "../../src/faults/labels.ts";
import { visibleQuestion } from "../../src/longmemeval/strip.ts";
import { FIXTURE } from "../longmemeval/fixture.ts";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const SET = join(REPO, "fixtures/bench/longmemeval-faults");
const config = JSON.parse(readFileSync(join(REPO, "research/configs/h3-fault-set.json"), "utf8"));
const committed = (name: string) => readFileSync(join(SET, name), "utf8");
const lines = (values: readonly unknown[]) => values.map((v) => `${JSON.stringify(v)}\n`).join("");

test("the committed fixture set is the generator's output for B5's subset under H3's seed", async () => {
  const views = readQuestions(join(FIXTURE, "questions.jsonl")).map(visibleQuestion);
  const set = await generateFaultSet(
    views,
    { seed: config.seed, perQuestion: config.per_question },
    open,
  );
  expect(committed("policy.json")).toBe(`${JSON.stringify(set.policy, null, 2)}\n`);
  expect(committed("labels.jsonl")).toBe(lines(set.labels));
  expect(committed("stats.jsonl")).toBe(lines(set.stats));
  expect(committed("states.jsonl")).toBe(lines(set.states));
});

test("every committed label parses", () => {
  const labels = committed("labels.jsonl").trimEnd().split("\n");
  expect(labels.length).toBeGreaterThan(0);
  for (const l of labels) expect(FaultLabel.safeParse(JSON.parse(l)).success).toBe(true);
});
