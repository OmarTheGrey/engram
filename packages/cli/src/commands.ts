// The commands that reach the plane (doctor is in ./doctor.ts, serve in
// ./serve.ts). Each parses its flags, builds the actor, makes exactly one
// client call (card E8.2, ADR 0027 decision 3; ./connect.ts) and prints the
// answer. The Plane makes every decision; nothing here is a policy `if`.
// Every id comes from the Io (`io.newId`), so a run with a fixed Io is
// reproducible.
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { type ParseArgsConfig, parseArgs } from "node:util";
import {
  type Actor,
  type BundleRow,
  Id,
  type ImportSource,
  importActor,
  importedWrite,
  importOrder,
  type LintFinding,
  type MemoryEvent,
  type MemoryItem,
  mapLineage,
  Scope,
  type SimReport,
  type WhoCanReadAnswer,
} from "@engram/core";
import { type Connection, connect, result, serverOf } from "./connect.ts";
import {
  decisionLines,
  explanationLines,
  plural,
  preview,
  type SupersedeAnswer,
  simulationLines,
  supersedeLines,
  whoCanReadLines,
} from "./format.ts";
import { type BundleHeader, bundleText, MAX_INPUT_BYTES, parseBundle } from "./import/bundle.ts";
import { parseClaudeMemory } from "./import/claude.ts";
import {
  decryptBundle,
  encryptBundle,
  isEncrypted,
  readIdentities,
  readPassphrase,
} from "./import/crypt.ts";
import type { Io } from "./run.ts";
import { buildActor, checkNumber, checkTime, loadPolicy, MEMORY_DB, UsageError } from "./setup.ts";

type Options = NonNullable<ParseArgsConfig["options"]>;

/**
 * Where this process exports its decisions as spans (card E8.13, ADR 0043):
 * none unless one is named, here or by ENGRAM_OTLP_URL or ENGRAM_EXPORT_JSONL.
 */
export const EXPORT_OPTIONS = {
  otlp: { type: "string" },
  "export-jsonl": { type: "string" },
} satisfies Options;

export const STORE_OPTIONS = {
  ...EXPORT_OPTIONS,
  store: { type: "string" },
  root: { type: "string" },
  owner: { type: "string" },
  "import-valid-from": { type: "string" },
  policy: { type: "string" },
  db: { type: "string" },
  json: { type: "boolean" },
} satisfies Options;

export const ACTOR_OPTIONS = {
  as: { type: "string" },
  level: { type: "string" },
  member: { type: "string", multiple: true },
  at: { type: "string" },
  // For tests and fixtures only: lets --at set the clock of an in-process
  // call that is not a read (review fix pass of PR #59, RV5-3).
  "test-clock": { type: "boolean" },
} satisfies Options;

/** A server to call instead of the in-process app (or ENGRAM_SERVER_URL). */
export const CLIENT_OPTIONS = { server: { type: "string" } } satisfies Options;

const WRITE_OPTIONS = {
  content: { type: "string" },
  file: { type: "string" },
  id: { type: "string" },
  scope: { type: "string" },
  class: { type: "string" },
  confidence: { type: "string" },
  "valid-from": { type: "string" },
  "valid-to": { type: "string" },
} satisfies Options;

export function parse<O extends Options>(args: string[], options: O, positionals: boolean) {
  try {
    return parseArgs({ args, options, allowPositionals: positionals, strict: true });
  } catch (e) {
    throw new UsageError((e as Error).message);
  }
}

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
  otlp?: string;
  "export-jsonl"?: string;
  store?: string;
  root?: string;
  owner?: string;
  "import-valid-from"?: string;
  policy?: string;
  db?: string;
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

/**
 * Connects and builds the actor, in the order the commands have always
 * reported problems: the policy and the store, then the actor, then the log.
 */
