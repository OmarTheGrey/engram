// @engram/view (card E8.15c, docs/design/tui.md 6.3): the pure view logic the
// inspector (packages/ui) and the terminal interface (packages/cli/src/tui)
// both show, from what the API returned to the viewer. It decides no policy
// (AGENTS.md rule 1) and imports only the generated client's types, so a
// package that depends on it gains no React, xyflow, dagre or tanstack.
export * from "./provenance.ts";
export * from "./view.ts";
