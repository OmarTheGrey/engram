// Card D1: a pi session's JSONL text to an episode. The sessions here are
// written by hand in pi's version 3 format (session-format.md and
// dist/core/session-manager.d.ts of @earendil-works/pi-coding-agent 1.3.0);
// packages/runner/test/session-fixtures.test.ts checks the parser's tree
// against pi's own SessionManager on the fifty generated fixtures.
import { describe, expect, test } from "vitest";
import {
  EPISODE_FORMAT,
  episodeOf,
  InvalidSessionError,
  parseSessionJsonl,
  sessionTree,
} from "../../../src/distill/episode.ts";

const T = "2026-11-01T09:00:00.000Z";
type Line = Record<string, unknown>;

const header = (over: Line = {}): Line => ({
  type: "session",
  version: 3,
  id: "0193a000-0000-4000-8000-000000000001",
  timestamp: T,
  cwd: "/synthetic/repo",
  ...over,
});
const entry = (type: string, id: string, parentId: string | null, rest: Line = {}): Line => ({
  type,
  id,
  parentId,
  timestamp: T,
  ...rest,
});
const msg = (id: string, parentId: string | null, message: Line) =>
  entry("message", id, parentId, { message: { timestamp: 1, ...message } });
const user = (id: string, parentId: string | null, content: unknown) =>
  msg(id, parentId, { role: "user", content });
const assistant = (
  id: string,
  parentId: string | null,
  content: unknown[],
  stopReason = "stop",
  model = "scripted-1",
) =>
  msg(id, parentId, {
    role: "assistant",
    content,
    api: "scripted",
    provider: "scripted",
    model,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
    stopReason,
  });
const call = (id: string, name: string, args: Line) => ({
  type: "toolCall",
  id,
  name,
  arguments: args,
});
const result = (id: string, parentId: string, toolCallId: string, text: string, isError = false) =>
  msg(id, parentId, {
    role: "toolResult",
    toolCallId,
    toolName: "bash",
    content: [{ type: "text", text }],
    isError,
  });
const task = (id: string, parentId: string | null, taskId: string) =>
  entry("custom", id, parentId, { customType: "engram.task", data: { task_id: taskId } });
const outcome = (id: string, parentId: string, verdict: string, reward?: number) =>
  entry("custom", id, parentId, {
    customType: "engram.outcome",
    data: reward === undefined ? { verdict } : { verdict, reward },
  });
const jsonl = (lines: Line[]) => `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`;

/** A linear session: setup entries, a task, one tool round, an answer, a verdict. */
const linear = () => [
  header(),
  entry("model_change", "a0000001", null, { provider: "scripted", modelId: "scripted-1" }),
  entry("thinking_level_change", "a0000002", "a0000001", { thinkingLevel: "off" }),
  task("a0000003", "a0000002", "synthetic/rename-1"),
  msg("a0000004", "a0000003", { role: "system", content: "", sections: { preamble: "p" } }),
  user("a0000005", "a0000004", "Rename foo to bar"),
  assistant(
    "a0000006",
    "a0000005",
    [
      { type: "thinking", thinking: "private reasoning" },
      { type: "text", text: "Looking." },
      call("c1", "bash", { command: "grep -rn foo" }),
      call("c2", "read", { path: "src/a.ts" }),
    ],
    "toolUse",
  ),
  result("a0000007", "a0000006", "c1", "src/a.ts:1:foo"),
  result("a0000008", "a0000007", "c2", "missing", true),
  assistant("a0000009", "a0000008", [{ type: "text", text: "Done." }]),
  outcome("a000000a", "a0000009", "success", 1),
];

