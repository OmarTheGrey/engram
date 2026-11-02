// `make bench BENCH=gatemem DRY=1`: what the live GateMem run would cost,
// before the pre-registration leaves the backlog. The reference agent runs
// over the full checkpoint set with a stand-in for the answer model (an
// empty reply, no model is called and no cassette is read or written), and
// the run's answer calls are counted with their cache keys; the judge's calls
// are bounded (one to three attempts per checkpoint) since its prompts hold
// the answers. Writes dry-run.json to --out and prints the counts.
//
//   node packages/bench/scripts/dry-run-gatemem.ts --config fixtures/bench/gatemem/run-config.json \
//       --data .engram/upstream/gatemem/bench/data --fetch --out .engram/bench/gatemem-dry \
//       [--model <provider/model-id>] [--seed <n>] [--judge-model <provider/model-id>]
//
// --data is GateMem's bench/data at the pin (four domain folders). Each of
// its eight files is checked against the sha256 in the fixture manifest; the
// counts are labelled as the pinned full set only when all eight match.
// --fetch downloads the missing files from the pinned commit first (data
// only, over HTTPS; never a model). --model and --seed set the answer model
// and seed the keys are computed for (default: the config's), --judge-model
// the judge named in the report (default: the paper's, openai/gpt-4o).
// Without --model only the counts are reported: the config's model is the
// fixture's scripted one, whose keys no live run would use (finding P6-5).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { PAPER_JUDGE } from "../src/gatemem/judge.ts";
import {
  fetchPinnedData,
  pinnedFileMatches,
  pinnedFiles,
  readGateMemManifest,
} from "../src/gatemem/pinned.ts";
import { dryRunGateMem, readRunConfig } from "../src/gatemem/run.ts";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      config: { type: "string" },
      data: { type: "string" },
      out: { type: "string" },
      fetch: { type: "boolean", default: false },
      model: { type: "string" },
      seed: { type: "string" },
      "judge-model": { type: "string" },
    },
  });
  if (!values.config || !values.data || !values.out) {
    console.error(
      "usage: dry-run-gatemem.ts --config <run-config.json> --data <bench/data dir> --out <dir> [--fetch] [--model m] [--seed n] [--judge-model m]",
    );
    return 2;
  }
  const manifest = readGateMemManifest();
  if (values.fetch) await fetchPinnedData(values.data, manifest, (line) => console.log(line));
  const files = pinnedFiles(manifest);
  const matching = pinnedFileMatches(values.data, manifest);
  const pinned = matching === files.length;
  const base = readRunConfig(values.config);
  const config = {
    ...base,
    data: values.data,
    ...(values.model ? { model: values.model } : {}),
    ...(values.seed ? { seed: Number.parseInt(values.seed, 10) } : {}),
  };
  const judgeModel = values["judge-model"] ?? PAPER_JUDGE.model;
  const dry = await dryRunGateMem(config, { judgeModel });
  mkdirSync(values.out, { recursive: true });
  // Keys are only worth printing for the model the live run will use; the
  // config's own is the fixture's scripted one (review finding P6-5).
  const keyed = values.model !== undefined;
  const { model: _model, seed: _seed, answer, ...rest } = dry;
  const { keys: _keys, unique_keys: _unique, ...counts } = answer;
  const report = {
    pinned_full_set: pinned,
    data: values.data,
    commit: manifest.source.commit,
    condition: config.condition,
    preset: config.preset,
    store: config.store,
    ...(keyed ? { model: dry.model, seed: dry.seed } : {}),
    ...rest,
    answer: keyed ? answer : counts,
  };
  writeFileSync(join(values.out, "dry-run.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    [
      pinned
        ? `gatemem dry run on the pinned full set (${manifest.source.commit.slice(0, 7)}, 8 of 8 files match the manifest)`
        : `gatemem dry run on ${values.data}: NOT the pinned full set (${matching} of ${files.length} files match the manifest)`,
      `${dry.episodes} episodes, ${dry.checkpoints} checkpoints: ${Object.entries(dry.by_domain)
        .map(([d, n]) => `${d} ${n.checkpoints}`)
        .join(", ")}`,
      keyed
        ? `answer model ${dry.model}, seed ${dry.seed}: ${dry.answer.calls} calls at ${dry.answer.unique_keys} distinct cache keys, ${dry.answer.input_chars} prompt characters`
        : `answer calls: ${dry.answer.calls} calls, ${dry.answer.input_chars} prompt characters (the counts do not depend on the model)`,
      `judge ${dry.judge_model}: ${dry.judge.calls_min} to ${dry.judge.calls_max} calls (1 to 3 attempts each), at least ${dry.judge.input_chars_min} prompt characters; keys known after the answer run`,
      "no model was called",
      keyed
        ? `keys written to ${join(values.out, "dry-run.json")}`
        : "cache keys: not computed; name the live model with MODEL= (and SEED=) to list them",
    ].join("\n"),
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
