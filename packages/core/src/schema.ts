// The contract (ADR 0002, docs/architecture.md "Memory model"). Every other
// shape is generated from these schemas: JSON Schema in sdk/schema/ and Python
// types in research/engram_types/, both by `make api`. A change here is its own
// PR: bump SCHEMA_VERSION, add a migration, run `make api`, update fixtures.
import { z } from "zod";

/**
 * 1 (2026-11-06): read events carry the ids they returned (`item_ids`), and
 * provenance has the kind `external`, ranked below every other. Migration 4
 * upgrades a version 0 log.
 *
 * The one exception to a bump (ADR 0002, decision D2; AGENTS.md rule 5): a
 * purely additive, optional field with no default, of a contract that is
 * never persisted (today the policy document alone), whose absence parses
 * and serialises byte for byte as before. The policy's `content_guards` and
 * `trust` blocks (card E2.8) were added so. A change to a persisted
 * contract (MemoryItem, MemoryEvent, LintFinding, Explanation) still bumps
 * the version and adds a migration.
 */
export const SCHEMA_VERSION = 1;
const schemaVersion = z.literal(SCHEMA_VERSION);

/** UUIDv7, so ids sort by creation time (ADR 0003). */
export const Id = z.uuid({ version: "v7" });
/** UTC timestamp, ISO 8601 with a Z offset. */
export const Timestamp = z.iso.datetime();

export const MemoryClass = z.enum(["episodic", "semantic", "procedural"]);
export const ScopeLevel = z.enum(["person", "role", "team", "org"]);
/** Where an item lives: `person:<id>`, `role:<id>`, `team:<id>` or `org`. */
export const Scope = z.string().regex(/^(?:(?:person|role|team):[A-Za-z0-9._\-/]+|org)$/);
/** A principal id, for example `person:omar` or `agent:pi`. */
export const Principal = z.string().min(1);
export const Status = z.enum(["candidate", "active", "retired"]);
/**
 * Where content came from (ADR 0004). `external` is content from an untrusted
 * outsider, such as a public web page or an inbound mail a connector ingests;
 * it ranks below every other kind, so a tool echoing it inherits `external`.
 */
export const ProvenanceKind = z.enum([
  "user",
  "document",
  "tool",
  "model",
  "import",
  "compaction",
  "external",
]);
/** Any JSON value; structured content is limited to it so storage never changes it. */
export const JsonValue = z.json();
/** Retention hint in seconds. */
export const Ttl = z.int().positive();

export const Provenance = z.strictObject({
  kind: ProvenanceKind,
  ref: z.string().min(1),
  /** Hash of the evidence at write time, `sha256:<hex>`; the source-changed lint compares it. */
  hash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  actor: Principal,
  session_entry_id: z.string().min(1).optional(),
  /** The model that wrote the content, `provider/model-id`, when `kind` is model or compaction. */
  model: z.string().min(1).optional(),
});

export const Grant = z.strictObject({
  /** A principal or an agent pattern such as `agent:claude-code/*`. */
  to: z.string().min(1),
  class: MemoryClass.optional(),
  mode: z.enum(["read", "read_write"]),
  expires: Timestamp.optional(),
});

export const ProceduralContent = z.strictObject({
  /** The skill body, SKILL.md style. */
  body: z.string().min(1),
  /** Tools the skill may call. */
  tools: z.array(z.string().min(1)),
});

const itemFields = {
  id: Id,
  scope: Scope,
  owner: Principal,
  provenance: Provenance,
  confidence: z.number().min(0).max(1),
  valid_from: Timestamp,
  /** Null means the validity window is open. */
  valid_to: Timestamp.nullable(),
  ttl: Ttl.nullable(),
  grants: z.array(Grant),
  version: z.int().positive(),
  /** Ids of the versions this one supersedes, nearest first. */
  lineage: z.array(Id),
  status: Status,
  /** Where the bytes live; opaque to the plane. Null until an adapter has stored the item. */
  store_ref: z.strictObject({ adapter: z.string().min(1), key: z.string().min(1) }).nullable(),
  schema_version: schemaVersion,
};

