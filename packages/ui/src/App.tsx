// The inspector v0 (cards E8.5 and E8.6; plan docs/tasks/gate-b-plan.md,
// decision 5): the workspace as one viewer. The viewer picker starts from the
// viewer `engram serve --as` named; the scope lanes are one Plane.read as the
// viewer; the timeline is the events visibleEvents gives the viewer, filtered
// here by scope, op and decision; selecting an event shows its detail, and a
// read the viewer made is explained (Plane.explain) with the filtered counts
// its event records. Another actor's read shows its event and the line that
// only its reader may explain it. Every call goes through the generated
// client (data.ts); the logic of each view is in view.ts.
//
// The twin screens (card E9.4): the lanes are grouped into the viewer's
// person scope, its role scopes, the team and org scopes it is a member of,
// and what it reached through a grant; each item lists its grants, and in a
// scope the viewer is a member of, the grants editor adds or removes one
// through Plane.changeGrants. The plane decides; the editor shows the
// decision and its event's rule and reason, and the lanes and timeline are
// read again, so the change's update event appears on the timeline.
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { Actor, EngramClient, Grant, MemoryEvent } from "./api/index.ts";
import { changeGrants, fetchExplain, fetchViewer, type Inspection, inspect } from "./data.ts";
import {
  EMPTY_DRAFT,
  type ExplainView,
  eventDetail,
  filterEvents,
  filterOptions,
  formatMemberships,
  GRANT_CLASSES,
  GRANT_MODES,
  type GrantDraft,
  type GrantOutcome,
  grantFrom,
  grantLabel,
  grantOutcome,
  keepSelection,
  type Lane,
  type LaneItem,
  LEVELS,
  laneGroups,
  NO_FILTER,
  scopeText,
  score,
  type TimelineFilter,
  viewerFrom,
} from "./view.ts";

type GrantChangeRequest = { add?: Grant[]; remove?: Grant[] };

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
  // A grant change reads the lanes and the timeline again (card E9.4); its
  // decision stays on screen until the viewer changes.
  const [reload, setReload] = useState(0);
  const [outcome, setOutcome] = useState<GrantOutcome | null>(null);

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

  // A new viewer resets the timeline's filters and clears a grant decision.
  const chooseViewer = (next: Actor) => {
    setOutcome(null);
    setFilter(NO_FILTER);
    setViewer(next);
  };

  useEffect(() => {
    if (viewer === null) return;
    let live = true;
    // The read is again on every change of viewer and after every grant change.
    void reload;
    setInspection(null);
    setError(null);
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
  }, [client, viewer, reload]);

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
        {ready && <ViewerPicker viewer={viewer} onChange={chooseViewer} />}
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
          <Lanes
            lanes={inspection.lanes}
            readId={inspection.read.event.id}
            policy={inspection.read.policy}
            outcome={outcome}
            onGrant={(itemId, change) => {
              if (viewer === null) return;
              changeGrants(client, viewer, itemId, change)
                .then((r) => {
                  setOutcome(grantOutcome(itemId, r));
                  setReload((n) => n + 1);
                })
                .catch((e) => setError(message(e)));
            }}
          />
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

