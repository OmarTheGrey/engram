// The Engram pi extension. Writes are gated in tool_call, memory is tagged in
// context, store CLIs are blocked in user_bash and in the model's bash tool,
// and every decision is mirrored into the session as a custom entry
// (customType "engram.event", AGENTS.md rule 3). The memory tools are stubs
// backed by an in-memory list until the adapters land.
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { blockedStoreCommand } from "./bash.ts";
import type { Decision, Gate } from "./gate.ts";
import { tagMemoryResults } from "./tag.ts";

export const ENGRAM_EVENT = "engram.event";

export interface EngramExtensionOptions {
  gate: Gate;
  storeCommands: readonly string[];
}

const MEMORY_OPS: Record<string, "write" | "read"> = { memory_write: "write", memory_read: "read" };

export function createEngramExtension(options: EngramExtensionOptions): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    const decisions = new Map<string, Decision>();
    const items: { scope: string; content: string }[] = [];
    const record = (data: Record<string, unknown>) => pi.appendEntry(ENGRAM_EVENT, data);
    const policyOf = (toolCallId: string) => ({ policy_id: decisions.get(toolCallId)?.policy_id });

    const noBypass = (command: string): Decision | undefined => {
      const store = blockedStoreCommand(command, options.storeCommands);
      if (store === undefined) return undefined;
      return {
        decision: "deny",
        reason: `${store} is a memory store command; use the Engram memory tools`,
        policy_id: "engram.no-bypass",
      };
    };

    pi.registerTool({
      name: "memory_write",
      label: "Memory write",
      description: "Write one item to governed memory in the given scope.",
      parameters: Type.Object({ scope: Type.String(), content: Type.String() }),
      async execute(toolCallId, params) {
        items.push(params);
        return {
          content: [{ type: "text", text: `stored in ${params.scope}` }],
          details: policyOf(toolCallId),
        };
      },
    });

    pi.registerTool({
      name: "memory_read",
      label: "Memory read",
      description: "Read governed memory items matching a query.",
      parameters: Type.Object({ query: Type.String() }),
      async execute(toolCallId, params) {
        const query = params.query.toLowerCase();
        const hits = items.filter((i) => i.content.toLowerCase().includes(query));
        const text = hits.map((i) => `${i.scope}: ${i.content}`).join("\n") || "no memories";
        return { content: [{ type: "text", text }], details: policyOf(toolCallId) };
      },
    });

    pi.on("tool_call", async (event) => {
      const op = MEMORY_OPS[event.toolName];
      if (op !== undefined) {
        const input = event.input as Record<string, unknown>;
        const d = options.gate({ op, tool: event.toolName, input });
        decisions.set(event.toolCallId, d);
        const scope = typeof input.scope === "string" ? { scope: input.scope } : {};
        const base = {
          op,
          source: "tool_call",
          tool: event.toolName,
          tool_call_id: event.toolCallId,
        };
        record({ ...base, ...scope, ...d });
        return d.decision === "deny" ? { block: true, reason: `engram: ${d.reason}` } : undefined;
      }
      if (event.toolName === "bash") {
        const command = String((event.input as Record<string, unknown>).command ?? "");
        const d = noBypass(command);
        if (d === undefined) return undefined;
        const base = {
          op: "bash",
          source: "tool_call",
          tool: "bash",
          tool_call_id: event.toolCallId,
        };
        record({ ...base, command, ...d });
        return { block: true, reason: `engram: ${d.reason}` };
      }
      return undefined;
    });

    pi.on("context", async (event) => ({ messages: tagMemoryResults(event.messages) }));

    pi.on("user_bash", async (event) => {
      const d = noBypass(event.command);
      if (d === undefined) return undefined;
      record({ op: "bash", source: "user_bash", command: event.command, ...d });
      const output = `engram: ${d.reason}\n`;
      return { result: { output, exitCode: 126, cancelled: false, truncated: false } };
    });
  };
}
