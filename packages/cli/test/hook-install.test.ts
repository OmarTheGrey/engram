// `engram hook install claude-code|codex` (card E8.17): merges the hook's
// PreToolUse entry into the one settings file the harness reads. It writes
// that file (and its folder), and one backup of a file it changes, nothing
// else; a second run writes nothing; an earlier engram entry is replaced,
// never duplicated; every other key and hook is kept; a file it cannot read
// safely is refused, untouched. Every home and CODEX_HOME here is a
// temporary folder; the Codex project is a copy of fixtures/harness/codex.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { CODEX_FIXTURE } from "../../mcp/test/codex-schema.ts";
import { backupPath, hookEntry, isOwnHandler, mergeEntry } from "../src/hook-install.ts";
import { cli, tempDir } from "./helpers.ts";

/** Every file under `dir` with its bytes, by relative path: what a run may change. */
function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[relative(dir, p).replaceAll("\\", "/")] = readFileSync(p, "utf8");
    }
  };
  walk(dir);
  return out;
}

const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const LAUNCH = { command: "engram", prefix: [], note: undefined };

describe("engram hook install codex", () => {
  it("creates .codex/hooks.json in a project without one, and a second run writes nothing", async () => {
    const dir = await tempDir();
    const home = await tempDir();
    await mkdir(join(dir, "memory"));
    const first = await cli(["hook", "install", "codex", "--root", "memory"], { cwd: dir, home });
    expect(first.code, first.err).toBe(0);
    expect(first.out).toContain("installed:");
    expect(first.out).toContain("/hooks");
    const file = join(dir, ".codex", "hooks.json");
    const written = json(file);
    expect(written.hooks.PreToolUse).toHaveLength(1);
    const [group] = written.hooks.PreToolUse;
    expect(group.matcher).toBe("*");
    expect(group.hooks).toHaveLength(1);
    expect(group.hooks[0]).toMatchObject({ type: "command", onFailure: "block" });
    expect(group.hooks[0].command).toContain("hook codex --root");
    // The root is written absolute: Codex starts the hook in the session's folder.
    expect(group.hooks[0].command).toContain(join(dir, "memory"));
    const after = tree(dir);
    expect(Object.keys(after)).toEqual([".codex/hooks.json"]);
    const homeAfter = tree(home);
    expect(homeAfter).toEqual({});

    const second = await cli(["hook", "install", "codex", "--root", "memory"], { cwd: dir, home });
    expect(second.code).toBe(0);
    expect(second.out).toContain("unchanged:");
    expect(tree(dir)).toEqual(after);
  });

  it("merges into the fixture's hooks.json: the earlier entry replaced, other hooks and keys kept, one backup", async () => {
    const dir = await tempDir();
    await cp(CODEX_FIXTURE, dir, { recursive: true });
    const file = join(dir, ".codex", "hooks.json");
    const fixture = readFileSync(file, "utf8");
    // The user's own hooks beside ours, and a key the installer does not know.
    const mine = json(file);
    mine.description = "team hooks";
    mine.hooks.PreToolUse.push({
      matcher: "Bash",
      hooks: [{ type: "command", command: "audit.sh" }],
    });
    mine.hooks.Stop = [{ hooks: [{ type: "command", command: "notify.sh" }] }];
    const before = `${JSON.stringify(mine, null, 4)}\n`;
    writeFileSync(file, before);
    const others = tree(dir);
    delete others[".codex/hooks.json"];

    const r = await cli(["hook", "install", "codex", "--root", "memory", "--as", "person:dana"], {
      cwd: dir,
      home: await tempDir(),
    });
    expect(r.code, r.err).toBe(0);
    expect(r.out).toContain("replaced 1 earlier engram hook codex entry");
    const next = json(file);
    expect(next.description).toBe("team hooks");
    expect(next.hooks.Stop).toEqual(mine.hooks.Stop);
    expect(next.hooks.PreToolUse).toHaveLength(2);
    // Ours stands where the fixture's stood; the user's Bash hook is untouched.
    expect(next.hooks.PreToolUse[0].hooks[0].command).toContain("person:dana");
    expect(next.hooks.PreToolUse[1]).toEqual(mine.hooks.PreToolUse[1]);
    // One backup, beside the file, holding the bytes as they were.
    const backup = backupPath(file, before);
    expect(readFileSync(backup, "utf8")).toBe(before);
    const now = tree(dir);
    expect(Object.keys(now).sort()).toEqual(
      [
        ...Object.keys(others),
        ".codex/hooks.json",
        relative(dir, backup).replaceAll("\\", "/"),
      ].sort(),
    );
    for (const [path, bytes] of Object.entries(others)) expect(now[path], path).toBe(bytes);
    expect(fixture).not.toBe(readFileSync(file, "utf8"));

    // A second run changes nothing, the backup included.
    const again = await cli(
      ["hook", "install", "codex", "--root", "memory", "--as", "person:dana"],
      {
        cwd: dir,
        home: await tempDir(),
      },
    );
    expect(again.out).toContain("unchanged:");
    expect(tree(dir)).toEqual(now);
  });

  it("with --user writes $CODEX_HOME/hooks.json, and ~/.codex/hooks.json without it", async () => {
    const home = await tempDir();
    const codexHome = await tempDir();
    const dir = await tempDir();
    const r = await cli(["hook", "install", "codex", "--user"], {
      cwd: dir,
      home,
      env: { CODEX_HOME: codexHome },
    });
    expect(r.code, r.err).toBe(0);
    expect(Object.keys(tree(codexHome))).toEqual(["hooks.json"]);
    expect(tree(dir)).toEqual({});
    expect(tree(home)).toEqual({});
    await cli(["hook", "install", "codex", "--user"], { cwd: dir, home });
    expect(Object.keys(tree(home))).toEqual([".codex/hooks.json"]);
    expect(r.out).not.toContain("/hooks.");
  });

  it.each([
    ["not JSON", "{ hooks: nope"],
    ["not an object", "[]"],
    ["hooks of another shape", '{"hooks": []}'],
    ["a PreToolUse that is not a list", '{"hooks": {"PreToolUse": {}}}'],
  ])("refuses a hooks.json that is %s, writing nothing", async (_what, text) => {
    const dir = await tempDir();
    await mkdir(join(dir, ".codex"));
    writeFileSync(join(dir, ".codex", "hooks.json"), text);
    const before = tree(dir);
    const r = await cli(["hook", "install", "codex"], { cwd: dir, home: await tempDir() });
    expect(r.code).toBe(1);
    expect(r.err).toContain("nothing was written");
    expect(tree(dir)).toEqual(before);
  });

  it("refuses a hooks.json that is a link, writing nothing", async (ctx) => {
    const dir = await tempDir();
    const elsewhere = join(await tempDir(), "real.json");
    writeFileSync(elsewhere, "{}");
    await mkdir(join(dir, ".codex"));
    try {
      symlinkSync(elsewhere, join(dir, ".codex", "hooks.json"), "file");
    } catch {
      ctx.skip(); // Windows without the symlink privilege
    }
    const r = await cli(["hook", "install", "codex"], { cwd: dir, home: await tempDir() });
    expect(r.code).toBe(1);
    expect(r.err).toContain("is a link");
    expect(readFileSync(elsewhere, "utf8")).toBe("{}");
  });
});

