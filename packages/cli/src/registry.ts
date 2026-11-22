// The command registry (card E8.15a, docs/design/tui.md section 6.1): the one
// description of the CLI. Every command is one CommandSpec: its name, the
// line and the options block HELP prints, its group on the TUI's Home, its
// positionals, its flags (the parseArgs config its handler parses with, plus
// what a generated form needs), its exit codes, what it writes, and its
// handler. `run.ts` builds HELP and its command table from REGISTRY; the
// handlers parse with the option objects defined here; the TUI (cards
// E8.15b to E8.15e) builds its menus, palette, forms and parity test from it.
//
// Nothing here decides anything about policy (AGENTS.md rule 1): `writes`
// says what kind of change a command can make, so the TUI knows when to ask
// first (section 9.5); the plane still decides every call.
//
// The handlers are reached through a dynamic import, so this module imports
// no command module and the command modules may import their option objects
// from here without an import cycle.
import { ProvenanceKind, ScopeLevel } from "@engram/core";
import type { Io } from "./run.ts";

/** A flag's control in a generated form (docs/design/tui.md 3.2). */
export type Control = "text" | "scope" | "time" | "number" | "choice" | "file" | "list" | "toggle";

/**
 * One flag: the parseArgs option (`type`, `multiple`) the handler parses
 * with, plus what a form shows. parseArgs reads only `type`, `multiple`,
 * `short` and `default`, so the other fields ride along unread; this file
 * never sets `short` or `default`, which would change what the CLI parses.
 */
export interface OptionSpec {
  type: "string" | "boolean";
  multiple?: true;
  /** The form field's label, in the inspector's words where it has them. */
  label: string;
  /** One line on what the flag does, for the form's help and the palette. */
  help: string;
  control: Control;
  /** The values a choice offers; a choice may also take a path where its help says so. */
  choices?: readonly string[];
  /** The default as the CLI applies it, in words; absent when none. */
  defaultText?: string;
  /** Shown under "advanced" in a form. */
  advanced?: true;
  /** The card that added the flag, where it is recent enough to matter. */
  card?: string;
}

export interface PositionalSpec {
  name: string;
  label: string;
  required: boolean;
  /** Words joined by spaces, as read's query. */
  variadic?: true;
  /** Where a form offers values from: the session's last read, its reads, a scope, a file. */
  picker?: "item" | "read" | "scope" | "file";
}

/** Home's six groups, keys 1 to 6 (docs/design/tui.md 8.1). */
export const GROUPS = ["memory", "policy", "audit", "data", "surfaces", "machine"] as const;
export type Group = (typeof GROUPS)[number];

/**
 * What a command can change (docs/design/tui.md 9.5), which decides the
 * TUI's confirmation: none; audit, appending events only; state, writing or
 * changing items or a key; retire, retiring items for good; erase, a change
 * that cannot be taken back; file, a file outside the log; process, a
 * server that runs until stopped.
 */
export const WRITES = ["none", "audit", "state", "retire", "erase", "file", "process"] as const;
export type Writes = (typeof WRITES)[number];

/** Parsed flag values, a form's or a command line's. */
export type Values = Readonly<Record<string, string | boolean | readonly string[] | undefined>>;

export interface CommandSpec {
  /** The full name: "read", "hook claude-code", "key create". Its first word dispatches. */
  name: string;
  /** A plain-language title, as Home lists it. */
  title: string;
  /** The left column of HELP's commands list: "read [query]". */
  usage: string;
  /** The right column of HELP's commands list, verbatim. */
  summary: string;
  /** False when HELP's commands list shows this command on another entry's line. */
  listed: boolean;
  group: Group;
  positionals: PositionalSpec[];
  /** The flags a form for this command offers, each as the handler parses it (see OptionSpec). */
  options: Readonly<Record<string, OptionSpec>>;
  /**
   * The parseArgs config the handler parses with, when it is more than
   * `options`: the key subcommands parse as one, and read with --item.
   */
  parse?: Readonly<Record<string, OptionSpec>>;
  /** Whether the handler's parse allows positionals (the subcommand word counts as one). */
  allowPositionals: boolean;
  /** The "<name> options:" block of HELP, verbatim, without its trailing blank line; empty for none. */
  helpSection: readonly string[];
  /**
   * The HELP block this command's section follows, when not the one of the
   * command before it in the registry (who-can-read's follows lint's).
   */
  helpAfter?: string;
  /** Which shared HELP blocks name this command in their heading's list (store, actor, export). */
  listedIn: readonly SharedList[];
  exitCodes: readonly { code: number; when: string }[];
  /**
   * What the command can change, from the values a form or a command line
   * gives and the workspace's flags (`ws`); a read with a store folder
   * adopts it and may sweep, one without appends a read event only.
   */
  writes: (values: Values, ws: Values) => Writes;
  /** Runs the command on its arguments after the name's first word, as `run` does. */
  handler: (args: string[], io: Io) => Promise<number>;
  /** The card a command belongs to while that card is in flight. */
  card?: string;
}

/** The shared blocks of HELP whose heading lists the commands that take them. */
export type SharedList = "store" | "actor" | "export";

// The flags. One OptionSpec each, composed into each command's options below.

const flag = <O extends OptionSpec>(o: O) => o;

export const EXPORT_OPTIONS = {
  otlp: flag({
    type: "string",
    label: "Decision export: OTLP endpoint",
    help: "send each decision as an OpenTelemetry span to this OTLP/HTTP traces endpoint",
    control: "text",
    defaultText: "$ENGRAM_OTLP_URL, else none",
    advanced: true,
    card: "E8.13",
  }),
  "export-jsonl": flag({
    type: "string",
    label: "Decision export: JSON lines file",
    help: "append each decision as one JSON span a line to this file",
    control: "file",
    defaultText: "$ENGRAM_EXPORT_JSONL, else none",
    advanced: true,
    card: "E8.13",
  }),
};

const STORE_KIND = flag({
  type: "string",
  label: "Store kind",
  help: "the store adapter",
  control: "choice",
  choices: ["files", "letta"],
  defaultText: "files",
});
const ROOT = flag({
  type: "string",
  label: "Store folder",
  help: "a Claude Code memory folder (files), or a MemFS repository or an empty folder (letta)",
  control: "file",
});
const OWNER = flag({
  type: "string",
  label: "Owner",
  help: "the person whose folder it is; also the actor person:<id> when --as is absent",
  control: "text",
});
const IMPORT_VALID_FROM = flag({
  type: "string",
  label: "Imported valid from",
  help: "valid_from for imported memories",
  control: "time",
  defaultText: "each file's mtime",
  advanced: true,
});
const POLICY = flag({
  type: "string",
  label: "Policy",
  help: "a preset or a policy YAML file",
  control: "choice",
  choices: ["strict", "medium", "permissive"],
  defaultText: "medium",
});
const DB = flag({
  type: "string",
  label: "Event log",
  help: "a SQLite file, :memory: for none, or postgres://...",
  control: "file",
  defaultText: "$ENGRAM_DB_URL, else <home>/.engram/engram.db",
});
const JSON_OUT = flag({
  type: "boolean",
  label: "JSON output",
  help: "machine-readable output",
  control: "toggle",
});

