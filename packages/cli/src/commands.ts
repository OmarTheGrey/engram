// The commands that reach the plane (doctor is in ./doctor.ts, serve in
// ./serve.ts). Each parses its flags, builds the actor, makes exactly one
// client call (card E8.2, ADR 0027 decision 3; ./connect.ts) and prints the
// answer. The Plane makes every decision; nothing here is a policy `if`.
// Every id comes from the Io (`io.newId`), so a run with a fixed Io is
// reproducible.
//
// Card E8.15a (docs/design/tui.md 6.2): each command is a PlaneCommand in
// three parts, so the TUI can make the same call the plain command makes:
// `prepare` (the flag checks, the actor, everything that needs no
// workspace; it throws the same UsageError), `request` and `call` (the one
// client call), and `print` (the text or JSON the command prints, and its
// exit code). `runPlane` puts them together as each command always ran; the
// exported `readCommand` and the rest behave as they did. The flags each
// command parses are its registry entry's (./registry.ts).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  type Actor,
  type Grant,
  Id,
  type LintFinding,
  MemoryClass,
  type MemoryEvent,
  type MemoryItem,
  Scope,
  type SimReport,
  Timestamp,
  type WhoCanReadAnswer,
} from "@engram/core";
import { type Connection, connect, result, serverOf } from "./connect.ts";
import {
  decisionLines,
  eventsLines,
  explanationLines,
  grantLines,
  plural,
  policyLines,
  preview,
  scopesLines,
  simulationLines,
  whoCanReadLines,
} from "./format.ts";
import { closest, OPTIONS, type OptionSpec } from "./registry.ts";
import type { Io } from "./run.ts";
import { buildActor, checkNumber, checkTime, loadPolicy, MEMORY_DB, UsageError } from "./setup.ts";

type Options = Readonly<Record<string, OptionSpec>>;

/**
 * A flag parseArgs does not know (card E8.15a, docs/design/tui.md 12.2):
 * still a usage error with parseArgs' message, carrying the flag typed and
 * the one it was probably meant to be, which `run` prints as a second line.
 */
export class UnknownOptionError extends UsageError {
  readonly suggestion: string | undefined;
  constructor(message: string, suggestion: string | undefined) {
    super(message);
    this.suggestion = suggestion;
  }
}

export function parse<O extends Options>(args: string[], options: O, positionals: boolean) {
  try {
    return parseArgs({ args, options, allowPositionals: positionals, strict: true });
  } catch (e) {
    const message = (e as Error).message;
    const flag = /^Unknown option '--([^'=]+)'/.exec(message)?.[1];
    if ((e as { code?: string }).code === "ERR_PARSE_ARGS_UNKNOWN_OPTION" && flag !== undefined)
      throw new UnknownOptionError(message, closest(flag, Object.keys(options)));
    throw new UsageError(message);
  }
}

/** The flag values a command parsed, typed by its options. */
type Values<O extends Options> = ReturnType<typeof parse<O>>["values"];

/**
 * The time of a call that is not a read (card RV5, finding RV-SRF-2). A
 * server stamps every event from its own clock, so over --server (or
 * ENGRAM_SERVER_URL) `--at` is refused. In process the CLI is the server
 * (ADR 0027 decision 3), and its clock is the real one: `--at` is refused
 * there too (review fix pass of PR #59, RV5-3), since a future retain
 * retires the member's items for good and a backdated write is stamped
 * before the log's history. Only `--test-clock`, for tests and fixtures,
 * lets `--at` set the clock of this one in-process call.
 */
function callClock(
  values: {
    at?: string | undefined;
    server?: string | undefined;
    "test-clock"?: boolean | undefined;
  },
  io: Io,
) {
  const given = checkTime("--at", values.at);
  if (given !== undefined && serverOf(io, values) !== undefined)
    throw new UsageError(
      "--at sets the time of the call, which a server stamps from its own clock; only engram read takes --at with --server (the time its validity windows are judged at)",
    );
  if (given !== undefined && values["test-clock"] !== true)
    throw new UsageError(
      "--at sets the clock of a call that is not a read, which runs at the real clock: a future time retires items for good, an earlier one is stamped before the log's history; only engram read takes --at (the time its validity windows are judged at), and --test-clock lets tests and fixtures set the clock",
    );
  const at = given ?? io.now();
  return { at, io: given === undefined ? io : { ...io, now: () => given } };
}

interface WorkspaceFlags {
  /** Where the decisions go (card E8.13); read by connect, not by the workspace. */
  otlp?: string | undefined;
  "export-jsonl"?: string | undefined;
  store?: string | undefined;
  root?: string | undefined;
  owner?: string | undefined;
  "import-valid-from"?: string | undefined;
  policy?: string | undefined;
  db?: string | undefined;
  server?: string | undefined;
}

