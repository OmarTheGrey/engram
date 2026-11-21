// Decisions as OpenTelemetry spans (card E8.13, ADR 0043, proposed): a pure
// mapping from a MemoryEvent to a span's name, ids, times, status and
// attributes, as plain data. Core gains no dependency: the sinks that send
// the spans (a JSONL file, OTLP over HTTP) live in packages/server and are
// off unless configured.
//
// Attribute names follow the OpenTelemetry GenAI semantic conventions,
// open-telemetry/semantic-conventions-genai at tag v0.1.0 (commit
// d0e74ba6c48bcc4ded473b1828a8212f06b23753, Apache-2.0, built on
// semantic-conventions v1.45.0), read for its names only (mode idea, ADR
// 0037): the memory span `gen_ai.memory.client` of docs/gen-ai/gen-ai-spans.md,
// named `{gen_ai.operation.name}`, kind INTERNAL for a memory system in the
// caller's process. Every name is Development status upstream, so the pin
// and this one file are where a rename lands.
//
// What a span never carries (rule 12; the acceptance test plants a secret and
// checks): the item's content, its provenance ref and hash (a sha256 of
// guessable content is reversed by a lookup), its store key (a path inside a
// store), its grants' principals, lineage and validity, and the opt-in
// content attributes of the conventions (`gen_ai.memory.records`,
// `gen_ai.memory.query.text`). The reason is free text that some producers
// fill with what they were given (a bypass's command, a lint's evidence, a
// store's error message), so it is exported clause by clause: a clause whose
// whole text matches one of the templates below, every slot of which admits
// only an enum value, a number, an id, a scope, a time or a rule name, is
// kept; any other clause becomes `[withheld]` and is counted.
import { z } from "zod";
import {
  type EventOp,
  MemoryClass,
  type MemoryEvent,
  ProvenanceKind,
  ScopeLevel,
} from "../schema.ts";

/** The conventions the attribute names follow, pinned. */
export const GENAI_SEMCONV = {
  repository: "https://github.com/open-telemetry/semantic-conventions-genai",
  version: "v0.1.0",
  commit: "d0e74ba6c48bcc4ded473b1828a8212f06b23753",
  semconv: "v1.45.0",
} as const;

/**
 * `gen_ai.operation.name` per op: the conventions' well-known memory
 * operations where one applies (Plane.write may create or rewrite, so it is
 * `upsert_memory`; a retire or eviction retires, the plane's delete), and an
 * `engram.` name where none does, as the conventions allow.
 */
export const OPERATION_NAMES = {
  write: "upsert_memory",
  read: "search_memory",
  update: "update_memory",
  promote: "update_memory",
  gate: "update_memory",
  retire: "delete_memory",
  evict: "delete_memory",
  lint: "engram.lint",
  bypass_blocked: "engram.bypass_blocked",
} as const satisfies Record<z.infer<typeof EventOp>, string>;

/** What replaces a reason clause that matches no template. */
export const WITHHELD = "[withheld]";
/** `error.type` on a denied decision. */
export const DENIED_ERROR_TYPE = "engram.denied";

const Attribute = z.union([z.string(), z.number(), z.boolean()]);

/** A decision span as plain data: what the JSONL sink writes, one per line, and the OTLP sink sends. */
export const DecisionSpanShape = z.strictObject({
  name: z.string().min(1),
  kind: z.literal("internal"),
  /** 32 lowercase hex digits: the event id without its dashes. */
  trace_id: z.string().regex(/^[0-9a-f]{32}$/),
  /** 16 lowercase hex digits: the last 16 of the event id. */
  span_id: z.string().regex(/^[0-9a-f]{16}$/),
  /** The event's time; a decision is instantaneous, so start and end are equal. */
  start_time: z.iso.datetime(),
  end_time: z.iso.datetime(),
  /** `error` on a deny, else `unset`; never a description, which could quote the reason. */
  status: z.enum(["unset", "error"]),
  attributes: z.record(z.string(), Attribute),
});
export type DecisionSpan = z.infer<typeof DecisionSpanShape>;

