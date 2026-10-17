import { describe, expect, test } from "vitest";
import { tagMemoryResults } from "../../src/tag.ts";
import type { AgentMessage } from "../../src/vendor/pi-types.ts";

const result = (toolName: string, text: string, details?: unknown) =>
  ({
    role: "toolResult",
    toolCallId: "c",
    toolName,
    content: [{ type: "text", text }],
    details,
    isError: false,
    timestamp: 0,
  }) as AgentMessage;

describe("tagMemoryResults", () => {
  test("wraps memory_read results in an engram tag naming the policy", () => {
    const [tagged] = tagMemoryResults([result("memory_read", "team: x", { policy_id: "p1" })]);
    expect(tagged).toMatchObject({
      content: [
        { type: "text", text: '<engram:memory policy_id="p1">\nteam: x\n</engram:memory>' },
      ],
    });
  });

  test("leaves other messages untouched", () => {
    const other = result("bash", "out");
    expect(tagMemoryResults([other])[0]).toBe(other);
  });

  test("does not mutate the messages it is given", () => {
    const original = result("memory_read", "team: x", { policy_id: "p1" });
    tagMemoryResults([original]);
    expect(original).toMatchObject({ content: [{ type: "text", text: "team: x" }] });
  });
});