/** The in-process workspace's options from a command's flags. */
const workspaceOf =
  (flags: WorkspaceFlags, requireStore: boolean, readOnlyStore = false) =>
  () => ({
    store: flags.store,
    root: flags.root,
    owner: flags.owner,
    importValidFrom: checkTime("--import-valid-from", flags["import-valid-from"]),
    policy: flags.policy,
    db: flags.db,
    requireStore,
    readOnlyStore,
  });

interface SessionOptions {
  requireStore: boolean;
  mustExist?: boolean;
  readOnlyStore?: boolean;
}

/**
 * Connects and builds the actor, in the order the commands have always
 * reported problems: the policy and the store, then the actor, then the log.
 */
function session(
  io: Io,
  flags: WorkspaceFlags,
  options: SessionOptions,
  makeActor: () => Actor,
): { conn: Connection; actor: Actor } {
  let actor: Actor | undefined;
  const ws = workspaceOf(flags, options.requireStore, options.readOnlyStore === true);
  const conn = connect(io, flags, ws, (ws) => {
    actor = makeActor();
    ws.open(options.mustExist === true);
  });
  try {
    actor ??= makeActor();
  } catch (e) {
    conn.close();
    throw e;
  }
  return { conn, actor };
}

/** What `prepare` hands on to the call: everything it needs that needs no workspace. */
export interface Prepared {
  /** The Io of the call: with --test-clock, --at is its clock. */
  io: Io;
  /** What connect reads: --server, the workspace flags and the export flags. */
  flags: WorkspaceFlags;
  /** How the workspace opens; null opens no log and needs no actor (simulate, policy). */
  session: SessionOptions | null;
  /**
   * The actor, built when the workspace has loaded the policy and the store,
   * so a command reports problems in the order it always has.
   */
  actor: () => Actor;
  json: boolean;
}

/** What a command prints, and the exit code it returns. */
export interface Printed {
  out: string;
  code: number;
}

/** One plane command in its three parts (docs/design/tui.md 6.2). */
export interface PlaneCommand<O extends Options, P extends Prepared, Req, Res> {
  /** The registry's parse config for the command. */
  options: O;
  allowPositionals: boolean;
  /** The flag checks and everything that needs no workspace; throws the CLI's UsageError. */
  prepare(values: Values<O>, positionals: string[], io: Io): P;
  /** The request the one call sends, for the actor (undefined when the command has none). */
  request(p: P, actor: Actor | undefined): Req;
  /** The one client call. */
  call(conn: Connection, request: Req): Promise<Res>;
  /** The command's output and exit code for the answer. */
  print(p: P, actor: Actor | undefined, answer: Res, conn: Connection): Printed;
}

const plane = <O extends Options, P extends Prepared, Req, Res>(c: PlaneCommand<O, P, Req, Res>) =>
  c;

const noActor = (): Actor => {
  throw new Error("this command acts as no one");
};

/** Opens the workspace (or names the server) for a prepared command, and builds its actor. */
export function open(p: Prepared): { conn: Connection; actor: Actor | undefined } {
  if (p.session === null)
    return {
      conn: connect(p.io, p.flags, workspaceOf(p.flags, false), undefined),
      actor: undefined,
    };
  return session(p.io, p.flags, p.session, p.actor);
}

/** Runs a plane command on its arguments, as `engram <command>` does. */
export async function runPlane<O extends Options, P extends Prepared, Req, Res>(
  c: PlaneCommand<O, P, Req, Res>,
  args: string[],
  io: Io,
): Promise<number> {
  const { values, positionals } = parse(args, c.options, c.allowPositionals);
  const p = c.prepare(values, positionals, io);
  const { conn, actor } = open(p);
  try {
    const printed = c.print(p, actor, await c.call(conn, c.request(p, actor)), conn);
    io.out(printed.out);
    return printed.code;
  } finally {
    conn.close();
  }
}

const must = (actor: Actor | undefined): Actor => actor ?? noActor();

/**
 * Where the log is, and after a read the explain command that finds it: with
 * no --db when the log came from ENGRAM_DB_URL or the default (the same
 * lookup finds it again), with the path for a SQLite --db, and never with a
 * redacted URL that looks runnable but is not. With a server, the server's.
 */
function logHint(conn: Connection, readId?: string): string {
  const server = conn.server === undefined ? "" : ` --server ${conn.server}`;
  const t = conn.workspace?.target;
  if (t === undefined)
    return readId === undefined
      ? `log of the server at ${conn.server}`
      : `log of the server at ${conn.server}; engram explain ${readId}${server}`;
  if (t.backend === "sqlite" && t.path === MEMORY_DB)
    return "log in memory; pass --db <path> to keep it for engram explain";
  if (readId === undefined) return `log ${t.label}`;
  const db =
    t.source !== "flag"
      ? ""
      : t.backend === "sqlite"
        ? ` --db ${t.path}`
        : " --db <the same postgres URL>";
  return `log ${t.label}; engram explain ${readId}${db}`;
}

const logLabel = (conn: Connection) => conn.workspace?.target.label ?? `server ${conn.server}`;

