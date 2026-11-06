// The workspace a server, the CLI and the MCP server act on (card E8.1, ADR
// 0027): the event log, the policy and the store, opened from the same flags
// `engram serve` and every CLI command take. Moved here from packages/cli so
// the server owns what it serves and the CLI imports it (plan
// docs/tasks/gate-b-plan.md, PR 3 item 2). No policy decision is made here
// (AGENTS.md rule 1); the Plane makes them all.
//
// The log is opened on first use: `openWorkspace` loads the policy and builds
// the store at once, so a bad flag is reported before anything else, and
// `open()` opens and migrates the log, which a caller does before its first
// request when it wants the log's errors printed as they are (the CLI). A
// route whose Plane method has not landed (lint, distill) never opens it, nor
// does simulate, which replays on scratch logs of its own (card E8.9).
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createFilesAdapter, deferLettaAdapter, NotMemfsRepositoryError } from "@engram/adapters";
import {
  type Actor,
  type Adapter,
  createPlane,
  type Db,
  loadPreset,
  MIGRATIONS,
  migrate,
  openPostgres,
  openSqlite,
  type Plane,
  type PlaneDeps,
  type Policy,
  PRESETS,
  type PresetName,
  parsePolicy,
} from "@engram/core";

/** Bad input: printed with the command name, exit code 2. */
export class UsageError extends Error {}

/**
 * The event log when --db is not given: per user, under the home folder, so
 * dogfood content never lands inside a repository by default (AGENTS.md
 * rule 12, decision D9). `home` comes from the Io, injected in tests.
 */
export const defaultDb = (home: string) => join(home, ".engram", "engram.db");
export const MEMORY_DB = ":memory:";

/** The variable that names the event log when --db is not given (ADR 0024). */
export const DB_URL_ENV = "ENGRAM_DB_URL";

/**
 * Where an event log lives: SQLite in memory, a SQLite file, or a Postgres
 * database (ADR 0024). `label` is what the CLI prints: the path, or the URL
 * with its userinfo and every secret-like query parameter replaced by `***`.
 * `source` says where the target came from, so a hint can say how to name it
 * again without printing a secret.
 */
export type DbTarget = (
  | { backend: "sqlite"; path: string }
  | { backend: "postgres"; url: string }
) & { label: string; source: "flag" | "env" | "default" };

/** Any `scheme://`: a URL, never a SQLite path. */
const SCHEME = /^([a-z][a-z0-9+.-]*):\/\//i;
const POSTGRES_SCHEMES = new Set(["postgres", "postgresql"]);
/**
 * Query keys whose value is printed as given: connection settings that carry
 * no credential. Every other value is printed as `***`. `options` is not here:
 * it can carry `-c` settings.
 */
const SHOWN_PARAMS = new Set([
  "sslmode",
  "application_name",
  "connect_timeout",
  "target_session_attrs",
]);
/** Below this length a secret is scrubbed only as a whole token, so it cannot garble a message. */
const SHORT_SECRET = 4;

