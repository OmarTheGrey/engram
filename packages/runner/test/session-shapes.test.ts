// The parser against pi on the tree shapes the core unit tests write by hand
// (review findings D1-1, D1-2 and D1-7): here pi's own SessionManager writes
// each session (@earendil-works/pi-coding-agent 1.3.0), the file text is
// what it would persist, and pi reloads it. The parser must see the same
// final branch and the same leaves as pi, and mark as omitted exactly the
// entries pi's projection leaves out of the model's context.

import type { AssistantMessage, ToolCall } from "@earendil-works/pi-ai";
import {
  type FileEntry,
  SessionManager,
  type SessionTreeNode,
} from "@earendil-works/pi-coding-agent";
import { type Episode, episodeOf, parseSessionJsonl, sessionTree } from "@engram/core";
import { describe, expect, test } from "vitest";

const CWD = "/synthetic/repo";
const usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};
const user = (pi: SessionManager, text: string) =>
  pi.appendMessage({ role: "user", content: text, timestamp: 1 });
const assistant = (
  pi: SessionManager,
  text: string,
  calls: ToolCall[] = [],
  stopReason: AssistantMessage["stopReason"] = "stop",
) =>
  pi.appendMessage({
    role: "assistant",
    content: [{ type: "text", text }, ...calls],
    api: "scripted",
    provider: "scripted",
    model: "scripted-1",
    usage,
    stopReason,
    timestamp: 1,
  });
const result = (pi: SessionManager, id: string, text: string) =>
  pi.appendMessage({
    role: "toolResult",
    toolCallId: id,
    toolName: "bash",
    content: [{ type: "text", text }],
    isError: false,
    timestamp: 1,
  });
const call = (id: string): ToolCall => ({
  type: "toolCall",
  id,
  name: "bash",
  arguments: { command: "ls" },
});

/** Each shape: pi builds it with its own API. */
const SHAPES: Record<string, (pi: SessionManager) => void> = {
  "nested branches": (pi) => {
    const u = user(pi, "go");
    const a1 = assistant(pi, "attempt A step 1");
    assistant(pi, "attempt A step 2");
    pi.branch(a1);
    assistant(pi, "attempt B");
    pi.branch(u);
    assistant(pi, "final");
  },
  "a branch left with a summary": (pi) => {
    const u = user(pi, "go");
    assistant(pi, "first try");
    pi.branchWithSummary(u, "The first try failed.");
    assistant(pi, "second try");
  },
  "a second root": (pi) => {
    user(pi, "go");
    assistant(pi, "first");
    pi.resetLeaf();
    user(pi, "start over");
    assistant(pi, "second");
  },
  "a label as the leaf": (pi) => {
    const u = user(pi, "go");
    assistant(pi, "done");
    pi.appendLabelChange(u, "checkpoint");
  },
  "a recovery's context edits": (pi) => {
    // pi's order after a length cut (docs/compaction.md "Overflow and Length
    // Recovery Ordering"): omit the attempt and its results, compact, retry.
    const u = user(pi, "go");
    const a = assistant(pi, "reading everything", [call("c1")], "length");
    const r = result(pi, "c1", "a very long output");
    pi.appendContextEdit(a, null);
    pi.appendContextEdit(r, null);
    pi.appendCompaction("The agent was asked to go.", u, 30000);
    assistant(pi, "reading less");
  },
  "two omitted retries": (pi) => {
    // pi's _prepareRetry omits each failed attempt before it retries.
    user(pi, "go");
    const e1 = assistant(pi, "attempt 1", [], "error");
    pi.appendContextEdit(e1, null);
    const e2 = assistant(pi, "attempt 2", [], "error");
    pi.appendContextEdit(e2, null);
    assistant(pi, "fine");
  },
  "replacements of every editable kind": (pi) => {
    const u = user(pi, "long prompt");
    const c = pi.appendCustomMessageEntry("engram.explain", "recall shown", true);
    const a = assistant(pi, "long answer", [call("c1")], "toolUse");
    const r = result(pi, "c1", "big output");
    pi.appendContextEdit(u, { content: "short prompt" });
    pi.appendContextEdit(c, {
      content: [
        { type: "text", text: "r" },
        { type: "image", data: "AAAA", mimeType: "image/png" },
      ],
    });
    pi.appendContextEdit(a, { content: "short answer" });
    pi.appendContextEdit(r, { content: "small output" });
    assistant(pi, "end");
  },
  "a replacement edit": (pi) => {
    const u = user(pi, "go with the long prompt");
    assistant(pi, "ok");
    pi.appendContextEdit(u, { content: "go" });
  },
  "a user shell command": (pi) => {
    user(pi, "go");
    pi.appendMessage({
      role: "bashExecution",
      command: "git status",
      output: "clean",
      exitCode: 0,
      cancelled: false,
      truncated: false,
      timestamp: 1,
    });
    assistant(pi, "done");
  },
  "an extension message": (pi) => {
    user(pi, "go");
    pi.appendCustomMessageEntry("engram.explain", "recall shown", true);
    assistant(pi, "done");
  },
};

