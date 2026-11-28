// The policy options nothing builds yet (card E2.14 of the second absorb
// plan, ADR 0002's decision D2), and the one check every reader of a policy
// applies. The loader (policy/load.ts) refuses a document that sets one, at
// its line; a reader handed an already-parsed policy object (Plane.simulate's
// candidate, which the HTTP simulate route takes from a request body, and
// exportCedar) refuses it through `notBuiltOptions`, so no path runs or
// exports an option the plane would silently ignore. Pure: no I/O.
import type { Policy } from "../schema.ts";

/**
 * Each option with the card that builds it. Absent is the only value
 * accepted until then: every present value is refused, `off` too, and an
 * empty container (`procedures: {}`) holds every option absent. Each card
 * deletes its own row when it lands, with a loader test.
 */
export const NOT_BUILT_YET: readonly { path: readonly string[]; card: string }[] = [
  { path: ["procedures", "safety_scan"], card: "D5" },
  { path: ["procedures", "drift"], card: "D4" },
  { path: ["consent"], card: "E9.12" },
  { path: ["erasure", "mode"], card: "E9.13" },
  { path: ["approval"], card: "E2.19" },
  { path: ["grants", "expiry_cap"], card: "E2.21" },
];

/** One option a policy sets that nothing builds yet. */
export interface NotBuiltOption {
  path: string[];
  card: string;
  message: string;
}

/** The options `policy` sets that nothing builds yet, in NOT_BUILT_YET's order; empty when none. */
export function notBuiltOptions(policy: Policy): NotBuiltOption[] {
  const out: NotBuiltOption[] = [];
  for (const { path, card } of NOT_BUILT_YET) {
    const value = path.reduce<unknown>(
      (node, seg) =>
        node !== null && typeof node === "object"
          ? (node as Record<string, unknown>)[seg]
          : undefined,
      policy,
    );
    if (value === undefined) continue;
    out.push({
      path: [...path],
      card,
      message: `${path.join(".")} is not built yet: card ${card} builds it; until then leave it out (absent is today's behaviour)`,
    });
  }
  return out;
}