const eventLine = (e: MemoryEvent) =>
  `  ${e.op} ${e.decision} ${e.item_id ?? "(no item)"}: ${e.reason} (${e.policy_id})`;

const brief = (e: MemoryEvent) => ({
  op: e.op,
  decision: e.decision,
  item_id: e.item_id,
  reason: e.reason,
  policy_id: e.policy_id,
});

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const text = (lines: string[]) => `${lines.join("\n")}\n`;

/** What the workspace did before a read or a scope listing, as the store's owner. */
interface StoreSync {
  store: { name: string; root: string; scope: string };
  retention: { expired: string[]; evicted: string[]; events: MemoryEvent[] };
  adoption: {
    listed: number;
    allowed: number;
    denied: number;
    unchanged: number;
    deferred: number;
    retired: number;
    denials: { item_id: string; reason: string; policy_id: string }[];
    retirements: { item_id: string; reason: string }[];
    evictions: MemoryEvent[];
  };
}

/** The lines a read prints for its store's sweep and adoption. */
function syncLines(sync: StoreSync): string[] {
  const a = sync.adoption;
  return [
    `store ${sync.store.name} at ${sync.store.root}`,
    `retention: ${sync.retention.expired.length} expired, ${sync.retention.evicted.length} evicted`,
    ...sync.retention.events.map(eventLine),
    `imported ${a.allowed + a.denied} of ${plural(a.listed, "memory", "memories")}: ` +
      `${a.allowed} allowed, ${a.denied} denied, ${a.unchanged} already in the log${a.deferred > 0 ? `, ${a.deferred} left to the next adoption` : ""}`,
    ...a.denials.map((d) => `  denied ${d.item_id}: ${d.reason} (${d.policy_id})`),
    ...a.retirements.map((x) => `  retired ${x.item_id}: ${x.reason}`),
    ...a.evictions.map(
      (e) =>
        `  ${e.decision === "ask" ? "asked" : "evicted"} ${e.item_id ?? "(no item)"} during adoption: ${e.reason} (${e.policy_id})`,
    ),
  ];
}

interface ReadAnswer {
  items: MemoryItem[];
  explanations: ({ item_id: string; rank: number } & Parameters<typeof explanationLines>[0])[];
  filtered: number;
  event: MemoryEvent;
  policy: string;
  sync: StoreSync | null;
}

/**
 * `engram read [query]`, or `engram read --item <id>` (card E8.15a, over
 * card E8.14's route): one read, the store swept and adopted as its owner
 * first, every returned item explained.
 */
export const READ = plane({
  options: OPTIONS.read,
  allowPositionals: true,
  prepare(values, positionals, io) {
    // A read's --at is the time its validity windows are judged at, in process
    // and over --server alike; the read happens at the server's clock, which
    // is also when the store owner's sweep runs (card RV5, RV-SRF-1 and 2).
    const validAt = checkTime("--at", values.at);
    const item = values.item;
    if (item !== undefined && positionals.length > 0)
      throw new UsageError("give a query or --item <id>, not both");
    if (item !== undefined && !Id.safeParse(item).success)
      throw new UsageError(`--item ${item} is not an item id (a UUIDv7)`);
    return {
      io,
      flags: values,
      session: { requireStore: true, readOnlyStore: true },
      actor: () => buildActor(values, values.owner),
      json: values.json === true,
      validAt,
      item,
      text: positionals.join(" ") || undefined,
    };
  },
  request: (p, actor) => ({
    item: p.item,
    body: {
      actor: must(actor),
      ...(p.item === undefined ? { text: p.text } : {}),
      ...(p.validAt === undefined ? {} : { at: p.validAt }),
    },
  }),
  // One call: the server's read route sweeps and adopts the store as its
  // owner first (retention before adoption, ADR 0025 and decision D8).
  call: async (conn, { item, body }) =>
    (item === undefined
      ? result(await conn.client.POST("/api/v1/read", { body }))
      : result(
          await conn.client.POST("/api/v1/read/{itemId}", {
            params: { path: { itemId: item } },
            body,
          }),
        )) as unknown as ReadAnswer,
  print(p, actor, r, conn) {
    const a = must(actor);
    const readId = r.event.id;
    const at = r.event.ts;
    const rows = r.items.map((item, i) => ({ item, explanation: r.explanations[i] }));
    const sync = r.sync;
    if (p.json) {
      const counts = sync
        ? (({ denials: _d, retirements: _r, evictions: _e, ...rest }) => rest)(sync.adoption)
        : null;
      return {
        code: 0,
        out: json({
          read_id: readId,
          at,
          valid_at: p.validAt ?? null,
          actor: a,
          policy: r.policy,
          store: sync ? { name: sync.store.name, root: sync.store.root } : null,
          retention: sync
            ? {
                expired: sync.retention.expired,
                evicted: sync.retention.evicted,
                events: sync.retention.events.map(brief),
              }
            : null,
          imported: counts,
          denials: sync?.adoption.denials ?? [],
          retirements: sync?.adoption.retirements ?? [],
          evictions: (sync?.adoption.evictions ?? []).map(brief),
          returned: r.items.length,
          filtered: r.filtered,
          reason: r.event.reason,
          items: rows,
          log: logLabel(conn),
        }),
      };
    }
    const lines = [
      `read ${readId} at ${at}${p.validAt === undefined ? "" : `, validity windows at ${p.validAt}`} as ${a.id} (${a.level}) under ${r.policy}`,
    ];
    if (sync) lines.push(...syncLines(sync));
    lines.push(
      `${plural(r.items.length, "item")} returned, ${r.filtered} filtered`,
      `  ${r.event.reason}`,
    );
    for (const { item, explanation } of rows) {
      if (!explanation) continue;
      lines.push(
        "",
        `${explanation.rank}. ${item.id}  ${item.class}  ${item.scope}`,
        ...explanationLines(explanation).map((l) => `   ${l}`),
        `   source ${item.provenance.kind} ${item.provenance.ref}`,
        `   > ${preview(item)}`,
      );
    }
    lines.push("", logHint(conn, readId));
    return { code: 0, out: text(lines) };
  },
});

