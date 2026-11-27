// The provenance graph's layout (card E8.11): dagre (@dagrejs/dagre, MIT)
// ranks the graph top to bottom, so every version sits below the versions
// its lineage names and every decision below the item it is about. elkjs is
// EPL or GPL and is not used (docs/conventions/absorption.md). Imported only
// by the item page, so dagre is loaded only there.
import dagre from "@dagrejs/dagre";
import type { ProvenanceGraph } from "@engram/view";

/** Each node kind's box, in pixels, as the item page draws it. */
export const NODE_SIZE = {
  item: { width: 260, height: 96 },
  event: { width: 220, height: 76 },
} as const;

/** Every node's top-left corner. */
export function layoutGraph(graph: ProvenanceGraph): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 32, ranksep: 56, marginx: 8, marginy: 8 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of graph.nodes) g.setNode(n.id, { ...NODE_SIZE[n.kind] });
  for (const e of graph.edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  const at = new Map<string, { x: number; y: number }>();
  for (const n of graph.nodes) {
    const { x, y } = g.node(n.id);
    const { width, height } = NODE_SIZE[n.kind];
    // dagre gives centres; the graph view places nodes by their corner.
    at.set(n.id, { x: x - width / 2, y: y - height / 2 });
  }
  return at;
}
