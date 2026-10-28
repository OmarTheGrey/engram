// The conformance suite tested on itself (review finding R4-1). Each broken
// adapter in broken.ts must fail the very cases it names, and the honest fake
// must pass every case, so a weakened case or corpus item shows up here even
// when some incidental case still fails. The broken adapters are run through
// `runCases`, outside the conformance registry.
import { describe, expect, test } from "vitest";
import { createFakeAdapter } from "../../src/fake/index.ts";
import { BROKEN_ADAPTERS } from "./broken.ts";
import { runCases } from "./suite.ts";

describe("conformance meta-test", () => {
  test("the honest fake passes every case, including lexical recall", async () => {
    const outcomes = await runCases(() => createFakeAdapter(), { lexical: true });
    expect(outcomes.filter((o) => o.outcome !== "pass")).toEqual([]);
  });

  test("every case a broken adapter names exists in the suite", async () => {
    const names = (await runCases(() => createFakeAdapter(), { lexical: true })).map((o) => o.case);
    for (const b of BROKEN_ADAPTERS) {
      expect(b.fails.length, b.name).toBeGreaterThan(0);
      for (const c of b.fails) expect(names, `${b.name} names ${c}`).toContain(c);
    }
  });

  test.each(BROKEN_ADAPTERS.map((b) => [b.name, b.factory, b.fails] as const))(
    "an adapter that %s fails the cases that target it",
    async (_name, factory, fails) => {
      const outcomes = await runCases(factory, { lexical: true });
      const failed = outcomes.filter((o) => o.outcome === "fail").map((o) => o.case);
      expect(failed).toEqual(expect.arrayContaining(fails));
    },
  );
});