export const STORE_OPTIONS = {
  ...EXPORT_OPTIONS,
  store: STORE_KIND,
  root: ROOT,
  owner: OWNER,
  "import-valid-from": IMPORT_VALID_FROM,
  policy: POLICY,
  db: DB,
  json: JSON_OUT,
};

const AS = flag({
  type: "string",
  label: "Acting as",
  help: "who acts: a principal such as person:dana",
  control: "text",
  defaultText: "person:<owner>",
});
const LEVEL = flag({
  type: "string",
  label: "Level",
  help: "the level the actor reads as",
  control: "choice",
  choices: ScopeLevel.options,
  defaultText: "the actor's own level",
});
const MEMBER = flag({
  type: "string",
  multiple: true,
  label: "Member of",
  help: "a scope the actor belongs to; repeatable",
  control: "list",
  defaultText: "the actor's own scope",
});

const AT = flag({
  type: "string",
  label: "At",
  help: "read: the time validity windows are judged at; elsewhere the call's clock, with --test-clock only",
  control: "time",
});

export const ACTOR_OPTIONS = {
  as: AS,
  level: LEVEL,
  member: MEMBER,
  at: { ...AT, advanced: true as const },
  // For tests and fixtures only: lets --at set the clock of an in-process
  // call that is not a read (review fix pass of PR #59, RV5-3).
  "test-clock": flag({
    type: "boolean",
    label: "Test clock",
    help: "for tests and fixtures only: --at sets the clock of an in-process call that is not a read",
    control: "toggle",
    advanced: true,
  }),
};

/** A server to call instead of the in-process app (or ENGRAM_SERVER_URL). */
export const CLIENT_OPTIONS = {
  server: flag({
    type: "string",
    label: "Connection: server",
    help: "call engram serve at this URL instead of the workspace in process",
    control: "text",
    defaultText: "$ENGRAM_SERVER_URL, else in process",
  }),
};

const SCOPE = (help: string) =>
  flag({ type: "string", label: "Scope", help, control: "scope" as const });

export const WRITE_OPTIONS = {
  content: flag({ type: "string", label: "Content", help: "the item's content", control: "text" }),
  file: flag({
    type: "string",
    label: "From file",
    help: "a JSON item; the flags and defaults fill the fields it leaves out",
    control: "file",
  }),
  id: flag({
    type: "string",
    label: "Id",
    help: "the item id, a UUIDv7",
    control: "text",
    defaultText: "a fresh UUIDv7",
    advanced: true,
  }),
  scope: flag({
    type: "string",
    label: "Scope",
    help: "the item's scope",
    control: "scope",
    defaultText: "the owner's person scope, else the actor",
  }),
  class: flag({
    type: "string",
    label: "Class",
    help: "the item's class",
    control: "choice",
    choices: ["episodic", "semantic"],
    defaultText: "semantic",
  }),
  confidence: flag({
    type: "string",
    label: "Confidence",
    help: "a number from 0 to 1",
    control: "number",
    defaultText: "0.9",
  }),
  "valid-from": flag({
    type: "string",
    label: "Valid from",
    help: "the start of the item's validity window",
    control: "time",
    defaultText: "now",
  }),
  "valid-to": flag({
    type: "string",
    label: "Valid to",
    help: "the end of the item's validity window",
    control: "time",
    defaultText: "open",
  }),
};

/** The credential flags of a served surface (ADR 0042), shared by serve, mcp and doctor. */
export const AUTH_OPTIONS = {
  "insecure-loopback": flag({
    type: "boolean",
    label: "Insecure loopback",
    help: "no authentication: loopback only, actors self-asserted",
    control: "toggle",
    card: "E8.12",
  }),
  keys: flag({
    type: "string",
    label: "Key file",
    help: "accept the API keys in this key file (engram key)",
    control: "file",
    card: "E8.12",
  }),
  issuer: flag({
    type: "string",
    label: "Token issuer",
    help: "accept JWT access tokens of this issuer",
    control: "text",
    card: "E8.12",
  }),
  jwks: flag({
    type: "string",
    label: "Issuer keys",
    help: "the issuer's keys, a URL or a file",
    control: "file",
    card: "E8.12",
  }),
  subjects: flag({
    type: "string",
    label: "Subjects file",
    help: "the actor each subject of the issuer acts as",
    control: "file",
    card: "E8.12",
  }),
  audience: flag({
    type: "string",
    label: "Audience",
    help: "the audience a token must carry",
    control: "text",
    defaultText: "the resource URL",
    advanced: true,
    card: "E8.12",
  }),
  resource: flag({
    type: "string",
    label: "Resource URL",
    help: "the server's public URL",
    control: "text",
    defaultText: "http://<host>:<port>",
    advanced: true,
    card: "E8.12",
  }),
};

const HOST = flag({
  type: "string",
  label: "Host",
  help: "127.0.0.1, ::1 or localhost; another host only with credentials and an https --resource",
  control: "text",
  defaultText: "127.0.0.1",
});

// A read's --at is its own field, the time validity windows are judged at.
const READ_OPTIONS = {
  ...STORE_OPTIONS,
  ...ACTOR_OPTIONS,
  at: { ...AT, label: "Judge validity windows at" },
  ...CLIENT_OPTIONS,
  item: flag({
    type: "string",
    label: "Item",
    help: "read one item by its id instead of a query",
    control: "text",
    card: "E8.15a",
  }),
};

const ITEM_ACTOR_OPTIONS = { ...STORE_OPTIONS, ...ACTOR_OPTIONS, ...CLIENT_OPTIONS };

