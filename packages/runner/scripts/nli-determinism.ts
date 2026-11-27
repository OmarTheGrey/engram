// `make nli-determinism` (card L7, its first step): the pinned NLI model
// scores the same pairs in two separate processes, and the two are compared
// to a stated tolerance. The pairs are the contradiction lint's candidate
// pairs (planModelLints, card L3) over every state of the fixture-size
// LongMemEval fault set (fixtures/fault-sets/longmemeval), the first PAIRS in
// state order, premise the earlier item and hypothesis the later. Each child
// scores them with the real scorer and no cache, one pair at a time, and
// writes the logits; the parent compares them bit for bit and by the largest
// difference of any probability. No model call; the scores are not cached.
// Writes .engram/nli/determinism/summary.json, without paths or times. The
// model is fetched by sha256 into .engram/upstream first when missing.
//
//   node packages/runner/scripts/nli-determinism.ts
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { appendEvent, canonicalJson, migrate, openSqlite, planModelLints } from "@engram/core";
import {
  fetchNliModel,
  NLI_MODEL,
  NLI_RUNTIME,
  nliModelDir,
  onnxNliScore,
  softmax,
} from "@engram/model";
import { readSetPolicy, readSetStates } from "../src/lint-fault-set.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const SET = join(REPO, "fixtures", "fault-sets", "longmemeval");
const OUT = join(REPO, ".engram", "nli", "determinism");
/** How many pairs are scored. */
export const PAIRS = 200;
/** The largest difference of any probability the two processes may show. */
export const TOLERANCE = 1e-6;

const text = (content: unknown) => (typeof content === "string" ? content : canonicalJson(content));

async function plan(): Promise<{ premise: string; hypothesis: string }[]> {
  const policy = readSetPolicy(SET);
  const pairs: { premise: string; hypothesis: string }[] = [];
  for await (const state of readSetStates(SET)) {
    const db = openSqlite(":memory:");
    try {
      migrate(db);
      for (const { seq: _seq, ...e } of state.events) appendEvent(db, e);
      for (const scope of state.scopes)
        for (const u of planModelLints(
          { db, policy },
          state.actor,
          state.at,
          scope,
          {
            model: "none/none",
            seed: 0,
          },
          { reach: "scope-registered" },
        ))
          if (u.lint_id === "contradiction") {
            const { A, B } = JSON.parse(u.request.messages[0]?.content ?? "{}") as {
              A: unknown;
              B: unknown;
            };
            pairs.push({ premise: text(A), hypothesis: text(B) });
          }
    } finally {
      db.close();
    }
    if (pairs.length >= PAIRS) break;
  }
  if (pairs.length < PAIRS) throw new Error(`the set has ${pairs.length} pairs, not ${PAIRS}`);
  return pairs.slice(0, PAIRS);
}

async function child(pairsFile: string, outFile: string): Promise<void> {
  const pairs = JSON.parse(readFileSync(pairsFile, "utf8")) as {
    premise: string;
    hypothesis: string;
  }[];
  const score = await onnxNliScore(nliModelDir(REPO));
  const logits: number[][] = [];
  for (const p of pairs) logits.push((await score({ model: NLI_MODEL.id, ...p })).logits);
  writeFileSync(outFile, `${JSON.stringify(logits)}\n`);
}

async function main(): Promise<void> {
  const [mode, a, b] = process.argv.slice(2);
  if (mode === "--child") return child(a as string, b as string);
  await fetchNliModel(nliModelDir(REPO), { log: (l) => console.log(l) });
  mkdirSync(OUT, { recursive: true });
  const pairsFile = join(OUT, "pairs.json");
  writeFileSync(pairsFile, `${JSON.stringify(await plan())}\n`);
  const runs: number[][][] = [];
  for (const n of [1, 2]) {
    const outFile = join(OUT, `process-${n}.json`);
    const run = spawnSync(
      process.execPath,
      [fileURLToPath(import.meta.url), "--child", pairsFile, outFile],
      {
        stdio: ["ignore", "ignore", "inherit"],
        timeout: 600_000,
      },
    );
    if (run.status !== 0) throw new Error(`process ${n} failed with status ${run.status}`);
    runs.push(JSON.parse(readFileSync(outFile, "utf8")) as number[][]);
  }
  const [one, two] = runs as [number[][], number[][]];
  let identical = 0;
  let logitDiff = 0;
  let probDiff = 0;
  for (const [i, x] of one.entries()) {
    const y = two[i] as number[];
    if (x.every((v, k) => Object.is(v, y[k]))) identical++;
    logitDiff = Math.max(logitDiff, ...x.map((v, k) => Math.abs(v - (y[k] as number))));
    const [px, py] = [softmax(x), softmax(y)];
    probDiff = Math.max(probDiff, ...px.map((v, k) => Math.abs(v - (py[k] as number))));
  }
  const summary = {
    card: "L7",
    model: NLI_MODEL.id,
    runtime: NLI_RUNTIME,
    pairs: one.length,
    processes: 2,
    tolerance: TOLERANCE,
    bitwise_identical: identical,
    max_abs_logit_difference: logitDiff,
    max_abs_probability_difference: probDiff,
    within_tolerance: probDiff <= TOLERANCE,
    second_machine: "not checked: one machine was available",
    consequence:
      "every score is a cached call keyed on the model's hash, the runtime's version and the pair's hash; a replay never recomputes one",
  };
  writeFileSync(join(OUT, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.within_tolerance) process.exitCode = 1;
}

await main();
