// The memory bundle as a file (card E9.8, docs/bundle.md): JSONL, a header
// line, then one row per line, each an item and the decision events on it.
// And what an import makes of a row: an item for Plane.write by the
// dedicated import actor. Nothing here decides; the plane's gate does
// (AGENTS.md rule 1). What the import sets is the harness's part, as the CLI
// sets source `user` for `engram write` (ADR 0004, decision D4): the source
// `import`, the status `candidate`, no grants (decision item 55).
import { createHash } from "node:crypto";
import {
  type Actor,
  BUNDLE_FORMAT,
  BUNDLE_VERSION,
  type BundleRow,
  MemoryEvent,
  MemoryItem,
  Timestamp,
} from "@engram/core";
import { UsageError } from "../setup.ts";

/** The first line of a bundle (docs/bundle.md). */
export interface BundleHeader {
  format: typeof BUNDLE_FORMAT;
  version: number;
  exported_at: string;
  exported_by: string;
  policy: string;
  rows: number;
}

const BundleEvent = MemoryEvent.omit({ item: true });

/** The bundle a call to the export route answered with, as JSONL text with a final newline. */
export function bundleText(header: Omit<BundleHeader, "rows">, rows: readonly BundleRow[]): string {
  const head: BundleHeader = { ...header, rows: rows.length };
  return [head, ...rows].map((line) => `${JSON.stringify(line)}\n`).join("");
}

/**
 * The header and rows of a bundle's text; a UsageError naming the line on
 * anything that is not a version 1 bundle, so nothing is imported from a
 * file that only half parses.
 */
export function parseBundle(text: string): { header: BundleHeader; rows: BundleRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const json = (line: string, n: number): unknown => {
    try {
      return JSON.parse(line);
    } catch (e) {
      throw new UsageError(`line ${n}: not JSON: ${(e as Error).message}`);
    }
  };
  const [first, ...rest] = lines;
  if (first === undefined) throw new UsageError("the bundle is empty: it has no header line");
  const head = json(first, 1);
  const format = (head as { format?: unknown } | null)?.format;
  if (format !== BUNDLE_FORMAT)
    throw new UsageError(
      `line 1: not an Engram bundle (format ${JSON.stringify(format ?? null)}, expected "${BUNDLE_FORMAT}"); for a pasted Claude memory list use --claude <file>`,
    );
  const version = (head as { version?: unknown }).version;
  if (version !== BUNDLE_VERSION)
    throw new UsageError(
      `line 1: bundle version ${JSON.stringify(version)}; this engram reads version ${BUNDLE_VERSION} only`,
    );
  const header = head as Record<string, unknown>;
  const problem = headerProblem(header);
  if (problem) throw new UsageError(`line 1: the header ${problem}`);
  const rows = rest.map((line, i) => {
    const n = i + 2;
    const raw = json(line, n) as { item?: unknown; events?: unknown } | null;
    const keys = raw !== null && typeof raw === "object" ? Object.keys(raw).sort() : [];
    if (keys.join(",") !== "events,item")
      throw new UsageError(`line ${n}: a row is an object of exactly item and events`);
    const item = MemoryItem.safeParse(raw?.item);
    if (!item.success)
      throw new UsageError(`line ${n}: the item fails its schema: ${issues(item.error)}`);
    if (!Array.isArray(raw?.events)) throw new UsageError(`line ${n}: events is not a list`);
    const events = raw.events.map((e: unknown, k: number) => {
      const event = BundleEvent.safeParse(e);
      if (!event.success)
        throw new UsageError(`line ${n}: events[${k}] fails its schema: ${issues(event.error)}`);
      return event.data;
    });
    return { item: item.data, events } as BundleRow;
  });
  if (rows.length !== header.rows)
    throw new UsageError(
      `the header counts ${header.rows} rows and the bundle holds ${rows.length}; it is incomplete`,
    );
  return { header: header as unknown as BundleHeader, rows };
}