// The slots a template's place may hold: never free text.
const N = String.raw`\d+(?:\.\d+)?`;
const UUID = String.raw`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`;
const alt = (values: readonly string[]) => `(?:${values.join("|")})`;
const KIND = alt(ProvenanceKind.options);
const CLASS = alt(MemoryClass.options);
const LEVEL = alt(ScopeLevel.options);
const SCOPE = String.raw`(?:(?:person|role|team):[A-Za-z0-9._\-/]+|org)`;
const PRINCIPAL = String.raw`[a-z][a-z0-9-]*:[A-Za-z0-9._\-/*@]+`;
const POLICY = String.raw`[A-Za-z0-9][A-Za-z0-9._\-/+]*`;
const TIME = String.raw`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z`;
/** A store, rule or signal name. */
const NAME = "[a-z0-9][a-z0-9-]*";
/** A content guard's kind (card E2.9): `secret/<name>`, `pii/<name>` or `secret/gitleaks/<id>`. */
const GUARD_KIND = String.raw`(?:secret|pii)(?:/[a-z0-9][a-z0-9-]*){1,2}`;
const ERROR_NAME = "[A-Z][A-Za-z]*";
const TTL_SOURCE = "(?:the item's own ttl|the retention rule)";
const HIT = String.raw`${NAME}/${NAME} \(weight ${N}, ${N} characters\)`;
const HITS = `${HIT}(?:, ${HIT})*`;
const GUARD_FINDING = String.raw`${GUARD_KIND} \(${N} characters\)`;
const SCREEN = String.raw`the injection screen \((?:default|hardened) profile, a deterministic floor\)`;

/**
 * One clause each, its whole text, from the producers in core that name
 * only enums, numbers, ids, scopes, times and rule names: the write gate
 * (policy/evaluate.ts), the provenance note (plane/write.ts), the read's
 * counts (plane/read-reason.ts), the injection screen (card E2.10), the
 * content guards (card E2.9), the bypass record (plane/bypass.ts) and
 * retention (policy/retention.ts). A producer not listed, or one whose
 * wording changes, is withheld: the failure is closed.
 */
const TEMPLATES: readonly RegExp[] = [
  // The write gate.
  `${CLASS} item from source ${KIND} passes the ${LEVEL} write rule`,
  `${CLASS} items are forbidden in ${LEVEL} scope`,
  `source ${KIND} is not allowed in ${LEVEL} scope`,
  `${KIND} content cannot leave person scope without a gate pass`,
  `it targets ${SCOPE}`,
  `confidence ${N} is below the ${LEVEL} floor ${N}`,
  `policy ${POLICY} has no write rule for ${LEVEL}`,
  "denied by default",
  `${LEVEL} scope requires review`,
  "stored as a candidate until promoted",
  `${PRINCIPAL} is not a member of ${SCOPE}`,
  "grants let others read, never write",
  `provenance set by the plane: source ${KIND}, actor ${PRINCIPAL}`,
  "provenance as claimed by the caller",
  // The read's counts.
  `returned ${N} of ${N} candidates`,
  String.raw`${N} filtered \(${N} outside the validity window, ${N} not active, ${N} past their ttl, ${N} by a grant's class or expiry\)`,
  `${N} cut by the read limit`,
  `${N} projected (?:item|items) outside the reader's reach were not candidates`,
  `validity windows judged at ${TIME}`,
  // The injection screen.
  `${SCREEN} scores ${N} at threshold ${N}: ${HITS}`,
  `${SCREEN} fails closed: rule ${NAME} (?:threw ${ERROR_NAME}|${N} characters exceed its bound of ${N})`,
  `before it, ${HITS}`,
  "held as a candidate until a reviewer promotes it",
  // The content guards.
  `the content holds ${GUARD_FINDING}`,
  `the content holds ${N} matches: ${GUARD_FINDING}(?:, ${GUARD_FINDING})*(?: and ${N} more)?`,
  "the policy's (?:secrets|pii) guard blocks it",
  "the policy's (?:secrets|pii) guard is (?:review|block)(?:, and a (?:block|review)-tier match is held)?",
  "stored as a candidate until a reviewer promotes it",
  "stored retired, as written, which no read or promotion returns",
  `the content is ${N} bytes, above the policy's max_content_bytes of ${N}`,
  `the content is ${N} characters, beyond the ${N} a content guard scans(?:, so it fails closed)?`,
  "a guard in block denies what it cannot scan",
  `the content guard rule ${GUARD_KIND} failed, so it fails closed`,
  // The bypass record; its `attempted:` clause is never a template.
  `${NAME} is a memory store command`,
  "use the Engram memory tools",
  `the path is inside the root of store ${NAME}`,
  "a memory tool result the Engram extension did not produce was withheld from the model",
  // Retention.
  String.raw`item ${UUID} expired at ${TIME} \(valid_from ${TIME} plus ttl ${N}s, from ${TTL_SOURCE}\)`,
  String.raw`an item in ${SCOPE} passed its ttl \(from ${TTL_SOURCE}\)`,
  "retired, kept in the log and the store",
  `scope ${SCOPE} holds ${N} active ${CLASS} items, budget ${N}(?:: ${N} over)?`,
  `scope ${SCOPE} is over its ${CLASS} budget`,
  String.raw`evicted the oldest by last change \(seq ${N}\): item ${UUID}`,
  String.raw`evicted the least read \(${N} reads returned it; last change seq ${N}\): item ${UUID}`,
  "an item was evicted by (?:recency|utility)",
  "eviction is manual, so nothing is evicted and a person decides",
].map((source) => new RegExp(`^${source}$`));

