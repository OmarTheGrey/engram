// Always fails: the run that holds it must exit nonzero.
import { expect, test } from "vitest";

test("always fails", () => {
  expect(1).toBe(2);
});
