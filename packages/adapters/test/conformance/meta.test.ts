// The conformance suite tested on itself (review finding R4-1). Each broken
// adapter in broken.ts must fail the very cases it names, and the honest
// stores must pass every case they run, so a weakened case or corpus item
// shows up here even when some incidental case still fails. The honest fake
// claims no native validity, so it skips exactly the cases held to that
// claim; the validity double (validity.ts, card A5) claims it and runs every
// case. The broken adapters are run through `runCases`, outside the
// conformance registry.
import { describe, expect, test } from "vitest";
import { createFakeAdapter } from "../../src/fake/index.ts";
import { BROKEN_ADAPTERS } from "./broken.ts";
import { CASES, runCases } from "./suite.ts";
import { createValidityAdapter } from "./validity.ts";

const label = (c: (typeof CASES)[number]) => `${c.group}: ${c.name}`;

describe("conformance meta-test", () => {
  test("the honest fake passes every case, including lexical recall, but those held to native validity", async () => {
    const outcomes = await runCases(() => createFakeAdapter(), { lexical: true });
    expect(outcomes.filter((o) => o.outcome === "fail")).toEqual([]);
    const skipped = outcomes.filter((o) => o.outcome === "skip");
    expect(skipped.map((o) => o.case)).toEqual(
      CASES.filter((c) => c.claims === "native_validity").map(label),
    );
    for (const o of skipped) expect(o.skipped).toBe("claims no native_validity");
  });

  test("the validity double passes every case, including lexical recall, and skips none", async () => {
    const outcomes = await runCases(() => createValidityAdapter(), { lexical: true });
    expect(outcomes.filter((o) => o.outcome !== "pass")).toEqual([]);
    expect(outcomes.length).toBeGreaterThan(CASES.filter((c) => c.claims).length);
  });

  // The limit of the validity cases, as a test (ADR 0013, amendment of card
  // A5): they are necessary, not sufficient. The fake keeps no validity of
  // its own, only the whole item, yet with the flag forced on it passes every
  // case held to native validity, so the suite cannot tell a native store
  // from one that stores the plane's fields.
  test("the fake with native validity forced on passes every validity case: the cases cannot see 'native'", async () => {
    const forced = () => {
      const fake = createFakeAdapter();
      return { ...fake, capabilities: { ...fake.capabilities, native_validity: true } };
    };
    const outcomes = await runCases(forced, { lexical: true });
    const held = CASES.filter((c) => c.claims === "native_validity").map(label);
    expect(held.length).toBe(4);
    expect(outcomes.filter((o) => held.includes(o.case))).toEqual(
      held.map((c) => ({ case: c, outcome: "pass" })),
    );
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
