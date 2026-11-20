// The pre-tag live checks (card RV6, design review RV-DES-9): the B1
// reference config's items, drawn by a rule with no randomness, and C1's
// prompt size per GateMem checkpoint, which research/scripts/h1_check_runs_cost.py
// prices. No model is called.
import type { gatemem } from "@engram/bench";
import { longContextPrompt, probeInputs } from "../gatemem-probe.ts";

/** GateMem's checkpoint kinds, in the order the B1 subset takes them. */
export const B1_KINDS = ["utility", "privacy", "safety"] as const;

/**
 * B1's reference subset of one domain: for each kind, `perKind` checkpoints
 * spread evenly over the domain's checkpoints of that kind in file order
 * (the j-th of k at index floor((j + 1/2) n / k) of the n), so every part of
 * the domain's episodes is in it; then in the data's own order. A
 * systematic draw, so no seed: rerun on the pinned data it gives the same ids.
 */
export function b1ReferenceItems(
  domains: readonly gatemem.Domain[],
  domain: string,
  perKind: number,
): { items: string[]; kinds: Record<string, number>; available: Record<string, number> } {
  const found = domains.find((d) => d.domain === domain);
  if (!found) throw new Error(`no GateMem domain ${domain} in the data`);
  const order = found.checkpoints.map((c) => c.checkpoint_id);
  const chosen = new Set<string>();
  const kinds: Record<string, number> = {};
  const available: Record<string, number> = {};
  for (const kind of B1_KINDS) {
    const ofKind = found.checkpoints.filter((c) => c.query_type === kind);
    available[kind] = ofKind.length;
    if (ofKind.length < perKind) {
      throw new Error(
        `${domain} holds ${ofKind.length} ${kind} checkpoints, fewer than ${perKind}`,
      );
    }
    for (let j = 0; j < perKind; j++) {
      const at = Math.floor(((j + 0.5) * ofKind.length) / perKind);
      chosen.add((ofKind[at] as gatemem.Checkpoint).checkpoint_id);
    }
    kinds[kind] = perKind;
  }
  return { items: order.filter((id) => chosen.has(id)), kinds, available };
}

/** C1's prompt per checkpoint: the characters of its system and user prompt, and its kind. */
export function c1PromptChars(
  domains: readonly gatemem.Domain[],
  items: readonly string[],
): { checkpoint_id: string; kind: string; chars: number }[] {
  return items.map((id) => {
    const domain = domains.find((d) => d.checkpoints.some((c) => c.checkpoint_id === id));
    if (!domain) throw new Error(`no GateMem checkpoint ${id} in the data`);
    let n = 0;
    const { checkpoint, mapped } = probeInputs(domain, id, () => `t${n++}`);
    const { system, user } = longContextPrompt(mapped);
    return { checkpoint_id: id, kind: checkpoint.query_type, chars: system.length + user.length };
  });
}

/** 1.96, the two-sided 95 percent normal quantile. */
const Z95 = 1.959963984540054;

/** Wilson's score interval for `k` of `n` (it stays inside [0, 1] and is not empty at 0 or n). */
export function wilson(k: number, n: number, z = Z95): [number, number] {
  const p = k / n;
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  // At 0 and n the bound on that side is exactly 0 or 1; rounding must not move it.
  return [k === 0 ? 0 : Math.max(0, centre - half), k === n ? 1 : Math.min(1, centre + half)];
}

/**
 * The paper's Medical, GPT-5.4, Long-Context row (GateMem Table 3, as
 * docs/readings/litreview/2606.18829-gatemem.md records it), each rate
 * over the pinned Medical domain's checkpoints of its kind (210 utility,
 * 192 access, 177 forgetting): the counts the published rates round from.
 */
export const B1_PAPER = [
  { kind: "utility", metric: "U", rate: 0.914, n: 210 },
  { kind: "privacy", metric: "A", rate: 0.104, n: 192 },
  { kind: "safety", metric: "F", rate: 0.023, n: 177 },
] as const;

/**
 * B1's acceptance band (review P60-9): for each metric, the counts k of `n`
 * replicated checkpoints whose rate k/n passes, which is when Newcombe's
 * hybrid score interval (Wilson's interval on each side) for the difference
 * between the replicated rate and the paper's, at 95 percent, reaches within
 * `margin` of zero. So the band carries both samples' error, the paper's
 * included, and Wilson's interval keeps it honest at a small rate (F).
 */
export function b1Band(options: { n: number; margin: number }) {
  return B1_PAPER.map(({ kind, metric, rate, n: paperN }) => {
    const count = Math.round(rate * paperN);
    const p2 = count / paperN;
    const [l2, u2] = wilson(count, paperN);
    const passes: number[] = [];
    for (let k = 0; k <= options.n; k++) {
      const p1 = k / options.n;
      const [l1, u1] = wilson(k, options.n);
      const d = p1 - p2;
      const lower = d - Math.sqrt((p1 - l1) ** 2 + (u2 - p2) ** 2);
      const upper = d + Math.sqrt((u1 - p1) ** 2 + (p2 - l2) ** 2);
      if (lower <= options.margin && upper >= -options.margin) passes.push(k);
    }
    const min = Math.min(...passes);
    const max = Math.max(...passes);
    return {
      kind,
      metric,
      paper: { rate, count, n: paperN },
      accept: { min, max, of: options.n, rates: [min / options.n, max / options.n] },
    };
  });
}
