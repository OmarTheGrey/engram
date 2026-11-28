// The record of processing (card E9.16): what GDPR Article 30(1) asks a
// controller's record to hold, given as far as the policy states it, one
// entry per scope level. A pure rule over the policy and, when a log is
// given, the projection's counts. It is evidence a controller can put in its
// record; it is not the record, and not a certification (docs/compliance/).
//
// What it holds: counts and categories only. The policy's levels, classes,
// sources, read matrix, retention rules and measures; with the projection,
// how many items each level holds of each class and status. Never content,
// an item id, a scope id, an actor or a reason, so a record from a member's
// own log may leave the machine (AGENTS.md rule 12). Consent opt-outs name
// person scopes, so only their number is given.
//
// What it cannot hold: the controller's name and contact details (point
// (a)), the purposes of the processing (b) and transfers to third countries
// (e) are not in a policy, so each is listed under `not_held` for the
// controller to state. The time limits of point (f) are given as the policy
// sets them, with their limit: a ttl retires an item and keeps its bytes
// (ADR 0010), so erasure is by offboarding, in the policy's erasure mode.
//
// The field list is the Regulation's (Regulation (EU) 2016/679, Article
// 30(1)). CIRCL/compliance (AGPL-3.0) and gdprropa (GPL-3.0) were read for
// ideas only; nothing is copied (ADR 0037).
import { createHash } from "node:crypto";
import { canonicalJson } from "../model.ts";
import { scopeLevel } from "../policy/evaluate.ts";
import {
  MemoryClass,
  type MemoryItem,
  type Policy,
  SCHEMA_VERSION,
  ScopeLevel,
} from "../schema.ts";

export const ROPA_FORMAT = "engram-ropa/1";

type Level = (typeof ScopeLevel.options)[number];
type Class = (typeof MemoryClass.options)[number];

/** Who a level's items are about, as a category (Article 30(1)(c)). */
const DATA_SUBJECTS: Record<Level, string> = {
  person: "the person the scope is named for, and the people its memories mention",
  role: "the holders of the role, and the people its memories mention",
  team: "the team's members, and the people its memories mention",
  org: "the organisation's members, and the people its memories mention",
};

/** One class a level may hold under the write rules, and on what terms. */
export interface RopaCategory {
  class: Class;
  allowed_sources: string[];
  confidence_floor: number;
  requires_review: boolean;
}

/** One retention rule of a level (Article 30(1)(f), with its limit). */
export interface RopaTimeLimit {
  class: Class;
  /** Seconds after which the item is retired; null for none. */
  ttl: number | null;
  budget: number | null;
  eviction: string;
}

/** The record's entry for one scope level. */
export interface RopaLevel {
  level: Level;
  /** Article 30(1)(c): categories of data subjects. */
  data_subjects: string;
  /** Article 30(1)(c): categories of personal data, the classes the write rules let in. */
  categories: RopaCategory[];
  /** The classes no write rule of the level lets in. */
  forbidden_classes: Class[];
  /** Article 30(1)(d): the reader levels the read matrix lets read this level, and grants. */
  recipients: { reader_levels: Level[]; grants_honoured: boolean };
  /** Article 30(1)(f): the policy's retention rules for the level. */
  time_limits: RopaTimeLimit[];
  /** The projection's items of the level by class and status; null without a log. */
  counts: Record<string, Record<string, number>> | null;
}

/** The record of processing (see the module comment). */
export interface RopaRecord {
  format: typeof ROPA_FORMAT;
  policy: { id: string; version: number; sha256: string };
  schema_version: number;
  /** The points of Article 30(1) the policy does not hold, for the controller to state. */
  not_held: { point: string; field: string }[];
  levels: RopaLevel[];
  /** Article 30(1)(f): how an item is erased, beside the ttls that only retire it. */
  erasure: { mode: string; by: string };
  /** Article 30(1)(g): the technical measures the policy turns on, as categories. */
  measures: string[];
  /** Consent opt-outs at the write gate: their number only. */
  consent_opt_outs: number;
  notes: string[];
}

const NOT_HELD = [
  {
    point: "a",
    field:
      "the name and contact details of the controller, any joint controller, representative and data protection officer",
  },
  { point: "b", field: "the purposes of the processing" },
  {
    point: "e",
    field: "transfers of personal data to a third country or international organisation",
  },
];

export const ROPA_NOTES = [
  "evidence a controller can put in its record of processing activities (GDPR Article 30(1)), not the record itself and not a certification",
  "counts and categories only: no content, item id, scope id, actor or reason",
  "a ttl retires an item and keeps its bytes (ADR 0010); erasure is by offboarding a person scope",
] as const;