/** The parse config of each command's handler (keyed by its first word for key and hook). */
export const OPTIONS = {
  read: READ_OPTIONS,
  write: { ...STORE_OPTIONS, ...ACTOR_OPTIONS, ...WRITE_OPTIONS, ...CLIENT_OPTIONS },
  check: { ...STORE_OPTIONS, ...ACTOR_OPTIONS, ...WRITE_OPTIONS, ...CLIENT_OPTIONS },
  promote: {
    ...ITEM_ACTOR_OPTIONS,
    to: flag({ type: "string", label: "To scope", help: "the target scope", control: "scope" }),
    review: flag({
      type: "boolean",
      label: "Approve as reviewer",
      help: "approve as a reviewer: a member of the target who does not own the item",
      control: "toggle",
    }),
  },
  supersede: {
    ...ITEM_ACTOR_OPTIONS,
    accept: flag({
      type: "string",
      multiple: true,
      label: "Accept the close of",
      help: "apply the proposed close of this ancestor, one write through the gate; repeatable",
      control: "list",
      card: "L6",
    }),
  },
  grants: {
    ...ITEM_ACTOR_OPTIONS,
    add: flag({
      type: "string",
      multiple: true,
      label: "Add a grant",
      help: "<to>[,class=<class>][,mode=read|read_write][,expires=<date or time>]; repeatable",
      control: "list",
      card: "E8.15a",
    }),
    remove: flag({
      type: "string",
      multiple: true,
      label: "Remove a grant",
      help: "a grant exactly as the item carries it, written as for --add; repeatable",
      control: "list",
      card: "E8.15a",
    }),
  },
  explain: {
    db: DB,
    policy: POLICY,
    json: JSON_OUT,
    owner: { ...OWNER, help: "names the actor person:<id> when --as is absent" },
    as: AS,
    level: LEVEL,
    member: MEMBER,
    ...CLIENT_OPTIONS,
  },
  events: {
    db: DB,
    policy: POLICY,
    json: JSON_OUT,
    owner: { ...OWNER, help: "names the actor person:<id> when --as is absent" },
    as: AS,
    level: LEVEL,
    member: MEMBER,
    after: flag({
      type: "string",
      label: "After seq",
      help: "only the events with a seq above this one",
      control: "number",
      defaultText: "every event",
      card: "E8.15a",
    }),
    ...CLIENT_OPTIONS,
  },
  retain: {
    ...ITEM_ACTOR_OPTIONS,
    scope: SCOPE("the scope to sweep, as a user-sourced member of it"),
  },
  lint: {
    ...ITEM_ACTOR_OPTIONS,
    scope: SCOPE("the scope to lint, as a member of it"),
  },
  simulate: {
    db: DB,
    policy: {
      ...POLICY,
      label: "Baseline policy",
      help: "the baseline: a preset or a policy file",
    },
    json: JSON_OUT,
    workload: flag({
      type: "string",
      label: "Workload",
      help: "a recorded workload: {id, actors, steps}",
      control: "file",
      defaultText: "empty",
    }),
    candidate: flag({
      type: "string",
      label: "Candidate",
      help: "the policy to compare with: a preset or a policy file",
      control: "choice",
      choices: ["strict", "medium", "permissive"],
      defaultText: "the baseline",
    }),
    ...CLIENT_OPTIONS,
  },
  policy: {
    policy: POLICY,
    json: JSON_OUT,
    ...CLIENT_OPTIONS,
  },
  scopes: {
    ...STORE_OPTIONS,
    as: AS,
    level: LEVEL,
    member: MEMBER,
    ...CLIENT_OPTIONS,
  },
  "who-can-read": {
    ...ITEM_ACTOR_OPTIONS,
    scope: SCOPE("a scope, asked about by the read matrix, instead of an item"),
  },
  serve: {
    ...STORE_OPTIONS,
    ...AUTH_OPTIONS,
    host: HOST,
    port: flag({
      type: "string",
      label: "Port",
      help: "the port to listen on",
      control: "number",
      defaultText: "7313",
    }),
    as: { ...AS, label: "Viewer", help: "the viewer the inspector shows", defaultText: "none" },
    level: LEVEL,
    member: MEMBER,
  },
  mcp: {
    ...STORE_OPTIONS,
    as: { ...AS, help: "the one actor every tool call is made as, with source model" },
    level: LEVEL,
    member: MEMBER,
    ...CLIENT_OPTIONS,
    ...AUTH_OPTIONS,
    http: flag({
      type: "string",
      label: "Transport: HTTP port",
      help: "serve streamable HTTP on 127.0.0.1:<port> instead of stdio",
      control: "number",
      defaultText: "stdio",
    }),
    supersede: flag({
      type: "boolean",
      label: "Offer memory_supersede",
      help: "also list the memory_supersede tool (off by default)",
      control: "toggle",
      card: "L6",
    }),
  },
  hook: {
    db: DB,
    policy: POLICY,
    root: {
      ...ROOT,
      multiple: true as const,
      label: "Store roots",
      help: "a store root file tools may not touch; repeatable",
      control: "list" as const,
    },
    protect: flag({
      type: "string",
      multiple: true,
      label: "Protected files",
      help: "a file no tool may touch, with its -wal, -shm and -journal files; repeatable",
      control: "list",
    }),
    as: {
      ...AS,
      help: "who the block events are recorded as",
      defaultText: "agent:claude-code",
    },
    ...EXPORT_OPTIONS,
    ...CLIENT_OPTIONS,
  },
  key: {
    keys: { ...AUTH_OPTIONS.keys, help: "the key file" },
    as: flag({ type: "string", label: "Acting as", help: "the key's actor", control: "text" }),
    level: LEVEL,
    member: MEMBER,
    source: flag({
      type: "string",
      label: "Source",
      help: "the provenance of what the key writes",
      control: "choice",
      choices: ProvenanceKind.options,
      card: "E8.12",
    }),
    expires: flag({
      type: "string",
      label: "Expires",
      help: "when the key stops being accepted",
      control: "time",
      card: "E8.12",
    }),
    json: JSON_OUT,
  },
  "log verify": {
    db: { ...DB, help: "the event log; read only, nothing is migrated" },
    key: flag({
      type: "string",
      label: "Public key",
      help: "the operator's Ed25519 public key (PEM), pinned: a checkpoint signed under any other fails",
      control: "file",
      card: "E1.6",
    }),
    checkpoint: flag({
      type: "string",
      multiple: true,
      label: "Held checkpoints",
      help: "a checkpoint kept outside the log; repeatable; the log must extend it",
      control: "list",
      card: "E1.6",
    }),
    json: JSON_OUT,
  },
  "log checkpoint": {
    db: { ...DB, help: "the event log; it must exist" },
    key: flag({
      type: "string",
      label: "Private key",
      help: "the operator's Ed25519 private key (PEM); without it the checkpoint is unsigned",
      control: "file",
      card: "E1.6",
    }),
    checkpoint: flag({
      type: "string",
      multiple: true,
      label: "Held checkpoints",
      help: "a checkpoint kept outside the log; repeatable; the log must extend it",
      control: "list",
      card: "E1.6",
    }),
    out: flag({
      type: "string",
      label: "Write it to",
      help: "also write the checkpoint to this file, to keep outside the log",
      control: "file",
      card: "E1.6",
    }),
    json: JSON_OUT,
  },
  doctor: {
    db: { ...DB, help: "the event log to check; doctor never creates one" },
    policy: { ...POLICY, help: "the policy to load and validate" },
    root: {
      ...ROOT,
      help: "a store folder: readable, and its memories adopted on an in-memory log",
    },
    json: JSON_OUT,
    host: { ...HOST, help: "the host engram serve would bind", card: "E8.12" },
    ...AUTH_OPTIONS,
  },
} satisfies Record<string, Record<string, OptionSpec>>;

