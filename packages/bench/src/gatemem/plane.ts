// Derived from GateMem (MIT, Copyright (c) 2026 Renz); the licence text is in
// fixtures/bench/gatemem/UPSTREAM-LICENSE.
//
// GateMem through the plane (card B3, ADR 0030, plan decision 7 of
// docs/tasks/gate-b-plan.md): GateMem's principals as Engram actors, its
// relationships as shared-scope memberships and read grants, and each turn as
// the episodic item its speaker writes.
//
// The mapping reads only what strip.ts lets an agent see: the episode's
// principals and relationships (visibleEpisode), its turns (visibleTurn) and
// the checkpoint's asker and as-of turn (visibleCheckpoint). `mapCheckpoint`
// takes the loaded episode and checkpoint and passes them through those
// functions first, so no hidden field (query_type, expected_action,
// judge_spec, leak_targets, attack_type) can reach it; plane.test.ts changes
// every hidden field and checks that nothing in the mapping moves.
//
// The rule is structural and the same for every relationship type (there are
// 90 at the pin, none documented): what a relationship says is read from the
// shape of its fields, never from its `type` name.
//
// - A field whose value is a principal id of the episode names a party.
// - A field ending in `_id` whose value is not a principal names a group
//   (project, program, household, case, course, building). One person id is
//   read this way: `guest_id` `guest_noah_kim`, a guest the episode does not
//   list as a principal; its relationship is restricted, so it maps to nothing.
// - `expires`, when it parses as a time, is the relationship's end.
// - Any other field (access_scope, scope, access_level, service_scope) is a
//   free-text restriction such as "scheduling_only" or "rides and check-in
//   only until revoked". Engram's grants narrow by class, mode and expiry,
//   never by topic, so no membership or grant expresses it without loss: a
//   restricted relationship maps to nothing, and its parties read each other
//   only through another relationship. Restrictions err towards denial.
//
// An unrestricted relationship makes every party a member of each group it
// names (`team:<group kind>/<value>`), and every party relates to every
// other party. Each turn is an episodic item in its speaker's person scope,
// since the preset keeps episodic items there (medium forbids them in role,
// team and org); a team membership therefore admits no turn, and what the
// relationship shares reaches the related principals as read grants on the
// speaker's turns: one grant per principal who is a party with the speaker to
// an unrestricted relationship, or a party to one naming a group the speaker
// is a party to. The agent principal's turns are model content, which carries
// no grants (ADR 0004), so they stay with the agent.
//
// Symmetry and per-speaker granularity err towards access (review R5-2): both
// parties of a relationship read each other; a grant covers every turn of its
// speaker, whatever the turn is about; and a group shares each member's turns
// with every other member, about any group the speaker is in. So an advisor's
// turns about advisee B reach advisee A, who is also advised by them. ADR 0030
// states each of these as a limit.
import { createHash } from "node:crypto";
import type { Actor, MemoryItem } from "@engram/core";
import type { Checkpoint, Episode, Turn } from "./schema.ts";
import {
  type AgentCheckpoint,
  type AgentEpisode,
  visibleCheckpoint,
  visibleEpisode,
  visibleTurn,
} from "./strip.ts";

/** GateMem's role for the assistant it evaluates; its turns are model content. */
export const AGENT_ROLE = "agent";

/**
 * A grant's end when the relationship states none. The gate requires an
 * expiry on every grant (ADR 0021); GateMem's relationships hold for the
 * whole episode, so the grant does too.
 */
export const OPEN_END = "9999-12-31T23:59:59Z";

/** Confidence of a turn: a statement someone made, recorded as said. */
export const TURN_CONFIDENCE = 0.9;

const SAFE = /^[A-Za-z0-9._-]+$/;

/** The actor id of a principal; refuses an id the scope syntax cannot carry. */
export function principalScope(principalId: string): string {
  if (!SAFE.test(principalId)) {
    throw new Error(`GateMem principal id ${JSON.stringify(principalId)} is not a safe scope id`);
  }
  return `person:${principalId}`;
}

/** The shared scope of a group a relationship names, `team:<kind>/<value>`. */
export function groupScope(key: string, value: string): string {
  const kind = key.slice(0, -"_id".length);
  if (!SAFE.test(kind) || !SAFE.test(value)) {
    throw new Error(`GateMem group ${key}=${JSON.stringify(value)} is not a safe scope id`);
  }
  return `team:${kind}/${value}`;
}

