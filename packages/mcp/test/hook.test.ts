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

const call = (tool_name: string, tool_input: Record<string, unknown>) => ({
  hook_event_name: "PreToolUse",
  tool_name,
  tool_input,
  cwd,
});

describe("which calls the hook blocks", () => {
  it.each([
    ["Bash", { command: "mem0 add 'x'" }, "mem0", undefined],
    ["Bash", { command: "npx letta memory list" }, "letta", undefined],
    [
      "Bash",
      { command: "node packages//cli/src/main.ts write --as person:x" },
      "engram",
      undefined,
    ],
    ["Bash", { command: "cat memory/notes.md" }, "files", "path"],
    ["Read", { file_path: join(root, "a.md") }, "files", "path"],
    ["Write", { file_path: join(root, "b.md"), content: "x" }, "files", "path"],
    ["Edit", { file_path: "./memory/a.md", old_string: "a", new_string: "b" }, "files", "path"],
    ["Glob", { pattern: "**/*.md", path: cwd }, "files", "path"],
    ["Grep", { pattern: "freeze" }, "files", "path"],
  ])("%s %j is a bypass of %s", (tool, input, store, route) => {
    const found = hookBypass(call(tool, input), [root], cwd);
    expect(found?.store).toBe(store);
    expect(found?.route).toBe(route);
  });

  it.each([
    ["Bash", { command: "npm test" }],
    ["Read", { file_path: join(cwd, "README.md") }],
    ["Write", { file_path: join(cwd, "src.ts"), content: "see memory/notes.md" }],
    ["mcp__engram__memory_write", { scope: "person:dana", content: "./memory/x" }],
  ])("%s %j goes on", (tool, input) => {
    expect(hookBypass(call(tool, input), [root], cwd)).toBeUndefined();
  });
});

describe("claudeCodeHook", () => {
  it("records a block as one bypass_blocked event and answers deny with its reason", async () => {
    const ws = await testWorkspace();
    const before = ws.workspace.plane.events().length;
    const answer = await claudeCodeHook(call("Bash", { command: "mem0 delete --all" }), {
      client: ws.client,
      actor: CLAUDE,
      roots: [root],
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
      roots: [root],
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
      roots: [root],
      cwd,
      now: () => NOW,
    });
    expect(answer?.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(answer?.hookSpecificOutput.permissionDecisionReason).toContain("could not be recorded");
  });
});
