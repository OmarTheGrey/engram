// Always passes: the run that holds it must exit 0.
import { expect, test } from "vitest";

test("always passes", () => {
  expect(1).toBe(1);
});
