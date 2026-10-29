// The inspector v0 (cards E8.5 and E8.6; plan docs/tasks/gate-b-plan.md,
// decision 5): the workspace as one viewer. The viewer picker starts from the
// viewer `engram serve --as` named; the scope lanes are one Plane.read as the
// viewer; the timeline is the events visibleEvents gives the viewer, filtered
// here by scope, op and decision; selecting an event shows its detail, and a
// read the viewer made is explained (Plane.explain) with the filtered counts
// its event records. Another actor's read shows its event and the line that
// only its reader may explain it. Every call goes through the generated
// client (data.ts); the logic of each view is in view.ts.
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { Actor, EngramClient, MemoryEvent } from "./api/index.ts";
import { fetchExplain, fetchViewer, type Inspection, inspect } from "./data.ts";
import {
  type ExplainView,
  eventDetail,
  filterEvents,
  filterOptions,
  formatMemberships,
  keepSelection,
  type Lane,
  LEVELS,
  NO_FILTER,
  scopeText,
  score,
  type TimelineFilter,
  viewerFrom,
} from "./view.ts";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function App({ client }: { client: EngramClient }) {
  const [viewer, setViewer] = useState<Actor | null>(null);
  const [ready, setReady] = useState(false);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TimelineFilter>(NO_FILTER);
  // On a change of viewer the selection stays only if it is a read (another
  // actor's read then shows its event and who may explain it, decision 5) or
  // the new viewer may see it (keepSelection); the filters reset.
  const [selected, setSelected] = useState<MemoryEvent | null>(null);
  const [explain, setExplain] = useState<ExplainView | null>(null);

  useEffect(() => {
    let live = true;
    fetchViewer(client)
      .then((v) => {
        if (live) setViewer(v);
      })
      .catch((e) => {
        if (live) setError(message(e));
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, [client]);

  useEffect(() => {
    if (viewer === null) return;
    let live = true;
    setInspection(null);
    setError(null);
    setFilter(NO_FILTER);
    inspect(client, viewer)
      .then((i) => {
        if (!live) return;
        setSelected((s) => keepSelection(s, i.events));
        setInspection(i);
      })
      .catch((e) => live && setError(message(e)));
    return () => {
      live = false;
    };
  }, [client, viewer]);

  useEffect(() => {
    setExplain(null);
    if (viewer === null || selected === null || selected.op !== "read") return;
    let live = true;
    fetchExplain(client, viewer, selected, inspection?.contents)
      .then((v) => live && setExplain(v))
      .catch((e) => live && setError(message(e)));
    return () => {
      live = false;
    };
  }, [client, viewer, selected, inspection]);

  return (
    <div className="app">
      <header>
        <h1>Engram inspector</h1>
        {ready && <ViewerPicker viewer={viewer} onChange={setViewer} />}
      </header>
      {error !== null && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {ready && viewer === null && (
        <p className="empty">Name a viewer to see what it may read and the events it may see.</p>
      )}
      {inspection !== null && (
        <main>
          <Lanes lanes={inspection.lanes} readId={inspection.read.event.id} />
          <Timeline
            events={inspection.events}
            filter={filter}
            onFilter={setFilter}
            selected={selected}
            onSelect={setSelected}
          />
          <aside>
            {selected === null ? (
              <p className="empty">Select an event to see its detail.</p>
            ) : (
              <>
                <EventDetail event={selected} />
                {explain !== null && <Explain view={explain} />}
              </>
            )}
          </aside>
        </main>
      )}
    </div>
  );
}

function ViewerPicker({
  viewer,
  onChange,
}: {
  viewer: Actor | null;
  onChange: (viewer: Actor) => void;
}) {
  const [id, setId] = useState(viewer?.id ?? "");
  const [level, setLevel] = useState<string>(viewer?.level ?? "person");
  const [memberships, setMemberships] = useState(formatMemberships(viewer?.memberships ?? []));
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <form
      className="viewer"
      onSubmit={(e) => {
        e.preventDefault();
        const next = viewerFrom(id, level, memberships);
        if (typeof next === "string") return setProblem(next);
        setProblem(null);
        onChange(next);
      }}
    >
      <label>
        Viewer
        <input data-testid="viewer-id" value={id} onChange={(e) => setId(e.target.value)} />
      </label>
      <label>
        Level
        <select data-testid="viewer-level" value={level} onChange={(e) => setLevel(e.target.value)}>
          {LEVELS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      <label>
        Member scopes
        <input
          data-testid="viewer-memberships"
          value={memberships}
          onChange={(e) => setMemberships(e.target.value)}
        />
      </label>
      <button type="submit" data-testid="viewer-apply">
        View as
      </button>
      {viewer !== null && (
        <span className="muted" data-testid="viewer-current">
          viewing as {viewer.id}
        </span>
      )}
      {problem !== null && <span className="error">{problem}</span>}
    </form>
  );
}

function Lanes({ lanes, readId }: { lanes: Lane[]; readId: string }) {
  return (
    <section className="lanes">
      <h2>Scope lanes</h2>
      <p className="muted">
        What the viewer may read now, from one read through the plane (read{" "}
        <code data-testid="lanes-read">{readId}</code>).
      </p>
      <div className="lane-row">
        {lanes.map((lane) => (
          <div className="lane" key={lane.scope} data-testid="lane" data-scope={lane.scope}>
            <h3>
              {lane.scope}{" "}
              <span className="muted">{lane.member ? "member" : "through a grant"}</span>
            </h3>
            {lane.items.length === 0 && <p className="muted">nothing to read</p>}
            {lane.items.map((item) => (
              <article key={item.id} className="card" data-testid="lane-item" data-id={item.id}>
                <p>{item.content}</p>
                <dl>
                  <Pair term="class">{item.class}</Pair>
                  <Pair term="status">{item.status}</Pair>
                  <Pair term="provenance">{item.provenance}</Pair>
                  <Pair term="validity">{item.validity}</Pair>
                  <Pair term="rank">{item.rank ?? "-"}</Pair>
                </dl>
              </article>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Timeline({
  events,
  filter,
  onFilter,
  selected,
  onSelect,
}: {
  events: MemoryEvent[];
  filter: TimelineFilter;
  onFilter: (f: TimelineFilter) => void;
  selected: MemoryEvent | null;
  onSelect: (e: MemoryEvent) => void;
}) {
  const options = useMemo(() => filterOptions(events), [events]);
  const shown = useMemo(() => filterEvents(events, filter), [events, filter]);
  const choose = (key: keyof TimelineFilter, values: string[]) => (
    <label>
      {key}
      <select
        data-testid={`filter-${key}`}
        value={filter[key] ?? ""}
        onChange={(e) =>
          onFilter({ ...filter, [key]: e.target.value === "" ? null : e.target.value })
        }
      >
        <option value="">any</option>
        {values.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="timeline">
      <h2>Timeline</h2>
      <div className="filters">
        {choose("scope", options.scopes)}
        {choose("op", options.ops)}
        {choose("decision", options.decisions)}
        <span className="muted" data-testid="timeline-count">
          {shown.length} of {events.length} events
        </span>
      </div>
      <table>
        <thead>
          <tr>
            <th>seq</th>
            <th>time</th>
            <th>op</th>
            <th>decision</th>
            <th>actor</th>
            <th>scope</th>
            <th>policy id</th>
            <th>reason</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((e) => (
            <tr
              key={e.id}
              data-testid="timeline-row"
              data-id={e.id}
              data-op={e.op}
              className={selected?.id === e.id ? "selected" : undefined}
              onClick={() => onSelect(e)}
            >
              <td>{e.seq}</td>
              <td>{e.ts}</td>
              <td>{e.op}</td>
              <td className={`decision ${e.decision}`}>{e.decision}</td>
              <td>{e.actor}</td>
              <td>{scopeText(e)}</td>
              <td>
                <code>{e.policy_id}</code>
              </td>
              <td className="reason">{e.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EventDetail({ event }: { event: MemoryEvent }) {
  return (
    <section data-testid="event-detail">
      <h2>Event</h2>
      <dl>
        {eventDetail(event).map(([term, value]) => (
          <Pair key={term} term={term}>
            {value}
          </Pair>
        ))}
      </dl>
    </section>
  );
}

function Explain({ view }: { view: ExplainView }) {
  if (view.kind === "not-read") return null;
  if (view.kind === "other")
    return (
      <section className="explain" data-testid="explain">
        <h2>Explain</h2>
        <p data-testid="explain-other">{view.line}</p>
      </section>
    );
  const { counts } = view;
  return (
    <section className="explain" data-testid="explain">
      <h2>Explain</h2>
      {counts === null ? (
        <p className="muted">This read's reason predates the counted format.</p>
      ) : (
        <>
          <p>
            Returned {counts.returned} of {counts.candidates} candidates;{" "}
            <strong data-testid="explain-filtered">{counts.filtered}</strong> filtered.
          </p>
          <ul>
            {view.categories.map((c) => (
              <li key={c.key} data-testid="explain-category" data-key={c.key}>
                {c.count} {c.label}
              </li>
            ))}
          </ul>
          <p className="muted">
            {counts.out_of_reach} projected {counts.out_of_reach === 1 ? "item" : "items"} outside
            the reader's reach {counts.out_of_reach === 1 ? "was" : "were"} not candidates.
          </p>
        </>
      )}
      <p className="muted" data-testid="explain-content-note">
        An item's text is what the lanes show now, not its text when the read was made; an item not
        in the lanes shows its id only.
      </p>
      <table>
        <thead>
          <tr>
            <th>rank</th>
            <th>item (content now)</th>
            <th>score</th>
            <th>admitted by</th>
            <th>grants used</th>
            <th>validity</th>
          </tr>
        </thead>
        <tbody>
          {view.rows.map((r) => (
            <tr key={r.itemId} data-testid="explain-row" data-id={r.itemId}>
              <td>{r.rank}</td>
              <td>
                {r.content ?? <code>{r.itemId}</code>}
                {r.content !== null && (
                  <div className="muted">
                    <code>{r.itemId}</code>
                  </div>
                )}
              </td>
              <td>
                {score(r.total)}
                <div className="muted">
                  {r.components.map(([name, value]) => `${name} ${score(value)}`).join(", ")}
                </div>
              </td>
              <td>
                <code>{r.admittedBy}</code>
              </td>
              <td>{r.grantsUsed.length === 0 ? "-" : r.grantsUsed.join(", ")}</td>
              <td>{r.validity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Pair({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </>
  );
}
