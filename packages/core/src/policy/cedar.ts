// The policy exported to Cedar (card E2.12, ADR 0041): a pure translation of
// a typed Policy into a Cedar schema and policy set, as text, and of an
// actor, an item and a time into the Cedar request a Cedar engine decides.
// Core gains no dependency: this file only writes strings and plain JSON.
// The typed evaluator (evaluate.ts) stays the authority; a Cedar policy is
// never read back as input. The differential test
// (test/property/cedar.test.ts) decides each generated request both ways and
// requires agreement, so this file is a second statement of the gate, written
// apart from the evaluator: its constants are restated here on purpose, and
// a drift between the two is a disagreement the test reports.
//
// What is exported, as Cedar policies over the entity types of the schema:
//   read    the status rule, the ttl rules (the item's own and the policy's
//           retention ttls), one permit per read matrix row, the grant permit
//           when the policy honours grants, and the validity window
//   write   membership of the item's scope and of the projected item's, the
//           owner and version rules of a rewrite, the move rule, the grant
//           rules a whole item decides (only its owner, user- or
//           import-sourced, changes its grants; only its owner rewrites an
//           item carrying grants, the promotion gate's in-place transition
//           apart; an untrusted source carries no grants), a default deny per
//           level without a write rule, each write rule's forbidden classes,
//           allowed sources and confidence floor, source isolation and the
//           retired-content rule; `write_without_review` is the same gate
//           where the rule does not require review
// What is not (ADR 0041, decision 5; the test names each class it excludes):
//   - the grant rules judged grant by grant on the write path: a grant's
//     shape (a pattern with a kind and a prefix, a class, an expiry), a grant
//     repeated, a grant naming another class than the item's, a grant added
//     already expired. Each is a judgement over every element of a list, and
//     Cedar's language has no quantifier over a set; flattening one would
//     mean the encoder computing the verdict itself, which tests nothing;
//   - on the write path grants are flattened where a whole item decides: the
//     request says whether the projected item carries grants, whether the
//     rewrite changes them (a different multiset, or a class change while
//     either carries some: the evaluator's sameGrants), whether the item
//     carries any, and whether the write is the promotion gate's in-place
//     transition (only the status and the version differ); Cedar judges the
//     actor's source, its identity against the owner and the reach of the
//     opaque refusal;
//   - on the read path grants are flattened: the request carries, for the
//     reader alone, the latest expiry among the item's grants whose `to`
//     matches the reader and whose class is absent or the item's. Cedar then
//     judges `honour_grants`, the expiry against the read time and the
//     precedence of scope over grant; the pattern match and the class are the
//     encoder's, so agreement there holds modulo grants;
//   - content guards and trust options: exportCedar refuses a policy that
//     turns any on, rather than export a gate that disagrees with it;
//   - the lints (`lints`, `lints.model.evidence` of card L9 included): a
//     lint decides no read or write, so the export is the same with or
//     without them, and a policy turning quote grounding on is exported as
//     faithfully as one leaving it out;
//   - instants finer than a nanosecond: an instant is two Longs, epoch seconds
//     and nanoseconds, and the encoder refuses a finer one.
//
// Encodings, chosen to be exact (Cedar has no floats, and its datetime keeps
// milliseconds where Engram compares timestamps at full precision, time.ts):
//   instant      { s: epoch seconds, ns: nanoseconds }, compared
//                lexicographically; a ttl adds whole seconds to `s`, as
//                addSeconds does
//   confidence   the IEEE 754 bits of the double as { hi, lo }, two unsigned
//                32-bit halves: for non-negative doubles the order of the bits
//                is the order of the numbers, so a floor compares exactly
import type { Actor } from "../actor.ts";
import { contentHash } from "../content-hash.ts";
import { canonicalJson } from "../model.ts";
import { type MemoryItem, type Policy, type ScopeLevel, Timestamp } from "../schema.ts";
import {
  GRANT_OWNER_ID,
  GRANT_SOURCE_ID,
  grantMatches,
  READ_STATUS_ID,
  READ_TTL_ID,
  READ_VALIDITY_ID,
  RETIRED_CONTENT_ID,
  SOURCE_ISOLATION_ID,
  sameGrants,
  scopeLevel,
  WRITE_DEFAULT_DENY_ID,
  WRITE_GRANT_ID,
  WRITE_MEMBERSHIP_ID,
  WRITE_MOVE_ID,
  WRITE_VERSION_ID,
} from "./evaluate.ts";
import { notBuiltOptions } from "./options.ts";

