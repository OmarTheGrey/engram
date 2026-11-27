// Checks a seeded-fault set (card L2) against the lints. It checks the labels;
// it is not card L4's precision and recall.
//
// Deterministic tier: card L1's lints run by Plane.lint over every state under
// the set's lint-time policy. Every keyed fault must be flagged by the lint its
// label expects, no near-miss by the lint it is a near-miss of, and no item the
// generator wrote by any lint its label does not expect. A finding on one of
// LongMemEval's own items (its turns, as B5 writes them) is natural memory: it
// is counted per lint and listed, never failed, so precision can also be read
// on natural memory through a hand audit (review finding L2-1).
//
// Model tier: no model is called. Card L3's own planning (Plane's
// planModelLints, packages/core/src/plane/lint.ts) says which units its lints
// would send; every label about a model-based lint must be one, or its recall
// is zero by construction. The same planning under preset medium counts the
// labelled units medium's ttl would keep from the model (review finding L2-3).
//
//   node packages/bench/scripts/fault-set-check.ts --set <dir> [--out <file>] [--findings <file>]
//
// <dir> is what fault-set.ts wrote (policy.json, states.jsonl, labels.jsonl).
// Prints the counts as JSON, into <file> with --out, and exits 1 when any
// check fails. --findings writes every finding on a base item as JSON Lines,
// with the item's text and the text of every item its evidence names, for
// the audit sample (research/scripts/h3_fault_set.py).
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { createFakeAdapter } from "@engram/adapters";
import {
  appendEvent,
  createPlane,
  currentItems,
  type LintFinding,
  loadPreset,
  type MemoryItem,
  migrate,
  openSqlite,
  type Policy,
  planModelLints,
} from "@engram/core";
import { FAULT_SET_LINT_IDS, type FaultState } from "../src/faults/generate.ts";
import type { FaultLabel } from "../src/faults/labels.ts";

/** The units card L3's lints would send in a state: pairs as `<earlier id>+<later id>`, and claim ids. */
export interface ModelUnits {
  pairs: Set<string>;
  claims: Set<string>;
}

/** What the check reads of one state. */
export interface StateCheck {
  question_id: string;
  findings: LintFinding[];
  items: Map<string, MemoryItem>;
  units: ModelUnits;
  /** The same planning under preset medium, every lint enabled. */
  unitsUnderMedium: ModelUnits;
}

/** A LongMemEval item as B5 writes it: its ref names a session and turn. The generator never writes one. */
export const isBaseItem = (item: MemoryItem) => item.provenance.ref.startsWith("longmemeval:");

/** Preset medium with every lint the set registers enabled (FAULT_SET_LINT_IDS): what C6 would lint B5's state under. */
export function mediumWithEveryLint(): Policy {
  const medium = loadPreset("medium");
  return { ...medium, lints: { ...medium.lints, enabled: [...FAULT_SET_LINT_IDS] } };
}

function open(state: FaultState, policy: Policy) {
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
  return { db, plane };
}

function unitsOf(db: ReturnType<typeof openSqlite>, state: FaultState, policy: Policy): ModelUnits {
  const out: ModelUnits = { pairs: new Set(), claims: new Set() };
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
    )) {
      if (u.lint_id === "contradiction") out.pairs.add(u.unit.slice("contradiction:".length));
      else out.claims.add(u.item_id);
    }
  return out;
}

/** Card L3's planned units over one state under `policy`; no model is called. */
export function modelUnits(state: FaultState, policy: Policy): ModelUnits {
  const { db } = open(state, policy);
  try {
    return unitsOf(db, state, policy);
  } finally {
    db.close();
  }
}

/** Plane.lint of every scope (deterministic tier), L3's planned units, and the projection. */
export async function inspectState(state: FaultState, policy: Policy): Promise<StateCheck> {
  const { db, plane } = open(state, policy);
  try {
    const items = new Map(currentItems(db).map((i) => [i.id, i]));
    const units = unitsOf(db, state, policy);
    const unitsUnderMedium = unitsOf(db, state, mediumWithEveryLint());
    const findings: LintFinding[] = [];
    for (const scope of state.scopes)
      findings.push(
        ...(await plane.lint(state.actor, state.at, scope, { reach: "scope-registered" })).findings,
      );
    return { question_id: state.question_id, findings, items, units, unitsUnderMedium };
  } finally {
    db.close();
  }
}

/**
 * The lines of a JSON Lines file, split on the newline byte only.
 * LongMemEval's text holds U+2028, which JSON.stringify leaves raw and
 * node:readline treats as a line end, so readline would cut a state in two.
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

export interface CheckCounts {
  states: number;
  keyed_faults: number;
  keyed_faults_flagged: number;
  near_misses_flagged: number;
  /** Findings, of any lint, on an item the generator wrote that no label expects there. */
  unexpected_findings_on_injected_items: number;
  /** Findings on LongMemEval's own items, per lint: natural memory, unverified. */
  unlabelled_findings_on_base_items: Record<string, number>;
  /** Faults a model-based lint is expected to find, and of them those it would judge. */
  model_faults: number;
  model_faults_sent: number;
  /** Near-misses of a model-based lint, and of them those it would judge. */
  model_near_misses: number;
  model_near_misses_sent: number;
  /** Labelled model units (faults and near-misses) that preset medium would not send, per lint. */
  model_labels_not_sent_under_medium: Record<string, number>;
}