function session(
  io: Io,
  flags: WorkspaceFlags & { server?: string },
  options: { requireStore: boolean; mustExist?: boolean; readOnlyStore?: boolean },
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

export async function readCommand(args: string[], io: Io): Promise<number> {
  const { values, positionals } = parse(
    args,
    { ...STORE_OPTIONS, ...ACTOR_OPTIONS, ...CLIENT_OPTIONS },
    true,
  );
  // A read's --at is the time its validity windows are judged at, in process
  // and over --server alike; the read happens at the server's clock, which
  // is also when the store owner's sweep runs (card RV5, RV-SRF-1 and 2).
  const validAt = checkTime("--at", values.at);
  const { conn, actor } = session(io, values, { requireStore: true, readOnlyStore: true }, () =>
    buildActor(values, values.owner),
  );
  try {
    const text = positionals.join(" ") || undefined;
    // One call: the server's read route sweeps and adopts the store as its
    // owner first (retention before adoption, ADR 0025 and decision D8).
    const answer = result(
      await conn.client.POST("/api/v1/read", {
        body: { actor, text, ...(validAt === undefined ? {} : { at: validAt }) },
      }),
    );
    const r = answer as unknown as {
      items: MemoryItem[];
      explanations: { item_id: string; rank: number }[] & Parameters<typeof explanationLines>[0][];
      filtered: number;
      event: MemoryEvent;
      policy: string;
      sync: {
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
      } | null;
    };
    const readId = r.event.id;
    const at = r.event.ts;
    const rows = r.items.map((item, i) => ({ item, explanation: r.explanations[i] }));
    const sync = r.sync;

    if (values.json) {
      const counts = sync
        ? (({ denials: _d, retirements: _r, evictions: _e, ...rest }) => rest)(sync.adoption)
        : null;
      io.out(
        `${JSON.stringify(
          {
            read_id: readId,
            at,
            valid_at: validAt ?? null,
            actor,
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
          },
          null,
          2,
        )}\n`,
      );
      return 0;
    }

    const lines = [
      `read ${readId} at ${at}${validAt === undefined ? "" : `, validity windows at ${validAt}`} as ${actor.id} (${actor.level}) under ${r.policy}`,
    ];
    if (sync) {
      const a = sync.adoption;
      lines.push(
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
      );
    }
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
    io.out(`${lines.join("\n")}\n`);
    return 0;
  } finally {
    conn.close();
  }
}

const sha256 = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;

export async function writeCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(
    args,
    { ...STORE_OPTIONS, ...ACTOR_OPTIONS, ...WRITE_OPTIONS, ...CLIENT_OPTIONS },
    false,
  );
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

  const { conn } = session(clock.io, values, { requireStore: true }, () => actor);
  try {
    const answer = result(await conn.client.POST("/api/v1/items", { body: { actor, item } }));
    const { item: stored, event } = answer as unknown as {
      item: MemoryItem | null;
      event: MemoryEvent;
    };
    if (values.json) io.out(`${JSON.stringify({ event, item: stored }, null, 2)}\n`);
    else io.out(`${[...decisionLines(event, stored), logHint(conn)].join("\n")}\n`);
    return event.decision === "allow" ? 0 : 1;
  } finally {
    conn.close();
  }
}

/**
 * `engram promote <item-id> --to <scope> [--review]`: one promote call as a
 * user-sourced actor (ADR 0026: only a user-sourced actor can approve). Exit
 * 0 when the promotion landed, 1 on deny or ask.
 */
export async function promoteCommand(args: string[], io: Io): Promise<number> {
  const { values, positionals } = parse(
    args,
    {
      ...STORE_OPTIONS,
      ...ACTOR_OPTIONS,
      ...CLIENT_OPTIONS,
      to: { type: "string" },
      review: { type: "boolean" },
    },
    true,
  );
  const [itemId, ...rest] = positionals;
  if (itemId === undefined || rest.length > 0)
    throw new UsageError("give exactly one item id: engram promote <item-id> --to <scope>");
  if (!Id.safeParse(itemId).success) throw new UsageError(`${itemId} is not an item id (a UUIDv7)`);
  if (values.to === undefined) throw new UsageError("give the target scope with --to <scope>");
  if (!Scope.safeParse(values.to).success)
    throw new UsageError(
      `--to ${values.to} is not a scope (person:<id>, role:<id>, team:<id> or org)`,
    );
  const clock = callClock(values, io);
  const actor = buildActor(values, values.owner, "user");
  const { conn } = session(clock.io, values, { requireStore: true }, () => actor);
  try {
    const answer = result(
      await conn.client.POST("/api/v1/promote", {
        body: { actor, item_id: itemId, to: values.to, review: values.review === true },
      }),
    );
    const { decision, event, events, item } = answer as unknown as {
      decision: MemoryEvent["decision"];
      event: MemoryEvent;
      events: MemoryEvent[];
      item: MemoryItem | null;
    };
    if (values.json) {
      io.out(`${JSON.stringify({ decision, event, events, item }, null, 2)}\n`);
    } else {
      const lines = decisionLines(event, item);
      for (const e of events.slice(1)) lines.push(eventLine(e));
      io.out(`${[...lines, logHint(conn)].join("\n")}\n`);
    }
    return decision === "allow" ? 0 : 1;
  } finally {
    conn.close();
  }
}

