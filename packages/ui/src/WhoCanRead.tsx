// Who can read this memory (card E2.13): the panel on an item's page. It asks
// the plane (Plane.whoCanReadItem, POST /who-can-read/item, through data.ts)
// and lists each reader entry with the rule or grant that admits it. What the
// viewer is told is the plane's decision (decision item 53): a viewer who may
// neither read the item nor read its scope gets the refusal an unknown id
// gets, and grant holders are named to the owner only. view.ts's readerView
// only labels the answer.

import { type ReaderView, readerView } from "@engram/view";
import { useState } from "react";
import type { WhoCanReadAnswer } from "./api/index.ts";

export type Ask = (itemId: string) => Promise<WhoCanReadAnswer>;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Who can read one item, as the plane tells the viewer. */
export function WhoCanRead({ itemId, onAsk }: { itemId: string; onAsk: Ask }) {
  const [view, setView] = useState<ReaderView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <section className="who-can-read" data-testid="who-can-read">
      <h3>Who can read this</h3>
      <button
        type="button"
        data-testid="who-can-read-ask"
        onClick={() =>
          onAsk(itemId)
            .then((a) => {
              setProblem(null);
              setView(readerView(a));
            })
            .catch((e) => setProblem(message(e)))
        }
      >
        Ask the plane
      </button>
      {problem !== null && <span className="error">{problem}</span>}
      {view !== null && (
        <div data-testid="who-can-read-answer" data-answered={String(view.answered)}>
          <p className="muted" data-testid="who-can-read-reason">
            {view.reason}
          </p>
          {view.closed !== null && (
            <p data-testid="who-can-read-closed">
              Nobody now: {`${view.closed.reason} (${view.closed.policy_id})`}
            </p>
          )}
          {view.answered && view.closed === null && view.rows.length === 0 && (
            <p className="muted">Nobody: no read matrix row or live grant admits a reader.</p>
          )}
          <ul>
            {view.rows.map((r) => (
              <li key={r.key} data-testid="who-can-read-reader" data-kind={r.kind} data-who={r.who}>
                {r.text} <code>{r.policyId}</code>
              </li>
            ))}
          </ul>
          {view.dormant.map((d) => (
            <p key={d.grant} className="muted" data-testid="who-can-read-dormant">
              dormant {`${d.grant}: ${d.reason}`}
            </p>
          ))}
          {view.withheld && (
            <p className="muted" data-testid="who-can-read-withheld">
              Grants naming others are shown to the owner only.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
