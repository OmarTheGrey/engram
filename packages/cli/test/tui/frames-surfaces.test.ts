// Snapshot frames of card E8.15d's screens (docs/design/tui.md 13): each
// hand-made screen drawn by the real App through a FakeTerminal into
// @xterm/headless, at 80x24 and 120x40, in the default, --no-color,
// --high-contrast and --ascii modes, against committed snapshots under
// __frames__/ (prefixed surface-). Every result is fixed fixture content
// set on the screen, never a live run, so a preset, HELP or machine change
// elsewhere does not move them; paths are relative or fixed. As for the
// frame's own snapshots: no line wider than the terminal, exactly its
// height, colour on a status symbol only, none in --no-color or high
// contrast, no Unicode drawing in --ascii.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { LintFinding, SimReport } from "@engram/core";
import { describe, expect, it } from "vitest";
import { type CommandSpec, command } from "../../src/registry.ts";
import { visibleWidth } from "../../src/tui/layout.ts";
import type { Exchange, RunResult } from "../../src/tui/runner.ts";
import type { SurfaceScreen } from "../../src/tui/screens/surface.ts";
import { surfaceScreen } from "../../src/tui/screens/surfaces.ts";
import type { Launch } from "../../src/tui/snippets.ts";
import { tempDir } from "../helpers.ts";
import { type Cell, type Harness, type HarnessOptions, startHarness } from "./harness.ts";

type Mode = "default" | "no-color" | "high-contrast" | "ascii";
const MODES: Mode[] = ["default", "no-color", "high-contrast", "ascii"];
const SIZES: [number, number][] = [
  [80, 24],
  [120, 40],
];
const ENV = { COLORFGBG: "15;0", COLORTERM: "truecolor" };
const modeOptions = (mode: Mode): HarnessOptions["options"] => ({
  noColor: mode === "no-color",
  highContrast: mode === "high-contrast",
  ascii: mode === "ascii",
});

const USABLE = { owner: "dana", db: "engram.db", root: "mem" };
/** The hook and MCP screens write paths absolute: their frames name no folder of this machine. */
const NO_PATHS = { owner: "dana", db: ":memory:" };
const LAUNCH: Launch = {
  command: "/usr/bin/node",
  prefix: ["/src/engram/packages/cli/src/main.ts"],
  note: "engram is not on your PATH; the snippet uses the full path of this CLI.",
};
const ID1 = "01950000-0000-7000-8000-000000000001";
const ID2 = "01950000-0000-7000-8000-000000000002";

const call = (path: string, body: unknown, status = 200): Exchange => ({
  method: "POST",
  path,
  status,
  body,
});
const result = (argv: string[], code: number, out: string, calls: Exchange[] = []): RunResult => ({
  argv,
  code,
  out,
  err: "",
  calls,
});

const FINDING: LintFinding = {
  id: "01950000-0000-7000-8000-0000000000f1",
  lint_id: "duplicate",
  item_id: ID2,
  tier: "deterministic",
  severity: "warn",
  message: `it restates ${ID1}, an earlier active semantic item in team:core`,
  evidence: [`duplicate of ${ID1}; strict content hash sha256:210227b7`],
  schema_version: 1,
};

const outcome = (step: number, decision: "allow" | "deny", policy: string, reason: string) => ({
  step,
  op: "write" as const,
  actor: "person:dana",
  item_id: ID2,
  decision,
  reason,
  policy_id: policy,
  returned: [],
  evicted: [],
  expired: [],
  asked: 0,
});
const run = (id: string, allow: number, deny: number, returned: number) => ({
  policy_id: id,
  policy_version: 1,
  outcomes: [outcome(1, deny > 0 ? "deny" : "allow", `${id}/write/team`, "a fixture rule")],
  totals: { allow, deny, ask: 0 },
  utility: {
    reads: 2,
    returned,
    reads_with_recall: returned > 0 ? 1 : 0,
    mean_returned: returned / 2,
  },
  evictions: { evicted: 0, expired: 0, asked: 0 },
  active: { "person:dana": allow },
});
const REPORT: SimReport = {
  workload_id: "fixture-workload",
  baseline: run("fixture.base", 4, 0, 3),
  candidate: run("fixture.candidate", 3, 1, 1),
  changed: [
    {
      step: 1,
      op: "write",
      actor: "person:dana",
      item_id: ID2,
      baseline: outcome(1, "allow", "fixture.base/write/team", "a fixture rule admits it"),
      candidate: outcome(
        1,
        "deny",
        "fixture.candidate/write/team",
        "confidence 0.75 is below the fixture floor 0.8",
      ),
    },
  ],
  model_calls: 0,
};

