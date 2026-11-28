// The preset properties of card E2.18 (ADR 0041, decision 6), written over
// card E2.12's Cedar export, and the replay of every counterexample through
// Engram's own evaluator. Cedar's symbolic compiler (tools/symcc/src/main.rs,
// cedar-policy-symcc 0.8.1 with cvc5) decides each check; this file only
// writes the checks and reads the answers back.
//
// Its command line is tools/symcc/cli.ts:
//   node tools/symcc/cli.ts job --config <config> --out <job.json>
//   node tools/symcc/cli.ts replay --job <job.json> --answers <answers.json> --out <replay.json>
//
// Every check is an implication between two Cedar policy sets over one
// action: every request the left set allows, the right set allows. A check is
// one of two shapes:
//   monotone   left is preset A's export, right is preset B's: B allows every
//              read A allows (strict before medium, medium before permissive);
//   invariant  left is a preset's export, right is one permit stating the
//              property: whatever the preset allows satisfies it. An
//              invariant expected to fail shows a proof is not vacuous: the
//              left set allows some request, or the property's premise is
//              reachable.
// The left set also carries one forbid, the domain: a request the export
// cannot encode from a valid Engram request (a level, status, source kind or
// class Engram does not have, an instant outside the years 0000 to 9999 its
// timestamps write, a nanosecond out of range, a confidence outside [0, 1], a
// version or ttl outside the safe integers from 1) is not one the property is
// about, and the solver is not let to answer with one. Grants are flattened
// by the export (ADR 0041, decision 5), so every result holds modulo grants.
//
// A counterexample is decoded into an Engram actor, item and time, encoded
// again by cedarReadRequest or cedarWriteRequest and compared with what the
// solver found (a decode that does not round-trip is reported, never
// replayed as if faithful), then decided by evaluateRead or evaluateWrite
// under the left preset and, for a monotone check, the right one.
import type { Actor } from "../../packages/core/src/actor.ts";
import { contentHash } from "../../packages/core/src/content-hash.ts";
import {
  type CedarRequest,
  cedarReadRequest,
  cedarWriteRequest,
  exportCedar,
} from "../../packages/core/src/policy/cedar.ts";
import {
  evaluateRead,
  evaluateWrite,
  grantMatches,
} from "../../packages/core/src/policy/evaluate.ts";
import { loadPreset, type PresetName } from "../../packages/core/src/policy/load.ts";
import {
  type Grant,
  MemoryItem,
  type Policy,
  ProvenanceKind,
  type ScopeLevel,
} from "../../packages/core/src/schema.ts";
import { compareTimestamps } from "../../packages/core/src/time.ts";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

export const ACTIONS = ["read", "write", "write_without_review"] as const;
export type Action = (typeof ACTIONS)[number];
const LEVELS: readonly ScopeLevel[] = ["person", "role", "team", "org"];
const STATUSES = ["candidate", "active", "retired"] as const;
const CLASSES = ["episodic", "semantic", "procedural"] as const;
const KINDS = ProvenanceKind.options;
/** 0000-01-01T00:00:00 to 9999-12-31T23:59:59: the instants a timestamp's four-digit year writes. */
const MIN_SECOND = -62167219200;
const MAX_SECOND = 253402300799;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

