// `engram discover` (card E9.10): a bounded walk of the places harnesses
// keep memory as files, each file classified by core's table
// (classifyHarnessMemory), and the counts of those outside every store root
// the flags name. It reads directory listings and each matching file's size
// and modification time from lstat; it never opens a memory file, so no byte
// of memory content is read, printed or sent (AGENTS.md rule 12). The one
// file it reads is Claude Code's user settings, a configuration file, for
// its `autoMemoryDirectory` key alone (./harness-settings.ts). It writes
// nothing. Discovery shows that a file exists, not that a harness read it.
//
// The walk: under the home, only the table's home locations (~/.claude's
// CLAUDE.md, rules and each project's memory folder, the autoMemoryDirectory
// folder when set, the Codex home's AGENTS.md files and memories, at
// $CODEX_HOME when set); the managed policy CLAUDE.md paths; in each project
// folder, every folder down to a fixed depth, skipping dependency, build and
// version-control folders and every dot folder but .claude and .cursor.
// No link is followed, at a folder the walk starts from or below it: a link
// at a harness location (Claude Code's rules folder supports them) is
// counted as linked, not followed. A walk that hits a bound, or meets such
// a link, says so: its counts are then a floor.
import { type Dirent, lstatSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  classifyHarnessMemory,
  codexHomeOf,
  type DiscoverySummary,
  type HarnessMemory,
  type HarnessPlaces,
  harnessLocationOf,
  LOCATIONS_AS_OF,
  MANAGED_CLAUDE_MD,
  summarizeDiscovery,
} from "@engram/core";
import { parse } from "./commands.ts";
import { plural } from "./format.ts";
import { autoMemoryDirectory } from "./harness-settings.ts";
import { OPTIONS } from "./registry.ts";
import type { Io } from "./run.ts";

/** How deep a walk goes below each folder it starts at, and how many entries it lists in all per start. */
export const WALK_BOUNDS = { depth: 4, entries: 20_000 } as const;

/** Folders a project walk never enters: dependencies, builds, caches, version control. */
const SKIP = new Set([
  "node_modules",
  "dist",
  "build",
  "target",
  "coverage",
  "vendor",
  "__pycache__",
]);
/** The dot folders a project walk enters: the harnesses' own. */
const DOT_KEPT = new Set([".claude", ".cursor"]);

export interface DiscoverInput extends HarnessPlaces {
  home: string;
  /** The project folders to walk. */
  projects: readonly string[];
  /** The configured store roots: a file inside one is memory the plane adopts. */
  roots: readonly string[];
  /** The managed policy CLAUDE.md paths to look at; the table's three by default. */
  managed?: readonly string[];
  bounds?: { depth: number; entries: number };
}

export interface Discovery extends DiscoverySummary {
  as_of: string;
  home: string;
  /** The Codex home walked: $CODEX_HOME, else <home>/.codex. */
  codex_home: string;
  /** Claude Code's autoMemoryDirectory setting, when set. */
  auto_memory_directory: string | null;
  projects: string[];
  roots: string[];
  /** The bounds the walk kept to. */
  bounds: { depth: number; entries: number };
  /** The folders where a walk stopped at a bound: the counts are then a floor. */
  bounded: string[];
  /** Links at a harness location, or folders the walk would enter, that it did not follow. */
  linked: number;
  /** Folders that could not be listed (permissions), counted, never named. */
  unreadable: number;
}

const list = (dir: string): Dirent[] | undefined => {
  try {
    return readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );
  } catch {
    return undefined;
  }
};

/** The path's own lstat (a link is not followed), or undefined when there is nothing there. */
const lstat = (path: string) => {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
};

