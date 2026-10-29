// What the inspector asks the server (cards E8.5 and E8.6), on the fixture
// workspace through the generated client in process: the lanes are a read
// through the plane (the timeline that follows shows its read event, and the
// lanes hold nothing the plane's read did not return), the timeline is what
// core's visibleEvents gives the viewer, and the explain view's filtered count
// is the read event's.
import { readCounts, visibleEvents } from "@engram/core";
import { describe, expect, it } from "vitest";
import type { Actor } from "../src/api/index.ts";
import { fetchExplain, fetchTimeline, fetchViewer, inspect } from "../src/data.ts";
import { inspectorWorkspace } from "./workspace.ts";

const ids = (n: number[]) => n.map((k) => `01940000-0000-7000-8000-${String(k).padStart(12, "0")}`);

describe("the inspector's calls on the fixture workspace", () => {
  it("takes the default viewer from GET /viewer", async () => {
    const { client, viewer } = await inspectorWorkspace();
    expect(await fetchViewer(client)).toEqual(viewer);
  });

  it("reads the lanes through the plane: the read leaves its event in the viewer's timeline", async () => {
    const { client, viewer, workspace } = await inspectorWorkspace();
    const before = workspace.plane.events().length;
    const view = await inspect(client, viewer);
    const after = workspace.plane.events();
    expect(after).toHaveLength(before + 1);
    const lanesRead = after.at(-1);
    expect(lanesRead).toMatchObject({ op: "read", actor: viewer.id });
    expect(view.read.event.id).toBe(lanesRead?.id);
    expect(view.events.map((e) => e.id)).toContain(lanesRead?.id);
  });

  it("puts in the lanes exactly what the viewer may read, by scope", async () => {
    const { client, viewer } = await inspectorWorkspace();
    const { lanes } = await inspect(client, viewer);
    expect(lanes.map((l) => [l.scope, l.items.map((i) => i.id).sort()])).toEqual([
      ["person:dana", ids([1, 9])],
      ["team:core", ids([2, 6])],
    ]);
    // Out of the window, past their ttl, candidates, another person's, and the denied write.
    const shown = new Set(lanes.flatMap((l) => l.items.map((i) => i.id)));
    for (const hidden of ids([3, 4, 5, 7, 8, 10, 11, 12])) expect(shown.has(hidden)).toBe(false);
  });

  it("shows the timeline core's visibleEvents gives the viewer, and no more", async () => {
    const { client, viewer, workspace } = await inspectorWorkspace();
    const events = await fetchTimeline(client, viewer);
    const expected = visibleEvents(viewer, workspace.plane.events());
    expect(events).toEqual(expected);
    expect(events.length).toBeLessThan(workspace.plane.events().length);
    expect(events.length).toBe(12);
  });

  it("explains the viewer's own read with the filtered count its event records", async () => {
    const { client, viewer, reads } = await inspectorWorkspace();
    const read = reads.get("dana");
    if (!read) throw new Error("no read by dana");
    const view = await fetchExplain(client, viewer, read.event);
    if (view.kind !== "own") throw new Error(view.kind);
    expect(view.counts).toEqual(readCounts(read.event));
    expect(view.counts?.filtered).toBe(read.filtered);
    expect(view.counts).toMatchObject({
      filtered: 6,
      outside_validity: 3,
      not_active: 2,
      expired: 1,
    });
    expect(view.rows.map((r) => r.itemId)).toEqual(read.explanations.map((e) => e.item_id));
  });

  it("does not explain another actor's read: its event and the line only", async () => {
    const { client, reads, workspace } = await inspectorWorkspace();
    const sams = reads.get("sam");
    if (!sams) throw new Error("no read by sam");
    const dana = (await fetchViewer(client)) as Actor;
    const before = workspace.plane.events().length;
    const view = await fetchExplain(client, dana, sams.event);
    expect(view).toMatchObject({ kind: "other", reader: "person:sam" });
    expect(workspace.plane.events()).toHaveLength(before);
  });

  it("shows the server's refusal as the same line when the viewer claims another's read", async () => {
    const { client, reads } = await inspectorWorkspace();
    const sams = reads.get("sam");
    if (!sams) throw new Error("no read by sam");
    // The event says dana made it, the log says sam: the plane refuses (403).
    const forged = { ...sams.event, actor: "person:dana" };
    const dana = (await fetchViewer(client)) as Actor;
    expect((await fetchExplain(client, dana, forged)).kind).toBe("other");
  });
});
