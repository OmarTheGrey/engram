// The Linter interface (docs/architecture.md "Interfaces", ADR 0008). Two
// tiers share it: deterministic lints (card L1) and model-based lints (card
// L3), which receive an injected ModelCall at construction, never a pi import.
// A linter only finds; the Plane records each finding as a `lint` event.
import type { LintFinding } from "./schema.ts";

export interface Linter {
  /** Runs the enabled lints over the items in one scope (`person:<id>`, `team:<id>`, `org`, ...). */
  lint(scope: string): Promise<LintFinding[]>;
}

/**
 * Every lint the plane knows, by the id a policy's `lints.enabled` names
 * (ADR 0008). The deterministic tier first, then the model-based tier. A
 * policy's list says which lints a lint-running condition (C6) runs; it does
 * not turn lints on under C5, which is the gate and the read filter only.
 */
export const DETERMINISTIC_LINT_IDS = [
  "expired-validity",
  "source-changed",
  "scope-class-mismatch",
  "missing-provenance",
  "orphan",
  "duplicate",
] as const;
export type DeterministicLintId = (typeof DETERMINISTIC_LINT_IDS)[number];
export const MODEL_LINT_IDS = ["contradiction", "unsupported-claim"] as const;
export const LINT_IDS = [...DETERMINISTIC_LINT_IDS, ...MODEL_LINT_IDS] as const;
export type LintId = (typeof LINT_IDS)[number];

/**
 * Procedural lifecycle triggers (ADR 0011): they retire an active procedure
 * and are not lints, so a policy never lists them in `lints.enabled`.
 */
export const LIFECYCLE_TRIGGERS = ["replay-drift", "environment-changed"] as const;
export type LifecycleTrigger = (typeof LIFECYCLE_TRIGGERS)[number];

/**
 * The keys `lints.thresholds` may set: the similarity at which `duplicate`
 * flags a near-duplicate, and the replay-drift trigger's success floor and
 * minimum trial count (ADR 0011 amendment).
 */
export const LINT_THRESHOLD_KEYS = [
  "near-duplicate",
  "replay-drift.success-floor",
  "replay-drift.min-trials",
] as const;
export type LintThresholdKey = (typeof LINT_THRESHOLD_KEYS)[number];
