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
// C5 writes the items through the Plane, C2, C3 and C4 straight to the store.
//
// C1 and C4 are GateMem's own agents (ADR 0031). C1 is its long-context
// agent: no store and no memory tool, the last 300 turns in the prompt's
// memory block, as card B1's port builds it (longContextItems). C4 shows each
// item a read returns with the metadata GateMem's RAG-Policy agent attaches
// to it (the speaker and their role) and its relationship-aware gate's
// verdict for the asker (`access`), and the model decides; upstream drops
// what its gate refuses, which would make C4 a second enforcement condition.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { gatemem } from "@engram/bench";
import {
  type Actor,
  type Adapter,
  createPlane,
  evaluateRead,
  type MemoryEvent,
  type MemoryItem,
  migrate,
  openSqlite,
  type Plane,
  type Policy,
  type PresetName,
} from "@engram/core";
import type { CacheStore, CallContext, ScriptStep, UsageRecord } from "@engram/model";
import { ENGRAM_EVENT, type RecallDetails, renderRecall } from "@engram/pi-extension";
import { z } from "zod";
import { conditionSession, type ReadMetadata, type UngovernedStore } from "./conditions.ts";
import {
  type C4VerdictSource,
  CONDITION_TABLE,
  type Condition,
  NO_STORE,
  statedPreset,
} from "./config.ts";
import { type AnswerSource, cassettePiModel } from "./model/cassette.ts";
import { closeStore, openStore, type StoreName } from "./stores.ts";

