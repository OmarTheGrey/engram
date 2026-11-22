// Small views the workspace page and the item page share (cards E8.5 and
// E8.11): a labelled pair, and an event's detail with a link to the page of
// the item it names.

import { eventDetail, itemHref } from "@engram/view";
import type { ReactNode } from "react";
import type { MemoryEvent } from "./api/index.ts";

export function Pair({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

/**
 * Every field of an event. An event naming an item links to that item's
 * page, which shows only what the viewer may see of it.
 */
export function EventDetail({ event }: { event: MemoryEvent }) {
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
      {event.item_id !== null && (
        <p>
          <a href={itemHref(event.item_id)} data-testid="event-item-open">
            The item's page
          </a>
        </p>
      )}
    </section>
  );
}