/** One host of the authority: a DNS name or an IPv4 address, with an optional port. */
const HOST_PORT = /^([A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)?(?::([0-9]{1,5}))?$/;
/** A bracketed IPv6 host, which postgres.js cannot connect to (it splits the host on `:`). */
const IPV6 = /^\[[0-9A-Fa-f:.]*\](?::[0-9]{1,5})?$/;
/** A database name: letters, digits, `_`, `-`, `.`, `$` and percent-escapes. */
const DB_NAME = /^(?:[A-Za-z0-9_.$-]|%[0-9A-Fa-f]{2})*$/;
const QUERY_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

const safeDecode = (text: string) => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

/** A Postgres URL that parsed cleanly; only these parts are ever printed or scrubbed. */
interface ParsedUrl {
  scheme: string;
  /** The raw userinfo, printed as `***` whenever present. */
  userinfo: string | undefined;
  /** host[:port] list, as written: the only part of the authority printed. */
  hosts: string;
  /** The database name, without its `/`. */
  db: string | undefined;
  query: { key: string; value: string }[] | undefined;
  fragment: string | undefined;
}

/** A URL refused as unparseable: nothing after the scheme is printed. */
export class UnparseableUrl extends Error {}
/** A URL whose host is a bracketed IPv6 address. */
export class Ipv6Host extends Error {}

/**
 * Parses `scheme://[userinfo@]host[:port][,host[:port]...][/db][?query][#fragment]`
 * by an allow-list: every part must match its pattern, or the URL is
 * unparseable. The `@` that ends the userinfo must come before the first
 * `/`, `?` or `#`, and no other `@` may appear anywhere, so a password
 * holding a raw delimiter can never be read as a host, path or query.
 */
function parseUrl(url: string): ParsedUrl {
  const m = SCHEME.exec(url);
  if (!m) throw new UnparseableUrl();
  const after = url.slice(m[0].length);
  const at = after.indexOf("@");
  if (at >= 0 && (after.indexOf("@", at + 1) >= 0 || /[/?#]/.test(after.slice(0, at))))
    throw new UnparseableUrl();
  const userinfo = at < 0 ? undefined : after.slice(0, at);
  const rest = at < 0 ? after : after.slice(at + 1);
  const hashAt = rest.indexOf("#");
  const fragment = hashAt < 0 ? undefined : rest.slice(hashAt + 1);
  const beforeHash = hashAt < 0 ? rest : rest.slice(0, hashAt);
  const qAt = beforeHash.indexOf("?");
  const queryText = qAt < 0 ? undefined : beforeHash.slice(qAt + 1);
  const beforeQuery = qAt < 0 ? beforeHash : beforeHash.slice(0, qAt);
  const slash = beforeQuery.indexOf("/");
  const hosts = slash < 0 ? beforeQuery : beforeQuery.slice(0, slash);
  const db = slash < 0 ? undefined : beforeQuery.slice(slash + 1);
  for (const host of hosts.split(",")) {
    if (IPV6.test(host)) throw new Ipv6Host();
    if (!HOST_PORT.test(host)) throw new UnparseableUrl();
  }
  if (db !== undefined && !DB_NAME.test(db)) throw new UnparseableUrl();
  const query = queryText?.split("&").map((pair) => {
    const eq = pair.indexOf("=");
    const key = eq < 0 ? pair : pair.slice(0, eq);
    if (!QUERY_KEY.test(key)) throw new UnparseableUrl();
    return { key, value: eq < 0 ? "" : pair.slice(eq + 1) };
  });
  return { scheme: m[0], userinfo, hosts, db, query, fragment };
}

const shown = (key: string) => SHOWN_PARAMS.has(key.toLowerCase());

/** The label of a URL that did not parse: the scheme and nothing else. */
const hiddenLabel = (url: string) => `${SCHEME.exec(url)?.[0] ?? ""}<hidden: unparseable>`;

/**
 * A URL as the CLI prints it, built only from the parts parseUrl accepted:
 * scheme, hosts and ports, database name, and the values of the shown query
 * keys. The userinfo, every other query value and the fragment print as
 * `***`; a URL that does not parse prints as `<scheme>://<hidden: unparseable>`.
 */
export function redactUrl(url: string): string {
  let p: ParsedUrl;
  try {
    p = parseUrl(url);
  } catch {
    return hiddenLabel(url);
  }
  const query =
    p.query === undefined
      ? ""
      : `?${p.query.map((q) => `${q.key}=${shown(q.key) ? q.value : "***"}`).join("&")}`;
  return `${p.scheme}${p.userinfo === undefined ? "" : "***@"}${p.hosts}${
    p.db === undefined ? "" : `/${p.db}`
  }${query}${p.fragment === undefined ? "" : "#***"}`;
}

/**
 * The strings to scrub from error text: the password, masked query values
 * and the fragment, each raw, decoded and percent-encoded; for a URL that
 * does not parse, everything after the scheme.
 */
function urlSecrets(url: string): string[] {
  let found: string[];
  try {
    const p = parseUrl(url);
    found = [];
    if (p.userinfo?.includes(":")) found.push(p.userinfo.slice(p.userinfo.indexOf(":") + 1));
    for (const q of p.query ?? []) if (!shown(q.key)) found.push(q.value);
    if (p.fragment !== undefined) found.push(p.fragment);
  } catch {
    found = [url.slice(SCHEME.exec(url)?.[0].length ?? 0)];
  }
  const all = new Set(found.flatMap((s) => [s, safeDecode(s), encodeURIComponent(safeDecode(s))]));
  return [...all].filter((s) => s !== "").sort((a, b) => b.length - a.length);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * `text` with the URL, wherever it appears, replaced by its label, and every
 * secret it holds by `***`: anywhere when the secret has at least
 * SHORT_SECRET characters, otherwise only as a whole token, so a one-letter
 * password cannot turn "connect" into "conn***ct".
 */
export function redactSecrets(text: string, url: string): string {
  let out = text.split(url).join(redactUrl(url));
  for (const secret of urlSecrets(url)) {
    if (secret.length >= SHORT_SECRET) out = out.split(secret).join("***");
    else
      out = out.replace(
        new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(secret)}(?![\\p{L}\\p{N}])`, "gu"),
        "***",
      );
  }
  return out;
}

/**
 * Throws unless postgres.js can parse `url`: the same steps as its parseUrl
 * (the first host of a host list, then WHATWG URL, then decodeURIComponent of
 * the user and the password), so a URL it would choke on is refused here,
 * at once, as usage.
 */
function checkPostgresUrl(url: string): void {
  let host = url.slice(url.indexOf("://") + 3).split(/[?/]/)[0] ?? "";
  host = decodeURIComponent(host.slice(host.indexOf("@") + 1));
  const u = new URL(url.replace(host, host.split(",")[0] ?? ""));
  decodeURIComponent(u.username);
  decodeURIComponent(u.password);
}

/**
 * The log a command uses: `--db`, else `ENGRAM_DB_URL`, else the per-user
 * default. Either names `:memory:`, a SQLite file path (resolved against
 * `cwd`) or a `postgres://` URL. Any other `scheme://`, and a Postgres URL
 * postgres.js cannot parse, is a UsageError that prints no secret.
 */
export function dbTarget(
  spec: string | undefined,
  where: { cwd: string; home: string; env: Readonly<Record<string, string | undefined>> },
): DbTarget {
  const fromEnv = where.env[DB_URL_ENV] || undefined;
  const given = spec ?? fromEnv;
  const source = spec !== undefined ? "flag" : fromEnv !== undefined ? "env" : "default";
  const named = source === "env" ? DB_URL_ENV : "--db";
  const scheme = given === undefined ? undefined : SCHEME.exec(given)?.[1];
  if (given !== undefined && scheme !== undefined) {
    if (!POSTGRES_SCHEMES.has(scheme.toLowerCase()))
      throw new UsageError(
        `${named}: the ${scheme}:// scheme is not supported; give a SQLite path, :memory: or a postgres:// URL`,
      );
    const label = redactUrl(given);
    try {
      parseUrl(given);
      checkPostgresUrl(given);
    } catch (e) {
      if (e instanceof Ipv6Host)
        throw new UsageError(
          `${named}: a bracketed IPv6 host is not supported by the Postgres driver; use a hostname or an IPv4 address`,
        );
      throw new UsageError(`${named} is not a valid Postgres URL: ${hiddenLabel(given)}`);
    }
    return { backend: "postgres", url: given, label, source };
  }
  const path =
    given === MEMORY_DB
      ? MEMORY_DB
      : given === undefined
        ? defaultDb(where.home)
        : resolve(where.cwd, given);
  return { backend: "sqlite", path, label: path, source };
}

/**
 * Opens the backend a target names, without migrating it. SQLite files are
 * opened as they are, so the caller decides whether one may be created;
 * Postgres connects to a database that must exist (the CLI never creates
 * one), and any error it raises names the target by its redacted label with
 * every secret of the URL scrubbed from the message.
 */
export function openDb(target: DbTarget): Db {
  if (target.backend === "sqlite") return openSqlite(target.path);
  try {
    return openPostgres(target.url);
  } catch (e) {
    throw new Error(`${target.label}: ${redactSecrets((e as Error).message, target.url)}`);
  }
}

/** Whether an open database holds an event log: the migrations table exists. */
export function hasLog(db: Db): boolean {
  const sql =
    db.dialect === "postgres"
      ? "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = current_schema() AND tablename = 'schema_migrations'"
      : "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'";
  return Number(db.prepare(sql).get()?.n) > 0;
}

/** What a target holds, found without changing it (`engram doctor`). */
export type LogState =
  | { state: "absent" }
  | { state: "foreign" }
  | { state: "engram"; pending: number[]; unknown: number[] };

/** The tables, the migrations table's columns and its rows, by read-only queries. */
interface Contents {
  tables: string[];
  columns(): string[];
  rows(): { id: number; name: string }[];
}

/** Classifies a database's contents against MIGRATIONS. */
function classify(c: Contents): LogState {
  if (c.tables.length === 0) return { state: "absent" };
  if (!c.tables.includes("schema_migrations")) return { state: "foreign" };
  const columns = c.columns();
  if (!columns.includes("id") || !columns.includes("name")) return { state: "foreign" };
  const rows = c.rows();
  const known = new Map(MIGRATIONS.map((m) => [m.id, m.name]));
  const unknown: number[] = [];
  for (const row of rows) {
    const name = known.get(Number(row.id));
    if (name === undefined) unknown.push(Number(row.id));
    else if (name !== row.name) return { state: "foreign" };
  }
  if (rows.length === 0 || unknown.length === rows.length) return { state: "foreign" };
  const done = new Set(rows.map((r) => Number(r.id)));
  const pending = MIGRATIONS.map((m) => m.id).filter((id) => !done.has(id));
  return { state: "engram", pending, unknown };
}

/** An error that names its target: `<label>: <message>`, the label added unless already there. */
function named(target: DbTarget, e: unknown): Error {
  const message = (e as Error).message;
  return new Error(message.startsWith(target.label) ? message : `${target.label}: ${message}`);
}

/** The SQLite file's contents, opened read-only; never created, never changed. */
function inspectSqliteFile(path: string): LogState {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return classify({
      tables: db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((r) => String(r.name)),
      columns: () =>
        db
          .prepare("SELECT name FROM pragma_table_info('schema_migrations')")
          .all()
          .map((r) => String(r.name)),
      rows: () =>
        db.prepare("SELECT id, name FROM schema_migrations").all() as {
          id: number;
          name: string;
        }[],
    });
  } finally {
    db.close();
  }
}

/** An open Postgres Db's contents in its schema, by SELECT queries only. */
function inspectPostgres(db: Db): LogState {
  return classify({
    tables: db
      .prepare("SELECT tablename FROM pg_tables WHERE schemaname = current_schema()")
      .all()
      .map((r) => String(r.tablename)),
    columns: () =>
      db
        .prepare(
          "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'schema_migrations'",
        )
        .all()
        .map((r) => String(r.column_name)),
    rows: () =>
      db.prepare("SELECT id, name FROM schema_migrations").all() as {
        id: number;
        name: string;
      }[],
  });
}

/**
 * What a target holds, without creating or changing anything: a SQLite file
 * is opened read-only (and not at all when it does not exist), Postgres sees
 * SELECT queries only. Never migrates. An error names the target.
 */
export function inspectLog(target: DbTarget): LogState {
  try {
    if (target.backend === "sqlite")
      return target.path === MEMORY_DB || !existsSync(target.path)
        ? { state: "absent" }
        : inspectSqliteFile(target.path);
    const db = openDb(target);
    try {
      return inspectPostgres(db);
    } finally {
      db.close();
    }
  } catch (e) {
    throw named(target, e);
  }
}

/**
 * Why no command may use what a target holds, or undefined when it may: a
 * database that is not an Engram log, or a log newer than this Engram. One
 * rule for doctor, which reports it, and openLog, which refuses.
 */
export function logRefusal(target: DbTarget, state: LogState): string | undefined {
  if (state.state === "foreign")
    return `${target.label}: not an Engram log (it holds other tables); point --db elsewhere`;
  if (state.state === "engram" && state.unknown.length > 0)
    return `${target.label}: newer than this Engram (migration${
      state.unknown.length === 1 ? "" : "s"
    } ${state.unknown.join(", ")}); update Engram`;
  return undefined;
}

export interface Log {
  db: Db;
  target: DbTarget;
  /** The migrations this open applied; empty when the log was up to date. */
  applied: number[];
}

/**
 * Opens and migrates the log. It first inspects the target as doctor does
 * and refuses a database that is not an Engram log or a log newer than this
 * Engram, so a write never turns another tool's database into a log;
 * `mustExist` also refuses a target with no log, on either backend.
 */
export function openLog(target: DbTarget, mustExist = false): Log {
  const check = (state: LogState) => {
    if (mustExist && state.state === "absent") throw new Error(`no event log at ${target.label}`);
    const refusal = logRefusal(target, state);
    if (refusal !== undefined) throw new Error(refusal);
  };
  if (target.backend === "sqlite" && target.path !== MEMORY_DB) {
    check(inspectLog(target));
    mkdirSync(dirname(target.path), { recursive: true });
  }
  const db = openDb(target);
  try {
    if (target.backend === "postgres") {
      let state: LogState;
      try {
        state = inspectPostgres(db);
      } catch (e) {
        throw named(target, e);
      }
      check(state);
    }
    return { db, target, applied: migrate(db) };
  } catch (e) {
    db.close();
    throw e;
  }
}

/** A bundled preset by name, or a policy YAML file by path; `flag` names it in a usage error. */
export function loadPolicy(spec: string | undefined, cwd: string, flag = "--policy"): Policy {
  const name = spec ?? "medium";
  if ((PRESETS as readonly string[]).includes(name)) return loadPreset(name as PresetName);
  const path = resolve(cwd, name);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new UsageError(
      `${flag} ${name} is neither a preset (${PRESETS.join(", ")}) nor a readable file`,
    );
  }
  return parsePolicy(text, name);
}

/**
 * Who adopts a store's own memories: its owner, with source import, whoever
 * reads (decision D8). Adoption records what the owner's store holds; the
 * reader's capacity governs only what the read returns.
 */
export function storeOwner(owner: string): Actor {
  const id = `person:${owner}`;
  return { id, level: "person", memberships: [id], source: "import" };
}

/** A store call in a workspace opened without a store; the server answers 503. */
export class NoStoreError extends Error {
  constructor() {
    super("no store is open in this workspace; start it with --root (and --owner)");
    this.name = "NoStoreError";
  }
}

/** The adapter of a workspace with no store: any call is refused, and names why. */
export const NO_STORE: Adapter = {
  name: "none",
  capabilities: {
    native_validity: false,
    native_history: false,
    native_search: false,
    native_graph: false,
  },
  write: () => Promise.reject(new NoStoreError()),
  read: () => Promise.reject(new NoStoreError()),
  delete: () => Promise.reject(new NoStoreError()),
  list: () => Promise.reject(new NoStoreError()),
};

/** The store a workspace governs, and the scope its own memories are adopted into. */
export interface Store {
  name: string;
  root: string;
  /** The adapter the Plane is built on; never called outside the Plane (AGENTS.md rule 2). */
  adapter: Adapter;
  /** The person whose folder it is; its memories are adopted as `person:<owner>`. */
  owner: string;
  /** The scope the folder's own memories live in: `person:<owner>`. */
  scope: string;
}

export interface StoreFlags {
  store?: string;
  root?: string;
  owner?: string;
  importValidFrom?: string;
  /**
   * The surface never writes the store (read, explain, retain): a Letta store
   * then refuses a missing or empty --root instead of initialising a
   * repository there, and makes no setup commit. Default false.
   */
  readOnlyStore?: boolean;
}

/** The stores a workspace opens. */
export const WORKSPACE_STORES = ["files", "letta"] as const;

/**
 * The store the flags name: `files`, a Claude Code memory folder (card A3),
 * or `letta`, a MemFS repository (card A2, ADR 0028): its top level, or an
 * empty or missing folder the adapter initialises, items under `engram/`.
 * Both need --root and --owner (whose person scope a read adopts the store's
 * items into). The Letta repository is checked here for what the file system
 * can tell (a bad folder is a usage error at once) and opened by git in the
 * background; what only git can tell is the first store call's error. Mem0
 * needs an embedding model wired at the surface and is not opened here.
 */
export function openStore(flags: StoreFlags, resolvePath: (p: string) => string): Store {
  const name = flags.store ?? "files";
  if (!(WORKSPACE_STORES as readonly string[]).includes(name))
    throw new UsageError(
      `--store ${name} is not available in the CLI yet; it opens ${WORKSPACE_STORES.join(" and ")} (mem0 needs an embedding model wired at the surface)`,
    );
  const folder = name === "letta" ? "<MemFS folder>" : "<folder>";
  if (flags.root === undefined) throw new UsageError(`the ${name} store needs --root ${folder}`);
  if (flags.owner === undefined) throw new UsageError(`the ${name} store needs --owner <id>`);
  const root = resolvePath(flags.root);
  if (name === "letta") {
    if (flags.importValidFrom !== undefined)
      throw new UsageError("--import-valid-from applies to the files store only");
    let adapter: Adapter;
    try {
      adapter = deferLettaAdapter({ root, create: flags.readOnlyStore !== true });
    } catch (e) {
      if (e instanceof NotMemfsRepositoryError) throw new UsageError(e.message);
      throw e;
    }
    return { name, root, adapter, owner: flags.owner, scope: `person:${flags.owner}` };
  }
  const adapter = createFilesAdapter({
    root,
    owner: flags.owner,
    importValidFrom: flags.importValidFrom,
  });
  return { name, root, adapter, owner: flags.owner, scope: `person:${flags.owner}` };
}

/**
 * What a server serves (createApp): the Plane over one log, policy and store,
 * the store whose memories a read adopts first (null when there is none), and
 * the viewer `engram serve --as` named (null when none was).
 */
export interface Workspace {
  deps: PlaneDeps;
  plane: Plane;
  policy: Policy;
  store: Store | null;
  viewer: Actor | null;
}

/** A workspace over deps already open, such as a test's fake store and in-memory log. */
export function workspaceOf(
  deps: PlaneDeps,
  extra: { store?: Store | null; viewer?: Actor | null } = {},
): Workspace {
  return {
    deps,
    plane: createPlane(deps),
    policy: deps.policy,
    store: extra.store ?? null,
    viewer: extra.viewer ?? null,
  };
}

export interface WorkspaceOptions extends StoreFlags {
  /** --db: a SQLite path, :memory: or a postgres:// URL; else ENGRAM_DB_URL, else the default. */
  db?: string;
  /** --policy: a preset name or a policy file. */
  policy?: string;
  /** Open a store even when no store flag is given (read, write and promote need one). */
  requireStore?: boolean;
  viewer?: Actor | null;
  cwd: string;
  home: string;
  env: Readonly<Record<string, string | undefined>>;
  newId: () => string;
}

/** A workspace on this machine: its log is opened on first use, or by `open`. */
export interface LocalWorkspace extends Workspace {
  target: DbTarget;
  /** `<policy id> v<version>`, as the CLI prints it. */
  policyLabel: string;
  /** Opens and migrates the log now; `mustExist` refuses a target with no log. */
  open(mustExist?: boolean): Log;
  close(): void;
}

/**
 * Loads the policy and builds the store (a UsageError names a bad flag), and
 * names the log without opening it. With no store flag and no
 * `requireStore`, the Plane has no store: reads, explain and the timeline
 * work from the log, and a write is refused by NO_STORE.
 */
export function openWorkspace(options: WorkspaceOptions): LocalWorkspace {
  const policy = loadPolicy(options.policy, options.cwd);
  // Every flag is checked before the store is built, so a usage error never
  // follows a store touched on disk (review finding I-1).
  const target = dbTarget(options.db, options);
  // --owner alone names an actor (explain, retain); a store needs --root or --store.
  const wantsStore =
    options.requireStore === true || options.store !== undefined || options.root !== undefined;
  const store = wantsStore ? openStore(options, (p) => resolve(options.cwd, p)) : null;
  let log: Log | undefined;
  const open = (mustExist = false) => {
    log ??= openLog(target, mustExist);
    return log;
  };
  const deps: PlaneDeps = {
    get db() {
      return open().db;
    },
    adapter: store?.adapter ?? NO_STORE,
    policy,
    newId: options.newId,
  };
  return {
    deps,
    plane: createPlane(deps),
    policy,
    store,
    viewer: options.viewer ?? null,
    target,
    policyLabel: `${policy.id} v${policy.version}`,
    open,
    close: () => log?.db.close(),
  };
}
