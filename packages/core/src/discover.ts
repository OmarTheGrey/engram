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
 * The date every row was last checked against the vendor's page it links
 * (the review of card E9.10 fetched each on this date and quoted it).
 * Vendors move these paths: a row is data with its link and this date, and
 * a later check that finds a row wrong changes the row and the date.
 */
export const LOCATIONS_AS_OF = "2026-11-28";

export interface HarnessLocation {
  /** `<harness>/<kind>`. */
  id: string;
  /** The harness the location belongs to. */
  harness: Harness;
  kind: string;
  /** Every harness whose documentation says it reads files here, the owner first. */
  readers: readonly Harness[];
  /** Home: under the user's home; project: in any folder a harness opens; system: a fixed machine path. */
  where: "home" | "project" | "system";
  /** The location in words, as a path pattern. */
  pattern: string;
  /** The vendor's documentation of the location. */
  doc: string;
  as_of: string;
  /** Documented: the linked page names this path; unverified: it does not, and `note` says why the row stays. */
  status: "documented" | "unverified";
  note?: string;
}

const CLAUDE_MEMORY_DOC = "https://code.claude.com/docs/en/memory";
const CODEX_AGENTS_DOC = "https://learn.chatgpt.com/docs/agent-configuration/agents-md";
const CODEX_MEMORIES_DOC = "https://learn.chatgpt.com/docs/customization/memories";
const CURSOR_RULES_DOC = "https://cursor.com/docs/context/rules";

const row = (
  harness: Harness,
  kind: string,
  where: HarnessLocation["where"],
  pattern: string,
  doc: string,
  more: Partial<Pick<HarnessLocation, "readers" | "status" | "note">> = {},
): HarnessLocation => ({
  id: `${harness}/${kind}`,
  harness,
  kind,
  readers: more.readers ?? [harness],
  where,
  pattern,
  doc,
  as_of: LOCATIONS_AS_OF,
  status: more.status ?? "documented",
  ...(more.note === undefined ? {} : { note: more.note }),
});

/**
 * Claude Code's managed policy CLAUDE.md, one fixed path per platform, as
 * its memory page lists them (Linux and WSL, macOS, Windows).
 */
export const MANAGED_CLAUDE_MD = [
  "/etc/claude-code/CLAUDE.md",
  "/Library/Application Support/ClaudeCode/CLAUDE.md",
  "C:\\Program Files\\ClaudeCode\\CLAUDE.md",
] as const;

/** Every known location, in report order. */
export const HARNESS_LOCATIONS: readonly HarnessLocation[] = [
  row(
    "claude-code",
    "auto-memory",
    "home",
    "~/.claude/projects/<project>/memory/**/*.md, or the autoMemoryDirectory setting's folder",
    CLAUDE_MEMORY_DOC,
  ),
  row(
    "claude-code",
    "managed-claude-md",
    "system",
    MANAGED_CLAUDE_MD.join(", "),
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
    "$CODEX_HOME/AGENTS.md, $CODEX_HOME/AGENTS.override.md ($CODEX_HOME defaults to ~/.codex)",
    CODEX_AGENTS_DOC,
  ),
  row(
    "codex",
    "memories",
    "home",
    "$CODEX_HOME/memories_v2/** (a fresh home), $CODEX_HOME/memories/** (an existing one)",
    CODEX_MEMORIES_DOC,
  ),
  row(
    "codex",
    "project-agents-md",
    "project",
    "<project>/**/AGENTS.md, <project>/**/AGENTS.override.md",
    CODEX_AGENTS_DOC,
    {
      // Claude Code: "Claude can also read a repository's AGENTS.md files in place of CLAUDE.md";
      // Cursor: "Cursor supports AGENTS.md in the project root and subdirectories."
      readers: ["codex", "claude-code", "cursor"],
    },
  ),
  row("cursor", "project-rules", "project", "<project>/.cursor/rules/**/*.mdc", CURSOR_RULES_DOC),
  row("cursor", "legacy-rules", "project", "<project>/.cursorrules", CURSOR_RULES_DOC, {
    status: "unverified",
    note: "the current rules page does not mention .cursorrules; kept since older Cursor versions read it, and a file there is still instructions outside the plane",
  }),
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

/**
 * Where the harnesses' own folders are, when moved from their defaults: the
 * Codex home (`CODEX_HOME`, default `<home>/.codex`) and Claude Code's
 * auto memory folder (its `autoMemoryDirectory` setting, none by default).
 */
export interface HarnessPlaces {
  codexHome?: string;
  autoMemoryDirectory?: string;
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

/** Whether two paths name the same place, by their segments. */
function samePath(a: string, b: string): boolean {
  const p = segments(a);
  const q = segments(b);
  const fold = windows(a) || windows(b);
  return (
    p.length === q.length &&
    p.every((s, i) => (fold ? s.toLowerCase() === (q[i] as string).toLowerCase() : s === q[i]))
  );
}

const isMd = (name: string) => name.toLowerCase().endsWith(".md");

/** The location of a file in the Codex home; null when it is one of Codex's own files. */
function codexLocation(rel: readonly string[]): HarnessLocation | null {
  const [top] = rel;
  if (rel.length === 1 && (top === "AGENTS.md" || top === "AGENTS.override.md"))
    return loc("codex/user-agents-md");
  if ((top === "memories" || top === "memories_v2") && rel.length > 1) return loc("codex/memories");
  return null;
}

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
  // The default Codex home is classified as such; a moved one leaves this folder Codex's own.
  if (top === ".codex") return null;
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
  // "Project rules must use the .mdc extension"; a plain .md there is ignored by Cursor.
  if (under(".cursor", "rules") && name.toLowerCase().endsWith(".mdc"))
    return loc("cursor/project-rules");
  return undefined;
}

/** The Codex home: `places.codexHome` when given, else `<home>/.codex`. */
export const codexHomeOf = (home: string, places: HarnessPlaces = {}): string =>
  places.codexHome ?? `${home.replace(/[\\/]+$/, "")}/.codex`;

/** The known location a path is at, by the path alone; undefined when it is at none. */
export function harnessLocationOf(
  path: string,
  home: string,
  places: HarnessPlaces = {},
): HarnessLocation | undefined {
  if (MANAGED_CLAUDE_MD.some((m) => samePath(path, m))) return loc("claude-code/managed-claude-md");
  const auto = places.autoMemoryDirectory;
  if (auto !== undefined && below(path, auto) !== undefined)
    return isMd(path) ? loc("claude-code/auto-memory") : undefined;
  const codex = below(path, codexHomeOf(home, places));
  if (codex !== undefined) return codexLocation(codex) ?? undefined;
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
  places: HarnessPlaces = {},
): HarnessMemory | undefined {
  const at = harnessLocationOf(path, home, places);
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
  /** Every harness that reads files of this kind (AGENTS.md: three). */
  readers: readonly Harness[];
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
        readers: BY_ID.get(f.location)?.readers ?? [f.harness],
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