describe("parseSessionJsonl", () => {
  test("returns the header's id and every entry after it, in file order", () => {
    const parsed = parseSessionJsonl(jsonl(linear()));
    expect(parsed.id).toBe("0193a000-0000-4000-8000-000000000001");
    expect(parsed.timestamp).toBe(T);
    expect(parsed.entries.map((e) => e.id)).toEqual(
      linear()
        .slice(1)
        .map((l) => l.id),
    );
    expect(parsed.skipped_lines).toBe(0);
  });

  test("skips a malformed line as pi's parseSessionEntries does, and counts it", () => {
    const text = jsonl(linear()).replace("\n", '\n{"type":"message","id":\n');
    const parsed = parseSessionJsonl(text);
    expect(parsed.skipped_lines).toBe(1);
    expect(parsed.entries).toHaveLength(linear().length - 1);
  });

  test("accepts CRLF line endings", () => {
    const parsed = parseSessionJsonl(jsonl(linear()).replaceAll("\n", "\r\n"));
    expect(parsed.entries).toHaveLength(linear().length - 1);
    expect(parsed.skipped_lines).toBe(0);
  });

  test("refuses a file whose first line is not a session header", () => {
    expect(() => parseSessionJsonl(jsonl(linear().slice(1)))).toThrow(InvalidSessionError);
    expect(() => parseSessionJsonl("")).toThrow(/no session header/);
  });

  test("refuses a version below 3, which pi migrates on load", () => {
    expect(() => parseSessionJsonl(jsonl([header({ version: 2 }), ...linear().slice(1)]))).toThrow(
      /version 2/,
    );
    expect(() =>
      parseSessionJsonl(jsonl([header({ version: "3" }), ...linear().slice(1)])),
    ).toThrow(/version 3;/);
  });

  test("reads a version above 3, which pi treats as current", () => {
    const parsed = parseSessionJsonl(jsonl([header({ version: 4 }), ...linear().slice(1)]));
    expect(parsed.entries).toHaveLength(linear().length - 1);
  });

  test("refuses an entry without an id or with two of the same id", () => {
    const lines = linear();
    lines.push(entry("label", "a0000003", "a000000a", { targetId: "a0000005", label: "x" }));
    expect(() => parseSessionJsonl(jsonl(lines))).toThrow(/a0000003 appears twice/);
    const noId = linear();
    noId.push({ type: "label", parentId: "a000000a", timestamp: T });
    expect(() => parseSessionJsonl(jsonl(noId))).toThrow(/no id/);
  });
});

