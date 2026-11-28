// Card E9.10: the pure classifier of harness memory locations. Every case is
// a path under the fake home of fixtures/harness/home (or a Windows-shaped
// one), classified with a fixed stat head; nothing here touches the disk.
import { readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  classifyHarnessMemory,
  type FileHead,
  HARNESS_LOCATIONS,
  HARNESSES,
  harnessLocationOf,
  insideRoot,
  LOCATIONS_AS_OF,
  summarizeDiscovery,
} from "../../src/discover.ts";

const HOME = "/home/dana";
const HEAD: FileHead = { size: 120, mtime: "2026-11-20T10:00:00.000Z" };
const at = (rel: string) => `${HOME}/${rel}`;
const kindOf = (rel: string, home = HOME) => {
  const c = classifyHarnessMemory(rel.startsWith("/") ? rel : at(rel), HEAD, home);
  return c === undefined ? undefined : `${c.harness} ${c.kind}`;
};

describe("the location table", () => {
  it("is dated data: every row has a harness, a kind, a documentation link, the date and a status", () => {
    expect(LOCATIONS_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const ids = new Set<string>();
    for (const row of HARNESS_LOCATIONS) {
      expect(HARNESSES, row.id).toContain(row.harness);
      expect(row.doc, row.id).toMatch(/^https:\/\//);
      expect(row.as_of, row.id).toBe(LOCATIONS_AS_OF);
      expect(["documented", "unverified"], row.id).toContain(row.status);
      expect(row.pattern.length, row.id).toBeGreaterThan(0);
      expect(row.readers[0], row.id).toBe(row.harness);
      // An unverified row says why it stays.
      if (row.status === "unverified") expect(row.note?.length, row.id).toBeGreaterThan(0);
      // The links the review of 2026-11-28 found current.
      expect(row.doc, row.id).not.toMatch(/docs\.cursor\.com|developers\.openai\.com|github\.com/);
      expect(ids.has(row.id), row.id).toBe(false);
      ids.add(row.id);
    }
    // The card's three harnesses, each with at least one row.
    for (const h of ["claude-code", "codex", "cursor"])
      expect(HARNESS_LOCATIONS.some((r) => r.harness === h)).toBe(true);
  });
});

describe("classifyHarnessMemory", () => {
  it("finds Claude Code's auto memory, user CLAUDE.md and user rules under the home", () => {
    expect(kindOf(".claude/projects/-src-lantern/memory/MEMORY.md")).toBe(
      "claude-code auto-memory",
    );
    expect(kindOf(".claude/projects/-src-lantern/memory/user_role.md")).toBe(
      "claude-code auto-memory",
    );
    expect(kindOf(".claude/CLAUDE.md")).toBe("claude-code user-claude-md");
    expect(kindOf(".claude/rules/style.md")).toBe("claude-code user-rules");
    expect(kindOf(".claude/rules/team/review.md")).toBe("claude-code user-rules");
  });

  it("finds Codex's user AGENTS.md, its override and its memories under the home", () => {
    expect(kindOf(".codex/AGENTS.md")).toBe("codex user-agents-md");
    expect(kindOf(".codex/AGENTS.override.md")).toBe("codex user-agents-md");
    expect(kindOf(".codex/memories/notes.md")).toBe("codex memories");
    // "In a fresh Codex home, the CLI writes to $CODEX_HOME/memories_v2/".
    expect(kindOf(".codex/memories_v2/topic/a.json")).toBe("codex memories");
  });

  it("finds project files anywhere: CLAUDE.md, CLAUDE.local.md, rules, AGENTS.md, Cursor's rules", () => {
    expect(kindOf("/src/lantern/CLAUDE.md")).toBe("claude-code project-claude-md");
    expect(kindOf("/src/lantern/.claude/CLAUDE.md")).toBe("claude-code project-claude-md");
    expect(kindOf("/src/lantern/packages/ui/CLAUDE.md")).toBe("claude-code project-claude-md");
    expect(kindOf("/src/lantern/CLAUDE.local.md")).toBe("claude-code local-claude-md");
    expect(kindOf("/src/lantern/.claude/rules/tests.md")).toBe("claude-code project-rules");
    expect(kindOf("/src/lantern/AGENTS.md")).toBe("codex project-agents-md");
    expect(kindOf("/src/lantern/AGENTS.override.md")).toBe("codex project-agents-md");
    expect(kindOf("/src/lantern/.cursor/rules/style.mdc")).toBe("cursor project-rules");
    expect(kindOf("/src/lantern/.cursor/rules/nested/a.mdc")).toBe("cursor project-rules");
    // "A plain .md file in .cursor/rules is ignored by the rules system."
    expect(kindOf("/src/lantern/.cursor/rules/nested/a.md")).toBeUndefined();
    expect(kindOf("/src/lantern/.cursorrules")).toBe("cursor legacy-rules");
    // A project under the home is a project like any other.
    expect(kindOf("work/lantern/CLAUDE.md")).toBe("claude-code project-claude-md");
  });

  it("ignores the harnesses' own files: settings, sessions, plugins, config, and other names", () => {
    for (const rel of [
      ".claude/settings.json",
      ".claude/projects/-src-lantern/0001.jsonl",
      ".claude/projects/-src-lantern/memory/notes.txt",
      ".claude/plugins/marketplaces/x/CLAUDE.md",
      ".claude/rules/readme.txt",
      ".codex/config.toml",
      ".codex/sessions/2026/rollout.jsonl",
      ".codex/plugins/x/AGENTS.md",
      ".cursor/rules/style.mdc",
      "/src/lantern/README.md",
      "/src/lantern/claude.md.bak",
      "/src/lantern/.cursor/settings.json",
      "/src/lantern/docs/rules/a.md",
    ])
      expect(kindOf(rel), rel).toBeUndefined();
  });

  it("carries the stat head through, never content: size and time only", () => {
    const c = classifyHarnessMemory(at(".claude/CLAUDE.md"), HEAD, HOME);
    expect(c).toEqual({
      path: at(".claude/CLAUDE.md"),
      harness: "claude-code",
      kind: "user-claude-md",
      location: "claude-code/user-claude-md",
      size: 120,
      mtime: "2026-11-20T10:00:00.000Z",
    });
    expect(harnessLocationOf(at(".claude/CLAUDE.md"), HOME)?.id).toBe(c?.location);
  });

  it("reads Windows paths: backslashes, and the drive and folder names in any case", () => {
    const home = "C:\\Users\\Dana";
    const c = (p: string) => {
      const r = classifyHarnessMemory(p, HEAD, home);
      return r === undefined ? undefined : `${r.harness} ${r.kind}`;
    };
    expect(c("C:\\Users\\Dana\\.claude\\projects\\c--src\\memory\\MEMORY.md")).toBe(
      "claude-code auto-memory",
    );
    expect(c("c:\\users\\dana\\.claude\\CLAUDE.md")).toBe("claude-code user-claude-md");
    expect(c("C:/Users/Dana/.codex/AGENTS.md")).toBe("codex user-agents-md");
    expect(c("D:\\src\\lantern\\.cursor\\rules\\a.mdc")).toBe("cursor project-rules");
    // A home's look-alike sibling is not the home.
    expect(c("C:\\Users\\Dana2\\.claude\\CLAUDE.md")).toBe("claude-code project-claude-md");
  });

  it("classifies the fake home's every file as its README says", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const home = resolve(here, "../../../../fixtures/harness/home");
    const files = (readdirSync(home, { recursive: true, withFileTypes: true }) as never[])
      .filter((d: { isFile(): boolean }) => d.isFile())
      .map((d: { parentPath: string; name: string }) => join(d.parentPath, d.name))
      .map((p) => relative(home, p).split("\\").join("/"))
      .sort();
    const found = files
      .map((rel) => [rel, classifyHarnessMemory(join(home, rel), HEAD, home)] as const)
      .filter(([, c]) => c !== undefined)
      .map(([rel, c]) => `${rel} ${c?.harness} ${c?.kind}`);
    expect(found).toEqual([
      ".claude/CLAUDE.md claude-code user-claude-md",
      ".claude/projects/-src-lantern/memory/MEMORY.md claude-code auto-memory",
      ".claude/projects/-src-lantern/memory/user_role.md claude-code auto-memory",
      ".claude/rules/style.md claude-code user-rules",
      ".codex/AGENTS.md codex user-agents-md",
      ".codex/memories/notes.md codex memories",
      "lantern/.claude/rules/tests.md claude-code project-rules",
      "lantern/.cursor/rules/style.mdc cursor project-rules",
      "lantern/.cursorrules cursor legacy-rules",
      "lantern/AGENTS.md codex project-agents-md",
      "lantern/CLAUDE.md claude-code project-claude-md",
      "lantern/packages/ui/CLAUDE.md claude-code project-claude-md",
    ]);
  });
});

describe("the documented relocations and the shared and managed rows", () => {
  it("reads CODEX_HOME's folder as the Codex home, and leaves ~/.codex then to Codex", () => {
    const places = { codexHome: "/opt/codex" };
    const c = (p: string) => classifyHarnessMemory(p, HEAD, HOME, places)?.kind;
    expect(c("/opt/codex/AGENTS.md")).toBe("user-agents-md");
    expect(c("/opt/codex/memories_v2/a.md")).toBe("memories");
    expect(c("/opt/codex/config.toml")).toBeUndefined();
    expect(c(at(".codex/AGENTS.md"))).toBeUndefined();
  });

  it("reads the autoMemoryDirectory setting's folder as auto memory, its .md files only", () => {
    const places = { autoMemoryDirectory: "/data/claude-memory" };
    const c = (p: string) => classifyHarnessMemory(p, HEAD, HOME, places)?.location;
    expect(c("/data/claude-memory/MEMORY.md")).toBe("claude-code/auto-memory");
    expect(c("/data/claude-memory/topic/a.md")).toBe("claude-code/auto-memory");
    expect(c("/data/claude-memory/notes.txt")).toBeUndefined();
  });

  it("finds the managed policy CLAUDE.md at each platform's fixed path, and not a project's", () => {
    expect(kindOf("/etc/claude-code/CLAUDE.md")).toBe("claude-code managed-claude-md");
    expect(kindOf("/Library/Application Support/ClaudeCode/CLAUDE.md")).toBe(
      "claude-code managed-claude-md",
    );
    expect(
      classifyHarnessMemory("c:/program files/claudecode/CLAUDE.md", HEAD, "C:/Users/Dana")?.kind,
    ).toBe("managed-claude-md");
    expect(kindOf("/etc/claude-code/sub/CLAUDE.md")).toBe("claude-code project-claude-md");
  });

  it("says AGENTS.md is read by Codex, Claude Code and Cursor, in the row and the counts", () => {
    const row = HARNESS_LOCATIONS.find((r) => r.id === "codex/project-agents-md");
    expect(row?.readers).toEqual(["codex", "claude-code", "cursor"]);
    const agents = classifyHarnessMemory("/src/AGENTS.md", HEAD, HOME);
    const s = summarizeDiscovery(agents === undefined ? [] : [agents], []);
    expect(s.groups[0]?.readers).toEqual(["codex", "claude-code", "cursor"]);
  });

  it("marks .cursorrules unverified, with its reason", () => {
    const row = HARNESS_LOCATIONS.find((r) => r.id === "cursor/legacy-rules");
    expect(row?.status).toBe("unverified");
    expect(row?.note).toContain("does not mention .cursorrules");
  });
});

describe("insideRoot", () => {
  it("holds a path under a root, never a sibling that shares its prefix", () => {
    expect(insideRoot("/src/mem/a.md", ["/src/mem"])).toBe(true);
    expect(insideRoot("/src/mem/a/b.md", ["/src/mem/"])).toBe(true);
    expect(insideRoot("/src/memory/a.md", ["/src/mem"])).toBe(false);
    expect(insideRoot("/src/mem", ["/src/mem"])).toBe(false);
    expect(insideRoot("/src/a.md", [])).toBe(false);
    expect(insideRoot("C:\\Src\\Mem\\a.md", ["c:/src/mem"])).toBe(true);
  });
});

describe("summarizeDiscovery", () => {
  const f = (path: string, kind: string, size: number, mtime: string) => {
    const c = classifyHarnessMemory(path, { size, mtime }, HOME);
    if (c === undefined) throw new Error(`${path} (${kind}) is not harness memory`);
    return c;
  };
  const found = [
    f(at(".claude/projects/p/memory/b.md"), "auto", 30, "2026-11-02T00:00:00.000Z"),
    f(at(".claude/projects/p/memory/a.md"), "auto", 20, "2026-11-03T00:00:00.000Z"),
    f(at(".codex/AGENTS.md"), "codex", 5, "2026-10-01T00:00:00.000Z"),
    f("/src/lantern/CLAUDE.md", "project", 7, "2026-09-01T00:00:00.000Z"),
  ];

  it("counts per harness and kind the files outside every root, sizes and newest time; the inside ones apart", () => {
    const s = summarizeDiscovery(found, [at(".claude/projects/p/memory")]);
    expect(s.inside).toBe(2);
    expect(s.outside).toBe(2);
    expect(s.groups).toEqual([
      {
        harness: "claude-code",
        kind: "project-claude-md",
        readers: ["claude-code"],
        files: 1,
        bytes: 7,
        newest: "2026-09-01T00:00:00.000Z",
      },
      {
        harness: "codex",
        kind: "user-agents-md",
        readers: ["codex"],
        files: 1,
        bytes: 5,
        newest: "2026-10-01T00:00:00.000Z",
      },
    ]);
    expect(s.files.map((x) => x.path)).toEqual([
      "/home/dana/.codex/AGENTS.md",
      "/src/lantern/CLAUDE.md",
    ]);
  });

  it("groups several files of one kind, newest of them, in a fixed order whatever the input order", () => {
    const a = summarizeDiscovery(found, []);
    const b = summarizeDiscovery([...found].reverse(), []);
    expect(a).toEqual(b);
    expect(a.outside).toBe(4);
    expect(a.groups[0]).toEqual({
      harness: "claude-code",
      kind: "auto-memory",
      readers: ["claude-code"],
      files: 2,
      bytes: 50,
      newest: "2026-11-03T00:00:00.000Z",
    });
  });

  it("reports nothing outside when every file sits in a root", () => {
    const s = summarizeDiscovery(found, ["/home/dana", "/src/lantern"]);
    expect([s.outside, s.inside, s.groups, s.files]).toEqual([0, 4, [], []]);
  });
});
