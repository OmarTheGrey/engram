// Switches Mem0's telemetry off for this process (AGENTS.md rule 12: nothing
// leaves the machine). Mem0 reads MEM0_TELEMETRY once, when `mem0ai/oss` is
// first evaluated, so this module has no imports and is the first import of
// the package index and of the Mem0 adapter: whoever imports @engram/adapters
// sets the variable before any later import of `mem0ai/oss` can read it. When
// a program loads `mem0ai/oss` before @engram/adapters, the variable comes too
// late; the adapter also disables telemetry on each Mem0 instance it builds
// (see `silence` in ./index.ts), so the order of imports never turns it on.
process.env.MEM0_TELEMETRY = "false";
