// The Codex PreToolUse hook (card E8.17, ADR 0022's amendment): the same core
// checks and deny shape as the Claude Code hook, read as Codex sends a call
// (its Bash tool checked as POSIX and PowerShell, apply_patch by its file
// headers), every recorded input valid against Codex's copied input schema
// and every answer against its output schema.
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codexHook, codexHookBypass, hookBypass, patchPaths } from "../src/hook.ts";
import { codexInputs, inputErrors, outputErrors } from "./codex-schema.ts";
import { testWorkspace } from "./helpers.ts";

const cwd = mkdtempSync(join(tmpdir(), "engram-codex-hook-"));
const root = join(cwd, "memory");
mkdirSync(root);
const CODEX = { id: "agent:codex", level: "person" as const, memberships: [] };
const PROTECT = [
  join(cwd, ".engram", "engram.db"),
  join(cwd, ".codex", "config.toml"),
  join(cwd, ".codex", "hooks.json"),
];
const SCOPE = { roots: [root], protect: PROTECT, cwd, below: [cwd] };

/** A call as Codex sends it: every field its input schema requires. */
const call = (tool_name: string, tool_input: Record<string, unknown>) => ({
  session_id: "s",
  turn_id: "t",
  transcript_path: null,
  cwd,
  hook_event_name: "PreToolUse",
  model: "gpt-5.5-codex",
  permission_mode: "default",
  tool_name,
  tool_input,
  tool_use_id: "call_1",
});

const patch = (...lines: string[]) => ["*** Begin Patch", ...lines, "*** End Patch", ""].join("\n");

describe("the recorded Codex inputs (fixtures/harness/codex/inputs)", () => {
  const inputs = codexInputs(cwd);

  it("are each valid against Codex's input schema, and cover a deny and a pass-through", () => {
    expect(inputs.length).toBeGreaterThanOrEqual(6);
    for (const { name, input } of inputs) expect(inputErrors(input), name).toEqual([]);
    expect(new Set(inputs.map((i) => i.expect))).toEqual(new Set(["deny", "nothing"]));
  });

  it.each(codexInputs(cwd))("$name: $expect", async ({ input, expect: want }) => {
    const ws = await testWorkspace();
    const answer = await codexHook(input, { ...SCOPE, client: ws.client, actor: CODEX });
    if (want === "nothing") expect(answer).toBeNull();
    else {
      expect(answer?.hookSpecificOutput.permissionDecision).toBe("deny");
      expect(outputErrors(answer)).toEqual([]);
    }
  });
});

