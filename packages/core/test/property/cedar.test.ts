// The differential test of the Cedar export (card E2.12, ADR 0041). Each
// generated request is decided by Engram's typed evaluator (evaluateRead,
// evaluateWrite) and by Cedar's engine (@cedar-policy/cedar-wasm 4.14.0, a
// development dependency of this test only) on exportCedar's schema and
// policy set, for the presets strict, medium and permissive, and for
// generated policies. The evaluator is the authority: a disagreement is a
// finding, logged with its seed, and the evaluator is never changed here.
//
// Agreement is required on:
//   - the decision: Cedar allows `read` exactly when the evaluator admits the
//     item, `write` exactly when it allows the write, and
//     `write_without_review` exactly when the write lands without review;
//   - the rule: the Engram rule id that decided is among the `@engram` ids of
//     the Cedar policies that determined Cedar's decision, whenever that rule
//     is one Cedar can name (every allow, and every deny but a read no matrix
//     row or grant admits, which Cedar denies with no policy at all);
//   - no Cedar evaluation error on any request, since Cedar skips a policy
//     whose condition errs, and a skipped forbid would hide a disagreement;
//   - scope before grant: when both a matrix row and the grant permit admit a
//     read, the evaluator names the row (review finding E2.12-2);
//   - one id per Cedar policy, so no duplicate rule overwrites another, and
//     the first of duplicated rules decides (review finding E2.12-1).
//
// Agreement is claimed modulo grants (ADR 0041, decision 5). Excluded and
// flattened classes of request, each with its reason:
//   1. Excluded: writes the evaluator decides by a rule judged grant by grant
//      (`engram/write/grant` for a grant's shape or another class than the
//      item's, `engram/grant/unchanged` for a grant repeated,
//      `engram/grant/expired` for a grant added already expired). Each
//      judges every element of a list, and Cedar's language has no
//      quantifier over a set; flattening one would be the encoder computing
//      the verdict, which tests nothing. Such writes are counted, not
//      compared. An untrusted source carrying grants is translated and
//      compared, though it shares `engram/write/grant`.
//   2. Flattened: the grant rules a whole item decides (review finding
//      E2.12-3). The request says whether the projected item carries
//      grants, whether the item does, whether the rewrite changes them (the
//      evaluator's sameGrants, or a class change under grants) and whether
//      it is the promotion gate's in-place transition; Cedar judges the
//      actor's source and identity, `engram/grant/source`,
//      `engram/grant/owner` and the opaque refusal.
//   3. Policies with content guards or trust options on: exportCedar refuses
//      them (tested below), since the guards' and the injection screen's
//      patterns over content are not translated.
//   4. Instants finer than a nanosecond, or not on the calendar: the Cedar
//      instant is epoch seconds and nanoseconds; the encoder refuses them
//      (tested below).
//   5. Flattened: reads of an item with a grant matching the reader. The
//      encoder matches each grant's `to` against the reader and checks its
//      class (grantMatches, as the evaluator does), so those two are not
//      checked independently; Cedar judges `honour_grants`, the latest expiry
//      against the read time, and the precedence of scope over grant. Such
//      reads are counted apart.
//
// Runs and seeds are set below (ENGRAM_CEDAR_RUNS, ENGRAM_CEDAR_SEED_OFFSET).
import * as cedar from "@cedar-policy/cedar-wasm/nodejs";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { Actor } from "../../src/actor.ts";
import { contentHash } from "../../src/content-hash.ts";
import {
  type CedarExport,
  CedarExportError,
  type CedarRequest,
  cedarInstant,
  cedarReadRequest,
  cedarWriteRequest,
  confidenceBits,
  exportCedar,
} from "../../src/policy/cedar.ts";
import {
  evaluateRead,
  evaluateWrite,
  GRANT_EXPIRED_ID,
  GRANT_OWNER_ID,
  GRANT_SOURCE_ID,
  GRANT_UNCHANGED_ID,
  liveGrants,
  READ_STATUS_ID,
  READ_TTL_ID,
  READ_VALIDITY_ID,
  WRITE_GRANT_ID,
  WRITE_MEMBERSHIP_ID,
  WRITE_MOVE_ID,
  WRITE_VERSION_ID,
} from "../../src/policy/evaluate.ts";
import { loadPreset, PRESETS } from "../../src/policy/load.ts";
import type { Grant, MemoryItem, Policy } from "../../src/schema.ts";
import { addSeconds } from "../../src/time.ts";
import {
  arbGatedGrant,
  arbGrant,
  arbGrantedItem,
  arbInstant,
  arbItem,
  arbPolicy,
  arbPrincipal,
  arbScope,
  arbTtlRules,
  CLASSES,
  SCOPE_LEVELS,
  seedFor,
} from "../generators.ts";

/**
 * Runs and seeds. The defaults are the committed run. A larger run, such as
 * the one-off of 2026-11-21, is
 *   ENGRAM_CEDAR_RUNS=20000 ENGRAM_CEDAR_SEED_OFFSET=7 make test-one T=packages/core/test/property/cedar.test.ts
 * where ENGRAM_CEDAR_RUNS sets each preset property's runs (the generated and
 * duplicated policies scale with it) and ENGRAM_CEDAR_SEED_OFFSET is added to
 * every property's seed. A failure prints its seed, so it reruns alone.
 */
