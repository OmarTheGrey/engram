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