/**
 * `engram supersede <item-id> [--accept <id>]...` (card L6): one call to the
 * supersede route as a user-sourced actor. Core plans (the head of the
 * item's chain, a proposed close or a review flag for each ancestor the
 * actor may read); each --accept is one ordinary write of a new version
 * through the write gate, which decides it. Exit 0 when the chain resolves
 * and every accepted close was allowed, 1 otherwise.
 */
export async function supersedeCommand(args: string[], io: Io): Promise<number> {
  const { values, positionals } = parse(
    args,
    {
      ...STORE_OPTIONS,
      ...ACTOR_OPTIONS,
      ...CLIENT_OPTIONS,
      accept: { type: "string", multiple: true },
    },
    true,
  );
  const [itemId, ...rest] = positionals;
  if (itemId === undefined || rest.length > 0)
    throw new UsageError("give exactly one item id: engram supersede <item-id> [--accept <id>]...");
  const accept = values.accept ?? [];
  for (const id of [itemId, ...accept])
    if (!Id.safeParse(id).success) throw new UsageError(`${id} is not an item id (a UUIDv7)`);
  const clock = callClock(values, io);
  const actor = buildActor(values, values.owner, "user");
  const { conn } = session(clock.io, values, { requireStore: true }, () => actor);
  try {
    const answer = result(
      await conn.client.POST("/api/v1/supersede", { body: { actor, item_id: itemId, accept } }),
    );
    const plan = answer as unknown as SupersedeAnswer;
    const allowed =
      plan.head.ok &&
      plan.stopped === null &&
      plan.applied.every((a) => a.event.decision === "allow");
    if (values.json) {
      io.out(`${JSON.stringify(plan, null, 2)}
`);
      return allowed ? 0 : 1;
    }
    const lines = supersedeLines(plan, accept);
    io.out(`${[...lines, logHint(conn)].join("\n")}\n`);
    return allowed ? 0 : 1;
  } finally {
    conn.close();
  }
}

export async function explainCommand(args: string[], io: Io): Promise<number> {
  const { values, positionals } = parse(
    args,
    {
      db: STORE_OPTIONS.db,
      policy: STORE_OPTIONS.policy,
      json: STORE_OPTIONS.json,
      owner: STORE_OPTIONS.owner,
      as: ACTOR_OPTIONS.as,
      level: ACTOR_OPTIONS.level,
      member: ACTOR_OPTIONS.member,
      ...CLIENT_OPTIONS,
    },
    true,
  );
  const [readId, ...rest] = positionals;
  if (readId === undefined || rest.length > 0)
    throw new UsageError("give exactly one read id: engram explain <readId>");
  // Only the actor who made the read may explain it (decision D5). The
  // workspace needs no store: --owner here names the actor only.
  const actor = buildActor(values, values.owner);
  const flags = { db: values.db, policy: values.policy, server: values.server };
  const { conn } = session(
    io,
    flags,
    { requireStore: false, mustExist: true, readOnlyStore: true },
    () => actor,
  );
  try {
    const answer = result(
      await conn.client.POST("/api/v1/explain/{readId}", {
        params: { path: { readId } },
        body: { actor },
      }),
    );
    const explanations = answer.explanations as unknown as Parameters<typeof explanationLines>[0][];
    if (values.json) {
      io.out(`${JSON.stringify(explanations, null, 2)}\n`);
      return 0;
    }
    const lines = [`read ${readId}: ${plural(explanations.length, "explanation")}`];
    for (const e of explanations)
      lines.push("", `${e.rank}. ${e.item_id}`, ...explanationLines(e).map((l) => `   ${l}`));
    io.out(`${lines.join("\n")}\n`);
    return 0;
  } finally {
    conn.close();
  }
}

