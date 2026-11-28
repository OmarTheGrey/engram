// Layer 6 (docs/conventions/testing.md), card E8.4: the MCP handshake from a
// Claude Code project and a Codex config (fixtures/harness/), each launching
// `engram mcp` as the harness would (with `engram` replaced by the CLI's entry
// script), then initialize, list tools, write, read, and explain on that read;
// and the Claude Code project's PreToolUse hook, run as Claude Code runs it.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { codexInputs, inputErrors, outputErrors } from "../../packages/mcp/test/codex-schema.ts";
import { handshake } from "../../packages/mcp/test/handshake.ts";

const REPO = resolve(fileURLToPath(import.meta.url), "../../..");
const MAIN = join(REPO, "packages/cli/src/main.ts");
const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/**
 * A copy of a harness fixture in a temporary folder, with a home of its own
 * outside it (the log is the per-user default, decision D9), and the
 * project directory Claude Code exports to hooks.
 */
function project(name: string) {
  const dir = mkdtempSync(join(tmpdir(), `engram-e2e-${name}-`));
  const home = mkdtempSync(join(tmpdir(), `engram-e2e-${name}-home-`));
  dirs.push(dir, home);
  cpSync(join(REPO, "fixtures/harness", name), dir, { recursive: true });
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    HOME: home,
    USERPROFILE: home,
    CLAUDE_PROJECT_DIR: dir,
  };
  delete env.ENGRAM_DB_URL;
  // Card E8.17: the Codex home is the temporary home's, never the developer's.
  env.CODEX_HOME = join(home, ".codex");
  delete env.ENGRAM_SERVER_URL;
  return { dir, home, env, log: join(home, ".engram", "engram.db") };
}

/** Claude Code's path placeholder, as it substitutes it in exec form (a literal, not a template). */
const PROJECT_DIR = ["$", "{CLAUDE_PROJECT_DIR}"].join("");
const placeholders = (args: string[], dir: string) =>
  args.map((a) => a.replaceAll(PROJECT_DIR, dir));

/** `engram ...` as the harness names it, run through node and the CLI's entry script. */
function launch(command: string, args: string[]): [string, string[]] {
  expect(command).toBe("engram");
  return [process.execPath, [MAIN, ...args]];
}

/** The [mcp_servers.engram] table of a Codex config: its command and args. */
function codexServer(toml: string): { command: string; args: string[] } {
  const table = toml.split(/^\[mcp_servers\.engram\]\s*$/m)[1]?.split(/^\[/m)[0] ?? "";
  const command = /^command\s*=\s*"([^"]*)"/m.exec(table)?.[1] ?? "";
  const args = JSON.parse(/^args\s*=\s*(\[.*\])\s*$/m.exec(table)?.[1] ?? "[]") as string[];
  return { command, args };
}

const harnesses = [
  {
    name: "claude-code",
    server: (dir: string) =>
      JSON.parse(readFileSync(join(dir, ".mcp.json"), "utf8")).mcpServers.engram as {
        command: string;
        args: string[];
      },
  },
  {
    name: "codex",
    server: (dir: string) => codexServer(readFileSync(join(dir, "config.toml"), "utf8")),
  },
];

describe.each(harnesses)("the MCP handshake from the $name fixture", ({ name, server }) => {
  it("initializes, lists the four tools, writes, reads, and explains the read", async () => {
    const { dir, env, log } = project(name);
    const config = server(dir);
    const [command, args] = launch(config.command, config.args);
    const content = `The ${name} release freeze starts on Friday.`;
    const h = await handshake(command, args, dir, env, content);
    expect(h.server?.name).toBe("engram");
    expect(h.tools).toEqual(["memory_write", "memory_read", "memory_explain", "memory_simulate"]);
    expect(h.write).toEqual({
      text: expect.stringMatching(/^stored \S+ in person:dana as active$/),
      isError: false,
    });
    expect(h.read).toContain(content);
    expect(h.readId).not.toBe("");
    expect(h.explanations.length).toBeGreaterThan(0);
    expect(h.explanations[0]).toMatchObject({ rank: 1 });
    // The write landed in the project's memory folder, beside the adopted file.
    expect(readdirSync(join(dir, "memory")).length).toBeGreaterThan(1);
    // The log is outside the project, in the home (decision D9, review finding R3-2).
    expect(existsSync(log)).toBe(true);
    expect(existsSync(join(dir, ".engram"))).toBe(false);
  });
});