const leaves = (nodes: SessionTreeNode[]): string[] =>
  nodes.flatMap((n) => (n.children.length === 0 ? [n.entry.id] : leaves(n.children)));

/** The file text pi would persist: the header, then every entry in append order. */
function written(build: (pi: SessionManager) => void): string {
  const pi = SessionManager.inMemory(CWD);
  build(pi);
  const lines = [pi.getHeader(), ...pi.getEntries()];
  return `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`;
}

/** The text of a message's content as the episode writes it: text blocks joined, an image as `[image]`. */
const contentText = (content: unknown): string =>
  typeof content === "string"
    ? content
    : (content as { type: string; text?: string }[])
        .flatMap((b) =>
          b.type === "text" ? [b.text ?? ""] : b.type === "image" ? ["[image]"] : [],
        )
        .join("\n");

const stepIds = (e: Episode) => [
  ...e.steps.map((s) => s.entry_id),
  ...e.abandoned.flatMap((b) => b.steps.map((s) => s.entry_id)),
];

describe.each(Object.entries(SHAPES))("pi and the parser agree on %s", (_name, build) => {
  const text = written(build);
  const parsed = parseSessionJsonl(text);
  const tree = sessionTree(parsed);
  const entries = text
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as FileEntry);
  const pi = SessionManager.inMemory(CWD, undefined, entries);
  const episode = episodeOf(parsed);

  test("the same final branch and the same leaves", () => {
    expect(pi.getBranch().map((e) => e.id)).toEqual(tree.final);
    expect(pi.getLeafId()).toBe(tree.final.at(-1));
    expect(leaves(pi.getTree()).sort()).toEqual(
      [tree.final.at(-1) as string, ...tree.branches.map((b) => b.leaf_id)].sort(),
    );
  });

  test("the entries pi's projection omits are the ones the episode marks omitted", () => {
    const projected = pi.buildSessionProjection();
    const omittedByPi = projected.entries
      .filter((p) => p.messages.length === 0 && p.sourceEntry.type === "message")
      .map((p) => p.sourceEntry.id);
    const omittedHere = [
      ...new Set(
        episode.steps.flatMap((s) =>
          s.context !== "omitted"
            ? []
            : [
                s.entry_id,
                ...(s.kind === "function" && s.result_entry_id ? [s.result_entry_id] : []),
              ],
        ),
      ),
    ];
    // System messages are not steps; pi keeps them in context.
    expect(omittedHere.sort()).toEqual(omittedByPi.sort());
  });

  test("each replaced step carries the text pi's projection puts in its place", () => {
    const projected = new Map(
      pi.buildSessionProjection().entries.map((p) => [p.sourceEntry.id, p.messages]),
    );
    const replaced = episode.steps.filter((s) => s.replacement !== undefined);
    for (const s of replaced) {
      const target = s.kind === "function" && s.result_entry_id ? s.result_entry_id : s.entry_id;
      const [message] = projected.get(target) ?? [];
      expect(message, target).toBeDefined();
      expect(s.replacement, target).toBe(contentText((message as { content: unknown }).content));
    }
    const edits = entries.filter((e) => e.type === "context_edit" && e.replacement !== null);
    expect(replaced.length).toBe(edits.length);
  });

  test("no step is in two branches, except one call's results sharing its entry", () => {
    const ids = stepIds(episode);
    const counted = new Map<string, number>();
    for (const id of ids) counted.set(id, (counted.get(id) ?? 0) + 1);
    const generations = new Set(
      [...episode.steps, ...episode.abandoned.flatMap((b) => b.steps)]
        .filter((s) => s.kind === "function")
        .map((s) => s.entry_id),
    );
    for (const [id, n] of counted) if (!generations.has(id)) expect(n, id).toBe(1);
  });
});

test("the nested shape: branch B is left inside branch A, and A's steps are not repeated", () => {
  const episode = episodeOf(parseSessionJsonl(written(SHAPES["nested branches"] as never)));
  expect(
    episode.abandoned.map((b) => [
      b.left_from,
      b.steps.map((s) => s.kind === "generation" && s.text),
    ]),
  ).toEqual([
    [null, ["attempt A step 1", "attempt A step 2"]],
    [0, ["attempt B"]],
  ]);
});

test("the retry shape: two omitted retries are two attempts", () => {
  const episode = episodeOf(parseSessionJsonl(written(SHAPES["two omitted retries"] as never)));
  expect(episode.omitted.map((o) => [o.entry_ids.length, o.stop_reason])).toEqual([
    [1, "error"],
    [1, "error"],
  ]);
});

test("the recovery shape: the omitted attempt is listed with its stop reason", () => {
  const episode = episodeOf(
    parseSessionJsonl(written(SHAPES["a recovery's context edits"] as never)),
  );
  expect(episode.omitted).toHaveLength(1);
  expect(episode.omitted[0]?.stop_reason).toBe("length");
  expect(episode.omitted[0]?.entry_ids).toHaveLength(2);
});
