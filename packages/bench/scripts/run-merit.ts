// `make bench BENCH=merit` (card B7): MERIT's pinned harness on the fixture
// slice research/configs/b7-merit-fixture.json, every model call through the
// cassette proxy from the committed cassettes and every memory call through
// the plane (C5) or the ungoverned baseline (C2). Writes, into --out, MERIT's
// own results and traces per run cell, the plane's events (C5), the usage
// ledger (usage.jsonl, the runner's UsageRecord per call, card RV1) and
// summary.json; prints the calls and their cost.
//
//   node packages/bench/scripts/run-merit.ts --config research/configs/b7-merit-fixture.json --out .engram/bench/merit
//
// --prepare fetches the checkout at the pin and installs MERIT's environment
// when they are missing, and exits (make bench runs it first, without
// ENGRAM_OFFLINE, then replays offline). --record (make fixtures only, never
// offline, and only under ENGRAM_UPDATE_FIXTURES=1, into a folder inside
// fixtures/) empties the config's cassette folder and records every call into
// it from the scripted model, so the committed cassettes are always made by
// one command. Only `scripted/...` models are wired: a live MERIT run is card X7.
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { type CacheStore, fileCache } from "@engram/model";
import { fixtureRecordingRefusal, readMeritConfig } from "../src/merit/config.ts";
import {
  ensureMeritCheckout,
  ensureMeritEnv,
  MERIT_ENV_DIR,
  MERIT_UPSTREAM_DIR,
} from "../src/merit/env.ts";
import { runMerit } from "../src/merit/launch.ts";
import { MERIT_SCRIPTED_MODEL, scriptedMeritAgent } from "../src/merit/scripted.ts";
import { summarise } from "../src/merit/summary.ts";

const SHIM = fileURLToPath(new URL("./merit-shim.py", import.meta.url));

/** The committed cassettes, read and never written. */
function readOnly(dir: string): CacheStore {
  if (!existsSync(dir)) {
    return {
      get: () => undefined,
      set: () => {
        throw new Error("replay writes no cassette");
      },
    };
  }
  const files = fileCache(dir);
  return {
    get: (key) => files.get(key),
    set: () => {
      throw new Error("replay writes no cassette");
    },
  };
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      config: { type: "string" },
      out: { type: "string" },
      upstream: { type: "string", default: MERIT_UPSTREAM_DIR },
      env: { type: "string", default: MERIT_ENV_DIR },
      prepare: { type: "boolean", default: false },
      record: { type: "boolean", default: false },
    },
  });
  if (values.prepare) {
    const checkout = ensureMeritCheckout(values.upstream);
    const python = ensureMeritEnv(values.env, checkout);
    console.log(`merit: checkout ${checkout} at the pin, environment ${python}`);
    return 0;
  }
  if (!values.config || !values.out) {
    console.error("usage: run-merit.ts --config <config.json> --out <dir> [--record | --prepare]");
    return 2;
  }
  const config = readMeritConfig(values.config);
  /** The repository root: make runs from it. */
  const repo = resolve(process.cwd());
  if (config.model !== MERIT_SCRIPTED_MODEL) {
    console.error(
      `run-merit: model ${config.model} is not the scripted ${MERIT_SCRIPTED_MODEL}; a live MERIT run is card X7`,
    );
    return 2;
  }
  if (values.record) {
    // Checked before anything is fetched, emptied or made: fileCache creates its folder.
    const refusal = fixtureRecordingRefusal(config.cassettes, repo, process.env);
    if (refusal !== undefined) {
      console.error(`run-merit: ${refusal}`);
      return 2;
    }
  }
  const checkout = ensureMeritCheckout(values.upstream);
  const python = ensureMeritEnv(values.env, checkout);
  if (values.record) {
    rmSync(config.cassettes, { recursive: true, force: true });
    mkdirSync(config.cassettes, { recursive: true });
  }
  const result = await runMerit({
    config,
    out: values.out,
    checkout,
    python,
    shim: SHIM,
    cache: values.record ? fileCache(config.cassettes) : readOnly(config.cassettes),
    record: values.record,
    // make fixtures records the scripted cassettes into fixtures/; the proxy's guard allows nothing else there.
    ...(values.record ? { upstream: scriptedMeritAgent, repo, recordFixtures: true } : {}),
  });
  const summary = summarise(result, { name: config.name, model: config.model, checkout });
  const jsonl = (rows: readonly unknown[]) => rows.map((r) => `${JSON.stringify(r)}\n`).join("");
  writeFileSync(join(values.out, "usage.jsonl"), jsonl(result.ledger));
  for (const cell of result.cells) {
    // C5 cells only: C2 and C1 keep no log, so they write no empty file (finding B7-6).
    if (cell.events.flat().length > 0) {
      writeFileSync(join(values.out, cell.run.name, "events.jsonl"), jsonl(cell.events.flat()));
    }
  }
  writeFileSync(join(values.out, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  const c = summary.calls;
  const lines = [
    `merit: ${summary.cells.length} run cells, ${summary.cells.reduce((a, x) => a + x.tasks.episodes, 0)} episodes scored by MERIT's checkers`,
    `model calls: ${c.new} new, ${c.from_cassettes} from cassettes`,
    `cost: paid this run ${c.paid.cost_usd.toFixed(6)} USD (${c.paid.input_tokens} input, ${c.paid.output_tokens} output tokens); recorded cost of the replayed calls ${c.recorded.cost_usd.toFixed(6)} USD (${c.recorded.input_tokens} input, ${c.recorded.output_tokens} output tokens)`,
  ];
  for (const cell of summary.cells) {
    const t = cell.tasks;
    const p = cell.plane;
    lines.push(
      `  ${cell.name}: success ${t.success}/${t.episodes} (dependent ${t.dependent.success}/${t.dependent.n}), calls ${cell.calls.calls}, recorded cost ${cell.calls.recorded.cost_usd.toFixed(6)} USD${p === null ? "" : `, plane writes ${p.write_allow} allowed ${p.write_deny} denied, reads ${p.read_allow}`}`,
    );
  }
  lines.push(`written to ${values.out}`);
  console.log(lines.join("\n"));
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
