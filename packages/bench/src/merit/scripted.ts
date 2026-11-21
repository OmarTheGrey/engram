// The scripted upstream of MERIT's fixture slice (card B7): a ChatCall the
// cassette proxy records from in `make fixtures`, never a live model. It is
// Engram's own rule-based support agent for MERIT's domain D1 (customer
// support), written against D1's tool schemas and user turns at the pin, not
// a port of MERIT's mock model (merit/mockmodel.py), and it is deterministic:
// the same request always gets the same reply, and a tool call's id is the
// position of the message it answers.
//
// What it does with one user turn (MERIT sends one turn at a time and loops
// on tool calls, merit/runner.py):
//
// - "update my address on file to: X" calls update_address;
// - "send me a message confirming this agreed amount of N cents for order O"
//   calls send_message with the amount;
// - "a full refund on order O" calls get_order, then refund for the amount
//   the order shows;
// - "process the partial refund we agreed on" refunds the amount its notes
//   (the memory block in the system prompt) record for that order, and the
//   full amount when they record none, as a memoryless agent would;
// - "send me a message confirming the delivery address you have on file"
//   sends the newest address its notes record for that customer, or says it
//   cannot find one.
//
// After its last tool call it replies with a short confirmation and no tool
// call, which ends MERIT's loop. Usage is an estimate, a token per four
// characters, so the ledger has something to sum; a scripted call costs
// nothing.
import {
  asScripted,
  type ChatCall,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
} from "@engram/model";

/** The scripted model's name in configs, keys and cassettes. */
export const MERIT_SCRIPTED_MODEL = "scripted/merit-d1";

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

type Message = ChatRequest["messages"][number];

const textOf = (m: Message | ChatMessage): string =>
  typeof m.content === "string" ? m.content : "";

const CUSTOMER = /\b(CUST-\d+)\b/;
const ORDER = /\b(ORD-\d+)\b/;
const NEW_ADDRESS = /address on file to: ([^\n]+?)(?:\. And |\n|$)/;
const AGREED = /agreed amount of (\d+) cents for order (ORD-\d+)/;

/** The newest amount the notes record as agreed for `order`, if any. */
export function agreedAmount(notes: string, order: string): number | undefined {
  let found: number | undefined;
  for (const m of notes.matchAll(new RegExp(AGREED.source, "g"))) {
    if (m[2] === order) found = Number(m[1]);
  }
  return found;
}

/** The newest address the notes record for `customer`, if any: a line naming the customer and its new address. */
export function notedAddress(notes: string, customer: string): string | undefined {
  let found: string | undefined;
  for (const line of notes.split("\n")) {
    if (!line.includes(customer)) continue;
    const m = NEW_ADDRESS.exec(line);
    if (m?.[1]) found = m[1].trim();
  }
  return found;
}

/** What the agent does next for a user turn, given the tool results it has had since. */
type Step = { tool: string; args: Record<string, unknown> } | { reply: string };

function plan(turn: string, notes: string, results: string[]): Step {
  const customer = CUSTOMER.exec(turn)?.[1];
  const order = ORDER.exec(turn)?.[1];
  const steps: Step[] = [];
  const address = NEW_ADDRESS.exec(turn)?.[1];
  if (customer && address) {
    steps.push({ tool: "update_address", args: { customer_id: customer, new_address: address } });
  }
  const agreed = AGREED.exec(turn);
  if (customer && agreed) {
    steps.push({
      tool: "send_message",
      args: {
        customer_id: customer,
        body: `Confirming the agreed amount of ${agreed[1]} cents for order ${agreed[2]}.`,
      },
    });
  }
  if (order && /full refund/.test(turn)) {
    steps.push({ tool: "get_order", args: { order_id: order } });
    steps.push(refundFromOrder(order, results));
  }
  if (order && /partial refund we agreed on/.test(turn)) {
    const amount = agreedAmount(notes, order);
    if (amount !== undefined) {
      steps.push({ tool: "refund", args: { order_id: order, amount_cents: amount } });
    } else {
      steps.push({ tool: "get_order", args: { order_id: order } });
      steps.push(refundFromOrder(order, results));
    }
  }
  if (customer && /confirming the delivery address you have on file/.test(turn)) {
    const noted = notedAddress(notes, customer);
    steps.push({
      tool: "send_message",
      args: {
        customer_id: customer,
        body:
          noted === undefined
            ? "I could not find a delivery address in my notes."
            : `The delivery address on file is ${noted}.`,
      },
    });
  }
  const next = steps[results.length];
  if (next !== undefined) return next;
  return { reply: steps.length === 0 ? "I am not able to help with that." : "Done." };
}

/** The refund a get_order result allows: its full amount, or a reply when it gave none. */
function refundFromOrder(order: string, results: string[]): Step {
  const shown = results.at(-1);
  if (shown === undefined) return { reply: "pending" };
  try {
    const parsed = JSON.parse(shown) as { amount_cents?: unknown };
    if (typeof parsed.amount_cents === "number") {
      return { tool: "refund", args: { order_id: order, amount_cents: parsed.amount_cents } };
    }
  } catch {
    // a tool error is not JSON with an amount
  }
  return { reply: `I could not find order ${order}.` };
}

const tokens = (text: string) => Math.ceil(text.length / 4);

/**
 * The scripted D1 agent as the proxy's upstream, branded by `asScripted`, so
 * the proxy records fixture cassettes from it (`recordFixtures`, under
 * ENGRAM_UPDATE_FIXTURES=1, card B10). Pass this function itself: a wrapper
 * around it carries no brand and is refused.
 */
export const scriptedMeritAgent: ChatCall = asScripted(async (request): Promise<ChatResponse> => {
  const messages = request.messages;
  let last = -1;
  messages.forEach((m, i) => {
    if (m.role === "user") last = i;
  });
  if (last < 0) throw new Error("scripted MERIT agent: the request has no user turn");
  const turn = textOf(messages[last] as Message);
  const results = messages.slice(last + 1).flatMap((m) => (m.role === "tool" ? [textOf(m)] : []));
  const step = plan(turn, request.system ?? "", results);
  const input = tokens(JSON.stringify(request));
  if ("reply" in step) {
    return {
      text: step.reply,
      finishReason: "stop",
      usage: { input_tokens: input, output_tokens: tokens(step.reply), cost_usd: 0 },
    };
  }
  const call: ToolCall = {
    id: `call_${messages.length}`,
    type: "function",
    function: { name: step.tool, arguments: JSON.stringify(step.args) },
  };
  return {
    text: "",
    toolCalls: [call],
    finishReason: "tool_calls",
    usage: { input_tokens: input, output_tokens: tokens(JSON.stringify(call)), cost_usd: 0 },
  };
});
