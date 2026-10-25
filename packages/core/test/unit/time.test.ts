// Unit tests for the timestamp helper (decision D7): comparisons at full
// precision, at the nanosecond boundaries Date.parse cannot see.
import { describe, expect, test } from "vitest";
import { compareTimestamps, normalTimestamp } from "../../src/time.ts";

const sign = (n: number) => Math.sign(n);

describe("compareTimestamps", () => {
  test("orders instants a nanosecond apart, which Date.parse sees as equal", () => {
    const a = "2026-10-25T12:00:00.000000001Z";
    const b = "2026-10-25T12:00:00.000000002Z";
    expect(Date.parse(a)).toBe(Date.parse(b));
    expect(sign(compareTimestamps(a, b))).toBe(-1);
    expect(sign(compareTimestamps(b, a))).toBe(1);
  });

  test("orders .0001 before .0009 within one millisecond", () => {
    expect(sign(compareTimestamps("2026-10-25T12:00:00.0001Z", "2026-10-25T12:00:00.0009Z"))).toBe(
      -1,
    );
  });

  test("treats trailing zeros and a missing fraction as the same instant", () => {
    const forms = [
      "2026-10-25T12:00:00Z",
      "2026-10-25T12:00:00.0Z",
      "2026-10-25T12:00:00.000Z",
      "2026-10-25T12:00:00.000000000Z",
    ];
    for (const a of forms)
      for (const b of forms) expect(compareTimestamps(a, b), `${a} ${b}`).toBe(0);
  });

  test("puts a whole second after every fraction of the second before it", () => {
    expect(sign(compareTimestamps("2026-10-25T12:00:00.999999999Z", "2026-10-25T12:00:01Z"))).toBe(
      -1,
    );
  });

  test("compares instants, not strings: a fraction is after the whole second", () => {
    // As strings "." sorts before "Z", so a plain string compare gets this wrong.
    expect("2026-10-25T12:00:00.5Z" < "2026-10-25T12:00:00Z").toBe(true);
    expect(sign(compareTimestamps("2026-10-25T12:00:00.5Z", "2026-10-25T12:00:00Z"))).toBe(1);
  });

  test("keeps precision beyond nine digits", () => {
    expect(sign(compareTimestamps("2026-10-25T12:00:00.0000000001Z", "2026-10-25T12:00:00Z"))).toBe(
      1,
    );
  });

  test("orders across dates, months and years", () => {
    expect(sign(compareTimestamps("2026-12-31T23:59:59.9Z", "2027-01-01T00:00:00Z"))).toBe(-1);
  });

  test("refuses a timestamp without a Z", () => {
    expect(() => compareTimestamps("2026-10-25T12:00:00+02:00", "2026-10-25T12:00:00Z")).toThrow(
      /with a Z/,
    );
    expect(() => normalTimestamp("yesterday")).toThrow(/with a Z/);
  });
});

describe("normalTimestamp", () => {
  test("writes the fraction to nine digits", () => {
    expect(normalTimestamp("2026-10-25T12:00:00Z")).toBe("2026-10-25T12:00:00.000000000Z");
    expect(normalTimestamp("2026-10-25T12:00:00.0001Z")).toBe("2026-10-25T12:00:00.000100000Z");
    expect(normalTimestamp("2026-10-25T12:00:00.123456789Z")).toBe(
      "2026-10-25T12:00:00.123456789Z",
    );
  });
});