/** Walks the home's locations and the projects; every matching file's stat head, never its content. */
export function discoverHarnessMemory(input: DiscoverInput): Discovery {
  const bounds = input.bounds ?? WALK_BOUNDS;
  const home = resolve(input.home);
  const places: HarnessPlaces = {
    ...(input.codexHome === undefined ? {} : { codexHome: resolve(input.codexHome) }),
    ...(input.autoMemoryDirectory === undefined
      ? {}
      : { autoMemoryDirectory: resolve(input.autoMemoryDirectory) }),
  };
  const codexHome = resolve(codexHomeOf(home, places));
  const projects = input.projects.map((p) => resolve(p));
  const roots = input.roots.map((r) => resolve(r));
  const seen = new Map<string, HarnessMemory>();
  const links = new Set<string>();
  const bounded: string[] = [];
  let unreadable = 0;

  const at = (path: string) => harnessLocationOf(path, home, places) !== undefined;

  /** One path: a file at a known location is recorded by its lstat; a link there is counted. */
  const take = (path: string) => {
    if (seen.has(path) || !at(path)) return;
    const s = lstat(path);
    if (s === undefined) return;
    if (s.isSymbolicLink()) {
      links.add(path);
      return;
    }
    if (!s.isFile()) return;
    const c = classifyHarnessMemory(
      path,
      { size: s.size, mtime: s.mtime.toISOString() },
      home,
      places,
    );
    if (c !== undefined) seen.set(path, c);
  };

  /** Lists `start` and the folders below it, to the depth and entry bounds, following no link. */
  const walk = (start: string, enter: (name: string, dir: string) => boolean) => {
    const s = lstat(start);
    if (s === undefined) return;
    if (s.isSymbolicLink()) {
      links.add(start);
      return;
    }
    if (!s.isDirectory()) return;
    let entries = 0;
    let stopped = false;
    let deep = false;
    const go = (dir: string, depth: number) => {
      if (stopped) return;
      const got = list(dir);
      if (got === undefined) {
        unreadable += 1;
        return;
      }
      for (const d of got) {
        if (++entries > bounds.entries) {
          stopped = true;
          return;
        }
        const path = join(dir, d.name);
        if (d.isSymbolicLink()) {
          // A link the walk would read, as a file at a location or a folder it would enter.
          if (at(path) || enter(d.name, path)) links.add(path);
        } else if (d.isFile()) take(path);
        else if (d.isDirectory() && enter(d.name, path)) {
          // A folder below the depth bound is not listed: the counts become a floor.
          if (depth >= bounds.depth) deep = true;
          else go(path, depth + 1);
        }
      }
    };
    go(start, 0);
    if (stopped || deep) bounded.push(start);
  };
  const all = () => true;

  // The managed policy files, at their fixed paths.
  for (const m of input.managed ?? MANAGED_CLAUDE_MD) take(m);
  // The home's Claude Code locations, each from its own folder.
  const claude = join(home, ".claude");
  take(join(claude, "CLAUDE.md"));
  walk(join(claude, "rules"), all);
  if (lstat(join(claude, "projects"))?.isDirectory() === true)
    for (const p of list(join(claude, "projects")) ?? []) {
      if (p.isSymbolicLink()) links.add(join(claude, "projects", p.name));
      else if (p.isDirectory()) walk(join(claude, "projects", p.name, "memory"), all);
    }
  if (places.autoMemoryDirectory !== undefined) walk(places.autoMemoryDirectory, all);
  // The Codex home.
  take(join(codexHome, "AGENTS.md"));
  take(join(codexHome, "AGENTS.override.md"));
  walk(join(codexHome, "memories_v2"), all);
  walk(join(codexHome, "memories"), all);

  // Each project, to the bound; the harness folders above are not walked again.
  const own = new Set([claude, join(home, ".codex"), codexHome, join(home, ".cursor")]);
  for (const project of projects)
    walk(
      project,
      (name, path) =>
        !SKIP.has(name) && (!name.startsWith(".") || DOT_KEPT.has(name)) && !own.has(path),
    );

  return {
    as_of: LOCATIONS_AS_OF,
    home,
    codex_home: codexHome,
    auto_memory_directory: places.autoMemoryDirectory ?? null,
    projects,
    roots,
    bounds,
    bounded,
    linked: links.size,
    unreadable,
    ...summarizeDiscovery([...seen.values()], roots),
  };
}

