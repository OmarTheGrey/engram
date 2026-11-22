// The supersession proposal (card L6): a new item and its candidate
// predecessors in, proposals out. A candidate that started before the new
// item and whose window the new one covers to its end gets a close at the
// new item's valid_from (Graphiti's resolve_edge_contradictions); every
// other overlap, and every overlap among the candidates themselves, is
// flagged for review; nothing is retired. Graphiti ships no unit test of
// `_apply_temporal_invalidation` or `resolve_edge_contradictions` at commit
// 9b8a4630092084734b080f2e6f409c2c23bdcc3a, so the first cases walk each of
// their branches and say what Engram does instead where it differs.
import { describe, expect, it } from "vitest";
import {
  applyClosures,
  proposeSupersession,
  type SupersessionCandidate,
} from "../../../src/lint/supersession.ts";

/** Instant n: n days after 2026-01-01. */
const t = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().replace(".000Z", "Z");
const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;

const version = (
  n: number,
  from: number,
  to: number | null = null,
  status: SupersessionCandidate["status"] = "active",
): SupersessionCandidate => ({
  id: id(n),
  status,
  valid_from: t(from),
  valid_to: to === null ? null : t(to),
});

const NEW = version(9, 10);

describe("Graphiti's branches", () => {
  it("closes an open candidate that started before the new item at the new item's valid_from", () => {
    expect(proposeSupersession(NEW, [version(1, 0)])).toEqual([
      {
        item_id: id(1),
        action: "close",
        relation: "finishedBy",
        valid_to: t(10),
        reason: expect.stringContaining(`${id(9)} supersedes it from ${t(10)}`),
      },
    ]);
  });

  it("closes a bounded candidate the new item outlasts, earlier than its own end", () => {
    const [p] = proposeSupersession(NEW, [version(1, 0, 20)]);
    expect(p).toMatchObject({ action: "close", relation: "overlaps", valid_to: t(10) });
  });

  it("proposes nothing for a candidate that ended before or as the new item began", () => {
    expect(proposeSupersession(NEW, [version(1, 0, 5), version(2, 5, 10)])).toEqual([]);
  });

  it("proposes nothing for a candidate that begins after a bounded new item ends", () => {
    const after = [version(1, 15, 20), version(2, 20, 25)];
    expect(proposeSupersession(version(9, 10, 15), after)).toEqual([]);
  });

  it("flags a candidate that starts later for review, where Graphiti would end the new item", () => {
    const later = proposeSupersession(NEW, [version(1, 12)]);
    expect(later).toEqual([
      {
        item_id: id(1),
        action: "review",
        relation: "finishes",
        valid_to: null,
        reason: expect.stringContaining("starts after"),
      },
    ]);
  });

  it("flags a candidate the bounded new item lies inside, where Graphiti would close it", () => {
    const [p] = proposeSupersession(version(9, 10, 15), [version(1, 0)]);
    expect(p).toMatchObject({ action: "review", relation: "contains", valid_to: null });
    expect(p?.reason).toContain("after");
  });
});

describe("review cases", () => {
  it("flags a candidate with the same start as the new item, whatever its end", () => {
    const out = proposeSupersession(version(9, 10, 20), [
      version(1, 10, 20),
      version(2, 10, 15),
      version(3, 10),
    ]);
    expect(out.map((p) => [p.action, p.relation])).toEqual([
      ["review", "equals"],
      ["review", "starts"],
      ["review", "startedBy"],
    ]);
  });

  it("flags every overlapping candidate when the new item is not active yet", () => {
    const held = { ...NEW, status: "candidate" as const };
    const [p] = proposeSupersession(held, [version(1, 0)]);
    expect(p).toMatchObject({ action: "review", relation: "finishedBy" });
    expect(p?.reason).toContain("candidate");
  });

  it("flags a candidate whose own window covers no time", () => {
    const [p] = proposeSupersession(NEW, [version(1, 5, 5)]);
    expect(p).toMatchObject({ action: "review", relation: null, valid_to: null });
  });

  it("flags every candidate when the new item's window covers no time", () => {
    const out = proposeSupersession(version(9, 10, 3), [version(1, 0), version(2, 0, 1)]);
    expect(out.map((p) => [p.item_id, p.action])).toEqual([
      [id(1), "review"],
      [id(2), "review"],
    ]);
  });

  it("flags the earlier of two candidates that overlap each other and closes the later", () => {
    const out = proposeSupersession(NEW, [version(1, 0), version(2, 5)]);
    expect(out.map((p) => [p.item_id, p.action])).toEqual([
      [id(1), "review"],
      [id(2), "close"],
    ]);
    expect(out[0]?.reason).toContain(id(2));
  });

  it("flags both of two candidates that overlap each other from the same start", () => {
    const out = proposeSupersession(NEW, [version(1, 5), version(2, 5, 8)]);
    expect(out.map((p) => p.action)).toEqual(["review", "review"]);
  });

  it("flags an earlier history's overlap even where the new item touches neither", () => {
    const out = proposeSupersession(NEW, [version(1, 0, 6), version(2, 4, 10)]);
    expect(out).toEqual([
      expect.objectContaining({ item_id: id(1), action: "review", relation: "before" }),
    ]);
  });
});

describe("what is never proposed", () => {
  it("ignores a retired candidate, and proposes nothing for a retired new item", () => {
    expect(proposeSupersession(NEW, [version(1, 0, null, "retired")])).toEqual([]);
    expect(proposeSupersession({ ...NEW, status: "retired" }, [version(1, 0)])).toEqual([]);
  });

  it("ignores the new item listed among its own candidates, and a duplicate once", () => {
    const out = proposeSupersession(NEW, [NEW, version(1, 0), version(1, 0)]);
    expect(out.map((p) => p.item_id)).toEqual([id(1)]);
  });

  it("orders its proposals by item id, whatever the candidates' order", () => {
    const a = proposeSupersession(NEW, [version(3, 1), version(1, 12), version(2, 0, 9)]);
    const b = proposeSupersession(NEW, [version(2, 0, 9), version(3, 1), version(1, 12)]);
    expect(a).toEqual(b);
    expect(a.map((p) => p.item_id)).toEqual([id(1), id(2), id(3)]);
  });

  it("retires nothing: applying the closes changes valid_to only, and a rerun proposes no close", () => {
    const candidates = [version(1, 0, 3), version(2, 3, 20), version(3, 25, 30)];
    const proposals = proposeSupersession(NEW, candidates);
    expect(proposals.map((p) => [p.item_id, p.action])).toEqual([
      [id(2), "close"],
      [id(3), "review"],
    ]);
    const closed = applyClosures(candidates, proposals);
    expect(closed.map((c) => c.status)).toEqual(["active", "active", "active"]);
    expect(closed.map((c) => c.valid_to)).toEqual([t(3), t(10), t(30)]);
    expect(proposeSupersession(NEW, closed).filter((p) => p.action === "close")).toEqual([]);
  });

  it("does not mutate its input", () => {
    const candidates = [version(1, 0), version(2, 5)];
    const snapshot = structuredClone(candidates);
    applyClosures(candidates, proposeSupersession(NEW, candidates));
    expect(candidates).toEqual(snapshot);
  });
});
