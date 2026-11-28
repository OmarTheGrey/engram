// Card X18: what counts as a lint's detection of a fault (freshFindings and
// detects), on hand-made findings and on a real Plane state where an item
// names the deleted one by id, which B5's states never hold.
import { createFakeAdapter } from "@engram/adapters";
import { createPlane, loadPreset, type MemoryItem, migrate, openSqlite } from "@engram/core";
import { describe, expect, test } from "vitest";
import { detects, freshFindings } from "../../src/governance-faults/inject.ts";

const A = "01970000-0000-7000-8000-000000000001";
const B = "01970000-0000-7000-8000-000000000002";
const USER = "person:user";
const AT = "2026-01-02T00:00:00.000Z";

const item = (id: string, ref: string, content: string): MemoryItem => ({
  id,
  class: "semantic",
  scope: USER,
  owner: USER,
  content,
  provenance: { kind: "user", ref, hash: `sha256:${id.slice(-1).repeat(64)}`, actor: USER },
  confidence: 0.9,
  valid_from: "2026-01-01T00:00:00.000Z",
  valid_to: null,
  ttl: null,
  grants: [],
  version: 1,
  lineage: [],
  status: "active",
  store_ref: null,
  schema_version: 1,
});

describe("a lint's detection of a fault", () => {
  test("a deletion is detected by a new orphan finding on an item that names the target", () => {
    const orphan = {
      lint_id: "orphan",
      item_id: B,
      evidence: [`provenance.ref ${A} names no active item you can reach`],
    };
    const fresh = freshFindings("deletion", A, [], [orphan]);
    expect(fresh).toEqual([orphan]);
    expect(detects("deletion", fresh)).toBe(true);
  });

  test("an orphan naming another item, or one the clean state already had, is no detection", () => {
    const other = {
      lint_id: "orphan",
      item_id: B,
      evidence: [`lineage ${B} names a retired item`],
    };
    expect(freshFindings("deletion", A, [], [other])).toEqual([]);
    const known = { lint_id: "orphan", item_id: B, evidence: [`provenance.ref ${A} x`] };
    expect(freshFindings("deletion", A, [known], [known])).toEqual([]);
  });

  test("for the other operators only a finding on the target counts, and only by its lint", () => {
    const naming = { lint_id: "orphan", item_id: B, evidence: [`provenance.ref ${A} x`] };
    expect(freshFindings("missing-metadata", A, [], [naming])).toEqual([]);
    const reach = {
      lint_id: "missing-provenance",
      item_id: A,
      evidence: ["kind model names no model"],
    };
    const fresh = freshFindings("temporal-supersession", A, [], [reach]);
    expect(fresh).toEqual([reach]);
    expect(detects("temporal-supersession", fresh)).toBe(false);
    expect(detects("missing-metadata", fresh)).toBe(true);
  });

  test("on a real plane, an item dropped from the projection is detected through the item naming it", async () => {
    const db = openSqlite(":memory:");
    migrate(db);
    let n = 10;
    const newId = () => `01970000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
    const plane = createPlane({
      db,
      adapter: createFakeAdapter(),
      newId,
      policy: loadPreset("medium"),
    });
    const writer = {
      id: USER,
      level: "person" as const,
      memberships: [USER],
      source: "user" as const,
    };
    const reader = { id: USER, level: "person" as const, memberships: [USER] };
    await plane.write(writer, item(A, "note:origin", "the meeting is on tuesday"), AT);
    await plane.write(writer, item(B, `item:${A}`, "the meeting moved to wednesday"), AT);
    const clean = (await plane.lint(reader, AT, USER)).findings;
    db.prepare("DELETE FROM items WHERE id = ?").run(A);
    const corrupted = (await plane.lint(reader, AT, USER)).findings;
    const fresh = freshFindings("deletion", A, clean, corrupted);
    expect(fresh.map((f) => [f.lint_id, f.item_id])).toEqual([["orphan", B]]);
    expect(detects("deletion", fresh)).toBe(true);
    db.close();
  });
});
