// The local natural-language-inference tier of the contradiction lint (card
// L7, arm P3 of the pre-registration's proposed amendments, not registered).
// A small NLI cross-encoder scores each candidate pair the contradiction lint
// would send to its model (contradictionPairs, card L3), and the policy's two
// thresholds split the pairs into three bands:
//
//   flag   contradiction score at or above `contradiction-nli.upper`: a
//          finding of lint `contradiction-nli` on the later item, naming the
//          earlier, as the model lint's finding would; no model call
//   drop   below `contradiction-nli.lower`: no finding and no model call
//   model  between them: the pair goes on to the model contradiction lint,
//          exactly the request it would have sent without the tier
//
// A pair's score is the larger of the two directions' contradiction
// probabilities (premise A and hypothesis B, then B and A): an NLI model is
// not symmetric, and a contradiction either way is one. Core defines the
// scorer's shape and never runs one (AGENTS.md rule 4): the scorer is an
// injected function with the shape of ModelCall, built outside core
// (packages/model/src/nli.ts) on a pinned model behind a cache. The tier runs
// only when the policy lists `contradiction-nli` and the plane was built with
// a scorer (PlaneDeps.lintNli); no registered preset or profile lists it.
import { canonicalJson } from "../model.ts";
import type { MemoryItem, Policy } from "../schema.ts";
import type { DetFinding, LintContext } from "./det.ts";
import { contradictionPairs } from "./model.ts";

/** The tier's lint id, which a policy's `lints.enabled` lists to turn it on. */
export const NLI_LINT_ID = "contradiction-nli";

/** The threshold keys of the tier's two bands. */
export const NLI_UPPER_KEY = "contradiction-nli.upper";
export const NLI_LOWER_KEY = "contradiction-nli.lower";

/** One premise and hypothesis to score, and the scorer's model. */
export interface NliRequest {
  /** The pinned model, as `<repository>@<revision>`; the scorer refuses another. */
  model: string;
  premise: string;
  hypothesis: string;
}

/** The scorer's three probabilities for one request; they sum to one. */
export interface NliResponse {
  contradiction: number;
  entailment: number;
  neutral: number;
}

/** The scorer: the shape of ModelCall, injected at the boundary. */
export type NliScore = (request: NliRequest) => Promise<NliResponse>;

/** What the tier runs with: the injected scorer and the model it names. */
export interface NliLintSetup {
  score: NliScore;
  model: string;
}

export type NliBand = "flag" | "model" | "drop";

/** One pair the tier scored, and the band it fell in. */
export interface NliJudgment {
  /** `contradiction:<earlier id>+<later id>`, the model lint's unit for the same pair. */
  unit: string;
  /** The later item, which a flag lands on. */
  item_id: string;
  /** The earlier item. */
  other_id: string;
  /** Premise the earlier item, hypothesis the later. */
  forward: NliResponse;
  /** Premise the later item, hypothesis the earlier. */
  backward: NliResponse;
  /** The larger contradiction probability of the two directions. */
  contradiction: number;
  band: NliBand;
}

export interface NliThresholds {
  upper: number;
  lower: number;
}

/**
 * What is wrong with the tier's thresholds in `thresholds`, for a policy that
 * enables the tier: both keys set, each in [0, 1], the lower not above the
 * upper. Empty when they are sound.
 */
export function nliThresholdProblems(thresholds: Readonly<Record<string, number>>): string[] {
  const out: string[] = [];
  const upper = thresholds[NLI_UPPER_KEY];
  const lower = thresholds[NLI_LOWER_KEY];
  for (const [key, value] of [
    [NLI_UPPER_KEY, upper],
    [NLI_LOWER_KEY, lower],
  ] as const) {
    if (value === undefined)
      out.push(`${NLI_LINT_ID} is enabled but lints.thresholds sets no ${key}`);
    else if (!Number.isFinite(value) || value < 0 || value > 1)
      out.push(`${key} is ${value}; it must be between 0 and 1`);
  }
  if (out.length === 0 && (lower as number) > (upper as number))
    out.push(`${NLI_LOWER_KEY} (${lower}) is above ${NLI_UPPER_KEY} (${upper})`);
  return out;
}

/** The policy's thresholds for the tier; throws when they are missing or unsound. */
export function nliThresholds(policy: Policy): NliThresholds {
  const problems = nliThresholdProblems(policy.lints.thresholds);
  if (problems.length > 0) throw new Error(`policy ${policy.id}: ${problems.join("; ")}`);
  return {
    upper: policy.lints.thresholds[NLI_UPPER_KEY] as number,
    lower: policy.lints.thresholds[NLI_LOWER_KEY] as number,
  };
}

/** The band a pair's contradiction score falls in. */
export function nliBand(contradiction: number, t: NliThresholds): NliBand {
  if (contradiction >= t.upper) return "flag";
  if (contradiction < t.lower) return "drop";
  return "model";
}

/** An item's text as the tier sends it: a string as it is, structured content as canonical JSON. */
export const nliText = (item: MemoryItem): string =>
  typeof item.content === "string" ? item.content : canonicalJson(item.content);

/** The fixed decimals a score is shown with in a finding's evidence. */
const shown = (x: number) => x.toFixed(4);

function checked(response: NliResponse, request: NliRequest): NliResponse {
  const values = [response.contradiction, response.entailment, response.neutral];
  if (values.some((v) => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1))
    throw new Error(
      `the NLI scorer ${request.model} returned ${JSON.stringify(response)}; each probability must be between 0 and 1`,
    );
  return response;
}

/**
 * The tier over `scope`: every contradiction pair scored in both directions,
 * one request at a time in pair order, and banded by `thresholds`. Returns a
 * finding per flagged pair, a judgment per pair, and the units of the band
 * that goes on to the model lint. A scorer that fails rejects the whole run.
 */
export async function runNliTier(
  ctx: LintContext,
  scope: string,
  setup: NliLintSetup,
  thresholds: NliThresholds,
): Promise<{ findings: DetFinding[]; judgments: NliJudgment[]; band: Set<string> }> {
  const findings: DetFinding[] = [];
  const judgments: NliJudgment[] = [];
  const band = new Set<string>();
  for (const [a, b] of contradictionPairs(ctx, scope)) {
    const ask = async (premise: MemoryItem, hypothesis: MemoryItem) => {
      const request: NliRequest = {
        model: setup.model,
        premise: nliText(premise),
        hypothesis: nliText(hypothesis),
      };
      return checked(await setup.score(request), request);
    };
    const forward = await ask(a, b);
    const backward = await ask(b, a);
    const contradiction = Math.max(forward.contradiction, backward.contradiction);
    const unit = `contradiction:${a.id}+${b.id}`;
    const judged = nliBand(contradiction, thresholds);
    judgments.push({
      unit,
      item_id: b.id,
      other_id: a.id,
      forward,
      backward,
      contradiction,
      band: judged,
    });
    if (judged === "model") band.add(unit);
    if (judged === "flag")
      findings.push({
        lint_id: NLI_LINT_ID,
        item_id: b.id,
        severity: "warn",
        message: `it contradicts ${a.id}, an earlier active semantic item in ${scope}, as ${setup.model} scored it`,
        evidence: [
          `contradicts ${a.id}`,
          `nli ${setup.model}`,
          `contradiction ${shown(contradiction)}, at or above ${NLI_UPPER_KEY} ${thresholds.upper}`,
        ],
      });
  }
  return { findings, judgments, band };
}
