// Shared paths and loaders for the GateMem layer-7 tests.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadDataset } from "../../src/gatemem/load.ts";

export const FIXTURES = fileURLToPath(
  new URL("../../../../fixtures/bench/gatemem/", import.meta.url),
);
export const CONFIG = `${FIXTURES}run-config.json`;

export const fixture = () => loadDataset(FIXTURES);

export const readJson = <T>(name: string): T =>
  JSON.parse(readFileSync(`${FIXTURES}${name}`, "utf8")) as T;

export interface Manifest {
  source: { commit: string };
  seed: number;
  upstream_sha256: Record<string, string>;
  selection: {
    domain: string;
    episode_id: string;
    episode_line_sha256: string;
    checkpoints: { checkpoint_id: string; query_type: string; line_sha256: string }[];
  }[];
}

export interface Script {
  planted: { leak: string; refusal: string; fenced_json: string; plain_text: string };
  responses: Record<string, string>;
}
