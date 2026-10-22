import { type ModelRequest, requestHash } from "@engram/core";
import { describe, expect, test } from "vitest";
import { scriptedModelCall } from "../../src/model/scripted.ts";

const ask = (content: string, seed = 1): ModelRequest => ({
  model: "scripted/scripted-1",
  messages: [{ role: "user", content }],
  seed,
});

describe("scriptedModelCall", () => {
  test("answers from a table keyed on the request hash", async () => {
    const call = scriptedModelCall({ [requestHash(ask("hello"))]: "hi" });
    await expect(call(ask("hello"))).resolves.toEqual({
      text: "hi",
      usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
    });
  });

  test("fails loudly on a request the table does not hold, naming its hash", async () => {
    const call = scriptedModelCall({ [requestHash(ask("hello"))]: "hi" });
    await expect(call(ask("hello", 2))).rejects.toThrow(requestHash(ask("hello", 2)));
  });
});

describe("requestHash", () => {
  test("is stable and ignores key order", () => {
    const a = ask("hello");
    const b = { seed: a.seed, messages: a.messages, model: a.model };
    expect(requestHash(a)).toBe(requestHash(b));
    expect(requestHash(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});
