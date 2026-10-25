// The files adapter (card A3, ADR 0013): a folder of Markdown in the Claude
// Code auto-memory layout. One memory per file, YAML frontmatter with Claude
// Code's `name`, `description` and `metadata.type`, the body after it, and a
// MEMORY.md index with one `- [Title](file.md) - hook` line per memory.
//
// An item the plane writes is `<id>.md`: the body is its content and the
// frontmatter adds every other item field under the one key `engram`, so a
// read returns the exact item. A file with no `engram` key is a memory Claude
// Code (or a person) wrote; it lists as a read-only item with the defaults in
// `importedItem` below. This adapter does file I/O; the clock is never read:
// an imported item's valid_from comes from the options or the file's mtime.
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
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
}

/** A store_ref key that is not a plain Markdown file name inside the root. */
export class UnsafeKeyError extends Error {
  constructor(key: string) {
    super(`files adapter: key ${JSON.stringify(key)} is not a memory file name inside the root`);
  }
}

/** A write or delete aimed at a memory file Engram did not write. */
export class ReadOnlyItemError extends Error {
  constructor(key: string) {
    super(`files adapter: ${key} has no Engram metadata and is read-only`);
  }
}

const INDEX = "MEMORY.md";
const CLAUDE_TYPES = ["user", "feedback", "project", "reference"] as const;
type ContentFormat = "text" | "json" | "skill";

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

/** Claude Code's `name`: the first non-empty line of the content, without heading marks. */
function titleOf(item: MemoryItem): string {
  const line = textOf(item.content)
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find(Boolean);
  const title = (line ?? item.id).replace(/[[\]]/g, "").replace(/\s+/g, " ");
  return title.length > 60 ? `${title.slice(0, 60).trimEnd()}...` : title;
}

const hookOf = (item: MemoryItem) =>
  `${item.class} memory in ${item.scope}, version ${item.version}`;

/** Engram scope to Claude Code type: a person's or role's memory is `user`, a shared one `project`. */
const claudeTypeOf = (scope: string) =>
  scope.startsWith("person:") || scope.startsWith("role:") ? "user" : "project";

function serialise(item: MemoryItem): string {
  const { content, store_ref: _ref, ...fields } = item;
  let format: ContentFormat;
  let body: string;
  const engram: Record<string, unknown> = { ...fields };
  if (typeof content === "string") {
    format = "text";
    body = content;
  } else if (item.class === "procedural") {
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

const isMissing = (e: unknown) => (e as NodeJS.ErrnoException).code === "ENOENT";

/** Temp file then rename, retried briefly on the transient locks Windows scanners take. */
async function atomicWrite(path: string, dir: string, base: string, data: string) {
  const tmp = join(dir, `.${base}.engram-tmp`);
  await writeFile(tmp, data, "utf8");
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(tmp, path);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (attempt >= 5 || !(code === "EPERM" || code === "EACCES" || code === "EBUSY")) {
        await rm(tmp, { force: true });
        throw e;
      }
      await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
    }
  }
}

export function createFilesAdapter(options: FilesAdapterOptions): Adapter {
  const name = options.name ?? "files";
  const root = options.root;
  const person = `person:${options.owner}`;
  if (!Scope.safeParse(person).success) {
    throw new Error(`files adapter: owner ${JSON.stringify(options.owner)} is not a person id`);
  }
  const confidence = options.importConfidence ?? 0.5;

  // Writes and deletes run one at a time, so MEMORY.md's read-modify-write never interleaves.
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };

  const keyOf = (ref: StoreRef) => {
    if (ref.adapter !== name) throw new ForeignRefError(name, ref);
    return checkKey(ref.key);
  };

  /** The defaults for a file without Engram metadata (documented in the card A3 log entry). */
  async function importedItem(key: string, bytes: Buffer, meta: unknown, body: string) {
    const declared = isRecord(meta)
      ? ((isRecord(meta.metadata) ? meta.metadata.type : undefined) ?? meta.type)
      : undefined;
    const type = CLAUDE_TYPES.find((t) => t === declared) ?? "untyped";
    const validFrom = options.importValidFrom ?? (await stat(join(root, key))).mtime.toISOString();
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
      valid_from: validFrom,
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
    else if (format === "json") content = JSON.parse(body);
    return { ...fields, content, store_ref: { adapter: name, key } };
  }

  /** Reads and parses one memory file; undefined if absent. */
  async function load(key: string): Promise<{ item: MemoryItem; engram: boolean } | undefined> {
    let bytes: Buffer;
    try {
      bytes = await readFile(join(root, key));
    } catch (e) {
      if (isMissing(e)) return undefined;
      throw e;
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
        : await importedItem(key, bytes, meta, body);
    const parsed = MemoryItemSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new Error(`files adapter: ${key} does not hold a valid item: ${parsed.error.message}`);
    }
    return { item: parsed.data, engram };
  }

  async function memoryFiles(): Promise<string[]> {
    try {
      return (await readdir(root)).filter(isMemoryFile).sort();
    } catch (e) {
      if (isMissing(e)) return [];
      throw e;
    }
  }

  async function all(): Promise<MemoryItem[]> {
    const items: MemoryItem[] = [];
    for (const key of await memoryFiles()) {
      const loaded = await load(key);
      if (loaded) items.push(loaded.item);
    }
    return items;
  }

  /** Puts `line` in place of the index line linking `key`, or removes it when `line` is undefined. */
  async function updateIndex(key: string, line: string | undefined) {
    const path = join(root, INDEX);
    let text = "";
    try {
      text = await readFile(path, "utf8");
    } catch (e) {
      if (!isMissing(e)) throw e;
    }
    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    const lines = text === "" ? [] : text.replace(/\r?\n$/, "").split(/\r?\n/);
    const links = (l: string) => l.startsWith("- [") && l.includes(`](${key})`);
    const at = lines.findIndex(links);
    const kept = lines.filter((l) => !links(l));
    if (line !== undefined) kept.splice(at >= 0 ? at : kept.length, 0, line);
    await atomicWrite(path, root, INDEX, kept.length ? `${kept.join(eol)}${eol}` : "");
  }

  const adapter: Adapter = {
    name,
    capabilities: {
      native_validity: false,
      native_history: false,
      native_search: true,
      native_graph: false,
    },
    write(item) {
      return serial(async () => {
        const key = checkKey(`${item.id}.md`);
        await mkdir(root, { recursive: true });
        const files = await memoryFiles();
        const imported = files.find((f) => importedItemId(f) === item.id);
        if (imported) throw new ReadOnlyItemError(imported);
        if (files.includes(key) && !(await load(key))?.engram) throw new ReadOnlyItemError(key);
        const ref: StoreRef = { adapter: name, key };
        await atomicWrite(join(root, key), root, key, serialise({ ...item, store_ref: ref }));
        await updateIndex(key, `- [${titleOf(item)}](${key}) - ${hookOf(item)}`);
        return ref;
      });
    },
    async read(ref) {
      return (await load(keyOf(ref)))?.item;
    },
    delete(ref) {
      const key = keyOf(ref);
      return serial(async () => {
        const loaded = await load(key);
        if (!loaded) return;
        if (!loaded.engram) throw new ReadOnlyItemError(key);
        await rm(join(root, key), { force: true });
        await updateIndex(key, undefined);
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
  };
  return adapter;
}
