// The Engram pi extension (card PX1, ADR 0001). It maps pi events and tool
// calls to Plane calls and Plane results to pi results; every decision comes
// from the Plane (AGENTS.md rule 1). Every MemoryEvent the Plane appends for
// this extension is mirrored into the session as a custom entry (customType
// "engram.event", AGENTS.md rule 3) carrying the same event, failures
// included.
//
// Write path (decision D12): the gate decides in tool_call with
// Plane.checkWrite, which commits nothing; a deny is committed there (the
// Plane's deny event) and blocks the call with its reason. An allowed write
// is committed in the tool's execute by Plane.write, from the arguments
// execute receives, so a call that a later handler blocks, or that is
// aborted before it runs, never reaches the store or the log as allowed, and
// two calls sharing a tool call id are two writes with their own results.
// Since Plane.write queues writes per log, a write the check allowed can
// still be denied at the commit; execute then returns the Plane's reason and
// rule as an error result, like a deny in tool_call. Writes carry the
// actor's source `model` (decision D4).
//
// Retention (card E2.4, ADR 0025): Plane.retain sweeps a scope after an
// allowed write to it and, at before_agent_start, each of the session's
// scopes; the write itself runs its budget check in the Plane. Every retire
// and evict event, a manual rule's ask included, is mirrored like any other.
//
// Read path (decision D11): memory_read and before_agent_start's recall go
// through Plane.read; the session stores a placeholder for each, and the
// context handler shows the model only the results this extension produced,
// rebuilt and tagged (tag.ts), withholds every other memory_* result with
// one bypass_blocked event each, and defuses every tag opener in every other
// message. Compaction and branch summaries are built with memory left out
// (finding R7-15), and pi's bug-report summary finds none in the session.
//
// No-bypass (ADR 0014, decision D10): store commands are blocked in
// user_bash and in the model's bash and powershell tools, and pi's file
// tools, and any tool with a path argument at any depth, are blocked on paths
// inside a store root; core decides both (packages/core/src/no-bypass.ts, the
// same check the Claude Code hook runs) and each block is a
// Plane.recordBypass event. Shell text is normalised as a shell reads it and checked word by
// word, erring towards blocking; a store name a variable, an alias or a
// script supplies at run time is out of reach of any text check, and so is a
// shell command that reaches a root only through a path it computes.
import { createHash } from "node:crypto";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import {
  type Actor,
  type Adapter,
  BYPASS_ID,
  type Bypass,
  shellBypass as coreShellBypass,
  createPlane,
  type Db,
  type MemoryEvent,
  type MemoryItem,
  NotImplementedYet,
  type Plane,
  type Policy,
  type ReadResult,
  STORE_COMMANDS,
  toolBypass,
} from "@engram/core";
import { systemClock, uuidv7 } from "./ids.ts";
import {
  defuseMessage,
  isMemoryTool,
  ProducedResults,
  RECALL_MESSAGE,
  type RecallDetails,
  recallDetails,
  SUMMARY_NOTICE,
  sessionPlaceholder,
  tagMemoryResults,
  withoutMemory,
} from "./tag.ts";
import {
  MEMORY_EXPLAIN,
  MEMORY_READ,
  MEMORY_SIMULATE,
  MEMORY_WRITE,
  notImplementedText,
  writeResultText,
} from "./tools.ts";

export const ENGRAM_EVENT = "engram.event";
/** The rule id of a blocked store command (ADR 0014); the Plane's. */
export const NO_BYPASS_ID = BYPASS_ID;

export interface EngramExtensionOptions {
  /** The Engram log, migrated. */
  db: Db;
  /** The store the plane governs. */
  adapter: Adapter;
  policy: Policy;
  /** Who this session acts as. The extension adds `source: "model"` for the agent's writes. */
  actor: Actor;
  /** UUIDv7 source for event and item ids; defaults to a random one. */
  newId?: () => string;
  /** ISO 8601 UTC time of each decision; defaults to the wall clock. */
  now?: () => string;
  /** Store CLIs blocked in shell commands; defaults to STORE_COMMANDS. */
  storeCommands?: readonly string[];
  /** Directories holding store files (a files adapter's root); file tools are blocked inside them. */
  storeRoots?: readonly string[];
  /** Inject governed recall for each prompt in before_agent_start. Default true. */
  recall?: boolean;
  /** Wraps the Plane the extension builds; for tests, a fake around the real Plane. */
  wrapPlane?: (plane: Plane) => Plane;
}

/** What a memory_write result carries in its details. */
export interface WriteDetails {
  event_id: string;
  item_id: string | null;
  status: MemoryItem["status"] | null;
  policy_id: string;
}

const sha256 = (s: string) => `sha256:${createHash("sha256").update(s).digest("hex")}`;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const refusal = (event: MemoryEvent) => `engram: ${event.reason} (${event.policy_id})`;

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
    // The Plane sets the kind and actor from the actor's source (decision D4).
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

const modelOf = (ctx: { model?: { provider: string; id: string } | undefined }) =>
  ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined;

/** Shell tools whose `command` is checked for store names. */
const SHELL_TOOLS = new Set(["bash", "powershell"]);

