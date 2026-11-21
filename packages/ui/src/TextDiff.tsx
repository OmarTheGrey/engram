// Two texts side by side (card E8.11), from textDiff in diff.ts. The item
// page diffs two versions of an item with it; card E8.10's diff between two
// snapshots of a scope is meant to reuse it as it is, giving each side a
// label and a text. Removed words are <del>, added words <ins>, so the
// change is in the markup and not in colour alone.
import { useMemo } from "react";
import { type Segment, textDiff } from "./diff.ts";

function Segments({ segments }: { segments: Segment[] | null }) {
  if (segments === null) return null;
  return (
    <>
      {segments.map((s, i) =>
        s.change === "removed" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments have no identity but their place
          <del key={i} data-testid="diff-removed">
            {s.text}
          </del>
        ) : s.change === "added" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments have no identity but their place
          <ins key={i} data-testid="diff-added">
            {s.text}
          </ins>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments have no identity but their place
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

export function TextDiff({
  before,
  after,
  beforeLabel,
  afterLabel,
}: {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
}) {
  const diff = useMemo(() => textDiff(before, after), [before, after]);
  return (
    <div className="text-diff" data-testid="diff">
      <p className="muted" data-testid="diff-summary">
        {diff.same
          ? "The two texts are the same."
          : `Lines removed or changed: ${diff.removed}. Lines added or changed: ${diff.added}.`}
      </p>
      <table>
        <thead>
          <tr>
            <th colSpan={2}>{beforeLabel}</th>
            <th colSpan={2}>{afterLabel}</th>
          </tr>
        </thead>
        <tbody>
          {diff.rows.map((r, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a diff row is its place in the diff
            <tr key={i} data-testid="diff-row" data-kind={r.kind}>
              <td className="line-no">{r.beforeLine ?? ""}</td>
              <td className={`diff-side before ${r.kind}`}>
                <Segments segments={r.before} />
              </td>
              <td className="line-no">{r.afterLine ?? ""}</td>
              <td className={`diff-side after ${r.kind}`}>
                <Segments segments={r.after} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
