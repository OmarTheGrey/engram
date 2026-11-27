// knownAnswer (card RD1, verification N2): the item the TUI's grants screen
// shows and whether the answer that carried it came whole, which decides
// only the label "every grant is shown". A read's answer is whole when its
// explanation names no grant; any other answer (a write, a grant change, a
// promotion) is taken as core returned it to its caller. The second is an
// inference: core does not yet say on the answer whether the grants shown
// are complete (backlog row "Grants shown, stated by core").
import type { Explanation, MemoryItem } from "@engram/sdk";
import { describe, expect, it } from "vitest";
import { actorNow } from "../../src/tui/actor.ts";
import type { RunResult } from "../../src/tui/runner.ts";
import type { Ctx } from "../../src/tui/screen.ts";
import { knownAnswer, knownState } from "../../src/tui/screens/rich.ts";
import type { Workspace } from "../../src/tui/workspace.ts";

const ID = "01980000-0000-7000-8000-000000000001";
const flags: Record<string, string> = { as: "person:dana", level: "person" };
const ws = {
  get: (k: string) => flags[k],
  list: (k: string) => (k === "member" ? ["person:dana", "team:x"] : []),
} as unknown as Workspace;
const actor = actorNow(ws);

const item = {
  id: ID,
  owner: "person:dana",
  scope: "team:x",
  grants: [{ to: "person:sam", class: "semantic", mode: "read", expires: "2026-12-31T00:00:00Z" }],
} as unknown as MemoryItem;
const explanation = (grants_used: string[]) => ({ item_id: ID, grants_used }) as Explanation;

const ran = (path: string, body: unknown): RunResult => ({
  argv: [],
  code: 0,
  out: "",
  err: "",
  calls: [{ method: "POST", path, request: { actor }, status: 200, body }],
});
const ctxOf = (...results: RunResult[]) => ({ ws, results }) as unknown as Ctx;

describe("knownAnswer: whether the answer that carried an item came whole", () => {
  it("a read is whole when its explanation names no grant, and not when one admitted the item", () => {
    expect(actor?.id).toBe("person:dana");
    const byScope = ctxOf(ran("/api/v1/read", { items: [item], explanations: [explanation([])] }));
    expect(knownAnswer(byScope, ID)).toEqual({ item, whole: true });
    const viaGrant = ctxOf(
      ran("/api/v1/read", {
        items: [item],
        explanations: [explanation(["grants[0]:person:dana"])],
      }),
    );
    expect(knownAnswer(viaGrant, ID)).toEqual({ item, whole: false });
  });

  it("a read with no explanation of the item is not whole", () => {
    const ctx = ctxOf(ran("/api/v1/read", { items: [item], explanations: [] }));
    expect(knownAnswer(ctx, ID)?.whole).toBe(false);
  });

  it("an answer that is not a read (a write, a grant change) is taken as whole", () => {
    for (const path of ["/api/v1/items", "/api/v1/grants"]) {
      const ctx = ctxOf(ran(path, { item, event: {} }));
      expect(knownAnswer(ctx, ID), path).toEqual({ item, whole: true });
    }
  });

  it("the newest answer wins, and knownState is its item", () => {
    const ctx = ctxOf(
      ran("/api/v1/items", { item, event: {} }),
      ran("/api/v1/read", {
        items: [item],
        explanations: [explanation(["grants[0]:person:dana"])],
      }),
    );
    expect(knownAnswer(ctx, ID)?.whole).toBe(false);
    expect(knownState(ctx, ID)).toBe(item);
    expect(knownAnswer(ctx, "01980000-0000-7000-8000-000000000002")).toBeUndefined();
  });
});
