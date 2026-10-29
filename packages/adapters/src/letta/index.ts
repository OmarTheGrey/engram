// The Letta adapter (card A2, ADR 0028): Engram's items in a MemFS
// repository, Letta Code's git-backed memory, on local disk. MemFS is a git
// repository of Markdown files with YAML frontmatter (`name`, `description`)
// and a MEMORY.md index per directory; files at the root are loaded into
// every Letta prompt, and a directory with its own MEMORY.md is read on
// demand. Every memory edit is a commit.
//
// Layout. Items are `engram/<id>.md`, so they stay out of every prompt until
// the agent opens `engram/MEMORY.md`, which lists one line per item:
// `- [<id>.md](<id>.md) - <description>`. The root MEMORY.md gains one line
// naming `engram/` and is otherwise left as written. An item file is
// `---\n<frontmatter>---\n<body>`: Letta's `name` (the memory's label,
// `engram/<id>`) and `description` (title, class, scope and version), then
// every other item field under the one key `engram`, and the content as the
// body. The bytes are LF only: content holding a carriage return or a lone
// surrogate is stored as JSON, which escapes it, so no line-ending conversion
// git applies on add or checkout can change an item; a file read back with
// CRLF line ends (a checkout under `core.autocrlf`) is read as LF. Every
// write is parsed back before it is stored and refused unless it round-trips
// exactly.
//
// Git. One commit per write and per delete, touching only the item file and
// engram/MEMORY.md: a new file is marked with `git add --intent-to-add
// --force` (an entry a plain `git commit` by another client never commits;
// another client's `git commit -a` or `git add -A` does take it), then
// `git commit --only -- <the paths>` commits exactly those paths from the
// working tree, so anything else the user staged stays staged and
// uncommitted. Commits are made with the repository's own identity,
// configuration and hooks; when no user.name or user.email is configured and
// the environment sets none, as `Engram <engram@localhost>` through
// GIT_AUTHOR_* and GIT_COMMITTER_*. Whether the repository already holds the
// bytes is decided before anything is staged, against `HEAD:<path>`; then
// rewriting identical bytes makes no commit, and every failure of the add or
// the commit is a failure: the files are put back as they were and the paths
// unstaged, so a write or delete is all or nothing, and a restore that fails
// is reported with both errors. Nothing is committed while HEAD is detached
// or a rebase, merge, cherry-pick, revert or bisect is in progress. Opening
// an empty folder runs `git init`; opening a repository makes one setup
// commit (engram/MEMORY.md and the root line) when they are missing. Nothing
// else is ever run: no fetch, pull, push or clone; GIT_TERMINAL_PROMPT=0, and
// the git variables that would point a call at another repository or index
// are removed from its environment (git.ts).
//
// What it never does: follow a symlink or junction, or read or replace a hard
// link (a file with more than one name, maybe outside the repository), for
// engram/, an item file, engram/MEMORY.md or the root MEMORY.md; accept a key
// other than `engram/<lowercase UUID>.md` (so nothing under .git, nothing
// outside engram/, no traversal); open a folder that is neither empty nor a
// repository's top level, an empty folder inside another repository, or a
// bare repository. A `.git` pointer file (a worktree, a submodule) is opened
// and the repository it points at is committed to.
//
// Writes and deletes run one at a time within the instance and hold the lock
// file `engram.lock` in the repository's git directory (../lock.ts) against
// other instances and processes; it is stale after LETTA_LOCK_STALE_MS, more
// than every git call a write makes can take. Another git client (Letta
// itself, or the user) is not held by it: git's index lock refuses one of two
// simultaneous index updates, and a refused write is restored whole.
// `search` scans engram/ at query time and matches every term (MemFS has no
// search of its own; native_search false); `history` reads git
// (native_history true).
import type { Dirent, Stats } from "node:fs";
import { lstat, mkdir, open, readdir, readFile, realpath, rm, rmdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  type MemoryItem,
  MemoryItem as MemoryItemSchema,
  type StoreDiagnostic,
} from "@engram/core";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { type Adapter, ForeignRefError, type StoreRef } from "../contract.ts";
import { atomicWrite, isMissing, isRecord, sleep } from "../fs-safe.ts";
import { createStoreLock, LOCK_WAIT_MS, type LockSeams } from "../lock.ts";
import { GIT_TIMEOUT_MS, type GitOptions, type GitResult, git, runGit } from "./git.ts";