/** The invariants a config may name: the actions, the permit that states it, and the same statement over an Engram request. */
export const INVARIANTS = {
  "model-write-person-scope": {
    actions: ["write", "write_without_review"],
    // The permit is the property: it allows every request but a model-sourced
    // write outside a person scope the writer is a member of.
    cedar: `permit (principal, action, resource)
when { resource.kind != "model" || (resource.scope.level == "person" && principal in resource.scope) };`,
    holds: (r: Decoded) =>
      r.item.provenance.kind !== "model" ||
      (r.item.scope.startsWith("person:") && r.actor.memberships.includes(r.item.scope)),
  },
  "person-read-needs-grant": {
    actions: ["read"],
    cedar: `permit (principal, action, resource)
when { resource.scope.level != "person" || principal in resource.scope || (context has grant && (if context.grant has expires then (context.at.s < context.grant.expires.s || (context.at.s == context.grant.expires.s && context.at.ns < context.grant.expires.ns)) else true)) };`,
    // A grant counts when it names the reader (exactly or by prefix), names the
    // item's class or none, and has not expired at the read: as liveGrants.
    holds: (r: Decoded) =>
      !r.item.scope.startsWith("person:") ||
      r.actor.memberships.includes(r.item.scope) ||
      r.item.grants.some(
        (g) =>
          grantMatches(g.to, r.actor.id) &&
          (g.class === undefined || g.class === r.item.class) &&
          (g.expires === undefined || compareTimestamps(r.at as string, g.expires) < 0),
      ),
  },
  // Non-vacuity (expected to fail): the premises the two invariants above are
  // about are reachable, and every left set allows some request.
  "model-write-reachable": {
    actions: ["write", "write_without_review"],
    cedar: `permit (principal, action, resource)
when { resource.kind != "model" };`,
    holds: (r: Decoded) => r.item.provenance.kind !== "model",
  },
  "person-read-by-non-member-reachable": {
    actions: ["read"],
    cedar: `permit (principal, action, resource)
when { resource.scope.level != "person" || principal in resource.scope };`,
    holds: (r: Decoded) =>
      !r.item.scope.startsWith("person:") || r.actor.memberships.includes(r.item.scope),
  },
  "left-allows-some": {
    actions: ["read", "write", "write_without_review"],
    // The empty policy set denies every request.
    cedar: "",
    holds: (_r: Decoded) => false,
  },
} as const satisfies {
  [id: string]: { actions: readonly Action[]; cedar: string; holds: (r: Decoded) => boolean };
};
export type InvariantId = keyof typeof INVARIANTS;

export interface PropertySpec {
  id: string;
  /** monotone: each pair [A, B] checks that B allows every request A allows. */
  shape: "monotone" | "invariant";
  pairs?: [PresetName, PresetName][];
  presets?: PresetName[];
  /** For a monotone property, the actions; an invariant takes its own. */
  actions?: Action[];
  /** holds: a proof is expected; fails: a counterexample is (the control). */
  expect: "holds" | "fails";
  /** The property in words, for the result; the Cedar text is the statement checked. */
  statement?: string;
}

export interface Check {
  id: string;
  /** sha256 of `left` and of `right`, recorded in the result so a changed statement moves its bytes. */
  left_sha256: string;
  right_sha256: string;
  property: string;
  shape: PropertySpec["shape"];
  expect: PropertySpec["expect"];
  action: Action;
  left_preset: PresetName;
  right_preset: PresetName | null;
  left: string;
  right: string;
}

export interface Job {
  schema: string;
  /** The domain forbid of each action, as the left sets carry it. */
  domains: { [action: string]: string };
  /** Each invariant's permit, as the right sets carry it. */
  invariants: { [id: string]: string };
  exports: { [preset: string]: { policies_sha256: string; rules: number } };
  checks: Check[];
}

const isLevel = (expr: string) => `[${LEVELS.map((l) => `"${l}"`).join(", ")}].contains(${expr})`;
const isOneOf = (expr: string, values: readonly string[]) =>
  `[${values.map((v) => `"${v}"`).join(", ")}].contains(${expr})`;
const inRange = (expr: string, lo: number, hi: number) => `(${lo} <= ${expr} && ${expr} <= ${hi})`;
/** `cond` over an optional attribute, true when it is absent; an `if`, which Cedar's typechecker reads as a guard. */
const optional = (expr: string, attr: string, cond: string) =>
  `(if ${expr} has ${attr} then ${cond} else true)`;
const instant = (expr: string) =>
  `(${inRange(`${expr}.s`, MIN_SECOND, MAX_SECOND)} && ${inRange(`${expr}.ns`, 0, 999999999)})`;

/**
 * The domain of every check: the requests Engram can express. A forbid of
 * every other request, added to the left set, so a counterexample is always
 * one of them. The confidence bound is the bits of 1.0 (0x3FF00000, 0).
 */