describe("episodeOf", () => {
  test("keeps the final branch's steps in order, a tool call joined to its result", () => {
    const episode = episodeOf(parseSessionJsonl(jsonl(linear())));
    expect(episode.format).toBe(EPISODE_FORMAT);
    expect(episode.session_id).toBe("0193a000-0000-4000-8000-000000000001");
    expect(episode.task_id).toBe("synthetic/rename-1");
    expect(episode.model).toBe("scripted/scripted-1");
    expect(episode.steps).toEqual([
      { entry_id: "a0000005", kind: "user", text: "Rename foo to bar" },
      {
        entry_id: "a0000006",
        kind: "generation",
        text: "Looking.",
        model: "scripted/scripted-1",
        stop_reason: "toolUse",
        tool_calls: 2,
      },
      {
        entry_id: "a0000006",
        kind: "function",
        caller: "model",
        tool: "bash",
        arguments: { command: "grep -rn foo" },
        result: "src/a.ts:1:foo",
        is_error: false,
        result_entry_id: "a0000007",
      },
      {
        entry_id: "a0000006",
        kind: "function",
        caller: "model",
        tool: "read",
        arguments: { path: "src/a.ts" },
        result: "missing",
        is_error: true,
        result_entry_id: "a0000008",
      },
      {
        entry_id: "a0000009",
        kind: "generation",
        text: "Done.",
        model: "scripted/scripted-1",
        stop_reason: "stop",
        tool_calls: 0,
      },
    ]);
    expect(episode.outcome).toEqual({
      verdict: "success",
      reward: 1,
      stop_reason: "stop",
      leaf_id: "a000000a",
    });
    expect(episode.abandoned).toEqual([]);
    expect(episode.summarised).toBe(false);
  });

  test("drops thinking, and writes an image block as a marker", () => {
    const lines = linear();
    lines.push(
      user("a000000b", "a000000a", [
        { type: "text", text: "see" },
        { type: "image", data: "AAAA", mimeType: "image/png" },
      ]),
    );
    const episode = episodeOf(parseSessionJsonl(jsonl(lines)));
    expect(JSON.stringify(episode)).not.toContain("private reasoning");
    expect(JSON.stringify(episode)).not.toContain("AAAA");
    expect(episode.steps.at(-1)).toEqual({
      entry_id: "a000000b",
      kind: "user",
      text: "see\n[image]",
    });
  });

  test("a session without a task or an outcome entry has a null task id and verdict", () => {
    const lines = linear().filter((l) => l.type !== "custom");
    // The system message hung from the task entry; it now hangs from the thinking level change.
    lines[3] = msg("a0000004", "a0000002", { role: "system", content: "" });
    const episode = episodeOf(parseSessionJsonl(jsonl(lines)));
    expect(episode.task_id).toBeNull();
    expect(episode.outcome).toEqual({
      verdict: null,
      reward: null,
      stop_reason: "stop",
      leaf_id: "a0000009",
    });
  });

  test("an abandoned branch keeps the point it was left, its steps and pi's branch summary", () => {
    // The first attempt fails at b0000004; the user goes back to a0000005
    // with /tree, which appends a branch_summary as a child of a0000005
    // whose fromId is the abandoned leaf (branchWithSummary).
    const lines = [
      ...linear().slice(0, 6),
      assistant(
        "b0000001",
        "a0000005",
        [call("c9", "bash", { command: "sed -i s/foo/baz/" })],
        "toolUse",
      ),
      result("b0000002", "b0000001", "c9", "sed: bad flag", true),
      assistant("b0000003", "b0000002", [{ type: "text", text: "I give up." }]),
      outcome("b0000004", "b0000003", "failure", 0),
      entry("branch_summary", "b0000005", "a0000005", {
        fromId: "b0000004",
        summary: "Tried sed; it failed.",
      }),
      assistant("b0000006", "b0000005", [{ type: "text", text: "Using the editor." }]),
      outcome("b0000007", "b0000006", "success", 1),
    ];
    const episode = episodeOf(parseSessionJsonl(jsonl(lines)));
    expect(episode.steps.map((s) => [s.entry_id, s.kind])).toEqual([
      ["a0000005", "user"],
      ["b0000005", "summary"],
      ["b0000006", "generation"],
    ]);
    expect(episode.steps[1]).toEqual({
      entry_id: "b0000005",
      kind: "summary",
      source: "branch",
      text: "Tried sed; it failed.",
      from_id: "b0000004",
    });
    expect(episode.abandoned).toHaveLength(1);
    const [branch] = episode.abandoned;
    expect(branch).toMatchObject({
      left_at: "a0000005",
      leaf_id: "b0000004",
      summary: "Tried sed; it failed.",
      outcome: { verdict: "failure", reward: 0, stop_reason: "stop", leaf_id: "b0000004" },
    });
    expect(branch?.steps.map((s) => [s.entry_id, s.kind])).toEqual([
      ["b0000001", "generation"],
      ["b0000001", "function"],
      ["b0000003", "generation"],
    ]);
    expect(branch?.steps[1]).toMatchObject({
      tool: "bash",
      is_error: true,
      result: "sed: bad flag",
    });
    expect(episode.outcome.verdict).toBe("success");
    expect(episode.summarised).toBe(true);
  });

  test("a branch left without a summary has a null summary", () => {
    const lines = [
      ...linear().slice(0, 7),
      result("b0000001", "a0000006", "c1", "first try"),
      // pi's branch(a0000006): the next entry is another child of a0000006.
      result("b0000002", "a0000006", "c1", "second try"),
    ];
    const episode = episodeOf(parseSessionJsonl(jsonl(lines)));
    expect(episode.outcome.leaf_id).toBe("b0000002");
    expect(episode.abandoned).toEqual([
      {
        left_at: "a0000006",
        left_from: null,
        leaf_id: "b0000001",
        summary: null,
        outcome: { verdict: null, reward: null, stop_reason: null, leaf_id: "b0000001" },
        steps: [
          {
            entry_id: "b0000001",
            kind: "function",
            caller: "model",
            tool: "bash",
            arguments: null,
            result: "first try",
            is_error: false,
            result_entry_id: "b0000001",
          },
        ],
      },
    ]);
    // On the final branch the call c1 is joined to the result on that branch.
    expect(episode.steps.find((s) => s.kind === "function" && s.tool === "bash")).toMatchObject({
      result: "second try",
      result_entry_id: "b0000002",
    });
  });

  test("the final leaf is the last entry in the file, as pi's SessionManager loads it", () => {
    // Two leaves; the one written last is current, whatever the tree's shape.
    const lines = [
      ...linear().slice(0, 6),
      assistant("b0000002", "a0000005", [{ type: "text", text: "second" }]),
      assistant("b0000001", "a0000005", [{ type: "text", text: "first" }]),
    ];
    const tree = sessionTree(parseSessionJsonl(jsonl(lines)));
    expect(tree.final.at(-1)).toBe("b0000001");
    expect(tree.branches.map((b) => b.leaf_id)).toEqual(["b0000002"]);
  });

  test("a second root (pi's resetLeaf) is an abandoned branch left at no entry", () => {
    const lines = [
      ...linear(),
      user("b0000001", null, "Start over"),
      assistant("b0000002", "b0000001", [{ type: "text", text: "ok" }]),
    ];
    const episode = episodeOf(parseSessionJsonl(jsonl(lines)));
    expect(episode.steps.map((s) => s.entry_id)).toEqual(["b0000001", "b0000002"]);
    expect(episode.abandoned).toHaveLength(1);
    expect(episode.abandoned[0]).toMatchObject({ left_at: null, leaf_id: "a000000a" });
    // The task entry is the session's, wherever it sits in the tree.
    expect(episode.task_id).toBe("synthetic/rename-1");
  });

  test("a branch of bookkeeping entries only is not kept", () => {
    const lines = [
      ...linear(),
      entry("label", "b0000001", "a0000005", { targetId: "a0000005", label: "here" }),
      user("b0000002", "a000000a", "thanks"),
    ];
    const episode = episodeOf(parseSessionJsonl(jsonl(lines)));
    expect(episode.abandoned).toEqual([]);
  });

  test("a compaction is a summary step, and a user shell command a function step", () => {
    const lines = [
      ...linear(),
      entry("compaction", "b0000001", "a000000a", {
        summary: "Renamed foo.",
        firstKeptEntryId: "a0000009",
        tokensBefore: 100,
      }),
      msg("b0000002", "b0000001", {
        role: "bashExecution",
        command: "git status",
        output: "clean",
        exitCode: 0,
        cancelled: false,
        truncated: false,
      }),
      entry("custom_message", "b0000003", "b0000002", {
        customType: "engram.explain",
        content: "recall shown",
        display: true,
      }),
    ];
    const episode = episodeOf(parseSessionJsonl(jsonl(lines)));
    expect(episode.steps.slice(-3)).toEqual([
      {
        entry_id: "b0000001",
        kind: "summary",
        source: "compaction",
        text: "Renamed foo.",
        from_id: null,
      },
      {
        entry_id: "b0000002",
        kind: "function",
        caller: "user",
        tool: "bash",
        arguments: { command: "git status" },
        result: "clean",
        is_error: false,
        result_entry_id: "b0000002",
      },
      { entry_id: "b0000003", kind: "custom", custom_type: "engram.explain", text: "recall shown" },
    ]);
    expect(episode.summarised).toBe(true);
    // The verdict entry is on the final branch, before the compaction.
    expect(episode.outcome).toMatchObject({ verdict: "success", leaf_id: "b0000003" });
  });

  test("an outcome entry with an unknown verdict is not an outcome", () => {
    const lines = linear();
    lines[10] = outcome("a000000a", "a0000009", "maybe");
    expect(episodeOf(parseSessionJsonl(jsonl(lines))).outcome.verdict).toBeNull();
  });

  test("is the same for the same text", () => {
    const text = jsonl(linear());
    expect(episodeOf(parseSessionJsonl(text))).toEqual(episodeOf(parseSessionJsonl(text)));
  });
});

