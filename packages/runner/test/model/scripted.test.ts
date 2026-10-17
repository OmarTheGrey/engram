import { createModels } from "@earendil-works/pi-ai";
import { describe, expect, test } from "vitest";
import { scriptedPiModel } from "../../src/model/scripted.ts";

const ask = (text: string) => ({
  messages: [{ role: "user" as const, content: text, timestamp: 0 }],
});

describe("scriptedPiModel", () => {
  test("answers each call with the next step and records the transcript it was sent", async () => {
    const scripted = scriptedPiModel([
      { toolCall: { id: "call-1", name: "memory_read", arguments: { query: "q" } } },
      { text: "done" },
    ]);
    const models = createModels();
    models.setProvider(scripted.provider);

    const first = await models.completeSimple(scripted.model, ask("one"));
    const second = await models.completeSimple(scripted.model, ask("two"));

    expect(first.stopReason).toBe("toolUse");
    expect(first.content).toEqual([
      { type: "toolCall", id: "call-1", name: "memory_read", arguments: { query: "q" } },
    ]);
    expect(second.content).toEqual([{ type: "text", text: "done" }]);
    expect(scripted.seen.map((c) => c.messages.at(-1)?.content)).toEqual(["one", "two"]);
  });

  test("fails loudly when the script runs out", async () => {
    const scripted = scriptedPiModel([{ text: "only" }]);
    const models = createModels();
    models.setProvider(scripted.provider);
    await models.completeSimple(scripted.model, ask("one"));

    const extra = await models.completeSimple(scripted.model, ask("two"));

    expect(extra.stopReason).toBe("error");
    expect(scripted.remaining()).toBe(0);
  });
});