export function domain(action: Action): string {
  const item = [
    isLevel("principal.level"),
    optional("principal", "source", isOneOf("principal.source", KINDS)),
    isLevel("resource.scope.level"),
    isOneOf("resource.status", STATUSES),
    isOneOf("resource.kind", KINDS),
    isOneOf("resource.class", CLASSES),
    inRange("resource.version", 1, MAX_SAFE),
    optional("resource", "ttl", inRange("resource.ttl", 1, MAX_SAFE)),
    instant("resource.valid_from"),
    optional("resource", "valid_to", instant("resource.valid_to")),
    inRange("resource.confidence.hi", 0, 4294967295),
    inRange("resource.confidence.lo", 0, 4294967295),
    "(resource.confidence.hi < 1072693248 || (resource.confidence.hi == 1072693248 && resource.confidence.lo == 0))",
  ];
  const context =
    action === "read"
      ? [
          instant("context.at"),
          instant("context.valid_at"),
          optional(
            "context",
            "grant",
            optional("context.grant", "expires", instant("context.grant.expires")),
          ),
        ]
      : [
          optional(
            "context",
            "existing",
            `${isLevel("context.existing.scope.level")} && ${inRange("context.existing.version", 1, MAX_SAFE)}`,
          ),
          // The flattened grant flags only as cedarWriteRequest can set them:
          // a change of grants is a rewrite with grants on one side or the
          // other; a rewrite that keeps them keeps whether there are any; the
          // in-place transition is a rewrite that keeps the scope, the owner
          // and the grants. The solver could otherwise pick flags no pair of
          // Engram items gives.
          "(if context.changes_grants then (context has existing && (context.granted || context.existing.granted)) else true)",
          "(if context has existing then (context.changes_grants || context.granted == context.existing.granted) else !context.in_place_promotion)",
          "(if context.in_place_promotion then (context has existing && !context.changes_grants && context.existing.scope == resource.scope && context.existing.owner == resource.owner) else true)",
        ];
  return `// The domain (card E2.18): only requests Engram can express.
@id("domain")
forbid (principal, action == Engram::Action::"${action}", resource)
unless { ${[...item, ...context].join(" && ")} };`;
}

const sha256 = async (text: string) => {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(text).digest("hex");
};

/** The job of a config's properties: the schema, the domain, and one check per property, pair or preset, and action. */
export async function buildJob(properties: readonly PropertySpec[]): Promise<Job> {
  const exports = new Map<PresetName, { policies: string; schema: string; rules: number }>();
  const exported = (name: PresetName) => {
    let e = exports.get(name);
    if (!e) {
      const x = exportCedar(loadPreset(name));
      e = { policies: x.policies, schema: x.schema, rules: x.rules.length };
      exports.set(name, e);
    }
    return e;
  };
  const checks: Omit<Check, "left_sha256" | "right_sha256">[] = [];
  const used = new Set<InvariantId>();
  for (const p of properties) {
    if (p.shape === "monotone") {
      for (const [a, b] of p.pairs ?? [])
        for (const action of p.actions ?? ["read"])
          checks.push({
            id: `${p.id}/${a}-before-${b}/${action}`,
            property: p.id,
            shape: p.shape,
            expect: p.expect,
            action,
            left_preset: a,
            right_preset: b,
            left: `${exported(a).policies}\n${domain(action)}\n`,
            right: exported(b).policies,
          });
    } else {
      const inv = INVARIANTS[p.id as InvariantId];
      if (!inv) throw new Error(`unknown invariant ${p.id}`);
      used.add(p.id as InvariantId);
      for (const preset of p.presets ?? [])
        for (const action of inv.actions)
          checks.push({
            id: `${p.id}/${preset}/${action}`,
            property: p.id,
            shape: p.shape,
            expect: p.expect,
            action,
            left_preset: preset,
            right_preset: null,
            left: `${exported(preset).policies}\n${domain(action)}\n`,
            right: inv.cedar === "" ? "" : `${inv.cedar}\n`,
          });
    }
  }
  const schemas = new Set([...exports.values()].map((e) => e.schema));
  if (schemas.size !== 1) throw new Error("the presets' exports do not share one schema");
  const summary: Job["exports"] = {};
  for (const [name, e] of [...exports].sort(([a], [b]) => a.localeCompare(b)))
    summary[name] = { policies_sha256: await sha256(e.policies), rules: e.rules };
  const hashed: Check[] = [];
  for (const c of checks)
    hashed.push({ ...c, left_sha256: await sha256(c.left), right_sha256: await sha256(c.right) });
  return {
    schema: [...schemas][0] as string,
    domains: Object.fromEntries(ACTIONS.map((a) => [a, domain(a)])),
    invariants: Object.fromEntries([...used].sort().map((id) => [id, INVARIANTS[id].cedar])),
    exports: summary,
    checks: hashed,
  };
}

// ---- counterexamples ------------------------------------------------------------

/** A counterexample as engram-symcc writes it. */
export interface Counterexample {
  principal: { type: string; id: string };
  action: { type: string; id: string };
  resource: { type: string; id: string };
  context: Obj;
  entities: {
    uid: { type: string; id: string };
    attrs: Obj;
    parents: { type: string; id: string }[];
  }[];
  left_decision: string;
  right_decision: string;
}

