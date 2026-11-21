// The provenance graph (card E8.11), drawn with xyflow (@xyflow/react, MIT)
// at the positions dagre gives (layout.ts). Read only: nothing is dragged,
// connected or edited from the graph. Every node is focusable (xyflow gives
// each a tab stop and the label set here); Enter or Space on a focused node,
// or a click, shows what it is beside the graph. Colours come from the
// inspector's own variables, so the graph follows the colour scheme, and
// xyflow's own parts follow it through colorMode="system". Imported only by
// the item page, so xyflow is loaded only there.
import {
  Background,
  Controls,
  type Edge,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { type KeyboardEvent, useMemo } from "react";
import { layoutGraph } from "./layout.ts";
import {
  type EventNode,
  type GraphNode,
  type ItemNode,
  type ProvenanceGraph,
  versionText,
} from "./provenance.ts";

type ItemFlowNode = Node<{ node: ItemNode }, "item">;
type EventFlowNode = Node<{ node: EventNode }, "event">;

const snippet = (text: string, n = 80) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

/** What a node says, in one line: its accessible label and the graph's list. */
export function nodeLabel(n: GraphNode): string {
  if (n.kind === "event") {
    const e = n.event;
    return `event ${e.seq}: ${e.op} ${e.decision} by ${e.actor} at ${e.ts}`;
  }
  const what =
    n.state === null ? "its content is not shown to this viewer" : snippet(versionText(n.state));
  return `${n.focus ? "this item" : "item"} ${n.id}: ${what}`;
}

function ItemNodeView({ data }: NodeProps<ItemFlowNode>) {
  const n = data.node;
  return (
    <div
      className={`graph-node item${n.focus ? " focus" : ""}`}
      data-testid="graph-node"
      data-kind="item"
      data-id={n.id}
      data-focus={n.focus ? "true" : "false"}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div className="graph-node-head">
        {n.focus ? "this item" : "item"} <code>{n.id}</code>
      </div>
      {n.state === null ? (
        <div className="muted">content not shown to this viewer</div>
      ) : (
        <>
          <div className="graph-node-body">{snippet(versionText(n.state), 90)}</div>
          <div className="muted">
            {n.state.scope}, v{n.state.version}, {n.state.status}
          </div>
        </>
      )}
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

function EventNodeView({ data }: NodeProps<EventFlowNode>) {
  const e = data.node.event;
  return (
    <div className="graph-node event" data-testid="graph-node" data-kind="event" data-id={e.id}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div className="graph-node-head">
        {e.op} <span className={`decision ${e.decision}`}>{e.decision}</span>{" "}
        <span className="muted">event {e.seq}</span>
      </div>
      <div className="muted">
        {e.actor}, {e.ts}
      </div>
      <div className="graph-node-body">
        <code>{e.policy_id}</code>
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { item: ItemNodeView, event: EventNodeView };

export function ProvenanceGraphView({
  graph,
  onActivate,
}: {
  graph: ProvenanceGraph;
  onActivate: (node: GraphNode) => void;
}) {
  const { nodes, edges, byId } = useMemo(() => {
    const at = layoutGraph(graph);
    const nodes: (ItemFlowNode | EventFlowNode)[] = graph.nodes.map((n) => {
      const common = {
        id: n.id,
        position: at.get(n.id) ?? { x: 0, y: 0 },
        ariaLabel: nodeLabel(n),
        draggable: false,
        connectable: false,
      };
      return n.kind === "item"
        ? { ...common, type: "item" as const, data: { node: n } }
        : { ...common, type: "event" as const, data: { node: n } };
    });
    const edges: Edge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      className: `edge-${e.kind}`,
      markerEnd: { type: MarkerType.ArrowClosed },
      focusable: false,
    }));
    return { nodes, edges, byId: new Map(graph.nodes.map((n) => [n.id, n])) };
  }, [graph]);

  // Enter or Space on the node that has the focus: xyflow's node wrapper carries its id.
  const onKeyDown = (k: KeyboardEvent<HTMLDivElement>) => {
    if (k.key !== "Enter" && k.key !== " ") return;
    const id = (k.target as HTMLElement).closest(".react-flow__node")?.getAttribute("data-id");
    const node = id ? byId.get(id) : undefined;
    if (node) onActivate(node);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the keys reach the focusable nodes inside
    <div className="graph" data-testid="provenance-graph" onKeyDown={onKeyDown}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        colorMode="system"
        onNodeClick={(_, n) => {
          const node = byId.get(n.id);
          if (node) onActivate(node);
        }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
