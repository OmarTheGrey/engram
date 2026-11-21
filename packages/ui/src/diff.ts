// The text diff (card E8.11): two texts as side-by-side rows, for the item
// page's version diff and for any other screen that compares two texts (card
// E8.10's diff between two snapshots of a scope is meant to reuse it, with
// the TextDiff component in TextDiff.tsx). Lines come from jsdiff's line
// diff; a removed block followed by an added one is paired line by line, and
// each pair is marked word by word with jsdiff's word diff. Pure: no React.
import { diffLines, diffWordsWithSpace } from "diff";

export interface Segment {
  text: string;
  change: "same" | "added" | "removed";
}

export interface DiffRow {
  /** A line on both sides unchanged, a line replaced, a line only before, a line only after. */
  kind: "same" | "changed" | "removed" | "added";
  before: Segment[] | null;
  after: Segment[] | null;
  /** The line's number on each side, from 1; null on the side it is missing from. */
  beforeLine: number | null;
  afterLine: number | null;
}

export interface TextDiff {
  rows: DiffRow[];
  /** Lines only after, or replaced, and lines only before, or replaced. */
  added: number;
  removed: number;
  /** The two texts are equal, byte for byte. */
  same: boolean;
}

/** A text that ends in a newline, so its last line compares equal to the same line followed by more. */
const ended = (text: string) => (text === "" || text.endsWith("\n") ? text : `${text}\n`);

/** A change's value as lines, without the newline that ends the last. */
const linesOf = (value: string) => value.replace(/\n$/, "").split("\n");

/** Two lines marked word by word: what each side keeps and what it changed. */
function pair(before: string, after: string): { before: Segment[]; after: Segment[] } {
  const b: Segment[] = [];
  const a: Segment[] = [];
  for (const part of diffWordsWithSpace(before, after)) {
    if (!part.added) b.push({ text: part.value, change: part.removed ? "removed" : "same" });
    if (!part.removed) a.push({ text: part.value, change: part.added ? "added" : "same" });
  }
  return { before: b, after: a };
}

/** The side-by-side diff of `before` and `after`. */
export function textDiff(before: string, after: string): TextDiff {
  const rows: DiffRow[] = [];
  let beforeLine = 0;
  let afterLine = 0;
  let added = 0;
  let removed = 0;
  // A newline at the very end is not a change of a line.
  const changes = diffLines(ended(before), ended(after));
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    if (change === undefined || change.value === "") continue;
    if (!change.added && !change.removed) {
      for (const line of linesOf(change.value))
        rows.push({
          kind: "same",
          before: [{ text: line, change: "same" }],
          after: [{ text: line, change: "same" }],
          beforeLine: ++beforeLine,
          afterLine: ++afterLine,
        });
      continue;
    }
    const next = changes[i + 1];
    const gone = change.removed ? linesOf(change.value) : [];
    const come = change.added ? linesOf(change.value) : next?.added ? linesOf(next.value) : [];
    if (change.removed && next?.added) i++;
    removed += gone.length;
    added += come.length;
    for (let k = 0; k < Math.max(gone.length, come.length); k++) {
      const b = gone[k];
      const a = come[k];
      if (b !== undefined && a !== undefined)
        rows.push({
          kind: "changed",
          ...pair(b, a),
          beforeLine: ++beforeLine,
          afterLine: ++afterLine,
        });
      else if (b !== undefined)
        rows.push({
          kind: "removed",
          before: [{ text: b, change: "removed" }],
          after: null,
          beforeLine: ++beforeLine,
          afterLine: null,
        });
      else if (a !== undefined)
        rows.push({
          kind: "added",
          before: null,
          after: [{ text: a, change: "added" }],
          beforeLine: null,
          afterLine: ++afterLine,
        });
    }
  }
  return { rows, added, removed, same: before === after };
}
