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
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { PAPER_JUDGE } from "../src/gatemem/judge.ts";

/** GateMem's four domains at the pin (bench/data/). */
const DOMAINS = ["education", "household", "medical", "office"] as const;

import { dryRunGateMem, readRunConfig } from "../src/gatemem/run.ts";

const MANIFEST = fileURLToPath(
  new URL("../../../fixtures/bench/gatemem/manifest.json", import.meta.url),
);

interface Manifest {
  source: { repository: string; commit: string };
  upstream_sha256: Record<string, string>;
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/** The eight data files at the pin, as (path under bench/data, sha256). */
function pinnedFiles(manifest: Manifest): [string, string][] {
  return DOMAINS.flatMap((d) =>
    ["episodes.jsonl", "checkpoints.jsonl"].map((f): [string, string] => {
      const hash = manifest.upstream_sha256[`bench/data/${d}/${f}`];
      if (!hash) throw new Error(`manifest has no sha256 for bench/data/${d}/${f}`);
      return [`${d}/${f}`, hash];
    }),
  );
}

async function fetchMissing(data: string, manifest: Manifest): Promise<void> {
  const raw = manifest.source.repository.replace(
    "https://github.com/",
    "https://raw.githubusercontent.com/",
  );
  for (const [file, hash] of pinnedFiles(manifest)) {
    const target = join(data, file);
    if (existsSync(target)) continue;
    const url = `${raw}/${manifest.source.commit}/bench/data/${file}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url}: HTTP ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    if (sha256(body) !== hash) throw new Error(`fetch ${url}: sha256 differs from the manifest`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body);
    console.log(`fetched ${file} at ${manifest.source.commit.slice(0, 7)}`);
  }
}

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
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
  if (values.fetch) await fetchMissing(values.data, manifest);
  const files = pinnedFiles(manifest);
  const matching = files.filter(
    ([file, hash]) =>
      existsSync(join(values.data as string, file)) &&
      sha256(readFileSync(join(values.data as string, file))) === hash,
  ).length;
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
  const report = {
    pinned_full_set: pinned,
    data: values.data,
    commit: manifest.source.commit,
    condition: config.condition,
    preset: config.preset,
    store: config.store,
    ...dry,
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
      `answer model ${dry.model}, seed ${dry.seed}: ${dry.answer.calls} calls at ${dry.answer.unique_keys} distinct cache keys, ${dry.answer.input_chars} prompt characters`,
      `judge ${dry.judge_model}: ${dry.judge.calls_min} to ${dry.judge.calls_max} calls (1 to 3 attempts each), at least ${dry.judge.input_chars_min} prompt characters; keys known after the answer run`,
      "no model was called",
      `keys written to ${join(values.out, "dry-run.json")}`,
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
