// The store-command check lives in core (packages/core/src/no-bypass/shell.ts):
// it decides, so it is core's (AGENTS.md rule 1), and the pi extension and
// the Claude Code hook (`engram hook claude-code`) both call it (plan
// docs/tasks/gate-b-plan.md, decision 6; ADR 0014's amendments).
export { blockedStoreCommand, commandWords, pathWords, STORE_COMMANDS } from "@engram/core";