/**
 * `engram retain --scope <scope>`: one retention sweep of a scope (ADR 0025)
 * as a user-sourced member of it, so expired items in a shared scope are
 * retired too (the sweep retires by ttl outside one's own person scope only
 * for a user-sourced actor). Exit 0 when the sweep ran, 1 when it was refused.
 */
export async function retainCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(
    args,
    { ...STORE_OPTIONS, ...ACTOR_OPTIONS, ...CLIENT_OPTIONS, scope: { type: "string" } },
    false,
  );
  if (values.scope === undefined) throw new UsageError("give the scope with --scope <scope>");
  const { at, io: callIo } = callClock(values, io);
  const actor = buildActor(values, values.owner, "user");
  const { conn } = session(
    callIo,
    values,
    { requireStore: false, readOnlyStore: true },
    () => actor,
  );
  try {
    const answer = result(
      await conn.client.POST("/api/v1/retain", { body: { actor, scope: values.scope } }),
    );
    const report = answer as unknown as {
      decision: "allow" | "deny";
      events: MemoryEvent[];
      expired: string[];
      evicted: string[];
    };
    if (values.json) io.out(`${JSON.stringify(report, null, 2)}\n`);
    else
      io.out(
        `${[
          `retain ${values.scope} at ${at} as ${actor.id}: ${report.decision}, ${report.expired.length} expired, ${report.evicted.length} evicted`,
          ...report.events.map(eventLine),
          logHint(conn),
        ].join("\n")}\n`,
      );
    return report.decision === "allow" ? 0 : 1;
  } finally {
    conn.close();
  }
}

/**
 * `engram lint --scope <scope>`: one lint call (card L1) as a member of the
 * scope: the policy's enabled deterministic lints, each finding a lint event
 * with its reason. Exit 0 when clean, 1 on any finding or when refused.
 */
export async function lintCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(
    args,
    { ...STORE_OPTIONS, ...ACTOR_OPTIONS, ...CLIENT_OPTIONS, scope: { type: "string" } },
    false,
  );
  if (values.scope === undefined) throw new UsageError("give the scope with --scope <scope>");
  const { at, io: callIo } = callClock(values, io);
  const actor = buildActor(values, values.owner, "user");
  const { conn } = session(
    callIo,
    values,
    { requireStore: false, readOnlyStore: true },
    () => actor,
  );
  try {
    const answer = result(
      await conn.client.POST("/api/v1/lint", { body: { actor, scope: values.scope } }),
    );
    const report = answer as unknown as {
      decision: "allow" | "deny";
      findings: LintFinding[];
      events: MemoryEvent[];
    };
    if (values.json) io.out(`${JSON.stringify(report, null, 2)}\n`);
    else
      io.out(
        `${[
          `lint ${values.scope} at ${at} as ${actor.id}: ${report.decision}, ${plural(report.findings.length, "finding")}`,
          ...report.events.map(eventLine),
          logHint(conn),
        ].join("\n")}\n`,
      );
    return report.decision === "allow" && report.findings.length === 0 ? 0 : 1;
  } finally {
    conn.close();
  }
}

/**
 * `engram simulate [--workload <workload.json>] [--policy <baseline>] [--candidate <policy>]`:
 * one simulate call. The baseline is the workspace's policy; the candidate is
 * sent in the request, loaded here like --policy (a preset or a file), so
 * with --server the server's own policy is the baseline. Prints the
 * comparison, or the report with --json; exit 0.
 */
