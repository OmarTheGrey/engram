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
// Time (card RV5, finding RV-SRF-2): requests carry no time; the server
// stamps each event from its own clock, and memory_simulate's workload
// records each call at the ts its event got. `now` dates a written item's
// validity only.
//
// memory_supersede (card L6) is off by default and is not one of the pi
// extension's tools: the tool set of condition C7 stays the four above. A
// server launched with `supersede` lists it fifth: the supersede route's
// plan for an item (the head of its chain, a proposed close or a review
// flag per ancestor the actor may read), and each id in `accept` one write
// of a new version through the write gate as the launch actor with source
// model, so the gate decides it with a model's provenance. The tool only
// carries the agent's choice of a proposed close; core proposes, and
// nothing is retired.
//
// memory_why_not (card E2.17) is off by default too, for the same reason:
// a server launched with `whyNot` lists it after the others. It asks the
// plane why one item is not in the read the query would make now (the
// explain-absent route): the first stage that kept it out, or that the read
// returns it, answered only for an item the launch actor may read by id and
// refused, as for an unknown id, otherwise. It appends no event, so
// memory_simulate records nothing for it.
//
// The low-level Server is used, not McpServer, because the tools' input
// schemas are the shared TypeBox (JSON Schema) definitions, which McpServer
// would want restated in Zod.
import { createHash } from "node:crypto";
import {
  type Actor,
  type Explanation,
  loadPreset,
  type MemoryEvent,
  type MemoryItem,
  type PresetName,
  type WorkloadStep,
} from "@engram/core";
import { MEMORY_EXPLAIN, MEMORY_SIMULATE } from "@engram/pi-extension/tools";
import type { EngramClient } from "@engram/sdk";
import { MEMORY_READ, MEMORY_WRITE, recallDetails, tagRecall, writeResultText } from "@engram/tag";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Type } from "typebox";
import { Value } from "typebox/value";

export interface McpOptions {
  /** The client every tool call goes through. */
  client: EngramClient;
  /** Who every call is made as; its source is set to `model` here, whatever it says. */
  actor: Actor;
  /** The valid_from of each item written, ISO 8601 UTC; events are stamped by the server. */
  now: () => string;
  /** A fresh UUIDv7 for each item written. */
  newId: () => string;
  /**
   * The most calls one server (one MCP session) records for memory_simulate;
   * default MAX_SESSION_STEPS. Past it, no more are kept and memory_simulate
   * refuses, rather than replay a workload cut short (review fix pass of PR
   * #59, RV5-5).
   */
  maxSteps?: number;
  /** List memory_supersede (card L6); off by default, so the four tools are C7's. */
  supersede?: boolean;
  /** List memory_why_not (card E2.17); off by default, so the four tools are C7's. */
  whyNot?: boolean;
}

/** The default bound on one session's recorded calls. */
export const MAX_SESSION_STEPS = 10_000;

export const SERVER_INFO = { name: "engram", version: "0.0.0" };

const TOOLS = [MEMORY_WRITE, MEMORY_READ, MEMORY_EXPLAIN, MEMORY_SIMULATE] as const;

/** Card L6's tool, listed only when the server is launched with `supersede`. */
export const MEMORY_SUPERSEDE = {
  name: "memory_supersede",
  label: "Memory supersede",
  description:
    "For an item whose lineage names older versions, the plane's proposals: which older items should end where this one begins (close) and which need a person's review. Without accept nothing is written; each id in accept, which must be a proposed close, is written as a new version through the write gate, which decides it.",
  parameters: Type.Object({
    item_id: Type.String(),
    accept: Type.Optional(Type.Array(Type.String())),
  }),
} as const;

/** Card E2.17's tool, listed only when the server is launched with `whyNot`. */
export const MEMORY_WHY_NOT = {
  name: "memory_why_not",
  label: "Memory why not",
  description:
    "Why one item is not in the read a query would make now: the first stage that kept it out (match, status, ttl, validity, or the rank cut) and its rule, or that the read returns it. Answered only for an item you may read by id; for any other id the answer is the refusal an unknown id gets. Nothing is written.",
  parameters: Type.Object({
    item_id: Type.String(),
    query: Type.Optional(Type.String()),
  }),
} as const;

/** The optional tools a server lists: `true` for every one of them (the leak and parity suites). */
export type OptionalTools = boolean | { supersede?: boolean; whyNot?: boolean };

