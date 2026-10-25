import { Id, Timestamp } from "@engram/core";
import { describe, expect, test } from "vitest";
import { systemClock, uuidv7 } from "../../src/ids.ts";

describe("uuidv7", () => {
  test("is a UUIDv7 the schema accepts", () => {
    expect(Id.safeParse(uuidv7()).success).toBe(true);
  });

  test("carries the millisecond time in its first 48 bits, so ids sort by creation", () => {
    const ms = Date.parse("2026-10-25T12:00:00.000Z");
    expect(Number.parseInt(uuidv7(ms).replace("-", "").slice(0, 12), 16)).toBe(ms);
    expect(uuidv7(ms) < uuidv7(ms + 1)).toBe(true);
  });
});

test("systemClock is a timestamp the schema accepts", () => {
  expect(Timestamp.safeParse(systemClock()).success).toBe(true);
});
