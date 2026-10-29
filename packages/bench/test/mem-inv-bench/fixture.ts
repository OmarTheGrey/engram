// Shared paths and loaders for the MEM-INV-Bench layer-7 tests (card B4).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadCases } from "../../src/mem-inv-bench/load.ts";

export const FIXTURES = fileURLToPath(
  new URL("../../../../fixtures/bench/mem-inv-bench/", import.meta.url),
);

export const cases = () => loadCases(FIXTURES);

export const readJson = <T>(name: string): T =>
  JSON.parse(readFileSync(`${FIXTURES}${name}`, "utf8")) as T;

export interface Manifest {
  source: { repository: string; commit: string; dataset_revision: string };
  seed: number;
  upstream_sha256: Record<string, string>;
  recorded_system_prompt_sha256: string;
  files: Record<string, string[]>;
  cases: {
    case_id: string;
    family: string;
    channel: string;
    sid: string;
    recorded_from: string;
    recorded_prompt_sha256: string;
  }[];
}

export interface Script {
  responses: Record<string, { text: string; from: string }>;
}

export interface GoldenRow {
  bucket: string;
  verdict: string;
  source: string;
}

export interface Golden {
  cases: Record<string, GoldenRow>;
  crafted: (GoldenRow & {
    row: {
      sid: string;
      family: string;
      evil: string | null;
      good: string | null;
      value: string | null;
      proposal: string;
      p_finish: string;
      p_trunc: boolean;
      p_ok: boolean;
    };
  })[];
}
