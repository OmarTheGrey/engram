// One GateMem checkpoint as a pi SDK session (card RN1). The episode's turns
// up to the checkpoint's as-of turn are ingested as memory writes, the
// checkpoint query is the session's prompt, and the session's final answer
// is parsed and scored with card B1's rule-based scorer.
//
// GateMem's principals, relationships and turns reach the plane through card
// B3's mapping (@engram/bench, gatemem/plane.ts; ADR 0030): each principal an
// actor with a person scope and the shared scopes of its unrestricted group
// relationships, each turn an episodic item in its speaker's person scope
// carrying read grants to the principals its unrestricted relationships
// relate it to. Every condition gets the same store contents (decision D13):
// C5 writes the items through the Plane, C2 and C3 straight to the store.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { gatemem } from "@engram/bench";
import {
  type Actor,
  type Adapter,
  createPlane,
  type MemoryEvent,
  migrate,
  openSqlite,
  type Plane,
  type Policy,
  type PresetName,
} from "@engram/core";
import { ENGRAM_EVENT, type RecallDetails, renderRecall } from "@engram/pi-extension";
import { z } from "zod";
import { conditionSession, type UngovernedStore } from "./conditions.ts";
import type { Condition } from "./config.ts";
import type { CacheStore, CallContext, UsageRecord } from "./model/cached.ts";
import { type AnswerSource, cassettePiModel } from "./model/cassette.ts";
import type { ScriptStep } from "./model/scripted.ts";
import { openStore, type StoreName } from "./stores.ts";

/** Deterministic UUIDv7-shaped ids: the n-th id a run hands out. */
export const sequentialIds = () => {
  let n = 0;
  return () => `01920000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
};

/** GateMem turn times as UTC instants (card B3 moved this to @engram/bench). */
export const turnTime = gatemem.turnTime;

/** A plain person actor (RN1's placeholder actor; the probe uses the B3 mapping's). */
export const personOf = (principalId: string): Actor => ({
  id: `person:${principalId}`,
  level: "person",
  memberships: [`person:${principalId}`],
});

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

/** One event of the Plane's log, without the item it carries (whose store_ref names the store). */
export interface LoggedEvent extends Decision {
  seq: number;
  actor: string;
  item_id: string | null;
  scope_to: string | null;
}

export interface ProbeResult {
  item: string;
  checkpoint_id: string;
  condition: Condition;
  /** The store the session ran on (card B3). */
  store: StoreName;
  seed: number;
  /** Turns ingested, and how many of them the store holds after ingestion. */
  ingested: { turns: number; stored: number };
  tool_calls: { name: string; arguments: unknown }[];
  output: gatemem.AgentOutput;
  score: gatemem.Score;
  /** The engram.event entries of the session, in order (C5 only). */
  decisions: Decision[];
  /** The Plane's whole log: each turn's write and the session's reads, in order (C5 only). */
  events: LoggedEvent[];
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
  store: StoreName;
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

/** A governed read's items as `scope: content` lines, if `details` are a read's. */
function governedRead(details: unknown): string | undefined {
  const items = (details as Partial<RecallDetails> | undefined)?.items;
  return Array.isArray(items) && typeof (details as RecallDetails).read_id === "string"
    ? renderRecall(details as RecallDetails)
    : undefined;
}

/** The answer and the memory the model was shown, from the session's messages. */
function sessionOutput(session: AgentSession): {
  output: gatemem.AgentOutput;
  toolCalls: ProbeResult["tool_calls"];
} {
  const messages = session.messages;
  // C5's session keeps a placeholder for each read (the Engram extension's
  // tag.ts, review round 2, defect 5); the items it admitted are in the
  // result's details, rendered here as C2 and C3 render theirs.
  const reads = messages.flatMap((m) =>
    m.role === "toolResult" && m.toolName === "memory_read" && !m.isError
      ? [governedRead(m.details) ?? textOf(m.content)]
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

/**
 * The checkpoint's turns into the store: through the Plane under C5, each as
 * its speaker's write at the turn's time; straight to the store under C2 and
 * C3, the same items, so every condition holds the same contents.
 */
async function ingest(
  writes: readonly gatemem.TurnWrite[],
  store: UngovernedStore,
  plane: Plane | undefined,
): Promise<void> {
  for (const { actor, item } of writes) {
    if (plane) {
      await plane.write(actor, item, item.valid_from);
    } else {
      // Ungoverned ingestion: straight to the store, as C2 and C3 read it.
      await store.adapter.write(item);
    }
    store.scopes.add(item.scope);
  }
}

async function storedCount(store: UngovernedStore): Promise<number> {
  const lists = await Promise.all([...store.scopes].map((s) => store.adapter.list(s)));
  return lists.reduce((n, l) => n + l.length, 0);
}

const logged = (e: MemoryEvent): LoggedEvent => ({
  seq: e.seq,
  op: e.op,
  decision: e.decision,
  policy_id: e.policy_id,
  actor: e.actor,
  item_id: e.item_id,
  scope_to: e.scope_to,
  reason: e.reason,
});

/** Run one checkpoint under one condition, store and seed. */
export async function runProbe(spec: ProbeSpec): Promise<ProbeResult> {
  const checkpoint = spec.domain.checkpoints.find((c) => c.checkpoint_id === spec.checkpointId);
  if (!checkpoint)
    throw new Error(`no GateMem checkpoint ${spec.checkpointId} in ${spec.domain.domain}`);
  const full = spec.domain.episodes.find((e) => e.episode_id === checkpoint.episode_id);
  if (!full) throw new Error(`no episode ${checkpoint.episode_id} for ${spec.checkpointId}`);
  const newId = sequentialIds();
  // Card B3's mapping strips the hidden fields first; turns reach the session
  // only up to the as-of turn, as in GateMem's harness.
  const mapped = gatemem.mapCheckpoint(full, checkpoint, newId);
  const { episode, checkpoint: view, at } = mapped;

  const adapter: Adapter = await openStore(spec.store);
  const store: UngovernedStore = { adapter, scopes: new Set() };
  const db = openSqlite(":memory:");
  migrate(db);
  const plane =
    spec.condition === "C5" ? createPlane({ db, adapter, policy: spec.policy, newId }) : undefined;
  await ingest(mapped.writes, store, plane);

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
    actor: mapped.asker,
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
      store: spec.store,
      seed: spec.seed,
      ingested: { turns: mapped.writes.length, stored: await storedCount(store) },
      tool_calls: toolCalls,
      output,
      score: gatemem.scoreOne(checkpoint, output),
      decisions: sessionDecisions(sessionManager),
      events: plane ? plane.events().map(logged) : [],
    };
  } finally {
    session.dispose();
    db.close();
    rmSync(cwd, { recursive: true, force: true });
  }
}
