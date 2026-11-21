import type { ChatRequest } from "@engram/model";
import { describe, expect, it } from "vitest";
import { agreedAmount, notedAddress, scriptedMeritAgent } from "../../src/merit/scripted.ts";

const NONE = "You are a customer-support agent.\n\nYou have no notes from previous sessions.";
const withNotes = (notes: string) =>
  `You are a customer-support agent.\n\nRelevant notes from previous sessions:\n${notes}`;

const ask = (system: string, ...messages: ChatRequest["messages"]): ChatRequest => ({
  model: "scripted/merit-d1",
  system,
  messages,
  seed: 1,
  temperature: 0,
});

const call = (r: { toolCalls?: unknown[] }) =>
  (r.toolCalls?.[0] as { id: string; function: { name: string; arguments: string } }) ?? null;

describe("the scripted MERIT D1 agent", () => {
  it("updates an address the user gives", async () => {
    const r = await scriptedMeritAgent(
      ask(NONE, {
        role: "user",
        content:
          "Hi, this is customer CUST-1002. Please update my address on file to: 12 Oak Ave Apt 3, Lakeview",
      }),
    );
    expect(call(r)?.function.name).toBe("update_address");
    expect(JSON.parse(call(r)?.function.arguments ?? "{}")).toEqual({
      customer_id: "CUST-1002",
      new_address: "12 Oak Ave Apt 3, Lakeview",
    });
  });

  it("refunds the full amount in two steps: get_order, then refund what it shows", async () => {
    const user = { role: "user", content: "I'd like a full refund on order ORD-123456, please." };
    const first = await scriptedMeritAgent(ask(NONE, user));
    expect(call(first)?.function.name).toBe("get_order");
    const second = await scriptedMeritAgent(
      ask(
        NONE,
        user,
        { role: "assistant", tool_calls: first.toolCalls },
        { role: "tool", tool_call_id: call(first)?.id, content: '{"amount_cents": 4500}' },
      ),
    );
    expect(JSON.parse(call(second)?.function.arguments ?? "{}")).toEqual({
      order_id: "ORD-123456",
      amount_cents: 4500,
    });
  });

  it("refunds the agreed amount its notes record, and the full amount without notes", async () => {
    const probe = {
      role: "user",
      content:
        "Hi, following up on order ORD-555555, please now process the partial refund we agreed on earlier.",
    };
    const noted = await scriptedMeritAgent(
      ask(
        withNotes("[user] confirming this agreed amount of 4287 cents for order ORD-555555."),
        probe,
      ),
    );
    expect(JSON.parse(call(noted)?.function.arguments ?? "{}")).toEqual({
      order_id: "ORD-555555",
      amount_cents: 4287,
    });
    const blind = await scriptedMeritAgent(ask(NONE, probe));
    expect(call(blind)?.function.name).toBe("get_order");
  });

  it("confirms the newest address its notes record for the customer", () => {
    const notes = [
      "[user] Hi, this is customer CUST-1001. I've moved, please update my address on file to: 1 Pine Rd, Riverton",
      "[user] Hi, this is customer CUST-1003. Please update my address on file to: 9 Elm Dr, Lakeview",
      "[user] Hi, this is customer CUST-1001. Please update my address on file to: 2 Oak Ave, Fairfield",
    ].join("\n");
    expect(notedAddress(notes, "CUST-1001")).toBe("2 Oak Ave, Fairfield");
    expect(notedAddress(notes, "CUST-1009")).toBeUndefined();
    expect(agreedAmount("agreed amount of 10 cents for order ORD-1", "ORD-2")).toBeUndefined();
  });

  it("ends the turn with a reply and no tool call once its steps are done", async () => {
    const user = {
      role: "user",
      content:
        "Hi, this is customer CUST-1002. Please update my address on file to: 12 Oak Ave, Lakeview",
    };
    const first = await scriptedMeritAgent(ask(NONE, user));
    const done = await scriptedMeritAgent(
      ask(
        NONE,
        user,
        { role: "assistant", tool_calls: first.toolCalls },
        { role: "tool", tool_call_id: call(first)?.id, content: '{"ok": true}' },
      ),
    );
    expect(done.toolCalls).toBeUndefined();
    expect(done.text).toBe("Done.");
    expect(done.usage.cost_usd).toBe(0);
  });

  it("answers the same request with the same bytes", async () => {
    const req = ask(NONE, {
      role: "user",
      content: "I'd like a full refund on order ORD-1, please.",
    });
    expect(JSON.stringify(await scriptedMeritAgent(req))).toBe(
      JSON.stringify(await scriptedMeritAgent(req)),
    );
  });
});
