import { describe, expect, test } from "vitest";
import type { MemoryItem, Policy } from "../../src/schema.ts";
import { readable } from "../property/oracle.ts";

const policy = {
  read: { matrix: [], honour_grants: true },
} as unknown as Policy;
const item = {
  scope: "team:a",
  class: "semantic",
  grants: [{ to: "person:sara", mode: "read", expires: "2026-10-22T09:00:00.5Z" }],
} as unknown as MemoryItem;
const sara = { id: "person:sara", level: "person" as const, memberships: [] };

describe("readable", () => {
  test("compares grant expiry as instants, not strings", () => {
    expect(readable(policy, sara, item, "2026-10-22T09:00:00Z")).toBe(true);
    expect(readable(policy, sara, item, "2026-10-22T09:00:01Z")).toBe(false);
  });
});
