// Whether a content-guard rule is admitted to the table (card E2.9, ADR 0039
// decision 6; the review fix pass, E2.9-1 and E2.9-9). JavaScript's engine
// backtracks where gitleaks' RE2 does not, so a rule linear upstream can be
// quadratic here, and a linear rule can still cost far more per character
// than the rest. A rule is timed on the adversarial inputs of
// src/policy/backtracking.ts and admitted when both hold:
//
// - Growth. On each input, its time at 4n over its time at n stays under
//   GROWTH_LIMIT: a linear rule grows about 4 times, a quadratic one 16. An
//   input whose time at 4n is under FLOOR_MS is not judged, since a rule that
//   fast at 4n is harmless at the scan limit even if it is quadratic (at
//   n = 16,384, 4n is SCAN_LIMIT). A ratio over the limit is measured again
//   from 4n to 16n, and the rule is refused only when that ratio is over the
//   limit too, so one slow measurement on a busy machine refuses nothing.
// - Cost. Its time summed over the inputs at 4n is at most COST_LIMIT times
//   that of reference(), gitleaks' usual keyword prefix, on the same inputs at
//   the same moment. A slow linear rule (a doubled lazy prefix) is refused.
//
// Both are ratios of two timings taken on one machine at one moment, so the
// verdict does not depend on how fast the machine is. This file reads the
// clock and so stays out of src/: core reads no clock.
import { adversarialInputs } from "../src/policy/backtracking.ts";

export const GROWTH_LIMIT = 6;
export const COST_LIMIT = 20;
export const FLOOR_MS = 1;
/** gitleaks' usual keyword prefix, with the rule's first keyword (or `key`): the cost a rule is compared with. */
export function reference(keywords: readonly string[]): RegExp {
  const word = (keywords[0] ?? "key").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`[\\w.-]{0,50}?(?:${word})(?:[ \\t\\w.-]{0,20})[\\s'"]{0,3}(?:=|:)`, "gi");
}

/** The fastest of `runs` complete matchAll passes of `re` over `input`, in milliseconds. */
export function timed(re: RegExp, input: string, runs = 3): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    for (const _ of input.matchAll(re)) {
      // every match, as the scan takes them
    }
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

export type Admission = { admitted: true } | { admitted: false; why: string };

const tooCostly: Admission = {
  admitted: false,
  why: `it costs over ${COST_LIMIT} times gitleaks' usual keyword prefix on the same inputs`,
};

/** Whether the rule (its source, flags and keywords) is admitted, on inputs of n and 4n. */
export function admission(
  source: string,
  flags: string,
  keywords: readonly string[],
  n = 4096,
): Admission {
  const re = new RegExp(source, flags.includes("g") ? flags : `${flags}g`);
  const ref = reference(keywords);
  const small = adversarialInputs(keywords, n);
  const large = adversarialInputs(keywords, 4 * n);
  let cost = 0;
  let refCost = 0;
  for (const [i, input] of small.entries()) {
    timed(re, input.slice(0, 256), 1);
    const t1 = timed(re, input);
    const t4 = timed(re, large[i] as string);
    cost += t4;
    refCost += timed(ref, large[i] as string, 1);
    // A rule already three times over the cost limit is refused at once, so a
    // slow rule's admission does not take as long as its every input would;
    // otherwise the limit is judged on the sums over every input, below.
    if (cost >= FLOOR_MS * (i + 1) && cost > 3 * COST_LIMIT * refCost) return tooCostly;
    if (t4 < FLOOR_MS || t4 / Math.max(t1, 0.01) < GROWTH_LIMIT) continue;
    const t16 = timed(re, adversarialInputs(keywords, 16 * n)[i] as string, 1);
    if (t16 / t4 >= GROWTH_LIMIT)
      return {
        admitted: false,
        why: `it grows faster than linearly (over ${GROWTH_LIMIT} times from n to 4n, and again from 4n to 16n)`,
      };
  }
  if (cost >= FLOOR_MS * small.length && cost > COST_LIMIT * refCost) return tooCostly;
  return { admitted: true };
}
