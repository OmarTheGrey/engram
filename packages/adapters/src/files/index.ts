// The files adapter (card A3, ADR 0013): a folder of Markdown in the Claude
// Code auto-memory layout. One memory per file, YAML frontmatter with Claude
// Code's `name`, `description` and `metadata.type`, the body after it, and a
// MEMORY.md index with one `- [Title](file.md) - hook` line per memory.
//
// An item the plane writes is `<id>.md`: the body is its content and the
// frontmatter adds every other item field under the one key `engram`, so a
// read returns the exact item. A file with no `engram` key is a memory Claude
// Code (or a person) wrote; it lists as a read-only item with the defaults in
// `importedItem` below. This adapter does file I/O. No item field comes from
// the clock: an imported item's valid_from comes from the options or the
// file's mtime. Only the folder lock reads the wall clock (see below).
//
// What it never does (review fix pass, ADR 0013 amendments):
// - Read or replace anything that is not a regular file with one name,
//   directly inside the root: a symlink, junction, directory or device, and a
//   hard link (a file with more than one name, any of which may be outside
//   the root; the link count cannot say which), is skipped by list and search
//   and refused by read, write and delete. MEMORY.md is held to the same rule.
// - Let one malformed file break the folder: list and search skip it and
//   report it through `diagnostics()`; a read of it still throws.
// - Depend on the file system's case rules: keys match directory entries
//   exactly, item ids must be lowercase, and a write is refused when a file
//   whose name differs only in case exists.
// - Leave half a write: MEMORY.md is checked before the item file is
//   written, and if the index update still fails, the item file is removed
//   (or its previous bytes restored), so a write or delete that rejects
//   leaves the folder as it was.
// - Lose MEMORY.md lines to another adapter instance or process: every write
//   and delete holds the lock file `.engram.lock` in the root, and temporary
//   files have unique names.
//
// The lock file holds its holder's pid, host name, a per-instance token and
// the wall-clock time it was taken (JSON). The adapter has no injected clock;
// that time is a fact of store I/O, read by other writers, never a policy
// input. A waiting writer breaks the lock when it is stale: its host is this
// machine and its pid is not alive (a crashed writer), or it is older than
// LOCK_STALE_MS. A lock with no readable holder (a writer that stopped between
// creating and filling it) is judged by its file time. Otherwise the writer
// waits up to `lockWaitMs` (ten seconds by default) by the wall clock, then
// refuses, naming the holder. Breaking is serialised through a second file,
// `.engram.lock.break`, so two waiters never remove each other's fresh lock;
// a holder removes the lock only while it still holds its own token.
//
// Engram's own index lines separate the link from the hook with " - "
// (repository content avoids the em dash). Lines Claude Code wrote, which
// may use an em dash, are left exactly as they are.
import { createHash, randomUUID } from "node:crypto";
import type { Dirent } from "node:fs";
import { lstat, mkdir, open, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { type MemoryItem, MemoryItem as MemoryItemSchema, Scope } from "@engram/core";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { type Adapter, ForeignRefError, type StoreRef } from "../contract.ts";

export interface FilesAdapterOptions {
  /** The memory folder, for example `~/.claude/projects/<project>/memory`. */
  root: string;
  /** Matches `StoreRef.adapter`. Default `files`. */
  name?: string;
  /** Person id whose folder this is; imported files get owner and scope `person:<owner>`. */
  owner: string;
  /** valid_from for imported files (ISO 8601, Z). Default: each file's modification time. */
  importValidFrom?: string;
  /** Confidence for imported files. Default 0.5: model-written, never reviewed. */
  importConfidence?: number;
  /** How long a write or delete waits for another writer's live lock, in ms. Default 10 000. */
  lockWaitMs?: number;
}

/** A folder entry that list or search skipped, and why. */
export interface FileDiagnostic {
  key: string;
  reason: string;
}

export interface FilesAdapter extends Adapter {
  /** The entries the latest list or search skipped (malformed, or not a regular file), by key. */
  diagnostics(): FileDiagnostic[];
}

/** A store_ref key that is not a plain Markdown file name, or not a regular file, inside the root. */
export class UnsafeKeyError extends Error {
  constructor(key: string, why = "is not a memory file name inside the root") {
    super(`files adapter: key ${JSON.stringify(key)} ${why}`);
  }
}

/** A write or delete aimed at a memory file Engram did not write. */
export class ReadOnlyItemError extends Error {
  constructor(key: string) {
    super(`files adapter: ${key} has no Engram metadata and is read-only`);
  }
}

const INDEX = "MEMORY.md";
const LOCK = ".engram.lock";
const LOCK_BREAK = ".engram.lock.break";
/** Default wait for a live lock, by the wall clock. */
const LOCK_WAIT_MS = 10_000;
/**
 * A lock older than this is stale whoever holds it. A live holder keeps the
 * lock for one write or delete: a directory listing, a read of one item file
 * and of MEMORY.md, and two atomic writes whose renames retry at most five
 * times over 300 ms. That takes milliseconds on a local disk and well under a
 * second on a slow share, so a minute leaves two orders of magnitude for a
 * live writer, while a writer that crashed on another machine (whose pid this
 * machine cannot check) blocks the folder for one minute at most.
 */
export const LOCK_STALE_MS = 60_000;
const BUSY = ["EEXIST", "EPERM", "EACCES", "EBUSY"];
const NOT_REGULAR =
  "is not a regular file inside the root; symlinks, directories and devices are never followed";
const HARD_LINKED =
  "is a hard link (the file has more than one name, maybe outside the root) and is never read or replaced";
const CLAUDE_TYPES = ["user", "feedback", "project", "reference"] as const;
type ContentFormat = "text" | "json" | "skill";

/** Unique within the process; the pid separates processes. */
let tempCounter = 0;

/**
 * The id of an imported file: a UUIDv7 derived from the file key alone, so it
 * survives edits to the file. Its time field is zero, so imported items sort
 * before every item the plane wrote; the other 74 bits come from sha256(key).
 */
export function importedItemId(key: string): string {
  const h = createHash("sha256").update(`engram/files/${key}`).digest("hex");
  const variant = ((Number.parseInt(h.slice(3, 4), 16) & 0x3) | 0x8).toString(16);
  return `00000000-0000-7${h.slice(0, 3)}-${variant}${h.slice(4, 7)}-${h.slice(7, 19)}`;
}

/** Plain file name, `.md`, not hidden, not the index, nothing Windows would reinterpret. */
function checkKey(key: string): string {
  const bad =
    !key.toLowerCase().endsWith(".md") ||
    key.startsWith(".") ||
    key.toLowerCase() === INDEX.toLowerCase() ||
    [...key].some((c) => c < " " || '/\\:*?"<>|'.includes(c));
  if (bad) throw new UnsafeKeyError(key);
  return key;
}

const isMemoryFile = (name: string) => {
  try {
    checkKey(name);
    return true;
  } catch {
    return false;
  }
};

/** Splits `---` frontmatter from the body; the body keeps every byte after the closing line. */
function splitFrontmatter(text: string): { front: string | undefined; body: string } {
  const open = /^---\r?\n/.exec(text);
  if (!open) return { front: undefined, body: text };
  const close = /\r?\n---\r?(?:\n|$)/g;
  close.lastIndex = open[0].length - 1 - (open[0].endsWith("\r\n") ? 1 : 0);
  const end = close.exec(text);
  if (!end) return { front: undefined, body: text };
  return {
    front: text.slice(open[0].length, Math.max(open[0].length, end.index)),
    body: text.slice(end.index + end[0].length),
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const textOf = (content: MemoryItem["content"]) =>
  typeof content === "string"
    ? content
    : "body" in content && typeof content.body === "string"
      ? content.body
      : JSON.stringify(content);

/**
 * Claude Code's `name`: the first non-empty line of the content, without
 * heading marks, at most 60 code points (a surrogate pair is never split) and
 * always well-formed UTF-16, so MEMORY.md never gains a replacement character.
 */
function titleOf(item: MemoryItem): string {
  const line = textOf(item.content)
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find(Boolean);
  const title = (line ?? item.id).replace(/[[\]]/g, "").replace(/\s+/g, " ").toWellFormed();
  const points = [...title];
  return points.length > 60 ? `${points.slice(0, 60).join("").trimEnd()}...` : title;
}

const hookOf = (item: MemoryItem) =>
  `${item.class} memory in ${item.scope}, version ${item.version}`;

/** Engram scope to Claude Code type: a person's or role's memory is `user`, a shared one `project`. */
const claudeTypeOf = (scope: string) =>
  scope.startsWith("person:") || scope.startsWith("role:") ? "user" : "project";

/**
 * The file for an item. Text and skill bodies are written as they are; a
 * body that is not well-formed UTF-16 (a lone surrogate) would lose that
 * code unit in UTF-8, so such content is stored as JSON, which escapes it.
 */
function serialise(item: MemoryItem): string {
  const { content, store_ref: _ref, ...fields } = item;
  let format: ContentFormat;
  let body: string;
  const engram: Record<string, unknown> = { ...fields };
  if (typeof content === "string" && content.isWellFormed()) {
    format = "text";
    body = content;
  } else if (item.class === "procedural" && item.content.body.isWellFormed()) {
    format = "skill";
    body = item.content.body;
    engram.tools = item.content.tools;
  } else {
    format = "json";
    body = JSON.stringify(content, null, 2);
  }
  engram.content_format = format;
  const front = stringifyYaml(
    {
      name: titleOf(item),
      description: hookOf(item),
      metadata: { type: claudeTypeOf(item.scope) },
      engram,
    },
    { lineWidth: 0 },
  );
  return `---\n${front}---\n${body}`;
}

const codeOf = (e: unknown) => (e as NodeJS.ErrnoException).code;
const isMissing = (e: unknown) => codeOf(e) === "ENOENT";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Temp file with a unique name, then rename, retried briefly on the transient locks Windows scanners take. */
async function atomicWrite(path: string, dir: string, base: string, data: string | Buffer) {
  const tmp = join(dir, `.${base}.${process.pid}.${++tempCounter}.engram-tmp`);
  await writeFile(tmp, data);
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(tmp, path);
      return;
    } catch (e) {
      const code = codeOf(e);
      if (attempt >= 5 || !(code === "EPERM" || code === "EACCES" || code === "EBUSY")) {
        await rm(tmp, { force: true });
        throw e;
      }
      await sleep(20 * (attempt + 1));
    }
  }
}

interface Loaded {
  item: MemoryItem;
  engram: boolean;
  /** The file's bytes, to restore them if a later step of a write or delete fails. */
  bytes: Buffer;
}

/** What a lock file says about its holder. */
interface LockHolder {
  pid: number;
  host: string;
  token: string;
  started: string;
}

const isLockHolder = (v: unknown): v is LockHolder =>
  isRecord(v) &&
  Number.isInteger(v.pid) &&
  typeof v.host === "string" &&
  typeof v.token === "string" &&
  typeof v.started === "string" &&
  !Number.isNaN(Date.parse(v.started));

/** Whether a process with this pid runs on this machine (EPERM: it runs, as another user). */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return codeOf(e) === "EPERM";
  }
}