const sha256 = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;

/** The item `engram write` assembles from its flags, and the actor it writes as. */
function prepareWrite(values: Values<typeof OPTIONS.write>, io: Io) {
  const clock = callClock(values, io);
  const { at } = clock;
  const confidence = checkNumber("--confidence", values.confidence);
  const validFrom = checkTime("--valid-from", values["valid-from"]);
  const validTo = checkTime("--valid-to", values["valid-to"]);
  let base: Record<string, unknown> = {};
  if (values.file !== undefined) {
    try {
      base = JSON.parse(readFileSync(resolve(io.cwd, values.file), "utf8"));
    } catch (e) {
      throw new UsageError(`--file ${values.file}: ${(e as Error).message}`);
    }
  }
  const content = values.content ?? base.content;
  if (content === undefined) throw new UsageError("give the item with --content or --file");
  // A person at the CLI writes as source user; the plane sets the item's
  // provenance kind and actor from this (decision D4).
  const actor = buildActor(values, values.owner, "user");
  const contentText = typeof content === "string" ? content : JSON.stringify(content);
  const provenance = {
    kind: "user",
    ref: "engram-cli",
    hash: sha256(contentText),
    actor: actor.id,
    ...(base.provenance as object | undefined),
  };
  // Assembled as given; Plane.write validates it and denies under the schema rule if it is wrong.
  const item = {
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    ...base,
    id: values.id ?? base.id ?? io.newId(),
    class: values.class ?? base.class ?? "semantic",
    scope: values.scope ?? base.scope ?? (values.owner ? `person:${values.owner}` : actor.id),
    owner: base.owner ?? actor.id,
    content,
    provenance,
    confidence: confidence ?? base.confidence ?? 0.9,
    valid_from: validFrom ?? base.valid_from ?? at,
    valid_to: validTo ?? base.valid_to ?? null,
    store_ref: null,
    schema_version: 1,
  };
  return { io: clock.io, at, actor, item, json: values.json === true };
}

/** `engram write`: one item through the write gate. Exit 0 on allow, 1 otherwise. */
export const WRITE = plane({
  options: OPTIONS.write,
  allowPositionals: false,
  prepare(values, _positionals, io) {
    const w = prepareWrite(values, io);
    return { ...w, flags: values, session: { requireStore: true }, actor: () => w.actor };
  },
  request: (p, actor) => ({ actor: must(actor), item: p.item }),
  call: async (conn, body) =>
    result(await conn.client.POST("/api/v1/items", { body })) as unknown as {
      item: MemoryItem | null;
      event: MemoryEvent;
    },
  print: (p, _actor, { item: stored, event }, conn) => ({
    code: event.decision === "allow" ? 0 : 1,
    out: p.json
      ? json({ event, item: stored })
      : text([...decisionLines(event, stored), logHint(conn)]),
  }),
});

/**
 * `engram check` (card E8.15a): the decision `engram write` would get with
 * the same flags, from POST /items/check; nothing stored, no event. The
 * workspace opens as write's does, its store read only. Exit 0 on allow, 1
 * on deny or ask.
 */
export const CHECK = plane({
  options: OPTIONS.check,
  allowPositionals: false,
  prepare(values, _positionals, io) {
    const w = prepareWrite(values, io);
    return {
      ...w,
      flags: values,
      session: { requireStore: true, readOnlyStore: true },
      actor: () => w.actor,
    };
  },
  request: (p, actor) => ({ actor: must(actor), item: p.item }),
  call: async (conn, body) =>
    result(await conn.client.POST("/api/v1/items/check", { body })) as unknown as {
      decision: "allow" | "deny" | "ask";
      reason: string;
      policy_id: string;
    },
  print: (p, actor, answer, conn) => ({
    code: answer.decision === "allow" ? 0 : 1,
    out: p.json
      ? json(answer)
      : text([
          `check a write to ${String(p.item.scope)} at ${p.at} by ${must(actor).id}: nothing stored, no event`,
          `${answer.decision}: ${answer.reason}`,
          `policy ${answer.policy_id}`,
          logHint(conn),
        ]),
  }),
});

