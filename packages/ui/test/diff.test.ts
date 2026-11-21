// The text diff (card E8.11), shared by the item page's version diff and the
// scope snapshot diff of card E8.10: two texts as side-by-side rows, lines
// from jsdiff's line diff, a changed line paired with its replacement and
// marked word by word.
import { describe, expect, it } from "vitest";
import { type DiffRow, textDiff } from "../src/diff.ts";

const sides = (rows: DiffRow[]) =>
  rows.map((r) => [
    r.kind,
    r.before?.map((s) => s.text).join("") ?? null,
    r.after?.map((s) => s.text).join("") ?? null,
  ]);
const marked = (rows: DiffRow[], change: "added" | "removed") =>
  rows.flatMap((r) => [...(r.before ?? []), ...(r.after ?? [])].filter((s) => s.change === change)).map((s) => s.text);

describe("the text diff", () => {
  it("pairs a changed line with its replacement and marks the words that changed", () => {
    const d = textDiff("The freeze moves to Monday.", "The freeze moves to Tuesday.");
    expect(sides(d.rows)).toEqual([
      ["changed", "The freeze moves to Monday.", "The freeze moves to Tuesday."],
    ]);
    expect(marked(d.rows, "removed")).toEqual(["Monday."]);
    expect(marked(d.rows, "added")).toEqual(["Tuesday."]);
    expect(d).toMatchObject({ added: 1, removed: 1, same: false });
  });

  it("keeps unchanged lines on both sides, numbered on each", () => {
    const d = textDiff("a\nb\nc", "a\nB\nc\nd");
    expect(sides(d.rows)).toEqual([
      ["same", "a", "a"],
      ["changed", "b", "B"],
      ["same", "c", "c"],
      ["added", null, "d"],
    ]);
    expect(d.rows.map((r) => [r.beforeLine, r.afterLine])).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [null, 4],
    ]);
    expect(d).toMatchObject({ added: 2, removed: 1 });
  });

  it("shows a removed block longer than its replacement as changed rows, then removed ones", () => {
    const d = textDiff("x\none\ntwo\ny", "x\nuno\ny");
    expect(sides(d.rows)).toEqual([
      ["same", "x", "x"],
      ["changed", "one", "uno"],
      ["removed", "two", null],
      ["same", "y", "y"],
    ]);
  });

  it("says when the two texts are the same", () => {
    const d = textDiff("same\n", "same\n");
    expect(d.same).toBe(true);
    expect(sides(d.rows)).toEqual([["same", "same", "same"]]);
  });

  it("diffs from nothing and to nothing", () => {
    expect(sides(textDiff("", "new").rows)).toEqual([["added", null, "new"]]);
    expect(sides(textDiff("old", "").rows)).toEqual([["removed", "old", null]]);
    expect(textDiff("", "").rows).toEqual([]);
  });
});