/** The subset of `options` named, in that order. */
const pick = <O extends Record<string, OptionSpec>, K extends keyof O & string>(
  o: O,
  keys: readonly K[],
): Pick<O, K> => Object.fromEntries(keys.map((k) => [k, o[k]])) as Pick<O, K>;

/** The options without the keys named. */
const omit = <O extends Record<string, OptionSpec>, K extends keyof O & string>(
  o: O,
  keys: readonly K[],
): Omit<O, K> =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k as K))) as Omit<O, K>;

const handler =
  (load: () => Promise<(args: string[], io: Io) => Promise<number>>) =>
  async (args: string[], io: Io) =>
    (await load())(args, io);

// One handler per first word, so the specs that share a word share it.
const H = {
  read: handler(async () => (await import("./commands.ts")).readCommand),
  write: handler(async () => (await import("./commands.ts")).writeCommand),
  check: handler(async () => (await import("./commands.ts")).checkCommand),
  promote: handler(async () => (await import("./commands.ts")).promoteCommand),
  supersede: handler(async () => (await import("./commands.ts")).supersedeCommand),
  grants: handler(async () => (await import("./commands.ts")).grantsCommand),
  explain: handler(async () => (await import("./commands.ts")).explainCommand),
  events: handler(async () => (await import("./commands.ts")).eventsCommand),
  retain: handler(async () => (await import("./commands.ts")).retainCommand),
  lint: handler(async () => (await import("./commands.ts")).lintCommand),
  simulate: handler(async () => (await import("./commands.ts")).simulateCommand),
  policy: handler(async () => (await import("./commands.ts")).policyCommand),
  scopes: handler(async () => (await import("./commands.ts")).scopesCommand),
  whoCanRead: handler(async () => (await import("./commands.ts")).whoCanReadCommand),
  serve: handler(async () => (await import("./serve.ts")).serveCommand),
  mcp: handler(async () => (await import("./mcp.ts")).mcpCommand),
  hook: handler(async () => (await import("./hook.ts")).hookCommand),
  key: handler(async () => (await import("./key.ts")).keyCommand),
  doctor: handler(async () => (await import("./doctor.ts")).doctorCommand),
  log: handler(async () => (await import("./log.ts")).logCommand),
};

/** Whether a store folder or a server is named, by the form or the workspace. */
const touchesStore = (v: Values, ws: Values) =>
  [v.root, v.store, v.server, ws.root, ws.store, ws.server].some((x) => x !== undefined);

const PLANE_EXITS = {
  usage: { code: 2, when: "usage: a bad flag or argument, or a 501 naming a card" },
  error: { code: 1, when: "an error: a log it cannot use, a server that does not answer" },
};

const ITEM: PositionalSpec = { name: "itemId", label: "Item", required: true, picker: "item" };

/**
 * Every command, in the order of HELP's commands list. A command a later
 * card adds is one more entry here, and its handler in H.
 */
