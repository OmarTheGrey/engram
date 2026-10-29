// No-bypass on the filesystem (ADR 0014, decision D10): a file tool on a path
// inside an adapter root reads or writes the store without the Plane. Paths
// are resolved the way pi's tools resolve them (utils/paths.js in pi 1.3.0:
// unicode spaces made plain, a leading `@` dropped, on Windows a Git Bash,
// MSYS, Cygwin or WSL drive path such as `/c/...` mapped to `C:\...`, `~`
// expanded, a `file://` URL made a path, relative to the session's cwd), and
// also as written, so either reading is checked; then through realpath where
// the path or its nearest existing ancestor exists, so a symlink into the
// root is caught, and compared without case on Windows. A recursive tool
// (grep, find) is also blocked when a root lies inside the directory it
// searches; with no path it searches the cwd.
//
// Which arguments are paths (review round 2, defect 4): every string under a
// key that names a path (path, file, dir, src, target, ...), at any depth of
// the input, inside objects and arrays; and every string anywhere in the input
// that is path-like on its own: absolute (`/x`, `C:\x`, `\\host\x`), from the
// home directory (`~/x`), explicitly relative (`./x`, `../x`) or a `file://`
// URL, on a single line. Other free text (a file's new content, an edit's old
// text, a search pattern) is not read as a path: a relative path mentioned
// inside such text is not checked, and a hard link to a store file from
// outside the root is not seen either.
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** pi's tools that search a directory tree. */
const RECURSIVE = new Set(["grep", "find"]);
/** pi's tools whose path is optional (the cwd when absent). */
const OPTIONAL_PATH = new Set(["grep", "find", "ls"]);
/** Argument names that hold a path, in any tool, at any depth. */
const PATH_KEY =
  /^(path|paths|file|files|file_?path|file_?paths|filepath|filename|dir|dirs|directory|directories|folder|cwd|root|target|target_?file|src|source_?path|dest|destination|out_?file|out_?dir|output_?path|input_?path|notebook_?path)$/i;
/** A string that is a path on its own, whatever key holds it. */
const PATH_LIKE = /^(\/|~(\/|\\|$)|\.\.?(\/|\\)|[A-Za-z]:[\\/]|\\\\|file:\/\/)/;
/** Unicode spaces pi's tools read as plain spaces. */
const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;

/** The paths a tool call names, and whether the tool descends into directories. */
export function toolPaths(
  toolName: string,
  input: Record<string, unknown>,
): { paths: (string | undefined)[]; recursive: boolean } {
  const paths: string[] = [];
  const visit = (value: unknown, underPathKey: boolean, depth: number) => {
    if (depth > 32) return;
    if (typeof value === "string") {
      if (underPathKey || (PATH_LIKE.test(value.trim()) && !/[\r\n]/.test(value)))
        paths.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) visit(v, underPathKey, depth + 1);
      return;
    }
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) visit(v, PATH_KEY.test(k), depth + 1);
    }
  };
  visit(input, false, 0);
  const out: (string | undefined)[] = [...new Set(paths)];
  if (out.length === 0 && OPTIONAL_PATH.has(toolName)) out.push(undefined);
  return { paths: out, recursive: RECURSIVE.has(toolName) };
}

/**
 * A Git Bash, MSYS, Cygwin or WSL drive path (`/c/x`, `/cygdrive/c/x`,
 * `/mnt/c/x`) as the Windows path it names, else undefined (review round 2,
 * defect 2). The same mapping pi's tools apply on Windows.
 */
export function shellDrivePath(path: string): string | undefined {
  if (!path.startsWith("/") || path.startsWith("//")) return undefined;
  const m = /^\/(?:mnt\/|cygdrive\/)?([a-zA-Z])(?:\/(.*))?$/.exec(path.replaceAll("\\", "/"));
  if (!m) return undefined;
  return `${(m[1] as string).toUpperCase()}:\\${(m[2] ?? "").replaceAll("/", "\\")}`;
}

/**
 * A Windows path through the machine's own admin share or a device prefix
 * (`\\localhost\C$\x`, `\\127.0.0.1\C$\x`, `\\?\C:\x`, `\\.\C:\x`) as the
 * drive path it names, else undefined (review finding R3-7). Another host's
 * share is another machine, and is not mapped.
 */
export function uncDrivePath(path: string): string | undefined {
  const m = /^[\\/]{2}(?:localhost|127\.0\.0\.1|\?|\.)[\\/]([a-zA-Z])[$:](?:[\\/](.*))?$/i.exec(
    path,
  );
  if (!m) return undefined;
  return `${(m[1] as string).toUpperCase()}:\\${(m[2] ?? "").replace(/\//g, "\\")}`;
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

/** Every absolute path a tool's path argument may reach: as pi's tools resolve it, and as written. */
function resolveToolPath(path: string, cwd: string, home: string = homedir()): string[] {
  const out = new Set<string>();
  for (const spaces of [path, path.replace(UNICODE_SPACES, " ")]) {
    let p = spaces.startsWith("@") ? spaces.slice(1) : spaces;
    if (/^file:\/\//i.test(p)) {
      try {
        p = fileURLToPath(p);
      } catch {
        // not a file URL pi could read either
      }
    }
    if (p === "~" || p.startsWith("~/") || p.startsWith("~\\")) p = join(home, p.slice(1));
    out.add(resolve(cwd, p));
    const drive = process.platform === "win32" ? shellDrivePath(p) : undefined;
    if (drive !== undefined) out.add(resolve(drive));
    const unc = process.platform === "win32" ? uncDrivePath(p) : undefined;
    if (unc !== undefined) out.add(resolve(unc));
  }
  return [...out];
}

export interface RootCheck {
  cwd: string;
  roots: readonly string[];
  /** The tool descends into directories: also blocked when a root is inside the path. */
  recursive: boolean;
  /** The folder `~` names; the process's home when absent (the hook passes the CLI's). */
  home?: string;
}

/**
 * The root `path` is an ancestor of, if any (review finding R3-13): a folder
 * holding a protected file, such as `~/.engram` for the log or `.claude` for
 * the settings, which `rm -rf` or `mv` would remove with the file. Only a
 * folder strictly inside one of `below` counts, so the project folder and the
 * home folder themselves, and anything above them, are not hits.
 */
export function ancestorOfRoot(
  path: string | undefined,
  check: RootCheck & { below: readonly string[] },
): string | undefined {
  const targets = resolveToolPath(path ?? ".", check.cwd, check.home).map(canonical);
  const stops = check.below.map(canonical);
  return check.roots.find((root) => {
    const r = canonical(root);
    return targets.some(
      (t) => t !== r && within(r, t) && stops.some((s) => t !== s && within(t, s)),
    );
  });
}

/** The store root `path` reaches, if any; an absent path is the cwd. */
export function storeRootOf(path: string | undefined, check: RootCheck): string | undefined {
  const targets = resolveToolPath(path ?? ".", check.cwd, check.home).map(canonical);
  return check.roots.find((root) => {
    const r = canonical(root);
    return targets.some((t) => within(t, r) || (check.recursive && within(r, t)));
  });
}
