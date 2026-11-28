// The mcp-memory adapter (card A6 of the second absorb plan): the knowledge
// graph file of the MCP reference memory server, `@modelcontextprotocol/
// server-memory`, the memory most MCP users run.
//
// Ported from modelcontextprotocol/servers, src/memory/index.ts, version 2.2.1
// at c799c8552b0f27b7a33a7b9233773da144dddcf5 (licence in transition from MIT
// to Apache-2.0, both allowed by ADR 0037): the file format only, rewritten
// here; no code was copied. The format, as that server reads and writes it:
//
// - One JSON object per line, `\n` between lines; blank lines are skipped.
// - `{"type":"entity","name","entityType","observations":[strings]}` and
//   `{"type":"relation","from","to","relationType"}`, the modelled fields
//   first, then any member the server does not model, kept as it was.
// - Every other line (malformed JSON, a value that is not an object, an
//   entity or relation that fails validation, an unknown `type`) is kept
//   unchanged; the server writes them back after its own lines.
// - Every write takes `<file>.lock` by exclusive create, rewrites the whole
//   file into a temporary file in the same folder and renames it over the
//   memory file, keeping its permission bits.
//
// How Engram uses it:
//
// - An item the plane writes is one entity line, named `engram:<id>`, of
//   type `engram`, with no observations, and every item field under the one
//   extra member `engram`. The server keeps that member on every rewrite and
//   never shows it in a tool result, so the server's own read tools show the
//   entity's name and nothing of its content: what the item says reaches a
//   model only through the plane's read. Its key is `item/<id>`. An entity
//   whose `engram.id` is not its name (a copy, a rename) is refused, as the
//   files adapter refuses a renamed file (RV-ADP-1).
// - An observation or a relation the server (or a person) wrote lists as a
//   read-only item in the owner's person scope, as the files adapter lists a
//   Claude Code memory. Observations carry no ids, so the adapter derives a
//   stable ref from what identifies one in the server's own model: the key
//   `observation/<h>`, where h is the first 32 hex digits of sha256 over the
//   JSON array [entity name, observation text], and `relation/<h>` over
//   [from, relationType, to]. A ref survives reordering, other observations
//   added or deleted, a change of the entity's type and any rewrite by the
//   server; editing the text is a new observation (and adoption retracts the
//   old one). The server stores an observation once per entity, so one key is
//   one observation; a repeat written by hand lists once. The item's id is a
//   UUIDv7 derived from the file's identity and the key (`importedItemId`).
// - Writing an item replaces its own line in place, keeping every member the
//   adapter does not write (the observations a client added, a `createdAt`,
//   their order), and every other line byte for byte. Deleting removes its
//   line and nothing else. Lines the adapter cannot read are kept and
//   reported through `diagnostics()`.
//
// Lock and refusal rules follow the files adapter's (card A3, ../lock.ts):
// writes and deletes run one at a time per instance and hold `<file>.lock`,
// the very lock file the server takes, so neither ever rewrites the file
// over the other's change. A lock without an Engram holder record (the
// server's) is judged by its file time, stale after 30 s as the server
// judges it; the server refreshes its own every 15 s while it works. The
// memory file must be a regular file with one name: a symlink, a directory
// or a hard link is refused, as is a file this process may not write. No
// item field comes from the clock: an imported item's valid_from is the
// option's or the file's modification time, which `derivedFields` reports.
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { access, constants, lstat, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import {
  type MemoryItem,
  MemoryItem as MemoryItemSchema,
  NotDeletableError,
  Scope,
} from "@engram/core";
import { type Adapter, ForeignRefError, type StoreDiagnostic, type StoreRef } from "../contract.ts";
import { atomicWrite, isMissing, isRecord } from "../fs-safe.ts";
import { createStoreLock, LOCK_WAIT_MS, type LockSeams } from "../lock.ts";

/** The server's own stale bound for `<file>.lock` (30 s), so both judge a lock alike. */
export const MCP_MEMORY_LOCK_STALE_MS = 30_000;
/** The entity type of an item the plane wrote. */
export const ENGRAM_ENTITY_TYPE = "engram";
const NAME_PREFIX = "engram:";

export interface McpMemoryAdapterOptions {
  /** The server's memory file, as MEMORY_FILE_PATH names it, for example `~/memory.jsonl`. */
  file: string;
  /** Matches `StoreRef.adapter`. Default `mcp-memory`. */
  name?: string;
  /** Person id whose graph this is; imported records get owner and scope `person:<owner>`. */
  owner: string;
  /** valid_from for imported records (ISO 8601, Z). Default: the file's modification time. */
  importValidFrom?: string;
  /** Confidence for imported records. Default 0.5: model-written, never reviewed. */
  importConfidence?: number;
  /** How long a write or delete waits for any one other writer holding the lock, in ms. Default 10 000. */
  lockWaitMs?: number;
  /** Test seams for the lock, never set in production (../lock.ts). */
  lockSeams?: LockSeams;
}

export interface McpMemoryAdapter extends Adapter {
  /** The lines the latest list, search or read could not read, by key. */
  diagnostics(): StoreDiagnostic[];
  /** `["valid_from"]` for an imported record whose valid_from is the file's modification time. */
  derivedFields(item: MemoryItem): (keyof MemoryItem)[];
}

/** A ref key that names no record this adapter can hold. Refused on every attempt. */
export class UnknownMcpKeyError extends NotDeletableError {
  constructor(key: string) {
    super(
      `mcp-memory adapter: key ${JSON.stringify(key)} is not item/<id>, observation/<hash> or relation/<hash>`,
    );
  }
}

/** A write or delete aimed at a record the server or a person wrote: read-only, on every attempt. */
export class ReadOnlyRecordError extends NotDeletableError {
  constructor(what: string) {
    super(`mcp-memory adapter: ${what} was not written by Engram and is read-only`);
  }
}

/** The memory file is not a regular file with one name, or this process may not write it. */
export class UnsafeMemoryFileError extends NotDeletableError {
  constructor(file: string, why: string) {
    super(`mcp-memory adapter: ${file} ${why}`);
  }
}

const KEY = /^(?:item\/[0-9a-f-]{36}|observation\/[0-9a-f]{32}|relation\/[0-9a-f]{32})$/;

const hex32 = (parts: readonly string[]) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** The key of an entity's observation: what names it in the server's model, the entity and the text. */
export const observationKey = (entity: string, observation: string) =>
  `observation/${hex32([entity, observation])}`;
/** The key of a relation: its three modelled fields, which the server matches exactly. */
export const relationKey = (from: string, relationType: string, to: string) =>
  `relation/${hex32([from, relationType, to])}`;

const caseless = (path: string) => (process.platform === "win32" ? path.toLowerCase() : path);

/** The file as imported ids name it: its real path, else its folder's real path and its name. */
export function memoryFileIdentity(file: string): string | undefined {
  const full = resolve(file);
  try {
    return caseless(realpathSync.native(full));
  } catch {
    try {
      return caseless(join(realpathSync.native(dirname(full)), basename(full)));
    } catch {
      return undefined;
    }
  }
}

function idOf(identity: string, key: string): string {
  const h = sha256(`engram/mcp-memory/${identity}\u0000${key}`);
  const variant = ((Number.parseInt(h.slice(3, 4), 16) & 0x3) | 0x8).toString(16);
  return `00000000-0000-7${h.slice(0, 3)}-${variant}${h.slice(4, 7)}-${h.slice(7, 19)}`;
}

/** The id of an imported record: a UUIDv7 with time zero from the file's identity and the key. */
export function importedRecordId(file: string, key: string): string {
  return idOf(memoryFileIdentity(file) ?? caseless(resolve(file)), key);
}

const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === "string");