/** Deterministic UUIDv7-shaped ids: the n-th id a run hands out. */
export const sequentialIds = () => {
  let n = 0;
  return () => `01920000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
};

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
  /** The store the session ran on (card B3); `none` under C1, which opens none. */
  store: StoreName | typeof NO_STORE;
  seed: number;
  /** Turns up to the checkpoint, and how many of them the store holds after ingestion (0 under C1). */
  ingested: { turns: number; stored: number };
  tool_calls: { name: string; arguments: unknown }[];
  output: gatemem.AgentOutput;
  score: gatemem.Score;
  /** The engram.event entries of the session, in order (C5 only). */
  decisions: Decision[];
  /** The Plane's whole log: each turn's write and the session's reads, in order (C5 only). */
  events: LoggedEvent[];
  /** GateMem's judge's verdict on the answer, when the config has a judge (run.ts, J1). */
  judge?: gatemem.JudgeRow;
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
  /** The store; C1 opens none and is given `none`. */
  store: StoreName | typeof NO_STORE;
  cache: CacheStore;
  /** A fresh answer source for this session (a script restarts per session). */
  answers: () => AnswerSource;
  offline?: boolean;
  onUsage?: (usage: UsageRecord) => void;
  /** Where C4's verdict comes from (ADR 0031); `engram` when unset. */
  c4Verdicts?: C4VerdictSource;
  /** How many items a read returns in every condition (READ_LIMIT unless given). */
  readLimit?: number;
}

/** Where the memory comes from in this prompt: the tools, in every condition but C1. */
export const MEMORY_BLOCK = "(none in this prompt; retrieve memory with the memory_read tool)";

/**
 * The cache context of a probe. C1 and C2 state and enforce no policy, so
 * their preset is `none`; C1 opens no store, so its store is `none`.
 */
export function probeContext(
  spec: Pick<ProbeSpec, "checkpointId" | "condition" | "preset" | "store">,
): CallContext {
  return {
    item: `gatemem/${spec.checkpointId}`,
    condition: spec.condition,
    preset: statedPreset(spec.condition, spec.preset),
    store: CONDITION_TABLE[spec.condition].memory === "context" ? NO_STORE : spec.store,
  };
}

/**
 * C4's legend of the metadata a read carries on this arm (ADR 0031): neutral
 * wording, the same whichever source gives the verdict, and constant, so it
 * never moves a cache key. It names no benchmark (PR #25 review, P3-3).
 */
export const GATEMEM_METADATA_LEGEND = [
  "- speaker: who said it; speaker_role: their role.",
  '- access: the access policy\'s verdict for the requester: "allowed" when the requester may see this item, "denied" when they may not. A verdict depends on who is asking: the same item can be allowed for one requester and denied for another.',
].join("\n");

/**
 * C4's metadata for a checkpoint: for each turn item, its speaker and role
 * and a verdict for the asker, by item id. The verdict is a decision shown to
 * the model, not enforced (ADR 0031). Its source is `engram` by default: the
 * plane's own read decision under the policy C5 enforces, computed by core's
 * evaluateRead for the asker at the checkpoint's time, so C4 and C5 apply the
 * same policy and differ in mechanism only; it is computed for every item,
 * an item the session's model wrote included. `gatemem-rag` is GateMem's
 * RAG-Policy rule table, a different policy, which judges turns only: an
 * item the session's model wrote has no turn and carries no metadata under
 * it. The verdict is also what C4's read walks to (conditions.ts, c4Read;
 * PR #25 review round 3, V-2): under `engram`, the allowed items C4 shows are
 * exactly C5's list.
 */
export function gatememMetadata(
  mapped: gatemem.CheckpointMapping,
  source: C4VerdictSource = "engram",
  policy?: Policy,
): ReadMetadata {
  if (source === "engram" && !policy) {
    throw new Error("C4's engram verdict needs the policy C5 enforces");
  }
  const rag =
    source === "gatemem-rag"
      ? gatemem.ragPolicyGate(mapped.episode, mapped.turns, mapped.checkpoint)
      : undefined;
  const turnOf = new Map(mapped.writes.map(({ item }, i) => [item.id, i]));
  const verdict = (item: MemoryItem): boolean | undefined => {
    if (rag === undefined)
      return evaluateRead(policy as Policy, mapped.asker, item, mapped.at).admitted;
    const i = turnOf.get(item.id);
    return i === undefined ? undefined : (rag[i] as { allowed: boolean }).allowed;
  };
  const attributes = (item: MemoryItem) => {
    const v = verdict(item);
    const access = v === undefined ? [] : [["access", v ? "allowed" : "denied"] as const];
    const i = turnOf.get(item.id);
    if (i === undefined) return access.length > 0 ? access : undefined;
    const turn = mapped.turns[i] as gatemem.Turn;
    return [
      ["speaker", turn.speaker.principal_id] as const,
      ["speaker_role", turn.speaker.role] as const,
      ...access,
    ];
  };
  return {
    attributes,
    legend: GATEMEM_METADATA_LEGEND,
    admits: (item) => verdict(item) === true,
  };
}

/**
 * C1's prompts: GateMem's query prompt with its long-context agent's memory
 * block (the last 300 turns up to the checkpoint, card B1's port), and the
 * items in it.
 */
export function longContextPrompt(mapped: gatemem.CheckpointMapping): {
  system: string;
  user: string;
  items: gatemem.MemoryItem[];
  block: string;
} {
  const items = gatemem.longContextItems(mapped.turns);
  const block = gatemem.memoryBlock(items);
  return { ...gatemem.renderQueryPrompt(mapped.episode, mapped.checkpoint, block), items, block };
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
 * C5's ingestion did not land every item as C2 and C3's did: a write was not
 * allowed, or it evicted an earlier one. The conditions would then hold
 * different store contents (ADR 0015, decision D13), so the probe fails
 * rather than score a C5 that saw less (review R5-7).
 */
export class IngestionDivergedError extends Error {
  constructor(item: MemoryItem, event: MemoryEvent, evicted: number) {
    super(
      `C5 ingestion diverged from C2 and C3 at item ${item.id} (${item.provenance.ref}): ${
        evicted > 0
          ? `the write evicted ${evicted} earlier item(s)`
          : `write ${event.decision} by ${event.policy_id}: ${event.reason}`
      }; the conditions would not hold the same store contents (decision D13)`,
    );
    this.name = "IngestionDivergedError";
  }
}

/**
 * The checkpoint's turns into the store: through the Plane under C5, each as
 * its speaker's write at the turn's time; straight to the store under C2 and
 * C3, the same items, so every condition holds the same contents. Under C5
 * a write the plane does not allow, or one that evicts, is an error.
 */
async function ingest(
  writes: readonly gatemem.TurnWrite[],
  store: UngovernedStore,
  plane: Plane | undefined,
): Promise<void> {
  for (const { actor, item } of writes) {
    if (plane) {
      const result = await plane.write(actor, item, item.valid_from);
      if (result.event.decision !== "allow" || result.retention.length > 0) {
        throw new IngestionDivergedError(item, result.event, result.retention.length);
      }
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

/** What a probe hands the plane and the model, all of it from stripped fields. */
export interface ProbeInputs {
  checkpoint: gatemem.Checkpoint;
  mapped: gatemem.CheckpointMapping;
  /** The benchmark's system and user prompts, the same in every condition. */
  system: string;
  user: string;
}

/**
 * The checkpoint's mapping and prompts. Card B3's mapping strips the hidden
 * fields first; turns reach the session only up to the as-of turn, as in
 * GateMem's harness. `newId` hands out the turn items' ids.
 */
export function probeInputs(
  domain: gatemem.Domain,
  checkpointId: string,
  newId: () => string,
): ProbeInputs {
  const checkpoint = domain.checkpoints.find((c) => c.checkpoint_id === checkpointId);
  if (!checkpoint) throw new Error(`no GateMem checkpoint ${checkpointId} in ${domain.domain}`);
  const full = domain.episodes.find((e) => e.episode_id === checkpoint.episode_id);
  if (!full) throw new Error(`no episode ${checkpoint.episode_id} for ${checkpointId}`);
  const mapped = gatemem.mapCheckpoint(full, checkpoint, newId);
  const { system, user } = gatemem.renderQueryPrompt(
    mapped.episode,
    mapped.checkpoint,
    MEMORY_BLOCK,
  );
  return { checkpoint, mapped, system, user };
}

/**
 * Run one checkpoint under one condition, store and seed; the store is closed
 * after it. C1 opens no store: its memory is the prompt's long context.
 */
export async function runProbe(spec: ProbeSpec): Promise<ProbeResult> {
  if (CONDITION_TABLE[spec.condition].memory === "context") return probeOn(spec, undefined);
  if (spec.store === NO_STORE) throw new Error(`condition ${spec.condition} needs a store`);
  const adapter = await openStore(spec.store);
  try {
    return await probeOn(spec, adapter);
  } finally {
    await closeStore(adapter);
  }
}

async function probeOn(spec: ProbeSpec, adapter: Adapter | undefined): Promise<ProbeResult> {
  const newId = sequentialIds();
  const inputs = probeInputs(spec.domain, spec.checkpointId, newId);
  const { checkpoint, mapped } = inputs;
  const { at } = mapped;
  const mechanism = CONDITION_TABLE[spec.condition];
  const longContext = adapter ? undefined : longContextPrompt(mapped);
  const { system, user } = longContext ?? inputs;

  const store: UngovernedStore | undefined = adapter ? { adapter, scopes: new Set() } : undefined;
  const db = openSqlite(":memory:");
  migrate(db);
  const plane =
    adapter && mechanism.memory === "plane"
      ? createPlane({ db, adapter, policy: spec.policy, newId })
      : undefined;
  if (store) await ingest(mapped.writes, store, plane);

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
  const { session, sessionManager } = await conditionSession({
    condition: spec.condition,
    cwd,
    model: cassette,
    systemPrompt: system,
    actor: mapped.asker,
    preset: spec.preset,
    policy: spec.policy,
    ...(store ? { store } : {}),
    db,
    newId,
    now: () => at,
    ...(spec.readLimit === undefined ? {} : { readLimit: spec.readLimit }),
    ...(mechanism.metadata
      ? { metadata: gatememMetadata(mapped, spec.c4Verdicts ?? "engram", spec.policy) }
      : {}),
  });
  try {
    await session.prompt(user);
    if (cassette.errors.length > 0) throw cassette.errors[0];
    const { output: read, toolCalls } = sessionOutput(session);
    // C1's memory is its prompt's long context, as GateMem's agent reports it.
    const output = longContext
      ? {
          ...read,
          retrieved_memory: longContext.items.map((i) => ({ text: i.text })),
          prompt_memory_block: longContext.block,
        }
      : read;
    return {
      item: `gatemem/${spec.checkpointId}`,
      checkpoint_id: spec.checkpointId,
      condition: spec.condition,
      store: store ? spec.store : NO_STORE,
      seed: spec.seed,
      ingested: { turns: mapped.writes.length, stored: store ? await storedCount(store) : 0 },
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