export async function simulateCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(
    args,
    {
      db: STORE_OPTIONS.db,
      policy: STORE_OPTIONS.policy,
      json: STORE_OPTIONS.json,
      workload: { type: "string" },
      candidate: { type: "string" },
      ...CLIENT_OPTIONS,
    },
    false,
  );
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
  const flags = { db: values.db, policy: values.policy, server: values.server };
  const conn = connect(io, flags, workspaceOf(flags, false), undefined);
  try {
    const report = result(
      await conn.client.POST("/api/v1/simulate", {
        body: { workload: workload as never, ...(candidate ? { policy: candidate } : {}) },
      }),
    );
    // The report is typed by core's SimReport (card E8.9); the client's copy is its JSON Schema.
    const typed = report as unknown as SimReport;
    io.out(
      values.json
        ? `${JSON.stringify(typed, null, 2)}\n`
        : `${simulationLines(typed).join("\n")}\n`,
    );
    return 0;
  } finally {
    conn.close();
  }
}

/**
 * `engram who-can-read <item-id>` or `engram who-can-read --scope <scope>`
 * (card E2.13): one call. The plane answers who can read the item or the
 * scope's items, each reader entry with the rule or grant that admits it;
 * it answers only an actor who may read the item or its scope, and names
 * grant holders to the item's owner only (decision item 53). Exit 0 when
 * answered, 1 when refused.
 */
export async function whoCanReadCommand(args: string[], io: Io): Promise<number> {
  const { values, positionals } = parse(
    args,
    { ...STORE_OPTIONS, ...ACTOR_OPTIONS, ...CLIENT_OPTIONS, scope: { type: "string" } },
    true,
  );
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
  const { conn } = session(
    callIo,
    values,
    { requireStore: false, readOnlyStore: true },
    () => actor,
  );
  try {
    const answer =
      itemId !== undefined
        ? result(
            await conn.client.POST("/api/v1/who-can-read/item", {
              body: { actor, item_id: itemId },
            }),
          )
        : result(
            await conn.client.POST("/api/v1/who-can-read/scope", {
              body: { actor, scope: values.scope as string },
            }),
          );
    const a = answer as unknown as WhoCanReadAnswer;
    if (values.json) io.out(`${JSON.stringify(a, null, 2)}\n`);
    else io.out(`${[...whoCanReadLines(a, actor), logHint(conn)].join("\n")}\n`);
    return a.answered ? 0 : 1;
  } finally {
    conn.close();
  }
}

const BUNDLE_OPTIONS = {
  out: { type: "string" },
  recipient: { type: "string", multiple: true },
  "passphrase-file": { type: "string" },
} satisfies Options;

/**
 * `engram export [--out <file>] [--recipient <age1...>]... [--passphrase-file <file>]`:
 * one export call (card E9.8). The bundle (docs/bundle.md) is JSONL: a header
 * line, then one row per item core's bundleRows picks, each with its decision
 * events. Optionally encrypted with age and armored. To stdout, or to --out
 * with a one-line summary. Exit 0.
 */
export async function exportCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(
    args,
    {
      db: STORE_OPTIONS.db,
      policy: STORE_OPTIONS.policy,
      owner: STORE_OPTIONS.owner,
      as: ACTOR_OPTIONS.as,
      level: ACTOR_OPTIONS.level,
      member: ACTOR_OPTIONS.member,
      ...CLIENT_OPTIONS,
      ...BUNDLE_OPTIONS,
    },
    false,
  );
  const keys = {
    recipients: values.recipient ?? [],
    passphrase:
      values["passphrase-file"] === undefined
        ? undefined
        : readPassphrase(io.cwd, values["passphrase-file"]),
  };
  // Export writes nothing: the actor names no source (decision D4).
  const actor = buildActor(values, values.owner);
  const flags = { db: values.db, policy: values.policy, server: values.server };
  const { conn } = session(
    io,
    flags,
    { requireStore: false, mustExist: true, readOnlyStore: true },
    () => actor,
  );
  try {
    const answer = result(await conn.client.POST("/api/v1/export", { body: { actor } }));
    const { rows, ...header } = answer as unknown as { rows: BundleRow[] } & Omit<
      BundleHeader,
      "rows"
    >;
    const text = await encryptBundle(bundleText(header, rows), keys);
    const events = rows.reduce((n, r) => n + r.events.length, 0);
    if (values.out === undefined) {
      io.out(text);
      return 0;
    }
    writeFileSync(resolve(io.cwd, values.out), text, "utf8");
    const sealed =
      keys.passphrase !== undefined
        ? ", encrypted with a passphrase"
        : keys.recipients.length > 0
          ? `, encrypted to ${plural(keys.recipients.length, "recipient")}`
          : "";
    io.out(
      `exported ${plural(rows.length, "item")} with ${plural(events, "event")} as ${actor.id} under ${header.policy} to ${values.out}${sealed}\n`,
    );
    return 0;
  } finally {
    conn.close();
  }
}

