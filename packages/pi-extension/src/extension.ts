// The Engram pi extension (card PX1, ADR 0001). It maps pi events and tool
// calls to Plane calls and Plane results to pi results; every decision comes
// from the Plane (AGENTS.md rule 1). The write gate runs in tool_call, the
// read filter in memory_read and before_agent_start (governed recall), the
// memory tag in context, and store commands are blocked in user_bash and in
// the model's bash tool (ADR 0014). Every MemoryEvent is appended to the
// Engram log by the Plane and mirrored into the session as a custom entry
// (customType "engram.event", AGENTS.md rule 3) carrying the same event.
import { createHash } from "node:crypto";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import {
  type Actor,
  type Adapter,
  BYPASS_ID,
  createPlane,
  type Db,
  type MemoryEvent,
  type MemoryItem,
  NotImplementedYet,
  type Policy,
  type ReadResult,
  type WriteResult,
} from "@engram/core";
import { Type } from "typebox";
import { blockedStoreCommand, STORE_COMMANDS } from "./bash.ts";
import { systemClock, uuidv7 } from "./ids.ts";
import {
  RECALL_MESSAGE,
  type RecallDetails,
  recallDetails,
  renderRecall,
  tagMemoryResults,
} from "./tag.ts";

export const ENGRAM_EVENT = "engram.event";
/** The rule id of a blocked store command (ADR 0014); the Plane's. */
export const NO_BYPASS_ID = BYPASS_ID;

export interface EngramExtensionOptions {
  /** The Engram log, migrated. */
  db: Db;
  /** The store the plane governs. */
  adapter: Adapter;
  policy: Policy;
  /** Who this session acts as. */
  actor: Actor;
  /** UUIDv7 source for event and item ids; defaults to a random one. */
  newId?: () => string;
  /** ISO 8601 UTC time of each decision; defaults to the wall clock. */
  now?: () => string;
  /** Store CLIs blocked in bash; defaults to STORE_COMMANDS. */
  storeCommands?: readonly string[];
  /** Inject governed recall for each prompt in before_agent_start. Default true. */
  recall?: boolean;
}

/** What a memory_write result carries in its details. */
export interface WriteDetails {
  event_id: string;
  item_id: string | null;
  status: MemoryItem["status"] | null;
  policy_id: string;
}

const sha256 = (s: string) => `sha256:${createHash("sha256").update(s).digest("hex")}`;

/** The memory_write arguments as a MemoryItem. Nothing is checked here: the Plane validates. */
function itemFromCall(
  input: Record<string, unknown>,
  ids: { item: string; toolCallId: string },
  actor: Actor,
  at: string,
  model: string | undefined,
): MemoryItem {
  return {
    id: ids.item,
    class: input.class ?? "semantic",
    scope: input.scope,
    owner: actor.id,
    content: input.content,
    // The content comes from the model through a tool call: its kind is set by
    // the harness, never by the caller (docs/architecture.md, "Write path").
    provenance: {
      kind: "model",
      ref: `pi:tool_call/${ids.toolCallId}`,
      hash: sha256(JSON.stringify(input)),
      actor: actor.id,
      ...(model ? { model } : {}),
    },
    confidence: input.confidence ?? 0.5,
    valid_from: at,
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 0,
  } as unknown as MemoryItem;
}