const DOCTOR = [
  // The failing check in doctor's own order second: the screen draws it first (review E8.15d-7).
  "ok   log             sqlite engram.db: no log yet; the first read or write creates it",
  "fail policy          --policy nosuch.yaml is neither a preset nor a readable file",
  "skip store           no --root given",
  "skip adapter files   no --root given",
  "ok   adapter mem0    a fixture probe",
  "ok   adapter letta   a fixture probe",
  "ok   provider keys   none of the key variables is set",
  "ok   benchmark pins  fixture pins",
  "ok   pi pin          fixture pins",
  "ok   node            Node 24.0.0",
  "skip serve           no serve flags given (--host, --keys, --issuer, --insecure-loopback)",
  "doctor: 1 check failed",
  "",
].join("\n");

/** The screens, each opened on Home's command with fixed content set on it. */
const SCREENS: Record<
  string,
  {
    name: string;
    given: Record<string, string>;
    values?: Record<string, unknown>;
    set: (s: never, h: Harness) => void | Promise<void>;
  }
> = {
  retain: {
    name: "retain",
    given: USABLE,
    values: { scope: "person:dana" },
    set: (s: SurfaceScreen) =>
      s.show(
        result(
          [
            "retain",
            "--scope",
            "person:dana",
            "--db",
            "engram.db",
            "--owner",
            "dana",
            "--root",
            "mem",
          ],
          0,
          "retain person:dana at 2026-10-25T12:00:00.000Z as person:dana: allow, 0 expired, 0 evicted\nlog engram.db\n",
          [call("/api/v1/retain", { decision: "allow", events: [], expired: [], evicted: [] })],
        ),
      ),
  },
  lint: {
    name: "lint",
    given: USABLE,
    values: { scope: "team:core" },
    set: (s: SurfaceScreen) =>
      s.show(
        result(
          ["lint", "--scope", "team:core", "--db", "engram.db", "--owner", "dana", "--root", "mem"],
          1,
          "lint team:core at 2026-11-06T12:00:00Z as person:dana: allow, 1 finding\nlog engram.db\n",
          [
            call("/api/v1/lint", {
              decision: "allow",
              findings: [FINDING],
              events: [{ policy_id: "fixture.faults/lint/duplicate" }],
            }),
          ],
        ),
      ),
  },
  simulate: {
    name: "simulate",
    given: USABLE,
    values: { workload: "workload.json", candidate: "candidate.yaml" },
    set: (s: SurfaceScreen) =>
      s.show(
        result(
          [
            "simulate",
            "--workload",
            "workload.json",
            "--candidate",
            "candidate.yaml",
            "--db",
            "engram.db",
          ],
          0,
          "fixture comparison\n",
          [call("/api/v1/simulate", REPORT)],
        ),
      ),
  },
  doctor: {
    name: "doctor",
    given: USABLE,
    set: (s: SurfaceScreen) =>
      s.show(result(["doctor", "--db", "engram.db", "--root", "mem"], 1, DOCTOR)),
  },
  serve: {
    name: "serve",
    given: USABLE,
    values: { keys: "keys.json" },
    set: (s: SurfaceScreen) => {
      const out =
        "engram serve: listening on http://127.0.0.1:7313 (log sqlite engram.db, fixture.policy v1, store files at mem, viewer none, authenticated, resource http://127.0.0.1:7313)\n";
      Object.assign(s, {
        running: { out, err: "", code: undefined, argv: [], url: () => "http://127.0.0.1:7313" },
      });
    },
  },
  mcp: {
    name: "mcp",
    given: NO_PATHS,
    values: { as: "agent:claude-code", member: ["person:dana"] },
    set: (s: SurfaceScreen & { setLaunch(l: Launch): void }) => {
      s.setLaunch(LAUNCH);
      Object.assign(s, {
        tried: {
          scratch: { replaced: ["Try it ran with --db :memory: in place of --db engram.db"] },
          result: {
            outcome: "ok",
            tools: ["memory_write", "memory_read", "memory_explain", "memory_simulate"],
            server: "engram 0.0.0",
            detail:
              "handshake ok; tools memory_write, memory_read, memory_explain, memory_simulate; stopped",
          },
        },
      });
    },
  },
  hook: {
    name: "hook claude-code",
    given: NO_PATHS,
    values: { root: ["/src/lantern/memory"], as: "person:dana" },
    set: (s: SurfaceScreen & { setLaunch(l: Launch): void }) => {
      s.setLaunch(LAUNCH);
      Object.assign(s, {
        tried: {
          scratch: { replaced: [] },
          results: [
            {
              label: "Read /src/lantern/memory/user_role.md",
              code: 0,
              outcome: "blocked",
              expected: true,
              detail: "exit 0, blocked: permissionDecision deny",
              stdout: "",
            },
            {
              label: "Read /src/lantern/README.md",
              code: 0,
              outcome: "allowed",
              expected: true,
              detail: "exit 0, allowed: the hook printed nothing",
              stdout: "",
            },
          ],
        },
      });
    },
  },
  export: {
    name: "export",
    given: USABLE,
    values: { out: "dana.jsonl" },
    set: (s: SurfaceScreen) =>
      s.show(
        result(
          ["export", "--out", "dana.jsonl", "--db", "engram.db", "--owner", "dana"],
          0,
          "exported 1 item with 2 events as person:dana under fixture.policy v1 to dana.jsonl\n",
          [call("/api/v1/export", { rows: [] })],
        ),
      ),
  },
  import: {
    name: "import",
    given: USABLE,
    values: {},
    set: (s: SurfaceScreen) =>
      s.show(
        result(
          ["import", "dana.jsonl", "--db", "engram.db", "--owner", "dana", "--root", "mem"],
          1,
          [
            "import as import:person:dana for person:dana: 2 rows, 1 allowed, 1 denied",
            `  ${ID1} -> 01960000-0000-7000-8000-000000000001: allow as candidate, kind import: a fixture rule admits it (fixture.policy/write/person)`,
            `  ${ID2} -> 01960000-0000-7000-8000-000000000002: deny, kind import: episodic items are forbidden in team scope (fixture.policy/write/team)`,
            "log engram.db",
            "",
          ].join("\n"),
          [
            call("/api/v1/items", { event: { decision: "allow" } }),
            call("/api/v1/items", { event: { decision: "deny" } }),
          ],
        ),
      ),
  },
  keys: {
    name: "key list",
    given: { ...USABLE, keys: "keys.json" },
    set: (s: SurfaceScreen) =>
      s.show(
        result(
          ["key", "list", "--keys", "keys.json"],
          0,
          [
            "egk_7f3a9c2e1b04_****9d1e  active   person:dana (person, source user)  expires 2027-01-01T00:00:00Z",
            "egk_0c55d1e9a7b2_****71f0  revoked  person:sam (person, source user)  expires 2026-12-01T00:00:00Z",
            "",
          ].join("\n"),
        ),
      ),
  },
  "key-create": {
    name: "key create",
    given: { ...USABLE, keys: "keys.json" },
    values: { as: "agent:ci", source: "model", expires: "2026-12-31T00:00:00Z" },
    set: (s: SurfaceScreen) =>
      s.show(
        result(
          [
            "key",
            "create",
            "--as",
            "agent:ci",
            "--source",
            "model",
            "--expires",
            "2026-12-31T00:00:00Z",
            "--keys",
            "keys.json",
          ],
          0,
          [
            "egk_2b8e4f6a0c13_FIXTUREFIXTUREFIXTUREFIXTURE04aa",
            "key 2b8e4f6a0c13 for agent:ci (level role, member of role:ci, source model), expires 2026-12-31T00:00:00Z",
            "the key is shown once; keys.json holds its hash only",
            "",
          ].join("\n"),
        ),
      ),
  },
  "log-verify": {
    name: "log verify",
    given: USABLE,
    set: (s: SurfaceScreen) =>
      s.show(
        result(
          ["log", "verify", "--db", "engram.db"],
          3,
          [
            "engram log verify: UNSIGNED",
            "  ok    tables",
            "  ok    links",
            "  ok    checkpoints",
            "log fixture: 2 chain entries, 1 events chained, 0 unchained, 0 erased, 0 manifests, 0 checkpoints",
            "note: no checkpoint: nothing signs this log's head",
            "",
          ].join("\n"),
        ),
      ),
  },
};

