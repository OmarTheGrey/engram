// The invariant oracles, part of the lead-owned invariants file
// (docs/conventions/testing.md). They live in packages/core/src/oracle.ts
// since card E9.5, so the twin dogfood's violation report judges a member's
// log with the same oracle; this path re-exports them, so the invariants and
// the other property tests import them as before.
export * from "../../src/oracle.ts";
