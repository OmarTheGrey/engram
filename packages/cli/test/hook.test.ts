// `engram hook claude-code` as Claude Code runs it: the PreToolUse JSON on
// stdin, a deny on stdout for a bypass (recorded in the log), nothing for any
// other call, exit 0 either way; and `engram mcp`'s flag checks.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { cli, logEvents, tempDir } from "./helpers.ts";

const stdin = (value: unknown) =>
  Readable.from([typeof value === "string" ? value : JSON.stringify(value)]);

describe("engram hook claude-code", () => {
  it("denies a Bash command naming a store and records the block in the log", async () => {
    const dir = await tempDir();
    const db = join(dir, "engram.db");
    const r = await cli(["hook", "claude-code", "--db", db], {
      cwd: dir,
      stdin: stdin({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "mem0 add 'Dana likes tea'" },
        cwd: dir,
      }),
    });
    expect(r.code).toBe(0);
    const out = JSON.parse(r.out);
    expect(out.hookSpecificOutput).toMatchObject({
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
    });
    expect(out.hookSpecificOutput.permissionDecisionReason).toContain(
      "(engram/bypass/store-command)",
    );
    const events = logEvents(db);
    expect(events.map((e) => [e.op, e.actor, e.policy_id])).toEqual([
      ["bypass_blocked", "agent:claude-code", "engram/bypass/store-command"],
    ]);
  });

  it("denies a file tool inside a --root and lets one outside it go on", async () => {
    const dir = await tempDir();
    await mkdir(join(dir, "memory"));
    const db = join(dir, "engram.db");
    const run = (file_path: string) =>
      cli(["hook", "claude-code", "--root", "memory", "--db", db], {
        cwd: dir,
        stdin: stdin({ tool_name: "Read", tool_input: { file_path }, cwd: dir }),
      });
    const inside = await run(join(dir, "memory", "a.md"));
    expect(JSON.parse(inside.out).hookSpecificOutput.permissionDecisionReason).toContain(
      "(engram/bypass/store-path)",
    );
    const outside = await run(join(dir, "README.md"));
    expect(outside.code).toBe(0);
    expect(outside.out).toBe("");
  });

  it("denies input it cannot read", async () => {
    const r = await cli(["hook", "claude-code", "--db", ":memory:"], { stdin: stdin("{nope") });
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("still denies a bypass when the log cannot be opened, and lets other calls go on", async () => {
    const dir = await tempDir();
    const notALog = join(dir, "x.db");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(notALog, "not sqlite");
    const blocked = await cli(["hook", "claude-code", "--db", notALog], {
      stdin: stdin({ tool_name: "Bash", tool_input: { command: "letta list" }, cwd: dir }),
    });
    expect(blocked.code).toBe(0);
    expect(JSON.parse(blocked.out).hookSpecificOutput.permissionDecisionReason).toContain(
      "could not be recorded",
    );
    const free = await cli(["hook", "claude-code", "--db", notALog], {
      stdin: stdin({ tool_name: "Bash", tool_input: { command: "ls" }, cwd: dir }),
    });
    expect(free.out).toBe("");
  });

  it("names the harnesses it knows", async () => {
    const r = await cli(["hook", "cursor"], { stdin: stdin("{}") });
    expect(r.code).toBe(2);
    expect(r.err).toContain("engram hook claude-code");
  });
});

describe("engram mcp flags", () => {
  it("needs the actor it acts as", async () => {
    const r = await cli(["mcp", "--db", ":memory:"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("--as");
  });

  it("refuses an --http value that is not a port", async () => {
    const r = await cli(["mcp", "--as", "person:dana", "--http", "eighty"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("--http eighty is not a port number");
  });
});
