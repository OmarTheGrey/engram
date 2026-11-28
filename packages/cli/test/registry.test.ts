// The command registry (card E8.15a, docs/design/tui.md 6.1 and 13): HELP is
// built from it and reproduces main's text byte for byte from main's
// commands; every handler parses exactly the flags its registry entry names,
// with their types; every command has exit codes, a group and a `writes`
// function; an unknown command or flag close to a known one gets a second
// "did you mean" line, and nothing else changes.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PROVIDER_KEYS } from "../src/doctor.ts";
import {
  type CommandSpec,
  closest,
  command,
  commandWords,
  editDistance,
  GROUPS,
  HELP_FIRST_LINE,
  handlers,
  helpLine,
  helpText,
  OPTIONS,
  parseOptions,
  REGISTRY,
  sectionOrder,
  type Values,
  WRITES,
  word,
  workspaceFlags,
} from "../src/registry.ts";
import { HELP } from "../src/run.ts";
import { cli } from "./helpers.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
/**
 * HELP as main printed it before the registry: packages/cli/src/run.ts at
 * 8046a6c2, the last main merged into this branch whose HELP was a literal.
 * packages/cli/scripts/refresh-help-main.ts rewrites it when main's HELP changes.
 */
const MAIN_HELP = readFileSync(join(HERE, "help-main.txt"), "utf8").replace(/^(# .*\n)+/, "");
const MAIN_FIRST_LINE = "engram: the Engram control plane from the command line";
/** The commands main had at 8046a6c2: E8.12's key, E8.13's export flags, E2.13's who-can-read, E1.6's log, L6's supersede and E9.8's export and import among them. */
const ON_MAIN = [
  "read",
  "write",
  "promote",
  "supersede",
  "explain",
  "retain",
  "lint",
  "simulate",
  "export",
  "import",
  "who-can-read",
  "serve",
  "mcp",
  "hook claude-code",
  "key create",
  "key list",
  "key revoke",
  "doctor",
  "log verify",
  "log checkpoint",
];
/** The commands card E8.15a adds (docs/design/tui.md 3.6), read --item and scopes over card E8.14's routes, E8.15b's tui, E9.10's discover and E8.17's Codex hook and installer. */
const ADDED = [
  "read --item",
  "check",
  "grants",
  "events",
  "policy",
  "scopes",
  "tui",
  // Card E9.10.
  "discover",
  // Card E8.17.
  "hook codex",
  "hook install",
];

describe("HELP from the registry", () => {
  it("is run.ts's HELP, and its first line names engram tui", () => {
    expect(HELP).toBe(helpText());
    expect(HELP.split("\n")[0]).toBe(
      "engram: the Engram control plane from the command line; engram tui opens the terminal interface",
    );
    expect(HELP_FIRST_LINE).toBe(HELP.split("\n")[0]);
  });

  it("reproduces main's HELP byte for byte from main's commands and main's first line", () => {
    const mainSpecs = REGISTRY.filter((s) => ON_MAIN.includes(s.name));
    expect(mainSpecs.map((s) => s.name)).toEqual(ON_MAIN);
    expect(helpText(mainSpecs, MAIN_FIRST_LINE)).toBe(MAIN_HELP);
  });

  it("differs from main's only by the first line and the lines of the added commands", () => {
    const now = HELP.split("\n");
    const before = MAIN_HELP.split("\n");
    expect(now[0]).not.toBe(before[0]);
    // Every line of main's after the first is still there, in order.
    const rest = now.slice(1);
    let i = 0;
    const added: string[] = [];
    for (const line of rest) {
      if (i < before.length - 1 && line === before[i + 1]) i++;
      else added.push(line);
    }
    expect(i).toBe(before.length - 1);
    // What is left is exactly the added commands' list lines and sections, each section with its blank line.
    const specs = ADDED.map((n) => command(n) as CommandSpec);
    const expected = [
      ...specs.map(helpLine),
      ...specs.flatMap((s) => ["", ...s.helpSection]),
    ].sort();
    expect(added.sort()).toEqual(expected);
  });

  it("places each section after the block it names, and who-can-read's after lint's as main did", () => {
    const order = sectionOrder(REGISTRY);
    expect(order.indexOf("who-can-read")).toBe(order.indexOf("lint") + 1);
    expect(order.indexOf("check")).toBe(order.indexOf("write") + 1);
    expect(order.indexOf("supersede")).toBe(order.indexOf("promote") + 1);
    expect(order.indexOf("grants")).toBe(order.indexOf("supersede") + 1);
    expect(order.indexOf("events")).toBe(order.indexOf("explain") + 1);
    expect(order.indexOf("policy")).toBe(order.indexOf("simulate") + 1);
    expect(order.indexOf("scopes")).toBe(order.indexOf("who-can-read") + 1);
    for (const s of REGISTRY)
      if (s.helpAfter !== undefined)
        expect(
          REGISTRY.map((r) => r.name),
          s.name,
        ).toContain(s.helpAfter);
    // Every command with a section appears exactly once.
    expect(new Set(order).size).toBe(order.length);
  });

  it("lists in each shared heading the commands whose entries name it, as main's headings did", () => {
    expect(HELP).toContain(
      "store options (read, write, promote, supersede, retain, lint, import, who-can-read, serve, mcp):",
    );
    expect(HELP).toContain(
      "actor options (read, write, promote, supersede, explain, retain, lint, export, import, who-can-read):",
    );
    expect(HELP).toContain(
      "export options (read, write, promote, retain, lint, serve, mcp, hook claude-code):",
    );
  });
});

describe("the registry's entries", () => {
  it("covers every command main has, the six E8.15a adds and E8.15b's tui, each name once", () => {
    const names = REGISTRY.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    expect([...names].sort()).toEqual([...ON_MAIN, ...ADDED].sort());
  });

  it("gives every command a group, a title, exit codes, a writes answer and typed flags", () => {
    const titles = new Set<string>();
    for (const s of REGISTRY) {
      expect(GROUPS, s.name).toContain(s.group);
      expect(s.title.length, s.name).toBeGreaterThan(0);
      expect(titles.has(s.title), s.title).toBe(false);
      titles.add(s.title);
      expect(s.exitCodes.length, s.name).toBeGreaterThan(0);
      expect(
        s.exitCodes.map((e) => e.code),
        s.name,
      ).toContain(2);
      // 3 is log verify's UNSIGNED (card E1.6).
      for (const e of s.exitCodes) expect([0, 1, 2, 3]).toContain(e.code);
      for (const values of [{}, { root: "/tmp/m" }, { server: "http://127.0.0.1:7313" }])
        expect(WRITES, s.name).toContain(s.writes(values, {}));
      for (const [name, o] of Object.entries(s.options)) {
        expect(["string", "boolean"], `${s.name} --${name}`).toContain(o.type);
        expect(o.label.length, `${s.name} --${name}`).toBeGreaterThan(0);
        expect(o.help.length, `${s.name} --${name}`).toBeGreaterThan(0);
        if (o.control === "choice")
          expect(o.choices?.length, `${s.name} --${name}`).toBeGreaterThan(0);
        expect(o, `${s.name} --${name} never sets parseArgs' default or short`).not.toHaveProperty(
          "default",
        );
        expect(o).not.toHaveProperty("short");
      }
    }
  });

  it("says what each command writes, for every entry and each condition flipped (docs/design/tui.md 9.5)", () => {
    const ROOT = { root: "/tmp/m" };
    const STORE = { store: "files" };
    const SERVER = { server: "http://127.0.0.1:7313" };
    // [entry, the form's values, the workspace's flags, the answer]
    const table: [string, Values, Values, string][] = [
      ["read", {}, {}, "audit"],
      ["read", ROOT, {}, "state"],
      ["read", STORE, {}, "state"],
      ["read", SERVER, {}, "state"],
      ["read", {}, ROOT, "state"],
      ["read", {}, STORE, "state"],
      ["read", {}, SERVER, "state"],
      ["read --item", {}, {}, "audit"],
      ["read --item", ROOT, {}, "state"],
      ["read --item", {}, SERVER, "state"],
      ["scopes", {}, {}, "audit"],
      ["scopes", ROOT, {}, "state"],
      ["scopes", {}, SERVER, "state"],
      ["write", {}, {}, "state"],
      ["check", ROOT, ROOT, "none"],
      ["promote", {}, {}, "state"],
      ["supersede", {}, {}, "none"],
      ["supersede", { accept: [] }, {}, "none"],
      ["supersede", { accept: ["x"] }, {}, "state"],
      ["grants", {}, {}, "state"],
      ["explain", ROOT, SERVER, "none"],
      ["events", ROOT, SERVER, "none"],
      ["retain", {}, {}, "retire"],
      ["lint", {}, {}, "audit"],
      ["simulate", {}, {}, "none"],
      ["policy", {}, SERVER, "none"],
      ["export", {}, {}, "none"],
      ["export", { out: "bundle.jsonl" }, {}, "file"],
      ["import", {}, {}, "state"],
      ["who-can-read", ROOT, SERVER, "none"],
      ["serve", {}, {}, "process"],
      ["mcp", {}, {}, "process"],
      ["mcp", { http: "7314" }, {}, "process"],
      ["hook claude-code", {}, {}, "audit"],
      ["hook codex", {}, {}, "audit"],
      ["hook install", ROOT, SERVER, "file"],
      ["key create", {}, {}, "state"],
      ["key list", {}, {}, "none"],
      ["key revoke", {}, {}, "erase"],
      ["doctor", ROOT, {}, "none"],
      ["discover", ROOT, SERVER, "none"],
      ["log verify", {}, {}, "none"],
      ["log checkpoint", {}, {}, "state"],
      // The TUI runs until quit; what each action changes is its own entry's answer.
      ["tui", {}, {}, "process"],
      ["tui", ROOT, SERVER, "process"],
    ];
    for (const [name, v, ws, answer] of table)
      expect(
        command(name)?.writes(v, ws),
        `${name} ${JSON.stringify(v)} ${JSON.stringify(ws)}`,
      ).toBe(answer);
    // Every entry is in the table.
    expect(new Set(table.map(([n]) => n))).toEqual(new Set(REGISTRY.map((s) => s.name)));
  });

  it("counts ENGRAM_SERVER_URL as the workspace's server, as connect does", () => {
    const env = { ENGRAM_SERVER_URL: "http://127.0.0.1:7313" };
    const read = command("read") as CommandSpec;
    expect(read.writes({}, workspaceFlags({}, {}))).toBe("audit");
    expect(read.writes({}, workspaceFlags({}, env))).toBe("state");
    // An empty variable names no server, as for connect.
    expect(read.writes({}, workspaceFlags({}, { ENGRAM_SERVER_URL: "" }))).toBe("audit");
    expect(workspaceFlags({ server: "http://a" }, env).server).toBe("http://a");
  });

  it("names the environment each command reads, and every variable the CLI reads is named", () => {
    const named = new Set(REGISTRY.flatMap((s) => s.env));
    const read = new Set<string>();
    // Subfolders too, so the TUI's own reads (src/tui) are named on its entry (card E8.15b).
    for (const dir of [join(HERE, "../src"), join(HERE, "../../server/src")])
      for (const file of readdirSync(dir, { recursive: true })
        .map(String)
        .filter((f) => f.endsWith(".ts"))) {
        const text = readFileSync(join(dir, file), "utf8");
        for (const m of text.matchAll(/"(ENGRAM_[A-Z_]+)"/g)) read.add(m[1] as string);
        for (const m of text.matchAll(/\benv\.([A-Z][A-Za-z0-9_]+)/g)) read.add(m[1] as string);
      }
    expect(read.size).toBeGreaterThan(5);
    for (const v of read) expect(named, v).toContain(v);
    expect(command("read")?.env).toEqual([
      "ENGRAM_DB_URL",
      "ENGRAM_SERVER_URL",
      "ENGRAM_TOKEN",
      "ENGRAM_OTLP_URL",
      "ENGRAM_EXPORT_JSONL",
      "HOME",
      "USERPROFILE",
    ]);
    expect(command("hook claude-code")?.env).toContain("CLAUDE_PROJECT_DIR");
    expect(command("key create")?.env).toEqual([]);
    // The default log is <home>/.engram/engram.db, and main.ts finds the home
    // through os.homedir(), which reads HOME, else USERPROFILE on Windows.
    for (const s of REGISTRY)
      if (parseOptions(s).db?.defaultText?.includes("<home>"))
        expect(s.env, s.name).toEqual(expect.arrayContaining(["HOME", "USERPROFILE"]));
    expect(REGISTRY.filter((s) => s.env.includes("HOME")).length).toBeGreaterThan(20);
    // Doctor checks the provider keys by name, from the file it reads them from.
    expect(command("doctor")?.envFrom).toBe(PROVIDER_KEYS);
    for (const s of REGISTRY) if (s.name !== "doctor") expect(s.envFrom, s.name).toBeUndefined();
  });

  it("says what an error means for the commands that open no log", () => {
    for (const name of ["key create", "key list", "key revoke", "policy"])
      for (const e of command(name)?.exitCodes ?? [])
        expect(e.when, name).not.toContain("a log it cannot use");
  });

  it("dispatches each first word to one handler, shared by the entries of that word", () => {
    const table = handlers();
    expect(Object.keys(table).sort()).toEqual([...new Set(REGISTRY.map(word))].sort());
    for (const s of REGISTRY) expect(s.handler, s.name).toBe(table[word(s)]);
    expect(commandWords()).toContain("help");
  });

  it("holds every option object a handler parses with: no flag is typed outside the registry", () => {
    const src = join(HERE, "../src");
    for (const file of readdirSync(src).filter((f) => f.endsWith(".ts"))) {
      if (file === "registry.ts") continue;
      const text = readFileSync(join(src, file), "utf8");
      expect(text, file).not.toMatch(/type:\s*"(string|boolean)"/);
      for (const m of text.matchAll(/\bparse\(\s*args,\s*([^,]+),/g))
        expect(m[1]?.trim(), file).toMatch(/^(OPTIONS(\.\w+|\["[\w -]+"\])|c\.options)$/);
      // A plane command's parse config (commands.ts, read by runPlane as c.options) is the registry's too.
      for (const m of text.matchAll(/plane\(\{\s*options: ([^,]+),/g))
        expect(m[1], file).toMatch(/^OPTIONS(\.\w+|\["[\w -]+"\])$/);
    }
  });

  it("parses each entry with one config, the handler's, holding the entry's flags", () => {
    expect(parseOptions(command("key create") as CommandSpec)).toBe(OPTIONS.key);
    expect(parseOptions(command("read --item") as CommandSpec)).toBe(OPTIONS.read);
    for (const s of REGISTRY)
      for (const [name, o] of Object.entries(s.options))
        expect(parseOptions(s)[name], `${s.name} --${name}`).toBe(o);
  });
});

describe("every handler parses exactly its entry's flags, with their types", () => {
  const all = [
    ...new Set([
      ...REGISTRY.flatMap((s) => Object.keys(parseOptions(s))),
      ...Object.values(OPTIONS).flatMap((o) => Object.keys(o)),
    ]),
  ];
  for (const spec of REGISTRY) {
    it(`engram ${spec.name}`, async () => {
      // The words that pick the handler and subcommand; read --item's flag is one of its options.
      const argv = spec.name.split(" ").filter((w) => !w.startsWith("--"));
      const w = word(spec);
      const own = parseOptions(spec);
      for (const f of all) {
        const o = own[f];
        if (o === undefined) {
          const r = await cli([...argv, `--${f}`]);
          expect(r.code, `${spec.name} --${f}`).toBe(2);
          expect(r.err, `${spec.name} --${f}`).toContain(`engram ${w}: Unknown option '--${f}'`);
        } else if (o.type === "string") {
          const r = await cli([...argv, `--${f}`]);
          expect(r.code, `${spec.name} --${f}`).toBe(2);
          expect(r.err, `${spec.name} --${f}`).toContain(
            `Option '--${f} <value>' argument missing`,
          );
        } else {
          const r = await cli([...argv, `--${f}=x`]);
          expect(r.code, `${spec.name} --${f}`).toBe(2);
          expect(r.err, `${spec.name} --${f}`).toContain(
            `Option '--${f}' does not take an argument`,
          );
        }
      }
    });
  }
});

describe("did you mean", () => {
  it("adds a second stderr line for an unknown command close to one, and nothing for one that is not", async () => {
    const typo = await cli(["raed"]);
    expect(typo.code).toBe(2);
    expect(typo.out).toBe("");
    expect(typo.err).toBe(
      'engram: unknown command "raed"; engram --help lists them\nengram: did you mean "read"?\n',
    );
    const far = await cli(["frobnicate"]);
    expect(far.code).toBe(2);
    expect(far.err).toBe('engram: unknown command "frobnicate"; engram --help lists them\n');
  });

  it("adds a second stderr line for an unknown flag close to one of the command's, after parseArgs' message", async () => {
    const typo = await cli(["read", "--rot", "."]);
    expect(typo.code).toBe(2);
    expect(typo.out).toBe("");
    const [first, second, ...rest] = typo.err.split("\n");
    expect(first).toMatch(/^engram read: Unknown option '--rot'/);
    expect(second).toBe("engram read: did you mean --root?");
    expect(rest).toEqual([""]);
    const swapped = await cli(["hook", "claude-code", "--protcet", "x.db"]);
    expect(swapped.err.split("\n")[1]).toBe("engram hook: did you mean --protect?");
    const far = await cli(["read", "--bogus"]);
    expect(far.code).toBe(2);
    expect(far.err.split("\n")).toHaveLength(2);
    expect(far.err).not.toContain("did you mean");
  });

  it("suggests from the subcommand's own flags, and on a tie the flag the typed word begins", async () => {
    const add = await cli(["grants", "01920000-0000-7000-8000-00000000e815", "--ad", "x"]);
    expect(add.err.split("\n")[1]).toBe("engram grants: did you mean --add?");
    // --expires is key create's; key list has no flag near --expire.
    const list = await cli(["key", "list", "--expire", "x"]);
    expect(list.code).toBe(2);
    expect(list.err).not.toContain("did you mean");
    const create = await cli(["key", "create", "--expire", "x"]);
    expect(create.err.split("\n")[1]).toBe("engram key: did you mean --expires?");
    expect(closest("ad", ["as", "add"])).toBe("add");
  });

  it("answers Object's own property names as unknown commands, with or without --help", async () => {
    for (const name of [
      "toString",
      "constructor",
      "__proto__",
      "hasOwnProperty",
      "valueOf",
      "isPrototypeOf",
    ])
      for (const args of [[name], [name, "--help"]]) {
        const r = await cli(args);
        expect(r.code, args.join(" ")).toBe(2);
        expect(r.out, args.join(" ")).toBe("");
        expect(r.err.split("\n")[0], args.join(" ")).toBe(
          `engram: unknown command "${name}"; engram --help lists them`,
        );
      }
  });

  it("measures optimal string alignment distance and suggests within two edits only", () => {
    expect(editDistance("raed", "read")).toBe(1);
    expect(editDistance("rot", "root")).toBe(1);
    expect(editDistance("bogus", "json")).toBeGreaterThan(2);
    expect(closest("rot", ["store", "root", "owner"])).toBe("root");
    expect(closest("frobnicate", commandWords())).toBeUndefined();
    // Two edits are too many for a two-letter flag: --id would match any two-letter one.
    expect(closest("id", ["as", "at", "db"])).toBeUndefined();
    expect(closest("ass", ["as", "at"])).toBe("as");
  });
});
