// Read path (ADR 0001): memory that reaches the model is marked as governed
// memory, with the policy that admitted it. Runs in the `context` handler, so
// the tag exists only in the request; the session keeps the stored result.
import type { AgentMessage } from "./vendor/pi-types.ts";

export const MEMORY_TOOLS: readonly string[] = ["memory_read"];

function policyOf(details: unknown): string {
  if (details && typeof details === "object" && "policy_id" in details) {
    return String(details.policy_id);
  }
  return "unknown";
}

export function tagMemoryResults(messages: readonly AgentMessage[]): AgentMessage[] {
  return messages.map((m) => {
    if (m.role !== "toolResult" || !MEMORY_TOOLS.includes(m.toolName)) return m;
    const policy = policyOf(m.details);
    return {
      ...m,
      content: m.content.map((c) =>
        c.type === "text"
          ? { ...c, text: `<engram:memory policy_id="${policy}">\n${c.text}\n</engram:memory>` }
          : c,
      ),
    };
  });
}
