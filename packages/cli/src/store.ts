// The store a command governs is opened by the workspace
// (packages/server/src/workspace.ts, plan PR 3 item 2); re-exported here,
// where it lived until then. The CLI builds no adapter itself and never
// calls one (AGENTS.md rule 2).
export { openStore, type Store, type StoreFlags } from "@engram/server";
