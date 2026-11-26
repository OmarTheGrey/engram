// The event table (card E8.11, replacing the timeline of card E8.5): the
// events the viewer may see, filtered by type (op), decision, actor and
// scope in view.ts, sorted by any column through TanStack Table, and
// virtualised by TanStack Virtual, so only the rows in view and a margin
// around them are in the page: tens of thousands of events stay fast.
// Rows are one line high (a long reason is cut, its full text in the event's
// detail and the row's title); headers sort by mouse or keyboard, and a row
// is selected by click, Enter or Space.

import { filterEvents, filterOptions, scopeText, type TimelineFilter } from "@engram/view";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  type SortingState,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef, useState } from "react";
import type { MemoryEvent } from "./api/index.ts";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
});
const helper = createColumnHelper<typeof features, MemoryEvent>();
const columns = helper.columns([
  helper.accessor("seq", { id: "seq", header: "seq" }),
  helper.accessor("ts", { id: "time", header: "time", sortFn: "text" }),
  helper.accessor("op", { id: "op", header: "op", sortFn: "text" }),
  helper.accessor("decision", { id: "decision", header: "decision", sortFn: "text" }),
  helper.accessor("actor", { id: "actor", header: "actor", sortFn: "text" }),
  helper.accessor((e) => scopeText(e), { id: "scope", header: "scope", sortFn: "text" }),
  helper.accessor("policy_id", { id: "policy", header: "policy id", sortFn: "text" }),
  helper.accessor("reason", { id: "reason", header: "reason", enableSorting: false }),
]);

/** A row's height in pixels; the stylesheet holds every row to it. */
const ROW_HEIGHT = 29;
/** Rows rendered beyond each edge of the view. */
const OVERSCAN = 30;

const FILTERS = [
  ["scope", "scope"],
  ["op", "type"],
  ["decision", "decision"],
  ["actor", "actor"],
] as const satisfies readonly (readonly [keyof TimelineFilter, string])[];

const optionsOf = {
  scope: "scopes",
  op: "ops",
  decision: "decisions",
  actor: "actors",
} as const satisfies Record<keyof TimelineFilter, keyof ReturnType<typeof filterOptions>>;

export function EventTable({
  events,
  filter,
  onFilter,
  selected,
  onSelect,
  prefix = "",
}: {
  events: readonly MemoryEvent[];
  filter: TimelineFilter;
  onFilter: (f: TimelineFilter) => void;
  selected: MemoryEvent | null;
  onSelect: (e: MemoryEvent) => void;
  /** Before every test id, so two tables can be told apart: "" on the workspace, "item-" on an item's page. */
  prefix?: string;
}) {
  const options = useMemo(() => filterOptions(events), [events]);
  const shown = useMemo(() => filterEvents(events, filter), [events, filter]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useTable({
    features,
    columns,
    data: shown,
    getRowId: (e) => e.id,
    state: { sorting },
    onSortingChange: setSorting,
  });
  const rows = table.getRowModel().rows;
  const scroll = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    getItemKey: (i) => rows[i]?.id ?? i,
  });
  const visible = virtualizer.getVirtualItems();
  const padTop = visible[0]?.start ?? 0;
  const padBottom = Math.max(0, virtualizer.getTotalSize() - (visible.at(-1)?.end ?? 0));
  const width = columns.length;

  return (
    <>
      <div className="filters">
        {FILTERS.map(([key, label]) => (
          <label key={key}>
            {label}
            <select
              data-testid={`${prefix}filter-${key}`}
              value={filter[key] ?? ""}
              onChange={(e) =>
                onFilter({ ...filter, [key]: e.target.value === "" ? null : e.target.value })
              }
            >
              <option value="">any</option>
              {options[optionsOf[key]].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
        <span className="muted" data-testid={`${prefix}timeline-count`}>
          {shown.length} of {events.length} events
        </span>
      </div>
      <div className="table-scroll" ref={scroll} data-testid={`${prefix}timeline-scroll`}>
        <table className="event-table">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={`col-${header.column.id}`}
                      aria-sort={
                        sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                      }
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="sort"
                          data-testid={`${prefix}sort-${header.column.id}`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          <span aria-hidden="true">
                            {sorted === "asc" ? " ▲" : sorted === "desc" ? " ▼" : ""}
                          </span>
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {padTop > 0 && (
              <tr className="spacer" style={{ height: padTop }}>
                <td colSpan={width} />
              </tr>
            )}
            {visible.map((v) => {
              const row = rows[v.index];
              if (row === undefined) return null;
              const e = row.original;
              const choose = () => onSelect(e);
              return (
                <tr
                  key={row.id}
                  data-testid={`${prefix}timeline-row`}
                  data-id={e.id}
                  data-op={e.op}
                  tabIndex={0}
                  aria-selected={selected?.id === e.id}
                  className={selected?.id === e.id ? "selected" : undefined}
                  onClick={choose}
                  onKeyDown={(k) => {
                    if (k.key === "Enter" || k.key === " ") {
                      k.preventDefault();
                      choose();
                    }
                  }}
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
                  <td className="reason" title={e.reason}>
                    {e.reason}
                  </td>
                </tr>
              );
            })}
            {padBottom > 0 && (
              <tr className="spacer" style={{ height: padBottom }}>
                <td colSpan={width} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