/** Exactly one item id among the positionals, else the usage message given. */
function oneItemId(positionals: string[], usage: string): string {
  const [itemId, ...rest] = positionals;
  if (itemId === undefined || rest.length > 0) throw new UsageError(usage);
  if (!Id.safeParse(itemId).success) throw new UsageError(`${itemId} is not an item id (a UUIDv7)`);
  return itemId;
}

/**
 * `engram promote <item-id> --to <scope> [--review]`: one promote call as a
 * user-sourced actor (ADR 0026: only a user-sourced actor can approve). Exit
 * 0 when the promotion landed, 1 on deny or ask.
 */
export const PROMOTE = plane({
  options: OPTIONS.promote,
  allowPositionals: true,
  prepare(values, positionals, io) {
    const itemId = oneItemId(
      positionals,
      "give exactly one item id: engram promote <item-id> --to <scope>",
    );
    if (values.to === undefined) throw new UsageError("give the target scope with --to <scope>");
    if (!Scope.safeParse(values.to).success)
      throw new UsageError(
        `--to ${values.to} is not a scope (person:<id>, role:<id>, team:<id> or org)`,
      );
    const clock = callClock(values, io);
    const actor = buildActor(values, values.owner, "user");
    return {
      io: clock.io,
      flags: values,
      session: { requireStore: true },
      actor: () => actor,
      json: values.json === true,
      itemId,
      to: values.to,
      review: values.review === true,
    };
  },
  request: (p, actor) => ({ actor: must(actor), item_id: p.itemId, to: p.to, review: p.review }),
  call: async (conn, body) =>
    result(await conn.client.POST("/api/v1/promote", { body })) as unknown as {
      decision: MemoryEvent["decision"];
      event: MemoryEvent;
      events: MemoryEvent[];
      item: MemoryItem | null;
    },
  print(p, _actor, { decision, event, events, item }, conn) {
    const code = decision === "allow" ? 0 : 1;
    if (p.json) return { code, out: json({ decision, event, events, item }) };
    const lines = decisionLines(event, item);
    for (const e of events.slice(1)) lines.push(eventLine(e));
    return { code, out: text([...lines, logHint(conn)]) };
  },
});

const GRANT_MODES = ["read", "read_write"] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A grant as `--add` or `--remove` writes it: `<to>[,class=<class>][,mode=<mode>][,expires=<iso>]`.
 * Only its form is checked here, as the inspector's editor checks it
 * (grantFrom): mode defaults to read, a date is midnight UTC. Whether the
 * grant is acceptable is the plane's decision.
 */
function grantOf(flag: string, spec: string): Grant {
  const [to, ...parts] = spec.split(",");
  const bad = (why: string) =>
    new UsageError(
      `${flag} ${spec}: ${why}; write <to>[,class=<class>][,mode=read|read_write][,expires=<iso>]`,
    );
  if (to === undefined || to.trim() === "" || to.includes("="))
    throw bad("a grant names who it is for first, such as person:sam");
  const grant: { to: string; class?: Grant["class"]; mode: Grant["mode"]; expires?: string } = {
    to: to.trim(),
    mode: "read",
  };
  const seen = new Set<string>();
  for (const part of parts) {
    const eq = part.indexOf("=");
    const key = eq < 0 ? part : part.slice(0, eq);
    const value = eq < 0 ? "" : part.slice(eq + 1).trim();
    if (seen.has(key)) throw bad(`${key} is given twice`);
    seen.add(key);
    if (key === "class") {
      const parsed = MemoryClass.safeParse(value);
      if (!parsed.success) throw bad(`unknown class ${value} (${MemoryClass.options.join(", ")})`);
      grant.class = parsed.data;
    } else if (key === "mode") {
      if (!(GRANT_MODES as readonly string[]).includes(value))
        throw bad(`unknown mode ${value} (${GRANT_MODES.join(" or ")})`);
      grant.mode = value as Grant["mode"];
    } else if (key === "expires") {
      const expires = DATE.test(value) ? `${value}T00:00:00Z` : value;
      if (!Timestamp.safeParse(expires).success)
        throw bad(`expires ${value} is not a UTC date (2026-12-01) or time (2026-12-01T00:00:00Z)`);
      grant.expires = expires;
    } else throw bad(`unknown field ${key}`);
  }
  return grant;
}

/**
 * `engram grants <item-id> --add <grant>... --remove <grant>...` (card
 * E8.15a, over card E9.4's route): one grant change as a user-sourced actor,
 * which the plane allows only to the item's owner. Exit 0 on allow, 1 on deny.
 */
