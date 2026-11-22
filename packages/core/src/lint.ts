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
  // Card E2.10 (ADR 0039): the injection screen's rules over stored content.
  // No registered preset or profile lists it, so no registered lint run changes.
  "injection-signature",
] as const;
export type DeterministicLintId = (typeof DETERMINISTIC_LINT_IDS)[number];
export const MODEL_LINT_IDS = ["contradiction", "unsupported-claim"] as const;
export type ModelLintId = (typeof MODEL_LINT_IDS)[number];
/**
 * Card L7: the local natural-language-inference tier of the contradiction
 * lint (lint/nli.ts). A policy turns it on by listing its id; no registered
 * preset or profile lists it, so no registered lint run changes. It runs only
 * on a plane built with an NLI scorer (PlaneDeps.lintNli).
 */
export const NLI_LINT_IDS = ["contradiction-nli"] as const;
export type NliLintId = (typeof NLI_LINT_IDS)[number];
export const LINT_IDS = [...DETERMINISTIC_LINT_IDS, ...MODEL_LINT_IDS, ...NLI_LINT_IDS] as const;
export type LintId = (typeof LINT_IDS)[number];

/**
 * Procedural lifecycle triggers (ADR 0011): they retire an active procedure
 * and are not lints, so a policy never lists them in `lints.enabled`.
 */
export const LIFECYCLE_TRIGGERS = ["replay-drift", "environment-changed"] as const;
export type LifecycleTrigger = (typeof LIFECYCLE_TRIGGERS)[number];

/**
 * The keys `lints.thresholds` may set: the similarity at which `duplicate`
 * flags a near-duplicate, the replay-drift trigger's success floor and
 * minimum trial count (ADR 0011 amendment), and the NLI tier's two bands
 * (card L7): a pair scored at or above the upper is flagged, below the lower
 * dropped, and between them sent to the model contradiction lint.
 */
export const LINT_THRESHOLD_KEYS = [
  "near-duplicate",
  "replay-drift.success-floor",
  "replay-drift.min-trials",
  "contradiction-nli.upper",
  "contradiction-nli.lower",
] as const;
export type LintThresholdKey = (typeof LINT_THRESHOLD_KEYS)[number];