/** Why a parsed header is not a version 1 header, or null. */
function headerProblem(h: Record<string, unknown>): string | null {
  const keys = Object.keys(h).sort().join(",");
  if (keys !== "exported_at,exported_by,format,policy,rows,version")
    return "has fields other than format, version, exported_at, exported_by, policy and rows";
  if (!Timestamp.safeParse(h.exported_at).success) return "names no valid exported_at time";
  if (typeof h.exported_by !== "string" || h.exported_by === "") return "names no exporter";
  if (typeof h.policy !== "string") return "names no policy";
  if (!Number.isInteger(h.rows) || (h.rows as number) < 0) return "counts no rows";
  return null;
}

const issues = (e: { issues: readonly { path: readonly PropertyKey[]; message: string }[] }) =>
  e.issues
    .slice(0, 3)
    .map((i) => `${i.path.map(String).join(".") || "value"}: ${i.message}`)
    .join("; ");

/**
 * The dedicated import actor (decision item 55): `import:<importer>`, at the
 * importer's level, a member of exactly the importer's scopes, with source
 * `import`. Its source is set here, by the harness, and never read from a
 * bundle; its id names who it imports for, so the log tells every imported
 * row from the importer's own writes, and the importer, who owns the rows,
 * cannot approve their promotion (ADR 0026: the owner never approves).
 */
export function importActor(importer: Actor): Actor {
  return {
    id: `import:${importer.id}`,
    level: importer.level,
    memberships: [...importer.memberships],
    source: "import",
  };
}

const sha256 = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;
const contentText = (content: unknown) =>
  typeof content === "string" ? content : JSON.stringify(content);

/** What an imported row may say of itself: its content, class, confidence and validity. */
export interface ImportedFields {
  class: MemoryItem["class"];
  content: MemoryItem["content"];
  confidence: number;
  valid_from: string;
  valid_to: string | null;
  ttl: number | null;
  /** Retired rows stay retired; any other status lands as a candidate. */
  retired: boolean;
  lineage: string[];
}

/**
 * The item an import writes: a new id, owned by the importer, written by the
 * import actor with provenance kind `import` (the plane sets the kind and
 * actor from the actor's source again, ADR 0004 decision D4), status
 * `candidate` (`retired` for a retired row, never more), no grants, version
 * 1; `ref` names where the row came from.
 */
export function importedItem(
  fields: ImportedFields,
  at: { id: string; scope: string; owner: string; actor: Actor; ref: string },
): Record<string, unknown> {
  return {
    id: at.id,
    class: fields.class,
    scope: at.scope,
    owner: at.owner,
    content: fields.content,
    provenance: {
      kind: "import",
      ref: at.ref,
      hash: sha256(contentText(fields.content)),
      actor: at.actor.id,
    },
    confidence: fields.confidence,
    valid_from: fields.valid_from,
    valid_to: fields.valid_to,
    ttl: fields.ttl,
    grants: [],
    version: 1,
    lineage: fields.lineage,
    status: fields.retired ? "retired" : "candidate",
    store_ref: null,
    schema_version: 1,
  };
}

/** A bundle row's fields, before its lineage is mapped onto the new ids. */
export function rowFields(row: BundleRow): ImportedFields {
  const { item } = row;
  return {
    class: item.class,
    content: item.content,
    confidence: item.confidence,
    valid_from: item.valid_from,
    valid_to: item.valid_to,
    ttl: item.ttl,
    retired: item.status === "retired",
    lineage: item.lineage,
  };
}

/**
 * Maps a lineage onto the ids this import minted so far: a pointer to a row
 * already imported takes that row's new id; any other (a version the bundle
 * does not hold, a row the gate denied, a later row) is dropped and counted,
 * so no imported item names an id the workspace does not hold.
 */
export function mapLineage(
  lineage: readonly string[],
  ids: ReadonlyMap<string, string>,
): { lineage: string[]; dropped: number } {
  const kept = lineage.flatMap((id) => {
    const to = ids.get(id);
    return to === undefined ? [] : [to];
  });
  return { lineage: kept, dropped: lineage.length - kept.length };
}