export const REGISTRY: readonly CommandSpec[] = [
  {
    name: "read",
    title: "Read and explain",
    usage: "read [query]",
    summary: "read through the plane and explain every returned item",
    listed: true,
    group: "memory",
    positionals: [{ name: "query", label: "Query", required: false, variadic: true }],
    options: omit(OPTIONS.read, ["item"]),
    parse: OPTIONS.read,
    allowPositionals: true,
    helpSection: [],
    listedIn: ["store", "actor", "export"],
    exitCodes: [{ code: 0, when: "done" }, PLANE_EXITS.error, PLANE_EXITS.usage],
    // With a store folder the read adopts it, and as its owner first sweeps
    // the owner's retention (docs/design/tui.md 8.5); a server may have one.
    writes: (v, ws) => (touchesStore(v, ws) ? "state" : "audit"),
    handler: H.read,
  },
  {
    // The name's words and the positional make the command line: read --item <id>.
    name: "read --item",
    title: "Read one item",
    usage: "read --item <id>",
    summary: "read one item by its id and explain it, if the actor may read it",
    listed: true,
    group: "memory",
    positionals: [ITEM],
    options: omit(OPTIONS.read, ["item"]),
    parse: OPTIONS.read,
    allowPositionals: true,
    helpSection: [
      "read --item options:",
      "  --item <id>                 one item by its id instead of a query (card E8.14's route):",
      "                              the item and its explanation if the actor may read it,",
      "                              nothing otherwise; one read event, after the same sweep and",
      "                              adoption as a read, with read's options and output",
    ],
    listedIn: [],
    exitCodes: [{ code: 0, when: "done" }, PLANE_EXITS.error, PLANE_EXITS.usage],
    writes: (v, ws) => (touchesStore(v, ws) ? "state" : "audit"),
    handler: H.read,
  },
  {
    name: "write",
    title: "Write a memory",
    usage: "write",
    summary: "write one item through the plane's write gate",
    listed: true,
    group: "memory",
    positionals: [],
    options: OPTIONS.write,
    allowPositionals: false,
    helpSection: [
      "write options:",
      "  --content <text>            the item's content",
      "  --file <item.json>          a JSON item; the flags and defaults fill the fields it leaves out",
      "  --id <uuidv7>  --scope <scope>  --class <episodic|semantic>",
      "  --confidence <0..1>  --valid-from <iso>  --valid-to <iso>",
      "  the plane records a write as source user by the acting principal, whatever the item claims",
    ],
    listedIn: ["store", "actor", "export"],
    exitCodes: [
      { code: 0, when: "allow" },
      { code: 1, when: "deny, ask or an error" },
      PLANE_EXITS.usage,
    ],
    writes: () => "state",
    handler: H.write,
  },
  {
    name: "check",
    title: "Check a write",
    usage: "check",
    summary: "the decision a write would get now: nothing stored, no event",
    listed: true,
    group: "memory",
    positionals: [],
    options: OPTIONS.check,
    allowPositionals: false,
    helpSection: [
      "check options:",
      "  the write, store and actor options above: the decision engram write would get with",
      "  the same flags now, from the same gate; nothing is stored and no event is appended;",
      "  the write is decided again when it is made. exit 1 on deny or ask",
    ],
    listedIn: [],
    exitCodes: [
      { code: 0, when: "the write would be allowed" },
      { code: 1, when: "it would be denied or asked, or an error" },
      PLANE_EXITS.usage,
    ],
    writes: () => "none",
    handler: H.check,
  },
  {
    name: "promote",
    title: "Promote an item",
    usage: "promote <itemId>",
    summary: "promote an item through the plane's promotion gate",
    listed: true,
    group: "memory",
    positionals: [ITEM],
    options: OPTIONS.promote,
    allowPositionals: true,
    helpSection: [
      "promote options:",
      "  --to <scope>                the target scope: the item's own or a wider one",
      "  --review                    approve as a reviewer: a member of the target who does not own the item",
      "  the plane records the promoter as source user; exit 1 on deny, or on ask when the target needs review",
      "  limit: the CLI does not authenticate. --as and --member are taken as given, so the",
      "  distinct-actor and reviewer rules hold only as far as this single-user machine does;",
      "  a promotion with --review is only as trustworthy as the machine it ran on",
    ],
    listedIn: ["store", "actor", "export"],
    exitCodes: [
      { code: 0, when: "allow" },
      { code: 1, when: "deny, ask or an error" },
      PLANE_EXITS.usage,
    ],
    writes: () => "state",
    handler: H.promote,
  },
  {
    name: "supersede",
    title: "Supersede",
    usage: "supersede <itemId>",
    summary: "propose end dates for the versions an item supersedes; apply accepted ones",
    listed: true,
    group: "memory",
    positionals: [ITEM],
    options: OPTIONS.supersede,
    allowPositionals: true,
    helpSection: [
      "supersede options:",
      "  --accept <id>               apply the proposed close of this ancestor: one write of a new",
      "                              version through the write gate; repeatable. Without it, the plan only",
      "  the plan names the head of the item's chain and, for each ancestor the actor may read, a",
      "  close (valid_to set to the item's valid_from) or a review flag; nothing is retired, and an",
      "  id with no proposed close refuses the call before anything is written; exit 1 on an",
      "  unresolved chain or a write the gate did not allow",
    ],
    listedIn: ["store", "actor"],
    exitCodes: [
      { code: 0, when: "the chain resolves and every accepted close was allowed" },
      { code: 1, when: "an unresolved chain, a write the gate did not allow, or an error" },
      PLANE_EXITS.usage,
    ],
    // The plan alone writes nothing; each --accept is a write through the gate.
    writes: (v) => (Array.isArray(v.accept) && v.accept.length > 0 ? "state" : "none"),
    handler: H.supersede,
  },
  {
    name: "grants",
    title: "Grants on an item",
    usage: "grants <itemId>",
    summary: "add or remove grants on an item, as its owner",
    listed: true,
    group: "memory",
    positionals: [ITEM],
    options: OPTIONS.grants,
    allowPositionals: true,
    helpSection: [
      "grants options:",
      "  <itemId>                    the item; only its owner, user-sourced, may change its grants",
      "  --add <to>[,class=<class>][,mode=<mode>][,expires=<iso>]",
      "                              add a grant: who it is for (person:sam, agent:claude-code/*),",
      "                              the class it covers, read or read_write (default read), and",
      "                              when it expires, a UTC date or time; repeatable",
      "  --remove <grant>            remove a grant, written as for --add, exactly as the item",
      "                              carries it; repeatable",
      "  with the store and actor options above; one governed change, decided by the plane",
      "  and recorded as one event; exit 1 on deny",
    ],
    listedIn: [],
    exitCodes: [
      { code: 0, when: "allow" },
      { code: 1, when: "deny or an error" },
      PLANE_EXITS.usage,
    ],
    writes: () => "state",
    handler: H.grants,
  },
  {
    name: "explain",
    title: "Explain a read",
    usage: "explain <readId>",
    summary: "the explanations a read recorded",
    listed: true,
    group: "memory",
    positionals: [{ name: "readId", label: "Read", required: true, picker: "read" }],
    options: OPTIONS.explain,
    allowPositionals: true,
    helpSection: [
      "explain options:",
      "  --db <path|url>  --policy <preset|path>  and --as or --owner: only the reader may explain a read",
    ],
    listedIn: ["actor"],
    exitCodes: [
      { code: 0, when: "explained" },
      { code: 1, when: "another reader's read, an unknown read or an error" },
      PLANE_EXITS.usage,
    ],
    writes: () => "none",
    handler: H.explain,
  },
  {
    name: "events",
    title: "Events",
    usage: "events",
    summary: "the events the actor may see, each with its decision, rule and reason",
    listed: true,
    group: "audit",
    positionals: [],
    options: OPTIONS.events,
    allowPositionals: false,
    helpSection: [
      "events options:",
      "  --after <seq>               only the events with a seq above this one (default every event)",
      "  with --db, --policy and --as or --owner: the events naming a scope the actor may read",
      "  as a member, and those it made that name no scope; an item is shown only as a read",
      "  would return it. The log must exist; nothing is appended",
    ],
    listedIn: [],
    exitCodes: [{ code: 0, when: "listed" }, PLANE_EXITS.error, PLANE_EXITS.usage],
    writes: () => "none",
    handler: H.events,
  },
  {
    name: "retain",
    title: "Retention sweep",
    usage: "retain",
    summary: "sweep one scope's retention: expired items retired, budgets enforced",
    listed: true,
    group: "policy",
    positionals: [],
    options: OPTIONS.retain,
    allowPositionals: false,
    helpSection: [
      "retain options:",
      "  --scope <scope>             the scope to sweep, as a user-sourced member of it; exit 1 if refused",
    ],
    listedIn: ["store", "actor", "export"],
    exitCodes: [
      { code: 0, when: "the sweep ran" },
      { code: 1, when: "refused, or an error" },
      PLANE_EXITS.usage,
    ],
    writes: () => "retire",
    handler: H.retain,
  },
  {
    name: "lint",
    title: "Lint a scope",
    usage: "lint",
    summary: "run the policy's deterministic lints over a scope, each finding with its reason",
    listed: true,
    group: "policy",
    positionals: [],
    options: OPTIONS.lint,
    allowPositionals: false,
    helpSection: [
      "lint options:",
      "  --scope <scope>             the scope to lint, as a member of it; exit 1 on a finding or if refused",
    ],
    listedIn: ["store", "actor", "export"],
    exitCodes: [
      { code: 0, when: "clean" },
      { code: 1, when: "a finding, refused, or an error" },
      PLANE_EXITS.usage,
    ],
    writes: () => "audit",
    handler: H.lint,
  },
  {
    name: "simulate",
    title: "Simulate a policy",
    usage: "simulate",
    summary: "replay a recorded workload under the policy and a candidate; compare them",
    listed: true,
    group: "policy",
    positionals: [],
    options: OPTIONS.simulate,
    allowPositionals: false,
    helpSection: [
      "simulate options:",
      "  --workload <workload.json>  a recorded workload: {id, actors, steps} (default empty)",
      "  --policy <preset|path>      the baseline policy (default medium)",
      "  --candidate <preset|path>   the policy to compare it with (default the baseline)",
      "  each policy replays the workload on a scratch log and store; the real log and store are",
      "  never read or written, and no model is called",
    ],
    listedIn: [],
    exitCodes: [
      { code: 0, when: "compared" },
      { code: 1, when: "a workload the plane rejects, or an error" },
      { code: 2, when: "usage, including a workload file that is not JSON" },
    ],
    writes: () => "none",
    handler: H.simulate,
  },
  {
    name: "policy",
    title: "Policy in force",
    usage: "policy",
    summary: "the policy the workspace decides with, and its label",
    listed: true,
    group: "policy",
    positionals: [],
    options: OPTIONS.policy,
    allowPositionals: false,
    helpSection: [
      "policy options:",
      "  --policy <preset|path>      the policy to show (default medium), or --server <url>: its own",
      "  printed as YAML a policy file may hold, under a comment naming it; --json for JSON.",
      "  No actor is needed and the log is not opened",
    ],
    listedIn: [],
    exitCodes: [{ code: 0, when: "shown" }, PLANE_EXITS.error, PLANE_EXITS.usage],
    writes: () => "none",
    handler: H.policy,
  },
  {
    name: "who-can-read",
    title: "Who can read",
    usage: "who-can-read",
    summary: "who can read an item or a scope, each reader with the rule or grant admitting it",
    listed: true,
    group: "memory",
    positionals: [{ ...ITEM, required: false }],
    options: OPTIONS["who-can-read"],
    allowPositionals: true,
    helpSection: [
      "who-can-read options:",
      "  <itemId>                    the item asked about, or",
      "  --scope <scope>             a scope, by the read matrix; answered only for one who may read",
      "                              the item or the scope, grant holders named to the owner only;",
      "                              exit 1 if refused",
    ],
    helpAfter: "lint",
    listedIn: ["store", "actor"],
    exitCodes: [
      { code: 0, when: "answered" },
      { code: 1, when: "refused, or an error" },
      { code: 2, when: "usage, including an id that is not a UUIDv7" },
    ],
    writes: () => "none",
    handler: H.whoCanRead,
  },
  {
    name: "scopes",
    title: "Scopes you can see",
    usage: "scopes",
    summary: "the scopes the actor can see, by membership or through a grant",
    listed: true,
    group: "memory",
    positionals: [],
    options: OPTIONS.scopes,
    allowPositionals: false,
    helpSection: [
      "scopes options:",
      "  with the store options above and --as, --level and --member: the member scopes the",
      "  read matrix lets the actor's level read, and the scope of each item a read would admit",
      "  through a live grant (card E8.14's route). It is a read: one read event, and with a",
      "  store folder the same sweep and adoption as engram read first",
    ],
    helpAfter: "who-can-read",
    listedIn: [],
    exitCodes: [{ code: 0, when: "listed" }, PLANE_EXITS.error, PLANE_EXITS.usage],
    writes: (v, ws) => (touchesStore(v, ws) ? "state" : "audit"),
    handler: H.scopes,
  },
  {
    name: "serve",
    title: "Serve the API and inspector",
    usage: "serve",
    summary: "serve the HTTP API to authenticated callers, or on loopback with --insecure-loopback",
    listed: true,
    group: "surfaces",
    positionals: [],
    options: OPTIONS.serve,
    allowPositionals: false,
    helpSection: [
      "serve options:",
      "  --keys <file>               accept the API keys in this key file (engram key)",
      "  --issuer <url>              accept JWT access tokens of this issuer, with:",
      "  --jwks <url|file>             the issuer's keys",
      "  --subjects <file>             the actor each subject of the issuer acts as",
      "  --audience <aud>              the audience a token must carry (default the resource URL)",
      "  --resource <url>            the server's public URL (default http://<host>:<port>)",
      "  --insecure-loopback         no authentication: loopback only, actors self-asserted;",
      "                              without it or a credential flag the server refuses to start",
      "  --host <address>            127.0.0.1 (default), ::1 or localhost; another host only with",
      "                              credentials and an https --resource (a TLS proxy in front)",
      "  --port <n>                  the port (default 7313)",
      "  --as <principal>  --member <scope>  the viewer the inspector shows (default none)",
      "  the workspace flags above; runs until stopped",
    ],
    listedIn: ["store", "export"],
    exitCodes: [
      { code: 0, when: "stopped" },
      { code: 1, when: "an error" },
      { code: 2, when: "usage, including a bind without authentication" },
    ],
    writes: () => "process",
    handler: H.serve,
  },
  {
    name: "mcp",
    title: "MCP server",
    usage: "mcp",
    summary: "the MCP server for Claude Code and Codex, as one fixed actor",
    listed: true,
    group: "surfaces",
    positionals: [],
    options: OPTIONS.mcp,
    allowPositionals: false,
    helpSection: [
      "mcp options:",
      "  --as <principal>            the one actor every tool call is made as, with source model",
      "  --member <scope>            a scope that actor belongs to; repeatable",
      "  --level <level>             the level it reads as (default its own)",
      "  --http <port>               serve streamable HTTP on 127.0.0.1:<port> instead of stdio;",
      "                              it takes serve's credential flags, and then each session is",
      "                              the actor its credential names (no --as), or --insecure-loopback",
      "  --supersede                 also list memory_supersede: the supersession plan, and each close",
      "                              the agent accepts written through the gate as source model (off by default)",
      "  --server <url> or the workspace flags above, as for the other commands",
    ],
    listedIn: ["store", "export"],
    exitCodes: [
      { code: 0, when: "stopped" },
      { code: 1, when: "an error: a log it cannot use, a port in use" },
      PLANE_EXITS.usage,
    ],
    writes: () => "process",
    handler: H.mcp,
  },
  {
    name: "hook claude-code",
    title: "Claude Code hook setup",
    usage: "hook claude-code",
    summary: "a Claude Code PreToolUse hook that blocks store bypasses",
    listed: true,
    group: "surfaces",
    positionals: [],
    options: OPTIONS.hook,
    allowPositionals: true,
    helpSection: [
      "hook claude-code options:",
      "  --root <folder>             a store root file tools may not touch; repeatable",
      "  --as <principal>            who the block events are recorded as (default agent:claude-code)",
      "  --protect <file>            a file no tool may touch, with its -wal, -shm and -journal files;",
      "                              repeatable; with --server, name the log engram serve writes",
      "  --server <url> or --db and --policy, as for the other commands",
      "  reads the hook's JSON on stdin; a block answers permissionDecision deny with the reason",
    ],
    listedIn: ["export"],
    exitCodes: [
      { code: 0, when: "always once its flags parse: the decision is in the JSON" },
      PLANE_EXITS.usage,
    ],
    writes: () => "audit",
    handler: H.hook,
  },
  {
    name: "key create",
    title: "Create a key",
    usage: "key",
    summary: "create, list or revoke the local API keys a server accepts",
    listed: true,
    group: "surfaces",
    positionals: [],
    options: pick(OPTIONS.key, ["keys", "as", "level", "member", "source", "expires", "json"]),
    parse: OPTIONS.key,
    allowPositionals: true,
    helpSection: [
      "key options:",
      "  create --keys <file> --as <principal> --source <kind> --expires <iso>  [--level] [--member]...",
      "                              a key for that actor, printed once; the file holds its hash",
      "  list --keys <file>          every key, masked, with its actor, expiry and status",
      "  revoke <id> --keys <file>   a key never accepted again",
    ],
    listedIn: [],
    exitCodes: [{ code: 0, when: "created" }, PLANE_EXITS.error, PLANE_EXITS.usage],
    writes: () => "state",
    handler: H.key,
  },
  {
    name: "key list",
    title: "List keys",
    usage: "key list",
    summary: "every key, masked, with its actor, expiry and status",
    listed: false,
    group: "surfaces",
    positionals: [],
    options: pick(OPTIONS.key, ["keys", "json"]),
    parse: OPTIONS.key,
    allowPositionals: true,
    helpSection: [],
    listedIn: [],
    exitCodes: [{ code: 0, when: "listed" }, PLANE_EXITS.error, PLANE_EXITS.usage],
    writes: () => "none",
    handler: H.key,
  },
  {
    name: "key revoke",
    title: "Revoke a key",
    usage: "key revoke <id>",
    summary: "a key never accepted again",
    listed: false,
    group: "surfaces",
    positionals: [{ name: "id", label: "Key id", required: true }],
    options: pick(OPTIONS.key, ["keys"]),
    parse: OPTIONS.key,
    allowPositionals: true,
    helpSection: [],
    listedIn: [],
    exitCodes: [{ code: 0, when: "revoked" }, PLANE_EXITS.error, PLANE_EXITS.usage],
    writes: () => "erase",
    handler: H.key,
  },
  {
    name: "doctor",
    title: "Doctor",
    usage: "doctor",
    summary: "check the log, policy, store, adapters, provider keys, pins and Node",
    listed: true,
    group: "machine",
    positionals: [],
    options: OPTIONS.doctor,
    allowPositionals: false,
    helpSection: [
      "doctor options:",
      "  --db <path|url>             the event log to check (default as above); doctor never creates one",
      "  --policy <preset|path>      the policy to load and validate",
      "  --root <folder>             a store folder: readable, and its memories adopted through the plane",
      "                              on an in-memory log (counts only)",
      "  --host and serve's credential flags: the bind engram serve would make; fails without",
      "                              authentication, and beyond loopback without credentials",
    ],
    listedIn: [],
    exitCodes: [
      { code: 0, when: "every check passed" },
      { code: 1, when: "a check failed" },
      PLANE_EXITS.usage,
    ],
    writes: () => "none",
    handler: H.doctor,
  },
  {
    name: "log verify",
    title: "Verify the log",
    usage: "log verify",
    summary: "verify the event log's hash chain: the first broken link, or OK or UNSIGNED",
    listed: true,
    group: "audit",
    positionals: [],
    options: OPTIONS["log verify"],
    allowPositionals: false,
    helpSection: [
      "log verify options (on this machine only; never --server):",
      "  --db <path|url>             the event log (default as above); read only, nothing is migrated",
      "  --key <public.pem>          the operator's Ed25519 public key, pinned: a checkpoint signed",
      "                              under any other key fails; without it the verdict is at best UNSIGNED",
      "  --checkpoint <file>         a checkpoint kept outside the log (log checkpoint --out);",
      "                              repeatable; the log must extend it",
      "  exit 0 OK: every check holds and a signed checkpoint, verified under the pinned key,",
      "    covers the whole chain",
      "  exit 1 FAILED: a check failed; the first broken link is named",
      "  exit 3 UNSIGNED: every check holds, but part of the chain is vouched for by no signature:",
      "    no checkpoint, no --key, no signed checkpoint, or entries after the latest signed one",
      "  limit: without a checkpoint held outside the database, anyone with database access can",
      "  cut the tail or rewrite the whole chain undetected; the verdict is then UNSIGNED, never OK",
    ],
    helpAfter: "hook claude-code",
    listedIn: [],
    exitCodes: [
      { code: 0, when: "OK: a signed checkpoint under the pinned key covers the whole chain" },
      { code: 1, when: "FAILED: a check failed; the first broken link is named" },
      PLANE_EXITS.usage,
      { code: 3, when: "UNSIGNED: every check holds, but part of the chain has no signature" },
    ],
    writes: () => "none",
    handler: H.log,
  },
  {
    name: "log checkpoint",
    title: "Checkpoint the log",
    usage: "log checkpoint",
    summary: "record a checkpoint of the chain's head, signed with --key when given",
    listed: true,
    group: "audit",
    positionals: [],
    options: OPTIONS["log checkpoint"],
    allowPositionals: false,
    helpSection: [
      "log checkpoint options:",
      "  --db <path|url>             the event log (default as above); it must exist",
      "  --key <private.pem>         the operator's Ed25519 private key; without it the checkpoint is unsigned",
      "  --checkpoint <file>         a checkpoint kept outside the log; repeatable; the log must extend it",
      "  --out <file>                also write the checkpoint there, to keep outside the log",
      "  nothing is signed unless the whole log verifies first, every earlier signature under",
      "  this --key and every --checkpoint given; the key is the operator's to hold, and a",
      "  signature proves only that its holder saw that head",
    ],
    helpAfter: "log verify",
    listedIn: [],
    exitCodes: [
      { code: 0, when: "recorded" },
      { code: 1, when: "the log does not verify, or an error" },
      PLANE_EXITS.usage,
    ],
    writes: () => "state",
    handler: H.log,
  },
];

