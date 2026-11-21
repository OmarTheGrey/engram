// The item page's view logic (card E8.11), as pure functions over what the
// API returned to the viewer: which items it may see of a lineage, the
// provenance graph built from them and the events about them, the versions
// it may diff, and the events naming an item. The rule under test is the
// leak rule: an id a lineage names becomes a node only when the server gave
// the viewer that item itself (a read returned it, or a visible event carries
// it) or an allowed write of it; otherwise it leaves no node, edge or count.
import { describe, expect, it } from "vitest";
import type { MemoryEvent, MemoryItem } from "../src/api/index.ts";
import {
  itemEvents,
  itemVersions,
  knownItems,
  provenanceGraph,
  versionText,
} from "../src/provenance.ts";

const id = (n: number) => `01950000-0000-7000-8000-${String(n).padStart(12, "0")}`;

function item(n: number, over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: id(n),
    class: "semantic",
    scope: "team:core",
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
    schema_version: 1,
    ...over,
  } as MemoryItem;
}

function event(seq: number, over: Partial<MemoryEvent> = {}): MemoryEvent {
  return {
    id: id(1000 + seq),
    seq,
    ts: `2026-10-28T09:00:${String(seq).padStart(2, "0")}.000Z`,
    op: "write",
    item_id: null,
    actor: "person:dana",
    scope_from: null,
    scope_to: "team:core",
    decision: "allow",
    reason: "ok",
    policy_id: "p/write/team",
    schema_version: 1,
    ...over,
  };
}

/** A write event carrying `it`, as visibleEvents shows one whose item the viewer may read. */
const wrote = (seq: number, it: MemoryItem, over: Partial<MemoryEvent> = {}) =>
  event(seq, { item_id: it.id, scope_to: it.scope, item: it, ...over });

// A note in person:dana, a team item written from it and rewritten, a second
// team item naming both. As sam sees it: the team items, never the note.
const note = item(1, { scope: "person:dana", content: "Draft: move the freeze to Monday." });
const team1 = item(2, { content: "The freeze moves to Monday.", lineage: [id(1)] });
const team2 = { ...team1, version: 2, content: "The freeze moves to Tuesday." } as MemoryItem;
const checklist = item(3, { content: "The checklist covers it.", lineage: [id(2), id(1)] });
const danaLog = [
  wrote(0, note),
  wrote(1, team1),
  wrote(2, team2),
  event(3, { item_id: id(2), decision: "deny", policy_id: "engram/write/version" }),
  wrote(4, checklist),
  event(5, { op: "read", scope_to: null, item_ids: [id(1), id(2), id(3)] }),
];
const samLog = danaLog.filter((e) => e.seq !== 0 && e.seq !== 5);
const danaRead = [note, team2, checklist];
const samRead = [team2, checklist];

const nodeIds = (g: ReturnType<typeof provenanceGraph>) => g?.nodes.map((n) => n.id) ?? null;
const edgeIds = (g: ReturnType<typeof provenanceGraph>) => g?.edges.map((e) => e.id) ?? null;

describe("which items the viewer may see", () => {
  it("knows an item a read returned or a visible event carries, with its latest state", () => {
    const known = knownItems(danaRead, danaLog);
    expect([...known.keys()].sort()).toEqual([id(1), id(2), id(3)]);
    expect(known.get(id(2))?.state?.version).toBe(2);
  });

  it("knows an item whose allowed write it sees, without its state, when that is withheld", () => {
    const { item: _withheld, ...rest } = wrote(0, note);
    const known = knownItems([], [rest]);
    expect(known.get(id(1))).toEqual({ id: id(1), state: null });
  });

  it("never knows an id only a lineage names, or one only a denied write or a read names", () => {
    const known = knownItems(samRead, [
      ...samLog,
      event(9, { item_id: id(7), decision: "deny" }),
      event(10, { op: "read", scope_to: null, item_ids: [id(8)] }),
    ]);
    expect(known.has(id(1))).toBe(false);
    expect(known.has(id(7))).toBe(false);
    expect(known.has(id(8))).toBe(false);
  });
});

