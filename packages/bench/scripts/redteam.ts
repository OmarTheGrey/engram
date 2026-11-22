// Card X14's run: every corpus entry planted under every setting of the
// config, by both routes, as each source kind, through the real Plane on the
// fake store (packages/bench/src/redteam/run.ts). Writes one row per
// (setting, route, kind, entry) and a meta file (corpus counts and hashes,
// the overlap with MEM-INV-Bench's channels); research/scripts/redteam.py
// turns them into rates. Nothing here computes a rate. No model is called.
//
//   node packages/bench/scripts/redteam.ts --config research/configs/redteam.json --out <dir> [--fetch]
//   node packages/bench/scripts/redteam.ts --config research/configs/redteam.json --fetch-only
//
// --fetch fetches a missing pinned payload file at its revision into the
// config's upstream folder (data only, refused under ENGRAM_OFFLINE=1).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadAmsb, loadControls } from "../src/amsb/load.ts";
import { loadCases } from "../src/mem-inv-bench/load.ts";
import {
  amsbEntries,
  controlEntries,
  deepsetEntries,
  lakeraEntries,
  type RedteamEntry,
} from "../src/redteam/corpus.ts";
import { overlap } from "../src/redteam/overlap.ts";
import { fetchPayloads, PAYLOAD_PINS, readPayloads } from "../src/redteam/payloads.ts";
import { ROUTES, type Route, SOURCE_KINDS, type SourceKind } from "../src/redteam/routes.ts";
import { runCell } from "../src/redteam/run.ts";
import { buildSetting, type SettingSpec } from "../src/redteam/settings.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));

interface Config {
  upstream: string;
  settings: SettingSpec[];
  routes: Route[];
  kinds: SourceKind[];
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      config: { type: "string" },
      out: { type: "string" },
      fetch: { type: "boolean", default: false },
      "fetch-only": { type: "boolean", default: false },
    },
  });
  if (!values.config) throw new Error("usage: redteam.ts --config <file> (--out <dir> | --fetch-only)");
  const config = JSON.parse(readFileSync(values.config, "utf8")) as Config;
  const upstream = resolve(REPO, config.upstream);
  if (values.fetch || values["fetch-only"])
    for (const pin of PAYLOAD_PINS) await fetchPayloads(upstream, pin);
  if (values["fetch-only"]) return;
  if (!values.out) throw new Error("--out <dir> is required");
  for (const r of config.routes) if (!ROUTES.includes(r)) throw new Error(`unknown route ${r}`);
  for (const k of config.kinds) if (!SOURCE_KINDS.includes(k)) throw new Error(`unknown kind ${k}`);
  const settings = config.settings.map(buildSetting);
  if (new Set(settings.map((s) => s.name)).size !== settings.length)
    throw new Error("a setting name repeats");

  const amsb = loadAmsb();
  const controls = loadControls();
  const [deepset, lakera] = PAYLOAD_PINS;
  if (deepset?.name !== "deepset" || lakera?.name !== "lakera") throw new Error("payload pins out of order");
  const entries: RedteamEntry[] = [
    ...amsbEntries(amsb.scenarios),
    ...deepsetEntries(await readPayloads(upstream, deepset)),
    ...lakeraEntries(await readPayloads(upstream, lakera)),
    ...controlEntries(controls.controls),
  ];
  if (new Set(entries.map((e) => e.id)).size !== entries.length) throw new Error("an entry id repeats");

  mkdirSync(values.out, { recursive: true });
  const lines: string[] = [];
  for (const setting of settings)
    for (const route of config.routes)
      for (const kind of config.kinds)
        for (const row of await runCell(setting, route, kind, entries)) lines.push(JSON.stringify(row));
  writeFileSync(join(values.out, "rows.jsonl"), `${lines.join("\n")}\n`);

  const meta = {
    amsb: { commit: amsb.commit, sha256: amsb.sha256, counts: amsb.counts },
    controls: { sha256: controls.sha256, count: controls.controls.length },
    payloads: PAYLOAD_PINS.map((p) => ({
      name: p.name,
      repository: p.repository,
      revision: p.revision,
      licence: p.licence,
      rows: p.rows,
      sha256: Object.fromEntries(p.files.map((f) => [f.path, f.sha256])),
    })),
    entries: entries.map((e) => ({
      id: e.id,
      source: e.source,
      family: e.family,
      malicious: e.malicious,
      severity: e.severity,
      weight: e.weight,
    })),
    overlap: overlap(loadCases(join(REPO, "fixtures/bench/mem-inv-bench/full"))),
  };
  writeFileSync(join(values.out, "meta.json"), `${JSON.stringify(meta)}\n`);
}

await main();
