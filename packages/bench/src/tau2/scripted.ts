// The scripted upstream of tau2's fixture slice (card B11): the agent and the
// user simulator of each task, answered from a script so the cassettes are
// recorded without a live model (AGENTS.md, testing convention). It answers
// only what the cassette proxy asks it on a miss, and only while recording.
//
// Each reply depends on the request alone, as a model's does. The agent's
// step is the number of replies it has given since the task's first user
// message; the user simulator's is the number of turns it has taken (tau2
// flips the roles for it, so its own turns are the request's assistant
// messages). A step's memory calls are left out when the request offers no
// memory tool (C1), and a step left with no call is skipped, so one script
// serves every condition and the C1 conversation is the same task without
// the memory steps.

import { readFileSync } from "node:fs";
import type { ChatCall, ChatRequest, ChatResponse } from "@engram/model";
import { z } from "zod";

/** The memory tools' names, as packages/pi-extension/src/tools.ts declares them. */
export const MEMORY_TOOLS = ["memory_write", "memory_read"] as const;

const ScriptCall = z.strictObject({
  name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()),
});

const AgentStepSchema = z.union([
  z.strictObject({ text: z.string().min(1) }),
  z.strictObject({ calls: z.array(ScriptCall).min(1) }),
]);

/** One reply of the scripted agent: a message to the user, or tool calls. */
export type AgentStep = z.infer<typeof AgentStepSchema>;

export const TaskScript = z.strictObject({
  /** The user simulator's turns, in order; the last one ends the task (tau2's ###STOP###). */
  user: z.array(z.string().min(1)).min(1),
  /** The agent's replies, in order: a message to the user, or tool calls. */
  agent: z.array(AgentStepSchema).min(1),
});
export type TaskScript = z.infer<typeof TaskScript>;

/** One script per item `<domain>/<task>`. */
export const Tau2Script = z.record(z.string(), TaskScript);
export type Tau2Script = z.infer<typeof Tau2Script>;

export function readTau2Script(path: string): Tau2Script {
  return Tau2Script.parse(JSON.parse(readFileSync(path, "utf8")));
}

const usage = { input_tokens: 0, output_tokens: 0, cost_usd: 0 };

/** The function names of the tools a request offers. */
function offered(request: ChatRequest): Set<string> {
  const names = (request.tools ?? []).map((t) => {
    const fn = (t as { function?: { name?: unknown } }).function;
    return typeof fn?.name === "string" ? fn.name : "";
  });
  return new Set(names);
}

const isMemory = (name: string) => (MEMORY_TOOLS as readonly string[]).includes(name);

/** The agent's steps under the tools a request offers. */
export function agentSteps(script: TaskScript, tools: ReadonlySet<string>): AgentStep[] {
  return script.agent.flatMap((step): AgentStep[] => {
    if ("text" in step) return [step];
    const calls = step.calls.filter((c) => !isMemory(c.name) || tools.has(c.name));
    return calls.length === 0 ? [] : [{ calls }];
  });
}

/** The scripted agent and user simulator of one task. */
export function scriptedTau2(
  item: string,
  script: TaskScript,
): { agent: ChatCall; user: ChatCall } {
  const agent: ChatCall = async (request): Promise<ChatResponse> => {
    const tools = offered(request);
    const steps = agentSteps(script, tools);
    const firstUser = request.messages.findIndex((m) => m.role === "user");
    const replies = request.messages
      .slice(firstUser < 0 ? request.messages.length : firstUser)
      .filter((m) => m.role === "assistant").length;
    const step = steps[replies];
    if (step === undefined) {
      throw new Error(
        `scripted tau2 agent: the script of ${item} has ${steps.length} agent steps under these tools, and step ${replies} was asked for`,
      );
    }
    if ("text" in step) return { text: step.text, usage };
    for (const call of step.calls) {
      if (!tools.has(call.name)) {
        throw new Error(
          `scripted tau2 agent: step ${replies} of ${item} calls ${call.name}, which the request does not offer`,
        );
      }
    }
    return {
      text: "",
      toolCalls: step.calls.map((call, k) => ({
        id: `call_${item.replaceAll("/", "_")}_${replies}_${k}`,
        type: "function",
        function: { name: call.name, arguments: JSON.stringify(call.arguments) },
      })),
      usage,
    };
  };
  const user: ChatCall = async (request): Promise<ChatResponse> => {
    const turns = request.messages.filter((m) => m.role === "assistant").length;
    const text = script.user[turns];
    if (text === undefined) {
      throw new Error(
        `scripted tau2 user: the script of ${item} has ${script.user.length} user turns, and turn ${turns} was asked for`,
      );
    }
    return { text, usage };
  };
  return { agent, user };
}