/** The styled runs of a frame: consecutive cells of a row with the same style. */
function styleRuns(cells: Cell[]): string[] {
  const key = (c: Cell) =>
    [
      c.fg === "default" ? "" : `fg ${c.fg}`,
      c.bold ? "bold" : "",
      c.underline ? "underline" : "",
      c.inverse ? "inverse" : "",
      c.dim ? "dim" : "",
    ]
      .filter((x) => x !== "")
      .join(" ");
  const out: string[] = [];
  let r: { row: number; from: number; to: number; style: string } | undefined;
  for (const c of cells) {
    const style = key(c);
    if (r !== undefined && r.row === c.row && r.to === c.col - 1 && r.style === style) r.to = c.col;
    else {
      if (r !== undefined) out.push(`r${r.row} c${r.from}-${r.to} ${r.style}`);
      r = { row: c.row, from: c.col, to: c.col, style };
    }
  }
  if (r !== undefined) out.push(`r${r.row} c${r.from}-${r.to} ${r.style}`);
  return out;
}

const STATUS_SYMBOLS = new Set([
  "✓",
  "✗",
  "◆",
  "▲",
  "●",
  "ℹ",
  "·",
  "+",
  "x",
  "?",
  "!",
  "*",
  "i",
  "-",
]);
const UNICODE_DRAWING = /[┌┐└┘─│▸▾✓✗◆▲·●ℹ█…]/;

