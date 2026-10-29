// The store-root check lives in core (packages/core/src/no-bypass/paths.ts):
// it decides, so it is core's (AGENTS.md rule 1), and the pi extension and
// the Claude Code hook (`engram hook claude-code`) both call it (plan
// docs/tasks/gate-b-plan.md, decision 6; ADR 0014's amendments).
export { type RootCheck, shellDrivePath, storeRootOf, toolPaths } from "@engram/core";