export { GitMissingError, gitVersion } from "./git.ts";

export interface LettaAdapterOptions {
  /** The MemFS repository's top level, or an empty (or missing) folder to initialise as one. */
  root: string;
  /** Matches `StoreRef.adapter`. Default `letta`. */
  name?: string;
  /** How long a write or delete waits for another writer's live lock, in ms. Default 10 000. */
  lockWaitMs?: number;
  /** Test seams for the lock, never set in production (../lock.ts). */
  lockSeams?: LockSeams;
  /**
   * Test seam, never set in production: runs every git call of the adapter
   * after it opened, so a test can make one call fail (a restore's reset).
   * Default `runGit`.
   */
  gitRunner?: (args: readonly string[], options: GitOptions) => Promise<GitResult>;
}

export interface LettaAdapter extends Adapter {
  /** The repository's top level, resolved. */
  readonly root: string;
  /** The entries of engram/ the latest list or search could not read, by key. */
  diagnostics(): StoreDiagnostic[];
  search(query: string, scopeFilter: readonly string[]): Promise<MemoryItem[]>;
  /** Every committed version of the item, oldest first, from git. */
  history(ref: StoreRef): Promise<MemoryItem[]>;
}

/** A key, or a path the adapter would touch, that it refuses. */
export class UnsafeLettaPathError extends Error {
  constructor(path: string, why: string) {
    super(`letta adapter: ${JSON.stringify(path)} ${why}`);
    this.name = "UnsafeLettaPathError";
  }
}

/** A repository state in which the adapter commits nothing. */
export class RepositoryBusyError extends Error {
  constructor(root: string, why: string) {
    super(`letta adapter: ${root} ${why}; Engram commits nothing until it ends`);
    this.name = "RepositoryBusyError";
  }
}

/** A folder the adapter will not open as a MemFS repository. */
export class NotMemfsRepositoryError extends Error {
  constructor(root: string, why: string) {
    super(`letta adapter: ${root} ${why}`);
    this.name = "NotMemfsRepositoryError";
  }
}

const DIR = "engram";
const INDEX = "MEMORY.md";
const INDEX_KEY = `${DIR}/${INDEX}`;
const LOCK_FILE = "engram.lock";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ID_RE = new RegExp(`^${UUID}$`);
const FILE_RE = new RegExp(`^${UUID}\\.md$`);
const KEY_RE = new RegExp(`^${DIR}/(${UUID})\\.md$`);
/** The root MEMORY.md line naming engram/; its link is how the adapter finds it. */
const ROOT_LINK = `](${DIR}/${INDEX})`;
const ROOT_LINE = `- [${DIR}/](${DIR}/${INDEX}) - memories written through Engram's control plane, one file per item; open ${DIR}/${INDEX} for the list`;
const INDEX_HEAD = [
  "# Engram",
  "",
  "Memories written through Engram's control plane, one file per item. Engram commits every change; edit them through Engram, not by hand.",
  "",
];
/**
 * The Letta lock's stale age: a write or delete holds it for at most five git
 * calls (cat-file, add, commit, and on failure reset), each bounded by
 * GIT_TIMEOUT_MS, so a live holder is never judged stale.
 */
export const LETTA_LOCK_STALE_MS = 5 * GIT_TIMEOUT_MS;
/** Files in the git directory that mean an operation is in progress there. */
const IN_PROGRESS = [
  "rebase-merge",
  "rebase-apply",
  "CHERRY_PICK_HEAD",
  "REVERT_HEAD",
  "MERGE_HEAD",
  "BISECT_LOG",
];
const FALLBACK_NAME = "Engram";
const FALLBACK_EMAIL = "engram@localhost";
/** Per command: never refuse an LF-only file because a checkout would give it CRLF. */
const SAFE = ["-c", "core.safecrlf=false"];
const NOT_REGULAR =
  "is not a regular file; symlinks, junctions, directories and devices are never followed";