// HELP (docs/design/tui.md 12.2): the first line names engram tui; every
// other line is the text main printed before the registry, with the lines of
// the commands added since.

export const HELP_FIRST_LINE =
  "engram: the Engram control plane from the command line; engram tui opens the terminal interface";

/** The shared blocks of HELP, around the commands' own sections. */
const SHARED: Record<string, (specs: readonly CommandSpec[]) => readonly string[]> = {
  client: () => [
    "every command but doctor, serve, mcp, hook, key and log is one call to the HTTP API: in process",
    "over the workspace its flags name, or to a running server:",
    "  --server <url>              call engram serve at <url> (default $ENGRAM_SERVER_URL);",
    "                              the server's own flags then name the log, policy and store;",
    "                              $ENGRAM_TOKEN, when set, is sent as the bearer credential",
  ],
  store: (specs) => [
    `store options (${listing(specs, "store")}):`,
    "  --store <name>              the store adapter: files or letta (default files)",
    "  --root <folder>             the store folder: a Claude Code memory folder (files),",
    "                              or a MemFS repository or an empty folder (letta)",
    "  --owner <id>                the person whose folder it is; its memories are adopted as person:<id>",
    "  --import-valid-from <iso>   valid_from for imported memories (default each file's mtime)",
    "  --policy <preset|path>      strict, medium, permissive or a policy YAML file (default medium)",
    "  --db <path|url>             the event log: a SQLite file, :memory: for none, or postgres://...",
    "                              (default $ENGRAM_DB_URL, else <home>/.engram/engram.db)",
  ],
  actor: (specs) => [
    `actor options (${listing(specs, "actor")}):`,
    "  --as <principal>            who acts (default person:<owner>)",
    "  --level <level>             person, role, team or org (default the actor's own level)",
    "  --member <scope>            a scope the actor belongs to; repeatable (default the actor's scope)",
    "  --at <iso time>             read: the time validity windows are judged at; the read and",
    "                              the owner's sweep run at the server's clock. Any other",
    "                              command: refused, unless --test-clock is given in process",
    "  --test-clock                for tests and fixtures only: --at sets the clock of an",
    "                              in-process call that is not a read (refused with --server)",
  ],
  export: (specs) => [
    `export options (${listing(specs, "export")}):`,
    "  --otlp <url>                send each decision as an OpenTelemetry span to this OTLP/HTTP",
    "                              traces endpoint (default $ENGRAM_OTLP_URL; none if unset)",
    "  --export-jsonl <file>       append each decision as one JSON span a line to <file>",
    "                              (default $ENGRAM_EXPORT_JSONL; none if unset)",
    "  off unless named; OTEL_* variables never turn it on. A span carries the decision, its",
    "  rule, the actor, scopes and ids, never the memory's content (ADR 0043). In process",
    "  only: with --server, give them to engram serve",
  ],
  output: () => [
    "output:",
    "  --json                      machine-readable output",
    "  -h, --help                  this text",
  ],
};

