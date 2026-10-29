// The commands that reach the plane (doctor is in ./doctor.ts, serve in
// ./serve.ts). Each parses its flags, builds the actor, makes exactly one
// client call (card E8.2, ADR 0027 decision 3; ./connect.ts) and prints the
// answer. The Plane makes every decision; nothing here is a policy `if`.
// Every id comes from the Io (`io.newId`), so a run with a fixed Io is
// reproducible.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type ParseArgsConfig, parseArgs } from "node:util";
import { type Actor, Id, type MemoryEvent, type MemoryItem, Scope } from "@engram/core";
import { type Connection, connect, result } from "./connect.ts";
import { decisionLines, explanationLines, plural, preview } from "./format.ts";
import type { Io } from "./run.ts";
import { buildActor, checkNumber, checkTime, MEMORY_DB, UsageError } from "./setup.ts";

type Options = NonNullable<ParseArgsConfig["options"]>;

export const STORE_OPTIONS = {
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

interface WorkspaceFlags {
  store?: string;
  root?: string;
  owner?: string;
  "import-valid-from"?: string;
  policy?: string;
  db?: string;
}

/** The in-process workspace's options from a command's flags. */
const workspaceOf = (flags: WorkspaceFlags, requireStore: boolean) => () => ({
  store: flags.store,
  root: flags.root,
  owner: flags.owner,
  importValidFrom: checkTime("--import-valid-from", flags["import-valid-from"]),
  policy: flags.policy,
  db: flags.db,
  requireStore,
});

/**
 * Connects and builds the actor, in the order the commands have always
 * reported problems: the policy and the store, then the actor, then the log.
 */
function session(
  io: Io,
  flags: WorkspaceFlags & { server?: string },
  options: { requireStore: boolean; mustExist?: boolean },
  makeActor: () => Actor,
): { conn: Connection; actor: Actor } {
  let actor: Actor | undefined;
  const conn = connect(io, flags, workspaceOf(flags, options.requireStore), (ws) => {
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
  const at = checkTime("--at", values.at) ?? io.now();
  const { conn, actor } = session(io, values, { requireStore: true }, () =>
    buildActor(values, values.owner),
  );
  try {
    const text = positionals.join(" ") || undefined;
    // One call: the server's read route sweeps and adopts the store as its
    // owner first (retention before adoption, ADR 0025 and decision D8).
    const answer = result(await conn.client.POST("/api/v1/read", { body: { actor, text, at } }));
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
          retired: number;
          denials: { item_id: string; reason: string; policy_id: string }[];
          retirements: { item_id: string; reason: string }[];
          evictions: MemoryEvent[];
        };
      } | null;
    };
    const readId = r.event.id;
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

    const lines = [`read ${readId} at ${at} as ${actor.id} (${actor.level}) under ${r.policy}`];
    if (sync) {
      const a = sync.adoption;
      lines.push(
        `store ${sync.store.name} at ${sync.store.root}`,
        `retention: ${sync.retention.expired.length} expired, ${sync.retention.evicted.length} evicted`,
        ...sync.retention.events.map(eventLine),
        `imported ${a.allowed + a.denied} of ${plural(a.listed, "memory", "memories")}: ` +
          `${a.allowed} allowed, ${a.denied} denied, ${a.unchanged} already in the log`,
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
  const at = checkTime("--at", values.at) ?? io.now();
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
    schema_version: 0,
  };

  const { conn } = session(io, values, { requireStore: true }, () => actor);
  try {
    const answer = result(await conn.client.POST("/api/v1/items", { body: { actor, item, at } }));
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
  const at = checkTime("--at", values.at) ?? io.now();
  const actor = buildActor(values, values.owner, "user");
  const { conn } = session(io, values, { requireStore: true }, () => actor);
  try {
    const answer = result(
      await conn.client.POST("/api/v1/promote", {
        body: { actor, item_id: itemId, to: values.to, review: values.review === true, at },
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
  const { conn } = session(io, flags, { requireStore: false, mustExist: true }, () => actor);
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
  const at = checkTime("--at", values.at) ?? io.now();
  const actor = buildActor(values, values.owner, "user");
  const { conn } = session(io, values, { requireStore: false }, () => actor);
  try {
    const answer = result(
      await conn.client.POST("/api/v1/retain", { body: { actor, scope: values.scope, at } }),
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

/** `engram lint [--scope <scope>]`: one lint call; 501 naming card L1 until it lands. */
export async function lintCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(
    args,
    {
      db: STORE_OPTIONS.db,
      policy: STORE_OPTIONS.policy,
      json: STORE_OPTIONS.json,
      scope: { type: "string" },
      ...CLIENT_OPTIONS,
    },
    false,
  );
  const flags = { db: values.db, policy: values.policy, server: values.server };
  const conn = connect(io, flags, workspaceOf(flags, false), undefined);
  try {
    const answer = result(
      await conn.client.POST("/api/v1/lint", { body: { scope: values.scope ?? "org" } }),
    );
    io.out(`${JSON.stringify(answer.findings, null, 2)}\n`);
    return answer.findings.length === 0 ? 0 : 1;
  } finally {
    conn.close();
  }
}

/** `engram simulate [--workload <events.json>]`: one simulate call; 501 naming card E8.9 until it lands. */
export async function simulateCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(
    args,
    {
      db: STORE_OPTIONS.db,
      policy: STORE_OPTIONS.policy,
      json: STORE_OPTIONS.json,
      workload: { type: "string" },
      ...CLIENT_OPTIONS,
    },
    false,
  );
  let workload: { id: string; events: unknown[] } = { id: "empty", events: [] };
  if (values.workload !== undefined) {
    try {
      workload = JSON.parse(readFileSync(resolve(io.cwd, values.workload), "utf8"));
    } catch (e) {
      throw new UsageError(`--workload ${values.workload}: ${(e as Error).message}`);
    }
  }
  const flags = { db: values.db, policy: values.policy, server: values.server };
  const conn = connect(io, flags, workspaceOf(flags, false), undefined);
  try {
    const answer = result(
      await conn.client.POST("/api/v1/simulate", { body: { workload: workload as never } }),
    );
    io.out(`${JSON.stringify(answer, null, 2)}\n`);
    return 0;
  } finally {
    conn.close();
  }
}
