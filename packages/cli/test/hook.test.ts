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

  it.each([
    ["garbage", "{nope"],
    ["null", "null"],
    ["an array", "[]"],
    ["a string", '"Bash"'],
    ["a tool_input that is not an object", '{"tool_name":"Bash","tool_input":null}'],
  ])("denies input that is %s, with exit 0 (R3-6)", async (_what, text) => {
    const r = await cli(["hook", "claude-code", "--db", ":memory:"], { stdin: stdin(text) });
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("denies edits of .mcp.json, .claude/settings.json and the log, and rm of the log (R3-2)", async () => {
    const dir = await tempDir();
    const home = await tempDir();
    const log = join(home, ".engram", "engram.db");
    const run = (tool_name: string, tool_input: Record<string, unknown>) =>
      cli(["hook", "claude-code", "--root", "memory"], {
        cwd: dir,
        home,
        stdin: stdin({ tool_name, tool_input, cwd: dir }),
      });
    const cases: [string, Record<string, unknown>][] = [
      ["Edit", { file_path: join(dir, ".mcp.json"), old_string: "a", new_string: "b" }],
      ["Edit", { file_path: ".claude/settings.json", old_string: "a", new_string: "b" }],
      ["Write", { file_path: log, content: "" }],
      ["Bash", { command: `rm ${log}` }],
      ["Bash", { command: `rm ${log}-wal` }],
    ];
    for (const [tool, input] of cases) {
      const r = await run(tool, input);
      expect(r.code).toBe(0);
      expect(JSON.parse(r.out).hookSpecificOutput.permissionDecisionReason).toContain(
        "store engram",
      );
    }
    expect(logEvents(log).filter((e) => e.op === "bypass_blocked")).toHaveLength(cases.length);
  });

  it("denies removing or moving a folder that holds a protected file, and the user's settings (R3-13, R3-14)", async () => {
    const dir = await tempDir();
    const home = await tempDir();
    const run = (tool_name: string, tool_input: Record<string, unknown>) =>
      cli(["hook", "claude-code", "--root", "memory"], {
        cwd: dir,
        home,
        stdin: stdin({ tool_name, tool_input, cwd: dir }),
      });
    const denied: [string, Record<string, unknown>][] = [
      ["Bash", { command: "rm -rf ~/.engram" }],
      ["Bash", { command: `rm -rf ${join(home, ".engram")}` }],
      ["Bash", { command: "rm -rf .claude" }],
      ["Bash", { command: "mv .claude x" }],
      ["PowerShell", { command: "Remove-Item -Recurse .claude" }],
      ["Edit", { file_path: "~/.claude/settings.json", old_string: "a", new_string: "b" }],
      ["Write", { file_path: join(home, ".claude", "settings.local.json"), content: "{}" }],
      ["Bash", { command: "rm ~/.claude.json" }],
      ["Bash", { command: "rm -rf ~/.claude" }],
    ];
    for (const [tool, input] of denied) {
      const r = await run(tool, input);
      expect([tool, input, r.code, r.out]).toEqual([
        tool,
        input,
        0,
        expect.stringContaining('"deny"'),
      ]);
    }
    // The project and the home folders themselves are not hits, nor are unrelated folders.
    for (const command of ["ls", "rm -rf build", "ls ~", "cat README.md"]) {
      const r = await run("Bash", { command });
      expect([command, r.out]).toEqual([command, ""]);
    }
  });

  it("resolves --root and --db against $CLAUDE_PROJECT_DIR, not its own cwd (R3-10)", async () => {
    const project = await tempDir();
    await mkdir(join(project, "memory"));
    const elsewhere = await tempDir();
    const r = await cli(["hook", "claude-code", "--root", "memory", "--db", "log.db"], {
      cwd: elsewhere,
      env: { CLAUDE_PROJECT_DIR: project },
      stdin: stdin({
        tool_name: "Read",
        tool_input: { file_path: join(project, "memory", "a.md") },
      }),
    });
    expect(JSON.parse(r.out).hookSpecificOutput.permissionDecisionReason).toContain("store files");
    expect(logEvents(join(project, "log.db"))).toHaveLength(1);
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
