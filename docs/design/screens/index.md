# engram tui screenshots

Written by `make tui-screens` (`packages/cli/scripts/tui-screens.ts`); do not edit by hand.
Each screen is the real TUI driven through the FakeTerminal, as a person types, on a
workspace seeded in `.engram/tui-screens/work/` from `fixtures/workspaces/inspector/`
(its policy and its writes, each one plain `engram write` with a fixed clock and counted ids).
The workspace flags are `--owner dana --db engram.db --root mem --policy policy.yaml
--member person:dana --member team:core`; the clock is 2026-10-29T12:00:00Z.
Every screen is a fresh session on a fresh copy of that workspace.
The workspace folder's absolute path is shown as `~/demo` (in printed results, the Serve
start line and the MCP snippet), so no frame names a folder of the machine that made it;
the MCP snippet names `engram` as its command; Serve really listens, on 127.0.0.1:7391.

Beside each PNG: `.ansi` (the frame as SGR runs, `cat` it in a truecolor terminal) and
`.html` (the frame as a page, the palette of `packages/cli/src/tui/theme.ts`). The `.ansi`
files are the byte-stable ones; `packages/cli/test/tui/screens.test.ts` checks a few.

| screen | file | size and theme | keys | what it shows |
|---|---|---|---|---|
| home | [home.png](home.png) | 120x36, dark | (start) | Home: the registry's commands in six groups with their access letters, the selected command's summary, what it changes and its exit codes, and the command row it would run. |
| home | [home-light.png](home-light.png) | 120x36, light | (start) | Home: the registry's commands in six groups with their access letters, the selected command's summary, what it changes and its exit codes, and the command row it would run. |
| home | [home-high-contrast.png](home-high-contrast.png) | 120x36, --high-contrast | (start) | Home: the registry's commands in six groups with their access letters, the selected command's summary, what it changes and its exit codes, and the command row it would run. |
| home | [home-ascii.png](home-ascii.png) | 120x36, --ascii | (start) | Home: the registry's commands in six groups with their access letters, the selected command's summary, what it changes and its exit codes, and the command row it would run. |
| home | [home-80col.png](home-80col.png) | 80x24, dark | (start) | Home: the registry's commands in six groups with their access letters, the selected command's summary, what it changes and its exit codes, and the command row it would run. |
| read | [read.png](read.png) | 120x36, dark | r, ctrl+s, y (the first read with a store folder asks) | Read results: the read's id and decision, the counts, the scope lanes and the selected item's explanation (score components and the rule that admitted it). |
| read | [read-light.png](read-light.png) | 120x36, light | r, ctrl+s, y (the first read with a store folder asks) | Read results: the read's id and decision, the counts, the scope lanes and the selected item's explanation (score components and the rule that admitted it). |
| read | [read-high-contrast.png](read-high-contrast.png) | 120x36, --high-contrast | r, ctrl+s, y (the first read with a store folder asks) | Read results: the read's id and decision, the counts, the scope lanes and the selected item's explanation (score components and the rule that admitted it). |
| read | [read-ascii.png](read-ascii.png) | 120x36, --ascii | r, ctrl+s, y (the first read with a store folder asks) | Read results: the read's id and decision, the counts, the scope lanes and the selected item's explanation (score components and the rule that admitted it). |
| read | [read-80col.png](read-80col.png) | 80x24, dark | r, ctrl+s, y (the first read with a store folder asks) | Read results: the read's id and decision, the counts, the scope lanes and the selected item's explanation (score components and the rule that admitted it). |
| explain | [explain.png](explain.png) | 120x36, dark | r, ctrl+s, y, e | Explain: what the read returned and filtered, item by item, with each rank and score. |
| item | [item.png](item.png) | 120x36, dark | r, ctrl+s, y, e, enter | The item page: the item's current state, its provenance tree, its versions and the events naming it. |
| write-allow | [write-allow.png](write-allow.png) | 120x36, dark | w, type the content, tab to Check, enter, ctrl+s, y | A write the gate allows: the decision first, the reason and the policy id verbatim, the event it recorded. |
| write-deny | [write-deny.png](write-deny.png) | 120x36, dark | w, type the content, Scope team:core, Class episodic, ctrl+s, y | A write the gate denies: the reason and the policy id verbatim, and that nothing was stored; the decision is an event in the log. |
| write-deny | [write-deny-light.png](write-deny-light.png) | 120x36, light | w, type the content, Scope team:core, Class episodic, ctrl+s, y | A write the gate denies: the reason and the policy id verbatim, and that nothing was stored; the decision is an event in the log. |
| write-deny | [write-deny-high-contrast.png](write-deny-high-contrast.png) | 120x36, --high-contrast | w, type the content, Scope team:core, Class episodic, ctrl+s, y | A write the gate denies: the reason and the policy id verbatim, and that nothing was stored; the decision is an event in the log. |
| write-deny | [write-deny-ascii.png](write-deny-ascii.png) | 120x36, --ascii | w, type the content, Scope team:core, Class episodic, ctrl+s, y | A write the gate denies: the reason and the policy id verbatim, and that nothing was stored; the decision is an event in the log. |
| write-deny | [write-deny-80col.png](write-deny-80col.png) | 80x24, dark | w, type the content, Scope team:core, Class episodic, ctrl+s, y | A write the gate denies: the reason and the policy id verbatim, and that nothing was stored; the decision is an event in the log. |
| doctor | [doctor.png](doctor.png) | 120x36, dark | d, ctrl+s | Doctor: every check (log, policy, store, adapters, provider keys by name, pins, Node), failures first, each with what it means. |
| grants | [grants.png](grants.png) | 120x36, dark | r, ctrl+s, y, g, To person:sam, Expires 2026-12-01, ctrl+s, y | Grants: the selected item's grants as its owner sees them, one added as a governed change, and u to undo it. |
| events | [events.png](events.png) | 120x36, dark | e | Events: the log as the actor may see it, each decision with its reason and policy id, filters and find. |
| simulate | [simulate.png](simulate.png) | 120x36, dark | s, Workload workload.json, Candidate strict, ctrl+s | Simulate: a recorded workload replayed under the policy and a candidate on scratch logs, the totals side by side with bars, and the steps whose decision changed. |
| mcp | [mcp.png](mcp.png) | 120x36, dark | m | MCP: the configuration for Claude Code (.mcp.json) and Codex (config.toml) that runs engram mcp over this workspace, and Try it. |
| serve | [serve.png](serve.png) | 120x36, dark | h, space, space (No authentication), Port 7391, ctrl+s | Serve: who may call the server (keys, a token issuer, or no authentication on loopback), then the running server's start line and the inspector's URL. |
| help | [help.png](help.png) | 120x36, dark | ? | Help: every key the screen binds, from the key table, and where each acts. |
| palette | [palette.png](palette.png) | 120x36, dark | ; then type prom | The command palette: a fuzzy search over every command, its flags and help line, and the TUI's own actions. |
| actor | [actor.png](actor.png) | 120x36, dark | ; then type switch actor, enter | The actor switcher: the workspace panel with Acting as focused, each flag with where its value came from. |
| line | [line.png](line.png) | 120 columns, the whole transcript | `engram tui --line`, then write, the content, enter on each default, yes, quit | Line mode (8.31): sequential prompts in full sentences, the gate's preview as engram check prints it, the question, write's own output, and the session's commands on quit. |
