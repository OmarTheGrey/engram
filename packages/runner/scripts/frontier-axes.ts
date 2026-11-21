// The frontier-axis rows for research/scripts/frontier_axes.py (card RV8,
// RV-DES-2): what candidate policy axes change in what the plane admits and
// hides on GateMem and LongMemEval, with no model.
//
//   node packages/runner/scripts/frontier-axes.ts --benchmark gatemem --data <bench/data dir> \
//       --variants <variants.json> --out <rows.jsonl>
//   node packages/runner/scripts/frontier-axes.ts --benchmark longmemeval --data <questions file> \
//       --variants <variants.json> --real-time <ISO instant> --out <rows.jsonl>
//
// A variant is a bundled preset with some fields set:
// `{ "name", "base": "<preset>", "set": [{ "path": [...], "value": ... }] }`.
// A path segment is a key, an index, or an object that picks the one array
// element whose fields equal it (for example `{ "scope": "person", "class":
// "episodic" }` in `retention`). The result is validated by core's own
// parsePolicy, so a variant the loader would reject is refused here too.
//
// Each benchmark's own measurement is reused, never rewritten:
// - GateMem: every checkpoint through reachOf (gatemem-reach.ts), the C5
//   probe's ingestion and the asker's read with no query text; the hidden
//   labels are read only afterwards, by scoreReach for an access or
//   forgetting checkpoint (the scorer's patterns in reach, its context-leak
//   check) and, for a utility checkpoint, by the scorer's matcher on the
//   judge spec's `include` patterns;
// - LongMemEval: every question through clockRowFor (longmemeval-clock.ts),
//   B5's write phase and the user's read at each clock.
// No model is called. Rows are JSON Lines in data order.
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { gatemem, longMemEval } from "@engram/bench";
import { loadPreset, type Policy, PRESETS, type PresetName, parsePolicy } from "@engram/core";
import { reachOf, scoreReach } from "../src/research/gatemem-reach.ts";
import { clockRowFor } from "../src/research/longmemeval-clock.ts";

type Segment = string | number | Record<string, unknown>;
interface Variant {
  name: string;
  base: PresetName;
  set?: { path: Segment[]; value: unknown }[];
}

/** The variant's policy: its base preset with each path set, validated by core's loader. */
export function variantPolicy(v: Variant): Policy {
  if (!PRESETS.includes(v.base)) throw new Error(`${v.name}: unknown base preset ${v.base}`);
  const policy = structuredClone(loadPreset(v.base)) as unknown as Record<string, unknown>;
  for (const { path, value } of v.set ?? []) {
    if (path.length === 0) throw new Error(`${v.name}: an empty path`);
    let node: unknown = policy;
    const step = (
      at: unknown,
      seg: Segment,
    ): { parent: Record<string | number, unknown>; key: string | number } => {
      if (typeof seg === "object") {
        if (!Array.isArray(at)) throw new Error(`${v.name}: a matcher on a non-list`);
        const hits = at
          .map((e, i) => [e, i] as const)
          .filter(([e]) =>
            Object.entries(seg).every(([k, want]) => (e as Record<string, unknown>)[k] === want),
          );
        if (hits.length !== 1)
          throw new Error(`${v.name}: ${JSON.stringify(seg)} matches ${hits.length} elements`);
        return {
          parent: at as unknown as Record<number, unknown>,
          key: (hits[0] as readonly [unknown, number])[1],
        };
      }
      if (at === null || typeof at !== "object" || !(seg in (at as object)))
        throw new Error(`${v.name}: no field ${String(seg)}`);
      return { parent: at as Record<string | number, unknown>, key: seg };
    };
    for (const seg of path.slice(0, -1)) {
      const { parent, key } = step(node, seg);
      node = parent[key];
    }
    const { parent, key } = step(node, path[path.length - 1] as Segment);
    parent[key] = value;
  }
  return parsePolicy(JSON.stringify(policy), `variant ${v.name}`);
}

async function gatememRows(data: string, policies: Record<string, Policy>): Promise<string[]> {
  const rows: string[] = [];
  for (const domain of gatemem.loadDataset(data)) {
    const checkpoints = [...domain.checkpoints].sort((a, b) =>
      a.checkpoint_id < b.checkpoint_id ? -1 : 1,
    );
    for (const checkpoint of checkpoints) {
      const episode = domain.episodes.find((e) => e.episode_id === checkpoint.episode_id);
      if (!episode) throw new Error(`no episode for ${checkpoint.checkpoint_id}`);
      const variants: Record<string, unknown> = {};
      for (const [name, policy] of Object.entries(policies)) {
        const reach = await reachOf(episode, checkpoint, policy);
        const readable = reach.turns.filter((t) => t.readable);
        const cell: Record<string, unknown> = {
          denied_writes: reach.denied_writes,
          readable: reach.turns.map((t) => (t.readable ? "1" : "0")).join(""),
          readable_own: readable.filter((t) => t.via === "own").length,
          readable_granted: readable.filter((t) => t.via === "grant").length,
        };
        if (checkpoint.query_type === "utility") {
          const include = checkpoint.judge_spec.include ?? [];
          cell.include_patterns = include.length;
          cell.include_reachable = include.filter((p) =>
            readable.some((t) => gatemem.patternHits(t.text, p)),
          ).length;
        } else {
          const scored = scoreReach(domain.domain, checkpoint, reach);
          cell.scored_reachable = scored.scored_reachable;
          cell.context_leak = scored.context_leak;
        }
        variants[name] = cell;
      }
      rows.push(
        `${JSON.stringify({
          checkpoint_id: checkpoint.checkpoint_id,
          domain: domain.domain,
          query_type: checkpoint.query_type,
          turns: (variants[Object.keys(policies)[0] as string] as { readable: string }).readable
            .length,
          variants,
        })}\n`,
      );
    }
    console.error(`frontier-axes: gatemem ${domain.domain} done`);
  }
  return rows;
}

async function longMemEvalRows(
  data: string,
  policies: Record<string, Policy>,
  realTime: string,
): Promise<string[]> {
  const rows: string[] = [];
  for (const q of longMemEval.loadQuestions(data)) {
    rows.push(`${JSON.stringify(await clockRowFor(q, policies, realTime))}\n`);
  }
  return rows;
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      benchmark: { type: "string" },
      data: { type: "string" },
      variants: { type: "string" },
      "real-time": { type: "string" },
      out: { type: "string" },
    },
  });
  const benchmark = values.benchmark;
  if (
    !values.data ||
    !values.out ||
    !values.variants ||
    (benchmark !== "gatemem" && benchmark !== "longmemeval") ||
    (benchmark === "longmemeval" &&
      (!values["real-time"] || Number.isNaN(Date.parse(values["real-time"]))))
  ) {
    console.error(
      "usage: frontier-axes.ts --benchmark gatemem|longmemeval --data <path> --variants <file.json> [--real-time <ISO instant>] --out <rows.jsonl>",
    );
    return 2;
  }
  const variants = JSON.parse(readFileSync(values.variants, "utf8")) as Variant[];
  const policies: Record<string, Policy> = {};
  for (const v of variants) {
    if (v.name in policies) throw new Error(`a second variant named ${v.name}`);
    policies[v.name] = variantPolicy(v);
  }
  const rows =
    benchmark === "gatemem"
      ? await gatememRows(values.data, policies)
      : await longMemEvalRows(values.data, policies, values["real-time"] as string);
  writeFileSync(values.out, rows.join(""));
  console.error(
    `frontier-axes: ${benchmark}, ${rows.length} items under ${variants.length} variants; no model called`,
  );
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  },
);
