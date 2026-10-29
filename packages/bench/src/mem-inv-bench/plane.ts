// MEM-INV-Bench through the plane (card B4, ADR 0029 and its amendments).
//
// The write phase: every memory entry of a case crosses Plane.write as the
// actor of the channel it was written through, with the provenance kind that
// channel implies, set by the harness (the actor's `source`, ADR 0004
// decision D4), never by the entry's text. The retrieval phase: the
// operator's read at action time crosses Plane.read. Only the visible case
// reaches this module (strip.ts), so no label or scoring key can steer a
// write, a scope or a kind.
//
// The deployment (ADR 0029, amendment of card B4): one operator,
// `person:operator`, whose assistant acts for them. Connected services write
// shared operational records into `team:operations`: the trusted registries
// (erp, bank) and the trusted lookup tool as `tool`, the untrusted public
// feeds (web, inbox) as `document`, each service its own actor, so ADR 0026
// counts them as distinct actors as the paper counts trust domains. The
// agent's own note (self-summarisation) is model content in the operator's
// person scope, where source isolation keeps it (ADR 0004, 0007). The user's
// own statements are user content in the person scope.
import { createHash } from "node:crypto";
import {
  type Actor,
  leastTrusted,
  type MemoryItem,
  type Plane,
  type ReadResult,
  type WriteResult,
} from "@engram/core";
import type { MemoryEntry, OriginChannel } from "./schema.ts";
import type { VisibleCase } from "./strip.ts";

export const OPERATOR = "person:operator";
export const OPERATIONS = "team:operations";

/** How a channel writes: as whom, with which provenance kind, into which scope. */
export interface ChannelWriter {
  actor: string;
  kind: MemoryItem["provenance"]["kind"];
  scope: string;
  /** The paper's origin label of the channel (tma.py Origin), for the record. */
  origin: "untrusted" | "agent" | "trusted" | "user";
}

/**
 * The channel-to-provenance mapping (ADR 0029, amendments): the kind of what
 * each channel writes on its own. A derived entry's kind is not the channel's
 * alone: see entryKind.
 */
export const CHANNEL_WRITERS: Readonly<Record<OriginChannel, ChannelWriter>> = {
  user: { actor: OPERATOR, kind: "user", scope: OPERATOR, origin: "user" },
  erp: { actor: "agent:erp", kind: "tool", scope: OPERATIONS, origin: "trusted" },
  bank: { actor: "agent:bank", kind: "tool", scope: OPERATIONS, origin: "trusted" },
  tool: { actor: "agent:lookup", kind: "tool", scope: OPERATIONS, origin: "trusted" },
  web: { actor: "agent:web", kind: "document", scope: OPERATIONS, origin: "untrusted" },
  inbox: { actor: "agent:inbox", kind: "document", scope: OPERATIONS, origin: "untrusted" },
  agent: { actor: OPERATOR, kind: "model", scope: OPERATOR, origin: "agent" },
};

/**
 * The provenance kind of one entry: the least trusted of its channel's kind
 * and the kinds of the channels it was derived from (ADR 0004, "an item
 * derived from others inherits the least trusted provenance of its inputs";
 * ADR 0026's trust order, core's leastTrusted). The harness knows the inputs
 * at the call boundary (the visible `derived_from`), so it applies the rule
 * before the write. Under ADR 0026's order (user, document, import, tool,
 * model, compaction) `tool` ranks below `document`, so a trusted tool echoing
 * a web document stays `tool`; a self-summary of one stays `model`.
 */
export function entryKind(entry: Pick<MemoryEntry, "channel" | "derived_from">) {
  return leastTrusted([
    CHANNEL_WRITERS[entry.channel].kind,
    ...entry.derived_from.map((c) => CHANNEL_WRITERS[c].kind),
  ]);
}

/** The actor an entry is written as: its channel's, a member of the scope it writes into, its source the entry's kind. */
export function entryActor(entry: Pick<MemoryEntry, "channel" | "derived_from">): Actor {
  const w = CHANNEL_WRITERS[entry.channel];
  const source = entryKind(entry);
  if (w.actor === OPERATOR)
    return { id: OPERATOR, level: "person", memberships: [OPERATOR, OPERATIONS], source };
  return { id: w.actor, level: "team", memberships: [OPERATIONS], source };
}

/** The operator's assistant at action time: reads the person scope and the team's. */
export const operatorActor = (): Actor => ({
  id: OPERATOR,
  level: "person",
  memberships: [OPERATOR, OPERATIONS],
});

const sha256 = (s: string) => `sha256:${createHash("sha256").update(s).digest("hex")}`;

/** Every entry's confidence: a constant that clears every preset's floor, so no admission turns on a number upstream does not have. */
export const ENTRY_CONFIDENCE = 0.9;

/**
 * One entry as the item its channel writes. The ref names the entry, never
 * the case: a case id is an index into labelled data, and nothing the plane
 * stores or shows should carry one (review finding R6-4).
 */
export function entryItem(entry: MemoryEntry, id: string, at: string): MemoryItem {
  const w = CHANNEL_WRITERS[entry.channel];
  return {
    id,
    class: "semantic",
    scope: w.scope,
    owner: w.scope === OPERATOR ? OPERATOR : w.actor,
    content: entry.text,
    provenance: {
      kind: entryKind(entry),
      ref: `mem-inv-bench:entry/${entry.entry_id}`,
      hash: sha256(entry.text),
      actor: w.actor,
    },
    confidence: ENTRY_CONFIDENCE,
    valid_from: at,
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 0,
  };
}

/** The injected time of entry `index` (one minute apart from `start`) and of the action after them. */
export function phaseTimes(view: VisibleCase, start = "2026-01-01T00:00:00.000Z") {
  const base = Date.parse(start);
  const minute = (n: number) => new Date(base + n * 60_000).toISOString();
  return { entry: (index: number) => minute(index), action: minute(view.memory.length) };
}

export interface EntryWrite {
  entry_id: string;
  channel: OriginChannel;
  result: WriteResult;
}

/** The write phase: each entry through Plane.write, in order, as its channel's actor. */
export async function writePhase(
  plane: Plane,
  view: VisibleCase,
  newId: () => string,
): Promise<EntryWrite[]> {
  const times = phaseTimes(view);
  const out: EntryWrite[] = [];
  for (const [i, entry] of view.memory.entries()) {
    const at = times.entry(i);
    const item = entryItem(entry, newId(), at);
    const result = await plane.write(entryActor(entry), item, at);
    out.push({ entry_id: entry.entry_id, channel: entry.channel, result });
  }
  return out;
}

/** The retrieval phase: the operator's read at action time, every admitted item for `query`. */
export function actionRead(plane: Plane, view: VisibleCase, query = ""): Promise<ReadResult> {
  return plane.read(operatorActor(), { text: query, at: phaseTimes(view).action });
}
