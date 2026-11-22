// An item's page (card E8.11), at `#/item/<id>`: the provenance graph, the
// diff between two versions with the event that made the later one, and the
// events naming the item in the event table. Everything is built from what
// the workspace page already fetched for the viewer (its read and its
// events, data.ts), by the pure functions of provenance.ts; nothing is asked
// of the server here. The leak rule is provenance.ts's: an ancestor the
// viewer may not see leaves no node, no edge and no count. App.tsx loads
// this module lazily, so xyflow and dagre are fetched only on this page.
//
// Who can read this memory (card E2.13) is the one panel that asks the
// server: the plane's answer for the viewer (WhoCanRead.tsx), shown for any
// id, so an item the viewer may not see gets the refusal an unknown id gets.
import { useMemo, useState } from "react";
import type { MemoryEvent } from "./api/index.ts";
import type { Inspection } from "./data.ts";
import { EventTable } from "./EventTable.tsx";
import { nodeLabel, ProvenanceGraphView } from "./ProvenanceGraph.tsx";
import { EventDetail, Pair } from "./parts.tsx";
import {
  type GraphNode,
  type ItemNode,
  itemEvents,
  itemVersions,
  provenanceGraph,
  type Version,
  versionText,
} from "./provenance.ts";
import { TextDiff } from "./TextDiff.tsx";
import { itemHref, NO_FILTER, type TimelineFilter } from "./view.ts";
import { type Ask, WhoCanRead } from "./WhoCanRead.tsx";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function ItemPage({
  itemId,
  inspection,
  onAsk,
}: {
  itemId: string;
  inspection: Inspection;
  /** Asks the plane who can read an item, as the viewer (card E2.13). */
  onAsk: Ask;
}) {
  const { items } = inspection.read;
  const { events } = inspection;
  const graph = useMemo(() => provenanceGraph(itemId, items, events), [itemId, items, events]);
  const versions = useMemo(() => itemVersions(itemId, items, events), [itemId, items, events]);
  const naming = useMemo(() => itemEvents(itemId, events), [itemId, events]);
  const [selected, setSelected] = useState<MemoryEvent | null>(null);
  const [active, setActive] = useState<ItemNode | null>(null);
  const [filter, setFilter] = useState<TimelineFilter>(NO_FILTER);
  const focus = graph?.nodes.find((n): n is ItemNode => n.kind === "item" && n.focus) ?? null;

  const activate = (node: GraphNode) => {
    if (node.kind === "event") {
      setActive(null);
      setSelected(node.event);
    } else {
      setSelected(null);
      setActive(node);
    }
  };

  return (
    <section className="item-page" data-testid="item-page" data-id={itemId}>
      <p>
        <a href="#/" data-testid="item-back">
          Back to the workspace
        </a>
      </p>
      <h2>
        Item <code>{itemId}</code>
      </h2>
      <WhoCanRead itemId={itemId} onAsk={onAsk} />
      {graph === null || focus === null ? (
        <p className="empty" data-testid="item-unknown">
          Nothing this viewer may see shows this item.
        </p>
      ) : (
        <div className="item-grid">
          <section className="item-summary" data-testid="item-summary">
            {focus.state === null ? (
              <p className="muted">
                This viewer sees the decisions about this item, not its content.
              </p>
            ) : (
              <>
                <p>{versionText(focus.state)}</p>
                <dl>
                  <Pair term="scope">{focus.state.scope}</Pair>
                  <Pair term="class">{focus.state.class}</Pair>
                  <Pair term="status">{focus.state.status}</Pair>
                  <Pair term="version">{String(focus.state.version)}</Pair>
                  <Pair term="owner">{focus.state.owner}</Pair>
                </dl>
              </>
            )}
          </section>

          <section className="provenance" data-testid="provenance">
            <h3>Provenance</h3>
            <p className="muted" data-testid="graph-summary">
              {plural(graph.items, "item", "items")} and{" "}
              {plural(graph.decisions, "decision", "decisions")} this viewer may see.
            </p>
            <ProvenanceGraphView graph={graph} onActivate={activate} />
            <div className="graph-list">
              <h4>The graph as a list</h4>
              <ul data-testid="graph-list">
                {graph.nodes.map((n) => (
                  <li key={n.id} data-testid="graph-list-item" data-id={n.id} data-kind={n.kind}>
                    {n.kind === "item" ? (
                      <a href={itemHref(n.id)}>{nodeLabel(n)}</a>
                    ) : (
                      <button type="button" onClick={() => activate(n)}>
                        {nodeLabel(n)}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <aside className="item-aside">
            {active !== null && (
              <section data-testid="graph-active">
                <h3>{active.focus ? "This item" : "Item"}</h3>
                <p>{nodeLabel(active)}</p>
                {!active.focus && <a href={itemHref(active.id)}>Its page</a>}
              </section>
            )}
            {selected !== null && <EventDetail event={selected} />}
            {active === null && selected === null && (
              <p className="empty">Select a node, or an event in the table, to see it here.</p>
            )}
          </aside>

          <Versions versions={versions} />

          <section className="item-events">
            <h3>Events naming this item</h3>
            <EventTable
              prefix="item-"
              events={naming}
              filter={filter}
              onFilter={setFilter}
              selected={selected}
              onSelect={(e) => {
                setActive(null);
                setSelected(e);
              }}
            />
          </section>
        </div>
      )}
    </section>
  );
}

/** Two versions side by side, the later one's event below; the last two by default. */
function Versions({ versions }: { versions: Version[] }) {
  const [beforeKey, setBefore] = useState(versions.at(-2)?.key ?? "");
  const [afterKey, setAfter] = useState(versions.at(-1)?.key ?? "");
  const before = versions.find((v) => v.key === beforeKey);
  const after = versions.find((v) => v.key === afterKey);
  const options = versions.map((v) => (
    <option key={v.key} value={v.key}>
      {v.label}
    </option>
  ));
  return (
    <section className="versions" data-testid="versions">
      <h3>Versions</h3>
      {versions.length < 2 || before === undefined || after === undefined ? (
        <p className="muted" data-testid="versions-one">
          This viewer may see one version of this item
          {versions[0] ? `: ${versions[0].label}.` : "."}
        </p>
      ) : (
        <>
          <div className="filters">
            <label>
              Before
              <select
                data-testid="version-before"
                value={beforeKey}
                onChange={(e) => setBefore(e.target.value)}
              >
                {options}
              </select>
            </label>
            <label>
              After
              <select
                data-testid="version-after"
                value={afterKey}
                onChange={(e) => setAfter(e.target.value)}
              >
                {options}
              </select>
            </label>
          </div>
          <TextDiff
            before={before.text}
            after={after.text}
            beforeLabel={before.label}
            afterLabel={after.label}
          />
          {after.event === null ? (
            <p className="muted" data-testid="version-event" data-event="">
              No event this viewer may see made this version: it is the item as the read returns it
              now.
            </p>
          ) : (
            <p data-testid="version-event" data-event={after.event.id}>
              Made by event {after.event.seq}, {after.event.op}{" "}
              <span className={`decision ${after.event.decision}`}>{after.event.decision}</span>, by{" "}
              {after.event.actor} at {after.event.ts}, under <code>{after.event.policy_id}</code>:{" "}
              {after.event.reason}
            </p>
          )}
        </>
      )}
    </section>
  );
}