/** The Cedar namespace every exported type and action lives in. */
export const CEDAR_NAMESPACE = "Engram";

/**
 * Sources that stay in person scope (evaluate.ts, UNTRUSTED_SOURCES; ADR
 * 0004, 0007), restated so the export is a second statement of the gate.
 */
const ISOLATED_SOURCES = ["model", "compaction", "external"] as const;
/** Sources that may not restate retired content (evaluate.ts, RELEARNING_SOURCES; ADR 0025). */
const RELEARNING_SOURCES = ["model", "compaction", "tool", "external"] as const;
const LEVELS: readonly ScopeLevel[] = ["person", "role", "team", "org"];

/** A policy the export refuses: one it could not translate faithfully. */
export class CedarExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CedarExportError";
  }
}

/** One Cedar policy: its unique id, the Engram rule id it stands for, and its text. */
export interface CedarRule {
  id: string;
  engram: string;
  text: string;
}

export interface CedarExport {
  /** The Cedar schema, in Cedar's human-readable schema format. */
  schema: string;
  /** The policy set as one text, each policy annotated with its `@id` and `@engram` rule id. */
  policies: string;
  /** The same policies one by one, in the order of `policies`. */
  rules: CedarRule[];
}

const SCHEMA = `// Engram's policy as Cedar (card E2.12, ADR 0041). Generated by exportCedar.
namespace ${CEDAR_NAMESPACE} {
  // An instant: whole seconds since the epoch and nanoseconds within the second.
  type Instant = { s: Long, ns: Long };
  // A confidence: the IEEE 754 bits of the double, high and low 32 bits.
  type Confidence = { hi: Long, lo: Long };
  // A scope such as person:omar or org; level is person, role, team or org.
  entity Scope = { level: String };
  // An actor is in the scopes it is a member of; level is the level it reads as.
  // source is the provenance kind the harness set for what it writes, if any.
  entity Actor in [Scope] = { level: String, source?: String };
  entity Item = {
    scope: Scope,
    owner: Actor,
    class: String,
    status: String,
    kind: String,
    confidence: Confidence,
    version: Long,
    content_hash: String,
    valid_from: Instant,
    valid_to?: Instant,
    ttl?: Long,
  };
  action read appliesTo {
    principal: Actor,
    resource: Item,
    context: {
      at: Instant,
      valid_at: Instant,
      // The flattened grants: present when a grant on the item names the
      // reader and the item's class; expires absent when one never expires.
      grant?: { expires?: Instant },
    },
  };
  action write, write_without_review appliesTo {
    principal: Actor,
    resource: Item,
    context: {
      // The projected item of the same id, on a rewrite; granted when it
      // carries grants.
      existing?: { scope: Scope, owner: Actor, version: Long, granted: Bool },
      // The content hashes of the items retired in the item's scope.
      retired: Set<String>,
      // The flattened grants of the write: the item carries grants; the
      // rewrite changes the grants (or the class under grants); the write is
      // the promotion gate's in-place transition.
      granted: Bool,
      changes_grants: Bool,
      in_place_promotion: Bool,
    },
  };
}
`;

/**
 * A string as a Cedar string literal, which is also how a policy id reaches a
 * `//` comment (review finding E2.12-4). Quotes and backslashes are escaped,
 * and so is every control character, since a raw line break would end the
 * comment and let the id write a policy. U+2028 and U+2029 are escaped too:
 * Cedar's parser does not end a comment at them, but editors, diffs and
 * JavaScript tools treat them as line breaks, so the escape protects readers
 * and tools, not the parser (review finding E2.12-7).
 */
