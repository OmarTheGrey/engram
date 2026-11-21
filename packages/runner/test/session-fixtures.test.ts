// Card D1's fixture sessions: the committed files are the generator's output
// for its seed, byte for byte, and pi's own SessionManager reads each one as
// the core parser does (the same final branch, the same leaves), so the
// parser models the format pi writes and reads, not a guess.
import { readdirSync, readFileSync } from "node:fs";
import {
  type FileEntry,
  SessionManager,
  type SessionTreeNode,
} from "@earendil-works/pi-coding-agent";
import { parseSessionJsonl, sessionTree } from "@engram/core";
import { describe, expect, test } from "vitest";
import {
  SESSION_FIXTURE_COUNT,
  SESSION_FIXTURE_SEED,
  sessionFixtureIndex,
  sessionFixtures,
} from "../src/session-fixtures.ts";

const DIR = new URL("../../../fixtures/sessions/d1/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, DIR), "utf8");
const committed = readdirSync(DIR).sort();

describe("the generator", () => {
  const set = sessionFixtures(SESSION_FIXTURE_SEED, SESSION_FIXTURE_COUNT);

  test("the committed folder is the generator's output for the seed, byte for byte", () => {
    expect(committed).toEqual([...Object.keys(set.files), "index.json"].sort());
    for (const [name, text] of Object.entries(set.files)) expect(read(name), name).toBe(text);
    expect(read("index.json")).toBe(sessionFixtureIndex(set));
  });

  test("writes the same files for the same seed and others for another", () => {
    expect(sessionFixtures(SESSION_FIXTURE_SEED)).toEqual(set);
    expect(sessionFixtures(SESSION_FIXTURE_SEED + 1).files["d1-01.jsonl"]).not.toBe(
      set.files["d1-01.jsonl"],
    );
  });

  test("fifty sessions with distinct task ids, and every shape the parser reads", () => {
    const s = set.index.sessions;
    expect(s).toHaveLength(50);
    expect(new Set(s.map((x) => x.task_id)).size).toBe(50);
    expect(new Set(s.map((x) => x.session_id)).size).toBe(50);
    // Each shape appears: a branch left with pi's summary, one left without,
    // none, a compaction, and both verdicts.
    expect(s.some((x) => x.branch === "summary")).toBe(true);
    expect(s.some((x) => x.branch === "plain")).toBe(true);
    expect(s.some((x) => x.branch === null)).toBe(true);
    expect(s.some((x) => x.compacted)).toBe(true);
    expect(s.some((x) => x.recovered)).toBe(true);
    expect(new Set(s.map((x) => x.verdict))).toEqual(new Set(["success", "failure"]));
  });
});

test("each recovered fixture runs pi's order: length cut, omit edit, compaction, retry", () => {
  const set = sessionFixtures(SESSION_FIXTURE_SEED, SESSION_FIXTURE_COUNT);
  for (const s of set.index.sessions) {
    const entries = parseSessionJsonl(read(s.file)).entries;
    const cuts = entries.flatMap((e, i) =>
      e.type === "message" && (e.message as { stopReason?: string }).stopReason === "length"
        ? [i]
        : [],
    );
    expect(cuts, s.file).toHaveLength(s.recovered ? 1 : 0);
    if (!s.recovered) continue;
    const i = cuts[0] as number;
    const [cut, edit, compaction, retry] = entries.slice(i, i + 4);
    expect(edit, s.file).toMatchObject({
      type: "context_edit",
      parentId: cut?.id,
      targetId: cut?.id,
      replacement: null,
    });
    expect(compaction, s.file).toMatchObject({ type: "compaction", parentId: edit?.id });
    expect(retry?.type, s.file).toBe("message");
    expect(retry?.parentId, s.file).toBe(compaction?.id);
    expect((retry?.message as { role?: string } | undefined)?.role, s.file).toBe("assistant");
  }
});

const leaves = (nodes: SessionTreeNode[]): string[] =>
  nodes.flatMap((n) => (n.children.length === 0 ? [n.entry.id] : leaves(n.children)));

describe.each(committed.filter((f) => f.endsWith(".jsonl")))(
  "pi reads %s as the parser does",
  (name) => {
    test("the same header, final branch and leaves", () => {
      const text = read(name);
      const parsed = parseSessionJsonl(text);
      const tree = sessionTree(parsed);
      const entries = text
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l) as FileEntry);
      const pi = SessionManager.inMemory("/synthetic/repo", undefined, entries);
      expect(pi.getHeader()?.id).toBe(parsed.id);
      expect(pi.getBranch().map((e) => e.id)).toEqual(tree.final);
      expect(pi.getLeafId()).toBe(tree.final.at(-1));
      expect(leaves(pi.getTree()).sort()).toEqual(
        [tree.final.at(-1) as string, ...tree.branches.map((b) => b.leaf_id)].sort(),
      );
      expect(parsed.skipped_lines).toBe(0);
    });
  },
);