export const GRANTS = plane({
  options: OPTIONS.grants,
  allowPositionals: true,
  prepare(values, positionals, io) {
    const itemId = oneItemId(
      positionals,
      "give exactly one item id: engram grants <item-id> --add <grant> | --remove <grant>",
    );
    const add = (values.add ?? []).map((g) => grantOf("--add", g));
    const remove = (values.remove ?? []).map((g) => grantOf("--remove", g));
    if (add.length === 0 && remove.length === 0)
      throw new UsageError(
        "give a change: --add <to>[,class=<class>][,mode=<mode>][,expires=<iso>] or --remove <grant>",
      );
    const clock = callClock(values, io);
    const actor = buildActor(values, values.owner, "user");
    return {
      io: clock.io,
      flags: values,
      session: { requireStore: true },
      actor: () => actor,
      json: values.json === true,
      itemId,
      add,
      remove,
    };
  },
  request: (p, actor) => ({
    actor: must(actor),
    item_id: p.itemId,
    ...(p.add.length > 0 ? { add: p.add } : {}),
    ...(p.remove.length > 0 ? { remove: p.remove } : {}),
  }),
  call: async (conn, body) =>
    result(await conn.client.POST("/api/v1/grants", { body })) as unknown as {
      decision: "allow" | "deny";
      item: MemoryItem | null;
      event: MemoryEvent;
    },
  print: (p, _actor, answer, conn) => ({
    code: answer.decision === "allow" ? 0 : 1,
    out: p.json
      ? json(answer)
      : text([
          ...decisionLines(answer.event, answer.item),
          ...(answer.item ? grantLines(answer.item.grants) : []),
          logHint(conn),
        ]),
  }),
});

export const EXPLAIN = plane({
  options: OPTIONS.explain,
  allowPositionals: true,
  prepare(values, positionals, io) {
    const [readId, ...rest] = positionals;
    if (readId === undefined || rest.length > 0)
      throw new UsageError("give exactly one read id: engram explain <readId>");
    // Only the actor who made the read may explain it (decision D5). The
    // workspace needs no store: --owner here names the actor only.
    const actor = buildActor(values, values.owner);
    return {
      io,
      flags: { db: values.db, policy: values.policy, server: values.server },
      session: { requireStore: false, mustExist: true, readOnlyStore: true },
      actor: () => actor,
      json: values.json === true,
      readId,
    };
  },
  request: (p, actor) => ({ readId: p.readId, body: { actor: must(actor) } }),
  call: async (conn, { readId, body }) =>
    result(
      await conn.client.POST("/api/v1/explain/{readId}", { params: { path: { readId } }, body }),
    ).explanations as unknown as Parameters<typeof explanationLines>[0][],
  print(p, _actor, explanations) {
    if (p.json) return { code: 0, out: json(explanations) };
    const lines = [`read ${p.readId}: ${plural(explanations.length, "explanation")}`];
    for (const e of explanations)
      lines.push("", `${e.rank}. ${e.item_id}`, ...explanationLines(e).map((l) => `   ${l}`));
    return { code: 0, out: text(lines) };
  },
});

/**
 * `engram events [--after <seq>]` (card E8.15a): the inspector's timeline,
 * POST /events, the events the actor may see. The log must exist, as for
 * explain; nothing is appended. Exit 0.
 */
export const EVENTS = plane({
  options: OPTIONS.events,
  allowPositionals: false,
  prepare(values, _positionals, io) {
    let after: number | undefined;
    if (values.after !== undefined) {
      if (!/^\d+$/.test(values.after) || !Number.isSafeInteger(Number(values.after)))
        throw new UsageError(
          `--after ${values.after} is not an event seq (a whole number, 0 or more)`,
        );
      after = Number(values.after);
    }
    const actor = buildActor(values, values.owner);
    return {
      io,
      flags: { db: values.db, policy: values.policy, server: values.server },
      session: { requireStore: false, mustExist: true, readOnlyStore: true },
      actor: () => actor,
      json: values.json === true,
      after,
    };
  },
  request: (p, actor) => ({
    actor: must(actor),
    ...(p.after === undefined ? {} : { after: p.after }),
  }),
  call: async (conn, body) =>
    result(await conn.client.POST("/api/v1/events", { body })) as unknown as {
      events: MemoryEvent[];
    },
  print: (p, actor, answer, conn) => ({
    code: 0,
    out: p.json
      ? json(answer)
      : text([...eventsLines(answer.events, must(actor), p.after), logHint(conn)]),
  }),
});

/**
 * `engram retain --scope <scope>`: one retention sweep of a scope (ADR 0025)
 * as a user-sourced member of it, so expired items in a shared scope are
 * retired too (the sweep retires by ttl outside one's own person scope only
 * for a user-sourced actor). Exit 0 when the sweep ran, 1 when it was refused.
 */
