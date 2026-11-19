// Whether LongMemEval data is pinned data (cards B5 and B6): a question
// directory whose questions.jsonl is the vendored subset, every line as the
// fixture manifest hashes it (B5; vendored from the pinned release by
// packages/bench/scripts/vendor-longmemeval.ts and committed, so a run fetches
// nothing), or a file that is the cleaned S split at the pinned dataset
// revision, by its sha256 (B6's experiment configs; fetched into
// .engram/upstream by research/scripts/h3_fault_set.py's ensure_pinned_file,
// data only, and never committed).
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const LONGMEMEVAL_MANIFEST = fileURLToPath(
  new URL("../../../../fixtures/bench/longmemeval/manifest.json", import.meta.url),
);

/** Upstream at the pin in packages/bench/PINS.md. */
export const LONGMEMEVAL_UPSTREAM = {
  repository: "https://github.com/xiaowu0162/LongMemEval",
  commit: "9e0b455f4ef0e2ab8f2e582289761153549043fc",
  dataset: "https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned",
  dataset_revision: "98d7416c24c778c2fee6e6f3006e7a073259d48f",
  file: "longmemeval_oracle.json",
} as const;

/**
 * The cleaned S split at the pinned dataset revision, the split the
 * pre-registration names for H2 and H3: its file and sha256, which equals the
 * LFS object id the dataset's tree lists at the revision (card L2's finding,
 * docs/log/2026-11-19-l2-finding-s-split-hash.md; research/configs/h3-fault-set.json
 * checks the same hash).
 */
export const LONGMEMEVAL_S = {
  file: "longmemeval_s_cleaned.json",
  sha256: "d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442",
} as const;

interface Manifest {
  source: { commit: string };
  files: Record<string, string[]>;
}

const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

export interface LongMemEvalDataCheck {
  /** `full`: the pinned S split; `fixture`: the vendored subset; `unpinned`: anything else. */
  set: "full" | "fixture" | "unpinned";
  /** The dataset revision for the S split, the upstream commit for the subset. */
  commit: string;
}

/**
 * What `path` holds: a file is the full set when its sha256 is the S split's
 * (`sSha256`, injectable for tests); a directory is the fixture when its
 * questions.jsonl is the manifest's lines.
 */
export function checkLongMemEvalData(
  path: string,
  options: { manifest?: string; sSha256?: string } = {},
): LongMemEvalDataCheck {
  const manifest = JSON.parse(
    readFileSync(options.manifest ?? LONGMEMEVAL_MANIFEST, "utf8"),
  ) as Manifest;
  if (existsSync(path) && statSync(path).isFile()) {
    const full = sha256(readFileSync(path)) === (options.sSha256 ?? LONGMEMEVAL_S.sha256);
    return full
      ? { set: "full", commit: LONGMEMEVAL_UPSTREAM.dataset_revision }
      : { set: "unpinned", commit: manifest.source.commit };
  }
  const file = join(path, "questions.jsonl");
  const lines = existsSync(file) ? readFileSync(file, "utf8").split("\n") : [];
  if (lines.at(-1) === "") lines.pop();
  const set =
    lines.map(sha256).join() === manifest.files["questions.jsonl"]?.join() ? "fixture" : "unpinned";
  return { set, commit: manifest.source.commit };
}
