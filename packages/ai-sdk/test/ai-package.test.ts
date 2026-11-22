// @engram/ai-sdk under the real AI SDK (card E8.14 review fix pass, finding
// E8.14-12): the middleware through `wrapLanguageModel` and the tools through
// `generateText`'s own tool loop, `ai` 7.0.163 as a development dependency,
// on this package's scripted language model (no network, no model). What the
// README's Use section shows is what runs here.
import type { LanguageModelV4Prompt } from "@ai-sdk/provider";
import { createFakeAdapter } from "@engram/adapters";
import { loadPreset, type MemoryItem, migrate, openSqlite } from "@engram/core";
import { createEngramClient } from "@engram/sdk";
import { createApp, workspaceOf } from "@engram/server";
import { generateText, stepCountIs, wrapLanguageModel } from "ai";
import { describe, expect, test } from "vitest";
import { engramMemory } from "../src/index.ts";
import { scriptedModel } from "./scripted.ts";

const NOW = "2026-11-01T12:00:00.000Z";
const dana = { id: "person:dana", level: "person" as const, memberships: ["person:dana"] };

async function setup() {
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const ws = workspaceOf({
    db,
    adapter: createFakeAdapter(),
    policy: loadPreset("medium"),
    newId: () => `019a0000-0000-7000-8000-${String(++n).padStart(12, "0")}`,
  });
  const seeded = {
    id: "019a0000-0000-7000-8000-000000000900",
    class: "semantic",
    scope: "person:dana",
    owner: dana.id,
    content: "dana deploys the platform on fridays",
    provenance: { kind: "user", ref: "seed", hash: `sha256:${"0".repeat(64)}`, actor: dana.id },
    confidence: 0.9,
    valid_from: "2026-10-01T00:00:00.000Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
  } as MemoryItem;
  await ws.plane.write({ ...dana, source: "user" }, seeded, NOW);
  const app = createApp(ws, { port: 7313, now: () => NOW });
  const client = createEngramClient({
    baseUrl: "http://127.0.0.1:7313",
    fetch: async (r) => app.fetch(r),
  });
  let m = 0;
  const memory = engramMemory({
    client,
    actor: dana,
    namespace: ["person", "dana"],
    now: () => NOW,
    newId: () => `019a0000-0000-7000-8000-${String(500 + ++m).padStart(12, "0")}`,
  });
  return { ws, memory };
}

describe("under the AI SDK's generateText and wrapLanguageModel", () => {
  test("the recall reaches the model and the model's remember call is a governed write", async () => {
    const { ws, memory } = await setup();
    const model = scriptedModel([
      [
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "remember",
          input: JSON.stringify({ content: "dana prefers short summaries", source: "user" }),
        },
      ],
      [{ type: "text", text: "Noted; you deploy on fridays." }],
    ]);
    const result = await generateText({
      model: wrapLanguageModel({ model, middleware: memory.middleware }),
      tools: memory.tools,
      stopWhen: stepCountIs(3),
      // The recall queries with the last user text as it stands (see the README).
      prompt: "deploys fridays",
    });
    expect(result.text).toBe("Noted; you deploy on fridays.");
    expect(model.calls).toHaveLength(2);
    // The first call's prompt holds the governed recall, after any system message.
    const first = model.calls[0]?.prompt as LanguageModelV4Prompt;
    const recall = first.find((m) => m.role === "system");
    expect(String(recall?.content)).toContain("dana deploys the platform on fridays");
    expect(String(recall?.content)).toMatch(/^<engram:memory read_id="/);
    // The tool loop ran remember through the plane as the bound actor, source model.
    const write = ws.plane.events().findLast((e) => e.op === "write");
    expect(write).toMatchObject({ decision: "allow", actor: dana.id });
    expect(write?.item?.provenance).toMatchObject({
      kind: "model",
      ref: "ai-sdk:tool_call/call-1",
    });
    // The second call sees the tool's result as the AI SDK passed it on.
    const second = model.calls[1]?.prompt as LanguageModelV4Prompt;
    const tool = second.find((m) => m.role === "tool");
    expect(JSON.stringify(tool)).toContain("stored 019a0000-0000-7000-8000-000000000501");
  });

  test("a recall result the AI SDK carries forward is kept, and a denied remember reaches the model as a tool error", async () => {
    const { memory } = await setup();
    const model = scriptedModel([
      [
        { type: "tool-call", toolCallId: "r1", toolName: "recall", input: '{"query":"deploys"}' },
        {
          type: "tool-call",
          toolCallId: "w1",
          toolName: "remember",
          input: '{"content":"the team deploys","scope":"team:platform"}',
        },
      ],
      [{ type: "text", text: "ok" }],
    ]);
    await generateText({
      model: wrapLanguageModel({ model, middleware: memory.middleware }),
      tools: memory.tools,
      stopWhen: stepCountIs(3),
      prompt: "hello",
    });
    const second = JSON.stringify((model.calls[1]?.prompt ?? []).filter((m) => m.role === "tool"));
    // The recall result is the tagged read, not withheld.
    expect(second).toContain("dana deploys the platform on fridays");
    expect(second).not.toContain("withheld");
    // The refusal reaches the model as the tool's error, naming its rule.
    expect(second).toContain('"type":"error-text"');
    expect(second).toContain("EngramRejected");
    expect(second).toContain("engram/write/membership");
  });
});
