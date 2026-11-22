// The workspace (card E8.15b, docs/design/tui.md 8.3): the flags that name
// where and as whom a command runs, each with where its value came from
// (flag, environment, saved, set in this session, or the CLI's default). A
// value set here is passed to every command that takes the flag; a value
// from the environment or the default is not written on the command line,
// since the shell finds it the same way. With a server, the workspace's own
// flags are left out, as `connect` refuses them. The cheap checks are the
// functions doctor itself uses (8.2); nothing here decides anything.
import { relative, sep } from "node:path";
import { connect, SERVER_URL_ENV, TOKEN_ENV } from "../connect.ts";
import { type CheckResult, checkLog } from "../doctor.ts";
import type { CommandSpec, Values } from "../registry.ts";
import type { Io } from "../run.ts";
import { buildActor, DB_URL_ENV, type DbTarget, dbTarget, loadPolicy } from "../setup.ts";

/** The workspace flags, in the order a command line writes them. */
export const WORKSPACE_FLAGS = [
  "server",
  "db",
  "policy",
  "owner",
  "as",
  "level",
  "member",
  "store",
  "root",
  "import-valid-from",
  "keys",
  "otlp",
  "export-jsonl",
] as const;
export type WsFlag = (typeof WORKSPACE_FLAGS)[number];

/** The flags that name the in-process workspace, which a server has its own of (connect.ts). */
export const SERVER_REFUSES: readonly WsFlag[] = [
  "db",
  "root",
  "store",
  "policy",
  "import-valid-from",
  "otlp",
  "export-jsonl",
];

export type Source = "flag" | "env" | "saved" | "set" | "default";

export interface WsValue {
  value: string | readonly string[];
  source: Source;
}

export const isWsFlag = (k: string): k is WsFlag =>
  (WORKSPACE_FLAGS as readonly string[]).includes(k);

export class Workspace {
  private readonly values = new Map<WsFlag, WsValue>();
  private readonly env: Readonly<Record<string, string | undefined>>;

  constructor(env: Readonly<Record<string, string | undefined>>) {
    this.env = env;
  }

  /** The saved flags, then the flags given (which win). */
  static from(
    env: Readonly<Record<string, string | undefined>>,
    given: Values,
    saved: Readonly<Record<string, string | readonly string[]>> | undefined,
  ): Workspace {
    const ws = new Workspace(env);
    for (const [k, v] of Object.entries(saved ?? {}))
      if (isWsFlag(k)) ws.set(k, v as string | string[], "saved");
    for (const [k, v] of Object.entries(given))
      if (isWsFlag(k) && (typeof v === "string" || Array.isArray(v))) ws.set(k, v, "flag");
    return ws;
  }

  clone(): Workspace {
    const ws = new Workspace(this.env);
    for (const [k, v] of this.values) ws.values.set(k, v);
    return ws;
  }

  get(flag: WsFlag): string | undefined {
    const v = this.values.get(flag)?.value;
    return typeof v === "string" ? v : undefined;
  }
  list(flag: WsFlag): readonly string[] {
    const v = this.values.get(flag)?.value;
    return Array.isArray(v) ? v : [];
  }
  source(flag: WsFlag): Source {
    if (this.values.has(flag)) return (this.values.get(flag) as WsValue).source;
    if (flag === "db" && this.env[DB_URL_ENV]) return "env";
    if (flag === "server" && this.env[SERVER_URL_ENV]) return "env";
    return "default";
  }
  /** Sets a flag; an empty value, or an empty list, unsets it. */
  set(flag: WsFlag, value: string | readonly string[] | undefined, source: Source = "set"): void {
    const empty =
      value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
    if (empty) this.values.delete(flag);
    else this.values.set(flag, { value: Array.isArray(value) ? [...value] : value, source });
  }

  /** Every flag set, as parsed flag values (what `writes` and `connect` read). */
  flagValues(): Record<string, string | readonly string[]> {
    return Object.fromEntries([...this.values].map(([k, v]) => [k, v.value]));
  }
  /** The flags set here (not from the environment or the default), for tui.json. */
  savable(): Record<string, string | readonly string[]> {
    return Object.fromEntries(
      [...this.values].filter(([, v]) => v.source !== "env").map(([k, v]) => [k, v.value]),
    );
  }

  /** The server named, by a flag or ENGRAM_SERVER_URL. */
  server(): string | undefined {
    return this.get("server") ?? (this.env[SERVER_URL_ENV] || undefined);
  }

  /**
   * The workspace's flags that `spec` takes, as command-line words, in
   * WORKSPACE_FLAGS order; `skip` names flags the form gives itself. With a
   * server, the flags it has its own of are left out for every command that
   * can call one.
   */
  argsFor(spec: Pick<CommandSpec, "options">, skip: ReadonlySet<string> = new Set()): string[] {
    const takes = (f: string) => Object.hasOwn(spec.options, f);
    const viaServer = takes("server") && this.server() !== undefined;
    const out: string[] = [];
    for (const flag of WORKSPACE_FLAGS) {
      if (!takes(flag) || skip.has(flag) || !this.values.has(flag)) continue;
      if (viaServer && SERVER_REFUSES.includes(flag)) continue;
      const v = (this.values.get(flag) as WsValue).value;
      for (const one of Array.isArray(v) ? v : [v]) out.push(`--${flag}`, one as string);
    }
    return out;
  }