export interface Answer {
  id: string;
  action: string;
  envs: number;
  holds: boolean;
  counterexample: Counterexample | null;
}

/** An Engram request decoded from a counterexample. */
export interface Decoded {
  action: Action;
  actor: Actor;
  item: MemoryItem;
  at?: string;
  validAt?: string;
  existing?: MemoryItem;
  retired: Map<string, string>;
  promotion: boolean;
}

const ITEM_ID = "01900000-0000-7000-8000-000000000001";
const ZERO_HASH = `sha256:${"0".repeat(64)}`;

const entityRef = (v: Json | undefined): { type: string; id: string } => {
  const o = v as Obj;
  const inner = (o.__entity ?? o) as Obj;
  return { type: String(inner.type), id: String(inner.id) };
};
const key = (u: { type: string; id: string }) => `${u.type}::${u.id}`;

function toInstant(v: Json | undefined): string {
  const { s, ns } = v as { s: number; ns: number };
  const whole = new Date(s * 1000).toISOString().slice(0, 19);
  return ns === 0 ? `${whole}Z` : `${whole}.${String(ns).padStart(9, "0")}Z`;
}

function toConfidence(v: Json | undefined): number {
  const { hi, lo } = v as { hi: number; lo: number };
  const view = new DataView(new ArrayBuffer(8));
  view.setUint32(0, hi);
  view.setUint32(4, lo);
  return view.getFloat64(0);
}

/** Names for the solver's entities: scopes by level, actors by order of first sight. */
class Names {
  private scopes = new Map<string, string>();
  private actors = new Map<string, string>();
  orgScopes = new Set<string>();
  private levelOf: (k: string) => string;
  constructor(levelOf: (k: string) => string) {
    this.levelOf = levelOf;
  }
  scope(u: { type: string; id: string }): string {
    const k = key(u);
    let s = this.scopes.get(k);
    if (s === undefined) {
      const level = this.levelOf(k);
      if (level === "org") this.orgScopes.add(k);
      s = level === "org" ? "org" : `${level}:s${this.scopes.size}`;
      this.scopes.set(k, s);
    }
    return s;
  }
  actor(u: { type: string; id: string }): string {
    const k = key(u);
    let a = this.actors.get(k);
    if (a === undefined) {
      a = `actor:a${this.actors.size}`;
      this.actors.set(k, a);
    }
    return a;
  }
}

/**
 * The Engram request of a counterexample, and whether it is faithful: encoded
 * again, it says what the solver's request says (entity names aside), and
 * no two org scopes of the solver's collapse into Engram's one `org`.
 */