const HARD_LINKED =
  "is a hard link (the file has more than one name, maybe outside the repository) and is never read or replaced";
type ContentFormat = "text" | "json" | "skill";

const canonical = (v: unknown): unknown => JSON.parse(JSON.stringify(v));
const sameBytes = (a: Buffer | undefined, b: Buffer | undefined) =>
  a === undefined || b === undefined ? a === b : a.equals(b);

const textOf = (content: MemoryItem["content"]) =>
  typeof content === "string"
    ? content
    : "body" in content && typeof content.body === "string"
      ? content.body
      : JSON.stringify(content);

/** The first non-empty line of the content, without heading marks, at most 60 code points, well-formed. */
function titleOf(item: MemoryItem): string {
  const line = textOf(item.content)
    .split(/\r?\n|\r/)
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find(Boolean);
  const title = (line ?? "untitled").replace(/[[\]]/g, "").replace(/\s+/g, " ").toWellFormed();
  const points = [...title];
  return points.length > 60 ? `${points.slice(0, 60).join("").trimEnd()}...` : title;
}

/** Letta's `description`, also the item's index line: one line, well-formed. */
const describe = (item: MemoryItem) =>
  `${titleOf(item)}; ${item.class} memory in ${item.scope}, version ${item.version}`;

const indexLine = (item: MemoryItem) => `- [${item.id}.md](${item.id}.md) - ${describe(item)}`;

/** The text with `line` in place of the line linking `<id>.md`, or without it when `line` is undefined. */
function withIndexLine(text: string | undefined, id: string, line: string | undefined): string {
  const lines =
    text === undefined || text === ""
      ? [...INDEX_HEAD]
      : text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  const links = (l: string) => l.startsWith("- [") && l.includes(`](${id}.md)`);
  const at = lines.findIndex(links);
  const kept = lines.filter((l) => !links(l));
  if (line !== undefined) kept.splice(at >= 0 ? at : kept.length, 0, line);
  return `${kept.join("\n")}\n`;
}

/** Whether a body can be written as it is: well-formed and free of carriage returns. */
const plain = (text: string) => text.isWellFormed() && !text.includes("\r");

/** The item file's text; refuses an item it could not read back exactly. */
function serialise(item: MemoryItem, key: string, parse: (text: string) => MemoryItem): string {
  const { content, store_ref: _ref, ...fields } = item;
  let format: ContentFormat;
  let body: string;
  const engram: Record<string, unknown> = { ...fields };
  if (typeof content === "string" && plain(content)) {
    format = "text";
    body = content;
  } else if (item.class === "procedural" && plain(item.content.body)) {
    format = "skill";
    body = item.content.body;
    engram.tools = item.content.tools;
  } else {
    format = "json";
    body = JSON.stringify(content, null, 2);
  }
  engram.content_format = format;
  const front = stringifyYaml(
    { name: `${DIR}/${item.id}`, description: describe(item), engram },
    { lineWidth: 0 },
  );
  const text = `---\n${front}---\n${body}`;
  let back: MemoryItem | undefined;
  try {
    back = parse(text);
  } catch {
    back = undefined;
  }
  if (
    text.includes("\r") ||
    back === undefined ||
    !isDeepStrictEqual(canonical(back), canonical(item))
  ) {
    throw new Error(
      `letta adapter: ${key} would not read back exactly as written (a field holds characters the file cannot carry); nothing was written`,
    );
  }
  return text;
}