export function createEngramExtension(options: EngramExtensionOptions): ExtensionFactory {
  const newId = options.newId ?? (() => uuidv7());
  const now = options.now ?? systemClock;
  const storeCommands = options.storeCommands ?? STORE_COMMANDS;
  const storeRoots = options.storeRoots ?? [];
  const { db, adapter } = options;
  const actor = options.actor;
  /** The actor of the agent's tool calls: what it writes is model content (decision D4). */
  const agent: Actor = { ...actor, source: "model" };
  const built = createPlane({ db, adapter, policy: options.policy, newId });
  const plane = options.wrapPlane ? options.wrapPlane(built) : built;

  return (pi: ExtensionAPI) => {
    const record = new ProducedResults();
    /** The events mirrored into this session, in order: memory_simulate's workload. */
    const mirrored: MemoryEvent[] = [];
    const mirroredIds = new Set<string>();
    const withheldLogged = new Set<string>();

    /**
     * Runs a Plane call and mirrors every event it appended, also when it
     * throws (a store failure appends its event and rethrows).
     */
    async function planeCall<T>(run: () => Promise<T>): Promise<T> {
      const before = plane.events().length;
      try {
        return await run();
      } finally {
        for (const event of plane.events().slice(before)) {
          if (mirroredIds.has(event.id)) continue;
          mirroredIds.add(event.id);
          mirrored.push(event);
          pi.appendEntry(ENGRAM_EVENT, event);
        }
      }
    }

    const read = async (text: string): Promise<RecallDetails> => {
      const result: ReadResult = await planeCall(() => plane.read(agent, { text, at: now() }));
      const { event, filtered, items, explanations } = result;
      return recallDetails(event.id, event.policy_id, filtered, items, explanations);
    };

    const bypass = (b: Bypass) => planeCall(() => plane.recordBypass(agent, b, now()));

    /** Core decides (no-bypass.ts); the extension records what it blocks. */
    const check = (cwd: string) => ({
      cwd,
      roots: storeRoots,
      stores: storeCommands,
      rootStore: adapter.name,
    });

    /** A bypass event when `command` names a store or reaches a store root, else undefined. */
    const shellBypass = async (command: string, cwd: string, shell?: "powershell") => {
      // pi's powershell tool reads `\` as a path separator on every platform.
      const found = coreShellBypass(command, { ...check(cwd), ...(shell ? { shell } : {}) });
      return found === undefined ? undefined : bypass(found);
    };

    /** A bypass event when the tool call names a path inside a store root, else undefined. */
    const pathBypass = async (toolName: string, input: Record<string, unknown>, cwd: string) => {
      const found = toolBypass(toolName, input, check(cwd));
      return found === undefined ? undefined : bypass(found);
    };

    /** Runs a memory tool's body and records the text it produced, or the error it threw. */
    async function produce<D>(
      toolCallId: string,
      toolName: string,
      body: () => Promise<{ text: string; details: D }>,
    ) {
      try {
        const { text, details } = await body();
        record.addText(toolCallId, toolName, actor.id, text, false);
        return { content: [{ type: "text" as const, text }], details };
      } catch (e) {
        record.addText(toolCallId, toolName, actor.id, message(e), true);
        throw e;
      }
    }

    pi.registerTool({
      ...MEMORY_WRITE,
      async execute(toolCallId, params, _signal, _onUpdate, ctx) {
        // The committed decision (decision D12): tool_call only checked it.
        // Writes over one log are queued in the Plane, and the policy or the
        // projection may change between the check and the commit, so a write
        // tool_call allowed can be denied here. The deny is reported as
        // tool_call reports one (an error result with the Plane's reason and
        // rule), returned rather than thrown so its details keep the event.
        try {
          const at = now();
          const item = itemFromCall(
            params as Record<string, unknown>,
            { item: newId(), toolCallId },
            actor,
            at,
            modelOf(ctx),
          );
          const written = await planeCall(() => plane.write(agent, item, at));
          const { event } = written;
          let stored = written.item;
          // Retention after an allowed write (ADR 0025): the write already ran
          // the budget check of its class; the sweep also retires what has
          // expired in the scope. Every retirement is mirrored as an event,
          // and the result reports the item as the sweep left it (P4-1).
          if (stored) {
            const { scope } = stored;
            const swept = await planeCall(() => plane.retain(actor, scope, at));
            if ([...swept.expired, ...swept.evicted].includes(stored.id))
              stored = { ...stored, status: "retired" };
          }
          const details: WriteDetails = {
            event_id: event.id,
            item_id: stored?.id ?? null,
            status: stored?.status ?? null,
            policy_id: event.policy_id,
          };
          const text = stored ? writeResultText(stored) : refusal(event);
          record.addText(toolCallId, "memory_write", actor.id, text, !stored);
          return { content: [{ type: "text", text }], details, isError: !stored };
        } catch (e) {
          record.addText(toolCallId, "memory_write", actor.id, message(e), true);
          throw e;
        }
      },
    });

    pi.registerTool({
      ...MEMORY_READ,
      async execute(toolCallId, params) {
        try {
          const details = await read(params.query);
          record.addRead(toolCallId, actor.id, details);
          // The session keeps a placeholder; the context handler shows the
          // model the tagged items from the record (review round 2, defect 5).
          return { content: [{ type: "text", text: sessionPlaceholder(details) }], details };
        } catch (e) {
          record.addText(toolCallId, "memory_read", actor.id, message(e), true);
          throw e;
        }
      },
    });

    pi.registerTool({
      ...MEMORY_EXPLAIN,
      async execute(toolCallId, params) {
        return produce(toolCallId, "memory_explain", async () => {
          // Only the reader may explain a read (decision D5): another
          // actor's read id is refused by the Plane.
          const explanations = await plane.explain(agent, params.read_id);
          return {
            text: JSON.stringify(explanations, null, 2),
            details: { read_id: params.read_id, explanations },
          };
        });
      },
    });

    pi.registerTool({
      ...MEMORY_SIMULATE,
      async execute(toolCallId) {
        return produce(toolCallId, "memory_simulate", async () => {
          try {
            const report = await plane.simulate(
              { id: "session", events: [...mirrored] },
              options.policy,
            );
            return { text: JSON.stringify(report, null, 2), details: report };
          } catch (e) {
            if (e instanceof NotImplementedYet) {
              throw new Error(notImplementedText("memory_simulate", e.card));
            }
            throw e;
          }
        });
      },
    });

    pi.on("tool_call", async (event, ctx) => {
      const input = event.input as Record<string, unknown>;
      if (event.toolName === "memory_write") {
        const at = now();
        const item = itemFromCall(
          input,
          { item: newId(), toolCallId: event.toolCallId },
          actor,
          at,
          modelOf(ctx),
        );
        const check = await plane.checkWrite(agent, item, at);
        if (check.decision === "allow") return undefined;
        // A deny is committed here: one deny event, and nothing reaches the store.
        const { event: denied } = await planeCall(() => plane.write(agent, item, at));
        const reason = refusal(denied);
        record.addText(event.toolCallId, "memory_write", actor.id, reason, true);
        return { block: true, reason };
      }
      if (isMemoryTool(event.toolName)) return undefined;
      let blocked: MemoryEvent | undefined;
      if (SHELL_TOOLS.has(event.toolName)) {
        blocked = await shellBypass(
          String(input.command ?? ""),
          ctx.cwd,
          event.toolName === "powershell" ? "powershell" : undefined,
        );
      }
      blocked ??= await pathBypass(event.toolName, input, ctx.cwd);
      return blocked ? { block: true, reason: refusal(blocked) } : undefined;
    });

    pi.on("user_bash", async (event) => {
      const blocked = await shellBypass(event.command, event.cwd);
      if (blocked === undefined) return undefined;
      const output = `${refusal(blocked)}\n`;
      return { result: { output, exitCode: 126, cancelled: false, truncated: false } };
    });

    pi.on("before_agent_start", async (event) => {
      // Retention for the session's scopes before each prompt (ADR 0025): the
      // plane has no clock, so the surfaces sweep. A sweep with nothing to do
      // appends nothing.
      const at = now();
      for (const scope of actor.memberships) await planeCall(() => plane.retain(actor, scope, at));
      if (options.recall === false || event.messageType !== "user") return undefined;
      const details = await read(event.prompt);
      if (details.items.length === 0) return undefined;
      record.addRecall(actor.id, details);
      return {
        message: {
          customType: RECALL_MESSAGE,
          content: sessionPlaceholder(details),
          display: false,
          details,
        },
      };
    });

    pi.on("context", async (event) => {
      const { messages, withheld } = tagMemoryResults(event.messages, record, actor.id);
      for (const w of withheld) {
        if (withheldLogged.has(w.key)) continue;
        withheldLogged.add(w.key);
        await bypass({
          command: `${w.toolName} result ${w.toolCallId ?? w.key}`,
          store: adapter.name,
          route: "result",
        });
      }
      return { messages };
    });

    // Summaries are made from the session's messages without the context
    // event, so memory is left out of them (finding R7-15). Pi summarises the
    // arrays it handed the handler; their slots are replaced, never the
    // messages or entries themselves, which belong to the session.
    pi.on("session_before_compact", async (event) => {
      const { preparation } = event;
      for (const list of [preparation.messagesToSummarize, preparation.turnPrefixMessages]) {
        list.splice(0, list.length, ...withoutMemory(list));
      }
      return undefined;
    });

    pi.on("session_before_tree", async (event) => {
      const entries = event.preparation.entriesToSummarize;
      entries.splice(
        0,
        entries.length,
        ...entries.map((e) => {
          if (e.type === "message") {
            const [m] = withoutMemory([e.message]);
            return m === e.message ? e : { ...e, message: m as typeof e.message };
          }
          if (e.type === "custom_message" && e.customType === RECALL_MESSAGE)
            return { ...e, content: SUMMARY_NOTICE, details: {} };
          // Another extension's message, a summary: forged tags defused (defect 3).
          return defuseMessage(e);
        }),
      );
      return undefined;
    });
  };
}
