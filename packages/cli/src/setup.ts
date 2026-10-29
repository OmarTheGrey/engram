// What every command assembles before it calls the Plane: the event log, the
// policy, the actor and the store. No policy decision is made here (AGENTS.md
// rule 1); the Plane makes them all.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  type Actor,
  type Adapter,
  type Db,
  loadPreset,
  MIGRATIONS,
  migrate,
  openPostgres,
  openSqlite,
  type Policy,
  PRESETS,
  type PresetName,
  parsePolicy,
  Scope,
  ScopeLevel,
  scopeLevel,
  Timestamp,
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

/** A bundled preset by name, or a policy YAML file by path. */
export function loadPolicy(spec: string | undefined, cwd: string): Policy {
  const name = spec ?? "medium";
  if ((PRESETS as readonly string[]).includes(name)) return loadPreset(name as PresetName);
  const path = resolve(cwd, name);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new UsageError(
      `--policy ${name} is neither a preset (${PRESETS.join(", ")}) nor a readable file`,
    );
  }
  return parsePolicy(text, name);
}

export function checkTime(flag: string, value: string | undefined): string | undefined {
  if (value !== undefined && !Timestamp.safeParse(value).success)
    throw new UsageError(
      `${flag} ${value} is not an ISO 8601 UTC time such as 2026-10-25T12:00:00Z`,
    );
  return value;
}

/** A decimal number, optionally signed and with an exponent; never hex, binary, octal or `_`. */
const DECIMAL = /^[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/;

/**
 * A number flag such as --confidence: any finite decimal; its range is the
 * schema's to judge. Number() alone would also read `0x10` as 16 and `0b1`
 * as 1 (finding R6-6), so the text must be decimal first.
 */
export function checkNumber(flag: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!DECIMAL.test(value.trim()) || !Number.isFinite(n))
    throw new UsageError(`${flag} ${JSON.stringify(value)} is not a number`);
  return n;
}

export interface ActorFlags {
  as?: string;
  level?: string;
  member?: string[];
}

/**
 * The actor: `--as`, else `person:<owner>`. Its level and membership default
 * to its own scope when its id is one (`person:omar` reads as person, member
 * of `person:omar`); otherwise level person and no membership. `source` is
 * the provenance kind the plane records for what it writes (decision D4).
 */
export function buildActor(
  flags: ActorFlags,
  owner: string | undefined,
  source?: Actor["source"],
): Actor {
  const id = flags.as ?? (owner === undefined ? undefined : `person:${owner}`);
  if (id === undefined) throw new UsageError("give --as <principal> or --owner <id>");
  const ownScope = Scope.safeParse(id).success ? id : undefined;
  let level = ownScope ? scopeLevel(ownScope) : "person";
  if (flags.level !== undefined) {
    const parsed = ScopeLevel.safeParse(flags.level);
    if (!parsed.success)
      throw new UsageError(`--level ${flags.level} is not one of ${ScopeLevel.options.join(", ")}`);
    level = parsed.data;
  }
  for (const m of flags.member ?? [])
    if (!Scope.safeParse(m).success) throw new UsageError(`--member ${m} is not a scope`);
  const memberships = flags.member ?? (ownScope ? [ownScope] : []);
  return source ? { id, level, memberships, source } : { id, level, memberships };
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

/** An adapter for commands that never touch a store (explain): any call is a bug. */
export const NO_STORE: Adapter = {
  name: "none",
  capabilities: {
    native_validity: false,
    native_history: false,
    native_search: false,
    native_graph: false,
  },
  write: () => Promise.reject(new Error("no store is open for this command")),
  read: () => Promise.reject(new Error("no store is open for this command")),
  delete: () => Promise.reject(new Error("no store is open for this command")),
  list: () => Promise.reject(new Error("no store is open for this command")),
};