/** The shared blocks before the commands' sections, and after them. */
const SHARED_BEFORE = ["client", "store", "actor"] as const;
const SHARED_AFTER = ["export", "output"] as const;

const listing = (specs: readonly CommandSpec[], list: SharedList) =>
  specs
    .filter((s) => s.listedIn.includes(list))
    .map((s) => s.name)
    .join(", ");

/**
 * The commands' sections in HELP's order: the registry's, except that a
 * section with `helpAfter` follows the block it names (moved in registry
 * order, so a chain of them keeps its order).
 */
export function sectionOrder(specs: readonly CommandSpec[]): string[] {
  const order = specs.filter((s) => s.helpSection.length > 0).map((s) => s.name);
  for (const s of specs) {
    if (s.helpAfter === undefined || s.helpSection.length === 0) continue;
    order.splice(order.indexOf(s.name), 1);
    const anchor = order.indexOf(s.helpAfter);
    if (anchor < 0) throw new Error(`${s.name}: helpAfter ${s.helpAfter} names no section`);
    order.splice(anchor + 1, 0, s.name);
  }
  return order;
}

/** HELP's commands-list line for a command. */
export const helpLine = (s: CommandSpec) => `  ${s.usage.padEnd(16)}  ${s.summary}`;

/** The help text, from the registry (or from the specs given, for the registry's tests). */
export function helpText(
  specs: readonly CommandSpec[] = REGISTRY,
  first = HELP_FIRST_LINE,
): string {
  const byName = new Map(specs.map((s) => [s.name, s]));
  const blocks: (readonly string[])[] = [
    ...SHARED_BEFORE.map((k) => (SHARED[k] as (s: readonly CommandSpec[]) => string[])(specs)),
    ...sectionOrder(specs).map((n) => byName.get(n)?.helpSection ?? []),
    ...SHARED_AFTER.map((k) => (SHARED[k] as (s: readonly CommandSpec[]) => string[])(specs)),
  ];
  const lines = [
    first,
    "",
    "usage: engram <command> [options]",
    "",
    "commands:",
    ...specs.filter((s) => s.listed).map(helpLine),
  ];
  for (const b of blocks) lines.push("", ...b);
  return `${lines.join("\n")}\n`;
}