export const emptyCounts = (): CheckCounts => ({
  states: 0,
  keyed_faults: 0,
  keyed_faults_flagged: 0,
  near_misses_flagged: 0,
  unexpected_findings_on_injected_items: 0,
  unlabelled_findings_on_base_items: {},
  model_faults: 0,
  model_faults_sent: 0,
  model_near_misses: 0,
  model_near_misses_sent: 0,
  model_labels_not_sent_under_medium: {},
});

/** Whether the labels agree with the lints. Findings on base items never fail it. */
export const checksPass = (c: CheckCounts) =>
  c.keyed_faults_flagged === c.keyed_faults &&
  c.near_misses_flagged === 0 &&
  c.unexpected_findings_on_injected_items === 0 &&
  c.model_faults_sent === c.model_faults &&
  c.model_near_misses_sent === c.model_near_misses;

/** The model-based lints a label is about whose unit `units` lacks. */
export function unsentLints(l: FaultLabel, units: ModelUnits): string[] {
  return [...l.expected.model, ...l.near_miss_of.model].filter((lint) =>
    lint === "contradiction"
      ? !units.pairs.has([l.item_id, ...l.related].sort().join("+"))
      : !units.claims.has(l.item_id),
  );
}

const bump = (r: Record<string, number>, k: string) => {
  r[k] = (r[k] ?? 0) + 1;
};

/** A finding on a base item, with the texts a person needs to judge it. */
export interface BaseFinding {
  question_id: string;
  item_id: string;
  lint_id: string;
  message: string;
  evidence: string[];
  content: MemoryItem["content"];
  /** The text of every item the evidence names, by id. */
  cited: Record<string, MemoryItem["content"]>;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** The checks over one state's lint run and labels, added into `c`; base findings pushed to `base`. */
export function checkState(
  check: StateCheck,
  labels: readonly FaultLabel[],
  c: CheckCounts,
  base: BaseFinding[] = [],
): void {
  const on = (id: string) => check.findings.filter((f) => f.item_id === id).map((f) => f.lint_id);
  c.states++;
  for (const l of labels) {
    const flagged = on(l.item_id);
    if (l.expected.deterministic.length > 0) {
      c.keyed_faults++;
      if (l.expected.deterministic.every((x) => flagged.includes(x))) c.keyed_faults_flagged++;
    }
    if (l.near_miss_of.deterministic.some((x) => flagged.includes(x))) c.near_misses_flagged++;
    const unsent = unsentLints(l, check.units);
    if (l.expected.model.length > 0) {
      c.model_faults++;
      if (unsent.length === 0) c.model_faults_sent++;
    }
    if (l.near_miss_of.model.length > 0) {
      c.model_near_misses++;
      if (unsent.length === 0) c.model_near_misses_sent++;
    }
    for (const lint of unsentLints(l, check.unitsUnderMedium))
      bump(c.model_labels_not_sent_under_medium, lint);
  }
  for (const f of check.findings) {
    const item = check.items.get(f.item_id);
    if (item !== undefined && isBaseItem(item)) {
      bump(c.unlabelled_findings_on_base_items, f.lint_id);
      const cited: Record<string, MemoryItem["content"]> = {};
      for (const id of f.evidence.join(" ").match(UUID) ?? []) {
        const it = check.items.get(id);
        if (it !== undefined) cited[id] = it.content;
      }
      base.push({
        question_id: check.question_id,
        item_id: f.item_id,
        lint_id: f.lint_id,
        message: f.message,
        evidence: f.evidence,
        content: item.content,
        cited,
      });
      continue;
    }
    const expected = labels.some(
      (l) => l.finding_on === f.item_id && l.expected.deterministic.includes(f.lint_id),
    );
    if (!expected) c.unexpected_findings_on_injected_items++;
  }
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      set: { type: "string" },
      out: { type: "string" },
      findings: { type: "string" },
    },
  });
  if (!values.set) {
    console.error("usage: fault-set-check.ts --set <dir> [--out <file>] [--findings <file>]");
    return 2;
  }
  const dir = values.set;
  const policy = JSON.parse(readFileSync(join(dir, "policy.json"), "utf8")) as Policy;
  const labels = new Map<string, FaultLabel[]>();
  for await (const line of jsonLines(join(dir, "labels.jsonl"))) {
    const l = JSON.parse(line) as FaultLabel;
    labels.set(l.question_id, [...(labels.get(l.question_id) ?? []), l]);
  }
  const c = emptyCounts();
  const base: BaseFinding[] = [];
  for await (const line of jsonLines(join(dir, "states.jsonl"))) {
    const state = JSON.parse(line) as FaultState;
    checkState(await inspectState(state, policy), labels.get(state.question_id) ?? [], c, base);
  }
  const sorted = (r: Record<string, number>) =>
    Object.fromEntries(Object.entries(r).sort(([a], [b]) => (a < b ? -1 : 1)));
  c.unlabelled_findings_on_base_items = sorted(c.unlabelled_findings_on_base_items);
  c.model_labels_not_sent_under_medium = sorted(c.model_labels_not_sent_under_medium);
  const text = `${JSON.stringify(c, null, 2)}\n`;
  if (values.out) writeFileSync(values.out, text);
  else process.stdout.write(text);
  if (values.findings)
    writeFileSync(values.findings, base.map((b) => `${JSON.stringify(b)}\n`).join(""));
  return checksPass(c) ? 0 : 1;
}

if (process.argv[1]?.endsWith("fault-set-check.ts")) process.exitCode = await main();