function cedarString(s: string): string {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0) as number;
    if (ch === '"' || ch === "\\") out += `\\${ch}`;
    else if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029)
      out += `\\u{${code.toString(16)}}`;
    else out += ch;
  }
  return `${out}"`;
}

/** `expr` is one of `values`, as a Cedar condition; `false` when there are none. */
function inSet(expr: string, values: readonly string[]): string {
  return values.length === 0
    ? "false"
    : `[${values.map(cedarString).join(", ")}].contains(${expr})`;
}

/** a < b, or a <= b with `orEqual`, over two instant expressions. */
function before(a: string, b: string, orEqual: boolean): string {
  return `(${a}.s < ${b}.s || (${a}.s == ${b}.s && ${a}.ns ${orEqual ? "<=" : "<"} ${b}.ns))`;
}

/**
 * The item expires by `at`: `from` plus `ttl` whole seconds, the fraction
 * kept, is not after `at` (retention.ts, itemExpiry). addSeconds returns
 * null, an expiry that never comes, past the last second a timestamp can
 * write; no bound is needed here, since such an end is after every `at` a
 * timestamp can write.
 */
function expiredBy(from: string, ttl: string, at: string): string {
  const end = `${from}.s + ${ttl}`;
  return `(${end} < ${at}.s || (${end} == ${at}.s && ${from}.ns <= ${at}.ns))`;
}

/** The double's bits as two unsigned 32-bit halves; -0 is 0, as every comparison treats it. */
export function confidenceBits(x: number): { hi: number; lo: number } {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x === 0 ? 0 : x);
  return { hi: view.getUint32(0), lo: view.getUint32(4) };
}

/** confidence < x, exactly, for a non-negative double x. */
function belowConfidence(expr: string, x: number): string {
  const { hi, lo } = confidenceBits(x);
  return `(${expr}.hi < ${hi} || (${expr}.hi == ${hi} && ${expr}.lo < ${lo}))`;
}

/**
 * The Cedar condition that `principal` may read scope `scope` as a member
 * (evaluate.ts, readableScope): a member of it, and the read matrix's first
 * row for the principal's level lists the scope's level.
 */
function readable(policy: Policy, scope: string): string {
  const rows = firstRows(policy).filter((r) => r.may_read.length > 0);
  if (rows.length === 0) return "false";
  const levels = rows
    .map(
      (r) =>
        `(principal.level == ${cedarString(r.reader)} && ${inSet(`${scope}.level`, r.may_read)})`,
    )
    .join(" || ");
  return `(principal in ${scope} && (${levels}))`;
}

/** The read matrix's first row per reader level, as the evaluator's `find` takes it. */
function firstRows(policy: Policy): Policy["read"]["matrix"] {
  const seen = new Set<string>();
  return policy.read.matrix.filter((r) => (seen.has(r.reader) ? false : seen.add(r.reader)));
}

function refuseUntranslatable(policy: Policy): void {
  const on = [
    ...Object.entries(policy.content_guards ?? {})
      .filter(([, v]) => v !== "off")
      .map(([k]) => `content_guards.${k}`),
    ...Object.entries(policy.trust ?? {})
      .filter(([, v]) => v !== "off")
      .map(([k]) => `trust.${k}`),
  ];
  if (on.length > 0)
    throw new CedarExportError(
      `policy ${policy.id} sets ${on.join(", ")}; the Cedar export does not translate content guards or trust options, and refuses rather than export a gate that disagrees with the evaluator`,
    );
  // Card E2.14: an option nothing builds yet is refused as the loader refuses
  // it; the card that builds one decides whether the export translates it.
  const unbuilt = notBuiltOptions(policy);
  if (unbuilt.length > 0)
    throw new CedarExportError(`policy ${policy.id}: ${unbuilt.map((o) => o.message).join("; ")}`);
}

/**
 * The Cedar schema and policy set of `policy` (ADR 0041). Pure and
 * deterministic: the same policy gives the same text. Throws
 * CedarExportError on a policy it cannot translate faithfully.
 */
