// The memory bundle as a file (card E9.8, docs/bundle.md): JSONL, a header
// line, then one row per line, each an item and the decision events on it.
// Parsing only: what an import makes of a row is core's (importedWrite,
// packages/core/src/portable.ts; AGENTS.md rule 1), and the gate decides.
import {
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

/** The largest bundle or pasted memory list an import reads: 64 MiB. */
export const MAX_INPUT_BYTES = 64 * 1024 * 1024;

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
  const seen = new Map<string, number>();
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
    const twice = seen.get(item.data.id);
    if (twice !== undefined)
      throw new UsageError(
        `line ${n}: item ${item.data.id} is already on line ${twice}; a bundle holds each item once`,
      );
    seen.set(item.data.id, n);
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