/** What one relationship says in Engram's terms. */
export interface MappedRelationship {
  /** Its index in the episode's relationships. */
  index: number;
  type: string;
  /** Principal ids it names. */
  parties: string[];
  /** Shared scopes it names. */
  groups: string[];
  /** When it ends, if it says so. */
  expires: string | null;
  /** Fields carrying a free-text restriction; non-empty means the relationship maps to nothing. */
  restrictions: string[];
}

/** The time a field holds, if it is one; GateMem writes times without a zone (UTC). */
export function asTime(value: string): string | null {
  const full = /^\d{4}-\d\d-\d\d$/.test(value) ? `${value}T00:00:00` : value;
  const zoned = /[zZ]|[+-]\d\d:\d\d$/.test(full) ? full : `${full}Z`;
  const parsed = Date.parse(zoned);
  return /^\d{4}-\d\d-\d\d/.test(value) && !Number.isNaN(parsed)
    ? new Date(parsed).toISOString()
    : null;
}

/** One relationship read from the shape of its fields (see the header). */
export function mapRelationship(
  relationship: Record<string, string>,
  index: number,
  principals: ReadonlySet<string>,
): MappedRelationship {
  const out: MappedRelationship = {
    index,
    type: relationship.type ?? "",
    parties: [],
    groups: [],
    expires: null,
    restrictions: [],
  };
  for (const key of Object.keys(relationship).sort()) {
    const value = relationship[key] as string;
    if (key === "type") continue;
    if (principals.has(value)) {
      if (!out.parties.includes(value)) out.parties.push(value);
    } else if (key.endsWith("_id") && key.length > 3) {
      out.groups.push(groupScope(key, value));
    } else if (key === "expires" && asTime(value) !== null) {
      out.expires = asTime(value);
    } else {
      out.restrictions.push(key);
    }
  }
  return out;
}

/** One principal of the episode as the plane sees it. */
export interface MappedPrincipal {
  principal_id: string;
  role: string;
  actor: Actor;
  /** Read grants every turn this principal speaks carries (none for the agent). */
  grants: MemoryItem["grants"];
}

/** The episode's principals, relationships and the grants they imply. */
export interface EpisodeMapping {
  episode_id: string;
  principals: Record<string, MappedPrincipal>;
  relationships: MappedRelationship[];
}

/** Sorted, unique. */
const sortedSet = (values: Iterable<string>) => [...new Set(values)].sort();

/** The mapping of one episode's agent-visible scaffold (principals and relationships). */
export function mapEpisode(episode: AgentEpisode): EpisodeMapping {
  const ids = new Set(episode.entities.principals.map((p) => p.principal_id));
  const relationships = (episode.entities.relationships ?? []).map((r, i) =>
    mapRelationship(r, i, ids),
  );
  const usable = relationships.filter((r) => r.restrictions.length === 0);
  const principals: Record<string, MappedPrincipal> = {};
  for (const p of episode.entities.principals) {
    const own = principalScope(p.principal_id);
    const mine = usable.filter((r) => r.parties.includes(p.principal_id));
    const groups = new Set(mine.flatMap((r) => r.groups));
    // Who reads this principal's turns, and until when (the latest end of
    // the relationships that relate them).
    const until = new Map<string, string>();
    const relate = (other: string, end: string | null) => {
      if (other === p.principal_id) return;
      const at = end ?? OPEN_END;
      const was = until.get(other);
      if (was === undefined || was < at) until.set(other, at);
    };
    for (const r of mine) for (const other of r.parties) relate(other, r.expires);
    for (const r of usable) {
      if (r.groups.some((g) => groups.has(g))) {
        for (const other of r.parties) relate(other, r.expires);
      }
    }
    const isAgent = p.role === AGENT_ROLE;
    principals[p.principal_id] = {
      principal_id: p.principal_id,
      role: p.role,
      actor: {
        id: own,
        level: "person",
        memberships: [own, ...sortedSet(groups)],
        source: isAgent ? "model" : "user",
      },
      grants: isAgent
        ? []
        : [...until.keys()].sort().map((other) => ({
            to: principalScope(other),
            class: "episodic" as const,
            mode: "read" as const,
            expires: until.get(other) as string,
          })),
    };
  }
  return { episode_id: episode.episode_id, principals, relationships };
}

