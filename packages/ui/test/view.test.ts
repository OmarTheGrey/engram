// The inspector's view logic (cards E8.5 and E8.6), as pure functions over
// what the API returns: the viewer picker's parsing, the lanes' grouping, the
// timeline's filters and detail, and the explain view's rows and counts.
import { describe, expect, it } from "vitest";
import type { ExplainResponse, MemoryEvent, MemoryItem, ReadResponse } from "../src/api/index.ts";
import {
  buildLanes,
  eventDetail,
  explainTarget,
  explainView,
  FILTER_CATEGORIES,
  filterEvents,
  filterOptions,
  keepSelection,
  NO_FILTER,
  otherReaderLine,
  parseMemberships,
  scopeText,
  validityText,
  viewerFrom,
} from "../src/view.ts";

const id = (n: number) => `01950000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const dana = {
  id: "person:dana",
  level: "person" as const,
  memberships: ["person:dana", "team:core"],
};

function item(n: number, over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: id(n),
    class: "semantic",
    scope: "person:dana",
    owner: "person:dana",
    content: `fact ${n}`,
    provenance: { kind: "user", ref: "t", hash: `sha256:${"0".repeat(64)}`, actor: "person:dana" },
    confidence: 0.9,
    valid_from: "2026-10-01T00:00:00.000Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 0,
    ...over,
  } as MemoryItem;
}

function event(seq: number, over: Partial<MemoryEvent> = {}): MemoryEvent {
  return {
    id: id(1000 + seq),
    seq,
    ts: "2026-10-28T09:00:00.000Z",
    op: "write",
    item_id: null,
    actor: "person:dana",
    scope_from: null,
    scope_to: "person:dana",
    decision: "allow",
    reason: "ok",
    policy_id: "p/write/person",
    schema_version: 0,
    ...over,
  };
}

const explanation = (n: number, rank: number, over = {}) => ({
  item_id: id(n),
  rank,
  score: { total: 2 - rank / 10, components: { confidence: 0.9, recency: 1 - rank / 10 } },
  policy_id: "p/read/person",
  grants_used: [] as string[],
  validity: {
    at: "2026-10-28T09:00:00.000Z",
    valid_from: "2026-10-01T00:00:00.000Z",
    valid_to: null,
  },
  schema_version: 0 as const,
  ...over,
});

function readOf(items: MemoryItem[], ranks: number[]): ReadResponse {
  return {
    items,
    explanations: items.map((it, i) => explanation(Number(it.id.slice(-4)), ranks[i] ?? i + 1)),
    filtered: 0,
    event: event(0, { op: "read", scope_to: null }),
    sync: null,
    policy: "p v1",
  };
}

describe("the viewer picker", () => {
  it("splits memberships on commas and spaces, dropping blanks and repeats", () => {
    expect(parseMemberships(" person:dana, team:core  team:core,,org ")).toEqual([
      "person:dana",
      "team:core",
      "org",
    ]);
    expect(parseMemberships("")).toEqual([]);
  });

  it("names an actor, or why it cannot", () => {
    expect(viewerFrom(" person:dana ", "person", "person:dana")).toEqual({
      id: "person:dana",
      level: "person",
      memberships: ["person:dana"],
    });
    expect(viewerFrom("", "person", "")).toMatch(/needs an id/);
    expect(viewerFrom("person:dana", "galaxy", "")).toMatch(/unknown level/);
  });
});

describe("the scope lanes", () => {
  it("has a lane per member scope, empty ones included, then granted scopes", () => {
    const granted = item(3, { scope: "person:sam", owner: "person:sam" });
    const lanes = buildLanes(dana, readOf([item(1), granted], [1, 2]));
    expect(lanes.map((l) => [l.scope, l.member, l.items.length])).toEqual([
      ["person:dana", true, 1],
      ["team:core", true, 0],
      ["person:sam", false, 1],
    ]);
  });

  it("shows each returned item once, in rank order, with class, status, provenance and validity", () => {
    const items = [
      item(1),
      item(2, { class: "episodic", valid_to: "2026-12-01T00:00:00.000Z" }),
      item(3, { content: { note: "structured" } }),
    ];
    const lanes = buildLanes(dana, readOf(items, [3, 1, 2]));
    const own = lanes[0]?.items ?? [];
    expect(own.map((i) => i.rank)).toEqual([1, 2, 3]);
    expect(own[0]).toMatchObject({
      id: id(2),
      class: "episodic",
      status: "active",
      provenance: "user",
      validity: "2026-10-01T00:00:00.000Z to 2026-12-01T00:00:00.000Z",
      admittedBy: "p/read/person",
    });
    expect(own[1]?.content).toBe('{"note":"structured"}');
    expect(lanes.flatMap((l) => l.items)).toHaveLength(items.length);
  });

  it("adds nothing the read did not return", () => {
    expect(buildLanes(dana, readOf([], [])).flatMap((l) => l.items)).toEqual([]);
  });

  it("prints an open validity window from its start", () => {
    expect(validityText({ valid_from: "a", valid_to: null })).toBe("from a");
  });
});

describe("the timeline", () => {
  const events = [
    event(0),
    event(1, { scope_to: "team:core" }),
    event(2, { op: "read", scope_to: null }),
    event(3, { decision: "deny", scope_to: "team:core", actor: "person:eve" }),
    event(4, { op: "promote", scope_from: "person:dana", scope_to: "team:core" }),
  ];

  it("offers the scopes, ops and decisions the visible events carry", () => {
    expect(filterOptions(events)).toEqual({
      scopes: ["person:dana", "team:core"],
      ops: ["promote", "read", "write"],
      decisions: ["allow", "deny"],
    });
  });

  it("keeps every event with no filter, in order", () => {
    expect(filterEvents(events, NO_FILTER)).toEqual(events);
  });

  it("filters by scope (source or target), op and decision together", () => {
    const seqs = (f: Partial<typeof NO_FILTER>) =>
      filterEvents(events, { ...NO_FILTER, ...f }).map((e) => e.seq);
    expect(seqs({ scope: "team:core" })).toEqual([1, 3, 4]);
    expect(seqs({ scope: "person:dana" })).toEqual([0, 4]);
    expect(seqs({ op: "read" })).toEqual([2]);
    expect(seqs({ decision: "deny" })).toEqual([3]);
    expect(seqs({ scope: "team:core", decision: "allow" })).toEqual([1, 4]);
    expect(seqs({ scope: "org" })).toEqual([]);
  });

  it("prints the scope column and an event's every field", () => {
    expect(scopeText(events[4] as MemoryEvent)).toBe("person:dana to team:core");
    expect(scopeText(events[2] as MemoryEvent)).toBe("-");
    expect(scopeText(events[1] as MemoryEvent)).toBe("team:core");
    const detail = new Map(eventDetail(events[3] as MemoryEvent));
    expect(detail.get("decision")).toBe("deny");
    expect(detail.get("policy id")).toBe("p/write/person");
    expect(detail.get("reason")).toBe("ok");
    expect(detail.size).toBe(11);
  });
});

describe("the selection after a change of viewer", () => {
  const write = event(1, { scope_to: "person:dana" });
  const read = event(2, { op: "read", scope_to: null });

  it("drops an event the new viewer may not see", () => {
    expect(keepSelection(write, [event(5)])).toBeNull();
  });

  it("keeps an event the new viewer may see", () => {
    expect(keepSelection(write, [event(5), write])).toBe(write);
  });

  it("takes the new viewer's copy, which may withhold the item the old copy carried", () => {
    const carried = { ...write, item: item(1) };
    const withheld = { ...write };
    const kept = keepSelection(carried, [event(5), withheld]);
    expect(kept).toBe(withheld);
    expect(kept && "item" in kept).toBe(false);
  });

  it("keeps a read, whose explain view then names its reader (decision 5)", () => {
    expect(keepSelection(read, [])).toBe(read);
  });

  it("keeps nothing when nothing was selected", () => {
    expect(keepSelection(null, [write])).toBeNull();
  });
});

describe("the explain view", () => {
  const read = event(7, { op: "read", scope_to: null });
  const counts = {
    returned: 2,
    candidates: 6,
    filtered: 4,
    outside_validity: 1,
    not_active: 2,
    expired: 0,
    excluded: 1,
    out_of_reach: 3,
  };
  const response: ExplainResponse = {
    read_id: read.id,
    explanations: [
      explanation(2, 2, { grants_used: ["person:dana"] }),
      explanation(1, 1, { validity: { at: "x", valid_from: "a", valid_to: "b" } }),
    ],
    counts,
  };

  it("explains the viewer's own read: rows in rank order with every part", () => {
    const view = explainView(dana, read, response, new Map([[id(1), "fact 1"]]));
    if (view.kind !== "own") throw new Error(view.kind);
    expect(view.rows.map((r) => r.rank)).toEqual([1, 2]);
    expect(view.rows[0]).toMatchObject({
      itemId: id(1),
      content: "fact 1",
      admittedBy: "p/read/person",
      validity: "a to b, read at x",
    });
    expect(view.rows[0]?.components).toEqual([
      ["confidence", 0.9],
      ["recency", 0.9],
    ]);
    expect(view.rows[1]).toMatchObject({ content: null, grantsUsed: ["person:dana"] });
  });

  it("shows each filtered category with the count the route parsed, summing to the total", () => {
    const view = explainView(dana, read, response);
    if (view.kind !== "own") throw new Error(view.kind);
    expect(view.categories.map((c) => [c.key, c.count])).toEqual([
      ["outside_validity", 1],
      ["not_active", 2],
      ["expired", 0],
      ["excluded", 1],
    ]);
    expect(view.categories.reduce((a, c) => a + c.count, 0)).toBe(counts.filtered);
    expect(FILTER_CATEGORIES.map(([, label]) => label)).toEqual([
      "outside the validity window",
      "not active",
      "past their ttl",
      "by a grant's class or expiry",
    ]);
  });

  it("shows another actor's read with the line that only its reader may explain it", () => {
    const theirs = { ...read, actor: "person:sam" };
    expect(explainTarget(dana, theirs)).toBe("other");
    expect(explainView(dana, theirs, response)).toEqual({
      kind: "other",
      event: theirs,
      reader: "person:sam",
      line: otherReaderLine("person:sam"),
    });
    expect(otherReaderLine("person:sam")).toMatch(/Only person:sam/);
  });

  it("treats a refusal from the server as another reader's read", () => {
    expect(explainView(dana, read, null).kind).toBe("other");
  });

  it("explains reads only", () => {
    expect(explainView(dana, event(1), response).kind).toBe("not-read");
  });

  it("shows no categories for a reason the plane did not write", () => {
    const view = explainView(dana, read, { ...response, counts: null });
    if (view.kind !== "own") throw new Error(view.kind);
    expect(view.categories).toEqual([]);
  });
});
