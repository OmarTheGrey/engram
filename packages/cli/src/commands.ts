// The commands that call the Plane: read, write, explain, doctor. Each builds
// the log, policy, actor and store, makes its Plane call, and prints the
// result. The Plane makes every decision; nothing here is a policy `if`.
import { createHash } from "node:crypto";
import { accessSync, constants, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { type ParseArgsConfig, parseArgs } from "node:util";
import {
  type Actor,
  adoptStoreItems,
  createPlane,
  type MemoryItem,
  type Plane,
  type PlaneDeps,
} from "@engram/core";
import { decisionLines, explanationLines, plural, preview } from "./format.ts";
import type { Io } from "./run.ts";
import {
  type ActorFlags,
  buildActor,
  checkTime,
  type Log,
  loadPolicy,
  MEMORY_DB,
  NO_STORE,
  openLog,
  UsageError,
} from "./setup.ts";
import { openStore, type Store } from "./store.ts";
import { uuidv7 } from "./uuid.ts";

type Options = NonNullable<ParseArgsConfig["options"]>;

const STORE_OPTIONS = {
  store: { type: "string" },
  root: { type: "string" },
  owner: { type: "string" },
  "import-valid-from": { type: "string" },
  policy: { type: "string" },
  db: { type: "string" },
  json: { type: "boolean" },
} satisfies Options;

const ACTOR_OPTIONS = {
  as: { type: "string" },
  level: { type: "string" },
  member: { type: "string", multiple: true },
  at: { type: "string" },
} satisfies Options;

const WRITE_OPTIONS = {
  content: { type: "string" },
  file: { type: "string" },
  id: { type: "string" },
  scope: { type: "string" },
  class: { type: "string" },
  source: { type: "string" },
  confidence: { type: "string" },
  "valid-from": { type: "string" },
  "valid-to": { type: "string" },
} satisfies Options;

function parse<O extends Options>(args: string[], options: O, positionals: boolean) {
  try {
    return parseArgs({ args, options, allowPositionals: positionals, strict: true });
  } catch (e) {
    throw new UsageError((e as Error).message);
  }
}

const newId = () => uuidv7();

interface Session {
  log: Log;
  store: Store;
  plane: Plane;
  deps: PlaneDeps;
  actor: Actor;
  policyLabel: string;
}

function openSession(
  io: Io,
  flags: ActorFlags & {
    store?: string;
    root?: string;
    owner?: string;
    "import-valid-from"?: string;
    policy?: string;
    db?: string;
  },
): Session {
  const policy = loadPolicy(flags.policy, io.cwd);
  const store = openStore(
    {
      store: flags.store,
      root: flags.root,
      owner: flags.owner,
      importValidFrom: checkTime("--import-valid-from", flags["import-valid-from"]),
    },
    (p) => resolve(io.cwd, p),
  );
  const actor = buildActor(flags, flags.owner);
  const log = openLog(flags.db, io.cwd);
  const deps: PlaneDeps = { db: log.db, adapter: store.adapter, policy, newId };
  return {
    log,
    store,
    plane: createPlane(deps),
    deps,
    actor,
    policyLabel: `${policy.id} v${policy.version}`,
  };
}

const logHint = (log: Log, readId?: string) =>
  log.path === MEMORY_DB
    ? "log in memory; pass --db <path> to keep it for engram explain"
    : readId
      ? `log ${log.path}; engram explain ${readId} --db ${log.path}`
      : `log ${log.path}`;

export async function readCommand(args: string[], io: Io): Promise<number> {
  const { values, positionals } = parse(args, { ...STORE_OPTIONS, ...ACTOR_OPTIONS }, true);
  const at = checkTime("--at", values.at) ?? io.now();
  const s = openSession(io, values);
  const { actor } = s;
  try {
    const imported = await adoptStoreItems(s.deps, actor, s.store.scope, at);
    const text = positionals.join(" ") || undefined;
    const result = await s.plane.read(actor, { text, at });
    const readId = result.event.id;
    const rows = result.items.map((item, i) => ({ item, explanation: result.explanations[i] }));

    if (values.json) {
      const { denials: _d, ...counts } = imported;
      io.out(
        `${JSON.stringify(
          {
            read_id: readId,
            at,
            actor,
            policy: s.policyLabel,
            store: { name: s.store.name, root: s.store.root },
            imported: counts,
            denials: imported.denials,
            returned: result.items.length,
            filtered: result.filtered,
            reason: result.event.reason,
            items: rows,
            log: s.log.path,
          },
          null,
          2,
        )}\n`,
      );
      return 0;
    }

    const lines = [
      `read ${readId} at ${at} as ${actor.id} (${actor.level}) under ${s.policyLabel}`,
      `store ${s.store.name} at ${s.store.root}`,
      `imported ${imported.allowed + imported.denied} of ${plural(imported.listed, "memory", "memories")}: ` +
        `${imported.allowed} allowed, ${imported.denied} denied, ${imported.unchanged} already in the log`,
      ...imported.denials.map((d) => `  denied ${d.item_id}: ${d.reason} (${d.policy_id})`),
      `${plural(result.items.length, "item")} returned, ${result.filtered} filtered`,
      `  ${result.event.reason}`,
    ];
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
    lines.push("", logHint(s.log, readId));
    io.out(`${lines.join("\n")}\n`);
    return 0;
  } finally {
    s.log.db.close();
  }
}

const sha256 = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;

export async function writeCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(args, { ...STORE_OPTIONS, ...ACTOR_OPTIONS, ...WRITE_OPTIONS }, false);
  const at = checkTime("--at", values.at) ?? io.now();
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
  const actor = buildActor(values, values.owner);
  const contentText = typeof content === "string" ? content : JSON.stringify(content);
  const provenance = {
    kind: "user",
    ref: "engram-cli",
    hash: sha256(contentText),
    actor: actor.id,
    ...(base.provenance as object | undefined),
    ...(values.source !== undefined ? { kind: values.source } : {}),
  };
  // Assembled as given; Plane.write validates it and denies under the schema rule if it is wrong.
  const item = {
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    ...base,
    id: values.id ?? base.id ?? newId(),
    class: values.class ?? base.class ?? "semantic",
    scope: values.scope ?? base.scope ?? (values.owner ? `person:${values.owner}` : actor.id),
    owner: base.owner ?? actor.id,
    content,
    provenance,
    confidence:
      values.confidence !== undefined ? Number(values.confidence) : (base.confidence ?? 0.9),
    valid_from: values["valid-from"] ?? base.valid_from ?? at,
    valid_to: values["valid-to"] ?? base.valid_to ?? null,
    store_ref: null,
    schema_version: 0,
  } as unknown as MemoryItem;

  const s = openSession(io, values);
  try {
    const { item: stored, event } = await s.plane.write(actor, item, at);
    if (values.json) io.out(`${JSON.stringify({ event, item: stored }, null, 2)}\n`);
    else io.out(`${[...decisionLines(event, stored), logHint(s.log)].join("\n")}\n`);
    return event.decision === "allow" ? 0 : 1;
  } finally {
    s.log.db.close();
  }
}