const envInt = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${name} must be a whole number: ${raw}`);
  return n;
};
const RUNS = envInt("ENGRAM_CEDAR_RUNS", 1500);
const SEED_OFFSET = envInt("ENGRAM_CEDAR_SEED_OFFSET", 0);
const GENERATED_RUNS = Math.ceil((RUNS * 2) / 3);
const DUPLICATED_RUNS = Math.ceil(RUNS / 10);
/** About 2 ms a run under load, with room: the shared 30 s timeout at the default. */
const TIMEOUT = Math.max(30_000, RUNS * 20);
const KINDS = ["user", "document", "tool", "model", "import", "compaction", "external"] as const;

// ---- the Cedar side ----------------------------------------------------------

interface CedarDecision {
  allow: boolean;
  /** The `@engram` rule ids of the policies that determined the decision. */
  reasons: string[];
}

/** A Cedar engine over one export: the schema and policy set parsed once. */
function engine(exported: CedarExport, name: string): (req: CedarRequest) => CedarDecision {
  // A repeated id would overwrite a policy here and hide it from Cedar.
  const ids = exported.rules.map((r) => r.id);
  if (new Set(ids).size !== ids.length)
    throw new Error(
      `the export repeats a rule id: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`,
    );
  const staticPolicies = Object.fromEntries(exported.rules.map((r) => [r.id, r.text]));
  const engramOf = new Map(exported.rules.map((r) => [r.id, r.engram]));
  const schemaParsed = cedar.preparseSchema(name, exported.schema);
  if (schemaParsed.type !== "success")
    throw new Error(`Cedar refused the schema: ${JSON.stringify(schemaParsed.errors)}`);
  const setParsed = cedar.preparsePolicySet(name, { staticPolicies });
  if (setParsed.type !== "success")
    throw new Error(`Cedar refused the policy set: ${JSON.stringify(setParsed.errors)}`);
  return (req) => {
    const answer = cedar.statefulIsAuthorized({
      principal: req.principal,
      action: req.action,
      resource: req.resource,
      context: req.context as cedar.Context,
      entities: req.entities as cedar.Entities,
      preparsedSchemaName: name,
      preparsedPolicySetId: name,
      validateRequest: true,
    });
    if (answer.type !== "success")
      throw new Error(`Cedar refused the request: ${JSON.stringify(answer.errors)}`);
    const { decision, diagnostics } = answer.response;
    if (diagnostics.errors.length > 0)
      throw new Error(`Cedar evaluation errors: ${JSON.stringify(diagnostics.errors)}`);
    return {
      allow: decision === "allow",
      reasons: diagnostics.reason.map((id) => engramOf.get(id) ?? `unknown:${id}`),
    };
  };
}

// ---- generators ----------------------------------------------------------------

const TTLS = [1, 86_400, 2_592_000, 7_776_000] as const;
const FRACTIONS = ["", ".0001", ".0009", ".000000001", ".5", ".999999999"] as const;
/** Instants at the edges: near the last writable second, and before the epoch. */
const EDGES = [
  "9999-12-31T23:59:59Z",
  "9999-12-31T23:59:58.5Z",
  "9999-11-20T00:00:00Z",
  "1969-12-31T23:59:59.999999999Z",
] as const;

const withFraction = (ts: string, f: string) => `${ts.slice(0, 19)}${f}Z`;

/** An instant near `base`: a second before it, at it, or a ttl after it, its fraction changed or kept. */
function arbNear(base: string): fc.Arbitrary<string> {
  return fc
    .tuple(fc.constantFrom(-1, 0, ...TTLS), fc.option(fc.constantFrom(...FRACTIONS)))
    .map(([k, f]) => {
      const t = addSeconds(base, k) ?? base;
      return f === null ? t : withFraction(t, f);
    });
}

const arbAnyInstant = fc.oneof(
  { arbitrary: arbInstant, weight: 4 },
  { arbitrary: fc.constantFrom(...EDGES), weight: 1 },
);

/** The confidence floors of every preset and of generated policies' edges, and their neighbours. */
const FLOORS = [0, 0.2, 0.3, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const nextUp = (x: number) => {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  view.setBigUint64(0, view.getBigUint64(0) + 1n);
  return view.getFloat64(0);
};
const nextDown = (x: number) => {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  view.setBigUint64(0, view.getBigUint64(0) - 1n);
  return view.getFloat64(0);
};
const arbConfidence = fc.oneof(
  fc.double({ min: 0, max: 1, noNaN: true }),
  fc.constantFrom(...FLOORS),
  fc.constantFrom(...FLOORS.filter((f) => f < 1).map(nextUp)),
  fc.constantFrom(...FLOORS.filter((f) => f > 0).map(nextDown)),
);

/** An item for a read: any status (active most often), validity window, own ttl and grants. */
const arbReadItem: fc.Arbitrary<MemoryItem> = fc
  .record({
    item: arbItem(),
    status: fc.constantFrom("active", "active", "active", "candidate", "retired"),
    valid_from: arbAnyInstant,
    end: fc.oneof(
      { arbitrary: fc.constant<"open">("open"), weight: 2 },
      { arbitrary: arbInstant, weight: 1 },
      { arbitrary: fc.constantFrom(1, 86_400, 31_536_000), weight: 1 },
    ),
    ttl: fc.oneof(
      { arbitrary: fc.constant(null), weight: 2 },
      { arbitrary: fc.constantFrom(...TTLS), weight: 1 },
    ),
    grants: fc.array(arbGrant, { maxLength: 3 }),
  })
  .map(({ item, status, valid_from, end, ttl, grants }) => ({
    ...item,
    status,
    valid_from,
    valid_to:
      end === "open" ? null : typeof end === "number" ? (addSeconds(valid_from, end) ?? null) : end,
    ttl,
    grants: grants as Grant[],
  }));

/** An actor for `item`: often a member of its scope, sometimes its owner or a grantee. */
function arbActorFor(item: MemoryItem, extraScopes: readonly string[] = []): fc.Arbitrary<Actor> {
  return fc
    .record({
      id: fc.oneof(arbPrincipal, fc.constant(item.owner), fc.constantFrom("agent:x", "person:o")),
      level: fc.constantFrom(...SCOPE_LEVELS),
      memberships: fc.uniqueArray(arbScope, { maxLength: 4 }),
      joins: fc.array(fc.boolean(), {
        minLength: 1 + extraScopes.length,
        maxLength: 1 + extraScopes.length,
      }),
      source: fc.option(fc.constantFrom(...KINDS), { nil: undefined }),
    })
    .map(({ id, level, memberships, joins, source }) => {
      const wanted = [item.scope, ...extraScopes].filter((_, i) => joins[i]);
      const actor: Actor = { id, level, memberships: [...new Set([...memberships, ...wanted])] };
      return source === undefined ? actor : { ...actor, source };
    });
}

interface ReadCase {
  actor: Actor;
  item: MemoryItem;
  at: string;
  validAt: string;
}

const arbReadCase: fc.Arbitrary<ReadCase> = arbReadItem.chain((item) => {
  const near = [item.valid_from, item.valid_to, ...item.grants.map((g) => g.expires)].filter(
    (t): t is string => t !== null && t !== undefined,
  );
  const arbTime = fc.oneof(arbAnyInstant, ...near.map(arbNear));
  return fc
    .record({
      actor: arbActorFor(item),
      item: fc.constant(item),
      at: arbTime,
      validAt: fc.oneof(
        { arbitrary: fc.constant<null>(null), weight: 2 },
        { arbitrary: arbTime, weight: 1 },
      ),
    })
    .map((c) => ({ ...c, validAt: c.validAt ?? c.at }));
});

interface WriteCase {
  actor: Actor;
  item: MemoryItem;
  existing: MemoryItem | undefined;
  retired: Map<string, string>;
  /** The write's time, which only the grant rules read. */
  at?: string;
  /** The promotion gate's in-place transition (evaluateWrite's option). */
  promotion?: boolean;
}

/**
 * Grants for a write: none, grants the gate's shape rule accepts
 * (arbGatedGrant), or any grants (arbGrantedItem's, a pattern too wide, no
 * class or no expiry among them), so that the grant rules a whole item
 * decides are reached and the per-grant rules too (review finding E2.12-3).
 */
const arbWriteGrants: fc.Arbitrary<Grant[]> = fc.oneof(
  { arbitrary: fc.constant<Grant[]>([]), weight: 4 },
  { arbitrary: fc.array(arbGatedGrant, { minLength: 1, maxLength: 2 }), weight: 2 },
  { arbitrary: arbGrantedItem.map((x) => x.grants), weight: 1 },
);

const arbWriteItem: fc.Arbitrary<MemoryItem> = fc
  .tuple(arbItem(), fc.constantFrom(...KINDS), arbConfidence, arbWriteGrants)
  .map(([item, kind, confidence, grants]) => ({
    ...item,
    provenance: { ...item.provenance, kind },
    confidence,
    grants,
  }));

/**
 * A write: an item, often a rewrite of a projected item that carries the same
 * grants, others or none, of the same class or another, sometimes the
 * promotion gate's in-place transition of it (only the status and version
 * changed), by an actor with or without a source, at an instant.
 */
const arbWriteCase: fc.Arbitrary<WriteCase> = arbWriteItem.chain((first) =>
  fc
    .record({
      existing: fc.option(
        fc.record({
          base: arbItem(fc.constant(first.id)),
          sameClass: fc.boolean(),
          scope: fc.oneof(fc.constant(first.scope), arbScope),
          owner: fc.oneof(fc.constant(first.owner), arbPrincipal),
          version: fc.integer({ min: 1, max: 5 }),
          grants: fc.oneof(fc.constant(first.grants), arbWriteGrants),
        }),
        { nil: undefined },
      ),
      inPlace: fc.boolean(),
      promotion: fc.boolean(),
      at: arbInstant,
    })
    .chain(({ existing: e, inPlace, promotion, at }) => {
      const existing: MemoryItem | undefined = e && {
        ...(e.sameClass
          ? ({ ...e.base, class: first.class, content: first.content } as MemoryItem)
          : e.base),
        scope: e.scope,
        owner: e.owner,
        version: e.version,
        grants: e.grants,
      };
      const item: MemoryItem =
        existing && inPlace
          ? {
              ...existing,
              status: first.status,
              version: Math.max(existing.version, first.version),
            }
          : first;
      return fc.record({
        actor: arbActorFor(item, existing ? [existing.scope] : []),
        item: fc.constant(item),
        existing: fc.constant(existing),
        retired: fc
          .constantFrom("none", "same", "other")
          .map(
            (r) =>
              new Map(
                r === "none"
                  ? []
                  : [
                      [
                        r === "same" ? contentHash(item.content) : contentHash("something else"),
                        "x",
                      ],
                    ],
              ),
          ),
        at: fc.constant(at),
        promotion: fc.constant(promotion),
      });
    }),
);

/**
 * The promotion gate's in-place transition of an item carrying grants: the
 * projected item with gate-accepted grants and a user source, rewritten with
 * only its status and version changed, by a member of its scope who is often
 * not its owner. Mixed into the preset writes so the exemption decides often.
 */
const arbInPlaceCase: fc.Arbitrary<WriteCase> = fc
  .tuple(arbWriteCase, fc.array(arbGatedGrant, { minLength: 1, maxLength: 2 }), fc.nat({ max: 1 }))
  .map(([c, grants, bump]) => {
    const from = c.existing ?? c.item;
    const existing: MemoryItem = {
      ...from,
      id: c.item.id,
      grants,
      provenance: { ...from.provenance, kind: "user" },
    };
    return {
      ...c,
      existing,
      item: { ...existing, status: c.item.status, version: existing.version + bump },
      actor: { ...c.actor, memberships: [...new Set([...c.actor.memberships, existing.scope])] },
      promotion: true,
    };
  });

/** The writes the preset properties draw. */
const arbPresetWriteCase: fc.Arbitrary<WriteCase> = fc.oneof(
  { arbitrary: arbWriteCase, weight: 9 },
  { arbitrary: arbInPlaceCase, weight: 1 },
);

/**
 * A generated policy with ttl rules, and in half the draws a duplicate of its
 * first write rule (allowing no source), of its first matrix row (reading
 * every level) and of its first retention rule (a ttl of one second)
 * appended. The evaluator takes the first of each, and so must the export:
 * a duplicate taken would deny a write, admit a read or expire an item the
 * evaluator does not. The coverage guards below require cases decided at a
 * duplicated rule, and the engine refuses an export that repeats a rule id,
 * which would let the last duplicate overwrite the first (review finding
 * E2.12-1).
 */
const arbGeneratedPolicy: fc.Arbitrary<Policy> = fc
  .tuple(arbPolicy, arbTtlRules, fc.boolean(), fc.constantFrom(...FLOORS))
  .map(([policy, retention, dup, floor]) => {
    const p: Policy = { ...policy, retention };
    if (!dup) return p;
    const w = p.write[0];
    const m = p.read.matrix[0];
    const r = p.retention[0];
    return {
      ...p,
      write: w
        ? [
            ...p.write,
            {
              ...w,
              confidence_floor: floor,
              requires_review: !w.requires_review,
              allowed_sources: [],
            },
          ]
        : p.write,
      read: {
        ...p.read,
        matrix: m
          ? [...p.read.matrix, { reader: m.reader, may_read: [...SCOPE_LEVELS] }]
          : p.read.matrix,
      },
      retention: r ? [...p.retention, { ...r, ttl: 1 }] : p.retention,
    };
  });

// ---- the comparison -------------------------------------------------------------

/** Rule ids Cedar names when it denies: the forbids. A read no permit admits is denied with none. */
const READ_FORBIDS = new Set([READ_STATUS_ID, READ_TTL_ID, READ_VALIDITY_ID]);

function checkRead(policy: Policy, decide: (r: CedarRequest) => CedarDecision, c: ReadCase) {
  const engram = evaluateRead(policy, c.actor, c.item, c.at, c.validAt);
  const got = decide(cedarReadRequest(c.actor, c.item, c.at, c.validAt));
  const where = `read: evaluator ${engram.admitted ? "admits" : "excludes"} (${engram.check}, ${engram.policy_id}); Cedar ${got.allow ? "allows" : "denies"} [${got.reasons.join(", ")}]`;
  expect(got.allow, where).toBe(engram.admitted);
  if (engram.admitted || READ_FORBIDS.has(engram.policy_id))
    expect(got.reasons, where).toContain(engram.policy_id);
  // Scope before grant: when a matrix row and a grant both admit, the
  // evaluator names the row (review finding E2.12-2).
  const row = `${policy.id}/read/${c.actor.level}`;
  const both = got.reasons.includes(row) && got.reasons.includes(`${policy.id}/read/grants`);
  if (both) expect(engram.policy_id, where).toBe(row);
  return both ? "scope-and-grant" : engram.check;
}

/**
 * Rules judged per grant (a grant's shape, a grant repeated, a class the item
 * does not have, an expiry at or before the write): the export does not
 * translate them, since Cedar cannot iterate a list (class 1). A write the
 * evaluator decides by one is counted, not compared; the one exception is an
 * untrusted source carrying grants, which the export does translate.
 */
const PER_GRANT_IDS = new Set([WRITE_GRANT_ID, GRANT_UNCHANGED_ID, GRANT_EXPIRED_ID]);
const UNTRUSTED_KINDS = new Set(["model", "compaction", "external"]);
/** The rules evaluateWrite checks before its grant loop. */
const BEFORE_GRANT_LOOP_IDS = [
  WRITE_MEMBERSHIP_ID,
  WRITE_VERSION_ID,
  WRITE_MOVE_ID,
  GRANT_SOURCE_ID,
  GRANT_OWNER_ID,
];

/** The evaluator decided `c` by a per-grant rule the export does not translate. */
function perGrant(policyId: string, c: WriteCase): boolean {
  const untrustedGrants = c.item.grants.length > 0 && UNTRUSTED_KINDS.has(c.item.provenance.kind);
  return PER_GRANT_IDS.has(policyId) && !(policyId === WRITE_GRANT_ID && untrustedGrants);
}

function checkWrite(policy: Policy, decide: (r: CedarRequest) => CedarDecision, c: WriteCase) {
  const options = { promotion: c.promotion ?? false };
  const engram = evaluateWrite(policy, c.actor, c.item, c.existing, c.retired, c.at, options);
  const request = (action: "write" | "write_without_review") =>
    cedarWriteRequest(c.actor, c.item, c.existing, c.retired, action, options);
  const written = decide(request("write"));
  if (perGrant(engram.policy_id, c)) {
    // Excluded from agreement, but not from order (review finding E2.12-6):
    // the evaluator reached the grant loop, so every rule it checks first
    // passed, and Cedar must name none of them among its reasons.
    const where = `excluded write: evaluator ${engram.policy_id}; Cedar [${written.reasons.join(", ")}]`;
    for (const id of BEFORE_GRANT_LOOP_IDS) expect(written.reasons, where).not.toContain(id);
    return `excluded ${engram.policy_id}`;
  }
  const unreviewed = decide(request("write_without_review"));
  const where = `write: evaluator ${engram.decision} (${engram.check}, ${engram.policy_id}); Cedar write ${written.allow ? "allows" : "denies"} [${written.reasons.join(", ")}], without review ${unreviewed.allow ? "allows" : "denies"}`;
  expect(written.allow, where).toBe(engram.decision === "allow");
  expect(unreviewed.allow, where).toBe(engram.decision === "allow" && engram.check === "admit");
  expect(written.reasons, where).toContain(engram.policy_id);
  return engram.check === "grant" ? `grant ${engram.policy_id}` : engram.check;
}

const tally = (seen: Map<string, number>, key: string) => seen.set(key, (seen.get(key) ?? 0) + 1);

// ---- the tests -------------------------------------------------------------------

const presets = PRESETS.map((name) => ({ name, policy: loadPreset(name) }));

/** The class of a read as the coverage guard counts it: the evaluator's check, scope and grant apart. */
function readClass(policy: Policy, c: ReadCase): string {
  const check = evaluateRead(policy, c.actor, c.item, c.at, c.validAt).check;
  return check === "scope" && liveGrants(policy, c.actor, c.item, c.at).length > 0
    ? "scope-and-grant"
    : check;
}

/** The class of a write as checkWrite returns it, computed by the evaluator alone. */
function writeClass(policy: Policy, c: WriteCase): string {
  const engram = evaluateWrite(policy, c.actor, c.item, c.existing, c.retired, c.at, {
    promotion: c.promotion ?? false,
  });
  if (perGrant(engram.policy_id, c)) return `excluded ${engram.policy_id}`;
  return engram.check === "grant" ? `grant ${engram.policy_id}` : engram.check;
}

const readName = (name: string) => `${name}: every generated read is decided alike`;
const writeName = (name: string) => `${name}: every generated write is decided alike`;

describe("the Cedar export agrees with the evaluator on the presets", () => {
  for (const { name, policy } of presets) {
    const decide = engine(exportCedar(policy), `preset-${name}`);
    test(
      readName(name),
      () => {
        fc.assert(
          fc.property(arbReadCase, (c) => {
            checkRead(policy, decide, c);
          }),
          { numRuns: RUNS, seed: seedFor(readName(name)) + SEED_OFFSET },
        );
      },
      TIMEOUT,
    );
    test(
      writeName(name),
      () => {
        fc.assert(
          fc.property(arbPresetWriteCase, (c) => {
            checkWrite(policy, decide, c);
          }),
          { numRuns: RUNS, seed: seedFor(writeName(name)) + SEED_OFFSET },
        );
      },
      TIMEOUT,
    );
  }

  test("the generated requests reach every check the export translates", () => {
    // Coverage guard: a check never reached is a check never compared. It
    // draws the same cases as the properties above, at the same seeds, and
    // classifies them with the evaluator alone, so it runs on its own.
    // Source isolation never decides on a preset: no preset allows a model,
    // compaction or external source outside person scope, so the allowed
    // sources refuse it first; generated policies reach it (below).
    const reads = new Map<string, number>();
    const writes = new Map<string, number>();
    let flattened = 0;
    for (const { name, policy } of presets) {
      const sample = { numRuns: RUNS, seed: seedFor(readName(name)) + SEED_OFFSET };
      for (const c of fc.sample(arbReadCase, sample)) {
        const check = readClass(policy, c);
        tally(reads, check === "scope-and-grant" ? "scope" : check);
        if (check === "scope-and-grant") tally(reads, check);
        // Class 5: reads whose grants the encoder flattened are counted apart.
        if (cedarReadRequest(c.actor, c.item, c.at).context.grant !== undefined) flattened++;
      }
      const writeSample = { numRuns: RUNS, seed: seedFor(writeName(name)) + SEED_OFFSET };
      for (const c of fc.sample(arbPresetWriteCase, writeSample)) {
        const check = writeClass(policy, c);
        tally(writes, check);
        // The promotion gate's in-place transition of a granted item, by
        // someone other than its owner, that the evaluator lets through.
        const context = cedarWriteRequest(c.actor, c.item, c.existing, c.retired, "write", {
          promotion: c.promotion ?? false,
        }).context;
        if (
          context.in_place_promotion === true &&
          (c.existing?.grants.length ?? 0) > 0 &&
          c.actor.id !== c.existing?.owner &&
          (check === "admit" || check === "review")
        )
          tally(writes, "in-place exemption");
      }
    }
    for (const check of [
      "scope",
      "grant",
      "scope-and-grant",
      "excluded",
      "not-active",
      "expired",
      "outside-validity",
    ])
      expect(reads.get(check) ?? 0, `read check ${check}`).toBeGreaterThan(20);
    for (const check of [
      "admit",
      "review",
      "not-member",
      "version",
      "move",
      "forbidden-class",
      "source-not-allowed",
      "below-floor",
      "retired-content",
      `grant ${GRANT_OWNER_ID}`,
      `grant ${GRANT_SOURCE_ID}`,
      `grant ${WRITE_GRANT_ID}`,
      "in-place exemption",
    ])
      expect(
        writes.get(check) ?? 0,
        `write check ${check}: ${JSON.stringify([...writes])}`,
      ).toBeGreaterThan(20);
    expect(flattened).toBeGreaterThan(20);
  });
});

const levelOf = (scope: string) => (scope === "org" ? "org" : scope.split(":")[0]);

/**
 * A preset with a duplicate appended of the write rule of one level (allowing
 * no source, the review flipped, another floor), of the matrix row of one
 * reader (reading every level) and of the retention rule of one level and
 * class (a ttl of one second), with twenty reads and twenty writes. Each
 * duplicate is of the rule that decides one of the cases the preset allows,
 * so that every such case is one a duplicate taken would decide otherwise
 * (review finding E2.12-1).
 */
const arbDuplicated = fc
  .tuple(
    fc.constantFrom(...PRESETS),
    fc.constantFrom(...FLOORS),
    fc.array(arbReadCase, { minLength: 20, maxLength: 20 }),
    fc.array(arbWriteCase, { minLength: 20, maxLength: 20 }),
  )
  .map(([name, floor, reads, writes]) => {
    const preset = loadPreset(name);
    const allowed = writes.find((w) => {
      const d = evaluateWrite(preset, w.actor, w.item, w.existing, w.retired);
      return d.decision === "allow";
    });
    const write = levelOf((allowed ?? (writes[0] as WriteCase)).item.scope);
    const admitted = reads.find(
      (r) => evaluateRead(preset, r.actor, r.item, r.at, r.validAt).check === "scope",
    );
    const keyOf = (r: ReadCase) => `${levelOf(r.item.scope)}/${r.item.class}`;
    const kept =
      preset.retention.find((x) => admitted && `${x.scope}/${x.class}` === keyOf(admitted)) ??
      (preset.retention[0] as Policy["retention"][number]);
    const excluded = reads.find(
      (r) => evaluateRead(preset, r.actor, r.item, r.at, r.validAt).check === "excluded",
    );
    const read = (excluded ?? (reads[0] as ReadCase)).actor.level;
    const rule = preset.write.find((x) => x.scope === write) as Policy["write"][number];
    const row = preset.read.matrix.find(
      (x) => x.reader === read,
    ) as Policy["read"]["matrix"][number];
    const policy: Policy = {
      ...preset,
      write: [
        ...preset.write,
        {
          ...rule,
          allowed_sources: [],
          requires_review: !rule.requires_review,
          confidence_floor: floor,
        },
      ],
      read: {
        ...preset.read,
        matrix: [...preset.read.matrix, { ...row, may_read: [...SCOPE_LEVELS] }],
      },
      retention: [...preset.retention, { ...kept, ttl: 1 }],
    };
    return { policy, write, read, retention: `${kept.scope}/${kept.class}`, reads, writes };
  });

describe("beyond the presets: generated policies", () => {
  const name = "generated policies: every generated read and write is decided alike";
  test(
    name,
    () => {
      const checks = new Map<string, number>();
      fc.assert(
        fc.property(arbGeneratedPolicy, arbReadCase, arbWriteCase, (policy, r, w) => {
          const decide = engine(exportCedar(policy), "generated");
          tally(checks, `read ${checkRead(policy, decide, r)}`);
          tally(checks, `write ${checkWrite(policy, decide, w)}`);
        }),
        { numRuns: GENERATED_RUNS, seed: seedFor(name) + SEED_OFFSET },
      );
      expect(checks.get("write no-rule") ?? 0).toBeGreaterThan(0);
      expect(checks.get("write source-isolation") ?? 0).toBeGreaterThan(0);
      expect(checks.get("read excluded") ?? 0).toBeGreaterThan(0);
      expect(checks.get("write admit") ?? 0).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  const dupName = "presets with duplicated rules: the first of each decides, on both sides";
  test(
    dupName,
    () => {
      const checks = new Map<string, number>();
      fc.assert(
        fc.property(arbDuplicated, ({ policy, write, read, retention, reads, writes }) => {
          const decide = engine(exportCedar(policy), "duplicated");
          for (const r of reads) {
            const check = checkRead(policy, decide, r);
            // Cases a duplicate taken would decide otherwise.
            if (
              `${levelOf(r.item.scope)}/${r.item.class}` === retention &&
              (check === "scope" || check === "scope-and-grant")
            )
              tally(checks, "admitted at a duplicated retention rule");
            if (r.actor.level === read && check === "excluded")
              tally(checks, "excluded at a duplicated matrix row");
          }
          for (const w of writes) {
            const check = checkWrite(policy, decide, w);
            if (levelOf(w.item.scope) === write && (check === "admit" || check === "review"))
              tally(checks, "allowed at a duplicated write rule");
          }
        }),
        { numRuns: DUPLICATED_RUNS, seed: seedFor(dupName) + SEED_OFFSET },
      );
      for (const key of [
        "allowed at a duplicated write rule",
        "admitted at a duplicated retention rule",
        "excluded at a duplicated matrix row",
      ])
        expect(checks.get(key) ?? 0, `${key}: ${JSON.stringify([...checks])}`).toBeGreaterThan(20);
    },
    TIMEOUT,
  );

  test("duplicated write and retention rules: the first decides, on both sides", () => {
    const medium = loadPreset("medium");
    const person = medium.write.find((x) => x.scope === "person");
    if (!person) throw new Error("medium has a person write rule");
    const policy: Policy = {
      ...medium,
      write: [...medium.write, { ...person, allowed_sources: [], requires_review: true }],
      retention: [
        ...medium.retention,
        { scope: "person", class: "semantic", ttl: 1, budget: null, eviction: "recency" },
      ],
    };
    const decide = engine(exportCedar(policy), "duplicates");
    const base = fc.sample(arbItem(), { numRuns: 1, seed: 1 })[0] as MemoryItem;
    const item: MemoryItem = {
      ...base,
      class: "semantic",
      content: "a fact",
      scope: "person:a",
      status: "active",
      confidence: 0.9,
      valid_from: "2026-10-25T12:00:00Z",
      valid_to: null,
      ttl: null,
      grants: [],
      provenance: { ...base.provenance, kind: "user" },
    };
    const actor: Actor = { id: "person:omar", level: "person", memberships: ["person:a"] };
    const at = "2026-10-25T12:00:10Z";
    expect(
      checkWrite(policy, decide, { actor, item, existing: undefined, retired: new Map() }),
    ).toBe("admit");
    expect(checkRead(policy, decide, { actor, item, at, validAt: at })).toBe("scope");
  });
});

describe("the export as text", () => {
  test("validates against its own schema in Cedar's strict mode", () => {
    const policies = [
      ...presets.map((p) => p.policy),
      ...fc.sample(arbGeneratedPolicy, { numRuns: 50, seed: seedFor("validate") }),
    ];
    for (const policy of policies) {
      const exported = exportCedar(policy);
      const answer = cedar.validate({
        schema: exported.schema,
        policies: { staticPolicies: Object.fromEntries(exported.rules.map((r) => [r.id, r.text])) },
        validationSettings: { mode: "strict" },
      });
      expect(answer.type).toBe("success");
      if (answer.type === "success") expect(answer.validationErrors, policy.id).toEqual([]);
    }
  });

  test("the policy set text parses to the same policies, each naming its Engram rule", () => {
    // A policy id with a quote, a backslash and a control character must
    // survive as a Cedar string literal.
    const policy = { ...loadPreset("medium"), id: 'odd "id" \\ with\ta tab\u007f' };
    const exported = exportCedar(policy);
    const parts = cedar.policySetTextToParts(exported.policies);
    expect(parts.type).toBe("success");
    if (parts.type !== "success") return;
    expect(parts.policies).toHaveLength(exported.rules.length);
    const engramIds = parts.policies.map((text) => {
      const json = cedar.policyToJson(text);
      if (json.type !== "success") throw new Error(JSON.stringify(json.errors));
      return json.json.annotations?.engram;
    });
    // The parts come back in Cedar's order, not the text's.
    expect([...engramIds].sort()).toEqual(exported.rules.map((r) => r.engram).sort());
    expect(engramIds).toContain(`${policy.id}/write/person`);
  });

  test("a policy id with line breaks adds no policy (review finding E2.12-4)", () => {
    const ids = [
      "x\npermit (principal, action, resource);\n//",
      "y\r\nforbid (principal, action, resource);",
      "z\u2028permit (principal, action, resource);",
      "w\u2029forbid (principal, action, resource);",
    ];
    for (const id of ids) {
      const exported = exportCedar({ ...loadPreset("strict"), id });
      // Cedar does not end a comment at U+2028 or U+2029, but an editor, a
      // diff or a JavaScript tool does: the text carries neither raw (review
      // finding E2.12-7). Nor any other control character.
      expect(exported.policies, id).not.toMatch(/[\u2028\u2029]/);
      const control = [...exported.policies].filter((ch) => {
        const code = ch.codePointAt(0) as number;
        return code !== 0x0a && (code < 0x20 || (code >= 0x7f && code <= 0x9f));
      });
      expect(control, id).toEqual([]);
      const parts = cedar.policySetTextToParts(exported.policies);
      expect(parts.type, id).toBe("success");
      if (parts.type !== "success") continue;
      expect(parts.policies, id).toHaveLength(exported.rules.length);
      const engramIds = parts.policies.map((text) => {
        const json = cedar.policyToJson(text);
        if (json.type !== "success") throw new Error(JSON.stringify(json.errors));
        return json.json.annotations?.engram;
      });
      expect(engramIds, id).toContain(`${id}/write/person`);
    }
  });

  test("names every rule with an id of its own", () => {
    const policies = [
      ...presets.map((p) => p.policy),
      ...fc.sample(arbGeneratedPolicy, { numRuns: 200, seed: seedFor("unique ids") }),
    ];
    for (const policy of policies) {
      const ids = exportCedar(policy).rules.map((r) => r.id);
      expect(new Set(ids).size, policy.id).toBe(ids.length);
    }
  });

  test("is pure: the same policy exports to the same text", () => {
    for (const { policy } of presets)
      expect(exportCedar(policy)).toEqual(exportCedar(structuredClone(policy)));
  });
});

describe("grants on the write path (review finding E2.12-3)", () => {
  const medium = loadPreset("medium");
  const decide = engine(exportCedar(medium), "write-grants");
  const base = fc.sample(arbItem(), { numRuns: 1, seed: 3 })[0] as MemoryItem;
  const grant: Grant = {
    to: "agent:pi",
    class: "semantic",
    mode: "read",
    expires: "2027-01-01T00:00:00Z",
  };
  const existing: MemoryItem = {
    ...base,
    class: "semantic",
    content: "the owner's text",
    scope: "person:a",
    owner: "person:sara",
    version: 2,
    status: "active",
    confidence: 0.9,
    grants: [grant],
    provenance: { ...base.provenance, kind: "user" },
  };
  const at = "2026-10-25T12:00:00Z";
  const omar: Actor = {
    id: "person:omar",
    level: "person",
    memberships: ["person:a"],
    source: "user",
  };
  const decideBoth = (c: WriteCase, promotion = false) =>
    checkWrite(medium, decide, { ...c, at, promotion });

  test("a co-member rewriting the owner's granted item is denied on both sides", () => {
    const item = { ...existing, content: "another member's text", version: 3 };
    expect(decideBoth({ actor: omar, item, existing, retired: new Map() })).toBe(
      `grant ${GRANT_OWNER_ID}`,
    );
  });

  test("a grant change by an actor neither user- nor import-sourced is denied on both sides", () => {
    const owner: Actor = { ...omar, id: "person:sara", source: "model" };
    const item = { ...existing, grants: [], version: 3 };
    expect(decideBoth({ actor: owner, item, existing, retired: new Map() })).toBe(
      `grant ${GRANT_SOURCE_ID}`,
    );
  });

  test("the promotion gate's in-place transition of a granted item is allowed on both sides", () => {
    const item = { ...existing, version: 3 };
    expect(decideBoth({ actor: omar, item, existing, retired: new Map() }, true)).toBe("admit");
  });

  test("the owner changing the grants, user-sourced, is allowed on both sides", () => {
    const owner: Actor = { ...omar, id: "person:sara" };
    const item = { ...existing, grants: [], version: 3 };
    expect(decideBoth({ actor: owner, item, existing, retired: new Map() })).toBe("admit");
  });
});

describe("the classes the export excludes", () => {
  test("class 3: a policy with a content guard or a trust option on is refused", () => {
    const medium = loadPreset("medium");
    expect(() =>
      exportCedar({ ...medium, content_guards: { injection_screen: "default" } }),
    ).toThrow(CedarExportError);
    expect(() => exportCedar({ ...medium, trust: { protect_trusted: "on" } })).toThrow(
      /trust\.protect_trusted/,
    );
    // Off is no guard: exported as the policy without the block.
    const off = exportCedar({
      ...medium,
      content_guards: { secrets: "off", injection_screen: "off" },
      trust: { unattested_floor: "off" },
    });
    expect(off.policies).toBe(exportCedar(medium).policies);
  });

  test("class 4: an instant finer than a nanosecond is refused, a nanosecond is carried", () => {
    expect(() => cedarInstant("2026-10-25T12:00:00.0000000001Z")).toThrow(CedarExportError);
    expect(() => cedarInstant("not a time")).toThrow(CedarExportError);
    // Not a calendar instant: refused, never encoded as NaN or as another day
    // (review finding E2.12-5).
    expect(() => cedarInstant("2026-13-01T00:00:00Z")).toThrow(CedarExportError);
    expect(() => cedarInstant("2026-02-30T00:00:00Z")).toThrow(CedarExportError);
    expect(() => cedarInstant("2026-10-25T24:00:00Z")).toThrow(CedarExportError);
    expect(cedarInstant("2026-10-25T12:00:00.000000001000Z")).toEqual({ s: 1792929600, ns: 1 });
    expect(cedarInstant("1969-12-31T23:59:59.5Z")).toEqual({ s: -1, ns: 500_000_000 });
  });

  test("a confidence's bits order as the numbers do, -0 as 0", () => {
    expect(confidenceBits(-0)).toEqual(confidenceBits(0));
    const xs = [0, 5e-324, 0.1, 0.3, nextDown(0.5), 0.5, nextUp(0.5), 0.9, 1];
    const key = (x: number) => {
      const { hi, lo } = confidenceBits(x);
      return (BigInt(hi) << 32n) | BigInt(lo);
    };
    for (let i = 1; i < xs.length; i++)
      expect(key(xs[i] as number)).toBeGreaterThan(key(xs[i - 1] as number));
  });

  test("class 5: the flattened grant carries the latest expiry, or none when one never expires", () => {
    const item = fc.sample(arbReadItem, { numRuns: 1, seed: 1 })[0] as MemoryItem;
    const actor = { id: "agent:pi", level: "org" as const, memberships: [] };
    const g = (expires?: string, cls?: MemoryItem["class"]): Grant => ({
      to: "agent:*",
      mode: "read",
      ...(cls ? { class: cls } : {}),
      ...(expires ? { expires } : {}),
    });
    const at = "2026-10-25T12:00:00Z";
    const other = CLASSES.find((c) => c !== item.class) as MemoryItem["class"];
    const ctx = (grants: Grant[]) => cedarReadRequest(actor, { ...item, grants }, at).context.grant;
    expect(ctx([])).toBeUndefined();
    expect(ctx([g("2027-01-01T00:00:00Z", other)])).toBeUndefined();
    expect(ctx([{ ...g(), to: "person:*" }])).toBeUndefined();
    expect(ctx([g("2026-10-25T12:00:00.5Z"), g("2026-10-25T12:00:00.25Z")])).toEqual({
      expires: { s: 1792929600, ns: 500_000_000 },
    });
    expect(ctx([g("2026-10-25T12:00:00.25Z"), g("2026-10-25T12:00:00.5Z")])).toEqual({
      expires: { s: 1792929600, ns: 500_000_000 },
    });
    expect(ctx([g("2026-10-25T12:00:01Z"), g("2026-10-25T12:00:00.5Z")])).toEqual({
      expires: { s: 1792929601, ns: 0 },
    });
    expect(ctx([g("2026-10-25T12:00:00Z"), g(undefined, item.class)])).toEqual({});
  });
});