export const RETAIN = plane({
  options: OPTIONS.retain,
  allowPositionals: false,
  prepare(values, _positionals, io) {
    if (values.scope === undefined) throw new UsageError("give the scope with --scope <scope>");
    const { at, io: callIo } = callClock(values, io);
    const actor = buildActor(values, values.owner, "user");
    return {
      io: callIo,
      flags: values,
      session: { requireStore: false, readOnlyStore: true },
      actor: () => actor,
      json: values.json === true,
      at,
      scope: values.scope,
    };
  },
  request: (p, actor) => ({ actor: must(actor), scope: p.scope }),
  call: async (conn, body) =>
    result(await conn.client.POST("/api/v1/retain", { body })) as unknown as {
      decision: "allow" | "deny";
      events: MemoryEvent[];
      expired: string[];
      evicted: string[];
    },
  print: (p, actor, report, conn) => ({
    code: report.decision === "allow" ? 0 : 1,
    out: p.json
      ? json(report)
      : text([
          `retain ${p.scope} at ${p.at} as ${must(actor).id}: ${report.decision}, ${report.expired.length} expired, ${report.evicted.length} evicted`,
          ...report.events.map(eventLine),
          logHint(conn),
        ]),
  }),
});

/**
 * `engram lint --scope <scope>`: one lint call (card L1) as a member of the
 * scope: the policy's enabled deterministic lints, each finding a lint event
 * with its reason. Exit 0 when clean, 1 on any finding or when refused.
 */
export const LINT = plane({
  options: OPTIONS.lint,
  allowPositionals: false,
  prepare(values, _positionals, io) {
    if (values.scope === undefined) throw new UsageError("give the scope with --scope <scope>");
    const { at, io: callIo } = callClock(values, io);
    const actor = buildActor(values, values.owner, "user");
    return {
      io: callIo,
      flags: values,
      session: { requireStore: false, readOnlyStore: true },
      actor: () => actor,
      json: values.json === true,
      at,
      scope: values.scope,
    };
  },
  request: (p, actor) => ({ actor: must(actor), scope: p.scope }),
  call: async (conn, body) =>
    result(await conn.client.POST("/api/v1/lint", { body })) as unknown as {
      decision: "allow" | "deny";
      findings: LintFinding[];
      events: MemoryEvent[];
    },
  print: (p, actor, report, conn) => ({
    code: report.decision === "allow" && report.findings.length === 0 ? 0 : 1,
    out: p.json
      ? json(report)
      : text([
          `lint ${p.scope} at ${p.at} as ${must(actor).id}: ${report.decision}, ${plural(report.findings.length, "finding")}`,
          ...report.events.map(eventLine),
          logHint(conn),
        ]),
  }),
});

/**
 * `engram simulate [--workload <workload.json>] [--policy <baseline>] [--candidate <policy>]`:
 * one simulate call. The baseline is the workspace's policy; the candidate is
 * sent in the request, loaded here like --policy (a preset or a file), so
 * with --server the server's own policy is the baseline. Prints the
 * comparison, or the report with --json; exit 0.
 */
export const SIMULATE = plane({
  options: OPTIONS.simulate,
  allowPositionals: false,
  prepare(values, _positionals, io) {
    let workload: unknown = { id: "empty", actors: {}, steps: [] };
    if (values.workload !== undefined) {
      try {
        workload = JSON.parse(readFileSync(resolve(io.cwd, values.workload), "utf8"));
      } catch (e) {
        throw new UsageError(`--workload ${values.workload}: ${(e as Error).message}`);
      }
    }
    const candidate =
      values.candidate === undefined
        ? undefined
        : loadPolicy(values.candidate, io.cwd, "--candidate");
    return {
      io,
      flags: { db: values.db, policy: values.policy, server: values.server },
      session: null,
      actor: noActor,
      json: values.json === true,
      workload,
      candidate,
    };
  },
  request: (p) => ({
    workload: p.workload as never,
    ...(p.candidate ? { policy: p.candidate } : {}),
  }),
  // The report is typed by core's SimReport (card E8.9); the client's copy is its JSON Schema.
  call: async (conn, body) =>
    result(await conn.client.POST("/api/v1/simulate", { body })) as unknown as SimReport,
  print: (p, _actor, report) => ({
    code: 0,
    out: p.json ? json(report) : text(simulationLines(report)),
  }),
});

/**
 * `engram policy` (card E8.15a): GET /policy, the policy the workspace
 * decides with and its label, as YAML a policy file may hold, or --json. No
 * actor; the log is never opened. Exit 0.
 */
export const POLICY = plane({
  options: OPTIONS.policy,
  allowPositionals: false,
  prepare: (values, _positionals, io) => ({
    io,
    flags: { policy: values.policy, server: values.server },
    session: null,
    actor: noActor,
    json: values.json === true,
  }),
  request: () => undefined,
  call: async (conn) =>
    result(await conn.client.GET("/api/v1/policy")) as unknown as {
      policy: Record<string, unknown>;
      label: string;
    },
  print: (p, _actor, answer) => ({
    code: 0,
    out: p.json ? json(answer) : text(policyLines(answer.policy, answer.label)),
  }),
});

