// One GateMem checkpoint as a pi SDK session (card RN1). The episode's turns
// up to the checkpoint's as-of turn are ingested as memory writes, the
// checkpoint query is the session's prompt, and the session's final answer
// is parsed and scored with card B1's rule-based scorer.
//
// The mapping from GateMem principals to Engram scopes is the simplest one
// and a placeholder for the experiment cards: each turn is an episodic item
// in its speaker's person scope, written by the speaker from user content
// (model content for the `agent` role), and the requester reads as their own
// person. Relationships are not mapped to grants. Under C5 the requester
// therefore sees only their own turns. The pipeline is what this card
// tests; scores under this mapping are not findings about the plane.
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { createFakeAdapter } from "@engram/adapters";
import { gatemem } from "@engram/bench";
import {
  type Actor,
  type Adapter,
  createPlane,
  type MemoryItem,
  migrate,
  openSqlite,
  type Policy,
  type PresetName,
} from "@engram/core";
import { ENGRAM_EVENT } from "@engram/pi-extension";
import { z } from "zod";
import { conditionSession, type UngovernedStore } from "./conditions.ts";
import type { Condition } from "./config.ts";
import type { CacheStore, CallContext, UsageRecord } from "./model/cached.ts";
import { type AnswerSource, cassettePiModel } from "./model/cassette.ts";
import type { ScriptStep } from "./model/scripted.ts";

