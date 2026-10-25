// The Linter interface (docs/architecture.md "Interfaces", ADR 0008). Two
// tiers share it: deterministic lints (card L1) and model-based lints (card
// L3), which receive an injected ModelCall at construction, never a pi import.
// A linter only finds; the Plane records each finding as a `lint` event.
import type { LintFinding } from "./schema.ts";

export interface Linter {
  /** Runs the enabled lints over the items in one scope (`person:<id>`, `team:<id>`, `org`, ...). */
  lint(scope: string): Promise<LintFinding[]>;
}