export async function explainCommand(args: string[], io: Io): Promise<number> {
  const { values, positionals } = parse(
    args,
    { db: STORE_OPTIONS.db, policy: STORE_OPTIONS.policy, json: STORE_OPTIONS.json },
    true,
  );
  const [readId, ...rest] = positionals;
  if (readId === undefined || rest.length > 0)
    throw new UsageError("give exactly one read id: engram explain <readId>");
  const log = openLog(values.db, io.cwd, true);
  try {
    const policy = loadPolicy(values.policy, io.cwd);
    const plane = createPlane({ db: log.db, adapter: NO_STORE, policy, newId });
    const explanations = await plane.explain(readId);
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
    log.db.close();
  }
}

type Status = "ok" | "fail" | "skip";
interface Check {
  status: Status;
  name: string;
  detail: string;
}

const firstLines = (e: unknown) => (e as Error).message.split("\n").join("; ");

export async function doctorCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(
    args,
    {
      db: STORE_OPTIONS.db,
      policy: STORE_OPTIONS.policy,
      root: STORE_OPTIONS.root,
      json: STORE_OPTIONS.json,
    },
    false,
  );
  const checks: Check[] = [];
  const check = (name: string, fn: () => [Status, string]) => {
    try {
      const [status, detail] = fn();
      checks.push({ status, name, detail });
    } catch (e) {
      checks.push({ status: "fail", name, detail: firstLines(e) });
    }
  };

  check("db", () => {
    const log = openLog(values.db, io.cwd);
    log.db.close();
    const state =
      log.applied.length > 0 ? `migrations ${log.applied.join(", ")} applied` : "up to date";
    return ["ok", `${log.path}: opens; ${state}`];
  });
  check("policy", () => {
    const p = loadPolicy(values.policy, io.cwd);
    return ["ok", `${p.id} v${p.version} loads and validates`];
  });
  check("store", () => {
    if (values.root === undefined) return ["skip", "no --root given"];
    const root = resolve(io.cwd, values.root);
    if (!statSync(root).isDirectory()) return ["fail", `${root} is not a folder`];
    accessSync(root, constants.R_OK);
    const files = readdirSync(root).filter(
      (f) => f.toLowerCase().endsWith(".md") && f.toLowerCase() !== "memory.md",
    );
    return ["ok", `${root} is readable; ${plural(files.length, "memory file")}`];
  });
  check("adapter files", () => ["ok", "opens a Claude Code memory folder (card A3)"]);
  check("adapter mem0", () => [
    "skip",
    "built (card A1); the CLI does not open it yet, it needs an embedding model wired at the surface",
  ]);
  check("adapter letta", () => ["skip", "not implemented yet (card A2)"]);
  check("provider keys", () => ["skip", "not checked yet (card E0.4)"]);
  check("benchmark pins", () => ["skip", "not checked yet (card B1)"]);

  const failed = checks.filter((c) => c.status === "fail").length;
  if (values.json) io.out(`${JSON.stringify({ checks, failed }, null, 2)}\n`);
  else {
    const lines = checks.map((c) => `${c.status.padEnd(5)}${c.name.padEnd(16)}${c.detail}`);
    lines.push(
      failed === 0 ? "doctor: all checks passed" : `doctor: ${plural(failed, "check")} failed`,
    );
    io.out(`${lines.join("\n")}\n`);
  }
  return failed === 0 ? 0 : 1;
}
