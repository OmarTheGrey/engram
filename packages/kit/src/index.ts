// The framework kit (card E8.14): what every adapter for an agent framework
// repeats, so each adapter stays about a page. It holds no policy logic
// (AGENTS.md rule 1) and reaches no store (rule 2): every call is one request
// of the generated client (@engram/sdk), in process over a workspace's app or
// to `engram serve`, and the plane decides.
//
// What it gives an adapter:
//   - an actor fixed at construction, copied and frozen, its source set to
//     `model` whatever it says (ADR 0004, decision D4), as the MCP server
//     fixes its launch actor (packages/mcp/src/server.ts). No method takes an
//     actor, a source, an owner or a provenance kind, so nothing a model
//     writes into a tool call can change who acts;
//   - a mapper from a framework's namespace (`["person", "omar"]`, `["org"]`)
//     to a scope (`person:omar`, `org`) and back: syntax only, whether the
//     actor may use the scope is the plane's decision;
//   - a typed rejection, EngramRejected, carrying the decision's deny event
//     (its reason and policy id), and EngramCallError for a call the plane
//     refused to decide (a malformed actor, time or id: 400) or could not
//     reach;
//   - governed recall rendered in the shared memory tag
//     (packages/pi-extension/src/tag.ts: read id, admitting rules, content
//     escaped), the shape the pi extension and the MCP server show a model.
//
// Like ADR 0022 says of MCP, an adapter governs what passes through its seam,
// not state the framework keeps elsewhere (graph state, checkpointers, chat
// history), and not other tools that write elsewhere.
import { type RecallDetails, recallDetails, tagRecall } from "@engram/pi-extension/tag";
import type { Actor, EngramClient, MemoryEvent, MemoryItem } from "@engram/sdk";

/** The scope levels a namespace may name (packages/core's ScopeLevel). */
export const SCOPE_LEVELS = ["person", "role", "team", "org"] as const;
export type ScopeLevelName = (typeof SCOPE_LEVELS)[number];

/** A namespace that names no scope. */
export class InvalidNamespaceError extends Error {
  readonly namespace: unknown;
  constructor(namespace: unknown) {
    super(
      `engram: namespace ${JSON.stringify(namespace)} names no scope; expected [person|role|team, <id>], ["org"], or a scope such as person:<id> or org`,
    );
    this.name = "InvalidNamespaceError";
    this.namespace = namespace;
  }
}

const SCOPED = new Set<string>(["person", "role", "team"]);
/** An id part: non-empty, no whitespace, no colon (it would read as another scope). */
const PART = /^[^\s:]+$/;

/**
 * The scope a framework's namespace names: `[level, id]` for person, role and
 * team, `["org"]` for org, or a scope string as the plane writes it
 * (`team:platform`, `org`). Anything else is an InvalidNamespaceError, never
 * a guess. Deeper namespaces are refused rather than folded into a scope,
 * since folding would merge what the framework keeps apart.
 */
export function scopeOf(namespace: string | readonly string[]): string {
  if (typeof namespace === "string") {
    if (namespace === "org") return namespace;
    const [level, id, ...rest] = namespace.split(":");
    if (rest.length === 0 && level !== undefined && SCOPED.has(level) && PART.test(id ?? ""))
      return namespace;
    throw new InvalidNamespaceError(namespace);
  }
  if (!Array.isArray(namespace)) throw new InvalidNamespaceError(namespace);
  const [level, id, ...rest] = namespace;
  if (level === "org" && id === undefined) return "org";
  if (rest.length === 0 && level !== undefined && SCOPED.has(level) && PART.test(id ?? ""))
    return `${level}:${id}`;
  throw new InvalidNamespaceError(namespace);
}

/** The namespace of a scope, scopeOf's inverse: `person:omar` is `["person", "omar"]`. */
export function namespaceOf(scope: string): string[] {
  const checked = scopeOf(scope);
  return checked === "org" ? ["org"] : checked.split(":");
}

/** A decision the plane made against the call: a denied write, with its event. */
export class EngramRejected extends Error {
  readonly event: MemoryEvent;
  constructor(event: MemoryEvent) {
    super(`engram: ${event.reason} (${event.policy_id})`);
    this.name = "EngramRejected";
    this.event = event;
  }
  get decision(): MemoryEvent["decision"] {
    return this.event.decision;
  }
  get reason(): string {
    return this.event.reason;
  }
  get policyId(): string {
    return this.event.policy_id;
  }
}

/** A call the plane did not decide: refused before deciding (400), unknown, or failed. */
export class EngramCallError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly card: string | undefined;
  constructor(status: number, message: string, code?: string, card?: string) {
    super(`engram: ${message}`);
    this.name = "EngramCallError";
    this.status = status;
    this.code = code;
    this.card = card;
  }
}

