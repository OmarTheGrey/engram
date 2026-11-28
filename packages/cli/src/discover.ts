// `engram discover` (card E9.10): a bounded walk of the places harnesses
// keep memory as files, each file classified by core's table
// (classifyHarnessMemory), and the counts of those outside every store root
// the flags name. It reads directory listings and each matching file's size
// and modification time; it never opens a file, so no byte of content is
// read, printed or sent (AGENTS.md rule 12). It writes nothing. Discovery
// shows that a file exists, not that a harness read it.
//
// The walk: under the home, only the table's home locations (~/.claude's
// CLAUDE.md, rules and each project's memory folder, ~/.codex's AGENTS.md
// files and memories); in each project folder, every folder down to a fixed
// depth, skipping dependency, build and version-control folders and every
// dot folder but .claude and .cursor, and never following a link. A walk
// that hits a bound says so: its counts are then a floor.
import { type Dirent, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  classifyHarnessMemory,
  type DiscoverySummary,
  type HarnessMemory,
  harnessLocationOf,
  LOCATIONS_AS_OF,
  summarizeDiscovery,
} from "@engram/core";
import { parse } from "./commands.ts";
import { plural } from "./format.ts";
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

export interface DiscoverInput {
  home: string;
  /** The project folders to walk. */
  projects: readonly string[];
  /** The configured store roots: a file inside one is memory the plane adopts. */
  roots: readonly string[];
  bounds?: { depth: number; entries: number };
}

export interface Discovery extends DiscoverySummary {
  as_of: string;
  home: string;
  projects: string[];
  roots: string[];
  /** The bounds the walk kept to. */
  bounds: { depth: number; entries: number };
  /** The folders where a walk stopped at a bound: the counts are then a floor. */
  bounded: string[];
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

/** Walks the home's locations and the projects; every matching file's stat head, never its content. */
export function discoverHarnessMemory(input: DiscoverInput): Discovery {
  const bounds = input.bounds ?? WALK_BOUNDS;
  const home = resolve(input.home);
  const projects = input.projects.map((p) => resolve(p));
  const roots = input.roots.map((r) => resolve(r));
  const seen = new Map<string, HarnessMemory>();
  const bounded: string[] = [];
  let unreadable = 0;

  const take = (path: string) => {
    if (seen.has(path) || harnessLocationOf(path, home) === undefined) return;
    let head: { size: number; mtime: string };
    try {
      const s = statSync(path);
      if (!s.isFile()) return;
      head = { size: s.size, mtime: s.mtime.toISOString() };
    } catch {
      return;
    }
    const c = classifyHarnessMemory(path, head, home);
    if (c !== undefined) seen.set(path, c);
  };

  /** Lists `start` and the folders below it, to the depth and entry bounds. */
  const walk = (start: string, enter: (name: string, dir: string) => boolean) => {
    let entries = 0;
    let stopped = false;
    const go = (dir: string, depth: number) => {
      if (stopped) return;
      const got = list(dir);
      if (got === undefined) {
        if (dir !== start) unreadable += 1;
        return;
      }
      for (const d of got) {
        if (++entries > bounds.entries) {
          stopped = true;
          return;
        }
        const path = join(dir, d.name);
        if (d.isSymbolicLink()) continue;
        if (d.isFile()) take(path);
        else if (d.isDirectory() && enter(d.name, path)) {
          // A folder below the depth bound is not listed: the counts become a floor.
          if (depth >= bounds.depth) deep = true;
          else go(path, depth + 1);
        }
      }
    };
    let deep = false;
    go(start, 0);
    if (stopped || deep) bounded.push(start);
  };

  // The home's locations, each from its own folder.
  const claude = join(home, ".claude");
  const codex = join(home, ".codex");
  take(join(claude, "CLAUDE.md"));
  walk(join(claude, "rules"), () => true);
  for (const p of list(join(claude, "projects")) ?? [])
    if (p.isDirectory() && !p.isSymbolicLink())
      walk(join(claude, "projects", p.name, "memory"), () => true);
  take(join(codex, "AGENTS.md"));
  take(join(codex, "AGENTS.override.md"));
  walk(join(codex, "memories"), () => true);

  // Each project, to the bound; the home's harness folders are walked above.
  const own = new Set([claude, codex, join(home, ".cursor")]);
  for (const project of projects)
    walk(
      project,
      (name, path) =>
        !SKIP.has(name) && (!name.startsWith(".") || DOT_KEPT.has(name)) && !own.has(path),
    );

  return {
    as_of: LOCATIONS_AS_OF,
    home,
    projects,
    roots,
    bounds,
    bounded,
    unreadable,
    ...summarizeDiscovery([...seen.values()], roots),
  };
}

/** The words of a summary's count, as discover's first line and doctor's check say it. */
export const outsideText = (d: Pick<DiscoverySummary, "outside" | "groups">): string =>
  d.outside === 0
    ? "no harness memory file outside every store root"
    : `${plural(d.outside, "harness memory file")} outside every store root (${d.groups
        .map((g) => `${g.harness} ${g.kind} ${g.files}`)
        .join(", ")})`;

/** The text report: counts first, then each file outside a root by path, size and time. */
export function discoveryText(d: Discovery): string {
  const lines = [
    `discover: ${d.outside === 0 ? "no harness memory file" : plural(d.outside, "harness memory file")} outside every store root, ${d.inside} inside one; sizes and times only, no file opened`,
  ];
  for (const g of d.groups)
    lines.push(
      `  ${g.harness.padEnd(12)} ${g.kind.padEnd(18)} ${plural(g.files, "file").padStart(9)}  ${plural(g.bytes, "byte").padStart(12)}  newest ${g.newest}`,
    );
  if (d.files.length > 0) {
    lines.push("outside every store root:");
    for (const f of d.files)
      lines.push(`  ${f.path}  ${plural(f.size, "byte")}  ${f.mtime}  ${f.harness} ${f.kind}`);
  }
  lines.push(
    `searched: home ${d.home}; ${d.projects.length === 0 ? "no project" : `projects ${d.projects.join(", ")}`}; store roots ${d.roots.length === 0 ? "none" : d.roots.join(", ")}; locations as of ${d.as_of}`,
  );
  if (d.bounded.length > 0)
    lines.push(
      `bound: the walk stopped at depth ${d.bounds.depth} or ${d.bounds.entries} entries under ${d.bounded.join(", ")}; the counts are a floor`,
    );
  if (d.unreadable > 0) lines.push(`unreadable: ${plural(d.unreadable, "folder")} not listed`);
  return `${lines.join("\n")}\n`;
}

export async function discoverCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(args, OPTIONS.discover, false);
  const d = discoverHarnessMemory({
    home: resolve(io.cwd, values.home ?? io.home),
    projects: (values.project ?? [io.cwd]).map((p) => resolve(io.cwd, p)),
    roots: (values.root ?? []).map((r) => resolve(io.cwd, r)),
  });
  io.out(values.json ? `${JSON.stringify(d, null, 2)}\n` : discoveryText(d));
  return 0;
}