export function createEngramExtension(options: EngramExtensionOptions): ExtensionFactory {
  const newId = options.newId ?? (() => uuidv7());
  const now = options.now ?? systemClock;
  const storeCommands = options.storeCommands ?? STORE_COMMANDS;
  const { actor, db } = options;
  const plane = createPlane({ db, adapter: options.adapter, policy: options.policy, newId });

  return (pi: ExtensionAPI) => {
    const writes = new Map<string, WriteResult>();
    const mirror = (event: MemoryEvent) => pi.appendEntry(ENGRAM_EVENT, event);

    const read = async (text: string): Promise<{ result: ReadResult; details: RecallDetails }> => {
      const result = await plane.read(actor, { text, at: now() });
      mirror(result.event);
      const { event, filtered, items, explanations } = result;
      return {
        result,
        details: recallDetails(event.id, event.policy_id, filtered, items, explanations),
      };
    };

    /** Records a blocked store command as a bypass_blocked event; undefined when none is named. */
    const noBypass = async (command: string): Promise<MemoryEvent | undefined> => {
      const store = blockedStoreCommand(command, storeCommands);
      if (store === undefined) return undefined;
      const event = await plane.recordBypass(actor, { command, store }, now());
      mirror(event);
      return event;
    };

    pi.registerTool({
      name: "memory_write",
      label: "Memory write",
      description:
        "Write one item to governed memory in a scope such as person:<id>, team:<id> or org. The policy decides whether it lands.",
      parameters: Type.Object({
        scope: Type.String(),
        content: Type.String(),
        class: Type.Optional(Type.Union([Type.Literal("semantic"), Type.Literal("episodic")])),
        confidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
      }),
      async execute(toolCallId) {
        // The gate ran in tool_call; a blocked call never executes, so this
        // reports the write the Plane already made, without writing twice.
        const done = writes.get(toolCallId);
        writes.delete(toolCallId);
        if (!done?.item) throw new Error(`engram: no gated write for tool call ${toolCallId}`);
        const { item, event } = done;
        const details: WriteDetails = {
          event_id: event.id,
          item_id: item.id,
          status: item.status,
          policy_id: event.policy_id,
        };
        return {
          content: [{ type: "text", text: `stored ${item.id} in ${item.scope} as ${item.status}` }],
          details,
        };
      },
    });

    pi.registerTool({
      name: "memory_read",
      label: "Memory read",
      description: "Read the governed memory items this session may see that match a query.",
      parameters: Type.Object({ query: Type.String() }),
      async execute(_toolCallId, params) {
        const { details } = await read(params.query);
        return { content: [{ type: "text", text: renderRecall(details) }], details };
      },
    });

    pi.registerTool({
      name: "memory_explain",
      label: "Memory explain",
      description:
        "Explain why a read returned what it did: score components, rank, admitting rule, grants, validity.",
      parameters: Type.Object({ read_id: Type.String() }),
      async execute(_toolCallId, params) {
        const explanations = await plane.explain(params.read_id);
        return {
          content: [{ type: "text", text: JSON.stringify(explanations, null, 2) }],
          details: { read_id: params.read_id, explanations },
        };
      },
    });

    pi.registerTool({
      name: "memory_simulate",
      label: "Memory simulate",
      description:
        "Replay this session's memory events under the current policy and report which decisions would change.",
      parameters: Type.Object({}),
      async execute() {
        try {
          const report = await plane.simulate(
            { id: "session", events: plane.events() },
            options.policy,
          );
          return {
            content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
            details: report,
          };
        } catch (e) {
          if (e instanceof NotImplementedYet) {
            throw new Error(`memory_simulate: not implemented yet (card ${e.card})`);
          }
          throw e;
        }
      },
    });

    pi.on("tool_call", async (event, ctx) => {
      if (event.toolName === "memory_write") {
        const model = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined;
        const at = now();
        const item = itemFromCall(
          event.input as Record<string, unknown>,
          { item: newId(), toolCallId: event.toolCallId },
          actor,
          at,
          model,
        );
        const result = await plane.write(actor, item, at);
        mirror(result.event);
        if (result.item === null) {
          const { reason, policy_id } = result.event;
          return { block: true, reason: `engram: ${reason} (${policy_id})` };
        }
        writes.set(event.toolCallId, result);
        return undefined;
      }
      if (event.toolName === "bash") {
        const command = String((event.input as Record<string, unknown>).command ?? "");
        const blocked = await noBypass(command);
        if (blocked === undefined) return undefined;
        return { block: true, reason: `engram: ${blocked.reason} (${blocked.policy_id})` };
      }
      return undefined;
    });

    pi.on("before_agent_start", async (event) => {
      if (options.recall === false || event.messageType !== "user") return undefined;
      const { details } = await read(event.prompt);
      if (details.items.length === 0) return undefined;
      return {
        message: {
          customType: RECALL_MESSAGE,
          content: renderRecall(details),
          display: false,
          details,
        },
      };
    });

    pi.on("context", async (event) => ({ messages: tagMemoryResults(event.messages) }));

    pi.on("user_bash", async (event) => {
      const blocked = await noBypass(event.command);
      if (blocked === undefined) return undefined;
      const output = `engram: ${blocked.reason} (${blocked.policy_id})\n`;
      return { result: { output, exitCode: 126, cancelled: false, truncated: false } };
    });
  };
}
