// Loads the vendored AMSB corpus (OWASP Agent Memory Guard, Apache-2.0,
// Copyright 2026 OWASP Foundation; NOTICE) and card X14's benign controls
// of the same shape, and assembles every text: a value kept as parts is
// joined, a repeated one expanded. Nothing here reaches the network.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AmsbFile, ControlsFile, type Severity, type Text } from "./schema.ts";

export const AMSB_FILE = fileURLToPath(
  new URL("../../../../fixtures/amsb/scenarios.json", import.meta.url),
);
export const CONTROLS_FILE = fileURLToPath(
  new URL("../../../../fixtures/amsb/controls.json", import.meta.url),
);

/** The commit the corpus was copied from; card R2 counted 21 scenarios there. */
export const AMSB_COMMIT = "b052787cc3426ff5f5f7e8e0eecb514052a168ba";

/** A text as the scenario writes it. */
export function assemble(text: Text): string {
  if (typeof text === "string") return text;
  if ("parts" in text) return text.parts.join("");
  return text.unit.repeat(text.repeat);
}

/** One scenario, its texts assembled: a sequence of writes, then a read-back after a context reset. */
export interface AmsbScenario {
  id: string;
  /** Upstream's threat family, `benign` for a control. */
  category: string;
  severity: Severity;
  /** AMSB's severity weight (1 to 4). */
  weight: number;
  description: string;
  steps: { key: string; value: string; source_class: "external_tool" | "user_input" }[];
  probe_key: string;
  /** The substring whose survival into a later read is a breach; empty for a control. */
  canary: string;
  malicious: boolean;
}

export interface AmsbCorpus {
  commit: string;
  sha256: string;
  counts: { total: number; malicious: number; benign: number };
  scenarios: AmsbScenario[];
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** The vendored corpus, checked against its own counts and the pinned commit. */
export function loadAmsb(path = AMSB_FILE): AmsbCorpus {
  const text = readFileSync(path, "utf8");
  const file = AmsbFile.parse(JSON.parse(text));
  if (file.source.commit !== AMSB_COMMIT)
    throw new Error(`${path}: copied from ${file.source.commit}, not the pinned ${AMSB_COMMIT}`);
  const scenarios = file.scenarios.map((s) => ({
    id: s.id,
    category: s.category,
    severity: s.severity,
    weight: file.severity_weight[s.severity],
    description: s.description,
    steps: s.steps.map((step) => ({ ...step, value: assemble(step.value) })),
    probe_key: s.probe_key,
    canary: assemble(s.canary),
    malicious: s.malicious,
  }));
  const counts = {
    total: scenarios.length,
    malicious: scenarios.filter((s) => s.malicious).length,
    benign: scenarios.filter((s) => !s.malicious).length,
  };
  if (JSON.stringify(counts) !== JSON.stringify(file.counts))
    throw new Error(
      `${path}: holds ${JSON.stringify(counts)}, says ${JSON.stringify(file.counts)}`,
    );
  const ids = new Set(scenarios.map((s) => s.id));
  if (ids.size !== scenarios.length) throw new Error(`${path}: a scenario id repeats`);
  return { commit: file.source.commit, sha256: sha256(text), counts, scenarios };
}

/** One of card X14's benign controls. */
export interface Control {
  id: string;
  group: string;
  description: string;
  key: string;
  value: string;
}

export function loadControls(path = CONTROLS_FILE): { sha256: string; controls: Control[] } {
  const text = readFileSync(path, "utf8");
  const file = ControlsFile.parse(JSON.parse(text));
  const controls = file.scenarios.map((c) => ({ ...c, value: assemble(c.value) }));
  if (new Set(controls.map((c) => c.id)).size !== controls.length)
    throw new Error(`${path}: a control id repeats`);
  return { sha256: sha256(text), controls };
}
