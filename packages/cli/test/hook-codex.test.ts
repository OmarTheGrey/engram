// `engram hook codex` as Codex runs it (card E8.17): Codex's PreToolUse JSON
// on stdin, in the folder Codex starts the hook in; a deny on stdout, valid
// against Codex's copied output schema and recorded in the log as
// agent:codex, for a bypass; nothing for any other call; exit 0 either way.
// The inputs are the recorded ones of fixtures/harness/codex/inputs, never a
// real ~/.codex: the home and CODEX_HOME are temporary folders.
import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { CODEX_FIXTURE, codexInputs, outputErrors } from "../../mcp/test/codex-schema.ts";
import { cli, logEvents, tempDir } from "./helpers.ts";

const stdin = (value: unknown) =>
  Readable.from([typeof value === "string" ? value : JSON.stringify(value)]);

/** A copy of the Codex fixture project, with a home of its own. */
async function project() {
  const dir = await tempDir();
  await cp(CODEX_FIXTURE, dir, { recursive: true });
  return { dir, home: await tempDir() };
}

const input = (cwd: string, tool_name: string, tool_input: Record<string, unknown>) => ({
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

describe("engram hook codex", () => {
  it("answers each recorded input as expected, a deny in Codex's output schema, recorded as agent:codex", async () => {
    const { dir, home } = await project();
    const db = join(home, "engram.db");
    let denied = 0;
    for (const { name, input: call, expect: want } of codexInputs(dir)) {
      const r = await cli(["hook", "codex", "--root", "memory", "--db", db], {
        cwd: dir,
        home,
        stdin: stdin(call),
      });
      expect(r.code, name).toBe(0);
      if (want === "nothing") expect(r.out, name).toBe("");
      else {
        const out = JSON.parse(r.out);
        expect(out.hookSpecificOutput.permissionDecision, name).toBe("deny");
        expect(outputErrors(out), name).toEqual([]);
        denied++;
      }
    }
    const events = logEvents(db);
    expect(events).toHaveLength(denied);
    expect(new Set(events.map((e) => [e.op, e.actor].join(" ")))).toEqual(
      new Set(["bypass_blocked agent:codex"]),
    );
  });

  it("resolves --root against the folder Codex starts it in, not the call's cwd", async () => {
    const { dir, home } = await project();
    await mkdir(join(dir, "src"));
    // The tool runs in src/, the hook in the project: memory/ is the project's.
    const r = await cli(["hook", "codex", "--root", "memory", "--db", ":memory:"], {
      cwd: dir,
      home,
      stdin: stdin(
        input(join(dir, "src"), "Bash", { command: `cat ${join(dir, "memory", "user_role.md")}` }),
      ),
    });
    expect(JSON.parse(r.out).hookSpecificOutput.permissionDecisionReason).toContain(
      "(engram/bypass/store-path)",
    );
  });

  it("guards Codex's own config and hooks, the project's and $CODEX_HOME's, and the log", async () => {
    const { dir, home } = await project();
    const codexHome = await tempDir();
    const run = (command: string) =>
      cli(["hook", "codex", "--root", "memory"], {
        cwd: dir,
        home,
        env: { CODEX_HOME: codexHome },
        stdin: stdin(input(dir, "Bash", { command })),
      });
    for (const command of [
      "rm .codex/hooks.json",
      "echo x > .codex/config.toml",
      "rm -rf .codex",
      `rm ${join(codexHome, "hooks.json")}`,
      `cat ${join(codexHome, "config.toml")}`,
      `rm ${join(home, ".engram", "engram.db")}`,
    ]) {
      const r = await run(command);
      expect(JSON.parse(r.out).hookSpecificOutput.permissionDecision, command).toBe("deny");
    }
    const free = await run("ls src");
    expect(free.out).toBe("");
  });

  it("records the block as the --as actor, and denies input that is not Codex's PreToolUse", async () => {
    const { dir, home } = await project();
    const db = join(home, "engram.db");
    await cli(["hook", "codex", "--as", "person:dana", "--db", db], {
      cwd: dir,
      home,
      stdin: stdin(input(dir, "Bash", { command: "letta list" })),
    });
    expect(logEvents(db).map((e) => e.actor)).toEqual(["person:dana"]);
    for (const text of ["{nope", "null", '{"hook_event_name":"Stop","tool_name":"Bash"}']) {
      const r = await cli(["hook", "codex", "--db", ":memory:"], {
        cwd: dir,
        home,
        stdin: stdin(text),
      });
      expect(r.code).toBe(0);
      expect(JSON.parse(r.out).hookSpecificOutput.permissionDecision, text).toBe("deny");
    }
  });

  it("names both harnesses and install when the harness is unknown", async () => {
    const r = await cli(["hook", "cursor"], { stdin: stdin("{}") });
    expect(r.code).toBe(2);
    expect(r.err).toContain("engram hook claude-code | codex | install");
  });
});