function Lanes({
  lanes,
  readId,
  policy,
  outcome,
  onGrant,
}: {
  lanes: Lane[];
  readId: string;
  policy: string;
  outcome: GrantOutcome | null;
  onGrant: (itemId: string, change: GrantChangeRequest) => void;
}) {
  const groups = useMemo(() => laneGroups(lanes), [lanes]);
  return (
    <section className="lanes">
      <h2>Scope lanes</h2>
      <p className="muted">
        What the viewer may read now, from one read through the plane (read{" "}
        <code data-testid="lanes-read">{readId}</code>) under policy{" "}
        <code data-testid="lanes-policy">{policy}</code>.
      </p>
      {groups.map((group) => (
        <div className="lane-group" key={group.key} data-testid="lane-group" data-group={group.key}>
          <h3>{group.title}</h3>
          <p className="muted lane-group-note">{group.note}</p>
          {group.lanes.length === 0 ? (
            <p className="muted" data-testid="lane-group-empty">
              The viewer is a member of no {group.key === "role" ? "role" : "person"} scope.
            </p>
          ) : (
            <div className="lane-row">
              {group.lanes.map((lane) => (
                <LaneView key={lane.scope} lane={lane} outcome={outcome} onGrant={onGrant} />
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function LaneView({
  lane,
  outcome,
  onGrant,
}: {
  lane: Lane;
  outcome: GrantOutcome | null;
  onGrant: (itemId: string, change: GrantChangeRequest) => void;
}) {
  return (
    <div className="lane" data-testid="lane" data-scope={lane.scope} data-kind={lane.kind}>
      <h4>
        {lane.scope} <span className="muted">{lane.member ? "member" : "through a grant"}</span>
      </h4>
      {lane.items.length === 0 && <p className="muted">nothing to read</p>}
      {lane.items.map((item) => (
        <article key={item.id} className="card" data-testid="lane-item" data-id={item.id}>
          <p>{item.content}</p>
          <dl>
            <Pair term="class">{item.class}</Pair>
            <Pair term="status">{item.status}</Pair>
            <Pair term="owner">{item.owner}</Pair>
            <Pair term="provenance">{item.provenance}</Pair>
            <Pair term="validity">{item.validity}</Pair>
            <Pair term="rank">{item.rank ?? "-"}</Pair>
          </dl>
          <Grants
            item={item}
            editable={lane.member}
            outcome={outcome?.itemId === item.id ? outcome : null}
            onGrant={onGrant}
          />
        </article>
      ))}
    </div>
  );
}

/**
 * An item's grants, and in a scope the viewer is a member of the editor that
 * adds or removes one. Which change is allowed is the plane's decision.
 */
function Grants({
  item,
  editable,
  outcome,
  onGrant,
}: {
  item: LaneItem;
  editable: boolean;
  outcome: GrantOutcome | null;
  onGrant: (itemId: string, change: GrantChangeRequest) => void;
}) {
  return (
    <div className="grants" data-testid="grants">
      <p className="muted">
        Grants
        {item.grantsShown === "yours" && (
          <span data-testid="grants-yours">
            {" "}
            naming you only; its owner {item.owner} sees all of them
          </span>
        )}
      </p>
      {item.grants.length === 0 ? (
        <p className="muted" data-testid="grants-none">
          none: only members of its scope read it
        </p>
      ) : (
        <ul>
          {item.grants.map((g) => (
            <li key={grantLabel(g)} data-testid="grant" data-to={g.to}>
              {grantLabel(g)}{" "}
              {editable && (
                <button
                  type="button"
                  data-testid="grant-remove"
                  onClick={() => onGrant(item.id, { remove: [g] })}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && <GrantForm onAdd={(g) => onGrant(item.id, { add: [g] })} />}
      {outcome !== null && (
        <p
          data-testid="grant-outcome"
          data-decision={outcome.decision}
          data-event={outcome.eventId}
        >
          <span className={`decision ${outcome.decision}`}>{outcome.decision}</span>{" "}
          <code data-testid="grant-outcome-policy">{outcome.policyId}</code>: {outcome.reason}
        </p>
      )}
    </div>
  );
}

function GrantForm({ onAdd }: { onAdd: (grant: Grant) => void }) {
  const [draft, setDraft] = useState<GrantDraft>(EMPTY_DRAFT);
  const [problem, setProblem] = useState<string | null>(null);
  const set = (key: keyof GrantDraft) => (value: string) => setDraft({ ...draft, [key]: value });
  return (
    <details data-testid="grant-add">
      <summary>Add a grant</summary>
      <form
        className="grant-form"
        onSubmit={(e) => {
          e.preventDefault();
          const grant = grantFrom(draft);
          if (typeof grant === "string") return setProblem(grant);
          setProblem(null);
          onAdd(grant);
        }}
      >
        <label>
          To
          <input
            data-testid="grant-to"
            placeholder="person:sam"
            value={draft.to}
            onChange={(e) => set("to")(e.target.value)}
          />
        </label>
        <label>
          Class
          <select
            data-testid="grant-class"
            value={draft.class}
            onChange={(e) => set("class")(e.target.value)}
          >
            <option value="">none</option>
            {GRANT_CLASSES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Mode
          <select
            data-testid="grant-mode"
            value={draft.mode}
            onChange={(e) => set("mode")(e.target.value)}
          >
            {GRANT_MODES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          Expires (UTC)
          <input
            data-testid="grant-expires"
            placeholder="2026-12-01"
            value={draft.expires}
            onChange={(e) => set("expires")(e.target.value)}
          />
        </label>
        <button type="submit" data-testid="grant-submit">
          Grant
        </button>
        {problem !== null && (
          <span className="error" data-testid="grant-problem">
            {problem}
          </span>
        )}
      </form>
    </details>
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