describe("the provenance graph", () => {
  it("is the item, every ancestor the viewer may see, and the decisions about them", () => {
    const g = provenanceGraph(id(3), danaRead, danaLog);
    expect(nodeIds(g)).toEqual([
      id(1),
      id(2),
      id(3),
      id(1000),
      id(1001),
      id(1002),
      id(1003),
      id(1004),
    ]);
    expect(edgeIds(g)).toEqual([
      `lineage:${id(1)}>${id(2)}`,
      `lineage:${id(2)}>${id(3)}`,
      `lineage:${id(1)}>${id(3)}`,
      `decision:${id(1)}>${id(1000)}`,
      `decision:${id(2)}>${id(1001)}`,
      `decision:${id(2)}>${id(1002)}`,
      `decision:${id(2)}>${id(1003)}`,
      `decision:${id(3)}>${id(1004)}`,
    ]);
    expect(g).toMatchObject({ items: 3, decisions: 5 });
    expect(g?.nodes.find((n) => n.id === id(3))).toMatchObject({ kind: "item", focus: true });
  });

  it("shows a viewer who cannot read an ancestor no node, no edge and no count for it", () => {
    const g = provenanceGraph(id(3), samRead, samLog);
    expect(nodeIds(g)).toEqual([id(2), id(3), id(1001), id(1002), id(1003), id(1004)]);
    expect(edgeIds(g)).toEqual([
      `lineage:${id(2)}>${id(3)}`,
      `decision:${id(2)}>${id(1001)}`,
      `decision:${id(2)}>${id(1002)}`,
      `decision:${id(2)}>${id(1003)}`,
      `decision:${id(3)}>${id(1004)}`,
    ]);
    expect(g).toMatchObject({ items: 2, decisions: 4 });
    expect(JSON.stringify(g?.edges)).not.toContain(id(1));
    expect(
      JSON.stringify(g?.nodes.map((n) => ({ ...n, state: undefined, event: undefined }))),
    ).not.toContain(id(1));
  });

  it("follows the lineage the viewer may see to descendants, and stops at what it may not", () => {
    // From the team item, sam sees the checklist written from it; never the note above it.
    const g = provenanceGraph(id(2), samRead, samLog);
    expect(g?.nodes.filter((n) => n.kind === "item").map((n) => n.id)).toEqual([id(2), id(3)]);
    expect(g?.edges.filter((e) => e.kind === "lineage").map((e) => e.id)).toEqual([
      `lineage:${id(2)}>${id(3)}`,
    ]);
  });

  it("is null for an item the viewer may see nothing of", () => {
    expect(provenanceGraph(id(1), samRead, samLog)).toBeNull();
    expect(provenanceGraph(id(99), danaRead, danaLog)).toBeNull();
  });

  it("ends at a lineage cycle, and never makes an item its own ancestor", () => {
    const a = item(5, { lineage: [id(6), id(5)] });
    const b = item(6, { lineage: [id(5)] });
    const g = provenanceGraph(id(5), [a, b], []);
    expect(nodeIds(g)).toEqual([id(5), id(6)]);
    expect(edgeIds(g)).toEqual([`lineage:${id(6)}>${id(5)}`, `lineage:${id(5)}>${id(6)}`]);
  });

  it("leaves the reads out of the graph: they are recalls, not decisions about the item", () => {
    const g = provenanceGraph(id(2), danaRead, danaLog);
    expect(g?.nodes.some((n) => n.kind === "event" && n.event.op === "read")).toBe(false);
  });
});

describe("the versions to diff", () => {
  it("are every state of the item and its visible ancestors the events carry, in log order", () => {
    const v = itemVersions(id(2), danaRead, danaLog);
    expect(v.map((x) => [x.itemId, x.version, x.event?.seq])).toEqual([
      [id(1), 1, 0],
      [id(2), 1, 1],
      [id(2), 2, 2],
    ]);
    expect(v.map((x) => x.key)).toEqual([id(1000), id(1001), id(1002)]);
    expect(v[2]?.text).toBe("The freeze moves to Tuesday.");
  });

  it("hold nothing of an ancestor the viewer cannot read", () => {
    const v = itemVersions(id(3), samRead, samLog);
    expect(v.map((x) => x.itemId)).toEqual([id(2), id(2), id(3)]);
    expect(JSON.stringify(v.map((x) => [x.key, x.label, x.text]))).not.toContain(id(1));
  });

  it("are the read's state alone when no visible event carries the item", () => {
    const granted = item(4, { scope: "person:dana", content: "granted" });
    const v = itemVersions(id(4), [granted], []);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ key: `current:${id(4)}`, event: null, text: "granted" });
  });

  it("print structured and procedural content as indented JSON, text as it is", () => {
    expect(versionText(item(1, { content: "plain" }))).toBe("plain");
    expect(versionText(item(1, { content: { a: 1 } }))).toBe('{\n  "a": 1\n}');
    const skill = { ...item(1), class: "procedural", content: { body: "do it", tools: ["bash"] } };
    expect(versionText(skill as MemoryItem)).toBe(
      '{\n  "body": "do it",\n  "tools": [\n    "bash"\n  ]\n}',
    );
  });
});

describe("the events naming an item", () => {
  it("are those about it and the reads that returned it, in log order", () => {
    expect(itemEvents(id(2), danaLog).map((e) => e.seq)).toEqual([1, 2, 3, 5]);
    expect(itemEvents(id(9), danaLog)).toEqual([]);
  });
});