export function exportCedar(policy: Policy): CedarExport {
  refuseUntranslatable(policy);
  const rules: CedarRule[] = [];
  const add = (id: string, engram: string, comment: string, text: string) =>
    rules.push({
      id,
      engram,
      text: `// ${comment}\n@id(${cedarString(id)})\n@engram(${cedarString(engram)})\n${text};`,
    });
  const p = policy.id;
  const read = `action == ${CEDAR_NAMESPACE}::Action::"read"`;
  const write = `action == ${CEDAR_NAMESPACE}::Action::"write"`;
  const writes = `action in [${CEDAR_NAMESPACE}::Action::"write", ${CEDAR_NAMESPACE}::Action::"write_without_review"]`;
  const unreviewed = `action == ${CEDAR_NAMESPACE}::Action::"write_without_review"`;
  const forbid = (action: string, when: string) =>
    `forbid (principal, ${action}, resource)\nwhen { ${when} }`;
  const permit = (action: string, when: string) =>
    `permit (principal, ${action}, resource)\nwhen { ${when} }`;

  // The read path, in the evaluator's order: status, ttl, access, validity.
  add(
    "read/status",
    READ_STATUS_ID,
    "only active items are read",
    forbid(read, `resource.status != "active"`),
  );
  add(
    "read/ttl/own",
    READ_TTL_ID,
    "past the item's own ttl",
    forbid(
      read,
      `resource has ttl && ${expiredBy("resource.valid_from", "resource.ttl", "context.at")}`,
    ),
  );
  const ruleSeen = new Set<string>();
  for (const r of policy.retention) {
    const key = `${r.scope}/${r.class}`;
    if (ruleSeen.has(key)) continue;
    ruleSeen.add(key);
    if (r.ttl === null) continue;
    add(
      `read/ttl/${key}`,
      READ_TTL_ID,
      `past the ${r.scope} ${r.class} retention ttl of ${r.ttl} seconds (${cedarString(`${p}/retention/${key}`)})`,
      forbid(
        read,
        `resource.scope.level == ${cedarString(r.scope)} && resource.class == ${cedarString(r.class)} && ${expiredBy("resource.valid_from", String(r.ttl), "context.at")}`,
      ),
    );
  }
  for (const row of firstRows(policy)) {
    if (row.may_read.length === 0) continue;
    add(
      `read/matrix/${row.reader}`,
      `${p}/read/${row.reader}`,
      `a ${row.reader} reader reads ${row.may_read.join(", ")} scopes it is a member of`,
      permit(
        read,
        `principal.level == ${cedarString(row.reader)} && principal in resource.scope && ${inSet("resource.scope.level", row.may_read)}`,
      ),
    );
  }
  if (policy.read.honour_grants)
    add(
      "read/grants",
      `${p}/read/grants`,
      "a live grant on the item admits its reader (flattened: see the context's grant)",
      permit(
        read,
        `context has grant && (if context.grant has expires then ${before("context.at", "context.grant.expires", false)} else true)`,
      ),
    );
  add(
    "read/validity",
    READ_VALIDITY_ID,
    "outside the validity window [valid_from, valid_to) at the time read for",
    forbid(
      read,
      `!${before("resource.valid_from", "context.valid_at", true)} || (resource has valid_to && ${before("resource.valid_to", "context.valid_at", true)})`,
    ),
  );

  // The write path. Every check is its own forbid; the evaluator's first
  // failing check is one of those that hold.
  add(
    "write/membership/item",
    WRITE_MEMBERSHIP_ID,
    "the writer is a member of the item's scope; grants never authorise a write",
    forbid(writes, "!(principal in resource.scope)"),
  );
  add(
    "write/membership/existing",
    WRITE_MEMBERSHIP_ID,
    "on a rewrite, the writer is a member of the scope the item has now",
    forbid(writes, "context has existing && !(principal in context.existing.scope)"),
  );
  add(
    "write/owner",
    WRITE_VERSION_ID,
    "a rewrite keeps the owner",
    forbid(writes, "context has existing && resource.owner != context.existing.owner"),
  );
  add(
    "write/version",
    WRITE_VERSION_ID,
    "a rewrite does not lower the version",
    forbid(writes, "context has existing && resource.version < context.existing.version"),
  );
  const moves =
    "context has existing && resource.scope != context.existing.scope && principal != context.existing.owner";
  add(
    "write/move",
    WRITE_MOVE_ID,
    "only the owner moves an item to another scope",
    forbid(writes, `${moves} && ${readable(policy, "context.existing.scope")}`),
  );
  add(
    "write/move/opaque",
    WRITE_MEMBERSHIP_ID,
    "a move by a writer who cannot read the item's scope is refused as a non-member's",
    forbid(writes, `${moves} && !${readable(policy, "context.existing.scope")}`),
  );
  // The grant rules a whole item decides (ADR 0034; card RV7, RV-CORE-1).
  add(
    "write/grant/source",
    GRANT_SOURCE_ID,
    "a rewrite changing the grants is the owner's consent, given by the person: user- or import-sourced",
    forbid(
      writes,
      'context.changes_grants && !(principal has source && ["user", "import"].contains(principal.source))',
    ),
  );
  add(
    "write/grant/owner",
    GRANT_OWNER_ID,
    "only the owner changes an item's grants",
    forbid(
      writes,
      "context has existing && context.changes_grants && principal != context.existing.owner",
    ),
  );
  const keeps =
    "context has existing && !context.changes_grants && context.existing.granted && principal != context.existing.owner && !context.in_place_promotion";
  add(
    "write/grant/owner-rewrite",
    GRANT_OWNER_ID,
    "only the owner rewrites an item carrying grants, the promotion gate's in-place transition apart",
    forbid(writes, `${keeps} && ${readable(policy, "context.existing.scope")}`),
  );
  add(
    "write/grant/owner-rewrite/opaque",
    WRITE_MEMBERSHIP_ID,
    "a rewrite of a granted item by a writer who cannot read its scope is refused as a non-member's",
    forbid(writes, `${keeps} && !${readable(policy, "context.existing.scope")}`),
  );
  add(
    "write/grant/untrusted",
    WRITE_GRANT_ID,
    "model, compaction and external content carries no grants",
    forbid(writes, `context.granted && ${inSet("resource.kind", ISOLATED_SOURCES)}`),
  );
  const writeSeen = new Set<string>();
  for (const rule of policy.write) {
    if (writeSeen.has(rule.scope)) continue;
    writeSeen.add(rule.scope);
    const at = `resource.scope.level == ${cedarString(rule.scope)}`;
    const id = `${p}/write/${rule.scope}`;
    add(`write/${rule.scope}/permit`, id, `the ${rule.scope} write rule`, permit(write, at));
    if (!rule.requires_review)
      add(
        `write/${rule.scope}/permit-unreviewed`,
        id,
        `the ${rule.scope} write rule requires no review`,
        permit(unreviewed, at),
      );
    if (rule.forbidden_classes.length > 0)
      add(
        `write/${rule.scope}/forbidden-class`,
        id,
        `classes forbidden in ${rule.scope} scope`,
        forbid(writes, `${at} && ${inSet("resource.class", rule.forbidden_classes)}`),
      );
    add(
      `write/${rule.scope}/source`,
      id,
      `sources allowed in ${rule.scope} scope: ${rule.allowed_sources.join(", ") || "none"}`,
      forbid(writes, `${at} && !${inSet("resource.kind", rule.allowed_sources)}`),
    );
    add(
      `write/${rule.scope}/floor`,
      id,
      `the ${rule.scope} confidence floor ${rule.confidence_floor}`,
      forbid(writes, `${at} && ${belowConfidence("resource.confidence", rule.confidence_floor)}`),
    );
  }
  for (const level of LEVELS.filter((l) => !writeSeen.has(l)))
    add(
      `write/default-deny/${level}`,
      WRITE_DEFAULT_DENY_ID,
      `no write rule for ${level}: denied by default`,
      forbid(writes, `resource.scope.level == ${cedarString(level)}`),
    );
  add(
    "write/source-isolation",
    SOURCE_ISOLATION_ID,
    "model, compaction and external content stays in person scope",
    forbid(
      writes,
      `${inSet("resource.kind", ISOLATED_SOURCES)} && resource.scope.level != "person"`,
    ),
  );
  add(
    "write/retired-content",
    RETIRED_CONTENT_ID,
    "a model, compaction, tool or external source does not restate content retired in the scope",
    forbid(
      writes,
      `${inSet("resource.kind", RELEARNING_SOURCES)} && context.retired.contains(resource.content_hash)`,
    ),
  );

  const header = [
    `// Policy ${cedarString(p)} version ${policy.version} as Cedar (card E2.12, ADR 0041). Generated by exportCedar.`,
    "// Engram's typed evaluator is the authority; this text is for reading and analysis.",
    "// Not exported: the grant rules judged grant by grant (shape, repeats, class, expiry at addition), content guards, trust options.",
    "// Grants are flattened into the request: context.grant on a read; granted, changes_grants and in_place_promotion on a write.",
  ].join("\n");
  return {
    schema: SCHEMA,
    policies: `${header}\n\n${rules.map((r) => r.text).join("\n\n")}\n`,
    rules,
  };
}