/** GateMem turn times (`2026-03-14T08:00`) as UTC instants; a turn without one gets minute `index`. */
export function turnTime(turn: Turn, index: number): string {
  if (turn.timestamp) {
    const parsed = Date.parse(
      `${turn.timestamp}${/[zZ]|[+-]\d\d:\d\d$/.test(turn.timestamp) ? "" : "Z"}`,
    );
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString();
}

const sha256 = (s: string) => `sha256:${createHash("sha256").update(s).digest("hex")}`;

/** The speaker's mapping; a speaker the episode does not list is refused. */
function speakerOf(mapping: EpisodeMapping, turn: Turn): MappedPrincipal {
  const speaker = mapping.principals[turn.speaker.principal_id];
  if (!speaker) {
    throw new Error(
      `GateMem turn ${turn.turn_id} of ${mapping.episode_id}: speaker ${turn.speaker.principal_id} is not a principal of the episode`,
    );
  }
  return speaker;
}

/** One turn as the write its speaker makes: the actor and the item. */
export interface TurnWrite {
  actor: Actor;
  item: MemoryItem;
}

/** One turn as the episodic item its speaker writes into their person scope. */
export function turnWrite(
  mapping: EpisodeMapping,
  turn: Turn,
  index: number,
  id: string,
): TurnWrite {
  const speaker = speakerOf(mapping, turn);
  const actor = speaker.actor;
  return {
    actor,
    item: {
      id,
      class: "episodic",
      scope: actor.id,
      owner: actor.id,
      content: turn.text,
      provenance: {
        kind: actor.source ?? "user",
        ref: `gatemem:${mapping.episode_id}/${turn.turn_id}`,
        hash: sha256(turn.text),
        actor: actor.id,
      },
      confidence: TURN_CONFIDENCE,
      valid_from: turnTime(turn, index),
      valid_to: null,
      ttl: null,
      grants: structuredClone(speaker.grants),
      version: 1,
      lineage: [],
      status: "active",
      store_ref: null,
      schema_version: 0,
    },
  };
}

/** A checkpoint through the plane: who asks, as of when, and the writes before it. */
export interface CheckpointMapping {
  episode: AgentEpisode;
  checkpoint: AgentCheckpoint;
  mapping: EpisodeMapping;
  /** The asker as the actor the read is made as. */
  asker: Actor;
  /** The turns up to and including the as-of turn, stripped (visibleTurn), in order. */
  turns: Turn[];
  /** The same turns as their speakers' writes, in order. */
  writes: TurnWrite[];
  /** The as-of turn's time: when the writes are done and the question is asked. */
  at: string;
}

/**
 * The mapping for one checkpoint. Takes the loaded episode and checkpoint
 * and strips them first (strip.ts), so the hidden fields never reach it.
 * `newId` hands out each turn item's id, in turn order.
 */
export function mapCheckpoint(
  loaded: Episode,
  loadedCheckpoint: Checkpoint,
  newId: () => string,
): CheckpointMapping {
  const episode = visibleEpisode(loaded);
  const checkpoint = visibleCheckpoint(loadedCheckpoint);
  if (checkpoint.episode_id !== episode.episode_id) {
    throw new Error(
      `GateMem checkpoint ${checkpoint.checkpoint_id} belongs to ${checkpoint.episode_id}, not ${episode.episode_id}`,
    );
  }
  const upTo = loaded.turns.findIndex((t) => t.turn_id === checkpoint.as_of_turn_id);
  if (upTo < 0) {
    throw new Error(
      `GateMem checkpoint ${checkpoint.checkpoint_id}: no turn ${checkpoint.as_of_turn_id}`,
    );
  }
  const turns = loaded.turns.slice(0, upTo + 1).map(visibleTurn);
  const mapping = mapEpisode(episode);
  const asker = mapping.principals[checkpoint.asker.principal_id];
  if (!asker) {
    throw new Error(
      `GateMem checkpoint ${checkpoint.checkpoint_id}: asker ${checkpoint.asker.principal_id} is not a principal of the episode`,
    );
  }
  return {
    episode,
    checkpoint,
    mapping,
    asker: asker.actor,
    turns,
    writes: turns.map((t, i) => turnWrite(mapping, t, i, newId())),
    at: turnTime(turns.at(-1) as Turn, upTo),
  };
}
