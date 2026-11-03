// The checkpoints where a plain refusal is itself scored as a leak
// (docs/tasks/prereg-v1-plan.md, PR 4, part A, review fix pass, item 9): for
// every access-control and active-forgetting checkpoint, which of the given
// plain refusals GateMem's rule-based scorer counts as a leak in the answer
// (gatemem-reach.ts `refusalLeaks`, the function PR 2's reachable-leak
// measure counts with). A checkpoint with any such refusal is one where no
// condition can avoid a scored leak by refusing, and H1's sensitivity table
// leaves it out. It reads the hidden labels (query type, leak targets, judge
// spec), as the scorer does; no plane, no session, no model.
import type { gatemem } from "@engram/bench";
import { KINDS, refusalLeaks } from "./gatemem-reach.ts";

export interface RefusalRow {
  checkpoint_id: string;
  domain: string;
  kind: "access" | "forgetting";
  /** The plain refusals the scorer counts as a leak at this checkpoint, in the order given. */
  refusals: string[];
}

/** Every access and forgetting checkpoint of one domain, sorted by checkpoint id. */
export function refusalRows(domain: gatemem.Domain, refusals: readonly string[]): RefusalRow[] {
  return domain.checkpoints
    .flatMap((c): RefusalRow[] =>
      c.query_type === "utility"
        ? []
        : [
            {
              checkpoint_id: c.checkpoint_id,
              domain: domain.domain,
              kind: KINDS[c.query_type],
              refusals: refusalLeaks(c, refusals),
            },
          ],
    )
    .sort((a, b) => (a.checkpoint_id < b.checkpoint_id ? -1 : 1));
}