/** Deterministic UUIDv7-shaped ids: the n-th id a run hands out. */
export const sequentialIds = () => {
  let n = 0;
  return () => `01920000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
};

/** GateMem turn times (`2026-03-14T08:00`) as UTC instants; a turn without one gets minute `index`. */
export function turnTime(turn: gatemem.Turn, index: number): string {
  if (turn.timestamp) {
    const parsed = Date.parse(
      `${turn.timestamp}${/[zZ]|[+-]\d\d:\d\d$/.test(turn.timestamp) ? "" : "Z"}`,
    );
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString();
}

export const personOf = (principalId: string): Actor => ({
  id: `person:${principalId}`,
  level: "person",
  memberships: [`person:${principalId}`],
});

const sha256 = (s: string) => `sha256:${createHash("sha256").update(s).digest("hex")}`;

/** One turn as the item its speaker writes. */
export function turnItem(
  episode: gatemem.AgentEpisode,
  turn: gatemem.Turn,
  index: number,
  id: string,
): MemoryItem {
  const speaker = personOf(turn.speaker.principal_id);
  return {
    id,
    class: "episodic",
    scope: speaker.id,
    owner: speaker.id,
    content: turn.text,
    provenance: {
      kind: turn.speaker.role === "agent" ? "model" : "user",
      ref: `gatemem:${episode.episode_id}/${turn.turn_id}`,
      hash: sha256(turn.text),
      actor: speaker.id,
    },
    confidence: 0.9,
    valid_from: turnTime(turn, index),
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

/** The scripted model's steps per checkpoint id. */
export const ProbeScript = z.strictObject({
  steps: z.record(
    z.string(),
    z.array(
      z.union([
        z.strictObject({
          toolCall: z.strictObject({
            id: z.string(),
            name: z.string(),
            arguments: z.record(z.string(), z.unknown()),
          }),
        }),
        z.strictObject({ text: z.string() }),
      ]),
    ),
  ),
});
/** Parsed from JSON, so every tool call's arguments are JSON values. */
export type ProbeScript = { steps: Record<string, ScriptStep[]> };

export const readProbeScript = (path: string): ProbeScript =>
  ProbeScript.parse(JSON.parse(readFileSync(path, "utf8"))) as ProbeScript;

/** Where a policy decision of the run came from, for the results. */
export interface Decision {
  op: string;
  decision: string;
  policy_id: string;
  reason: string;
}

export interface ProbeResult {
  item: string;
  checkpoint_id: string;
  condition: Condition;
  seed: number;
  /** Turns ingested, and how many of them the store holds after ingestion. */
  ingested: { turns: number; stored: number };
  tool_calls: { name: string; arguments: unknown }[];
  output: gatemem.AgentOutput;
  score: gatemem.Score;
  /** The engram.event entries of the session, in order (C5 only). */
  decisions: Decision[];
}

export interface ProbeSpec {
  domain: gatemem.Domain;
  checkpointId: string;
  condition: Condition;
  seed: number;
  /** `provider/model-id`. */
  model: string;
  preset: PresetName;
  policy: Policy;
  store: "fake";
  cache: CacheStore;
  /** A fresh answer source for this session (a script restarts per session). */
  answers: () => AnswerSource;
  offline?: boolean;
  onUsage?: (usage: UsageRecord) => void;
}

/** Where the memory comes from in this prompt: the tools, in every condition. */
export const MEMORY_BLOCK = "(none in this prompt; retrieve memory with the memory_read tool)";

/** The cache context of a probe. C2 states and enforces no policy, so its preset is `none`. */
export function probeContext(
  spec: Pick<ProbeSpec, "checkpointId" | "condition" | "preset" | "store">,
): CallContext {
  return {
    item: `gatemem/${spec.checkpointId}`,
    condition: spec.condition,
    preset: spec.condition === "C2" ? "none" : spec.preset,
    store: spec.store,
  };
}

const textOf = (content: unknown): string =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.flatMap((c) => (c && c.type === "text" ? [String(c.text)] : [])).join("")
      : "";

function sessionDecisions(sessionManager: SessionManager): Decision[] {
  return sessionManager.getEntries().flatMap((e) => {
    if (e.type !== "custom" || e.customType !== ENGRAM_EVENT) return [];
    const { op, decision, policy_id, reason } = e.data as Decision;
    return [{ op, decision, policy_id, reason }];
  });
}

/** The answer and the memory the model was shown, from the session's messages. */
function sessionOutput(session: AgentSession): {
  output: gatemem.AgentOutput;
  toolCalls: ProbeResult["tool_calls"];
} {
  const messages = session.messages;
  const reads = messages.flatMap((m) =>
    m.role === "toolResult" && m.toolName === "memory_read" && !m.isError
      ? [textOf(m.content)]
      : [],
  );
  const toolCalls = messages.flatMap((m) =>
    m.role === "assistant"
      ? m.content.flatMap((c) =>
          c.type === "toolCall" ? [{ name: c.name, arguments: c.arguments }] : [],
        )
      : [],
  );
  const final = [...messages].reverse().find((m) => m.role === "assistant");
  const parsed = gatemem.parseModelOutput(final ? textOf(final.content) : "");
  const block = reads.join("\n");
  return {
    output: {
      ...parsed,
      retrieved_memory: reads.flatMap((r) => r.split("\n")).map((text) => ({ text })),
      prompt_memory_block: block,
    },
    toolCalls,
  };
}

async function ingest(
  condition: Condition,
  episode: gatemem.AgentEpisode,
  turns: readonly gatemem.Turn[],
  deps: {
    store: UngovernedStore;
    db: ReturnType<typeof openSqlite>;
    policy: Policy;
    newId: () => string;
  },
): Promise<void> {
  const plane =
    condition === "C5"
      ? createPlane({
          db: deps.db,
          adapter: deps.store.adapter,
          policy: deps.policy,
          newId: deps.newId,
        })
      : undefined;
  for (const [i, turn] of turns.entries()) {
    const item = turnItem(episode, turn, i, deps.newId());
    if (plane) {
      await plane.write(personOf(turn.speaker.principal_id), item, item.valid_from);
    } else {
      // Ungoverned ingestion: straight to the store, as C2 and C3 read it.
      await deps.store.adapter.write(item);
    }
    deps.store.scopes.add(item.scope);
  }
}

async function storedCount(store: UngovernedStore): Promise<number> {
  const lists = await Promise.all([...store.scopes].map((s) => store.adapter.list(s)));
  return lists.reduce((n, l) => n + l.length, 0);
}

/** Run one checkpoint under one condition and seed. */
export async function runProbe(spec: ProbeSpec): Promise<ProbeResult> {
  const checkpoint = spec.domain.checkpoints.find((c) => c.checkpoint_id === spec.checkpointId);
  if (!checkpoint)
    throw new Error(`no GateMem checkpoint ${spec.checkpointId} in ${spec.domain.domain}`);
  const full = spec.domain.episodes.find((e) => e.episode_id === checkpoint.episode_id);
  if (!full) throw new Error(`no episode ${checkpoint.episode_id} for ${spec.checkpointId}`);
  const episode = gatemem.visibleEpisode(full);
  const view = gatemem.visibleCheckpoint(checkpoint);
  // Turns reach the session only up to the as-of turn, as in GateMem's harness.
  const upTo = full.turns.findIndex((t) => t.turn_id === view.as_of_turn_id);
  const turns = full.turns.slice(0, upTo + 1).map(gatemem.visibleTurn);
  const at = turnTime(turns.at(-1) as gatemem.Turn, upTo);

  const newId = sequentialIds();
  const adapter: Adapter = createFakeAdapter();
  const store: UngovernedStore = { adapter, scopes: new Set() };
  const db = openSqlite(":memory:");
  migrate(db);
  await ingest(spec.condition, episode, turns, { store, db, policy: spec.policy, newId });

  const cwd = mkdtempSync(join(tmpdir(), "engram-rn1-"));
  const cassette = cassettePiModel({
    model: spec.model,
    seed: spec.seed,
    cwd,
    cache: spec.cache,
    context: probeContext(spec),
    answers: spec.answers(),
    ...(spec.offline === undefined ? {} : { offline: spec.offline }),
    ...(spec.onUsage === undefined ? {} : { onUsage: spec.onUsage }),
  });
  const { system, user } = gatemem.renderQueryPrompt(episode, view, MEMORY_BLOCK);
  const { session, sessionManager } = await conditionSession({
    condition: spec.condition,
    cwd,
    model: cassette,
    systemPrompt: system,
    actor: personOf(view.asker.principal_id),
    preset: spec.preset,
    policy: spec.policy,
    store,
    db,
    newId,
    now: () => at,
  });
  try {
    await session.prompt(user);
    if (cassette.errors.length > 0) throw cassette.errors[0];
    const { output, toolCalls } = sessionOutput(session);
    return {
      item: `gatemem/${spec.checkpointId}`,
      checkpoint_id: spec.checkpointId,
      condition: spec.condition,
      seed: spec.seed,
      ingested: { turns: turns.length, stored: await storedCount(store) },
      tool_calls: toolCalls,
      output,
      score: gatemem.scoreOne(checkpoint, output),
      decisions: sessionDecisions(sessionManager),
    };
  } finally {
    session.dispose();
    db.close();
    rmSync(cwd, { recursive: true, force: true });
  }
}