export async function createLettaAdapter(options: LettaAdapterOptions): Promise<LettaAdapter> {
  const name = options.name ?? "letta";
  const { root, gitDir } = await openRepository(resolve(options.root));
  const dir = join(root, DIR);
  const indexPath = join(dir, INDEX);
  const env = await identityFallback(root);
  const runner = options.gitRunner ?? runGit;
  const gTry = (args: string[], input?: string) =>
    runner([...SAFE, ...args], { cwd: root, env, input });
  /**
   * A git call that must succeed. While another git client holds the
   * repository's index.lock (its own add or commit), git refuses at once
   * before changing anything, so the call is retried for up to about two
   * seconds; so is any refusal `retryAlso` accepts (a commit's ref
   * compare-and-swap, when nothing it commits has changed). Any other
   * failure, or a refusal outlasting that, rejects.
   */
  const g = async (
    args: string[],
    input?: string,
    retryAlso?: (stderr: string) => Promise<boolean>,
  ) => {
    const retryable = async (r: GitResult) =>
      r.code !== 0 &&
      (r.stderr.includes("index.lock") || (retryAlso !== undefined && (await retryAlso(r.stderr))));
    let result = await gTry(args, input);
    for (let attempt = 1; attempt <= 12 && (await retryable(result)); attempt++) {
      await sleep(Math.min(10 * 2 ** attempt, 300));
      result = await gTry(args, input);
    }
    if (result.code !== 0) {
      throw new Error(
        `letta adapter: git ${args[0]} failed (exit ${result.code}): ${result.stderr.trim() || "no message"}`,
      );
    }
    return result.stdout;
  };
  let lastDiagnostics: StoreDiagnostic[] = [];

  // One at a time within this instance, and the lock file against others.
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };
  const lock = createStoreLock({
    path: join(gitDir, LOCK_FILE),
    waitMs: options.lockWaitMs ?? LOCK_WAIT_MS,
    label: "letta adapter",
    guards: "repository",
    staleMs: LETTA_LOCK_STALE_MS,
    seams: options.lockSeams,
  });
  const exclusive = <T>(fn: () => Promise<T>) => serial(() => lock(fn));

  const keyOf = (ref: StoreRef): string => {
    if (ref.adapter !== name) throw new ForeignRefError(name, ref);
    const m = KEY_RE.exec(ref.key);
    if (!m) throw new UnsafeLettaPathError(ref.key, "is not an Engram item key (engram/<id>.md)");
    return m[1] as string;
  };

  /** engram/ must be a real directory, never a symlink or junction; false when it is missing. */
  async function checkDir(): Promise<boolean> {
    let info: Stats;
    try {
      info = await lstat(dir);
    } catch (e) {
      if (isMissing(e)) return false;
      throw e;
    }
    if (!info.isDirectory()) {
      throw new UnsafeLettaPathError(
        `${DIR}/`,
        "is not a directory inside the repository; symlinks and junctions are never followed",
      );
    }
    return true;
  }

  /** The bytes of a regular file with one name, undefined when missing; refuses anything else. */
  async function readRegular(path: string, label: string): Promise<Buffer | undefined> {
    let handle: Awaited<ReturnType<typeof open>>;
    try {
      const link = await lstat(path);
      if (!link.isFile()) throw new UnsafeLettaPathError(label, NOT_REGULAR);
      handle = await open(path, "r");
    } catch (e) {
      if (isMissing(e)) return undefined;
      throw e;
    }
    try {
      const [opened, link] = await Promise.all([handle.stat(), lstat(path)]);
      if (!opened.isFile() || !link.isFile() || opened.ino !== link.ino || opened.dev !== link.dev)
        throw new UnsafeLettaPathError(label, NOT_REGULAR);
      if (opened.nlink > 1 || link.nlink > 1) throw new UnsafeLettaPathError(label, HARD_LINKED);
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  }

  /** Parses an item file's text; throws naming the key when it does not hold the item its name says. */
  function parseItem(raw: string, id: string): MemoryItem {
    const key = `${DIR}/${id}.md`;
    const text = raw.replace(/\r\n/g, "\n");
    const close = text.startsWith("---\n") ? text.indexOf("\n---\n", 3) : -1;
    if (close < 0) throw new Error(`letta adapter: ${key} has no frontmatter`);
    let meta: unknown;
    try {
      meta = parseYaml(text.slice(4, close + 1));
    } catch (e) {
      throw new Error(`letta adapter: ${key} has unreadable frontmatter: ${(e as Error).message}`);
    }
    if (!isRecord(meta) || !isRecord(meta.engram))
      throw new Error(`letta adapter: ${key} has no Engram metadata`);
    const { content_format: format, tools, ...fields } = meta.engram;
    const body = text.slice(close + 5);
    let content: unknown;
    if (format === "text") content = body;
    else if (format === "skill") content = { body, tools };
    else if (format === "json") {
      try {
        content = JSON.parse(body);
      } catch (e) {
        throw new Error(
          `letta adapter: ${key} has a JSON body that does not parse: ${(e as Error).message}`,
        );
      }
    } else throw new Error(`letta adapter: ${key} has an unknown content_format`);
    const parsed = MemoryItemSchema.safeParse({
      ...fields,
      content,
      store_ref: { adapter: name, key },
    });
    if (!parsed.success)
      throw new Error(`letta adapter: ${key} does not hold a valid item: ${parsed.error.message}`);
    if (parsed.data.id !== id)
      throw new Error(`letta adapter: ${key} holds item ${parsed.data.id}`);
    return parsed.data;
  }

  async function load(id: string): Promise<MemoryItem | undefined> {
    if (!(await checkDir())) return undefined;
    const bytes = await readRegular(join(dir, `${id}.md`), `${DIR}/${id}.md`);
    return bytes === undefined ? undefined : parseItem(bytes.toString("utf8"), id);
  }

  /** Every readable item in engram/; the others are skipped and recorded for `diagnostics()`. */
  async function all(): Promise<MemoryItem[]> {
    const items: MemoryItem[] = [];
    const skipped: StoreDiagnostic[] = [];
    let entries: Dirent[] = [];
    if (await checkDir()) entries = await readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((e) => FILE_RE.test(e.name))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of files) {
      const key = `${DIR}/${entry.name}`;
      try {
        if (!entry.isFile()) throw new UnsafeLettaPathError(key, NOT_REGULAR);
        const bytes = await readRegular(join(dir, entry.name), key);
        if (bytes) items.push(parseItem(bytes.toString("utf8"), entry.name.slice(0, -3)));
      } catch (e) {
        skipped.push({ key, reason: (e as Error).message });
      }
    }
    lastDiagnostics = skipped;
    return items;
  }

  /**
   * Refuses to commit while HEAD is detached or an operation (rebase, merge,
   * cherry-pick, revert, bisect) is in progress: a commit then would land
   * where the operation's end can drop it, after the plane recorded it.
   */
  async function checkRepositoryState() {
    for (const name of IN_PROGRESS) {
      try {
        await lstat(join(gitDir, name));
      } catch (e) {
        if (isMissing(e)) continue;
        throw e;
      }
      throw new RepositoryBusyError(root, `has ${name} in its git directory`);
    }
    // The HEAD file names the branch in the files ref backend; anything else
    // (a detached sha, or reftable's placeholder) is asked of git.
    const head = await readFile(join(gitDir, "HEAD"), "utf8").catch(() => "");
    const branch = /^ref: refs\/heads\/(\S+)\s*$/.exec(head)?.[1];
    if (branch !== undefined && branch !== ".invalid") return;
    if ((await gTry(["symbolic-ref", "--quiet", "HEAD"])).code !== 0)
      throw new RepositoryBusyError(root, "has a detached HEAD");
  }

  /** The bytes HEAD holds at each path, undefined where it holds none (or there is no HEAD). */
  async function headBlobs(keys: string[]): Promise<(Buffer | undefined)[]> {
    const out = await g(["cat-file", "--batch"], keys.map((k) => `HEAD:${k}\n`).join(""));
    const blobs: (Buffer | undefined)[] = [];
    let at = 0;
    for (let i = 0; i < keys.length; i++) {
      const eol = out.indexOf(0x0a, at);
      const header = out.subarray(at, eol).toString("utf8");
      at = eol + 1;
      const blob = /^[0-9a-f]+ blob (\d+)$/.exec(header);
      if (!blob) {
        blobs.push(undefined);
        continue;
      }
      const size = Number(blob[1]);
      blobs.push(out.subarray(at, at + size));
      at += size + 1;
    }
    return blobs;
  }

  /** One file a commit changes: its next bytes (undefined: removed) and its bytes before. */
  interface Change {
    key: string;
    path: string;
    next: string | undefined;
    previous: Buffer | undefined;
  }

  const putFile = async (c: Change, bytes: string | Buffer | undefined) => {
    const folder = join(c.path, "..");
    const base = c.key.slice(c.key.lastIndexOf("/") + 1);
    if (bytes === undefined) await rm(c.path, { force: true, maxRetries: 10, retryDelay: 10 });
    else await atomicWrite(c.path, folder, base, bytes);
  };

  /**
   * Commits the changes as one commit of exactly their paths. Whether HEAD
   * already holds the bytes is decided first, before anything is staged:
   * then the working tree is brought in line and nothing is committed. Every
   * failure after that puts the files back, unstages the paths and rethrows;
   * a failed restore is reported with both errors. Returns whether it committed.
   */
  async function commitChanges(changes: Change[], message: string): Promise<boolean> {
    await checkRepositoryState();
    const head = await headBlobs(changes.map((c) => c.key));
    const same = (i: number) => {
      const c = changes[i] as Change;
      const h = head[i];
      return c.next === undefined ? h === undefined : h?.toString("utf8") === c.next;
    };
    if (changes.every((_, i) => same(i))) {
      for (const c of changes) await putFile(c, c.next);
      return false;
    }
    // A path HEAD lacks and the change removes was never committed: nothing to commit for it.
    const paths = changes.filter((c, i) => c.next !== undefined || head[i] !== undefined);
    const fresh = changes.filter((c, i) => c.next !== undefined && head[i] === undefined);
    try {
      for (const c of changes) await putFile(c, c.next);
      if (fresh.length > 0)
        await g(["add", "--intent-to-add", "--force", "--", ...fresh.map((c) => c.key)]);
      // `cannot lock ref 'HEAD'`: another commit moved HEAD between this
      // commit reading it and updating it, and git changed nothing. Retried
      // only while HEAD still holds, at every path this commit names, the
      // bytes it held before; otherwise another commit changed them and
      // this one would overwrite that change, so it is refused (N3).
      const keys = changes.map((c) => c.key);
      await g(
        ["commit", "--quiet", "-m", message, "--only", "--", ...paths.map((c) => c.key)],
        undefined,
        async (stderr) => {
          if (!stderr.includes("cannot lock ref")) return false;
          const now = await headBlobs(keys);
          return now.every((b, i) => sameBytes(b, head[i]));
        },
      );
      return true;
    } catch (e) {
      try {
        for (const c of changes) await putFile(c, c.previous);
        await g(["reset", "--quiet", "--", ...paths.map((c) => c.key)]);
      } catch (undo) {
        throw new Error(
          `letta adapter: ${(e as Error).message}; restoring ${changes.map((c) => c.key).join(" and ")} failed too (${(undo as Error).message})`,
          { cause: e },
        );
      }
      throw e;
    }
  }

  // The layout: engram/, its MEMORY.md and the root line, one setup commit when any is missing.
  await exclusive(async () => {
    const created = !(await checkDir());
    if (created) await mkdir(dir);
    try {
      const index = await readRegular(indexPath, INDEX_KEY);
      const rootIndexPath = join(root, INDEX);
      const rootIndex = await readRegular(rootIndexPath, INDEX);
      const rootText = rootIndex?.toString("utf8") ?? "";
      const changes: Change[] = [];
      if (index === undefined)
        changes.push({
          key: INDEX_KEY,
          path: indexPath,
          next: `${INDEX_HEAD.join("\n")}\n`,
          previous: undefined,
        });
      if (!rootText.includes(ROOT_LINK)) {
        const eol = rootText.includes("\r\n") ? "\r\n" : "\n";
        const sep = rootText === "" || rootText.endsWith("\n") ? "" : eol;
        changes.push({
          key: INDEX,
          path: rootIndexPath,
          next: `${rootText}${sep}${ROOT_LINE}${eol}`,
          previous: rootIndex,
        });
      }
      if (changes.length > 0) await commitChanges(changes, "engram: list engram/ in MEMORY.md");
    } catch (e) {
      if (created) await rmdir(dir).catch(() => undefined);
      throw e;
    }
  });

  const adapter: LettaAdapter = {
    name,
    root,
    capabilities: {
      native_validity: false,
      native_history: true,
      // MemFS searches nothing itself; `search` below is the adapter's own scan.
      native_search: false,
      native_graph: false,
    },
    diagnostics: () => lastDiagnostics.map((d) => ({ ...d })),
    write(item) {
      return exclusive(async () => {
        if (!ID_RE.test(item.id)) {
          throw new UnsafeLettaPathError(
            item.id,
            "is not a lowercase UUID; an item id names its file engram/<id>.md",
          );
        }
        const id = item.id;
        const key = `${DIR}/${id}.md`;
        const ref: StoreRef = { adapter: name, key };
        if (!(await checkDir())) await mkdir(dir);
        const previous = await readRegular(join(dir, `${id}.md`), key);
        const previousIndex = await readRegular(indexPath, INDEX_KEY);
        const stored = { ...item, store_ref: ref } as MemoryItem;
        const text = serialise(stored, key, (t) => parseItem(t, id));
        const nextIndex = withIndexLine(previousIndex?.toString("utf8"), id, indexLine(stored));
        await commitChanges(
          [
            { key, path: join(dir, `${id}.md`), next: text, previous },
            { key: INDEX_KEY, path: indexPath, next: nextIndex, previous: previousIndex },
          ],
          `engram: write ${id} (${item.class} in ${item.scope}, version ${item.version})`,
        );
        return ref;
      });
    },
    async read(ref) {
      return load(keyOf(ref));
    },
    async delete(ref) {
      const id = keyOf(ref);
      return exclusive(async () => {
        if (!(await checkDir())) return;
        const key = `${DIR}/${id}.md`;
        const previous = await readRegular(join(dir, `${id}.md`), key);
        if (previous === undefined) return;
        const previousIndex = await readRegular(indexPath, INDEX_KEY);
        const nextIndex = withIndexLine(previousIndex?.toString("utf8"), id, undefined);
        await commitChanges(
          [
            { key, path: join(dir, `${id}.md`), next: undefined, previous },
            { key: INDEX_KEY, path: indexPath, next: nextIndex, previous: previousIndex },
          ],
          `engram: delete ${id}`,
        );
      });
    },
    async list(scope) {
      return (await all()).filter((i) => i.scope === scope);
    },
    async search(query, scopeFilter) {
      if (scopeFilter.length === 0) return [];
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      return (await all()).filter((i) => {
        const text = (
          typeof i.content === "string" ? i.content : JSON.stringify(i.content)
        ).toLowerCase();
        return scopeFilter.includes(i.scope) && terms.every((t) => text.includes(t));
      });
    },
    async history(ref) {
      const id = keyOf(ref);
      const key = `${DIR}/${id}.md`;
      if ((await gTry(["rev-parse", "--verify", "--quiet", "HEAD"])).code !== 0) return [];
      const shas = (await g(["log", "--reverse", "--format=%H", "--", key]))
        .toString("utf8")
        .split("\n")
        .filter(Boolean);
      if (shas.length === 0) return [];
      const out = await g(["cat-file", "--batch"], shas.map((s) => `${s}:${key}\n`).join(""));
      const versions: MemoryItem[] = [];
      let at = 0;
      while (at < out.length) {
        const eol = out.indexOf(0x0a, at);
        const header = out.subarray(at, eol < 0 ? out.length : eol).toString("utf8");
        at = eol < 0 ? out.length : eol + 1;
        const blob = /^[0-9a-f]+ blob (\d+)$/.exec(header);
        // `<sha>:<key> missing`: the commit that deleted the file.
        if (!blob) continue;
        const size = Number(blob[1]);
        const version = parseItem(out.subarray(at, at + size).toString("utf8"), id);
        at += size + 1;
        const last = versions.at(-1);
        if (!last || !isDeepStrictEqual(canonical(last), canonical(version)))
          versions.push(version);
      }
      return versions;
    },
  };
  return adapter;
}

