// The supersession head resolver (card L6). The first cases are Remnic's own
// (packages/remnic-core/src/shared-context/supersession-chain.test.ts at
// commit ce22909cc219e36d0e31b1158a4ab74f175008a0, MIT, copyright 2025
// Joshua Warren), rewritten for vitest and for Engram's lineage: an item
// lists the ids it supersedes (`lineage`), where Remnic's names one
// (`supersedes`), and the head is reported as `head_id`. Remnic's cases on
// blank and padded ids are dropped: the contract's ids are UUIDv7s, never
// trimmed. The cases after them are this card's own.
import { describe, expect, it } from "vitest";
import {
  MAX_SUPERSESSION_DEPTH,
  resolveSupersessionHead,
  type SupersessionLink,
} from "../../src/supersede.ts";

const link = (id: string, ...lineage: string[]): SupersessionLink => ({ id, lineage });

describe("resolveSupersessionHead, Remnic's cases", () => {
  it("resolves a single item to itself", () => {
    expect(resolveSupersessionHead({ items: [link("a")], startId: "a" })).toEqual({
      ok: true,
      head_id: "a",
      chain: ["a"],
    });
  });

  it("resolves a three-link chain to the newest head with the full chain", () => {
    const items = [link("a"), link("b", "a"), link("c", "b")];
    expect(resolveSupersessionHead({ items, startId: "a" })).toEqual({
      ok: true,
      head_id: "c",
      chain: ["a", "b", "c"],
    });
  });

  it("returns cycle_detected on a two-cycle without hanging", () => {
    const items = [link("a", "b"), link("b", "a")];
    expect(resolveSupersessionHead({ items, startId: "a" })).toEqual({
      ok: false,
      error: "cycle_detected",
      chain: ["a", "b"],
    });
  });

  it("detects a longer cycle too", () => {
    // b supersedes a, c supersedes b, a supersedes c.
    const items = [link("a", "c"), link("b", "a"), link("c", "b")];
    expect(resolveSupersessionHead({ items, startId: "a" })).toEqual({
      ok: false,
      error: "cycle_detected",
      chain: ["a", "b", "c"],
    });
  });

  it("returns depth_exceeded under a small maxDepth", () => {
    const items = [link("a"), link("b", "a"), link("c", "b"), link("d", "c")];
    expect(resolveSupersessionHead({ items, startId: "a", maxDepth: 2 })).toEqual({
      ok: false,
      error: "depth_exceeded",
      chain: ["a", "b"],
    });
    expect(resolveSupersessionHead({ items, startId: "a", maxDepth: 1 })).toEqual({
      ok: false,
      error: "depth_exceeded",
      chain: ["a"],
    });
    // A chain exactly maxDepth ids long still resolves.
    expect(resolveSupersessionHead({ items, startId: "b", maxDepth: 3 })).toEqual({
      ok: true,
      head_id: "d",
      chain: ["b", "c", "d"],
    });
  });

  it("defaults the depth to MAX_SUPERSESSION_DEPTH, 32", () => {
    expect(MAX_SUPERSESSION_DEPTH).toBe(32);
    const items: SupersessionLink[] = [link("i0")];
    for (let i = 1; i <= 60; i++) items.push(link(`i${i}`, `i${i - 1}`));
    expect(resolveSupersessionHead({ items, startId: "i0" })).toEqual({
      ok: false,
      error: "depth_exceeded",
      chain: Array.from({ length: MAX_SUPERSESSION_DEPTH }, (_, i) => `i${i}`),
    });
  });

  it("returns unknown_id with an empty chain for an unknown start", () => {
    expect(resolveSupersessionHead({ items: [link("a")], startId: "zzz" })).toEqual({
      ok: false,
      error: "unknown_id",
      chain: [],
    });
  });

  it("throws a RangeError naming maxDepth for 0, a negative or a fraction", () => {
    for (const bad of [0, -1, -32, 2.5, Number.NaN])
      expect(() =>
        resolveSupersessionHead({ items: [link("a")], startId: "a", maxDepth: bad }),
      ).toThrow(RangeError);
    expect(() =>
      resolveSupersessionHead({ items: [link("a")], startId: "a", maxDepth: 0 }),
    ).toThrow(/maxDepth/);
  });

  it("resolves a fork to the smallest successor id, stable across shuffles", () => {
    // Both b and c supersede a; b < c, so b wins even though c appears first.
    const ordered = [link("a"), link("c", "a"), link("b", "a"), link("d", "b")];
    const shuffled = [link("d", "b"), link("b", "a"), link("a"), link("c", "a")];
    const expected = { ok: true, head_id: "d", chain: ["a", "b", "d"] };
    expect(resolveSupersessionHead({ items: ordered, startId: "a" })).toEqual(expected);
    expect(resolveSupersessionHead({ items: shuffled, startId: "a" })).toEqual(expected);
    expect(resolveSupersessionHead({ items: shuffled, startId: "a" })).toEqual(expected);
  });

  it("does not mutate its input", () => {
    const items = [link("c", "b"), link("a"), link("b", "a")];
    const snapshot = structuredClone(items);
    resolveSupersessionHead({ items, startId: "a" });
    expect(items).toEqual(snapshot);
  });
});

describe("resolveSupersessionHead over lineage", () => {
  it("counts every id a lineage lists as superseded, nearest first or not", () => {
    // c lists both versions it supersedes, as a version may (schema.ts, lineage).
    const items = [link("a"), link("b", "a"), link("c", "b", "a")];
    expect(resolveSupersessionHead({ items, startId: "a" })).toEqual({
      ok: true,
      head_id: "c",
      chain: ["a", "b", "c"],
    });
  });

  it("follows a version that names its predecessor among several (a merge)", () => {
    const items = [link("a"), link("b"), link("m", "b", "a")];
    for (const start of ["a", "b"])
      expect(resolveSupersessionHead({ items, startId: start })).toMatchObject({
        ok: true,
        head_id: "m",
      });
  });

  it("reports an item naming itself as a cycle", () => {
    expect(resolveSupersessionHead({ items: [link("a", "a")], startId: "a" })).toEqual({
      ok: false,
      error: "cycle_detected",
      chain: ["a"],
    });
  });

  it("ignores a lineage id no item holds", () => {
    const items = [link("b", "gone"), link("c", "b")];
    expect(resolveSupersessionHead({ items, startId: "b" })).toEqual({
      ok: true,
      head_id: "c",
      chain: ["b", "c"],
    });
  });
});