/** Procedural items carry a skill body and a tool allowlist; other classes carry text or a payload. */
export const MemoryItem = z.discriminatedUnion("class", [
  z
    .strictObject({ ...itemFields, class: z.literal("procedural"), content: ProceduralContent })
    .meta({ title: "ProceduralItem" }),
  z
    .strictObject({
      ...itemFields,
      class: z.enum(["episodic", "semantic"]),
      content: z.union([z.string(), z.record(z.string(), JsonValue)]),
    })
    .meta({ title: "KnowledgeItem" }),
]);

export const LintFinding = z.strictObject({
  id: Id,
  lint_id: z.string().min(1),
  item_id: Id,
  tier: z.enum(["deterministic", "model", "procedural"]),
  severity: z.enum(["info", "warn", "error"]),
  message: z.string().min(1),
  evidence: z.array(z.string()),
  schema_version: schemaVersion,
});

export const Usage = z.strictObject({
  input_tokens: z.int().nonnegative(),
  output_tokens: z.int().nonnegative(),
  cost_usd: z.number().nonnegative(),
});

export const EventOp = z.enum([
  "write",
  "read",
  "update",
  "evict",
  "promote",
  "retire",
  "lint",
  "gate",
  "bypass_blocked",
]);

/** Append-only; the source of truth. Item state is a projection of these (ADR 0003). */
export const MemoryEvent = z.strictObject({
  id: Id,
  /** Dense sequence number assigned by the log. */
  seq: z.int().nonnegative(),
  ts: Timestamp,
  op: EventOp,
  item_id: Id.nullable(),
  actor: Principal,
  scope_from: Scope.nullable(),
  scope_to: Scope.nullable(),
  decision: z.enum(["allow", "deny", "ask"]),
  reason: z.string().min(1),
  policy_id: z.string().min(1),
  /** The item state this event produces, for ops that change an item; replay rebuilds from it. */
  item: MemoryItem.nullable().optional(),
  /** Model usage for any call made on the plane's behalf (ADR 0017). */
  usage: Usage.optional(),
  /**
   * On a read: the ids of the items it returned, in rank order, so utility
   * (how often reads returned an item, ADR 0025) replays from the log alone.
   * Only the reader sees a read event; it names nothing the read did not return.
   */
  item_ids: z.array(Id).optional(),
  schema_version: schemaVersion,
});

export const WriteRule = z.strictObject({
  scope: ScopeLevel,
  allowed_sources: z.array(ProvenanceKind),
  confidence_floor: z.number().min(0).max(1),
  forbidden_classes: z.array(MemoryClass),
  requires_review: z.boolean(),
});

export const RetentionRule = z.strictObject({
  scope: ScopeLevel,
  class: MemoryClass,
  ttl: Ttl.nullable(),
  /** Maximum active items; eviction retires, never deletes (ADR 0010). */
  budget: z.int().positive().nullable(),
  eviction: z.enum(["recency", "utility", "manual"]),
});

/** A content guard's outcome on a match (ADR 0039): none, hold as a candidate, or deny. */
export const GuardMode = z.enum(["off", "review", "block"]);
/** The injection screen's rule set (ADR 0039), or none. */
export const InjectionScreen = z.enum(["off", "default", "hardened"]);
/** An opt-in trust option (ADR 0040). */
export const TrustSwitch = z.enum(["off", "on"]);

/**
 * Deterministic content guards at the write gate (ADR 0039). Optional, with
 * no default, and so is every option in it: an absent block or option is
 * off, and a policy without the block parses to the object it parsed to
 * before (ADR 0002, decision D2). Enforced by nothing yet, so the loader
 * refuses any value but `off` until its card lands: E2.9 for `secrets`,
 * `pii` and `max_content_bytes`, E2.10 for `injection_screen`.
 */