/**
 * Resolves `root` to a repository's top level, initialising an empty or
 * missing folder; refuses a symlinked root, a bare repository, a folder inside
 * another repository's tree that is not its top level, and a non-empty folder
 * that is not a repository.
 */
async function openRepository(root: string): Promise<{ root: string; gitDir: string }> {
  let info: Stats | undefined;
  try {
    info = await lstat(root);
  } catch (e) {
    if (!isMissing(e)) throw e;
  }
  if (info === undefined) await mkdir(root, { recursive: true });
  else if (!info.isDirectory())
    throw new NotMemfsRepositoryError(
      root,
      "is not a folder (a symlink or junction is never followed)",
    );
  const entries = await readdir(root);
  if (entries.includes(".git")) {
    const dotGit = await lstat(join(root, ".git"));
    if (dotGit.isSymbolicLink())
      throw new NotMemfsRepositoryError(root, "has a .git that is a symlink; it is never followed");
  } else if (entries.length > 0) {
    throw new NotMemfsRepositoryError(
      root,
      "is neither a git repository's top level nor an empty folder; the Letta adapter opens a MemFS repository or initialises one in an empty folder",
    );
  } else {
    // An empty folder inside another repository's tree is part of that
    // repository; initialising a nested one there is refused, not guessed.
    const outer = await runGit(["rev-parse", "--show-toplevel"], { cwd: root });
    if (outer.code === 0) {
      if (info === undefined) await rmdir(root).catch(() => undefined);
      throw new NotMemfsRepositoryError(
        root,
        `is an empty folder inside the repository at ${outer.stdout.toString("utf8").trim()}; the Letta adapter initialises a repository only outside any other`,
      );
    }
    await git(["init", "--quiet"], { cwd: root });
  }
  const [bare, top, gitDir] = (
    await git(["rev-parse", "--is-bare-repository", "--show-toplevel", "--absolute-git-dir"], {
      cwd: root,
    })
  )
    .toString("utf8")
    .trim()
    .split(/\r?\n/);
  if (bare !== "false" || top === undefined || gitDir === undefined)
    throw new NotMemfsRepositoryError(root, "is a bare repository, not a MemFS checkout");
  const real = await realpath(root);
  if ((await realpath(top)) !== real)
    throw new NotMemfsRepositoryError(
      root,
      `is inside the repository at ${top}, not its top level`,
    );
  return { root: real, gitDir };
}

/**
 * GIT_AUTHOR_* and GIT_COMMITTER_* for the parts of an identity neither the
 * repository's configuration (any level git reads) nor the environment sets.
 */
async function identityFallback(root: string): Promise<Record<string, string>> {
  const result = await runGit(["config", "--get-regexp", "^user\\.(name|email)$"], { cwd: root });
  const set = new Set(
    result.stdout
      .toString("utf8")
      .split(/\r?\n/)
      .map((l) => l.split(" ")[0]?.toLowerCase())
      .filter(Boolean),
  );
  const env: Record<string, string> = {};
  const fill = (part: "NAME" | "EMAIL", value: string) => {
    if (set.has(`user.${part.toLowerCase()}`)) return;
    for (const who of ["AUTHOR", "COMMITTER"]) {
      const v = `GIT_${who}_${part}`;
      if (!process.env[v]) env[v] = value;
    }
  };
  fill("NAME", FALLBACK_NAME);
  fill("EMAIL", FALLBACK_EMAIL);
  return env;
}
