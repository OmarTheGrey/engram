// Harness memory outside the plane (card E9.10, docs/research/absorb/18a,
// AB-GAP1-5): a dated table of the places Claude Code, Codex and Cursor keep
// memory and instructions as files, a pure classifier of a path against it,
// and the counts a walk reports. Gate D measures zero violations on the
// plane with a member's native memory path stated as outside it (lead
// decision 33); discovery counts what that statement leaves out.
//
// Pure: no filesystem, no clock. The CLI walks and stats; this file sees a
// path and its stat head (size and modification time), never a byte of the
// file's content (AGENTS.md rule 12). Discovery shows that a file exists,
// not that a harness read it.

/** The harnesses the table covers. */
export const HARNESSES = ["claude-code", "codex", "cursor"] as const;
export type Harness = (typeof HARNESSES)[number];

/**
 * The date the table was written from the vendors' documentation. Vendors
 * move these paths: a row is data with its link and this date, and a later
 * check that finds a row wrong changes the row and the date.
 */
export const LOCATIONS_AS_OF = "2026-11-28";

export interface HarnessLocation {
  /** `<harness>/<kind>`. */
  id: string;
  harness: Harness;
  kind: string;
  /** Home: under the user's home folder; project: in any folder a harness opens. */
  where: "home" | "project";
  /** The location in words, as a path pattern. */
  pattern: string;
  /** The vendor's documentation of the location. */
  doc: string;
  as_of: string;
  /** Documented: the link describes this path; unverified: inferred, not found in the documentation. */
  status: "documented" | "unverified";
}

const CLAUDE_MEMORY_DOC = "https://code.claude.com/docs/en/memory";
const CODEX_AGENTS_DOC = "https://developers.openai.com/codex/guides/agents-md";
const CODEX_CONFIG_DOC = "https://github.com/openai/codex/blob/main/docs/config.md";
const CURSOR_RULES_DOC = "https://docs.cursor.com/context/rules";

const row = (
  harness: Harness,
  kind: string,
  where: HarnessLocation["where"],
  pattern: string,
  doc: string,
  status: HarnessLocation["status"] = "documented",
): HarnessLocation => ({
  id: `${harness}/${kind}`,
  harness,
  kind,
  where,
  pattern,
  doc,
  as_of: LOCATIONS_AS_OF,
  status,
});

/** Every known location, in report order. */
export const HARNESS_LOCATIONS: readonly HarnessLocation[] = [
  row(
    "claude-code",
    "auto-memory",
    "home",
    "~/.claude/projects/<project>/memory/**/*.md",
    CLAUDE_MEMORY_DOC,
  ),
  row("claude-code", "user-claude-md", "home", "~/.claude/CLAUDE.md", CLAUDE_MEMORY_DOC),
  row("claude-code", "user-rules", "home", "~/.claude/rules/**/*.md", CLAUDE_MEMORY_DOC),
  row(
    "claude-code",
    "project-claude-md",
    "project",
    "<project>/**/CLAUDE.md, <project>/.claude/CLAUDE.md",
    CLAUDE_MEMORY_DOC,
  ),
  row(
    "claude-code",
    "local-claude-md",
    "project",
    "<project>/**/CLAUDE.local.md",
    CLAUDE_MEMORY_DOC,
  ),
  row(
    "claude-code",
    "project-rules",
    "project",
    "<project>/.claude/rules/**/*.md",
    CLAUDE_MEMORY_DOC,
  ),
  row(
    "codex",
    "user-agents-md",
    "home",
    "~/.codex/AGENTS.md, ~/.codex/AGENTS.override.md",
    CODEX_AGENTS_DOC,
  ),
  row("codex", "memories", "home", "~/.codex/memories/**", CODEX_CONFIG_DOC, "unverified"),
  row(
    "codex",
    "project-agents-md",
    "project",
    "<project>/**/AGENTS.md, <project>/**/AGENTS.override.md",
    CODEX_AGENTS_DOC,
  ),
  row(
    "cursor",
    "project-rules",
    "project",
    "<project>/.cursor/rules/**/*.mdc or *.md",
    CURSOR_RULES_DOC,
  ),
  row("cursor", "legacy-rules", "project", "<project>/.cursorrules", CURSOR_RULES_DOC),
];

const BY_ID = new Map(HARNESS_LOCATIONS.map((l) => [l.id, l]));
const loc = (id: string) => BY_ID.get(id) as HarnessLocation;

/** A file's stat head: its size in bytes and its modification time (ISO 8601). Never its content. */
export interface FileHead {
  size: number;
  mtime: string;
}

/** A file at a known harness location, with its stat head. */
export interface HarnessMemory {
  path: string;
  harness: Harness;
  kind: string;
  /** The row of HARNESS_LOCATIONS it matched. */
  location: string;
  size: number;
  mtime: string;
}

/** A path's segments, separators of either kind, empty and `.` segments dropped. */
const segments = (path: string) => path.split(/[\\/]+/).filter((s) => s !== "" && s !== ".");

/** Windows paths (a drive letter) compare without case, as the filesystem does. */
const windows = (path: string) => /^[A-Za-z]:/.test(path);