describe("the claude-code fixture's PreToolUse hook", () => {
  it("denies a store command, a read inside memory/ and edits of its own config, and lets other calls go on", () => {
    const { dir, env } = project("claude-code");
    const settings = JSON.parse(readFileSync(join(dir, ".claude/settings.json"), "utf8"));
    const hook = settings.hooks.PreToolUse[0];
    // Every tool reaches the hook (PowerShell included, review finding R3-1); core decides.
    expect(hook.matcher).toBe("*");
    const [command, args] = launch(hook.hooks[0].command, placeholders(hook.hooks[0].args, dir));
    const run = (input: object) =>
      spawnSync(command, args, {
        cwd: dir,
        env,
        input: JSON.stringify(input),
        encoding: "utf8",
        timeout: 60_000,
      });
    const store = run({
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "mem0 add x" },
      cwd: dir,
    });
    expect(store.status).toBe(0);
    expect(JSON.parse(store.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
    const file = run({
      hook_event_name: "PreToolUse",
      tool_name: "Read",
      tool_input: { file_path: join(dir, "memory", "user_role.md") },
      cwd: dir,
    });
    expect(JSON.parse(file.stdout).hookSpecificOutput.permissionDecisionReason).toContain(
      "engram/bypass/store-path",
    );
    const powershell = run({
      hook_event_name: "PreToolUse",
      tool_name: "PowerShell",
      tool_input: { command: "Remove-Item memory -Recurse" },
      cwd: dir,
    });
    expect(JSON.parse(powershell.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
    for (const file_path of [join(dir, ".mcp.json"), join(dir, ".claude", "settings.json")]) {
      const edit = run({
        hook_event_name: "PreToolUse",
        tool_name: "Edit",
        tool_input: { file_path, old_string: "dana", new_string: "boss" },
        cwd: dir,
      });
      expect(JSON.parse(edit.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
    }
    const free = run({
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "git status" },
      cwd: dir,
    });
    expect(free.status).toBe(0);
    expect(free.stdout).toBe("");
  });
});

// Card E8.17: Codex's hook, run as Codex runs it: the command line of the
// fixture's .codex/hooks.json in the session's folder, each recorded input
// (valid against Codex's copied input schema) on stdin, every answer valid
// against its output schema; and the installer writing the same entry.
describe("the codex fixture's PreToolUse hook", () => {
  it("answers every recorded Codex input as expected, in Codex's output schema, and records each block", () => {
    const { dir, env, log } = project("codex");
    const hooks = JSON.parse(readFileSync(join(dir, ".codex/hooks.json"), "utf8"));
    const group = hooks.hooks.PreToolUse[0];
    expect(group.matcher).toBe("*");
    const entry = group.hooks[0];
    expect(entry).toMatchObject({ type: "command", onFailure: "block" });
    // A plain line of bare words: what `sh -lc` and `cmd.exe /c` both read as these words.
    const [first, ...words] = (entry.command as string).split(" ");
    const [command, args] = launch(first as string, words);
    let denied = 0;
    for (const { name, input, expect: want } of codexInputs(dir)) {
      expect(inputErrors(input), name).toEqual([]);
      const r = spawnSync(command, args, {
        cwd: dir,
        env,
        input: JSON.stringify(input),
        encoding: "utf8",
        timeout: 60_000,
      });
      expect(r.status, `${name}: ${r.stderr}`).toBe(0);
      if (want === "nothing") expect(r.stdout, name).toBe("");
      else {
        const out = JSON.parse(r.stdout);
        expect(outputErrors(out), name).toEqual([]);
        expect(out.hookSpecificOutput.permissionDecision, name).toBe("deny");
        denied++;
      }
    }
    expect(denied).toBeGreaterThan(0);
    expect(existsSync(log)).toBe(true);
  });

  it("engram hook install codex replaces it with an entry of the same shape, and a second install changes nothing", () => {
    const { dir, env } = project("codex");
    const install = () =>
      spawnSync(
        process.execPath,
        [MAIN, "hook", "install", "codex", "--root", "memory", "--as", "person:dana"],
        { cwd: dir, env, encoding: "utf8", timeout: 60_000 },
      );
    const first = install();
    expect(first.status, first.stderr).toBe(0);
    const file = join(dir, ".codex/hooks.json");
    const written = readFileSync(file, "utf8");
    const entry = JSON.parse(written).hooks.PreToolUse[0].hooks[0];
    expect(JSON.parse(written).hooks.PreToolUse).toHaveLength(1);
    expect(entry.command).toContain("hook codex --root");
    expect(entry.command).toContain("--as person:dana");
    // The fixture's shape: one group on every tool, one command handler that blocks on failure.
    const fixture = JSON.parse(
      readFileSync(join(REPO, "fixtures/harness/codex/.codex/hooks.json"), "utf8"),
    );
    expect(Object.keys(JSON.parse(written).hooks)).toEqual(Object.keys(fixture.hooks));
    expect(JSON.parse(written).hooks.PreToolUse[0].matcher).toBe(
      fixture.hooks.PreToolUse[0].matcher,
    );
    expect(
      Object.keys(entry)
        .filter((k) => k !== "commandWindows")
        .sort(),
    ).toEqual(Object.keys(fixture.hooks.PreToolUse[0].hooks[0]).sort());
    expect(entry.onFailure).toBe("block");
    const second = install();
    expect(second.stdout).toContain("unchanged:");
    expect(readFileSync(file, "utf8")).toBe(written);
  });
});
