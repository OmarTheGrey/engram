// Layer 5 harness: a real pi SDK session with an in-memory session manager,
// a scripted model and the Engram extension. Nothing reads user config: the
// agent directory is a fresh temporary directory.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AgentSession,
  createAgentSession,
  DefaultResourceLoader,
  type ExtensionFactory,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { createFakeAdapter } from "@engram/adapters";
import { type Actor, type MemoryItem, migrate, openSqlite } from "@engram/core";
import { type ScriptStep, scriptedPiModel } from "@engram/runner";

export interface HarnessRun {
  session: AgentSession;
  sessionManager: SessionManager;
  scripted: ReturnType<typeof scriptedPiModel>;
  cwd: string;
}

export interface SessionOptions {
  /** Continue this session (a resume) instead of starting an empty one; it keeps its cwd. */
  resume?: { sessionManager: SessionManager; cwd: string };
  /** Pi's compaction settings; compaction is off unless given. */
  compaction?: { enabled: boolean; keepRecentTokens?: number; reserveTokens?: number };
}

/** A pi SDK session loading `extensions` in order, answered by `steps`. */
export async function startSession(
  extensions: ExtensionFactory | readonly ExtensionFactory[],
  steps: readonly ScriptStep[],
  tools: string[],
  options: SessionOptions = {},
): Promise<HarnessRun> {
  const cwd = options.resume?.cwd ?? mkdtempSync(join(tmpdir(), "engram-s05-"));
  const agentDir = join(cwd, ".pi-agent");
  const scripted = scriptedPiModel(steps);
  const modelRuntime = await ModelRuntime.create({
    authPath: join(agentDir, "auth.json"),
    modelsPath: join(agentDir, "models.json"),
  });
  modelRuntime.registerNativeProvider(scripted.provider);
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    extensionFactories: Array.isArray(extensions) ? [...extensions] : [extensions],
    noSkills: true,
    noPromptTemplates: true,
    noContextFiles: true,
    noThemes: true,
    disabledBuiltinExtensions: ["mcp", "llama"],
    systemPrompt: "You are a test agent.",
  });
  await resourceLoader.reload();
  const sessionManager = options.resume?.sessionManager ?? SessionManager.inMemory(cwd);
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    model: scripted.model,
    thinkingLevel: "off",
    modelRuntime,
    resourceLoader,
    sessionManager,
    settingsManager: SettingsManager.inMemory({
      compaction: options.compaction ?? { enabled: false },
    }),
    tools,
  });
  return { session, sessionManager, scripted, cwd };
}

/** The fixed time every decision in a harness run is made at. */
export const AT = "2026-10-25T12:00:00.000Z";

/** Deterministic UUIDv7 ids: `id(n)` is the n-th id an id source hands out. */
export const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;

/**
 * The agent session acts for omar, in his person context, as a member of
 * team:platform and of the org, so an org write is his to attempt and the
 * preset's rule for org decides it (decision D4 checks membership first).
 */
export const OMAR: Actor = {
  id: "person:omar",
  level: "person",
  memberships: ["person:omar", "team:platform", "org"],
};

/** The team lead: a member of team:platform and team:payroll, reading as the team. */
export const LEAD: Actor = {
  id: "person:lead",
  level: "team",
  memberships: ["team:platform", "team:payroll"],
};

/** A user-sourced team fact the lead wrote before the session. */
export function teamFact(itemId: string, scope: string, content: string): MemoryItem {
  return {
    id: itemId,
    class: "semantic",
    scope,
    owner: LEAD.id,
    content,
    provenance: {
      kind: "user",
      ref: "wiki/deploys",
      hash: `sha256:${"0".repeat(64)}`,
      actor: LEAD.id,
    },
    confidence: 0.9,
    valid_from: "2026-10-01T00:00:00.000Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 0,
  };
}

/** The tool result messages of a session, by tool call id, in order. */
export function toolResults(sessionManager: SessionManager, toolCallId?: string) {
  return sessionManager
    .getEntries()
    .flatMap((e) =>
      e.type === "message" &&
      e.message.role === "toolResult" &&
      (toolCallId === undefined || e.message.toolCallId === toolCallId)
        ? [e.message]
        : [],
    );
}

/** Everything the model was sent, as one string. */
export const sentToModel = (scripted: { seen: unknown[] }) => JSON.stringify(scripted.seen);

/** A migrated in-memory Engram log, the fake store and an id source shared by every plane over them. */
export function freshLog() {
  const db = openSqlite(":memory:");
  migrate(db);
  const adapter = createFakeAdapter();
  let n = 0;
  const newId = () => id(++n);
  return { db, adapter, newId };
}

/** The engram.event custom entries of a session, in order. */
export function sessionEvents(sessionManager: SessionManager): unknown[] {
  return sessionManager
    .getEntries()
    .flatMap((e) => (e.type === "custom" && e.customType === "engram.event" ? [e.data] : []));
}

/**
 * Runs a user `!` command the way pi's RPC host does (modes/rpc/rpc-mode.ts,
 * case "bash"): emit user_bash, record a replacement result, or execute.
 * `session.executeBash` alone never emits user_bash.
 */
export async function hostUserBash(session: AgentSession, command: string) {
  const handled = await session.extensionRunner.emitUserBash({
    type: "user_bash",
    command,
    excludeFromContext: false,
    cwd: session.sessionManager.getCwd(),
  });
  if (handled?.result) {
    session.recordBashResult(command, handled.result);
    return handled.result;
  }
  return session.executeBash(command, undefined, { operations: handled?.operations });
}

/** Session JSONL with ids, timestamps, durations, usage and the temporary cwd made stable. */
export function normalizedJsonl(sessionManager: SessionManager, cwd: string): string {
  const header = sessionManager.getHeader();
  const entries = sessionManager.getEntries();
  const ids = new Map<string, string>();
  entries.forEach((e, i) => {
    ids.set(e.id, `e${String(i + 1).padStart(2, "0")}`);
  });
  const stable = (value: unknown, key?: string): unknown => {
    // The scripted model estimates usage from prompt length, which includes the path.
    if (key === "usage") return "{usage}";
    if (Array.isArray(value)) return value.map((v) => stable(v));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stable(v, k)]));
    }
    if (key === "timestamp") return typeof value === "number" ? 0 : "2026-01-01T00:00:00.000Z";
    if (key === "durationMs") return 0;
    if ((key === "id" || key === "parentId") && typeof value === "string" && ids.has(value)) {
      return ids.get(value);
    }
    if (typeof value === "string") {
      return [cwd, cwd.replaceAll("\\", "/")].reduce((v, p) => v.split(p).join("{cwd}"), value);
    }
    return value;
  };
  const head = { ...(stable(header) as object), id: "<session>" };
  return [head, ...entries.map((e) => stable(e))].map((l) => JSON.stringify(l)).join("\n") + "\n";
}
