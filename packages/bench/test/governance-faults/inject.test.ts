// Card X18: the paired fault-injection check (proposal U6) over the vendored
// LongMemEval subset, each base built as card B5 builds it, through the real
// Plane on the fake store. No model: the lints are the deterministic tier.
import { describe, expect, test } from "vitest";
import {
  type BaseOutcome,
  checkBase,
  DETECTING_LINT,
  OPERATORS,
  PLACES,
  READ_LIMIT,
} from "../../src/governance-faults/inject.ts";
import { visibleQuestion } from "../../src/longmemeval/strip.ts";
import { questions } from "../longmemeval/fixture.ts";

const SEED = 11;
const views = questions.map(visibleQuestion);

let cached: BaseOutcome[] | undefined;
async function outcomes(): Promise<BaseOutcome[]> {
  cached ??= await Promise.all(views.map((v) => checkBase(v, { seed: SEED })));
  return cached;
}
const pairs = async () => (await outcomes()).flatMap((b) => b.pairs);

describe("the paired fault-injection check", () => {
  test("every base has one pair per operator and place, in order", async () => {
    for (const base of await outcomes()) {
      expect(base.pairs.map((p) => [p.operator, p.place])).toEqual(
        OPERATORS.flatMap((o) => PLACES.map((p) => [o, p])),
      );
      expect(base.clean_read).toBeLessThanOrEqual(READ_LIMIT);
    }
  });

  test("an unedited copy of the clean log verifies unbroken and reads as the clean state", async () => {
    for (const base of await outcomes()) {
      expect(base.control.verify).not.toBe("FAILED");
      expect(base.control.reads_equal_clean).toBe(true);
    }
  });

  test("the governed close takes the superseded item out of the clean read", async () => {
    for (const base of await outcomes()) {
      if (base.b5_read === 0) continue;
      const close = base.pairs.find((p) => p.operator === "temporal-supersession");
      expect(close?.targeted).toBe(true);
      expect(base.clean_read).toBeLessThanOrEqual(base.b5_read);
    }
  });

  test("a projection fault is recovered by replay, every time: the replay property", async () => {
    const projection = (await pairs()).filter((p) => p.place === "projection" && p.targeted);
    expect(projection.length).toBeGreaterThan(0);
    for (const p of projection) expect(p.enforced_equals_clean).toBe(true);
  });

  test("verifyChain fails on every log fault and on no projection fault", async () => {
    for (const p of (await pairs()).filter((x) => x.targeted)) {
      if (p.place === "log") {
        expect(p.verify).toBe("FAILED");
        expect(p.verify_check).not.toBeNull();
      } else {
        expect(p.verify).not.toBe("FAILED");
        expect(p.verify_check).toBeNull();
      }
    }
  });

  test("a deletion or a supersession changes the read, at both places", async () => {
    const moved = (await pairs()).filter(
      (p) => p.targeted && (p.operator === "deletion" || p.operator === "temporal-supersession"),
    );
    expect(moved.length).toBeGreaterThan(0);
    for (const p of moved) expect(p.changed).toBe(true);
  });

  test("the lints do not repair a log fault: its enforced read is its corrupted read", async () => {
    for (const p of (await pairs()).filter((x) => x.place === "log" && x.changed))
      expect(p.enforced_equals_clean).toBe(false);
  });

  test("a blank provenance ref leaves the read alone and the missing-provenance lint finds it", async () => {
    const meta = (await pairs()).filter((p) => p.operator === "missing-metadata" && p.targeted);
    expect(meta.length).toBeGreaterThan(0);
    for (const p of meta) {
      expect(p.changed).toBe(false);
      expect(p.lint_detected).toBe(true);
      expect(p.new_lint_ids).toContain(DETECTING_LINT["missing-metadata"]);
    }
  });

  test("no deletion and no supersession is detected by a lint on B5's state", async () => {
    for (const p of (await pairs()).filter((x) => x.operator !== "missing-metadata"))
      expect(p.lint_detected).toBe(false);
  });

  test("a base's pairs depend only on the seed and its question", async () => {
    const view = views[1] as (typeof views)[number];
    const again = await checkBase(view, { seed: SEED });
    expect(JSON.stringify(again)).toBe(JSON.stringify((await outcomes())[1]));
    const other = await checkBase(view, { seed: SEED + 1 });
    expect(other.pairs.map((p) => p.target)).not.toEqual(again.pairs.map((p) => p.target));
  });
});
