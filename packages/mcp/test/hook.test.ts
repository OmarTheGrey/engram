// The Claude Code PreToolUse hook (ADR 0022, plan decision 6): it blocks a
// Bash command naming a store and a file tool on a path inside a store root,
// with core's checks, records each block as one bypass_blocked event through
// the client, and answers Claude Code's deny JSON; any other call gets no
// answer and goes on.
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claudeCodeHook, hookBypass } from "../src/hook.ts";
import { NOW, testWorkspace } from "./helpers.ts";

const cwd = mkdtempSync(join(tmpdir(), "engram-hook-"));
const root = join(cwd, "memory");
mkdirSync(root);
const CLAUDE = { id: "agent:claude-code", level: "person" as const, memberships: [] };
const LOG = join(cwd, ".engram", "engram.db");
const PROTECT = [
  LOG,
  join(cwd, ".mcp.json"),
  join(cwd, ".claude", "settings.json"),
  join(cwd, ".claude", "settings.local.json"),
];
const SCOPE = { roots: [root], protect: PROTECT, cwd };

const call = (tool_name: string, tool_input: Record<string, unknown>) => ({
  hook_event_name: "PreToolUse",
  tool_name,
  tool_input,
  cwd,
});

/** A Windows admin-share spelling of a path on this machine (R3-7). */
const unc = (path: string) => `\\\\localhost\\${path[0]}$${path.slice(2)}`;

const BLOCKED: [string, Record<string, unknown>, string, string | undefined][] = [
  ["Bash", { command: "mem0 add 'x'" }, "mem0", undefined],
  ["Bash", { command: "npx letta memory list" }, "letta", undefined],
  ["Bash", { command: "node packages//cli/src/main.ts write --as person:x" }, "engram", undefined],
  ["Bash", { command: "cat memory/notes.md" }, "files", "path"],
  // R3-1: the shell check runs for PowerShell and for any case of the name.
  ["PowerShell", { command: "mem0 add x" }, "mem0", undefined],
  ["PowerShell", { command: "Get-Content memory\\a.md" }, "files", "path"],
  ["bash", { command: "letta list" }, "letta", undefined],
  ["POWERSHELL", { command: "Remove-Item -Recurse memory" }, "files", "path"],
  ["Read", { file_path: join(root, "a.md") }, "files", "path"],
  ["Write", { file_path: join(root, "b.md"), content: "x" }, "files", "path"],
  ["Edit", { file_path: "./memory/a.md", old_string: "a", new_string: "b" }, "files", "path"],
  ["Glob", { pattern: "**/*.md", path: cwd }, "files", "path"],
  ["Grep", { pattern: "freeze" }, "files", "path"],
  // R3-7: NotebookEdit's path key, a bare root name, a glob that expands to the root.
  ["NotebookEdit", { notebook_path: "memory/n.ipynb", new_source: "x" }, "files", "path"],
  ["Bash", { command: "cd memory && cat a.md" }, "files", "path"],
  ["Bash", { command: "cat memor*/a.md" }, "files", "path"],
  // A shell's script argument is a nested command (D10), unlike a commit message.
  ["Bash", { command: 'bash -c "cd memory && cat a.md"' }, "files", "path"],
  ["PowerShell", { command: 'pwsh -Command "Get-Content memory/a.md"' }, "files", "path"],
  ["Bash", { command: "cat mem?ry/a.md" }, "files", "path"],
  // R3-2: the session's own governing files.
  [
    "Edit",
    { file_path: join(cwd, ".mcp.json"), old_string: "a", new_string: "b" },
    "engram",
    "path",
  ],
  [
    "Edit",
    { file_path: ".claude/settings.json", old_string: "a", new_string: "b" },
    "engram",
    "path",
  ],
  [
    "Write",
    { file_path: join(cwd, ".claude", "settings.local.json"), content: "{}" },
    "engram",
    "path",
  ],
  ["Bash", { command: `rm ${LOG}` }, "engram", "path"],
  ["Bash", { command: "rm .engram/engram.db" }, "engram", "path"],
  ["Bash", { command: "cat .claude/settings*.json" }, "engram", "path"],
];
if (process.platform === "win32")
  BLOCKED.push(
    ["Read", { file_path: unc(join(root, "a.md")) }, "files", "path"],
    ["Bash", { command: `type ${unc(join(root, "a.md"))}` }, "files", "path"],
  );

describe("which calls the hook blocks", () => {
  it.each(BLOCKED)("%s %j is a bypass of %s", (tool, input, store, route) => {
    const found = hookBypass(call(tool, input), SCOPE);
    expect(found?.store).toBe(store);
    expect(found?.route).toBe(route);
  });

  it.each([
    ["Bash", { command: "npm test" }],
    ["PowerShell", { command: "Get-ChildItem src" }],
    ["Read", { file_path: join(cwd, "README.md") }],
    ["Write", { file_path: join(cwd, "src.ts"), content: "see memory/notes.md" }],
    ["Bash", { command: "ls *.ts" }],
    ["mcp__engram__memory_write", { scope: "person:dana", content: "./memory/x" }],
  ])("%s %j goes on", (tool, input) => {
    expect(hookBypass(call(tool, input), SCOPE)).toBeUndefined();
  });
});

describe("claudeCodeHook", () => {
  it.each([
    null,
    [],
    "Bash",
    42,
    { tool_name: 7 },
    { tool_name: "Bash", tool_input: null },
    { tool_name: "Bash", tool_input: [] },
  ])("denies input that is not a PreToolUse object: %j (R3-6)", async (input) => {
    const ws = await testWorkspace();
    const answer = await claudeCodeHook(input, {
      ...SCOPE,
      client: ws.client,
      actor: CLAUDE,
      now: () => NOW,
    });
    expect(answer?.hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("records a block as one bypass_blocked event and answers deny with its reason", async () => {
    const ws = await testWorkspace();
    const before = ws.workspace.plane.events().length;
    const answer = await claudeCodeHook(call("Bash", { command: "mem0 delete --all" }), {
      client: ws.client,
      actor: CLAUDE,
      ...SCOPE,
      cwd,
      now: () => NOW,
    });
    const events = ws.workspace.plane.events().slice(before);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      op: "bypass_blocked",
      decision: "deny",
      actor: "agent:claude-code",
      policy_id: "engram/bypass/store-command",
    });
    expect(answer).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `engram: ${events[0]?.reason} (engram/bypass/store-command)`,
      },
    });
  });

  it("answers nothing for a call that is no bypass, and records nothing", async () => {
    const ws = await testWorkspace();
    const before = ws.workspace.plane.events().length;
    const answer = await claudeCodeHook(call("Bash", { command: "git status" }), {
      client: ws.client,
      actor: CLAUDE,
      ...SCOPE,
      cwd,
      now: () => NOW,
    });
    expect(answer).toBeNull();
    expect(ws.workspace.plane.events()).toHaveLength(before);
  });

  it("still denies when the block cannot be recorded", async () => {
    const ws = await testWorkspace();
    const broken = {
      ...ws.client,
      POST: () => Promise.reject(new Error("connection refused")),
    } as unknown as typeof ws.client;
    const answer = await claudeCodeHook(call("Read", { file_path: join(root, "a.md") }), {
      client: broken,
      actor: CLAUDE,
      ...SCOPE,
      cwd,
      now: () => NOW,
    });
    expect(answer?.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(answer?.hookSpecificOutput.permissionDecisionReason).toContain("could not be recorded");
  });
});
