// Whether a MEM-INV-Bench case directory holds the pinned cases (card X1,
// plan decision 6 of docs/tasks/prereg-v1-plan.md): the full case set
// (`full/cases.jsonl`, every attack scenario in every laundering channel and
// every benign one) or the fixture subset (`cases.jsonl`), every line as the
// fixture manifest hashes it. Both were vendored from the pinned commit by
// packages/bench/scripts/vendor-mem-inv-bench.py and are committed, so there
// is nothing to fetch.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const MEM_INV_MANIFEST = fileURLToPath(
  new URL("../../../../fixtures/bench/mem-inv-bench/manifest.json", import.meta.url),
);

interface MemInvManifest {
  source: { commit: string };
  files: Record<string, string[]>;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** What a MEM-INV-Bench case directory holds, against the pin. */
export interface MemInvDataCheck {
  /** `full`: the full case set; `fixture`: the vendored subset; `unpinned`: neither. */
  set: "full" | "fixture" | "unpinned";
  commit: string;
}

export function checkMemInvData(dir: string, manifestPath = MEM_INV_MANIFEST): MemInvDataCheck {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as MemInvManifest;
  const path = join(dir, "cases.jsonl");
  const lines = existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];
  if (lines.at(-1) === "") lines.pop();
  const hashes = lines.map(sha256).join();
  const set =
    hashes === manifest.files["full/cases.jsonl"]?.join()
      ? "full"
      : hashes === manifest.files["cases.jsonl"]?.join()
        ? "fixture"
        : "unpinned";
  return { set, commit: manifest.source.commit };
}