export function decode(
  given: Counterexample,
  action: Action,
): { decoded: Decoded; faithful: boolean; problems: string[] } {
  // Cedar writes entities and parents in hash-map order, which varies by run;
  // the names below are given in order of sight, so sort first.
  const byUid = (a: { type: string; id: string }, b: { type: string; id: string }) =>
    key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
  const cex: Counterexample = {
    ...given,
    entities: given.entities
      .map((e) => ({ ...e, parents: [...e.parents].sort(byUid) }))
      .sort((a, b) => byUid(a.uid, b.uid)),
  };
  const byKey = new Map(cex.entities.map((e) => [key(e.uid), e]));
  const levelOf = (k: string) => String(byKey.get(k)?.attrs.level ?? "");
  const names = new Names(levelOf);
  const principal = byKey.get(key(cex.principal));
  const resource = byKey.get(key(cex.resource));
  if (!principal || !resource)
    throw new Error("the counterexample lacks its principal or resource");
  const pa = principal.attrs;
  const actor: Actor = {
    id: names.actor(cex.principal),
    level: String(pa.level) as ScopeLevel,
    memberships: principal.parents
      .filter((p) => p.type.endsWith("::Scope"))
      .map((p) => names.scope(p))
      .sort(),
    ...(pa.source === undefined ? {} : { source: String(pa.source) as Actor["source"] }),
  };
  const ra = resource.attrs;
  const kind = String(ra.kind) as MemoryItem["provenance"]["kind"];
  const cls = String(ra.class) as MemoryItem["class"];
  const owner = names.actor(entityRef(ra.owner));
  const base = {
    id: ITEM_ID,
    scope: names.scope(entityRef(ra.scope)),
    owner,
    provenance: { kind, ref: "cedar:counterexample", hash: ZERO_HASH, actor: owner },
    confidence: toConfidence(ra.confidence),
    valid_from: toInstant(ra.valid_from),
    valid_to: ra.valid_to === undefined ? null : toInstant(ra.valid_to),
    ttl: ra.ttl === undefined ? null : Number(ra.ttl),
    grants: [] as Grant[],
    version: Number(ra.version),
    lineage: [],
    status: String(ra.status) as MemoryItem["status"],
    store_ref: null,
    schema_version: 1 as const,
  };
  const item = (
    cls === "procedural"
      ? { ...base, class: cls, content: { body: "counterexample", tools: [] } }
      : { ...base, class: cls, content: "counterexample" }
  ) as MemoryItem;
  const ctx = cex.context;
  const decoded: Decoded = { action, actor, item, retired: new Map(), promotion: false };
  if (action === "read") {
    decoded.at = toInstant(ctx.at);
    decoded.validAt = toInstant(ctx.valid_at);
    const grant = ctx.grant as Obj | undefined;
    if (grant !== undefined)
      item.grants = [
        {
          to: actor.id,
          class: cls,
          mode: "read",
          ...(grant.expires === undefined ? {} : { expires: toInstant(grant.expires) }),
        },
      ];
  } else {
    const existing = ctx.existing as Obj | undefined;
    // A grant the per-grant rules accept (ADR 0021: it names the item's class
    // and an expiry), which the export does not translate (ADR 0041, decision 5).
    const grantTo = (n: number): Grant => ({
      to: `actor:grantee${n}`,
      class: cls,
      mode: "read",
      expires: "9999-12-31T23:59:59Z",
    });
    if (ctx.granted === true) item.grants = [grantTo(0)];
    if (existing !== undefined) {
      decoded.promotion = ctx.in_place_promotion === true;
      // The prior grants: none, a different grant when the rewrite changes
      // them, else the item's own. Flags no pair of grant lists can give
      // (the existing item granted, the item not, and no change) are left
      // for the round trip to report.
      const prior: Grant[] =
        existing.granted !== true
          ? []
          : ctx.changes_grants === true
            ? [grantTo(1)]
            : item.grants.length > 0
              ? item.grants
              : [grantTo(0)];
      decoded.existing = {
        ...item,
        scope: names.scope(entityRef(existing.scope)),
        owner: names.actor(entityRef(existing.owner)),
        version: Number(existing.version),
        status: decoded.promotion ? "candidate" : item.status,
        grants: prior,
      } as MemoryItem;
    }
    const retired = (ctx.retired as string[]) ?? [];
    if (retired.includes(String(ra.content_hash)))
      decoded.retired.set(contentHash(item.content), "01900000-0000-7000-8000-000000000002");
  }
  const problems: string[] = [];
  if (names.orgScopes.size > 1)
    problems.push(`${names.orgScopes.size} org scopes collapse into Engram's one org`);
  for (const it of [item, decoded.existing])
    if (it && !MemoryItem.safeParse(it).success)
      problems.push(
        `the decoded item is not a valid MemoryItem: ${MemoryItem.safeParse(it).error}`,
      );
  if (problems.length === 0) {
    const again =
      action === "read"
        ? cedarReadRequest(actor, item, decoded.at as string, decoded.validAt)
        : cedarWriteRequest(actor, item, decoded.existing, decoded.retired, action, {
            promotion: decoded.promotion,
          });
    const a = JSON.stringify(normalise(again, null));
    const b = JSON.stringify(normalise(asRequest(cex), names));
    if (a !== b) problems.push(`the decoded request encodes differently: ${a} against ${b}`);
  }
  return { decoded, faithful: problems.length === 0, problems };
}

function asRequest(cex: Counterexample): CedarRequest {
  return {
    principal: cex.principal,
    action: cex.action,
    resource: cex.resource,
    context: cex.context,
    entities: cex.entities as CedarRequest["entities"],
  };
}

/**
 * What decides a request, with the solver's entity names replaced by the
 * decoder's: the principal's level, source and scopes, the item's attributes,
 * the context, and the level of every scope named (`names` null: the
 * request is Engram's own, its ids kept). A content hash is kept
 * only as whether it is among the retired.
 */
