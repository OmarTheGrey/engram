// Card E9.10: `engram discover` on a copy of the fake home
// (fixtures/harness/home), and doctor's `harness memory` check, a warning
// and never a failure. Every file's time is set on the copy, since a
// checkout's are not fixed; doctor's store probes are cheap fakes, so no
// test opens Mem0 or a MemFS repository.
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverHarnessMemory } from "../src/discover.ts";
import type { Io } from "../src/run.ts";
import { cli, REPO, tempDir } from "./helpers.ts";

const FAKE_HOME = resolve(REPO, "fixtures/harness/home");
const TIME = new Date("2026-11-20T10:00:00.000Z");
const PROBES: Io["doctorProbes"] = {
  "adapter mem0": async () => ["ok", "a fixture probe"],
  "adapter letta": async () => ["ok", "a fixture probe"],
};

/** A copy of the fake home, every file at TIME, with a dependency folder the walk must skip. */
async function fakeHome(): Promise<{ home: string; project: string; memory: string }> {
  const home = join(await tempDir(), "home");
  cpSync(FAKE_HOME, home, { recursive: true });
  const dep = join(home, "lantern", "node_modules", "pkg");
  mkdirSync(dep, { recursive: true });
  writeFileSync(join(dep, "CLAUDE.md"), "a dependency's own instruction\n");
  for (const d of readdirSync(home, { recursive: true, withFileTypes: true }))
    if (d.isFile()) utimesSync(join(d.parentPath, d.name), TIME, TIME);
  return {
    home,
    project: join(home, "lantern"),
    memory: join(home, ".claude", "projects", "-src-lantern", "memory"),
  };
}

const relative = (text: string, home: string) =>
  text.split(home).join("<home>").replace(/\\/g, "/");