/** The words of a summary's count, as doctor's check says it. */
export const outsideText = (d: Pick<DiscoverySummary, "outside" | "groups">): string =>
  d.outside === 0
    ? "no harness memory file outside every store root"
    : `${plural(d.outside, "harness memory file")} outside every store root (${d.groups
        .map((g) => `${g.harness} ${g.kind} ${g.files}`)
        .join(", ")})`;

/** What makes the counts a floor, in words; empty when nothing does. */
export const floorText = (d: Pick<Discovery, "bounded" | "linked">): string =>
  [
    d.linked > 0 ? `${plural(d.linked, "link")} not followed` : "",
    d.bounded.length > 0 ? "the walk stopped at a bound" : "",
  ]
    .filter((x) => x !== "")
    .join(", ");

/** The text report: counts first, then each file outside a root by path, size and time. */
export function discoveryText(d: Discovery): string {
  const lines = [
    `discover: ${d.outside === 0 ? "no harness memory file" : plural(d.outside, "harness memory file")} outside every store root, ${d.inside} inside one; sizes and times only, no memory file opened`,
  ];
  for (const g of d.groups) {
    const shared = g.readers.length > 1 ? `  read by ${g.readers.join(", ")}` : "";
    lines.push(
      `  ${g.harness.padEnd(12)} ${g.kind.padEnd(18)} ${plural(g.files, "file").padStart(9)}  ${plural(g.bytes, "byte").padStart(12)}  newest ${g.newest}${shared}`,
    );
  }
  if (d.files.length > 0) {
    lines.push("outside every store root:");
    for (const f of d.files)
      lines.push(`  ${f.path}  ${plural(f.size, "byte")}  ${f.mtime}  ${f.harness} ${f.kind}`);
  }
  lines.push(
    `searched: home ${d.home}; codex home ${d.codex_home}; auto memory ${d.auto_memory_directory ?? "the default folders"}; ${d.projects.length === 0 ? "no project" : `projects ${d.projects.join(", ")}`}; store roots ${d.roots.length === 0 ? "none" : d.roots.join(", ")}; locations as of ${d.as_of}`,
  );
  if (d.linked > 0)
    lines.push(
      `linked: ${plural(d.linked, "link")} at harness locations, not followed; the counts are a floor`,
    );
  if (d.bounded.length > 0)
    lines.push(
      `bound: the walk stopped at depth ${d.bounds.depth} or ${d.bounds.entries} entries under ${d.bounded.join(", ")}; the counts are a floor`,
    );
  if (d.unreadable > 0) lines.push(`unreadable: ${plural(d.unreadable, "folder")} not listed`);
  return `${lines.join("\n")}\n`;
}

/** The walk's inputs from a command's flags and the environment: CODEX_HOME, the settings key. */
export function discoverInput(
  io: Pick<Io, "cwd" | "home" | "env">,
  flags: { home?: string; project?: readonly string[]; root?: readonly string[] },
): DiscoverInput {
  const home = resolve(io.cwd, flags.home ?? io.home);
  const codex = io.env.CODEX_HOME;
  const auto = autoMemoryDirectory(home);
  return {
    home,
    projects: (flags.project ?? [io.cwd]).map((p) => resolve(io.cwd, p)),
    roots: (flags.root ?? []).map((r) => resolve(io.cwd, r)),
    ...(codex ? { codexHome: resolve(io.cwd, codex) } : {}),
    ...(auto === undefined ? {} : { autoMemoryDirectory: auto }),
  };
}

export async function discoverCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(args, OPTIONS.discover, false);
  const d = discoverHarnessMemory(discoverInput(io, values));
  io.out(values.json ? `${JSON.stringify(d, null, 2)}\n` : discoveryText(d));
  return 0;
}