/** The segments of `path` below `dir`, or undefined when it is not strictly inside. */
function below(path: string, dir: string): string[] | undefined {
  const p = segments(path);
  const d = segments(dir);
  if (p.length <= d.length) return undefined;
  const fold = windows(path) || windows(dir);
  const same = (a: string, b: string) => (fold ? a.toLowerCase() === b.toLowerCase() : a === b);
  return d.every((s, i) => same(s, p[i] as string)) ? p.slice(d.length) : undefined;
}

const isMd = (name: string) => name.toLowerCase().endsWith(".md");

/** The location of a file under the home's harness folders; null when it is one of their own files. */
function homeLocation(rel: readonly string[]): HarnessLocation | null | undefined {
  const [top, second, third, fourth] = rel;
  const name = rel.at(-1) as string;
  if (top === ".claude") {
    if (rel.length === 2 && second === "CLAUDE.md") return loc("claude-code/user-claude-md");
    if (second === "rules" && rel.length > 2 && isMd(name)) return loc("claude-code/user-rules");
    if (
      second === "projects" &&
      third !== undefined &&
      fourth === "memory" &&
      rel.length > 4 &&
      isMd(name)
    )
      return loc("claude-code/auto-memory");
    return null;
  }
  if (top === ".codex") {
    if (rel.length === 2 && (second === "AGENTS.md" || second === "AGENTS.override.md"))
      return loc("codex/user-agents-md");
    if (second === "memories" && rel.length > 2) return loc("codex/memories");
    return null;
  }
  // Cursor keeps user rules in its settings, not in files under the home.
  if (top === ".cursor") return null;
  return undefined;
}

/** The location of a file in a project folder, by its name and the folders above it. */
function projectLocation(parts: readonly string[]): HarnessLocation | undefined {
  const name = parts.at(-1) as string;
  const dirs = parts.slice(0, -1);
  const under = (a: string, b: string) => dirs.some((d, i) => d === a && dirs[i + 1] === b);
  if (name === "CLAUDE.md") return loc("claude-code/project-claude-md");
  if (name === "CLAUDE.local.md") return loc("claude-code/local-claude-md");
  if (name === "AGENTS.md" || name === "AGENTS.override.md") return loc("codex/project-agents-md");
  if (name === ".cursorrules") return loc("cursor/legacy-rules");
  if (under(".claude", "rules") && isMd(name)) return loc("claude-code/project-rules");
  if (under(".cursor", "rules") && (isMd(name) || name.toLowerCase().endsWith(".mdc")))
    return loc("cursor/project-rules");
  return undefined;
}

/** The known location a path is at, by the path alone; undefined when it is at none. */
export function harnessLocationOf(path: string, home: string): HarnessLocation | undefined {
  const rel = below(path, home);
  if (rel !== undefined) {
    const at = homeLocation(rel);
    if (at !== undefined) return at ?? undefined;
    return projectLocation(rel);
  }
  return projectLocation(segments(path));
}

/**
 * Classifies one file: the harness and kind of the known location its path
 * is at, with its stat head carried through; undefined when the path is at
 * no known location. `head` is the file's size and time, never its content.
 */
export function classifyHarnessMemory(
  path: string,
  head: FileHead,
  home: string,
): HarnessMemory | undefined {
  const at = harnessLocationOf(path, home);
  if (at === undefined) return undefined;
  return {
    path,
    harness: at.harness,
    kind: at.kind,
    location: at.id,
    size: head.size,
    mtime: head.mtime,
  };
}

/** Whether `path` is strictly inside one of `roots`, the configured store roots. */
export const insideRoot = (path: string, roots: readonly string[]): boolean =>
  roots.some((r) => below(path, r) !== undefined);

export interface DiscoveryGroup {
  harness: Harness;
  kind: string;
  files: number;
  bytes: number;
  /** The latest modification time among them. */
  newest: string;
}

export interface DiscoverySummary {
  /** Files outside every store root. */
  outside: number;
  /** Files inside a store root: memory a member adopts through the plane. */
  inside: number;
  /** The files outside, per harness and kind, in the table's order. */
  groups: DiscoveryGroup[];
  /** The files outside, by path. */
  files: HarnessMemory[];
}

const ORDER = new Map(HARNESS_LOCATIONS.map((l, i) => [l.id, i]));

/** The counts of a walk: per harness and kind, the files outside every root; the inside ones apart. */
export function summarizeDiscovery(
  found: readonly HarnessMemory[],
  roots: readonly string[],
): DiscoverySummary {
  const outside = found
    .filter((f) => !insideRoot(f.path, roots))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const groups = new Map<string, DiscoveryGroup>();
  for (const f of outside) {
    const g = groups.get(f.location);
    if (g === undefined)
      groups.set(f.location, {
        harness: f.harness,
        kind: f.kind,
        files: 1,
        bytes: f.size,
        newest: f.mtime,
      });
    else {
      g.files += 1;
      g.bytes += f.size;
      if (f.mtime > g.newest) g.newest = f.mtime;
    }
  }
  return {
    outside: outside.length,
    inside: found.length - outside.length,
    groups: [...groups]
      .sort(([a], [b]) => (ORDER.get(a) ?? 0) - (ORDER.get(b) ?? 0))
      .map(([, g]) => g),
    files: outside,
  };
}
