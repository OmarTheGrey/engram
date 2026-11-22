// The request and response shapes of the HTTP contract (card E8.1, ADR 0027
// decision 1). Each reuses core's contracts (MemoryItem, MemoryEvent, Policy,
// Explanation, LintFinding and the actor's shape), so the OpenAPI document
// and the generated client say exactly what core says. Every name registered
// in COMPONENTS becomes `#/components/schemas/<name>` in sdk/openapi.json; the
// core contracts keep the names of sdk/schema/*.json.
import {
  ActorShape,
  CONTRACTS,
  Explanation,
  Grant,
  JsonValue,
  LintFinding,
  MemoryEvent,
  MemoryItem,
  Policy,
  ReadCounts,
  ReaderEntry,
  SCHEMA_VERSION,
  SimReport,
  SupersessionChain,
  SupersessionProposal,
  Timestamp,
  WhoCanReadAnswer,
  Workload,
} from "@engram/core";
import { z } from "zod";

/**
 * Who calls (ADR 0027 decision 5, ADR 0042): bound to the credential on a
 * server with credentials, as asserted in process and under the waiver; the
 * plane refuses a malformed one.
 */
export const Actor = ActorShape.meta({
  description:
    "Who acts: id, the level it reads as, its member scopes, and the provenance kind of what it writes. On a server with credentials (ADR 0042) the id and level must be the credential's and the memberships a subset of its own, and the source sent is ignored for the credential's; in process and under --insecure-loopback it is taken as the caller asserts it.",
});

// Every event's ts is the server's own clock (card RV5, finding RV-SRF-2;
// ADR 0027, amendment proposed by RV5): a request names no time of its own,
// and a request that tries is refused by its strict schema (400). A read
// alone takes `at`, as the time validity windows are judged at.
const validAt = Timestamp.optional().meta({
  description:
    "The time validity windows are judged at, UTC ISO 8601, when the reader asks what was true at another time. The read itself happens at the server's clock: its event's ts, and the time status, ttl and grant expiry are judged at. It sweeps nothing, and the read event's reason records it.",
});

export const WriteRequest = z.strictObject({
  actor: Actor,
  item: z.record(z.string(), JsonValue).meta({
    description:
      "A MemoryItem (#/components/schemas/MemoryItem) as the caller assembles it; the plane validates it and denies an invalid one with the event engram/write/schema.",
  }),
});

export const WriteResponse = z.strictObject({
  item: MemoryItem.nullable(),
  event: MemoryEvent,
  retention: z.array(MemoryEvent),
});

export const CheckResponse = z.strictObject({
  decision: z.enum(["allow", "deny", "ask"]),
  reason: z.string(),
  policy_id: z.string(),
});

export const ReadRequest = z.strictObject({
  actor: Actor,
  text: z.string().optional(),
  at: validAt,
});

export const RetentionReport = z.strictObject({
  decision: z.enum(["allow", "deny"]),
  events: z.array(MemoryEvent),
  expired: z.array(z.string()),
  evicted: z.array(z.string()),
});

export const AdoptReport = z.strictObject({
  listed: z.int().nonnegative(),
  allowed: z.int().nonnegative(),
  denied: z.int().nonnegative(),
  unchanged: z.int().nonnegative(),
  deferred: z.int().nonnegative(),
  retired: z.int().nonnegative(),
  denials: z.array(
    z.strictObject({ item_id: z.string(), reason: z.string(), policy_id: z.string() }),
  ),
  retirements: z.array(z.strictObject({ item_id: z.string(), reason: z.string() })),
  evictions: z.array(MemoryEvent),
});

export const StoreSync = z
  .strictObject({
    store: z.strictObject({ name: z.string(), root: z.string(), scope: z.string() }),
    retention: RetentionReport,
    adoption: AdoptReport,
  })
  .meta({
    description:
      "What the workspace did before the read, as the store's owner: its retention sweep, then the adoption of the store's own memories (ADR 0025, decision D8).",
  });

export const ReadResponse = z.strictObject({
  items: z.array(MemoryItem),
  explanations: z.array(Explanation),
  filtered: z.int().nonnegative(),
  event: MemoryEvent,
  sync: StoreSync.nullable(),
  policy: z
    .string()
    .meta({ description: "The policy the read was decided under: <id> v<version>." }),
});

export const ExplainRequest = z.strictObject({ actor: Actor });
export const ExplainResponse = z.strictObject({
  read_id: z.string(),
  explanations: z.array(Explanation),
  counts: ReadCounts.nullable().meta({
    description:
      "The counts the read event's reason records (core's readCounts, decision 5 of the Gate B plan); null for a read event written before that format. Audit data for the human inspector: out_of_reach counts items outside the reader's reach, which decision D5 keeps from the reader, so a surface that answers a model (the MCP tools, the pi extension) must not pass the counts on.",
  }),
});

export const PromoteRequest = z.strictObject({
  actor: Actor,
  item_id: z.string(),
  to: z.string(),
  review: z.boolean().optional(),
});

export const GateResponse = z.strictObject({
  decision: z.enum(["allow", "deny", "ask"]),
  item: MemoryItem.nullable(),
  event: MemoryEvent,
  events: z.array(MemoryEvent),
});

export const GrantRequest = z.strictObject({
  actor: Actor,
  item_id: z.string(),
  add: z.array(Grant).optional().meta({
    description:
      "Grants to add. Each must name a principal or a prefixed pattern, a class and an expiry after the call's time (ADR 0021, decision D4); the plane decides, and refuses one with a deny event.",
  }),
  remove: z.array(Grant).optional().meta({
    description: "Grants to remove, each exactly as the item carries it.",
  }),
});