describe("episodeOf: nested branches (review finding D1-1)", () => {
  // The final branch is a0000001 -> a0000002. Branch A leaves a0000001 at
  // b0000001 -> b0000002; branch B leaves branch A at b0000001 with c0000001.
  const nested = () => [
    header(),
    user("a0000001", null, "go"),
    assistant("b0000001", "a0000001", [{ type: "text", text: "attempt A step 1" }]),
    assistant("b0000002", "b0000001", [{ type: "text", text: "attempt A step 2" }]),
    assistant("c0000001", "b0000001", [{ type: "text", text: "attempt B" }]),
    assistant("a0000002", "a0000001", [{ type: "text", text: "final" }]),
  ];

  test("a branch nested in an abandoned one is left at its own fork, and no step is counted twice", () => {
    const episode = episodeOf(parseSessionJsonl(jsonl(nested())));
    expect(
      episode.abandoned.map((b) => ({
        left_at: b.left_at,
        left_from: b.left_from,
        leaf: b.leaf_id,
        steps: b.steps.map((s) => s.entry_id),
      })),
    ).toEqual([
      { left_at: "a0000001", left_from: null, leaf: "b0000002", steps: ["b0000001", "b0000002"] },
      { left_at: "b0000001", left_from: 0, leaf: "c0000001", steps: ["c0000001"] },
    ]);
    const all = [...episode.steps, ...episode.abandoned.flatMap((b) => b.steps)].map(
      (s) => s.entry_id,
    );
    expect(new Set(all).size).toBe(all.length);
  });

  test("the tree names the earlier branch a nested one leaves", () => {
    expect(sessionTree(parseSessionJsonl(jsonl(nested()))).branches).toEqual([
      { leaf_id: "b0000002", left_at: "a0000001", parent: null, segment: ["b0000001", "b0000002"] },
      { leaf_id: "c0000001", left_at: "b0000001", parent: 0, segment: ["c0000001"] },
    ]);
  });

  test("a branch of bookkeeping only claims nothing, so a later branch through it keeps it", () => {
    // b0000001 and b0000002 are labels off a0000001 (dropped: no step); the
    // branch c0000001 grows from b0000001, so it is left at a0000001.
    const lines = [
      header(),
      user("a0000001", null, "go"),
      entry("label", "b0000001", "a0000001", { targetId: "a0000001", label: "x" }),
      entry("label", "b0000002", "b0000001", { targetId: "a0000001", label: "y" }),
      user("c0000001", "b0000001", "another way"),
      assistant("a0000002", "a0000001", [{ type: "text", text: "final" }]),
    ];
    const episode = episodeOf(parseSessionJsonl(jsonl(lines)));
    expect(episode.abandoned).toHaveLength(1);
    expect(episode.abandoned[0]).toMatchObject({
      left_at: "a0000001",
      left_from: null,
      leaf_id: "c0000001",
    });
    expect(episode.abandoned[0]?.steps.map((s) => s.entry_id)).toEqual(["c0000001"]);
  });
});