const toolsOf = (optional: OptionalTools) => {
  const on = typeof optional === "boolean" ? { supersede: optional, whyNot: optional } : optional;
  return [
    ...TOOLS,
    ...(on.supersede === true ? [MEMORY_SUPERSEDE] : []),
    ...(on.whyNot === true ? [MEMORY_WHY_NOT] : []),
  ];
};

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
export function toolList(optional: OptionalTools = false) {
  return toolsOf(optional).map((t) => ({
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
  /** The Plane calls this server made, in order: memory_simulate's workload (card E8.9). */
  const steps: WorkloadStep[] = [];
  const maxSteps = options.maxSteps ?? MAX_SESSION_STEPS;
  const optional = { supersede: options.supersede === true, whyNot: options.whyNot === true };
  const tools = toolsOf(optional);
  let overflowed = false;
  const record = (step: WorkloadStep) => {
    if (steps.length < maxSteps) steps.push(step);
    else overflowed = true;
  };

  const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolList(optional),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name } = request.params;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    const tool = tools.find((t) => t.name === name);
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
        const answer = await client.POST("/api/v1/items", { body: { actor: agent, item } });
        if (answer.data === undefined) return text(failure(answer).message, true);
        const { item: stored, event } = answer.data as unknown as {
          item: MemoryItem | null;
          event: MemoryEvent;
        };
        record({
          op: "write",
          as: "agent",
          at: event.ts,
          item: item as Extract<WorkloadStep, { op: "write" }>["item"],
        });
        return stored ? text(writeResultText(stored)) : text(refusal(event), true);
      }
      case "memory_read": {
        const answer = await client.POST("/api/v1/read", {
          body: { actor: agent, text: String(args.query) },
        });
        if (answer.data === undefined) return text(failure(answer).message, true);
        const r = answer.data as unknown as {
          items: MemoryItem[];
          explanations: Explanation[];
          filtered: number;
          event: MemoryEvent;
        };
        record({ op: "read", as: "agent", at: r.event.ts, text: String(args.query) });
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
        // Replayed on scratch logs and stores: this server's own calls only.
        if (overflowed)
          return text(
            `memory_simulate: this session made more than ${maxSteps} calls, the most it records; a replay of only some of them would not be this session's, so start a new session to simulate`,
            true,
          );
        const candidate =
          args.candidate === undefined ? undefined : loadPreset(args.candidate as PresetName);
        const answer = await client.POST("/api/v1/simulate", {
          body: {
            workload: { id: "session", actors: { agent }, steps: [...steps] },
            ...(candidate ? { policy: candidate } : {}),
          },
        });
        if (answer.data === undefined) return text(failure(answer).message, true);
        return text(JSON.stringify(answer.data, null, 2));
      }
      case "memory_why_not": {
        const answer = await client.POST("/api/v1/explain-absent", {
          body: {
            actor: agent,
            item_id: String(args.item_id),
            ...(args.query === undefined ? {} : { text: String(args.query) }),
          },
        });
        if (answer.data === undefined) return text(failure(answer).message, true);
        return text(JSON.stringify(answer.data, null, 2), !answer.data.answered);
      }
      case "memory_supersede": {
        const accept = (args.accept as string[] | undefined) ?? [];
        const answer = await client.POST("/api/v1/supersede", {
          body: { actor: agent, item_id: String(args.item_id), accept },
        });
        if (answer.data === undefined) return text(failure(answer).message, true);
        const plan = answer.data as unknown as {
          head: { ok: boolean };
          submitted: Extract<WorkloadStep, { op: "write" }>["item"][];
          applied: { event: MemoryEvent }[];
          stopped: { event: MemoryEvent } | null;
        };
        // Each accepted close sent was one write, the one the store refused
        // included (L6-3): memory_simulate replays each as one.
        const sent = [...plan.applied, ...(plan.stopped ? [plan.stopped] : [])];
        for (const [i, { event }] of sent.entries())
          record({ op: "write", as: "agent", at: event.ts, item: plan.submitted[i] ?? {} });
        const done =
          plan.head.ok &&
          plan.stopped === null &&
          plan.applied.every((a) => a.event.decision === "allow");
        return text(JSON.stringify(answer.data, null, 2), !done);
      }
    }
  });
  return server;
}
