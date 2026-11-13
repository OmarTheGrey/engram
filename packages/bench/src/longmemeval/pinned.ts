// Whether a LongMemEval question directory holds the vendored, pinned subset
// (card B5): every line of questions.jsonl as the fixture manifest hashes it.
// The subset was vendored from the pinned release by
// packages/bench/scripts/vendor-longmemeval.ts and is committed, so a run
// fetches nothing.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
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

interface Manifest {
  source: { commit: string };
  files: Record<string, string[]>;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export interface LongMemEvalDataCheck {
  /** `fixture`: the vendored subset; `unpinned`: anything else. */
  set: "fixture" | "unpinned";
  commit: string;
}

export function checkLongMemEvalData(
  dir: string,
  manifestPath = LONGMEMEVAL_MANIFEST,
): LongMemEvalDataCheck {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  const path = join(dir, "questions.jsonl");
  const lines = existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];
  if (lines.at(-1) === "") lines.pop();
  const set =
    lines.map(sha256).join() === manifest.files["questions.jsonl"]?.join() ? "fixture" : "unpinned";
  return { set, commit: manifest.source.commit };
}
