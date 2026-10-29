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
  JsonValue,
  LintFinding,
  MemoryEvent,
  MemoryItem,
  Policy,
  SCHEMA_VERSION,
  Timestamp,
} from "@engram/core";
import { z } from "zod";

/** Who calls: self-asserted in v0 (ADR 0027 decision 5); the plane refuses a malformed one. */
export const Actor = ActorShape.meta({
  description:
    "Who acts, as the caller asserts it (no authentication in v0, ADR 0027): id, the level it reads as, its member scopes, and the provenance kind of what it writes.",
});

const at = Timestamp.optional().meta({
  description: "The time of the call, UTC ISO 8601; the server's clock when absent.",
});

export const WriteRequest = z.strictObject({
  actor: Actor,
  item: z.record(z.string(), JsonValue).meta({
    description:
      "A MemoryItem (#/components/schemas/MemoryItem) as the caller assembles it; the plane validates it and denies an invalid one with the event engram/write/schema.",
  }),
  at,
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
  at,
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
});

export const PromoteRequest = z.strictObject({
  actor: Actor,
  item_id: z.string(),
  to: z.string(),
  review: z.boolean().optional(),
  at,
});

export const GateResponse = z.strictObject({
  decision: z.enum(["allow", "deny", "ask"]),
  item: MemoryItem.nullable(),
  event: MemoryEvent,
  events: z.array(MemoryEvent),
});

export const RetainRequest = z.strictObject({ actor: Actor, scope: z.string(), at });

export const EventsRequest = z.strictObject({
  actor: Actor,
  after: z.int().nonnegative().optional().meta({
    description: "Only events with a seq above this one.",
  }),
});
export const EventsResponse = z.strictObject({ events: z.array(MemoryEvent) });

export const PolicyResponse = z.strictObject({ policy: Policy, label: z.string() });

export const LintRequest = z.strictObject({ scope: z.string() });
export const LintResponse = z.strictObject({ findings: z.array(LintFinding) });

export const SimulateRequest = z.strictObject({
  workload: z.strictObject({ id: z.string(), events: z.array(MemoryEvent) }),
  policy: Policy.optional(),
});
export const DistillRequest = z.strictObject({
  sessions: z.array(z.record(z.string(), JsonValue)),
  method: z.strictObject({ id: z.literal("awm"), model: z.string(), seed: z.int() }),
});
/** The simulator's and distiller's reports are typed by their cards (E8.9, D2). */
export const OpenReport = z.record(z.string(), JsonValue);

export const BypassRequest = z.strictObject({
  actor: Actor,
  bypass: z.strictObject({
    command: z.string(),
    store: z.string(),
    route: z.enum(["command", "path", "result"]).optional(),
  }),
  at,
});
export const EventResponse = z.strictObject({ event: MemoryEvent });

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
  PromoteRequest,
  GateResponse,
  RetainRequest,
  EventsRequest,
  EventsResponse,
  PolicyResponse,
  LintRequest,
  LintResponse,
  SimulateRequest,
  DistillRequest,
  OpenReport,
  BypassRequest,
  EventResponse,
  ViewerResponse,
  HealthResponse,
  ErrorResponse,
} as const;