/**
 * `engram scopes` (card E8.15a, over card E8.14's route): the scopes the
 * actor can see, by membership or through a live grant, POST /scopes. It is
 * a read: one read event, and with a store the same sweep and adoption as
 * `engram read` first. Exit 0.
 */
export const SCOPES = plane({
  options: OPTIONS.scopes,
  allowPositionals: false,
  prepare: (values, _positionals, io) => ({
    io,
    flags: values,
    session: { requireStore: false, readOnlyStore: true },
    actor: () => buildActor(values, values.owner),
    json: values.json === true,
  }),
  request: (_p, actor) => ({ actor: must(actor) }),
  call: async (conn, body) =>
    result(await conn.client.POST("/api/v1/scopes", { body })) as unknown as {
      scopes: { scope: string; via: "membership" | "grant" }[];
      event: MemoryEvent;
      sync: StoreSync | null;
      policy: string;
    },
  print: (p, actor, answer, conn) => ({
    code: 0,
    out: p.json
      ? json(answer)
      : text([
          ...scopesLines(answer, must(actor)),
          ...(answer.sync ? syncLines(answer.sync) : []),
          logHint(conn),
        ]),
  }),
});

/**
 * `engram who-can-read <item-id>` or `engram who-can-read --scope <scope>`
 * (card E2.13): one call. The plane answers who can read the item or the
 * scope's items, each reader entry with the rule or grant that admits it;
 * it answers only an actor who may read the item or its scope, and names
 * grant holders to the item's owner only (decision item 53). Exit 0 when
 * answered, 1 when refused.
 */
export const WHO_CAN_READ = plane({
  options: OPTIONS["who-can-read"],
  allowPositionals: true,
  prepare(values, positionals, io) {
    const [itemId, ...rest] = positionals;
    if (rest.length > 0 || (itemId === undefined) === (values.scope === undefined))
      throw new UsageError(
        "give exactly one item id or --scope <scope>: engram who-can-read <item-id> | --scope <scope>",
      );
    if (itemId !== undefined && !Id.safeParse(itemId).success)
      throw new UsageError(`${itemId} is not an item id (a UUIDv7)`);
    if (values.scope !== undefined && !Scope.safeParse(values.scope).success)
      throw new UsageError(
        `--scope ${values.scope} is not a scope (person:<id>, role:<id>, team:<id> or org)`,
      );
    const { io: callIo } = callClock(values, io);
    const actor = buildActor(values, values.owner);
    return {
      io: callIo,
      flags: values,
      session: { requireStore: false, readOnlyStore: true },
      actor: () => actor,
      json: values.json === true,
      itemId,
      scope: values.scope,
    };
  },
  request: (p, actor) =>
    p.itemId !== undefined
      ? { route: "item" as const, body: { actor: must(actor), item_id: p.itemId } }
      : { route: "scope" as const, body: { actor: must(actor), scope: p.scope as string } },
  call: async (conn, request) =>
    (request.route === "item"
      ? result(await conn.client.POST("/api/v1/who-can-read/item", { body: request.body }))
      : result(
          await conn.client.POST("/api/v1/who-can-read/scope", { body: request.body }),
        )) as unknown as WhoCanReadAnswer,
  print: (p, actor, a, conn) => ({
    code: a.answered ? 0 : 1,
    out: p.json ? json(a) : text([...whoCanReadLines(a, must(actor)), logHint(conn)]),
  }),
});

export function readCommand(args: string[], io: Io): Promise<number> {
  return runPlane(READ, args, io);
}
export function writeCommand(args: string[], io: Io): Promise<number> {
  return runPlane(WRITE, args, io);
}
export function checkCommand(args: string[], io: Io): Promise<number> {
  return runPlane(CHECK, args, io);
}
export function promoteCommand(args: string[], io: Io): Promise<number> {
  return runPlane(PROMOTE, args, io);
}
export function grantsCommand(args: string[], io: Io): Promise<number> {
  return runPlane(GRANTS, args, io);
}
export function explainCommand(args: string[], io: Io): Promise<number> {
  return runPlane(EXPLAIN, args, io);
}
export function eventsCommand(args: string[], io: Io): Promise<number> {
  return runPlane(EVENTS, args, io);
}
export function retainCommand(args: string[], io: Io): Promise<number> {
  return runPlane(RETAIN, args, io);
}
export function lintCommand(args: string[], io: Io): Promise<number> {
  return runPlane(LINT, args, io);
}
export function simulateCommand(args: string[], io: Io): Promise<number> {
  return runPlane(SIMULATE, args, io);
}
export function policyCommand(args: string[], io: Io): Promise<number> {
  return runPlane(POLICY, args, io);
}
export function scopesCommand(args: string[], io: Io): Promise<number> {
  return runPlane(SCOPES, args, io);
}
export function whoCanReadCommand(args: string[], io: Io): Promise<number> {
  return runPlane(WHO_CAN_READ, args, io);
}
