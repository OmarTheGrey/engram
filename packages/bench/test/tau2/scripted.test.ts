import { type ChatRequest, isScripted } from "@engram/model";
import { describe, expect, test } from "vitest";
import { agentSteps, scriptedTau2, type TaskScript } from "../../src/tau2/scripted.ts";

const script: TaskScript = {
  user: ["I want to cancel.", "Thanks. ###STOP###"],
  agent: [
    { calls: [{ name: "memory_read", arguments: { query: "cancel" } }] },
    {
      calls: [
        { name: "memory_write", arguments: { scope: "person:a", content: "x" } },
        { name: "cancel_reservation", arguments: { reservation_id: "Z7" } },
      ],
    },
    { text: "Cancelled." },
  ],
};

const tool = (name: string) => ({ type: "function", function: { name, parameters: {} } });
const DOMAIN = [tool("cancel_reservation")];
const MEMORY = [...DOMAIN, tool("memory_write"), tool("memory_read")];

/** An agent request after `replies` replies: the greeting, the user, then alternating replies and results. */
function agentRequest(tools: unknown[], replies: number): ChatRequest {
  const messages: ChatRequest["messages"] = [
    { role: "assistant", content: "Hi! How can I help you today?" },
    { role: "user", content: "I want to cancel." },
  ];
  for (let i = 0; i < replies; i++) {
    messages.push({ role: "assistant", content: `reply ${i}` });
    messages.push({ role: "tool", content: "ok", tool_call_id: `c${i}` });
  }
  return { model: "scripted/tau2-agent", system: "policy", messages, seed: 1, tools };
}

describe("the scripted tau2 upstream", () => {
  const { agent, user } = scriptedTau2("airline/19", script);

  test("answers the agent's step by the replies it gave since the first user message", async () => {
    const first = await agent(agentRequest(MEMORY, 0));
    expect(first.toolCalls).toEqual([
      {
        id: "call_airline_19_0_0",
        type: "function",
        function: { name: "memory_read", arguments: '{"query":"cancel"}' },
      },
    ]);
    expect((await agent(agentRequest(MEMORY, 2))).text).toBe("Cancelled.");
  });

  test("leaves memory calls out when the request offers no memory tool (C1)", async () => {
    expect(agentSteps(script, new Set(["cancel_reservation"]))).toEqual([
      { calls: [{ name: "cancel_reservation", arguments: { reservation_id: "Z7" } }] },
      { text: "Cancelled." },
    ]);
    const first = await agent(agentRequest(DOMAIN, 0));
    expect(first.toolCalls).toHaveLength(1);
    expect(first.toolCalls).toMatchObject([{ function: { name: "cancel_reservation" } }]);
  });

  test("keeps a mixed step's memory and domain calls together under C2 and C5", async () => {
    const second = await agent(agentRequest(MEMORY, 1));
    expect(second.toolCalls?.map((c) => (c as { id: string }).id)).toEqual([
      "call_airline_19_1_0",
      "call_airline_19_1_1",
    ]);
  });

  test("a step past the script is an error, never an invented reply", async () => {
    await expect(agent(agentRequest(MEMORY, 3))).rejects.toThrow(/has 3 agent steps/);
  });

  test("a domain call the request does not offer is an error", async () => {
    await expect(agent(agentRequest([tool("memory_read")], 1))).rejects.toThrow(
      /calls cancel_reservation, which the request does not offer/,
    );
  });

  test("both are branded scripted, so make fixtures may record them and nothing else", () => {
    expect(isScripted(agent)).toBe(true);
    expect(isScripted(user)).toBe(true);
    expect(isScripted(async (r: ChatRequest) => agent(r))).toBe(false);
  });

  test("the judge answers in the JSON tau2's NL-assertion evaluator parses, and only when scripted", async () => {
    const judged = scriptedTau2("retail/1", { ...script, judge: { met: false } });
    expect(isScripted(judged.judge)).toBe(true);
    const reply = await judged.judge({ model: "gpt-4.1-2025-04-14", messages: [], seed: 1 });
    expect(JSON.parse(reply.text)).toEqual({
      results: [
        {
          expectedOutcome: "every expected outcome of the task",
          reasoning: "scripted verdict",
          metExpectation: false,
        },
      ],
    });
    await expect(
      scriptedTau2("airline/19", script).judge({ model: "m", messages: [], seed: 1 }),
    ).rejects.toThrow(/no judge verdict/);
  });

  test("answers the user simulator by the turns it has taken", async () => {
    const turn = (n: number): ChatRequest => ({
      model: "scripted/tau2-user",
      messages: [
        { role: "user", content: "Hi! How can I help you today?" },
        ...Array.from({ length: n }, (_, i) => [
          { role: "assistant", content: `turn ${i}` },
          { role: "user", content: "agent" },
        ]).flat(),
      ],
      seed: 1,
    });
    expect((await user(turn(0))).text).toBe("I want to cancel.");
    expect((await user(turn(1))).text).toBe("Thanks. ###STOP###");
    await expect(user(turn(2))).rejects.toThrow(/has 2 user turns/);
  });
});
