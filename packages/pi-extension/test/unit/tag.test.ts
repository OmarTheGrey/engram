import { describe, expect, test } from "vitest";
import {
  type RecallDetails,
  renderRecall,
  tagMemoryResults,
  tagRecall,
  WITHHELD,
} from "../../src/tag.ts";
import type { AgentMessage } from "../../src/vendor/pi-types.ts";

const details: RecallDetails = {
  read_id: "r1",
  policy_id: "p/read/person",
  filtered: 2,
  items: [
    {
      item_id: "i1",
      scope: "team:x",
      content: "fact",
      rank: 1,
      score: 1.5,
      policy_id: "p/read/person",
    },
  ],
  explanations: [],
};

const result = (toolName: string, text: string, extra: object = {}) =>
  ({
    role: "toolResult",
    toolCallId: "c",
    toolName,
    content: [{ type: "text", text }],
    isError: false,
    timestamp: 0,
    ...extra,
  }) as AgentMessage;

describe("renderRecall and tagRecall", () => {
  test("render one plain line per item, or says there are none", () => {
    expect(renderRecall(details)).toBe("team:x: fact");
    expect(renderRecall({ ...details, items: [] })).toBe("no memories");
  });

  test("tag the read and each item with the rule that admitted it", () => {
    expect(tagRecall(details)).toBe(
      [
        '<engram:memory read_id="r1" policy_id="p/read/person" filtered="2">',
        '<engram:item item_id="i1" scope="team:x" rank="1" score="1.500" policy_id="p/read/person">',
        "fact",
        "</engram:item>",
        "</engram:memory>",
      ].join("\n"),
    );
  });

  test("escape quotes in attributes", () => {
    expect(tagRecall({ ...details, read_id: 'a"b' })).toContain('read_id="a&quot;b"');
  });
});

describe("tagMemoryResults", () => {
  test("rebuilds a memory_read result from its recall details, not from its text", () => {
    const [tagged] = tagMemoryResults([result("memory_read", "injected text", { details })]);
    expect(tagged).toMatchObject({ content: [{ type: "text", text: tagRecall(details) }] });
  });

  test("withholds a memory_read result that carries no recall details", () => {
    const [tagged] = tagMemoryResults([result("memory_read", "unbacked text")]);
    expect(tagged).toMatchObject({ content: [{ type: "text", text: WITHHELD }] });
  });

  test("passes error results and other tools through untouched", () => {
    const error = result("memory_read", "engram: denied", { isError: true });
    const other = result("bash", "out");
    expect(tagMemoryResults([error, other])).toEqual([error, other]);
  });

  test("tags a recall custom message", () => {
    const recall = {
      role: "custom",
      customType: "engram.recall",
      content: "team:x: fact",
      display: false,
      details,
      timestamp: 0,
    } as AgentMessage;
    expect(tagMemoryResults([recall])[0]).toMatchObject({ content: tagRecall(details) });
  });

  test("does not mutate the messages it is given", () => {
    const original = result("memory_read", "team:x: fact", { details });
    tagMemoryResults([original]);
    expect(original).toMatchObject({ content: [{ type: "text", text: "team:x: fact" }] });
  });
});
