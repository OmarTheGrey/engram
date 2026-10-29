// The generators must only produce values the schema accepts, or property
// tests would pass or fail on malformed input.
import fc from "fast-check";
import { expect, test } from "vitest";
import { Grant, MemoryEvent, MemoryItem, Policy, Timestamp } from "../../src/schema.ts";
import {
  arbEventInput,
  arbGatedGrant,
  arbGatedItem,
  arbGrant,
  arbGrantedItem,
  arbId,
  arbInstant,
  arbPolicy,
  seedFor,
} from "../generators.ts";

const check = <T>(name: string, arb: fc.Arbitrary<T>, parse: (v: T) => unknown) =>
  test(name, () => {
    fc.assert(
      fc.property(arb, (v) => {
        parse(v);
      }),
      { numRuns: 300, seed: seedFor(name) },
    );
  });

check("generated items parse as MemoryItem", arbGrantedItem, (v) => MemoryItem.parse(v));
check("generated grants parse as Grant", arbGrant, (v) => Grant.parse(v));
check("generated gated items parse as MemoryItem", arbGatedItem, (v) => MemoryItem.parse(v));
check("generated gated grants parse as Grant", arbGatedGrant, (v) => Grant.parse(v));
check("generated instants parse as Timestamp", arbInstant, (v) => Timestamp.parse(v));
check("generated policies parse as Policy", arbPolicy, (v) => Policy.parse(v));
check(
  "generated events parse as MemoryEvent",
  fc.uniqueArray(arbId, { minLength: 1, maxLength: 3 }).chain((ids) => arbEventInput(ids)),
  (v) => MemoryEvent.parse({ ...v, seq: 0 }),
);

test("seedFor is stable per name", () => {
  expect(seedFor("a")).toBe(seedFor("a"));
  expect(seedFor("a")).not.toBe(seedFor("b"));
});