export const GrantResponse = z.strictObject({
  decision: z.enum(["allow", "deny"]),
  item: MemoryItem.nullable(),
  event: MemoryEvent,
});

export const RetainRequest = z.strictObject({ actor: Actor, scope: z.string() });

// Who can read this memory (card E2.13): core's answer, under its own name.
export { ReaderEntry, WhoCanReadAnswer };
export const WhoCanReadItemRequest = z.strictObject({ actor: Actor, item_id: z.string() });
export const WhoCanReadScopeRequest = z.strictObject({ actor: Actor, scope: z.string() });

export const EventsRequest = z.strictObject({
  actor: Actor,
  after: z.int().nonnegative().optional().meta({
    description: "Only events with a seq above this one.",
  }),
});
export const EventsResponse = z.strictObject({ events: z.array(MemoryEvent) });

export const PolicyResponse = z.strictObject({ policy: Policy, label: z.string() });

export const LintRequest = z.strictObject({ actor: Actor, scope: z.string() });
/** Plane.lint's LintReport (card L1): deny when the actor is not a member of the scope. */
export const LintResponse = z.strictObject({
  decision: z.enum(["allow", "deny"]),
  findings: z.array(LintFinding),
  events: z.array(MemoryEvent),
});

/** Core's simulator shapes (card E8.9), under their own component names. */
export { SimReport, Workload };

export const SimulateRequest = z.strictObject({
  workload: Workload,
  policy: Policy.optional().meta({
    description:
      "The candidate policy; the workspace's own policy when absent. The baseline is always the workspace's.",
  }),
});
export const DistillRequest = z.strictObject({
  sessions: z.array(z.record(z.string(), JsonValue)),
  method: z.strictObject({ id: z.literal("awm"), model: z.string(), seed: z.int() }),
});
/** The distiller's report is typed by its card (D2). */
export const OpenReport = z.record(z.string(), JsonValue);

export const BypassRequest = z.strictObject({
  actor: Actor,
  bypass: z.strictObject({
    command: z.string(),
    store: z.string(),
    route: z.enum(["command", "path", "result"]).optional(),
  }),
});
export const EventResponse = z.strictObject({ event: MemoryEvent });

export const SupersedeRequest = z.strictObject({
  actor: Actor,
  item_id: z.string().meta({
    description:
      "The new version, whose lineage names the items it supersedes; only items the actor may read take part.",
  }),
  accept: z.array(z.string()).optional().meta({
    description:
      "Ids of candidates whose proposed close the caller accepts. Each is written as a new version in place through the write gate, which decides it; an id with no proposed close refuses the whole call (400) before anything is written. Absent or empty: the plan only.",
  }),
});

/** Card L6: the supersession plan, and the governed write of each accepted close. */
export const SupersedeResponse = z.strictObject({
  item_id: z.string(),
  head: SupersessionChain,
  proposals: z.array(SupersessionProposal),
  /**
   * The new version each accepted close sent to the write gate, in order:
   * those of `applied`, then the one `stopped` names. Each is a version of
   * an item the read filter admitted for the actor (L6-1).
   */
  submitted: z.array(MemoryItem),
  applied: z.array(WriteResponse),
  /**
   * The close whose write the store refused after the gate allowed it
   * (review fix L6-3): its deny event (engram/write/store-failure), with the
   * writes before it in `applied` and none after it sent. Null when every
   * accepted close was written or decided.
   */
  stopped: z.strictObject({ item_id: z.string(), event: MemoryEvent }).nullable(),
});

export const ViewerResponse = z.strictObject({ viewer: Actor.nullable() });

export const HealthResponse = z.strictObject({
  status: z.literal("ok"),
  schema_version: z.literal(SCHEMA_VERSION),
});

export const ErrorResponse = z.strictObject({
  error: z.strictObject({
    code: z.enum([
      "bad_request",
      "invalid_call",
      "explain_denied",
      "not_found",
      "unsupported_media_type",
      "payload_too_large",
      "forbidden_host",
      "forbidden_origin",
      "unauthorized",
      "forbidden_actor",
      "not_implemented",
      "no_store",
      "internal",
    ]),
    message: z.string(),
    card: z.string().optional(),
  }),
});

/** Every schema with a component name: core's contracts first, then the server's own. */
export const COMPONENTS = {
  ...CONTRACTS,
  JsonValue,
  Actor,
  WriteRequest,
  WriteResponse,
  CheckResponse,
  ReadRequest,
  ReadResponse,
  StoreSync,
  RetentionReport,
  AdoptReport,
  ExplainRequest,
  ExplainResponse,
  ReadCounts,
  PromoteRequest,
  GateResponse,
  GrantRequest,
  GrantResponse,
  RetainRequest,
  ReaderEntry,
  WhoCanReadAnswer,
  WhoCanReadItemRequest,
  WhoCanReadScopeRequest,
  EventsRequest,
  EventsResponse,
  PolicyResponse,
  LintRequest,
  LintResponse,
  Workload,
  SimulateRequest,
  SimReport,
  DistillRequest,
  OpenReport,
  BypassRequest,
  EventResponse,
  SupersessionChain,
  SupersessionProposal,
  SupersedeRequest,
  SupersedeResponse,
  ViewerResponse,
  HealthResponse,
  ErrorResponse,
} as const;