export interface KitOptions {
  /** The client every call goes through (createEngramClient). */
  client: EngramClient;
  /** Who every call is made as. Copied and frozen here; its source becomes `model`. */
  actor: Actor;
  /** The valid_from of each item written, ISO 8601 UTC; events are stamped by the server. */
  now: () => string;
  /** A fresh UUIDv7 for each item written. */
  newId: () => string;
}

/** What an adapter asks the kit to remember; only these fields reach the item. */
export interface RememberInput {
  scope: string;
  content: string;
  class?: "semantic" | "episodic";
  confidence?: number;
  /** Where the write came from in the framework, such as `ai-sdk:tool_call/<id>`. */
  ref: string;
}

/** A governed recall: the read's details, its tagged text for the model, and its event. */
export interface Recall {
  details: RecallDetails;
  /** The memory tag (tagRecall): what a model may be shown. */
  text: string;
  /** The audit record; its reason counts items out of reach, so it is kept from the model. */
  event: MemoryEvent;
}

export interface VisibleScope {
  scope: string;
  via: "membership" | "grant";
}

export interface EngramKit {
  /** The actor every call is made as: fixed at construction, frozen, source `model`. */
  readonly actor: Readonly<Actor>;
  /** Writes one item through the write gate; EngramRejected when the plane does not store it. */
  remember(input: RememberInput): Promise<MemoryItem>;
  /** Reads through the plane's read filter (POST /read). */
  recall(text: string): Promise<Recall>;
  /** Reads one item by its id (POST /read/{itemId}): null when the actor may not read it. */
  get(itemId: string): Promise<{ item: MemoryItem | null; event: MemoryEvent }>;
  /** The scopes the actor can see (POST /scopes). */
  scopes(): Promise<{ scopes: VisibleScope[]; event: MemoryEvent }>;
}

/** The failure of a client call, as EngramCallError. */
function callError(answer: { error?: unknown; response: Response }): EngramCallError {
  const body = (answer.error as { error?: { message?: string; code?: string; card?: string } })
    ?.error;
  return new EngramCallError(
    answer.response.status,
    body?.message ?? `the plane answered ${answer.response.status}`,
    body?.code,
    body?.card,
  );
}

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return `sha256:${hex(digest)}`;
}

/** The actor as the kit holds it: a deep copy, frozen, source `model`. */
function fixActor(actor: Actor): Readonly<Actor> {
  const copy = structuredClone(actor) as Actor;
  return Object.freeze({
    ...copy,
    memberships: Object.freeze([...copy.memberships]) as string[],
    source: "model" as const,
  });
}

export function createKit(options: KitOptions): EngramKit {
  const { client, now, newId } = options;
  const actor = fixActor(options.actor);
  /** A fresh, mutable copy per request, so nothing downstream can reach the frozen one. */
  const caller = (): Actor => structuredClone(actor) as Actor;

  return {
    actor,
    async remember(input) {
      const at = now();
      // Built from the named fields only; the plane sets provenance from the actor's source.
      const item: Record<string, unknown> = {
        id: newId(),
        class: input.class ?? "semantic",
        scope: input.scope,
        owner: actor.id,
        content: input.content,
        provenance: {
          kind: "model",
          ref: input.ref,
          hash: await sha256(JSON.stringify({ scope: input.scope, content: input.content })),
          actor: actor.id,
        },
        confidence: input.confidence ?? 0.5,
        valid_from: at,
        valid_to: null,
        ttl: null,
        grants: [],
        version: 1,
        lineage: [],
        status: "active",
        store_ref: null,
        schema_version: 1,
      };
      const answer = await client.POST("/api/v1/items", {
        body: { actor: caller(), item: item as never },
      });
      if (answer.data === undefined) throw callError(answer);
      const { item: stored, event } = answer.data;
      if (stored === null) throw new EngramRejected(event);
      return stored;
    },
    async recall(text) {
      const answer = await client.POST("/api/v1/read", { body: { actor: caller(), text } });
      if (answer.data === undefined) throw callError(answer);
      const r = answer.data;
      const details = recallDetails(
        r.event.id,
        r.event.policy_id,
        r.filtered,
        r.items as never,
        r.explanations as never,
      );
      return { details, text: tagRecall(details), event: r.event };
    },
    async get(itemId) {
      const answer = await client.POST("/api/v1/read/{itemId}", {
        params: { path: { itemId } },
        body: { actor: caller() },
      });
      if (answer.data === undefined) throw callError(answer);
      return { item: answer.data.items[0] ?? null, event: answer.data.event };
    },
    async scopes() {
      const answer = await client.POST("/api/v1/scopes", { body: { actor: caller() } });
      if (answer.data === undefined) throw callError(answer);
      return { scopes: answer.data.scopes, event: answer.data.event };
    },
  };
}
