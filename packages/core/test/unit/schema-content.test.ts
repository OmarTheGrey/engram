import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { MemoryItem } from "../../src/schema.ts";

const valid = JSON.parse(
  readFileSync(
    new URL("../../../../fixtures/schema/MemoryItem/valid/semantic-team.json", import.meta.url),
    "utf8",
  ),
);

describe("MemoryItem structured content", () => {
  test("accepts nested JSON values", () => {
    expect(
      MemoryItem.safeParse({ ...valid, content: { a: { b: [1, "x", null, true] } } }).success,
    ).toBe(true);
  });

  test("rejects values JSON cannot carry, which would change on storage", () => {
    expect(MemoryItem.safeParse({ ...valid, content: { when: new Date(0) } }).success).toBe(false);
    expect(MemoryItem.safeParse({ ...valid, content: { n: Number.NaN } }).success).toBe(false);
    expect(MemoryItem.safeParse({ ...valid, content: { f: () => 1 } }).success).toBe(false);
  });
});