/** What adoption puts before every reason (plane/commit.ts ADOPTION_PREFIX and the store's name). */
const ADOPTED = new RegExp(`^(adopted from store ${NAME}: )(.*)$`, "s");

/** `reason`'s clauses: split at `; ` outside parentheses, so a template's own `; ` stays whole. */
function clauses(reason: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < reason.length; i++) {
    const c = reason[i];
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === ";" && depth === 0 && reason[i + 1] === " ") {
      out.push(reason.slice(start, i));
      start = i + 2;
      i++;
    }
  }
  out.push(reason.slice(start));
  return out;
}

const known = (clause: string) => TEMPLATES.some((t) => t.test(clause));

/**
 * The reason as a span carries it: each clause kept when its whole text is a
 * template's, else replaced by `[withheld]` (adjacent ones merged into one
 * marker); `withheld` counts the clauses replaced.
 */
export function exportedReason(reason: string): { text: string; withheld: number } {
  const parts: string[] = [];
  let withheld = 0;
  for (const [i, raw] of clauses(reason).entries()) {
    let clause = raw;
    let prefix = "";
    const adopted = i === 0 ? ADOPTED.exec(raw) : null;
    if (adopted) {
      prefix = adopted[1] as string;
      clause = adopted[2] as string;
    }
    if (known(clause)) parts.push(`${prefix}${clause}`);
    else {
      withheld++;
      if (parts.at(-1) !== WITHHELD) parts.push(WITHHELD);
    }
  }
  return { text: parts.join("; "), withheld };
}

/** A lint event's lint id and severity, from its reason's head `<lint id> (<severity>): `. */
const LINT_HEAD = new RegExp(`^(${NAME}) \\((info|warn|error)\\): `);

/** The span of one decision. Pure: the same event always maps to the same span. */
export function decisionSpan(event: MemoryEvent): DecisionSpan {
  const name = OPERATION_NAMES[event.op];
  const hex = event.id.replaceAll("-", "").toLowerCase();
  const reason = exportedReason(event.reason);
  const a: Record<string, string | number | boolean> = {
    "gen_ai.operation.name": name,
    "engram.event.id": event.id,
    "engram.event.seq": event.seq,
    "engram.op": event.op,
    "engram.decision": event.decision,
    "engram.policy_id": event.policy_id,
    "engram.actor": event.actor,
    "engram.reason": reason.text,
    "engram.reason.withheld": reason.withheld,
    "engram.schema_version": event.schema_version,
  };
  if (event.scope_from !== null) a["engram.scope.from"] = event.scope_from;
  if (event.scope_to !== null) a["engram.scope.to"] = event.scope_to;
  if (event.item_id !== null) a["gen_ai.memory.record.id"] = event.item_id;
  const count =
    event.op === "read" ? event.item_ids?.length : event.item_id === null ? undefined : 1;
  if (count !== undefined) a["gen_ai.memory.record.count"] = count;
  const item = event.item ?? null;
  if (item !== null) {
    // The adapter's name (files, letta, mem0), never its key.
    if (item.store_ref !== null) a["gen_ai.memory.store.id"] = item.store_ref.adapter;
    a["engram.item.class"] = item.class;
    a["engram.item.status"] = item.status;
    a["engram.item.version"] = item.version;
    a["engram.item.provenance_kind"] = item.provenance.kind;
    a["engram.item.grant_count"] = item.grants.length;
  }
  if (event.usage !== undefined) {
    a["gen_ai.usage.input_tokens"] = event.usage.input_tokens;
    a["gen_ai.usage.output_tokens"] = event.usage.output_tokens;
    a["engram.usage.cost_usd"] = event.usage.cost_usd;
  }
  if (event.op === "lint") {
    const head = LINT_HEAD.exec(event.reason);
    if (head) {
      a["engram.lint.id"] = head[1] as string;
      a["engram.lint.severity"] = head[2] as string;
    }
  }
  if (event.decision === "deny") a["error.type"] = DENIED_ERROR_TYPE;
  const attributes = Object.fromEntries(
    Object.entries(a).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)),
  );
  return {
    name,
    kind: "internal",
    trace_id: hex,
    span_id: hex.slice(16),
    start_time: event.ts,
    end_time: event.ts,
    status: event.decision === "deny" ? "error" : "unset",
    attributes,
  };
}