export const ContentGuards = z.strictObject({
  /** Credentials and keys in content. */
  secrets: GuardMode.optional(),
  /** Personal data in content. */
  pii: GuardMode.optional(),
  /**
   * The injection screen and its rule set, `default` or `hardened`. Its
   * standing-directive and persistence rules apply only to content a person
   * did not type; its other rules (an imperative addressed to the agent,
   * ignore-previous, authority escalation, an encoded blob) apply to every
   * write (ADR 0039, decision 5; card E2.10).
   */
  injection_screen: InjectionScreen.optional(),
  /** Largest content admitted, in bytes; absent means no limit. */
  max_content_bytes: z.int().positive().optional(),
});

/**
 * Trust floors (ADR 0040). Optional, with no default, as `ContentGuards` is;
 * absent means off. Enforced by nothing yet, so the loader refuses `on`
 * until card E2.11 lands.
 */
export const Trust = z.strictObject({
  /** A write whose actor has no attested source is recorded at the least trusted kind. */
  unattested_floor: TrustSwitch.optional(),
  /** A less trusted source never rewrites, retires or evicts a more trusted active item. */
  protect_trusted: TrustSwitch.optional(),
});

/** Typed policy objects evaluated by one pure function (ADR 0006). */
export const Policy = z.strictObject({
  id: z.string().min(1),
  version: z.int().positive(),
  write: z.array(WriteRule),
  read: z.strictObject({
    matrix: z.array(z.strictObject({ reader: ScopeLevel, may_read: z.array(ScopeLevel) })),
    honour_grants: z.boolean(),
  }),
  retention: z.array(RetentionRule),
  promotion: z.strictObject({
    episodic_to_semantic: z.strictObject({
      confirmations: z.int().positive(),
      or_review: z.boolean(),
    }),
    procedural: z.strictObject({ replay_k: z.int().positive(), replay_n: z.int().positive() }),
  }),
  lints: z.strictObject({
    enabled: z.array(z.string().min(1)),
    thresholds: z.record(z.string(), z.number()),
  }),
  content_guards: ContentGuards.optional(),
  trust: Trust.optional(),
  schema_version: schemaVersion,
});

/** Why an item was returned (ADR 0009). */
export const Explanation = z.strictObject({
  item_id: Id,
  rank: z.int().positive(),
  score: z.strictObject({ total: z.number(), components: z.record(z.string(), z.number()) }),
  /** The rule that admitted the item. */
  policy_id: z.string().min(1),
  grants_used: z.array(z.string()),
  validity: z.strictObject({
    at: Timestamp,
    valid_from: Timestamp,
    valid_to: Timestamp.nullable(),
  }),
  schema_version: schemaVersion,
});

/** The contracts exported to sdk/schema/<name>.json, by name. */
export const CONTRACTS = {
  MemoryItem,
  MemoryEvent,
  Policy,
  Grant,
  Explanation,
  LintFinding,
} as const;

/** Definitions shared by several contracts, exported beside them. */
export const SHARED = { JsonValue } as const;

/** JSON Schema for each contract and shared definition, keyed by file name; nested ones are `$ref`s. */
export function contractJsonSchemas(): Record<string, unknown> {
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of Object.entries({ ...CONTRACTS, ...SHARED }))
    registry.add(schema, { id });
  const { schemas } = z.toJSONSchema(registry, { uri: (id) => `${id}.json` });
  // The title names the generated Python type after its contract.
  return Object.fromEntries(
    Object.entries(schemas).map(([id, s]) => [`${id}.json`, { title: id, ...s }]),
  );
}

export type MemoryItem = z.infer<typeof MemoryItem>;
export type MemoryEvent = z.infer<typeof MemoryEvent>;
export type Policy = z.infer<typeof Policy>;
export type ContentGuards = z.infer<typeof ContentGuards>;
export type Trust = z.infer<typeof Trust>;
export type Grant = z.infer<typeof Grant>;
export type Explanation = z.infer<typeof Explanation>;
export type LintFinding = z.infer<typeof LintFinding>;
export type Provenance = z.infer<typeof Provenance>;
export type ScopeLevel = z.infer<typeof ScopeLevel>;