const IMPORT_OPTIONS = {
  claude: { type: "string" },
  scope: { type: "string" },
  confidence: { type: "string" },
  identity: { type: "string", multiple: true },
  "passphrase-file": { type: "string" },
} satisfies Options;

/** One planned row of an import: where it came from, its source and the scope it goes to. */
interface Planned {
  from: string;
  scope: string;
  lineage: readonly string[];
  source: BundleRow | ImportSource;
  /** What the parser changed about the row, reported beside its decision. */
  note: string | null;
}

/** What a row of the import did. */
interface ImportedRow {
  from: string;
  to: string;
  kind: string;
  decision: MemoryEvent["decision"];
  status: MemoryItem["status"] | null;
  policy_id: string;
  reason: string;
  note: string | null;
}

/** A file an import reads, refused over MAX_INPUT_BYTES before it is read. */
function readInput(file: string, flag: string, io: Io): Buffer {
  const path = resolve(io.cwd, file);
  try {
    const size = statSync(path).size;
    if (size > MAX_INPUT_BYTES)
      throw new UsageError(
        `${flag}${file} is ${size} bytes; engram import reads files of at most ${MAX_INPUT_BYTES} bytes (64 MiB): split the bundle, or export fewer scopes`,
      );
    return readFileSync(path);
  } catch (e) {
    if (e instanceof UsageError) throw e;
    throw new UsageError(`${flag}${file}: ${(e as Error).message}`);
  }
}

/** The rows of a pasted Claude memory list, each a semantic memory in `scope` as an import. */
function claudeRows(file: string, scope: string, confidence: number, at: string, io: Io) {
  const text = readInput(file, "--claude ", io).toString("utf8");
  return parseClaudeMemory(text, at).map(
    (e): Planned => ({
      from: `line ${e.line}`,
      scope,
      lineage: [],
      note: e.note,
      source: {
        class: "semantic",
        content: e.text,
        confidence,
        valid_from: e.valid_from ?? at,
        valid_to: null,
        ttl: null,
        status: "candidate",
        provenance: { kind: "import" },
        ref: `claude-memory:${e.section === null ? "" : `${e.section}:`}line-${e.line}`,
      },
    }),
  );
}

/** The rows of a bundle file, decrypted first when it is an age file. */
async function bundleRowsOf(
  file: string,
  values: { identity?: string[]; "passphrase-file"?: string; scope?: string },
  io: Io,
): Promise<Planned[]> {
  const bytes = readInput(file, "", io);
  const text = isEncrypted(bytes)
    ? await decryptBundle(
        bytes,
        (values.identity ?? []).flatMap((f) => readIdentities(io.cwd, f)),
        values["passphrase-file"] === undefined
          ? undefined
          : readPassphrase(io.cwd, values["passphrase-file"]),
      )
    : bytes.toString("utf8");
  return parseBundle(text).rows.map((row) => ({
    from: row.item.id,
    scope: values.scope ?? row.item.scope,
    lineage: row.item.lineage,
    source: row,
    note: null,
  }));
}

/**
 * `engram import <bundle> | --claude <file>`: every row one Plane.write (card
 * E9.8, decision item 55) by the dedicated import actor `import:<importer>`,
 * as core's importedWrite makes it: kind the least trusted of what the row
 * claims and import, owned by the importer, status candidate (a retired row
 * retired), no grants, a new id; the gate decides each. Rows are written in
 * core's importOrder (each after the rows its lineage names), and a lineage
 * pointer is mapped to the new id of a row already allowed, else dropped and
 * counted. Prints the id map and each decision. Exit 0 when every row was
 * allowed, 1 when any was denied.
 */
