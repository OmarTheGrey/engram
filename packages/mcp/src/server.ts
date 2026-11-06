// The Engram MCP server (card E8.4, ADR 0022; plan decision 6): the four
// memory tools for Claude Code and Codex, each call one request of the
// generated client (in process over the workspace, or to `engram serve`).
//
// Identity is fixed at launch, never chosen by the model: every call is made
// as the actor `engram mcp --as --member` named, with source `model`, the way
// the pi extension labels the agent's tool calls (ADR 0004, decision D4). No
// tool parameter names an actor, a source or a provenance kind, and an
// argument that tries (`source`, `actor`, `provenance`) is ignored: the item
// is built from the tool's own parameters only, and the plane overwrites its
// provenance from the actor's source anyway.
//
// The tools' names, descriptions, parameters and result wording are the pi
// extension's, from one definition (packages/pi-extension/src/tools.ts, which
// loads no pi package), and a read renders in the shared memory-tag shape
// (packages/pi-extension/src/tag.ts): read id, admitting rules, content
// escaped. What the MCP path cannot do is stated in ADR 0022: the plane does
// not see the harness's context, so reads are governed, not filtered out of
// what the model already holds (condition C7).
//
// The low-level Server is used, not McpServer, because the tools' input
// schemas are the shared TypeBox (JSON Schema) definitions, which McpServer
// would want restated in Zod.
import { createHash } from "node:crypto";
import type { Actor, Explanation, MemoryEvent, MemoryItem } from "@engram/core";
import { recallDetails, tagRecall } from "@engram/pi-extension/tag";
import {
  MEMORY_EXPLAIN,
  MEMORY_READ,
  MEMORY_SIMULATE,
  MEMORY_WRITE,
  notImplementedText,
  writeResultText,
} from "@engram/pi-extension/tools";
import type { EngramClient } from "@engram/sdk";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Value } from "typebox/value";

export interface McpOptions {
  /** The client every tool call goes through. */
  client: EngramClient;
  /** Who every call is made as; its source is set to `model` here, whatever it says. */
  actor: Actor;
  /** The time of each call, ISO 8601 UTC. */
  now: () => string;
  /** A fresh UUIDv7 for each item written. */
  newId: () => string;
}

export const SERVER_INFO = { name: "engram", version: "0.0.0" };

const TOOLS = [MEMORY_WRITE, MEMORY_READ, MEMORY_EXPLAIN, MEMORY_SIMULATE] as const;

const sha256 = (s: string) => `sha256:${createHash("sha256").update(s).digest("hex")}`;
const text = (t: string, isError = false): CallToolResult => ({
  content: [{ type: "text", text: t }],
  ...(isError ? { isError: true } : {}),
});
const refusal = (event: { reason: string; policy_id: string }) =>
  `engram: ${event.reason} (${event.policy_id})`;

/** The failure body of a client call: its message, and the card of a 501. */
function failure(answer: { error?: unknown; response: Response }): {
  message: string;
  card?: string;
} {
  const body = (answer.error as { error?: { message?: string; card?: string } } | undefined)?.error;
  return {
    message: body?.message ?? `the plane answered ${answer.response.status}`,
    ...(body?.card ? { card: body.card } : {}),
  };
}

/** The tool list as MCP sends it: name, description, input schema (JSON Schema). */
export function toolList() {
  return TOOLS.map((t) => ({
    name: t.name,
    title: t.label,
    description: t.description,
    // TypeBox schemas are JSON Schema; the round trip drops TypeBox's symbol keys.
    inputSchema: JSON.parse(JSON.stringify(t.parameters)) as { type: "object" },
  }));
}

export function createMcpServer(options: McpOptions): Server {
  const { client, now, newId } = options;
  /** Every call is the launch actor's, labelled model (decision D4). */
  const agent: Actor = { ...options.actor, source: "model" };
  /** The events this server's calls produced: memory_simulate's workload. */
  const produced: MemoryEvent[] = [];

  const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolList() }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name } = request.params;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    const tool = TOOLS.find((t) => t.name === name);
    if (tool === undefined) return text(`engram: no tool named ${name}`, true);
    const given: unknown = args;
    if (!Value.Check(tool.parameters, given)) {
      const problems = [...Value.Errors(tool.parameters, args)]
        .map((e) => `${e.instancePath || "arguments"}: ${e.message}`)
        .join("; ");
      return text(`${name}: invalid arguments: ${problems}`, true);
    }
    const at = now();
    switch (tool.name) {
      case "memory_write": {
        // Built from the tool's parameters only; the plane sets provenance from the actor.
        const item: Record<string, unknown> = {
          id: newId(),
          class: args.class ?? "semantic",
          scope: args.scope,
          owner: agent.id,
          content: args.content,
          provenance: {
            kind: "model",
            ref: `mcp:tool_call/${String(extra.requestId)}`,
            hash: sha256(JSON.stringify({ scope: args.scope, content: args.content })),
            actor: agent.id,
          },
          confidence: args.confidence ?? 0.5,
          valid_from: at,
          valid_to: null,
          ttl: null,
          grants: [],
          version: 1,
          lineage: [],
          status: "active",
          store_ref: null,
          schema_version: 1,
        };
        const answer = await client.POST("/api/v1/items", { body: { actor: agent, item, at } });
        if (answer.data === undefined) return text(failure(answer).message, true);
        const { item: stored, event } = answer.data as unknown as {
          item: MemoryItem | null;
          event: MemoryEvent;
        };
        produced.push(event);
        return stored ? text(writeResultText(stored)) : text(refusal(event), true);
      }
      case "memory_read": {
        const answer = await client.POST("/api/v1/read", {
          body: { actor: agent, text: String(args.query), at },
        });
        if (answer.data === undefined) return text(failure(answer).message, true);
        const r = answer.data as unknown as {
          items: MemoryItem[];
          explanations: Explanation[];
          filtered: number;
          event: MemoryEvent;
        };
        produced.push(r.event);
        // The read event's reason counts items out of reach; it is kept from the model.
        return text(
          tagRecall(
            recallDetails(r.event.id, r.event.policy_id, r.filtered, r.items, r.explanations),
          ),
        );
      }
      case "memory_explain": {
        const readId = String(args.read_id);
        const answer = await client.POST("/api/v1/explain/{readId}", {
          params: { path: { readId } },
          body: { actor: agent },
        });
        if (answer.data === undefined) return text(failure(answer).message, true);
        return text(JSON.stringify(answer.data.explanations, null, 2));
      }
      case "memory_simulate": {
        const answer = await client.POST("/api/v1/simulate", {
          body: { workload: { id: "session", events: produced as never } },
        });
        if (answer.data === undefined) {
          const f = failure(answer);
          return text(f.card ? notImplementedText("memory_simulate", f.card) : f.message, true);
        }
        return text(JSON.stringify(answer.data, null, 2));
      }
    }
  });
  return server;
}
