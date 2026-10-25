// The conformance suite tested on itself (review finding R4-1). Each broken
// adapter in broken.ts must fail at least one case, and the honest fake must
// pass every case, so a weakened case or corpus shows up here. The broken
// adapters are run through `runCases`, outside the conformance registry.
import { describe, expect, test } from "vitest";
import { createFakeAdapter } from "../../src/fake/index.ts";
import { BROKEN_ADAPTERS } from "./broken.ts";
import { runCases } from "./suite.ts";

describe("conformance meta-test", () => {
  test("the honest fake passes every case, including lexical recall", async () => {
    const outcomes = await runCases(() => createFakeAdapter(), { lexical: true });
    expect(outcomes.filter((o) => o.outcome !== "pass")).toEqual([]);
  });

  test.each(BROKEN_ADAPTERS.map((b) => [b.name, b.factory] as const))(
    "an adapter that %s fails at least one case",
    async (_name, factory) => {
      const outcomes = await runCases(factory, { lexical: true });
      expect(outcomes.filter((o) => o.outcome === "fail").map((o) => o.case)).not.toEqual([]);
    },
  );
});