describe("engram hook install claude-code", () => {
  it("merges into .claude/settings.json beside the project's other settings, idempotently", async () => {
    const dir = await tempDir();
    await mkdir(join(dir, ".claude"));
    const file = join(dir, ".claude", "settings.json");
    const before = `${JSON.stringify({ permissions: { allow: ["Bash(git status)"] } }, null, 2)}\n`;
    writeFileSync(file, before);
    const r = await cli(["hook", "install", "claude-code", "--root", "memory"], {
      cwd: dir,
      home: await tempDir(),
    });
    expect(r.code, r.err).toBe(0);
    const next = json(file);
    expect(next.permissions).toEqual({ allow: ["Bash(git status)"] });
    const entry = next.hooks.PreToolUse[0].hooks[0];
    expect(entry.type).toBe("command");
    expect(entry.onFailure).toBe("block");
    expect(entry.args.slice(-4)).toEqual(["hook", "claude-code", "--root", join(dir, "memory")]);
    expect(readFileSync(backupPath(file, before), "utf8")).toBe(before);
    const now = tree(dir);
    const again = await cli(["hook", "install", "claude-code", "--root", "memory"], {
      cwd: dir,
      home: await tempDir(),
    });
    expect(again.out).toContain("unchanged:");
    expect(tree(dir)).toEqual(now);
  });

  it("with --user writes ~/.claude/settings.json and nothing in the project", async () => {
    const home = await tempDir();
    const dir = await tempDir();
    const r = await cli(["hook", "install", "claude-code", "--user"], { cwd: dir, home });
    expect(r.code, r.err).toBe(0);
    expect(Object.keys(tree(home))).toEqual([".claude/settings.json"]);
    expect(tree(dir)).toEqual({});
  });

  it("leaves the other harness's entry alone: a Claude Code install never takes a codex hook out", () => {
    const codex = hookEntry("codex", LAUNCH, ["hook", "codex"]);
    const claude = hookEntry("claude-code", LAUNCH, ["hook", "claude-code"]);
    expect(isOwnHandler("claude-code", codex)).toBe(false);
    expect(isOwnHandler("codex", claude)).toBe(false);
    expect(isOwnHandler("codex", codex)).toBe(true);
    expect(isOwnHandler("claude-code", claude)).toBe(true);
    const { next, replaced } = mergeEntry(
      "claude-code",
      { hooks: { PreToolUse: [{ matcher: "*", hooks: [codex, claude] }] } },
      claude,
      "settings.json",
    );
    expect(replaced).toBe(1);
    expect(next).toEqual({
      hooks: {
        PreToolUse: [
          { matcher: "*", hooks: [claude] },
          { matcher: "*", hooks: [codex] },
        ],
      },
    });
  });
});