export function createFilesAdapter(options: FilesAdapterOptions): FilesAdapter {
  const name = options.name ?? "files";
  const root = options.root;
  const person = `person:${options.owner}`;
  if (!Scope.safeParse(person).success) {
    throw new Error(`files adapter: owner ${JSON.stringify(options.owner)} is not a person id`);
  }
  const confidence = options.importConfidence ?? 0.5;
  let lastDiagnostics: FileDiagnostic[] = [];

  // Writes and deletes run one at a time within this instance, and hold the
  // folder's lock file against other instances and processes, so MEMORY.md's
  // read-modify-write never interleaves.
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };

  // The folder lock (see the header). The token names this instance's locks.
  const lockWaitMs = options.lockWaitMs ?? LOCK_WAIT_MS;
  const token = `${process.pid}-${randomUUID()}`;
  const host = hostname();
  const lockPath = join(root, LOCK);
  const breakPath = join(root, LOCK_BREAK);

  /** The lock file's text, or undefined when it is gone or briefly unreadable. */
  async function readLock(): Promise<string | undefined> {
    try {
      return await readFile(lockPath, "utf8");
    } catch (e) {
      if (isMissing(e) || BUSY.includes(codeOf(e) ?? "")) return undefined;
      throw e;
    }
  }

  /** Whether the lock whose text is `text` is stale, and who holds it, for the refusal. */
  async function judgeLock(text: string): Promise<{ stale: boolean; holder: string }> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    if (isLockHolder(parsed)) {
      const age = Date.now() - Date.parse(parsed.started);
      const stale =
        parsed.token === token ||
        age > LOCK_STALE_MS ||
        (parsed.host === host && !isAlive(parsed.pid));
      return {
        stale,
        holder: `pid ${parsed.pid} on ${parsed.host} since ${parsed.started}`,
      };
    }
    // No readable holder: a writer between creating and filling the lock, or one that stopped there.
    try {
      const age = Date.now() - (await lstat(lockPath)).mtimeMs;
      return { stale: age > LOCK_STALE_MS, holder: "a writer that has not recorded itself" };
    } catch (e) {
      if (isMissing(e)) return { stale: false, holder: "nobody" };
      throw e;
    }
  }

  /**
   * Removes the stale lock whose text was `text`, unless another writer has
   * replaced it meanwhile. Only one waiter breaks at a time (the break file);
   * a break file left by a crashed waiter is removed once it is stale.
   */
  async function breakLock(text: string): Promise<boolean> {
    try {
      await (await open(breakPath, "wx")).close();
    } catch (e) {
      if (!BUSY.includes(codeOf(e) ?? "")) throw e;
      const info = await lstat(breakPath).catch(() => undefined);
      if (info && Date.now() - info.mtimeMs > LOCK_STALE_MS) await rm(breakPath, { force: true });
      return false;
    }
    try {
      if ((await readLock()) !== text) return false;
      await rm(lockPath, { force: true });
      return true;
    } finally {
      await rm(breakPath, { force: true, maxRetries: 10, retryDelay: 10 });
    }
  }

  /** Creates the lock with this writer's record; false when another writer holds it. */
  async function tryLock(): Promise<boolean> {
    let handle: Awaited<ReturnType<typeof open>>;
    try {
      handle = await open(lockPath, "wx");
    } catch (e) {
      // EEXIST: another writer holds it. EPERM, EACCES, EBUSY: on Windows, a
      // lock being deleted by its holder.
      if (BUSY.includes(codeOf(e) ?? "")) return false;
      throw e;
    }
    const holder: LockHolder = { pid: process.pid, host, token, started: new Date().toISOString() };
    try {
      await handle.writeFile(JSON.stringify(holder), "utf8");
    } catch (e) {
      await handle.close();
      await rm(lockPath, { force: true });
      throw e;
    }
    await handle.close();
    return true;
  }

  async function locked<T>(fn: () => Promise<T>): Promise<T> {
    await mkdir(root, { recursive: true });
    const deadline = Date.now() + lockWaitMs;
    for (let attempt = 0; !(await tryLock()); attempt++) {
      const text = await readLock();
      const judged = text === undefined ? undefined : await judgeLock(text);
      if (text !== undefined && judged?.stale && (await breakLock(text))) continue;
      if (Date.now() >= deadline) {
        throw new Error(
          `files adapter: ${lockPath} is held by ${judged?.holder ?? "another writer"}; another Engram writer is using this folder (a lock older than ${LOCK_STALE_MS / 1000} s, or one from a pid no longer running on this machine, is broken automatically)`,
        );
      }
      await sleep(Math.min(2 + attempt, 25));
    }
    try {
      return await fn();
    } finally {
      // Never remove a lock another writer took after breaking ours as stale.
      if (holderToken(await readLock()) === token) {
        await rm(lockPath, { force: true, maxRetries: 10, retryDelay: 10 });
      }
    }
  }

  function holderToken(text: string | undefined): string | undefined {
    try {
      const parsed: unknown = text === undefined ? undefined : JSON.parse(text);
      return isLockHolder(parsed) ? parsed.token : undefined;
    } catch {
      return undefined;
    }
  }

  const keyOf = (ref: StoreRef) => {
    if (ref.adapter !== name) throw new ForeignRefError(name, ref);
    return checkKey(ref.key);
  };

  /** The defaults for a file without Engram metadata (documented in the card A3 log entry). */
  function importedItem(key: string, bytes: Buffer, mtime: Date, meta: unknown, body: string) {
    const declared = isRecord(meta)
      ? ((isRecord(meta.metadata) ? meta.metadata.type : undefined) ?? meta.type)
      : undefined;
    const type = CLAUDE_TYPES.find((t) => t === declared) ?? "untyped";
    return {
      id: importedItemId(key),
      // Every Claude Code type is a standing fact or rule, none an event record
      // or a replay-validated procedure, so all four import as semantic.
      class: "semantic",
      scope: person,
      owner: person,
      content: body.trim(),
      provenance: {
        kind: "import",
        ref: `claude-code-memory/${type}/${key}`,
        hash: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
        actor: "agent:claude-code",
      },
      confidence,
      valid_from: options.importValidFrom ?? mtime.toISOString(),
      valid_to: null,
      ttl: null,
      grants: [],
      version: 1,
      lineage: [],
      status: "active",
      store_ref: { adapter: name, key },
      schema_version: 0,
    };
  }

  function engramItem(key: string, engram: unknown, body: string): unknown {
    if (!isRecord(engram)) return engram;
    const { content_format: format, tools, ...fields } = engram;
    let content: unknown = body;
    if (format === "skill") content = { body, tools };
    else if (format === "json") {
      try {
        content = JSON.parse(body);
      } catch (e) {
        throw new Error(
          `files adapter: ${key} has a JSON body that does not parse: ${(e as Error).message}`,
        );
      }
    }
    return { ...fields, content, store_ref: { adapter: name, key } };
  }

  /** The folder's entries; none when the folder does not exist yet. */
  async function entries(): Promise<Dirent[]> {
    try {
      return await readdir(root, { withFileTypes: true });
    } catch (e) {
      if (isMissing(e)) return [];
      throw e;
    }
  }

  /** The entry named exactly `key`, whatever the file system's case rules. */
  const entryNamed = async (key: string) => (await entries()).find((e) => e.name === key);

  /**
   * Reads and parses one memory file; undefined if it vanished. Throws for
   * anything that is not a regular file directly in the root, checked on the
   * entry, on the path (lstat) and on the opened handle, so a symlink swapped
   * in between is caught too.
   */
  async function loadEntry(entry: Dirent): Promise<Loaded | undefined> {
    const key = entry.name;
    if (!entry.isFile()) throw new UnsafeKeyError(key, NOT_REGULAR);
    const path = join(root, key);
    let bytes: Buffer;
    let mtime: Date;
    let handle: Awaited<ReturnType<typeof open>>;
    try {
      handle = await open(path, "r");
    } catch (e) {
      if (isMissing(e)) return undefined;
      throw e;
    }
    try {
      const [opened, link] = await Promise.all([handle.stat(), lstat(path)]);
      if (
        !opened.isFile() ||
        !link.isFile() ||
        opened.ino !== link.ino ||
        opened.dev !== link.dev
      ) {
        throw new UnsafeKeyError(key, NOT_REGULAR);
      }
      if (opened.nlink > 1 || link.nlink > 1) throw new UnsafeKeyError(key, HARD_LINKED);
      bytes = await handle.readFile();
      mtime = opened.mtime;
    } finally {
      await handle.close();
    }
    const { front, body } = splitFrontmatter(bytes.toString("utf8"));
    let meta: unknown;
    try {
      meta = front === undefined ? undefined : parseYaml(front);
    } catch (e) {
      throw new Error(`files adapter: ${key} has unreadable frontmatter: ${(e as Error).message}`);
    }
    const engram = isRecord(meta) && "engram" in meta;
    const candidate =
      isRecord(meta) && "engram" in meta
        ? engramItem(key, meta.engram, body)
        : importedItem(key, bytes, mtime, meta, body);
    const parsed = MemoryItemSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new Error(`files adapter: ${key} does not hold a valid item: ${parsed.error.message}`);
    }
    return { item: parsed.data, engram, bytes };
  }

  async function load(key: string): Promise<Loaded | undefined> {
    const entry = await entryNamed(key);
    return entry ? loadEntry(entry) : undefined;
  }

  /** Every readable memory file; the others are skipped and recorded for `diagnostics()`. */
  async function all(): Promise<MemoryItem[]> {
    const items: MemoryItem[] = [];
    const skipped: FileDiagnostic[] = [];
    const memory = (await entries())
      .filter((e) => isMemoryFile(e.name))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of memory) {
      try {
        const loaded = await loadEntry(entry);
        if (loaded) items.push(loaded.item);
      } catch (e) {
        skipped.push({ key: entry.name, reason: (e as Error).message });
      }
    }
    lastDiagnostics = skipped;
    return items;
  }

  /** Refuses MEMORY.md unless it is missing or a regular file with one name. */
  async function checkIndex() {
    let info: Awaited<ReturnType<typeof lstat>>;
    try {
      info = await lstat(join(root, INDEX));
    } catch (e) {
      if (isMissing(e)) return;
      throw e;
    }
    if (!info.isFile()) throw new UnsafeKeyError(INDEX, NOT_REGULAR);
    if (info.nlink > 1) throw new UnsafeKeyError(INDEX, HARD_LINKED);
  }

  /** Puts `line` in place of the index line linking `key`, or removes it when `line` is undefined. */
  async function updateIndex(key: string, line: string | undefined) {
    const path = join(root, INDEX);
    let text = "";
    try {
      await checkIndex();
      text = await readFile(path, "utf8");
    } catch (e) {
      if (!isMissing(e)) throw e;
    }
    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    const lines = text === "" ? [] : text.replace(/\r?\n$/, "").split(/\r?\n/);
    // A link to the same file in other case is the same file on a case-insensitive system.
    const target = `](${key.toLowerCase()})`;
    const links = (l: string) => l.startsWith("- [") && l.toLowerCase().includes(target);
    const at = lines.findIndex(links);
    const kept = lines.filter((l) => !links(l));
    if (line !== undefined) kept.splice(at >= 0 ? at : kept.length, 0, line);
    await atomicWrite(path, root, INDEX, kept.length ? `${kept.join(eol)}${eol}` : "");
  }

  /**
   * Runs the index update of a write or delete that has already changed the
   * item file; if it fails, puts the item file back as it was (`previous`
   * bytes, or no file) and rethrows, so the folder is left unchanged.
   */
  async function allOrNothing(
    key: string,
    previous: Buffer | undefined,
    update: () => Promise<void>,
  ) {
    try {
      await update();
    } catch (e) {
      const path = join(root, key);
      try {
        if (previous) await atomicWrite(path, root, key, previous);
        else await rm(path, { force: true, maxRetries: 10, retryDelay: 10 });
      } catch (undo) {
        throw new Error(
          `files adapter: updating ${INDEX} failed (${(e as Error).message}) and restoring ${key} failed too (${(undo as Error).message})`,
          { cause: e },
        );
      }
      throw e;
    }
  }

  const adapter: FilesAdapter = {
    name,
    capabilities: {
      native_validity: false,
      native_history: false,
      // A folder searches nothing itself; `search` below is the adapter's own scan.
      native_search: false,
      native_graph: false,
    },
    diagnostics: () => lastDiagnostics.map((d) => ({ ...d })),
    write(item) {
      return serial(() =>
        locked(async () => {
          const key = checkKey(`${item.id}.md`);
          if (item.id !== item.id.toLowerCase()) {
            throw new UnsafeKeyError(
              key,
              "has uppercase letters; item ids must be lowercase so that no two keys name one file on a case-insensitive file system",
            );
          }
          const folder = await entries();
          const imported = folder.find(
            (e) => isMemoryFile(e.name) && importedItemId(e.name) === item.id,
          );
          if (imported) throw new ReadOnlyItemError(imported.name);
          const twin = folder.find((e) => e.name !== key && e.name.toLowerCase() === key);
          if (twin) {
            throw new UnsafeKeyError(
              twin.name,
              `differs from ${key} only in case; on a case-insensitive file system they are one file`,
            );
          }
          const same = folder.find((e) => e.name === key);
          const previous = same ? await loadEntry(same) : undefined;
          if (previous && !previous.engram) throw new ReadOnlyItemError(key);
          await checkIndex();
          const ref: StoreRef = { adapter: name, key };
          await atomicWrite(join(root, key), root, key, serialise({ ...item, store_ref: ref }));
          await allOrNothing(key, previous?.bytes, () =>
            updateIndex(key, `- [${titleOf(item)}](${key}) - ${hookOf(item)}`),
          );
          return ref;
        }),
      );
    },
    async read(ref) {
      return (await load(keyOf(ref)))?.item;
    },
    async delete(ref) {
      const key = keyOf(ref);
      return serial(() =>
        locked(async () => {
          const loaded = await load(key);
          if (!loaded) return;
          if (!loaded.engram) throw new ReadOnlyItemError(key);
          await checkIndex();
          await rm(join(root, key), { force: true });
          await allOrNothing(key, loaded.bytes, () => updateIndex(key, undefined));
        }),
      );
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
  };
  return adapter;
}
