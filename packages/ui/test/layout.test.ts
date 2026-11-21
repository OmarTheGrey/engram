// The provenance graph's layout (card E8.11): dagre ranks it top to bottom,
// each version below the versions its lineage names, no two boxes overlap,
// and the same graph is laid out the same way every time.
import { describe, expect, it } from "vitest";
import { layoutGraph, NODE_SIZE } from "../src/layout.ts";
import type { GraphEdge, GraphNode, ProvenanceGraph } from "../src/provenance.ts";

const item = (id: string): GraphNode => ({ kind: "item", id, focus: id === "c", state: null });
const decision = (id: string): GraphNode => ({
  kind: "event",
  id,
  event: {} as never,
});
const edge = (source: string, target: string, kind: GraphEdge["kind"]): GraphEdge => ({
  id: `${kind}:${source}>${target}`,
  source,
  target,
  kind,
});

const graph: ProvenanceGraph = {
  nodes: [item("a"), item("b"), item("c"), decision("e1"), decision("e2"), decision("e3")],
  edges: [
    edge("a", "b", "lineage"),
    edge("b", "c", "lineage"),
    edge("a", "c", "lineage"),
    edge("a", "e1", "decision"),
    edge("b", "e2", "decision"),
    edge("c", "e3", "decision"),
  ],
  items: 3,
  decisions: 3,
};

describe("the provenance graph's layout", () => {
  const at = layoutGraph(graph);
  const box = (id: string) => {
    const p = at.get(id);
    const n = graph.nodes.find((x) => x.id === id);
    if (!p || !n) throw new Error(`no position for ${id}`);
    return { ...p, ...NODE_SIZE[n.kind] };
  };

  it("places every node", () => {
    expect([...at.keys()].sort()).toEqual(graph.nodes.map((n) => n.id).sort());
  });

  it("puts each version below the versions its lineage names, and each decision below its item", () => {
    for (const e of graph.edges) {
      const s = box(e.source);
      const t = box(e.target);
      expect(s.y + s.height).toBeLessThanOrEqual(t.y);
    }
  });

  it("overlaps no two boxes", () => {
    const boxes = graph.nodes.map((n) => box(n.id));
    for (const [i, a] of boxes.entries())
      for (const b of boxes.slice(i + 1))
        expect(
          a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y,
        ).toBe(true);
  });

  it("lays out the same graph the same way every time", () => {
    expect([...layoutGraph(graph)]).toEqual([...at]);
  });
});
