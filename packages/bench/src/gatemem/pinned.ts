// Whether a GateMem data directory holds the pinned data (card X1, plan
// decision 6 of docs/tasks/prereg-v1-plan.md): the full set at the pinned
// commit, every one of its eight files byte for byte as the fixture manifest
// hashes it, or the vendored fixture subset, every line as its manifest's
// selection hashes it. The full set can be fetched from the pinned commit
// (data only, over HTTPS; never a model), as `make bench BENCH=gatemem DRY=1`
// does.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** GateMem's four domains at the pin (bench/data/). */
export const GATEMEM_DOMAINS = ["education", "household", "medical", "office"] as const;

export const GATEMEM_MANIFEST = fileURLToPath(
  new URL("../../../../fixtures/bench/gatemem/manifest.json", import.meta.url),
);

export interface GateMemManifest {
  source: { repository: string; commit: string };
  upstream_sha256: Record<string, string>;
  selection: {
    domain: string;
    episode_line_sha256: string;
    checkpoints: { line_sha256: string }[];
  }[];
}

export const readGateMemManifest = (path = GATEMEM_MANIFEST): GateMemManifest =>
  JSON.parse(readFileSync(path, "utf8")) as GateMemManifest;

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

/** The eight data files at the pin, as (path under bench/data, sha256). */
export function pinnedFiles(manifest: GateMemManifest): [string, string][] {
  return GATEMEM_DOMAINS.flatMap((d) =>
    ["episodes.jsonl", "checkpoints.jsonl"].map((f): [string, string] => {
      const hash = manifest.upstream_sha256[`bench/data/${d}/${f}`];
      if (!hash) throw new Error(`manifest has no sha256 for bench/data/${d}/${f}`);
      return [`${d}/${f}`, hash];
    }),
  );
}

/** Downloads the pinned files missing from `data`, each checked against the manifest. */
export async function fetchPinnedData(
  data: string,
  manifest = readGateMemManifest(),
  log: (line: string) => void = () => {},
): Promise<void> {
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
    log(`fetched ${file} at ${manifest.source.commit.slice(0, 7)}`);
  }
}

/** How many of the eight pinned files `data` holds byte for byte. */
export function pinnedFileMatches(data: string, manifest = readGateMemManifest()): number {
  return pinnedFiles(manifest).filter(
    ([file, hash]) =>
      existsSync(join(data, file)) && sha256(readFileSync(join(data, file))) === hash,
  ).length;
}

/** The sha256 of every line of a file, as engram doctor hashes them. */
function lineHashes(path: string): string[] {
  const lines = readFileSync(path, "utf8").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map((l) => sha256(l));
}

/** Whether `data` holds the vendored fixture subset, every line as the manifest's selection hashes it. */
function isFixtureSubset(data: string, manifest: GateMemManifest): boolean {
  return manifest.selection.every((s) => {
    const episodes = join(data, s.domain, "episodes.jsonl");
    const checkpoints = join(data, s.domain, "checkpoints.jsonl");
    return (
      existsSync(episodes) &&
      existsSync(checkpoints) &&
      lineHashes(episodes).join() === s.episode_line_sha256 &&
      lineHashes(checkpoints).join() === s.checkpoints.map((c) => c.line_sha256).join()
    );
  });
}

/** What a GateMem data directory holds, against the pin. */
export interface GateMemDataCheck {
  /** `full`: the pinned full set; `fixture`: the vendored subset; `unpinned`: neither. */
  set: "full" | "fixture" | "unpinned";
  commit: string;
  /** Of the eight pinned full-set files, how many match. */
  full_files_matching: number;
}

/**
 * The domain directories loadDataset would load from `data` (each holding an
 * episodes.jsonl), sorted: a pinned set must load exactly the pinned domains,
 * since an extra one would be run and counted with it (PR #25 review, P3-8).
 */
export function loadedDomains(data: string): string[] {
  if (!existsSync(data)) return [];
  return readdirSync(data, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(data, d.name, "episodes.jsonl")))
    .map((d) => d.name)
    .sort();
}

export function checkGateMemData(data: string, manifest = readGateMemManifest()): GateMemDataCheck {
  const matching = pinnedFileMatches(data, manifest);
  const domains = loadedDomains(data).join();
  const set =
    matching === pinnedFiles(manifest).length && domains === [...GATEMEM_DOMAINS].join()
      ? "full"
      : domains ===
            manifest.selection
              .map((s) => s.domain)
              .sort()
              .join() && isFixtureSubset(data, manifest)
        ? "fixture"
        : "unpinned";
  return { set, commit: manifest.source.commit, full_files_matching: matching };
}
