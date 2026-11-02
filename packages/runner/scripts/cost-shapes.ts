// The measured shapes for research/scripts/h1_cost.py (docs/tasks/prereg-v1-plan.md,
// PR 4, part A, deliverable 1; packages/runner/src/research/cost-shapes.ts):
// the calls of committed fixture cassettes as sessions, with pi's token
// estimate of every call; GateMem's probe prompt sizes per checkpoint; and
// the candidate models as pi-ai's built-in catalogue resolves them. No model
// is called and no provider key is read.
//
//   node packages/runner/scripts/cost-shapes.ts \
//       --cassettes fixtures/cassettes/x1-h1-gatemem --cassettes fixtures/cassettes/x1-h1-mem-inv \
//       --judge scripted/judge-1 \
//       --prompts full=.engram/upstream/gatemem/bench/data --prompts fixture=fixtures/bench/gatemem \
//       --models openrouter/openai/gpt-4o,... --out <file.json>
//
// The output names each cassette directory by its last path part and each
// prompt set by its label, and holds no path or time.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { builtinLiveModels } from "../src/live.ts";
import type { CacheEntry } from "../src/model/cached.ts";
import {
  type CallShape,
  callShape,
  catalogueEntry,
  catalogueSnapshot,
  gatememPromptChars,
  sessionShapes,
} from "../src/research/cost-shapes.ts";

function cassetteShapes(dir: string, judge: string | undefined) {
  const calls: CallShape[] = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => callShape(JSON.parse(readFileSync(join(dir, f), "utf8")) as CacheEntry, judge));
  const byOrder = (a: CallShape, b: CallShape) =>
    JSON.stringify([a.item, a.condition, a.store, a.seed, a.messages]) <
    JSON.stringify([b.item, b.condition, b.store, b.seed, b.messages])
      ? -1
      : 1;
  return {
    sessions: sessionShapes(calls),
    judge: calls.filter((c) => c.kind === "judge").sort(byOrder),
    note: calls.filter((c) => c.kind === "note").sort(byOrder),
  };
}

function main(): number {
  const { values } = parseArgs({
    options: {
      cassettes: { type: "string", multiple: true },
      judge: { type: "string" },
      prompts: { type: "string", multiple: true },
      models: { type: "string" },
      out: { type: "string" },
    },
  });
  const prompts = (values.prompts ?? []).map((p) => {
    const at = p.indexOf("=");
    return at > 0 ? [p.slice(0, at), p.slice(at + 1)] : undefined;
  });
  if (!values.out || !values.cassettes?.length || !values.models || prompts.includes(undefined)) {
    console.error(
      "usage: cost-shapes.ts (--cassettes <dir>)... [--judge <model>] (--prompts <label>=<gatemem data dir>)... --models <m1,m2,...> --out <file.json>",
    );
    return 2;
  }
  const models = builtinLiveModels();
  const out = {
    cassettes: Object.fromEntries(
      values.cassettes.map((dir) => [basename(dir), cassetteShapes(dir, values.judge)]),
    ),
    prompts: Object.fromEntries(
      (prompts as [string, string][]).map(([label, dir]) => [label, gatememPromptChars(dir)]),
    ),
    catalogue: values.models
      .split(",")
      .filter(Boolean)
      .map((m) => catalogueEntry(models, m)),
    snapshot: catalogueSnapshot(),
  };
  writeFileSync(values.out, `${JSON.stringify(out)}\n`);
  console.error(
    `cost-shapes: ${values.cassettes.length} cassette sets, ${out.catalogue.length} models; no model called`,
  );
  return 0;
}

process.exitCode = main();