/** One line of the file as the adapter reads it; `text` is the line exactly as it was. */
type Line =
  | { text: string; kind: "item"; id: string; record: Record<string, unknown>; item: MemoryItem }
  /**
   * An entity named for an Engram item that is not that item's first valid
   * line: a later repeat, or one whose `engram` member no longer holds a
   * valid item. Never read; the item's next write replaces it and its delete
   * removes it, so a copy never outlives the item.
   */
  | { text: string; kind: "copy"; id: string; record: Record<string, unknown> }
  | { text: string; kind: "entity"; name: string; entityType: string; observations: string[] }
  | { text: string; kind: "relation"; from: string; to: string; relationType: string }
  /** Any other line, kept byte for byte; `entity` is its entity name when it has one. */
  | { text: string; kind: "kept"; entity?: string };

interface Graph {
  lines: Line[];
  diagnostics: StoreDiagnostic[];
  mtime: Date | undefined;
}

/** Splits the file's text into lines, keeping each line's bytes (a `\r` included). */
function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

export function createMcpMemoryAdapter(options: McpMemoryAdapterOptions): McpMemoryAdapter {
  const name = options.name ?? "mcp-memory";
  const file = resolve(options.file);
  const dir = dirname(file);
  const base = basename(file);
  const person = `person:${options.owner}`;
  if (!Scope.safeParse(person).success) {
    throw new Error(`mcp-memory adapter: owner ${JSON.stringify(options.owner)} is not a person id`);
  }
  const confidence = options.importConfidence ?? 0.5;
  let identity: string | undefined;
  const importedId = (key: string) => {
    identity ??= memoryFileIdentity(file);
    return idOf(identity ?? caseless(file), key);
  };
  let lastDiagnostics: StoreDiagnostic[] = [];
  let swept = false;

  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };
  const lock = createStoreLock({
    path: `${file}.lock`,
    waitMs: options.lockWaitMs ?? LOCK_WAIT_MS,
    label: "mcp-memory adapter",
    guards: "memory file",
    staleMs: MCP_MEMORY_LOCK_STALE_MS,
    seams: options.lockSeams,
  });
  /** This adapter's own temporary files (../fs-safe.ts): `.<file name>.<pid>.<n>.engram-tmp`. */
  const isOwnTemp = (entry: string) =>
    entry.startsWith(`.${base}.`) && /\.\d+\.\d+\.engram-tmp$/.test(entry);
  const locked = async <T>(fn: () => Promise<T>): Promise<T> => {
    await mkdir(dir, { recursive: true });
    return lock(async () => {
      if (!swept) {
        // Every writer holds the lock while its temporary file exists, so one
        // present now belongs to a writer that crashed (RV-ADP-10).
        for (const entry of await readdir(dir))
          if (isOwnTemp(entry)) await rm(join(dir, entry), { force: true });
        swept = true;
      }
      return fn();
    });
  };

  const keyOf = (ref: StoreRef) => {
    if (ref.adapter !== name) throw new ForeignRefError(name, ref);
    if (!KEY.test(ref.key)) throw new UnknownMcpKeyError(ref.key);
    return ref.key;
  };

  /** The file's text and mode, or undefined while it does not exist; refuses anything but a regular file with one name. */
  async function readText(): Promise<{ text: string; mtime: Date; mode: number } | undefined> {
    let info: Awaited<ReturnType<typeof lstat>>;
    try {
      info = await lstat(file);
    } catch (e) {
      if (isMissing(e)) return undefined;
      throw e;
    }
    if (!info.isFile())
      throw new UnsafeMemoryFileError(
        file,
        "is not a regular file; symlinks and directories are never followed",
      );
    if (info.nlink > 1)
      throw new UnsafeMemoryFileError(
        file,
        "is a hard link (the file has more than one name) and is never read or replaced",
      );
    let text: string;
    try {
      text = await readFile(file, "utf8");
    } catch (e) {
      if (isMissing(e)) return undefined;
      throw e;
    }
    return { text, mtime: info.mtime, mode: info.mode & 0o777 };
  }

  /** Classifies one line; a line the adapter cannot read is kept, with a diagnostic when it looks broken. */
  function classify(text: string, n: number, diagnostics: StoreDiagnostic[]): Line {
    if (text.trim() === "") return { text, kind: "kept" };
    const broken = (key: string, reason: string, entity?: string): Line => {
      diagnostics.push({ key, reason: `line ${n + 1} ${reason}; kept unchanged` });
      return entity === undefined ? { text, kind: "kept" } : { text, kind: "kept", entity };
    };
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return broken(`line/${n + 1}`, "is not JSON");
    }
    if (!isRecord(value)) return broken(`line/${n + 1}`, "is not a JSON object");
    if (value.type === "entity") {
      const { name: entity, entityType, observations } = value;
      if (typeof entity !== "string" || typeof entityType !== "string" || !isStrings(observations))
        return broken(`line/${n + 1}`, "is an entity the server would not read");
      if (Object.hasOwn(value, "engram")) {
        const engram = value.engram;
        const id = isRecord(engram) && typeof engram.id === "string" ? engram.id : undefined;
        const key = id !== undefined && KEY.test(`item/${id}`) ? `item/${id}` : `line/${n + 1}`;
        if (id === undefined || entity !== `${NAME_PREFIX}${id}`)
          return broken(
            key,
            `holds Engram item ${JSON.stringify(id)} under the entity ${JSON.stringify(entity)}, not the one its id names; a copy or a rename of an Engram entity is not read`,
            entity,
          );
        const parsed = MemoryItemSchema.safeParse({ ...engram, store_ref: { adapter: name, key } });
        if (!parsed.success) {
          diagnostics.push({
            key,
            reason: `line ${n + 1} does not hold a valid item: ${parsed.error.message}`,
          });
          return { text, kind: "copy", id, record: value };
        }
        return { text, kind: "item", id, record: value, item: parsed.data };
      }
      return { text, kind: "entity", name: entity, entityType, observations };
    }
    if (value.type === "relation") {
      const { from, to, relationType } = value;
      if (typeof from !== "string" || typeof to !== "string" || typeof relationType !== "string")
        return broken(`line/${n + 1}`, "is a relation the server would not read");
      return { text, kind: "relation", from, to, relationType };
    }
    // A record of a type neither the server nor the adapter models: another client's, kept.
    return { text, kind: "kept" };
  }

  async function loadGraph(): Promise<Graph & { mode: number | undefined }> {
    const read = await readText();
    const diagnostics: StoreDiagnostic[] = [];
    const lines = splitLines(read?.text ?? "").map((t, n) => classify(t, n, diagnostics));
    // One id lists once: a later line repeating an item is reported, never read.
    const seen = new Set<string>();
    for (const [n, line] of lines.entries()) {
      if (line.kind !== "item") continue;
      if (seen.has(line.id)) {
        diagnostics.push({
          key: `line/${n + 1}`,
          reason: `line ${n + 1} repeats Engram item ${line.id}; the first line is read`,
        });
        lines[n] = { text: line.text, kind: "copy", id: line.id, record: line.record };
      } else seen.add(line.id);
    }
    return { lines, diagnostics, mtime: read?.mtime, mode: read?.mode };
  }

  function imported(
    key: string,
    content: string,
    ref: string,
    hashed: readonly string[],
    mtime: Date | undefined,
  ): MemoryItem {
    return MemoryItemSchema.parse({
      id: importedId(key),
      class: "semantic",
      scope: person,
      owner: person,
      content,
      provenance: {
        kind: "import",
        ref,
        hash: `sha256:${sha256(JSON.stringify(hashed))}`,
        actor: "agent:mcp-memory",
      },
      confidence,
      valid_from: options.importValidFrom ?? (mtime ?? new Date(0)).toISOString(),
      valid_to: null,
      ttl: null,
      grants: [],
      version: 1,
      lineage: [],
      status: "active",
      store_ref: { adapter: name, key },
      schema_version: 1,
    });
  }

  /** Every item the graph holds: the plane's, then each observation and relation, one per key. */
  function itemsOf(graph: Graph): MemoryItem[] {
    const items = new Map<string, MemoryItem>();
    for (const line of graph.lines) {
      if (line.kind === "item") items.set(`item/${line.id}`, line.item);
      if (line.kind === "item" || line.kind === "entity") {
        const entity = line.kind === "item" ? `${NAME_PREFIX}${line.id}` : line.name;
        const type =
          line.kind === "item" ? String(line.record.entityType ?? ENGRAM_ENTITY_TYPE) : line.entityType;
        const observations =
          line.kind === "item" ? (line.record.observations as string[]) : line.observations;
        for (const observation of observations) {
          const key = observationKey(entity, observation);
          if (items.has(key)) continue;
          items.set(
            key,
            imported(
              key,
              `${entity}: ${observation}`,
              `mcp-memory/entity/${type}/${entity}`,
              [entity, type, observation],
              graph.mtime,
            ),
          );
        }
      }
      if (line.kind === "relation") {
        const key = relationKey(line.from, line.relationType, line.to);
        if (items.has(key)) continue;
        items.set(
          key,
          imported(
            key,
            `${line.from} ${line.relationType} ${line.to}`,
            `mcp-memory/relation/${line.relationType}`,
            [line.from, line.relationType, line.to],
            graph.mtime,
          ),
        );
      }
    }
    return [...items.values()];
  }

  async function all(): Promise<MemoryItem[]> {
    const graph = await loadGraph();
    lastDiagnostics = graph.diagnostics;
    return itemsOf(graph);
  }

  /** Rewrites the file from `lines`, atomically, keeping its permission bits, as the server saves it. */
  async function save(lines: Line[], mode: number | undefined): Promise<void> {
    if (mode !== undefined) {
      try {
        await access(file, constants.W_OK);
      } catch (e) {
        if (!isMissing(e))
          throw new UnsafeMemoryFileError(file, "is read-only to this process and is never replaced");
      }
    }
    const text = lines.length === 0 ? "" : `${lines.map((l) => l.text).join("\n")}\n`;
    await atomicWrite(file, dir, base, text, mode);
  }

  /** The line of an imported record or a foreign entity an item's write or delete would collide with. */
  function collision(graph: Graph, id: string): string | undefined {
    const own = `${NAME_PREFIX}${id}`;
    for (const line of graph.lines)
      if (
        (line.kind === "entity" && line.name === own) ||
        (line.kind === "kept" && line.entity === own)
      )
        return `the entity ${JSON.stringify(own)}`;
    for (const item of itemsOf(graph))
      if (item.id === id && item.store_ref?.key !== `item/${id}`)
        return `the record ${item.store_ref?.key}`;
    return undefined;
  }

  const adapter: McpMemoryAdapter = {
    name,
    capabilities: {
      native_validity: false,
      native_history: false,
      // The server's search_nodes is outside the plane; `search` below is the adapter's own scan.
      native_search: false,
      native_graph: false,
    },
    diagnostics: () => lastDiagnostics.map((d) => ({ ...d })),
    derivedFields: (item) =>
      options.importValidFrom === undefined &&
      item.store_ref?.adapter === name &&
      !item.store_ref.key.startsWith("item/")
        ? ["valid_from"]
        : [],
    write(item) {
      return serial(() =>
        locked(async () => {
          const key = `item/${item.id}`;
          if (!KEY.test(key)) throw new UnknownMcpKeyError(key);
          const graph = await loadGraph();
          const clash = collision(graph, item.id);
          if (clash !== undefined) throw new ReadOnlyRecordError(clash);
          const ref: StoreRef = { adapter: name, key };
          const { store_ref: _ref, ...fields } = item;
          const mine = (l: Line) => (l.kind === "item" || l.kind === "copy") && l.id === item.id;
          // The item's valid line, else its first copy, is replaced; any other copy goes.
          const valid = graph.lines.findIndex((l) => l.kind === "item" && l.id === item.id);
          const first = valid === -1 ? graph.lines.findIndex(mine) : valid;
          const lines: Line[] = [];
          for (const [n, line] of graph.lines.entries()) {
            if (n === first && (line.kind === "item" || line.kind === "copy")) {
              // Every member keeps its place and value but `engram`: a client's
              // observations, its own fields, the entity type it may have set.
              lines.push({ text: JSON.stringify({ ...line.record, engram: fields }), kind: "kept" });
            } else if (!mine(line)) lines.push(line);
          }
          if (first === -1) {
            const text = JSON.stringify({
              type: "entity",
              name: `${NAME_PREFIX}${item.id}`,
              entityType: ENGRAM_ENTITY_TYPE,
              observations: [],
              engram: fields,
            });
            lines.push({ text, kind: "kept" });
          }
          await save(lines, graph.mode);
          return ref;
        }),
      );
    },
    async read(ref) {
      const key = keyOf(ref);
      const graph = await loadGraph();
      lastDiagnostics = graph.diagnostics;
      return itemsOf(graph).find((i) => i.store_ref?.key === key);
    },
    async delete(ref) {
      const key = keyOf(ref);
      return serial(() =>
        locked(async () => {
          const graph = await loadGraph();
          if (!key.startsWith("item/")) {
            if (itemsOf(graph).some((i) => i.store_ref?.key === key))
              throw new ReadOnlyRecordError(`the record ${key}`);
            return;
          }
          const id = key.slice("item/".length);
          const kept = graph.lines.filter(
            (l) => !((l.kind === "item" || l.kind === "copy") && l.id === id),
          );
          if (kept.length === graph.lines.length) return;
          await save(kept, graph.mode);
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