/** The first word of each command, the one `run` dispatches on. */
export const word = (s: Pick<CommandSpec, "name">) => s.name.split(" ")[0] as string;

/** The handler for each first word. */
export function handlers(
  specs: readonly CommandSpec[] = REGISTRY,
): Record<string, CommandSpec["handler"]> {
  // No prototype, so `engram toString` is an unknown command, not Object's method.
  const table: Record<string, CommandSpec["handler"]> = Object.create(null);
  for (const s of specs) table[word(s)] ??= s.handler;
  return table;
}

/** The spec of a full command name. */
export function command(name: string): CommandSpec | undefined {
  return REGISTRY.find((s) => s.name === name);
}

/** The parseArgs config a command's handler parses with: `parse`, else its `options`. */
export const parseOptions = (s: CommandSpec): Readonly<Record<string, OptionSpec>> =>
  s.parse ?? s.options;

// "Did you mean" (docs/design/tui.md 12.2): a second stderr line for an
// unknown command or flag within edit distance 2 of a known one.

/** The optimal string alignment distance: insertions, deletions, substitutions and adjacent swaps. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const at = (i: number, j: number) => (d[i] as number[])[j] as number;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        best = Math.min(best, at(i - 2, j - 2) + 1);
      (d[i] as number[])[j] = best;
    }
  return at(a.length, b.length);
}

/**
 * The closest of `known` to `typed`, if within 2 edits and closer than the
 * length of what was typed (so `--id` suggests nothing for read rather than
 * any two-letter flag); the first such in `known`'s order on a tie.
 */
export function closest(typed: string, known: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = 3;
  for (const k of known) {
    const n = editDistance(typed, k);
    if (n < bestDistance && n < typed.length) {
      best = k;
      bestDistance = n;
    }
  }
  return best;
}

/** The words `engram <word>` accepts: every command's first word, and help. */
export const commandWords = (): string[] => [...new Set([...REGISTRY.map(word), "help"])];
