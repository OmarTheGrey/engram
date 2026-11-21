// Card E8.14's adapter conformance on the kit: the reference adapter passes
// every case, and each broken adapter fails the case named for it (the meta
// test), so a case that stops catching what it is for shows up here.
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { BROKEN, reference } from "./conformance/subjects.ts";
import { kitConformance, staticViolations } from "./conformance/suite.ts";

describe("the reference adapter on the kit", () => {
  for (const c of kitConformance(reference)) test(c.name, c.run);
});

describe("the suite catches each broken adapter", () => {
  for (const { subject, fails } of BROKEN)
    test(`${subject.name} fails "${fails}"`, async () => {
      const failing: string[] = [];
      for (const c of kitConformance(subject))
        await c.run().then(
          () => undefined,
          () => failing.push(c.name.slice(subject.name.length + 2)),
        );
      expect(failing).toContain(fails);
    });

  test("the static check names each import that reaches a store or the log", () => {
    const problems = staticViolations(
      fileURLToPath(new URL("./fixtures/bypassing", import.meta.url)),
    );
    expect(problems.some((p) => p.includes("dependencies names @engram/adapters"))).toBe(true);
    expect(problems.some((p) => p.endsWith("imports node:fs"))).toBe(true);
    expect(problems.some((p) => p.endsWith("imports @engram/adapters"))).toBe(true);
    expect(problems.some((p) => p.endsWith("imports @engram/core at run time"))).toBe(true);
  });
});