function normalise(r: CedarRequest, names: Names | null): Json {
  const byKey = new Map(r.entities.map((e) => [key(e.uid), e]));
  const rename = (v: Json): Json => {
    if (Array.isArray(v)) return v.map(rename);
    if (v !== null && typeof v === "object") {
      if ("__entity" in v || ("type" in v && "id" in v && Object.keys(v).length === 2)) {
        const u = entityRef(v);
        return u.type.endsWith("::Scope")
          ? {
              scope: names ? names.scope(u) : u.id,
              level: String(byKey.get(key(u))?.attrs.level ?? ""),
            }
          : { actor: names ? names.actor(u) : u.id };
      }
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, rename((v as Obj)[k] as Json)]),
      );
    }
    return v;
  };
  const p = byKey.get(key(r.principal));
  const res = byKey.get(key(r.resource));
  const attrs = { ...(res?.attrs ?? {}) };
  const context = { ...r.context };
  if ("content_hash" in attrs) {
    const retired = (context.retired as string[] | undefined) ?? [];
    attrs.content_hash = retired.includes(String(attrs.content_hash));
    delete context.retired;
  }
  return rename({
    principal: { actor: r.principal as unknown as Json, attrs: p?.attrs ?? {} },
    scopes: [...(p?.parents ?? [])]
      .map((u) => rename(u as unknown as Json))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    action: r.action.id,
    resource: attrs,
    context,
  } as unknown as Json);
}

/** Whether Engram's evaluator allows a decoded request under `policy`, for the check's action. */
export function evaluatorAllows(policy: Policy, d: Decoded): boolean {
  return evaluatorDecides(policy, d).allows;
}

/** The evaluator's verdict on a decoded request, with the rule that decided it. */
export function evaluatorDecides(policy: Policy, d: Decoded): { allows: boolean; rule: string } {
  if (d.action === "read") {
    const r = evaluateRead(policy, d.actor, d.item, d.at as string, d.validAt);
    return { allows: r.admitted, rule: r.policy_id };
  }
  const w = evaluateWrite(policy, d.actor, d.item, d.existing, d.retired, undefined, {
    promotion: d.promotion,
  });
  const allows =
    d.action === "write" ? w.decision === "allow" : w.decision === "allow" && w.check === "admit";
  return { allows, rule: w.policy_id };
}

export interface Replay {
  id: string;
  faithful: boolean;
  problems: string[];
  engram: Obj | null;
  left_allows: boolean | null;
  /** The rule of the left preset's evaluator that decided. */
  left_rule: string;
  right_allows: boolean | null;
  reproduced: boolean;
}

/**
 * Each counterexample decided by the evaluator. Reproduced: the left preset
 * allows it and the right side does not (the right preset's evaluator for a
 * monotone check, the property's own statement over the Engram request for
 * an invariant).
 */
export function replay(job: Job, answers: readonly Answer[]): Replay[] {
  const checks = new Map(job.checks.map((c) => [c.id, c]));
  const out: Replay[] = [];
  for (const a of answers) {
    if (a.counterexample === null) continue;
    const check = checks.get(a.id);
    if (!check) throw new Error(`an answer for no check: ${a.id}`);
    const { decoded, faithful, problems } = decode(a.counterexample, check.action);
    const left = evaluatorDecides(loadPreset(check.left_preset), decoded);
    const leftAllows = left.allows;
    const rightAllows =
      check.right_preset === null
        ? INVARIANTS[check.property as InvariantId].holds(decoded)
        : evaluatorAllows(loadPreset(check.right_preset), decoded);
    out.push({
      id: a.id,
      faithful,
      problems,
      engram: engramView(decoded),
      left_allows: leftAllows,
      left_rule: left.rule,
      right_allows: rightAllows,
      reproduced: faithful && leftAllows && !rightAllows,
    });
  }
  return out;
}

/** The decoded request as the result prints it: the fields that decide, nothing generated. */
function engramView(d: Decoded): Obj {
  const it = (i: MemoryItem): Obj => ({
    scope: i.scope,
    owner: i.owner,
    class: i.class,
    status: i.status,
    kind: i.provenance.kind,
    // Exactly, as the shortest decimal that reads back to the same double;
    // the result's writer rounds numbers.
    confidence: String(i.confidence),
    version: i.version,
    valid_from: i.valid_from,
    valid_to: i.valid_to,
    ttl: i.ttl,
    grants: i.grants as unknown as Json,
  });
  const view: Obj = {
    action: d.action,
    actor: {
      id: d.actor.id,
      level: d.actor.level,
      memberships: d.actor.memberships,
      source: d.actor.source ?? null,
    },
    item: it(d.item),
  };
  if (d.action === "read") {
    view.at = d.at ?? null;
    view.valid_at = d.validAt ?? null;
  } else {
    view.existing = d.existing ? it(d.existing) : null;
    view.retired = d.retired.size > 0;
    view.promotion = d.promotion;
  }
  return view;
}
