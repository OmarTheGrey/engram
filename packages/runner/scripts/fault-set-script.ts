// Writes the script of card L4's scripted lint model (`scripted/lint-l4`): the
// replies the fixture pipeline (research/configs/h3-lint-model-fixture.json)
// records into its cassettes, so the model-based delta's scorer
// (research/scripts/h3_lint_delta.py) can be proven on a replay whose answers
// are known. Only `make fixtures` runs it, before recording.
//
//   node packages/runner/scripts/fault-set-script.ts --config research/configs/h3-lint-model-fixture.json --out fixtures/lint/h3-lint-model-script.json
//
// This is a fixture writer: it reads the set's labels to decide what the fake
// model says, as a hand-written script would (fixtures/lint/l3-script.json).
// The labels reach the script file only, never a prompt or the plane: the
// run sends the plane's own requests and the script answers them by input.
//
// Every unit card L3's planning sends for the config's questions gets, at
// every seed of the config, the verdict a correct judge gives (flag a
// labelled fault's own unit, pass a labelled near-miss's and every other
// unit), except for these planted answers:
//   seed 1  every superseded fault's unit passes (an old value and a later one
//           read as two states at different times, card L2's caveat); the
//           first unit, by question then unit, that no label is about flags.
//   seed 2  the first question's unsupported-claim fault passes; every conflict
//           near-miss's unit flags; the second question's conflict fault gets
//           a malformed reply, and the first unsupported-claim unit no label
//           is about an empty one (a refusal).
// Seeds beyond 2 get no planted answer.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { faults } from "@engram/bench";
import { appendEvent, migrate, openSqlite, planModelLints } from "@engram/core";
import {
  jsonLines,
  readFaultSetConfig,
  readSetPolicy,
  readSetStates,
} from "../src/lint-fault-set.ts";

type FaultLabel = faults.FaultLabel;

interface Unit {
  question: string;
  unit: string;
  lint_id: string;
  input: Record<string, unknown>;
}

/** The unit a label's model lint judges: its pair, sorted, or its claim. */
export const labelUnit = (l: FaultLabel, lint: string) =>
  lint === "contradiction"
    ? `contradiction:${[l.item_id, ...l.related].sort().join("+")}`
    : `${lint}:${l.item_id}`;

const verdict = (lint: string, flag: boolean, reason: string) =>
  JSON.stringify({
    verdict:
      lint === "contradiction"
        ? flag
          ? "contradiction"
          : "consistent"
        : flag
          ? "unsupported"
          : "supported",
    reason,
  });

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { config: { type: "string" }, out: { type: "string" } },
  });
  if (!values.config || !values.out) {
    console.error("usage: fault-set-script.ts --config <fault-set runner config> --out <file>");
    return 2;
  }
  const config = readFaultSetConfig(values.config);
  if (config.questions === "all" || !config.model.startsWith("scripted/"))
    throw new Error("the script is for a scripted model on named questions");
  const policy = readSetPolicy(config.data);
  const labels = new Map<string, FaultLabel[]>();
  for await (const line of jsonLines(join(config.data, "labels.jsonl"))) {
    const l = JSON.parse(line) as FaultLabel;
    labels.set(l.question_id, [...(labels.get(l.question_id) ?? []), l]);
  }
  const units: Unit[] = [];
  const order = new Map(config.questions.map((q, i) => [q, i]));
  const states = [];
  for await (const s of readSetStates(config.data, { questions: config.questions })) states.push(s);
  states.sort((a, b) => (order.get(a.question_id) ?? 0) - (order.get(b.question_id) ?? 0));
  for (const state of states) {
    const db = openSqlite(":memory:");
    try {
      migrate(db);
      for (const { seq: _seq, ...e } of state.events) appendEvent(db, e);
      for (const scope of state.scopes)
        for (const u of planModelLints({ db, policy }, state.actor, state.at, scope, {
          model: config.model,
          seed: 0,
        }))
          units.push({
            question: state.question_id,
            unit: u.unit,
            lint_id: u.lint_id,
            input: JSON.parse(u.request.messages.at(-1)?.content ?? "null"),
          });
    } finally {
      db.close();
    }
  }
  // What each unit is about, from the labels: a fault's or a near-miss's own unit.
  const about = new Map<string, FaultLabel>();
  for (const [q, ls] of labels)
    for (const l of ls)
      for (const lint of [...l.expected.model, ...l.near_miss_of.model])
        about.set(`${q} ${labelUnit(l, lint)}`, l);
  const of = (u: Unit) => about.get(`${u.question} ${u.unit}`);
  const [first, second] = config.questions;
  const firstFree = units.find((u) => of(u) === undefined);
  const firstFreeClaim = units.find(
    (u) => of(u) === undefined && u.lint_id === "unsupported-claim",
  );
  const reply = (u: Unit, seed: number): string => {
    const l = of(u);
    if (seed === 1) {
      if (l?.subtype === "superseded" && l.kind === "fault")
        return verdict(u.lint_id, false, "Two states at different times.");
      if (u === firstFree) return verdict(u.lint_id, true, "Planted false finding.");
    }
    if (seed === 2) {
      if (l?.subtype === "unsupported-claim" && l.kind === "fault" && u.question === first)
        return verdict(u.lint_id, false, "Planted miss.");
      if (l?.subtype === "conflict" && l.kind === "near-miss")
        return verdict(u.lint_id, true, "Planted false finding.");
      if (l?.subtype === "conflict" && l.kind === "fault" && u.question === second)
        return "not json";
      if (u === firstFreeClaim) return "";
    }
    return verdict(u.lint_id, l?.kind === "fault", "Scripted.");
  };
  const replies: { input: Record<string, unknown>; seeds: number[]; reply: string }[] = [];
  const given = new Map<string, string>();
  for (const u of units)
    for (const seed of config.seeds) {
      const text = reply(u, seed);
      const key = `${seed} ${JSON.stringify(u.input)}`;
      const before = given.get(key);
      if (before !== undefined) {
        if (before !== text) throw new Error(`two units send ${key} and need different replies`);
        continue;
      }
      given.set(key, text);
      replies.push({ input: u.input, seeds: [seed], reply: text });
    }
  const script = {
    _comment:
      "Card L4's scripted lint model, written by packages/runner/scripts/fault-set-script.ts from the fixture set's labels (make fixtures); its planted answers are listed there.",
    replies,
  };
  writeFileSync(values.out, `${JSON.stringify(script, null, 2)}\n`);
  console.log(`${values.out}: ${replies.length} replies for ${units.length} units`);
  return 0;
}

if (process.argv[1]?.endsWith("fault-set-script.ts")) process.exitCode = await main();