async function shoot(key: string, mode: Mode, columns: number, rows: number) {
  const s = SCREENS[key] as (typeof SCREENS)[string];
  const cwd = await tempDir();
  const home = join(cwd, "home");
  mkdirSync(home);
  mkdirSync(join(cwd, "mem"));
  const h = await startHarness({
    cwd,
    home,
    env: ENV,
    given: s.given,
    options: modeOptions(mode),
    columns,
    rows,
  });
  const spec = command(s.name) as CommandSpec;
  const screen = surfaceScreen(spec, h.app, (s.values ?? {}) as never, []) as SurfaceScreen;
  await s.set(screen as never, h);
  h.app.push(screen);
  const frame = await h.frame();
  const cells = await h.cells();
  const drawn = h.app.render(columns);
  await h.quit();
  return { frame, cells, drawn };
}

describe("E8.15d snapshot frames", () => {
  for (const key of Object.keys(SCREENS))
    for (const [columns, rows] of SIZES)
      for (const mode of MODES)
        it(`${key} at ${columns}x${rows}, ${mode}`, async () => {
          const { frame, cells, drawn } = await shoot(key, mode, columns, rows);
          expect(drawn).toHaveLength(rows);
          for (const line of drawn) expect(visibleWidth(line)).toBeLessThanOrEqual(columns);
          const coloured = cells.filter((c) => c.fg !== "default");
          if (mode === "no-color" || mode === "high-contrast") expect(coloured).toEqual([]);
          for (const c of coloured)
            expect(STATUS_SYMBOLS, `${key} r${c.row} c${c.col}`).toContain(c.char);
          if (mode === "ascii") expect(frame.join("\n")).not.toMatch(UNICODE_DRAWING);
          const text = `${frame.map((l) => l.replace(/\s+$/, "")).join("\n")}\n--- styles\n${styleRuns(cells).join("\n")}\n`;
          await expect(text).toMatchFileSnapshot(
            `__frames__/surface-${key}-${columns}x${rows}-${mode}.txt`,
          );
        });
});
