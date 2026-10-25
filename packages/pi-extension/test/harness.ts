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
import { type Actor, migrate, openSqlite } from "@engram/core";
import { type ScriptStep, scriptedPiModel } from "@engram/runner";

export interface HarnessRun {
  session: AgentSession;
  sessionManager: SessionManager;
  scripted: ReturnType<typeof scriptedPiModel>;
  cwd: string;
}

export async function startSession(
  extension: ExtensionFactory,
  steps: readonly ScriptStep[],
  tools: string[],
): Promise<HarnessRun> {
  const cwd = mkdtempSync(join(tmpdir(), "engram-s05-"));
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
    extensionFactories: [extension],
    noSkills: true,
    noPromptTemplates: true,
    noContextFiles: true,
    noThemes: true,
    disabledBuiltinExtensions: ["mcp", "llama"],
    systemPrompt: "You are a test agent.",
  });
  await resourceLoader.reload();
  const sessionManager = SessionManager.inMemory(cwd);
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    model: scripted.model,
    thinkingLevel: "off",
    modelRuntime,
    resourceLoader,
    sessionManager,
    settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
    tools,
  });
  return { session, sessionManager, scripted, cwd };
}

/** The fixed time every decision in a harness run is made at. */
export const AT = "2026-10-25T12:00:00.000Z";

/** Deterministic UUIDv7 ids: `id(n)` is the n-th id an id source hands out. */
export const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;

/** The agent session acts for omar, in his person context, as a member of team:platform. */
export const OMAR: Actor = {
  id: "person:omar",
  level: "person",
  memberships: ["person:omar", "team:platform"],
};

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