export async function importCommand(args: string[], io: Io): Promise<number> {
  const { values, positionals } = parse(
    args,
    { ...STORE_OPTIONS, ...ACTOR_OPTIONS, ...CLIENT_OPTIONS, ...IMPORT_OPTIONS },
    true,
  );
  const [file, ...rest] = positionals;
  if (rest.length > 0 || (file === undefined) === (values.claude === undefined))
    throw new UsageError(
      "give exactly one source: engram import <bundle.jsonl> or engram import --claude <memory.txt>",
    );
  if (values.scope !== undefined && !Scope.safeParse(values.scope).success)
    throw new UsageError(
      `--scope ${values.scope} is not a scope (person:<id>, role:<id>, team:<id> or org)`,
    );
  const confidence = checkNumber("--confidence", values.confidence);
  if (confidence !== undefined && values.claude === undefined)
    throw new UsageError("--confidence applies to --claude only; a bundle row keeps its own");
  const clock = callClock(values, io);
  // The importer names no source: it writes nothing itself. Its import actor
  // writes every row, never with the user source engram write sets: core
  // chooses each row's source (importedWrite).
  const importer = buildActor(values, values.owner);
  const actorId = importActor(importer, "import").id;

  let planned: Planned[];
  if (values.claude !== undefined) {
    const scope = values.scope ?? (Scope.safeParse(importer.id).success ? importer.id : undefined);
    if (scope === undefined)
      throw new UsageError(`${importer.id} is not a scope: give the target with --scope <scope>`);
    planned = claudeRows(values.claude, scope, confidence ?? 0.7, clock.at, io);
  } else {
    planned = await bundleRowsOf(file as string, values, io);
  }

  const { conn } = session(clock.io, values, { requireStore: true }, () => importer);
  try {
    const ids = new Map<string, string>();
    const rows: ImportedRow[] = [];
    let dropped = 0;
    for (const p of importOrder(planned)) {
      const lineage = mapLineage(p.lineage, ids);
      dropped += lineage.dropped;
      const to = io.newId();
      const { actor, item } = importedWrite(importer, p.source, {
        id: to,
        scope: p.scope,
        lineage: lineage.lineage,
      });
      const answer = result(await conn.client.POST("/api/v1/items", { body: { actor, item } }));
      const { item: stored, event } = answer as unknown as {
        item: MemoryItem | null;
        event: MemoryEvent;
      };
      if (event.decision === "allow") ids.set(p.from, to);
      rows.push({
        from: p.from,
        to,
        kind: item.provenance.kind,
        decision: event.decision,
        status: stored?.status ?? null,
        policy_id: event.policy_id,
        reason: event.reason,
        note: p.note,
      });
    }
    const allowed = rows.filter((r) => r.decision === "allow").length;
    const denied = rows.length - allowed;
    if (values.json)
      io.out(
        `${JSON.stringify(
          {
            importer: importer.id,
            actor: actorId,
            source: values.claude === undefined ? "bundle" : "claude",
            rows: rows.length,
            allowed,
            denied,
            lineage_dropped: dropped,
            id_map: Object.fromEntries(ids),
            decisions: rows,
          },
          null,
          2,
        )}\n`,
      );
    else
      io.out(
        `${[
          `import as ${actorId} for ${importer.id}: ${plural(rows.length, "row")}, ${allowed} allowed, ${denied} denied${dropped > 0 ? `, ${plural(dropped, "lineage pointer")} dropped (to a version not imported)` : ""}`,
          ...rows.map(
            (r) =>
              `  ${r.from} -> ${r.to}: ${r.decision}${r.status === null ? "" : ` as ${r.status}`}, kind ${r.kind}: ${r.reason} (${r.policy_id})${r.note === null ? "" : `; ${r.note}`}`,
          ),
          logHint(conn),
        ].join("\n")}\n`,
      );
    return denied === 0 ? 0 : 1;
  } finally {
    conn.close();
  }
}