describe("episodeOf: context edits (review finding D1-2)", () => {
  /** pi's recovery after a length cut: the attempt is omitted, then retried. */
  const recovered = () => [
    ...linear().slice(0, 6),
    assistant(
      "b0000001",
      "a0000005",
      [{ type: "text", text: "Reading everything" }, call("c7", "bash", { command: "cat *" })],
      "length",
    ),
    result("b0000002", "b0000001", "c7", "a very long output"),
    entry("context_edit", "b0000003", "b0000002", { targetId: "b0000001", replacement: null }),
    entry("context_edit", "b0000004", "b0000003", { targetId: "b0000002", replacement: null }),
    assistant("b0000005", "b0000004", [{ type: "text", text: "Done, reading less." }]),
  ];

  test("an omitted attempt stays as it happened, marked, and is listed as negative evidence", () => {
    const episode = episodeOf(parseSessionJsonl(jsonl(recovered())));
    expect(episode.steps.map((s) => [s.entry_id, s.kind, s.context ?? "kept"])).toEqual([
      ["a0000005", "user", "kept"],
      ["b0000001", "generation", "omitted"],
      ["b0000001", "function", "omitted"],
      ["b0000005", "generation", "kept"],
    ]);
    expect(episode.steps[2]).toMatchObject({ result: "a very long output", is_error: false });
    expect(episode.omitted).toEqual([
      { entry_ids: ["b0000001", "b0000002"], stop_reason: "length" },
    ]);
  });

  test("a replaced entry keeps its raw content, marked, with what replaced it", () => {
    const lines = [
      ...linear(),
      entry("context_edit", "b0000001", "a000000a", {
        targetId: "a0000007",
        replacement: { content: [{ type: "text", text: "[output trimmed]" }] },
      }),
      entry("context_edit", "b0000002", "b0000001", {
        targetId: "a0000005",
        replacement: { content: "Rename foo" },
      }),
    ];
    const episode = episodeOf(parseSessionJsonl(jsonl(lines)));
    expect(episode.steps[0]).toEqual({
      entry_id: "a0000005",
      kind: "user",
      text: "Rename foo to bar",
      context: "replaced",
      replacement: "Rename foo",
    });
    // The result c1 was replaced: its function step carries the replacement;
    // the call's own generation is untouched.
    expect(episode.steps[2]).toMatchObject({
      tool: "bash",
      result: "src/a.ts:1:foo",
      context: "replaced",
      replacement: "[output trimmed]",
    });
    expect(episode.steps[1]?.context).toBeUndefined();
    expect(episode.omitted).toEqual([]);
  });

  test("the latest edit of a target wins, and an edit is local to its branch", () => {
    const lines = [
      ...linear().slice(0, 7),
      // Abandoned: omits the user's prompt on its own branch only.
      entry("context_edit", "b0000001", "a0000006", { targetId: "a0000005", replacement: null }),
      user("b0000002", "b0000001", "again"),
      // Final: replaces, then omits, the generation a0000006.
      entry("context_edit", "c0000001", "a0000006", {
        targetId: "a0000006",
        replacement: { content: "short" },
      }),
      entry("context_edit", "c0000002", "c0000001", { targetId: "a0000006", replacement: null }),
    ];
    const episode = episodeOf(parseSessionJsonl(jsonl(lines)));
    expect(episode.steps[0]?.context).toBeUndefined();
    expect(episode.steps.filter((s) => s.entry_id === "a0000006").map((s) => s.context)).toEqual([
      "omitted",
      "omitted",
      "omitted",
    ]);
    expect(episode.abandoned).toHaveLength(1);
    expect(episode.abandoned[0]?.steps.map((s) => s.entry_id)).toEqual(["b0000002"]);
  });
});

describe("episodeOf: times", () => {
  test("the session's start is its header's time and its end its last entry's", () => {
    const lines = linear();
    lines[lines.length - 1] = { ...lines.at(-1), timestamp: "2026-11-01T09:30:00.000Z" };
    const episode = episodeOf(parseSessionJsonl(jsonl(lines)));
    expect(episode.started_at).toBe(T);
    expect(episode.ended_at).toBe("2026-11-01T09:30:00.000Z");
  });
});