// The request encoding. Policy-independent: everything that depends on the
// policy is in the exported text.

/** `item` is `existing` with only its status and version changed (evaluate.ts, the promotion gate's in-place transition). */
function onlyStatusAndVersion(item: MemoryItem, existing: MemoryItem): boolean {
  const rest = ({ status: _s, version: _v, ...other }: MemoryItem) => canonicalJson(other);
  return rest(item) === rest(existing);
}

export interface CedarUid {
  type: string;
  id: string;
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface CedarEntity {
  uid: CedarUid;
  attrs: { [key: string]: Json };
  parents: CedarUid[];
}

export interface CedarRequest {
  principal: CedarUid;
  action: CedarUid;
  resource: CedarUid;
  context: { [key: string]: Json };
  entities: CedarEntity[];
}

export type CedarAction = "read" | "write" | "write_without_review";

/** Who asks: the actor as the plane receives it (actor.ts), its source optional. */
export type CedarActor = Pick<Actor, "id" | "level" | "memberships" | "source">;

const uid = (type: string, id: string): CedarUid => ({ type: `${CEDAR_NAMESPACE}::${type}`, id });
const ref = (u: CedarUid): Json => ({ __entity: { type: u.type, id: u.id } });

const INSTANT = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z$/;

/**
 * An instant as `{ s, ns }`: epoch seconds of its whole part, as addSeconds
 * reads it, and its fraction as nanoseconds. Throws CedarExportError on an
 * instant finer than a nanosecond, which the encoding cannot carry.
 */
export function cedarInstant(ts: string): { s: number; ns: number } {
  const m = INSTANT.exec(ts);
  // The schema's Timestamp refuses a day or an hour no calendar has, which
  // Date.parse would read as NaN or as another day (review finding E2.12-5).
  if (!m?.[1] || !Timestamp.safeParse(ts).success)
    throw new CedarExportError(`not a UTC ISO 8601 timestamp with a Z: ${ts}`);
  const fraction = m[2] ?? "";
  if (/[1-9]/.test(fraction.slice(9)))
    throw new CedarExportError(
      `${ts} is finer than a nanosecond; the Cedar instant carries nanoseconds`,
    );
  return {
    s: Date.parse(`${m[1]}Z`) / 1000,
    ns: Number(fraction.slice(0, 9).padEnd(9, "0")),
  };
}

function scopeEntity(scope: string): CedarEntity {
  return { uid: uid("Scope", scope), attrs: { level: scopeLevel(scope) }, parents: [] };
}

function actorEntity(actor: CedarActor): CedarEntity {
  return {
    uid: uid("Actor", actor.id),
    attrs:
      actor.source === undefined
        ? { level: actor.level }
        : { level: actor.level, source: actor.source },
    parents: actor.memberships.map((m) => uid("Scope", m)),
  };
}

function itemEntity(item: MemoryItem): CedarEntity {
  const attrs: { [key: string]: Json } = {
    scope: ref(uid("Scope", item.scope)),
    owner: ref(uid("Actor", item.owner)),
    class: item.class,
    status: item.status,
    kind: item.provenance.kind,
    confidence: confidenceBits(item.confidence),
    version: item.version,
    content_hash: contentHash(item.content),
    valid_from: cedarInstant(item.valid_from),
  };
  if (item.valid_to !== null) attrs.valid_to = cedarInstant(item.valid_to);
  if (item.ttl !== null) attrs.ttl = item.ttl;
  return { uid: uid("Item", item.id), attrs, parents: [] };
}

/** The entities of a request: the scopes named, the actor, and the item. */
function entities(
  actor: CedarActor,
  item: MemoryItem,
  more: readonly string[] = [],
): CedarEntity[] {
  const scopes = [...new Set([...actor.memberships, item.scope, ...more])].sort();
  return [...scopes.map(scopeEntity), actorEntity(actor), itemEntity(item)];
}

/**
 * The read of `item` by `actor` at `at`, for the validity window at
 * `validAt`, as a Cedar request (evaluate.ts, evaluateRead). Grants are
 * flattened: `context.grant` is present when a grant on the item matches the
 * actor and names the item's class or none, and carries the latest expiry
 * among them, absent when one of them never expires.
 */
export function cedarReadRequest(
  actor: CedarActor,
  item: MemoryItem,
  at: string,
  validAt: string = at,
): CedarRequest {
  const context: { [key: string]: Json } = {
    at: cedarInstant(at),
    valid_at: cedarInstant(validAt),
  };
  const matching = item.grants.filter(
    (g) => grantMatches(g.to, actor.id) && (g.class === undefined || g.class === item.class),
  );
  if (matching.length > 0) {
    const expiries = matching.map((g) => g.expires);
    if (expiries.includes(undefined)) context.grant = {};
    else {
      const latest = (expiries as string[])
        .map(cedarInstant)
        .reduce((a, b) => (b.s > a.s || (b.s === a.s && b.ns > a.ns) ? b : a));
      context.grant = { expires: latest };
    }
  }
  return {
    principal: uid("Actor", actor.id),
    action: uid("Action", "read"),
    resource: uid("Item", item.id),
    context,
    entities: entities(actor, item),
  };
}

/**
 * The write of `item` by `actor` as a Cedar request (evaluate.ts,
 * evaluateWrite), for `action` write (is the write allowed) or
 * write_without_review (is it allowed and lands without review).
 * `existing` is the projected item of the same id; `retired` the content
 * hashes of the items retired in the item's scope, as the evaluator's map
 * keys them; `options.promotion` the promotion gate's in-place call, as
 * evaluateWrite takes it. Grants are flattened: whether the projected item
 * carries grants, whether the item does, whether the rewrite changes them
 * (sameGrants, or a class change while either carries some), and whether the
 * write is the in-place transition (nothing but the status and the version
 * differ). The grant rules judged grant by grant are not encoded.
 */
export function cedarWriteRequest(
  actor: CedarActor,
  item: MemoryItem,
  existing: MemoryItem | undefined,
  retired: ReadonlyMap<string, string>,
  action: Exclude<CedarAction, "read"> = "write",
  options: { promotion?: boolean } = {},
): CedarRequest {
  const prior = existing?.grants ?? [];
  const reclasses =
    existing !== undefined &&
    item.class !== existing.class &&
    (item.grants.length > 0 || prior.length > 0);
  const context: { [key: string]: Json } = {
    retired: [...retired.keys()].sort(),
    granted: item.grants.length > 0,
    changes_grants: existing !== undefined && (reclasses || !sameGrants(item.grants, prior)),
    in_place_promotion:
      existing !== undefined && options.promotion === true && onlyStatusAndVersion(item, existing),
  };
  if (existing)
    context.existing = {
      scope: ref(uid("Scope", existing.scope)),
      owner: ref(uid("Actor", existing.owner)),
      version: existing.version,
      granted: prior.length > 0,
    };
  return {
    principal: uid("Actor", actor.id),
    action: uid("Action", action),
    resource: uid("Item", item.id),
    context,
    entities: entities(actor, item, existing ? [existing.scope] : []),
  };
}