describe("the Codex command line", () => {
  it("quotes a word with a space for sh, and writes commandWindows only when cmd's line differs", () => {
    const plain = hookEntry("codex", LAUNCH, ["hook", "codex", "--root", "/srv/memory"]);
    expect(plain).toEqual({
      type: "command",
      command: "engram hook codex --root /srv/memory",
      onFailure: "block",
    });
    const spaced = hookEntry(
      "codex",
      { command: "C:\\Program Files\\nodejs\\node.exe", prefix: ["C:\\e\\main.ts"], note: "x" },
      ["hook", "codex", "--as", "person:o'neil"],
    );
    expect(spaced.command).toBe(
      "'C:\\Program Files\\nodejs\\node.exe' 'C:\\e\\main.ts' hook codex --as 'person:o'\\''neil'",
    );
    expect(spaced.commandWindows).toBe(
      '"C:\\Program Files\\nodejs\\node.exe" C:\\e\\main.ts hook codex --as "person:o\'neil"',
    );
  });

  it.runIf(process.platform !== "win32")("runs under sh as the words it was built from", () => {
    const words = ["it's", "a b", "$HOME", "`x`", "c\\d"];
    const entry = hookEntry(
      "codex",
      { command: "printf", prefix: ["%s|"], note: undefined },
      words,
    );
    const r = spawnSync("sh", ["-c", entry.command as string], { encoding: "utf8" });
    expect(r.stdout).toBe(words.map((w) => `${w}|`).join(""));
  });

  it("runs the installed line through the CLI on stdin, as Codex would", async () => {
    const dir = await tempDir();
    await mkdir(join(dir, "memory"));
    await cli(["hook", "install", "codex", "--root", "memory", "--db", ":memory:"], {
      cwd: dir,
      home: await tempDir(),
    });
    const entry = json(join(dir, ".codex", "hooks.json")).hooks.PreToolUse[0].hooks[0];
    // The args after `hook`, as the installed line names them.
    const words = (entry.command as string).split(" ");
    const at = words.indexOf("hook");
    const args = words.slice(at).map((w) => w.replace(/^'|'$/g, ""));
    const r = await cli(args, {
      cwd: dir,
      stdin: Readable.from([
        JSON.stringify({
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command: "cat memory/a.md" },
          cwd: dir,
        }),
      ]),
    });
    expect(JSON.parse(r.out).hookSpecificOutput.permissionDecision).toBe("deny");
  });
});
