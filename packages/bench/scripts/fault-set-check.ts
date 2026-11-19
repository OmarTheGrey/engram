// Checks a seeded-fault set (card L2) against the deterministic lints of card
// L1, run by Plane.lint over every state under the set's lint-time policy:
// every keyed fault is flagged by the lint its label expects, no near-miss by
// the lint it is a near-miss of, and no lint a subtype expects flags an item
// no fault label names. For the model tier no model is called: every label
// about a model-based lint must be a unit card L3's lint would send (a pair
// the contradiction lint judges, a claim the unsupported-claim lint judges;
// src/faults/reach.ts), or its recall is zero by construction. It checks the
// labels; it is not card L4's precision and recall.
//
//   node packages/bench/scripts/fault-set-check.ts --set <dir> [--out <file>]
//
// <dir> is what fault-set.ts wrote (policy.json, states.jsonl, labels.jsonl).
// Prints the counts as JSON, into <file> with --out, and exits 1 when any
// check fails.
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { createFakeAdapter } from "@engram/adapters";
import {
  appendEvent,
  createPlane,
  type LintFinding,
  migrate,
  openSqlite,
  type Policy,
} from "@engram/core";
import type { FaultState } from "../src/faults/generate.ts";
import { type FaultLabel, SUBTYPE_IDS, SUBTYPES } from "../src/faults/labels.ts";
import { type ModelReach, modelReach } from "../src/faults/reach.ts";

/** Plane.lint of every scope of one state, over a fresh log holding its events. */
export async function lintState(state: FaultState, policy: Policy): Promise<LintFinding[]> {
  const db = openSqlite(":memory:");
  migrate(db);
  for (const { seq: _seq, ...e } of state.events) appendEvent(db, e);
  let n = 0;
  const plane = createPlane({
    db,
    adapter: createFakeAdapter(),
    policy,
    newId: () => `01970000-0000-7000-8000-${String(++n).padStart(12, "0")}`,
  });
  try {
    const findings: LintFinding[] = [];
    for (const scope of state.scopes)
      findings.push(...(await plane.lint(state.actor, state.at, scope)).findings);
    return findings;
  } finally {
    db.close();
  }
}

/**
 * The lines of a JSON Lines file, split on "
" only. LongMemEval's text
 * holds U+2028, which JSON.stringify leaves raw and node:readline treats as
 * a line end, so readline would cut a state in two.
 */
export async function* jsonLines(path: string): AsyncGenerator<string> {
  let rest = Buffer.alloc(0);
  for await (const chunk of createReadStream(path)) {
    let buf = Buffer.concat([rest, chunk as Buffer]);
    let nl = buf.indexOf(0x0a);
    while (nl !== -1) {
      const line = buf.subarray(0, nl).toString("utf8");
      if (line.trim() !== "") yield line;
      buf = buf.subarray(nl + 1);
      nl = buf.indexOf(0x0a);
    }
    rest = buf;
  }
  if (rest.toString("utf8").trim() !== "") yield rest.toString("utf8");
}

/** The lints some subtype expects: the ones the set measures. */
const MEASURED = new Set<string>(SUBTYPE_IDS.flatMap((s) => SUBTYPES[s].lints.deterministic));

export interface CheckCounts {
  states: number;
  keyed_faults: number;
  keyed_faults_flagged: number;
  near_misses_flagged: number;
  unlabelled_measured_findings: number;
  unkeyed_labels_flagged: number;
  /** Findings of `duplicate`, which no subtype measures: LongMemEval's own repeated turns. */
  duplicate_findings: number;
  /** Faults a model-based lint is expected to find, and of them those it would judge. */
  model_faults: number;
  model_faults_sent: number;
  /** Near-misses of a model-based lint, and of them those it would judge. */
  model_near_misses: number;
  model_near_misses_sent: number;
}