  /** The actor's id: --as, else person:<owner>; undefined when neither is set. */
  actorId(): string | undefined {
    return (
      this.get("as") ??
      (this.get("owner") === undefined ? undefined : `person:${this.get("owner")}`)
    );
  }

  /** The title bar's actor: `person:dana (person)`, or "no actor yet". */
  actorLabel(): string {
    try {
      const a = buildActor(
        { as: this.get("as"), level: this.get("level"), member: [...this.list("member")] },
        this.get("owner"),
      );
      return `${a.id} (${a.level})`;
    } catch {
      return this.actorId() ?? "no actor yet";
    }
  }

  /** "in process", or "server <host:port>". */
  connectionLabel(): string {
    const s = this.server();
    if (s === undefined) return "in process";
    try {
      return `server ${new URL(s).host}`;
    } catch {
      return `server ${s}`;
    }
  }

  /** Whether a bearer token is set for a server (never its value). */
  tokenSet(): boolean {
    return Boolean(this.env[TOKEN_ENV]);
  }
}

/**
 * The message `connect` gives when the workspace flags are named with a
 * server, word for word: the workspace panel shows it beside the greyed fields.
 */
export function serverRefusal(io: Io, server: string): string {
  try {
    connect(
      { ...io, env: {} },
      { server, db: "", root: "", store: "", policy: "", "import-valid-from": "" },
      () => ({}),
      undefined,
    );
  } catch (e) {
    return (e as Error).message;
  }
  return "";
}

/** A path for display: under the home as ~/..., under the working folder relative, with forward slashes. */
export function shortPath(path: string, io: Pick<Io, "home" | "cwd">): string {
  const norm = (p: string) => p.split(sep).join("/");
  const inside = (base: string) => {
    const r = relative(base, path);
    return r !== "" && !r.startsWith("..") && !/^[a-zA-Z]:/.test(r) && !r.startsWith(sep)
      ? r
      : undefined;
  };
  if (path === io.cwd) return ".";
  const underCwd = inside(io.cwd);
  // From the home folder itself, ~/ reads better than a relative path.
  if (underCwd !== undefined && io.cwd !== io.home) return norm(underCwd);
  const underHome = inside(io.home);
  if (underHome !== undefined) return `~/${norm(underHome)}`;
  return norm(path);
}

/** The log's label for display, shortened when it is a SQLite path. */
export function logLabel(target: DbTarget, io: Pick<Io, "home" | "cwd">): string {
  return target.backend === "sqlite" && target.label === target.path
    ? shortPath(target.path, io)
    : target.label;
}

export interface CheapCheck {
  status: CheckResult[0];
  detail: string;
}

export interface CheapChecks {
  log: CheapCheck;
  policy: CheapCheck;
  actor: CheapCheck;
  /** The policy's label, `preset.medium v1`, when it loaded. */
  policyLabel?: string;
  /** The log's label for display, when the target parsed. */
  logLabel?: string;
}

/** Usable when no cheap check failed. */
export const usable = (c: CheapChecks) =>
  c.log.status !== "fail" && c.policy.status !== "fail" && c.actor.status !== "fail";

/**
 * The three cheap checks of 8.2, the functions doctor uses: the log
 * (checkLog: absent, usable or refused), the policy (loadPolicy) and an actor
 * (--as or --owner, built as every command builds it). Never the full doctor.
 * With a server, its log and policy are its own and are not checked here.
 */
export function cheapChecks(ws: Workspace, io: Io): CheapChecks {
  const out: CheapChecks = {
    log: { status: "skip", detail: "the server's own" },
    policy: { status: "skip", detail: "the server's own" },
    actor: { status: "ok", detail: "" },
  };
  if (ws.server() === undefined) {
    try {
      const target = dbTarget(ws.get("db"), io);
      const label = logLabel(target, io);
      out.logLabel = label;
      const [status, detail] = checkLog(target);
      out.log = { status, detail: detail.split(target.label).join(label) };
    } catch (e) {
      out.log = { status: "fail", detail: (e as Error).message };
    }
    try {
      const p = loadPolicy(ws.get("policy"), io.cwd);
      out.policyLabel = `${p.id} v${p.version}`;
      out.policy = { status: "ok", detail: `${p.id} v${p.version} loads and validates` };
    } catch (e) {
      out.policy = { status: "fail", detail: (e as Error).message };
    }
  }
  try {
    const a = buildActor(
      { as: ws.get("as"), level: ws.get("level"), member: [...ws.list("member")] },
      ws.get("owner"),
    );
    out.actor = { status: "ok", detail: `acts as ${a.id} (${a.level})` };
  } catch (e) {
    out.actor = { status: "fail", detail: (e as Error).message };
  }
  return out;
}
