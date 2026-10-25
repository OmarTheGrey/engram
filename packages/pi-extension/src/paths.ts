// No-bypass on the filesystem (ADR 0014, decision D10): a file tool on a path
// inside an adapter root reads or writes the store without the Plane. Paths
// are resolved the way pi's tools resolve them (a leading `@` dropped, `~`
// expanded, relative to the session's cwd), then through realpath where the
// path or its nearest existing ancestor exists, so a symlink into the root is
// caught, and compared without case on Windows. A recursive tool (grep, find)
// is also blocked when a root lies inside the directory it searches; with no
// path it searches the cwd.
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

/** pi's tools that search a directory tree. */
const RECURSIVE = new Set(["grep", "find"]);
/** pi's tools whose path is optional (the cwd when absent). */
const OPTIONAL_PATH = new Set(["grep", "find", "ls"]);
/** Argument names that hold a path, in any tool. */
const PATH_KEYS = /^(path|paths|file|files|file_?path|filepath|dir|directory|cwd|root|target)$/i;

/** The paths a tool call names, and whether the tool descends into directories. */
export function toolPaths(
  toolName: string,
  input: Record<string, unknown>,
): { paths: (string | undefined)[]; recursive: boolean } {
  const paths: (string | undefined)[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (!PATH_KEYS.test(key)) continue;
    if (typeof value === "string") paths.push(value);
    if (Array.isArray(value))
      paths.push(...value.filter((v): v is string => typeof v === "string"));
  }
  if (paths.length === 0 && OPTIONAL_PATH.has(toolName)) paths.push(undefined);
  return { paths, recursive: RECURSIVE.has(toolName) };
}

/** `path` as the absolute, real path a tool would reach. */
function canonical(path: string): string {
  let head = resolve(path);
  const tail: string[] = [];
  while (!existsSync(head)) {
    const parent = dirname(head);
    if (parent === head) break;
    tail.unshift(basename(head));
    head = parent;
  }
  let real = head;
  try {
    real = realpathSync.native(head);
  } catch {
    // unreadable: keep the normalised path
  }
  const full = join(real, ...tail);
  return process.platform === "win32" ? full.toLowerCase() : full;
}

/** Whether `child` is `parent` or inside it. */
function within(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** A tool's path argument resolved against the cwd, as pi's path utilities do. */
function resolveToolPath(path: string, cwd: string): string {
  let p = path.startsWith("@") ? path.slice(1) : path;
  if (p === "~" || p.startsWith("~/") || p.startsWith("~\\")) p = join(homedir(), p.slice(1));
  return resolve(cwd, p);
}

export interface RootCheck {
  cwd: string;
  roots: readonly string[];
  /** The tool descends into directories: also blocked when a root is inside the path. */
  recursive: boolean;
}

/** The store root `path` reaches, if any; an absent path is the cwd. */
export function storeRootOf(path: string | undefined, check: RootCheck): string | undefined {
  const target = canonical(resolveToolPath(path ?? ".", check.cwd));
  return check.roots.find((root) => {
    const r = canonical(root);
    return within(target, r) || (check.recursive && within(r, target));
  });
}