export const emptyCounts = (): CheckCounts => ({
  states: 0,
  keyed_faults: 0,
  keyed_faults_flagged: 0,
  near_misses_flagged: 0,
  unlabelled_measured_findings: 0,
  unkeyed_labels_flagged: 0,
  duplicate_findings: 0,
  model_faults: 0,
  model_faults_sent: 0,
  model_near_misses: 0,
  model_near_misses_sent: 0,
});

/** Whether the labels agree with the deterministic lints. */
export const checksPass = (c: CheckCounts) =>
  c.keyed_faults_flagged === c.keyed_faults &&
  c.near_misses_flagged === 0 &&
  c.unlabelled_measured_findings === 0 &&
  c.unkeyed_labels_flagged === 0 &&
  c.model_faults_sent === c.model_faults &&
  c.model_near_misses_sent === c.model_near_misses;

/** Whether card L3's lint would judge every model-based lint a label is about. */
export function sentToModel(l: FaultLabel, reach: ModelReach): boolean {
  return [...l.expected.model, ...l.near_miss_of.model].every((lint) =>
    lint === "contradiction"
      ? reach.pairs.has([l.item_id, ...l.related].sort().join("+"))
      : reach.claims.has(l.item_id),
  );
}

/** The checks over one state's findings and labels, added into `c`. */
export function checkState(
  findings: readonly LintFinding[],
  labels: readonly FaultLabel[],
  reach: ModelReach,
  c: CheckCounts,
): void {
  const on = (id: string) => findings.filter((f) => f.item_id === id).map((f) => f.lint_id);
  const byItem = new Map(labels.map((l) => [l.item_id, l]));
  c.states++;
  for (const l of labels) {
    const flagged = on(l.item_id);
    if (l.expected.deterministic.length > 0) {
      c.keyed_faults++;
      if (l.expected.deterministic.every((x) => flagged.includes(x))) c.keyed_faults_flagged++;
    }
    if (l.near_miss_of.deterministic.some((x) => flagged.includes(x))) c.near_misses_flagged++;
    if (!l.keyed && flagged.some((x) => x !== "duplicate")) c.unkeyed_labels_flagged++;
    if (l.expected.model.length > 0) {
      c.model_faults++;
      if (sentToModel(l, reach)) c.model_faults_sent++;
    }
    if (l.near_miss_of.model.length > 0) {
      c.model_near_misses++;
      if (sentToModel(l, reach)) c.model_near_misses_sent++;
    }
  }
  for (const f of findings) {
    if (f.lint_id === "duplicate") c.duplicate_findings++;
    else if (
      MEASURED.has(f.lint_id) &&
      !byItem.get(f.item_id)?.expected.deterministic.includes(f.lint_id)
    )
      c.unlabelled_measured_findings++;
  }
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { set: { type: "string" }, out: { type: "string" } },
  });
  if (!values.set) {
    console.error("usage: fault-set-check.ts --set <dir> [--out <file>]");
    return 2;
  }
  const dir = values.set;
  const policy = JSON.parse(readFileSync(join(dir, "policy.json"), "utf8")) as Policy;
  const labels = new Map<string, FaultLabel[]>();
  for (const line of readFileSync(join(dir, "labels.jsonl"), "utf8").split("\n")) {
    if (line.trim() === "") continue;
    const l = JSON.parse(line) as FaultLabel;
    labels.set(l.question_id, [...(labels.get(l.question_id) ?? []), l]);
  }
  const c = emptyCounts();
  for await (const line of jsonLines(join(dir, "states.jsonl"))) {
    const state = JSON.parse(line) as FaultState;
    const mine = labels.get(state.question_id) ?? [];
    checkState(await lintState(state, policy), mine, modelReach(state, policy), c);
  }
  const text = `${JSON.stringify(c, null, 2)}\n`;
  if (values.out) writeFileSync(values.out, text);
  else process.stdout.write(text);
  return checksPass(c) ? 0 : 1;
}

if (process.argv[1]?.endsWith("fault-set-check.ts")) process.exitCode = await main();
