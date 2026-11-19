// The labels of the seeded-fault set (card L2): which injected item is a
// fault, of which class, which lint or lints of each tier are expected to
// find it, and whether what makes it faulty is keyed, that is recorded in a
// field the plane keeps (validity, class and scope, provenance, a source's
// hash) rather than only in the text of items (H3 reports the two apart:
// docs/research/preregistration.md, docs/readings/litreview/sota-2026.md).
//
// Labels live beside the memory state, never in it: no label reaches a write,
// an item, a read or a prompt (generate.ts).
import type { DeterministicLintId, MODEL_LINT_IDS } from "@engram/core";
import { z } from "zod";

/** The four fault classes, in the plan's order (docs/tasks/key-free-work-plan.md, PR 1). */
export const FAULT_CLASSES = ["stale", "contradictory", "misplaced", "unsupported"] as const;
export type FaultClass = (typeof FAULT_CLASSES)[number];

export type ModelLintId = (typeof MODEL_LINT_IDS)[number];

export interface SubtypeSpec {
  class: FaultClass;
  /** Whether what makes the item faulty is in a field the plane records, not only in item text. */
  keyed: boolean;
  /** The lints expected to find a fault of this subtype, by tier; empty when no lint is built for it. */
  lints: { deterministic: DeterministicLintId[]; model: ModelLintId[] };
  /** What a fault of this subtype is, and what its near-miss is. */
  fault: string;
  nearMiss: string;
}

/**
 * Every subtype the generator injects, in the order it injects them. Each is
 * one way an item is faulty in its class; each fault has a near-miss of the
 * same shape that is not faulty, so a lint that flags both is not precise.
 */
export const SUBTYPES = {
  "expired-validity": {
    class: "stale",
    keyed: true,
    lints: { deterministic: ["expired-validity"], model: [] },
    fault: "an active semantic statement bounded in time whose valid_to is before the lint time",
    nearMiss: "the same, with valid_to thirty days after the lint time",
  },
  "source-changed": {
    class: "stale",
    keyed: true,
    lints: { deterministic: ["source-changed"], model: [] },
    fault:
      "a model note quoting a user turn, whose turn was later rewritten with a sentence added, so its recorded hash no longer matches",
    nearMiss:
      "the same, with the turn rewritten in whitespace only, which the strict hash collapses",
  },
  superseded: {
    class: "stale",
    keyed: false,
    lints: { deterministic: [], model: ["contradiction"] },
    fault:
      "an active statement that a later active update of the same attribute supersedes in its text only, with no valid_to",
    nearMiss: "the same statement, with a later update saying the value is unchanged",
  },
  conflict: {
    class: "contradictory",
    keyed: false,
    lints: { deterministic: [], model: ["contradiction"] },
    fault:
      "an active restatement giving another value of the attribute an active statement gave at the same moment",
    nearMiss: "the same restatement, giving the same value",
  },
  "forbidden-class": {
    class: "misplaced",
    keyed: true,
    lints: { deterministic: ["scope-class-mismatch"], model: [] },
    fault:
      "an episodic work statement in the role scope, written before the policy forbade episodic items there",
    nearMiss: "the same statement as a semantic item, which the role scope still allows",
  },
  "wrong-scope": {
    class: "misplaced",
    keyed: false,
    lints: { deterministic: [], model: [] },
    fault:
      "a semantic statement about the user's own life in the role scope, which is for work; no lint of either tier is built to find it",
    nearMiss: "a semantic work statement in the role scope",
  },
  "missing-provenance": {
    class: "unsupported",
    keyed: true,
    lints: { deterministic: ["missing-provenance"], model: [] },
    fault: "a model note quoting a user turn whose provenance names no model",
    nearMiss: "the same, naming its model",
  },
  orphan: {
    class: "unsupported",
    keyed: true,
    lints: { deterministic: ["orphan"], model: [] },
    fault:
      "a model note whose provenance ref names a user aside that its own ttl retired by the next retention sweep",
    nearMiss: "the same, whose aside's ttl runs past the lint time, so it is still active",
  },
  "unsupported-claim": {
    class: "unsupported",
    keyed: false,
    lints: { deterministic: [], model: ["unsupported-claim"] },
    fault:
      "a model note with complete provenance naming a user aside, stating a value of another attribute the aside never mentions",
    nearMiss: "the same, stating the aside's own attribute and value",
  },
} as const satisfies Record<string, SubtypeSpec>;
export type Subtype = keyof typeof SUBTYPES;
export const SUBTYPE_IDS = Object.keys(SUBTYPES) as Subtype[];

const Lints = z.strictObject({
  deterministic: z.array(z.string().min(1)),
  model: z.array(z.string().min(1)),
});

/**
 * One label: an injected item that is a fault or a near-miss. `expected` are
 * the lints expected to flag it (a fault's subtype lints; empty for a
 * near-miss); `near_miss_of` are the lints it must not trigger (a near-miss's
 * subtype lints; empty for a fault). `related` are the other items the label
 * is about: the counterpart of a contradiction or supersession, the source a
 * note cites, or the turn a rewrite changed. `finding_on` is the item a
 * finding of those lints lands on: the labelled item, except for a pair the
 * contradiction lint judges, where card L3 flags the later item of the pair
 * by id (packages/core/src/lint/model.ts on branch l3-model-lints), naming the
 * earlier. A conflict's restatement is written after its first statement, so
 * it is the later and is flagged itself; a superseded statement is the
 * earlier of its pair, so the finding lands on the later update, with the
 * superseded statement as its evidence.
 */
export const FaultLabel = z.strictObject({
  question_id: z.string().min(1),
  item_id: z.string().min(1),
  scope: z.string().min(1),
  kind: z.enum(["fault", "near-miss"]),
  class: z.enum(FAULT_CLASSES),
  subtype: z.enum(SUBTYPE_IDS as [Subtype, ...Subtype[]]),
  keyed: z.boolean(),
  expected: Lints,
  near_miss_of: Lints,
  related: z.array(z.string().min(1)),
  finding_on: z.string().min(1),
});
export type FaultLabel = z.infer<typeof FaultLabel>;

const none = () => ({ deterministic: [] as string[], model: [] as string[] });
const lintsOf = (s: Subtype) => ({
  deterministic: [...SUBTYPES[s].lints.deterministic] as string[],
  model: [...SUBTYPES[s].lints.model] as string[],
});

/** The label of one injected item. */
export function label(
  question_id: string,
  subtype: Subtype,
  kind: FaultLabel["kind"],
  item: { id: string; scope: string },
  related: string[],
): FaultLabel {
  const spec = SUBTYPES[subtype];
  const pairwise = (spec.lints.model as readonly string[]).includes("contradiction");
  if (pairwise && related.length !== 1)
    throw new Error(`label: a ${subtype} label names one counterpart, not ${related.length}`);
  const later = pairwise && (related[0] as string) > item.id ? (related[0] as string) : item.id;
  return {
    question_id,
    item_id: item.id,
    scope: item.scope,
    kind,
    class: spec.class,
    subtype,
    keyed: spec.keyed,
    expected: kind === "fault" ? lintsOf(subtype) : none(),
    near_miss_of: kind === "near-miss" ? lintsOf(subtype) : none(),
    related,
    finding_on: later,
  };
}
