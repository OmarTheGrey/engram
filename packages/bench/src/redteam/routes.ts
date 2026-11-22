// The two routes and the five source kinds of card X14, in MEM-INV-Bench's
// deployment (ADR 0029, card B4), which the harness extends rather than
// replaces: each kind's writer is the MEM-INV-Bench channel that writes that
// kind (packages/bench/src/mem-inv-bench/plane.ts, CHANNEL_WRITERS), user
// and model content into the operator's person scope, document and tool
// content into the team scope, as the operator's connected services write
// it. `external` has no MEM-INV-Bench channel; its writer is a connector of
// the same shape as the web feed's, writing the kind ADR 0004 gives an
// untrusted outsider.
//
// The write route: the content crosses Plane.write as that writer, the
// actor's attested source the kind. The read route: the same content placed
// in the store outside the plane, in the reader's own person scope (where a
// store's own memories live, plane/before-read.ts), its record claiming the
// kind, and adopted at read by core's adoptStoreItems as the scope's owner.
//
// Every scenario gets a scope pair of its own (`person:rt-<n>`,
// `team:rt-<n>`), so one scenario's canary can never come back in
// another's read. The reader is the scope's person, reading both scopes.
import type { Actor, MemoryItem } from "@engram/core";
import { CHANNEL_WRITERS, type ChannelWriter, OPERATOR } from "../mem-inv-bench/plane.ts";
import type { OriginChannel } from "../mem-inv-bench/schema.ts";

export const ROUTES = ["write", "read"] as const;
export type Route = (typeof ROUTES)[number];

export const SOURCE_KINDS = ["user", "document", "tool", "model", "external"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/**
 * What a cell plants as: a source kind, or `unattested`, the write route
 * only: the scenario's person writing with no attested source (a library
 * caller, an HTTP client that sends none) while the item claims `user`, the
 * most trusted kind. Without card E2.11's floor the claim stands (ADR 0004,
 * decision D4); with it the write is recorded at the least trusted kind.
 * Adoption always attests `import`, so the read route has no such cell.
 */
export const PLANT_KINDS = [...SOURCE_KINDS, "unattested"] as const;
export type PlantKind = (typeof PLANT_KINDS)[number];

/** The kind an unattested writer's item claims. */
export const UNATTESTED_CLAIM = "user";

/** The MEM-INV-Bench origin channel each kind's writer is, or null (external). */
export const KIND_CHANNEL: Readonly<Record<SourceKind, OriginChannel | null>> = {
  user: "user",
  document: "web",
  tool: "tool",
  model: "agent",
  external: null,
};

const CONNECTOR: ChannelWriter = {
  actor: "agent:connector",
  kind: "external",
  scope: "team:operations",
  origin: "untrusted",
};

export function writerOf(kind: SourceKind): ChannelWriter {
  const channel = KIND_CHANNEL[kind];
  const w = channel === null ? CONNECTOR : CHANNEL_WRITERS[channel];
  if (w.kind !== kind) throw new Error(`the ${kind} writer writes ${w.kind}`);
  return w;
}

export interface Scopes {
  person: string;
  team: string;
}

export const scopesOf = (n: number): Scopes => ({ person: `person:rt-${n}`, team: `team:rt-${n}` });

/** The scenario's person: its reader, and the owner its store's own memories are adopted as. */
export const readerOf = (s: Scopes): Actor => ({
  id: s.person,
  level: "person",
  memberships: [s.person, s.team],
});

/** Who writes, as which actor, into which scope, on the write route. */
export function writeTarget(
  kind: PlantKind,
  s: Scopes,
): { actor: Actor; scope: string; owner: string } {
  if (kind === "unattested") return { actor: readerOf(s), scope: s.person, owner: s.person };
  const w = writerOf(kind);
  if (w.actor === OPERATOR)
    return { actor: { ...readerOf(s), source: kind }, scope: s.person, owner: s.person };
  return {
    actor: { id: w.actor, level: "team", memberships: [s.team], source: kind },
    scope: s.team,
    owner: w.actor,
  };
}

/** Every planted record's confidence: MEM-INV-Bench's, clearing every preset's floor. */
export const CONFIDENCE = 0.9;

export function plantedItem(args: {
  id: string;
  scope: string;
  owner: string;
  content: string;
  kind: MemoryItem["provenance"]["kind"];
  actor: string;
  ref: string;
  hash: string;
  at: string;
}): MemoryItem {
  return {
    id: args.id,
    class: "semantic",
    scope: args.scope,
    owner: args.owner,
    content: args.content,
    provenance: { kind: args.kind, ref: args.ref, hash: args.hash, actor: args.actor },
    confidence: CONFIDENCE,
    valid_from: args.at,
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
  };
}