describe("engram discover", () => {
  it("counts per harness and kind the files outside every store root, sizes and times only", async () => {
    const f = await fakeHome();
    const { code, out, err } = await cli(
      ["discover", "--home", f.home, "--project", f.project, "--root", f.memory],
      { cwd: f.home },
    );
    expect([code, err]).toEqual([0, ""]);
    expect(relative(out, f.home)).toBe(
      [
        "discover: 10 harness memory files outside every store root, 2 inside one; sizes and times only, no memory file opened",
        "  claude-code  user-claude-md        1 file      51 bytes  newest 2026-11-20T10:00:00.000Z",
        "  claude-code  user-rules            1 file      18 bytes  newest 2026-11-20T10:00:00.000Z",
        "  claude-code  project-claude-md    2 files      55 bytes  newest 2026-11-20T10:00:00.000Z",
        "  claude-code  project-rules         1 file      21 bytes  newest 2026-11-20T10:00:00.000Z",
        "  codex        user-agents-md        1 file      31 bytes  newest 2026-11-20T10:00:00.000Z",
        "  codex        memories              1 file      21 bytes  newest 2026-11-20T10:00:00.000Z",
        "  codex        project-agents-md     1 file      38 bytes  newest 2026-11-20T10:00:00.000Z  read by codex, claude-code, cursor",
        "  cursor       project-rules         1 file      53 bytes  newest 2026-11-20T10:00:00.000Z",
        "  cursor       legacy-rules          1 file      27 bytes  newest 2026-11-20T10:00:00.000Z",
        "outside every store root:",
        "  <home>/.claude/CLAUDE.md  51 bytes  2026-11-20T10:00:00.000Z  claude-code user-claude-md",
        "  <home>/.claude/rules/style.md  18 bytes  2026-11-20T10:00:00.000Z  claude-code user-rules",
        "  <home>/.codex/AGENTS.md  31 bytes  2026-11-20T10:00:00.000Z  codex user-agents-md",
        "  <home>/.codex/memories/notes.md  21 bytes  2026-11-20T10:00:00.000Z  codex memories",
        "  <home>/lantern/.claude/rules/tests.md  21 bytes  2026-11-20T10:00:00.000Z  claude-code project-rules",
        "  <home>/lantern/.cursor/rules/style.mdc  53 bytes  2026-11-20T10:00:00.000Z  cursor project-rules",
        "  <home>/lantern/.cursorrules  27 bytes  2026-11-20T10:00:00.000Z  cursor legacy-rules",
        "  <home>/lantern/AGENTS.md  38 bytes  2026-11-20T10:00:00.000Z  codex project-agents-md",
        "  <home>/lantern/CLAUDE.md  28 bytes  2026-11-20T10:00:00.000Z  claude-code project-claude-md",
        "  <home>/lantern/packages/ui/CLAUDE.md  27 bytes  2026-11-20T10:00:00.000Z  claude-code project-claude-md",
        "searched: home <home>; codex home <home>/.codex; auto memory the default folders; projects <home>/lantern; store roots <home>/.claude/projects/-src-lantern/memory; locations as of 2026-11-28",
        "",
      ].join("\n"),
    );
  });

  it("walks the home and the current folder by default, and counts the auto memory once no root holds it", async () => {
    const f = await fakeHome();
    const { out } = await cli(["discover", "--json"], { home: f.home, cwd: f.project });
    const d = JSON.parse(out);
    expect(d.outside).toBe(12);
    expect(d.inside).toBe(0);
    expect(d.projects).toEqual([f.project]);
    expect(d.roots).toEqual([]);
    expect(d.groups[0]).toEqual({
      harness: "claude-code",
      kind: "auto-memory",
      readers: ["claude-code"],
      files: 2,
      bytes: 53,
      newest: "2026-11-20T10:00:00.000Z",
    });
    // The dependency folder's CLAUDE.md is skipped; every path is the walk's, every field a stat's.
    expect(
      d.files.map((x: { path: string }) => x.path).some((p: string) => p.includes("node_modules")),
    ).toBe(false);
    for (const file of d.files)
      expect(Object.keys(file).sort()).toEqual([
        "harness",
        "kind",
        "location",
        "mtime",
        "path",
        "size",
      ]);
    expect([d.as_of, d.bounded, d.unreadable]).toEqual(["2026-11-28", [], 0]);
  });

  it("says when a walk stopped at a bound: its counts are then a floor", async () => {
    const f = await fakeHome();
    const d = discoverHarnessMemory({
      home: f.home,
      projects: [f.project],
      roots: [],
      bounds: { depth: 1, entries: 1000 },
    });
    // packages/ui/CLAUDE.md is two folders down: past the bound.
    expect(d.bounded).toEqual([f.project]);
    expect(d.files.some((x) => x.path.endsWith(join("packages", "ui", "CLAUDE.md")))).toBe(false);
    const few = discoverHarnessMemory({
      home: f.home,
      projects: [f.project],
      roots: [],
      bounds: { depth: 4, entries: 2 },
    });
    expect(few.bounded).toContain(f.project);
  });

  it("reports nothing on an empty home and folder, and refuses a stray argument as usage", async () => {
    const empty = await tempDir();
    const { code, out } = await cli(["discover"], { home: empty, cwd: empty });
    expect(code).toBe(0);
    expect(out.split("\n")[0]).toBe(
      "discover: no harness memory file outside every store root, 0 inside one; sizes and times only, no memory file opened",
    );
    const bad = await cli(["discover", "extra"], { home: empty, cwd: empty });
    expect(bad.code).toBe(2);
  });

  it("never opens a memory file: the walk and the classifier read no content; only the settings key is read", () => {
    const code = (file: string) =>
      readFileSync(join(REPO, file), "utf8")
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
        .join("\n");
    for (const file of ["packages/cli/src/discover.ts", "packages/core/src/discover.ts"])
      expect(code(file), file).not.toMatch(
        /readFile|openSync|\bopen\(|createReadStream|readSync|FileHandle/,
      );
    // The one read: Claude Code's user settings, a configuration file, for one key.
    const settings = code("packages/cli/src/harness-settings.ts");
    expect(settings.match(/readFile\w*\(/g)).toEqual(["readFileSync("]);
    expect(settings).toMatch(/readFileSync\(file, "utf8"\)/);
    expect(settings).toMatch(/join\(home, "\.claude", "settings\.json"\)/);
  });

  it("follows no link: a linked start folder, folder or file is counted as linked, its target not walked", async () => {
    const root = await tempDir();
    const home = join(root, "home");
    const project = join(root, "project");
    const elsewhere = join(root, "elsewhere");
    mkdirSync(join(home, ".claude", "projects", "p"), { recursive: true });
    mkdirSync(join(project, ".claude"), { recursive: true });
    mkdirSync(elsewhere);
    writeFileSync(join(elsewhere, "shared.md"), "a shared rule\n");
    writeFileSync(join(project, "AGENTS.md"), "instructions\n");
    // Junctions need no privilege on Windows; a plain directory link elsewhere.
    const dirLink = (target: string, path: string) =>
      symlinkSync(target, path, process.platform === "win32" ? "junction" : "dir");
    dirLink(elsewhere, join(home, ".claude", "rules"));
    dirLink(elsewhere, join(home, ".claude", "projects", "p", "memory"));
    dirLink(elsewhere, join(project, ".claude", "rules"));
    dirLink(elsewhere, join(project, "sub"));
    let fileLinks = 0;
    try {
      symlinkSync(join(project, "AGENTS.md"), join(project, "CLAUDE.md"), "file");
      fileLinks = 1;
    } catch {
      // A file link needs a privilege on Windows: the folder links still test the rule.
    }
    const d = discoverHarnessMemory({ home, projects: [project], roots: [] });
    expect(d.files.map((x) => x.path)).toEqual([join(project, "AGENTS.md")]);
    expect(d.linked).toBe(4 + fileLinks);
    const { code, out } = await cli(["doctor"], { home, cwd: project, doctorProbes: PROBES });
    expect(out).toMatch(
      new RegExp(
        `^warn harness memory  1 harness memory file outside every store root \\(codex project-agents-md 1\\) \\(a floor: ${4 + fileLinks} links not followed\\); 0 inside one; engram discover lists them$`,
        "m",
      ),
    );
    expect(code).toBe(0);
    const text = await cli(["discover", "--home", home, "--project", project], { cwd: project });
    expect(text.out).toContain(
      `linked: ${4 + fileLinks} links at harness locations, not followed; the counts are a floor`,
    );
  });

  it("walks the Codex home CODEX_HOME names, memories_v2 included, and not ~/.codex then", async () => {
    const root = await tempDir();
    const codex = join(root, "codex-home");
    mkdirSync(join(codex, "memories_v2"), { recursive: true });
    writeFileSync(join(codex, "AGENTS.md"), "codex instructions\n");
    writeFileSync(join(codex, "memories_v2", "topic.md"), "a memory\n");
    mkdirSync(join(root, ".codex"));
    writeFileSync(join(root, ".codex", "AGENTS.md"), "unused\n");
    const empty = await tempDir();
    const { out } = await cli(["discover", "--json"], {
      home: root,
      cwd: empty,
      env: { CODEX_HOME: codex },
    });
    const d = JSON.parse(out);
    expect(d.codex_home).toBe(codex);
    expect(d.files.map((f: { path: string; kind: string }) => `${f.kind} ${f.path}`)).toEqual([
      `user-agents-md ${join(codex, "AGENTS.md")}`,
      `memories ${join(codex, "memories_v2", "topic.md")}`,
    ]);
  });

  it("walks the folder Claude Code's autoMemoryDirectory setting names", async () => {
    const root = await tempDir();
    mkdirSync(join(root, ".claude"));
    mkdirSync(join(root, "memstore"));
    writeFileSync(join(root, "memstore", "MEMORY.md"), "an index\n");
    writeFileSync(join(root, "memstore", "notes.txt"), "not memory by name\n");
    writeFileSync(
      join(root, ".claude", "settings.json"),
      JSON.stringify({ autoMemoryDirectory: "~/memstore" }),
    );
    const empty = await tempDir();
    const { out } = await cli(["discover", "--json"], { home: root, cwd: empty });
    const d = JSON.parse(out);
    expect(d.auto_memory_directory).toBe(join(root, "memstore"));
    expect(d.files.map((f: { location: string }) => f.location)).toEqual([
      "claude-code/auto-memory",
    ]);
  });
});

describe("doctor's harness memory check", () => {
  it("warns on harness memory outside the store root, and the run still passes", async () => {
    const f = await fakeHome();
    const { code, out } = await cli(["doctor", "--root", f.memory], {
      home: f.home,
      cwd: f.project,
      doctorProbes: PROBES,
    });
    expect(out).toMatch(
      /^warn harness memory {2}10 harness memory files outside every store root \(claude-code user-claude-md 1, claude-code user-rules 1, claude-code project-claude-md 2, claude-code project-rules 1, codex user-agents-md 1, codex memories 1, codex project-agents-md 1, cursor project-rules 1, cursor legacy-rules 1\); 2 inside one; engram discover lists them$/m,
    );
    expect(out).toContain("doctor: all checks passed, 1 warning");
    expect(code).toBe(0);
  });

  it("is ok with nothing outside, and its JSON counts the warning apart from the failures", async () => {
    const empty = await tempDir();
    const ok = await cli(["doctor"], { home: empty, cwd: empty, doctorProbes: PROBES });
    expect(ok.out).toMatch(
      /^ok {3}harness memory {2}no harness memory file outside every store root; 0 inside one$/m,
    );
    expect(ok.out).toContain("doctor: all checks passed\n");
    const f = await fakeHome();
    const json = await cli(["doctor", "--json"], {
      home: f.home,
      cwd: f.project,
      doctorProbes: PROBES,
    });
    const report = JSON.parse(json.out);
    const check = report.checks.find((c: { name: string }) => c.name === "harness memory");
    expect(check.status).toBe("warn");
    expect([report.failed, report.warned, json.code]).toEqual([0, 1, 0]);
  });

  it("exits 1 on a failure beside the warning, the summary naming both", async () => {
    const f = await fakeHome();
    const { code, out } = await cli(["doctor"], {
      home: f.home,
      cwd: f.project,
      doctorProbes: { ...PROBES, "adapter mem0": async () => ["fail", "a fixture failure"] },
    });
    expect(out).toMatch(/^fail adapter mem0 {4}a fixture failure$/m);
    expect(out).toMatch(/^warn harness memory {2}/m);
    expect(out).toContain("doctor: 1 check failed, 1 warning\n");
    expect(code).toBe(1);
  });
});