/** The policy's sha256, over its canonical JSON (keys sorted). */
export function policySha256(policy: Policy): string {
  return createHash("sha256").update(canonicalJson(policy)).digest("hex");
}

function measuresOf(policy: Policy): string[] {
  const m = [
    "a write gate: every write is decided against the write rules and logged with its reason and rule",
    "a read filter: every read is filtered by the read matrix and grants, and logged",
    "a hash-chained event log of every decision (engram log verify)",
  ];
  if (policy.lints.enabled.length > 0)
    m.push(`memory lints enabled: ${[...policy.lints.enabled].sort().join(", ")}`);
  const guards = policy.content_guards;
  if (guards !== undefined) {
    for (const key of ["secrets", "pii"] as const) {
      const mode = guards[key];
      if (mode !== undefined && mode !== "off") m.push(`content guard ${key}: ${mode}`);
    }
    if (guards.injection_screen !== undefined && guards.injection_screen !== "off")
      m.push(`injection screen: ${guards.injection_screen}`);
    if (guards.max_content_bytes !== undefined)
      m.push(`content limit: ${guards.max_content_bytes} bytes`);
  }
  const trust = policy.trust;
  if (trust?.unattested_floor === "on")
    m.push("trust: unattested writes recorded at the least trusted kind");
  if (trust?.protect_trusted === "on")
    m.push("trust: a less trusted source never rewrites a more trusted item");
  if (policy.grants?.expiry_cap === "on") m.push("grants: expiry capped at 365 days");
  if ((policy.approval?.routes.length ?? 0) > 0)
    m.push(`approval routes: ${policy.approval?.routes.length}`);
  return m;
}

/** The projection's counts of one level, by class then status, keys sorted. */
function countsOf(items: readonly MemoryItem[], level: Level) {
  const out: Record<string, Record<string, number>> = {};
  for (const item of items) {
    if (scopeLevel(item.scope) !== level) continue;
    const c = (out[item.class] ??= {});
    c[item.status] = (c[item.status] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.keys(out)
      .sort()
      .map((k) => {
        const c = out[k] as Record<string, number>;
        return [
          k,
          Object.fromEntries(
            Object.keys(c)
              .sort()
              .map((s) => [s, c[s] as number]),
          ),
        ];
      }),
  );
}

/**
 * The record of processing under `policy`; with `items` (the projection),
 * each level's counts. Levels in the schema's order, classes in theirs.
 */
export function ropaRecord(policy: Policy, items?: readonly MemoryItem[]): RopaRecord {
  const levels = ScopeLevel.options.map((level): RopaLevel => {
    const rules = policy.write.filter((r) => r.scope === level);
    const categories: RopaCategory[] = [];
    const forbidden: Class[] = [];
    for (const cls of MemoryClass.options) {
      const admits = rules.filter((r) => !r.forbidden_classes.includes(cls));
      if (admits.length === 0) {
        forbidden.push(cls);
        continue;
      }
      for (const r of admits)
        categories.push({
          class: cls,
          allowed_sources: [...r.allowed_sources].sort(),
          confidence_floor: r.confidence_floor,
          requires_review: r.requires_review,
        });
    }
    return {
      level,
      data_subjects: DATA_SUBJECTS[level],
      categories,
      forbidden_classes: forbidden,
      recipients: {
        reader_levels: ScopeLevel.options.filter((reader) =>
          policy.read.matrix.some((row) => row.reader === reader && row.may_read.includes(level)),
        ),
        grants_honoured: policy.read.honour_grants,
      },
      time_limits: MemoryClass.options.flatMap((cls) =>
        policy.retention
          .filter((r) => r.scope === level && r.class === cls)
          .map((r) => ({ class: cls, ttl: r.ttl, budget: r.budget, eviction: r.eviction })),
      ),
      counts: items === undefined ? null : countsOf(items, level),
    };
  });
  return {
    format: ROPA_FORMAT,
    policy: { id: policy.id, version: policy.version, sha256: policySha256(policy) },
    schema_version: SCHEMA_VERSION,
    not_held: NOT_HELD.map((n) => ({ ...n })),
    levels,
    erasure: {
      mode: policy.erasure?.mode ?? "redact",
      by: "offboarding a person scope: its items leave the store and the projection, the events keep their decisions",
    },
    measures: measuresOf(policy),
    consent_opt_outs: policy.consent?.opt_outs.length ?? 0,
    notes: [...ROPA_NOTES],
  };
}