describe("which Codex calls the hook blocks", () => {
  it.each([
    ["Bash", { command: "mem0 add x" }, "mem0"],
    ["Bash", { command: "cat memory/a.md" }, "files"],
    // Codex's Bash runs PowerShell on Windows: a backslash path is read as one.
    ["Bash", { command: "Get-Content memory\\a.md" }, "files"],
    ["Bash", { command: "Remove-Item -Recurse memory" }, "files"],
    ["apply_patch", { command: patch("*** Update File: memory/a.md", "@@", "-a", "+b") }, "files"],
    [
      "apply_patch",
      { command: patch("*** Add File: src/x.ts", "+x", "*** Delete File: memory/b.md") },
      "files",
    ],
    [
      "apply_patch",
      { command: patch("*** Update File: notes.md", "*** Move to: memory/c.md") },
      "files",
    ],
    ["apply_patch", { command: patch(`*** Add File: ${join(root, "d.md")}`, "+x") }, "files"],
    [
      "apply_patch",
      { command: patch("*** Update File: .codex/hooks.json", "@@", "-a", "+b") },
      "engram",
    ],
    // Codex trims each line before it reads a header (codex-rs/apply-patch/src/streaming_parser.rs).
    ["apply_patch", { command: patch("  *** Add File: memory/x.md", "+hi") }, "files"],
    ["apply_patch", { command: patch("\t*** Delete File: .codex/hooks.json") }, "engram"],
    [
      "apply_patch",
      { command: patch("*** Update File: a.md", "  *** Move to: memory/y.md") },
      "files",
    ],
    // A patch applied through the shell names its files in the heredoc.
    [
      "Bash",
      { command: `apply_patch <<'EOF'\n${patch("*** Update File: notes/../memory/e.md")}EOF` },
      "files",
    ],
    ["Bash", { command: "rm .codex/config.toml" }, "engram"],
    // Card E8.17's review: PowerShell's backtick escape inside a path word.
    ["Bash", { command: "Get-Content mem`ory\\a.md" }, "files"],
    ["Bash", { command: 'Get-Content "mem`ory\\a.md"' }, "files"],
    ["Bash", { command: "Remove-Item .co`dex\\hooks.json" }, "engram"],
    // An MCP tool of another server: its path arguments are checked.
    ["mcp__fs__read_file", { path: join(root, "a.md") }, "files"],
  ])("%s %j is a bypass of %s", (tool, input, store) => {
    expect(codexHookBypass(call(tool, input), SCOPE)?.store).toBe(store);
  });

  it.each([
    ["Bash", { command: "git status" }],
    ["Bash", { command: "Get-ChildItem src" }],
    [
      "apply_patch",
      { command: patch("*** Update File: src/a.ts", "@@", "-memory", "+memory/x.md") },
    ],
    ["apply_patch", { command: "no patch at all" }],
    ["mcp__engram__memory_write", { scope: "person:dana", content: "./memory/x" }],
    ["spawn_agent", { message: "summarise memory use" }],
  ])("%s %j goes on", (tool, input) => {
    expect(codexHookBypass(call(tool, input), SCOPE)).toBeUndefined();
  });

  it("blocks a patch into a store that Claude Code's reading of the same call lets through", () => {
    // The patch is one multi-line string under `command`: no path argument to Claude Code's check.
    const input = call("apply_patch", { command: patch("*** Update File: memory/a.md", "@@") });
    expect(hookBypass(input as never, SCOPE)).toBeUndefined();
    expect(codexHookBypass(input as never, SCOPE)?.store).toBe("files");
  });

  it("reads the file headers of a patch and nothing else", () => {
    expect(
      patchPaths(
        patch(
          "*** Add File: a.md",
          "+*** Update File: not/a/header",
          "*** Update File: b.md",
          "*** Move to: c.md",
        ),
      ),
    ).toEqual(["a.md", "b.md", "c.md"]);
  });
});

describe("codexHook", () => {
  it.each([
    null,
    [],
    "Bash",
    { tool_name: 7 },
    { tool_name: "Bash", tool_input: [] },
    { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "ls" } },
  ])("denies input that is not a PreToolUse object: %j", async (input) => {
    const ws = await testWorkspace();
    const answer = await codexHook(input, { ...SCOPE, client: ws.client, actor: CODEX });
    expect(answer?.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(outputErrors(answer)).toEqual([]);
  });

  it("reads a null tool_input, which Codex's schema allows, as no arguments", async () => {
    const ws = await testWorkspace();
    const input = { ...call("mcp__other__ping", {}), tool_input: null };
    expect(inputErrors(input)).toEqual([]);
    expect(await codexHook(input, { ...SCOPE, client: ws.client, actor: CODEX })).toBeNull();
  });

  it("records a block as one bypass_blocked event as agent:codex and answers Codex's deny", async () => {
    const ws = await testWorkspace();
    const before = ws.workspace.plane.events().length;
    const answer = await codexHook(call("Bash", { command: "letta memory list" }), {
      ...SCOPE,
      client: ws.client,
      actor: CODEX,
    });
    const events = ws.workspace.plane.events().slice(before);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      op: "bypass_blocked",
      decision: "deny",
      actor: "agent:codex",
      policy_id: "engram/bypass/store-command",
    });
    expect(answer).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `engram: ${events[0]?.reason} (engram/bypass/store-command)`,
      },
    });
    expect(outputErrors(answer)).toEqual([]);
  });

  it("answers nothing, and records nothing, for a call that reaches no store", async () => {
    const ws = await testWorkspace();
    const before = ws.workspace.plane.events().length;
    expect(
      await codexHook(call("Bash", { command: "npm test" }), {
        ...SCOPE,
        client: ws.client,
        actor: CODEX,
      }),
    ).toBeNull();
    expect(ws.workspace.plane.events().length).toBe(before);
  });
});
