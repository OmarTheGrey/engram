// Snapshot frames of the memory and audit screens (card E8.15c,
// docs/design/tui.md 8.5 to 8.8, 8.16 to 8.19, 8.22, 8.26 and 13): each
// screen drawn by the real App on pi-tui, through a FakeTerminal into
// @xterm/headless, at 80x24 and 120x40, in the default, --no-color,
// --high-contrast and --ascii modes, against committed snapshots under
// __frames__/. Every screen shows fixed fixture content (its command's answer
// written here), so a preset's words or a log's ids elsewhere never move a
// frame. The same rules as the frame's own snapshots hold: no line wider
// than the terminal, colour on a status symbol only, none in --no-color or
// high contrast, no Unicode drawing in --ascii.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { MemoryEvent, MemoryItem } from "@engram/sdk";
import { describe, expect, it } from "vitest";
import { command } from "../../src/registry.ts";
import { visibleWidth } from "../../src/tui/layout.ts";
import type { RunResult } from "../../src/tui/runner.ts";
import type { Screen } from "../../src/tui/screen.ts";
import { EventsScreen, PolicyScreen } from "../../src/tui/screens/events.ts";
import { GrantsScreen } from "../../src/tui/screens/grants.ts";
import { ItemScreen } from "../../src/tui/screens/item.ts";
import { ExplainScreen, ReadScreen } from "../../src/tui/screens/read.ts";
import { SupersedeScreen, WhoScreen } from "../../src/tui/screens/who.ts";
import { PromoteScreen, WriteScreen } from "../../src/tui/screens/write.ts";
import { tempDir } from "../helpers.ts";
import { type Cell, type Harness, startHarness } from "./harness.ts";

type Mode = "default" | "no-color" | "high-contrast" | "ascii";
const MODES: Mode[] = ["default", "no-color", "high-contrast", "ascii"];
const SIZES: [number, number][] = [
  [80, 24],
  [120, 40],
];
const ENV = { COLORFGBG: "15;0", COLORTERM: "truecolor" };
const GIVEN = { owner: "dana", db: "engram.db", root: "mem" };

const id = (n: number) => `01940000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const AT = "2026-10-25T12:00:00.000Z";
const DANA = { id: "person:dana", level: "person", memberships: ["person:dana"], source: "user" };

function item(n: number, over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: id(n),
    class: "semantic",
    scope: "person:dana",
    owner: "person:dana",
    content: `Fixture memory ${n}: the deploy key rotates every 90 days.`,
    provenance: {
      kind: "user",
      ref: "engram-cli",
      hash: `sha256:${"0".repeat(64)}`,
      actor: "person:dana",
    },
    confidence: 0.9,
    valid_from: "2026-10-01T00:00:00.000Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: { adapter: "files", key: `${id(n)}.md` },
    schema_version: 1,
    ...over,
  } as MemoryItem;
}

function event(seq: number, over: Partial<MemoryEvent> = {}): MemoryEvent {
  return {
    id: id(500 + seq),
    seq,
    ts: AT,
    op: "write",
    decision: "allow",
    actor: "person:dana",
    item_id: id(1),
    item_ids: null,
    scope_from: null,
    scope_to: "person:dana",
    policy_id: "fixture/write/person",
    reason: "a fixture rule admits it",
    item: null,
    ...over,
  } as MemoryEvent;
}

/** A command's run with one call, as the runner records it. */
function ran(
  argv: string[],
  path: string,
  body: unknown,
  out: string,
  code = 0,
  request: unknown = { actor: DANA },
): RunResult {
  return {
    argv,
    code,
    out,
    err: "",
    other: `${JSON.stringify(body, null, 2)}\n`,
    calls: [{ method: "POST", path, status: 200, body, request }],
  };
}

const ITEMS = [
  item(1),
  item(2, {
    content: "Fixture memory 2: reviews are short.",
    provenance: {
      kind: "import",
      ref: "fixture/feedback.md",
      hash: `sha256:${"1".repeat(64)}`,
      actor: "person:dana",
    } as MemoryItem["provenance"],
  }),
];
const EXPLANATIONS = ITEMS.map((it, i) => ({
  item_id: it.id,
  rank: i + 1,
  score: { total: 1.9 - i / 10, components: { confidence: 0.9, recency: 1 - i / 10 } },
  policy_id: "fixture/read/person",
  grants_used: [],
  validity: { valid_from: it.valid_from, valid_to: null, at: AT },
}));
const READ_ID = id(900);
const READ_EVENT = event(9, {
  id: READ_ID,
  op: "read",
  item_id: null,
  item_ids: ITEMS.map((i) => i.id),
  scope_to: null,
  policy_id: "fixture/read/person",
  reason: "returned 2 of 2 candidates; 0 filtered",
});
const READ = ran(
  ["read", "deploy", "--owner", "dana", "--db", "engram.db", "--root", "mem"],
  "/api/v1/read",
  {
    items: ITEMS,
    explanations: EXPLANATIONS,
    filtered: 0,
    event: READ_EVENT,
    policy: "fixture.policy v1",
    sync: {
      store: { name: "files", root: "mem", scope: "person:dana" },
      retention: { expired: [], evicted: [], events: [] },
      adoption: {
        listed: 1,
        allowed: 1,
        denied: 0,
        unchanged: 0,
        deferred: 0,
        retired: 0,
        denials: [],
        retirements: [],
        evictions: [],
      },
    },
  },
  `read ${READ_ID} at ${AT} as person:dana (person) under fixture.policy v1\n2 items returned, 0 filtered\nlog engram.db; engram explain ${READ_ID}\n`,
);
const DENY = event(10, {
  decision: "deny",
  scope_to: "team:lantern",
  item_id: id(3),
  policy_id: "fixture/write/team",
  reason: "a fixture rule refuses it: the writer is not a member of team:lantern",
});
const WRITE_DENIED = ran(
  [
    "write",
    "--content",
    "x",
    "--scope",
    "team:lantern",
    "--owner",
    "dana",
    "--db",
    "engram.db",
    "--root",
    "mem",
  ],
  "/api/v1/items",
  { event: DENY, item: null },
  `write ${DENY.id} at ${AT} by person:dana\ndeny: ${DENY.reason}\npolicy fixture/write/team\nlog engram.db\n`,
  1,
);
const PROMOTE_DENY = event(11, {
  op: "promote",
  decision: "deny",
  scope_from: "person:dana",
  scope_to: "team:lantern",
  policy_id: "fixture/promote/review",
  reason: "a fixture rule asks for a reviewer's approval",
});
const PROMOTED = ran(
  [
    "promote",
    id(1),
    "--to",
    "team:lantern",
    "--owner",
    "dana",
    "--db",
    "engram.db",
    "--root",
    "mem",
  ],
  "/api/v1/promote",
  { decision: "deny", event: PROMOTE_DENY, events: [PROMOTE_DENY], item: null },
  `promote ${PROMOTE_DENY.id} at ${AT} by person:dana\ndeny: ${PROMOTE_DENY.reason}\npolicy fixture/promote/review\nlog engram.db\n`,
  1,
);
const GRANT = {
  to: "person:sam",
  class: "semantic",
  mode: "read",
  expires: "2026-12-01T00:00:00Z",
} as const;
const GRANT_EVENT = event(12, {
  op: "update",
  policy_id: "fixture/grant/change",
  reason: "a fixture rule lets the owner change grants",
});
const GRANTED = ran(
  [
    "grants",
    id(1),
    "--add",
    "person:sam,class=semantic,mode=read,expires=2026-12-01T00:00:00Z",
    "--owner",
    "dana",
    "--db",
    "engram.db",
    "--root",
    "mem",
  ],
  "/api/v1/grants",
  { decision: "allow", item: item(1, { grants: [GRANT] as never }), event: GRANT_EVENT },
  `update ${GRANT_EVENT.id} at ${AT} by person:dana\nallow: ${GRANT_EVENT.reason}\npolicy fixture/grant/change\nlog engram.db\n`,
);
const EVENTS = [
  event(1),
  event(2, { item_id: id(2), op: "write" }),
  DENY,
  PROMOTE_DENY,
  { ...READ_EVENT, seq: 13 },
];
const EVENTS_RUN = ran(
  ["events", "--owner", "dana", "--db", "engram.db"],
  "/api/v1/events",
  { events: EVENTS },
  "events person:dana may see: 5 events\n",
);
const POLICY_RUN = ran(
  ["policy"],
  "/api/v1/policy",
  {
    label: "fixture.policy v1",
    policy: {
      id: "fixture.policy",
      version: 1,
      write: {
        person: { sources: ["user", "import"], confidence_floor: 0 },
        team: { sources: ["user"], forbidden_classes: ["episodic"], confidence_floor: 0.7 },
      },
      read: { honour_grants: true },
      lints: { enabled: ["duplicate", "expired-validity"] },
    },
  },
  "# fixture.policy v1: the policy the workspace decides with\n",
  0,
  undefined,
);
const WHO_RUN = ran(
  ["who-can-read", id(1), "--owner", "dana", "--db", "engram.db", "--root", "mem"],
  "/api/v1/who-can-read/item",
  {
    target: `item ${id(1)}`,
    at: AT,
    answered: true,
    reason: "the fixture answers the item's owner",
    closed: null,
    readers: [
      { kind: "members", scope: "person:dana", level: "person", policy_id: "fixture/read/person" },
      {
        kind: "grant",
        to: "person:sam",
        grant: "person:sam: semantic, read",
        grant_detail: GRANT,
        policy_id: "fixture/read/grant",
      },
    ],
    dormant: [],
    grants_shown: "all",
  },
  `who can read item ${id(1)} at ${AT} as person:dana: answered\n`,
);
const PLAN_RUN = ran(
  ["supersede", id(2), "--owner", "dana", "--db", "engram.db", "--root", "mem"],
  "/api/v1/supersede",
  {
    item_id: id(2),
    head: { ok: true, head_id: id(2), chain: [id(1), id(2)] },
    proposals: [
      {
        item_id: id(1),
        action: "close",
        relation: "supersedes",
        valid_to: "2026-10-15T00:00:00Z",
        reason: "the fixture's newer version starts then",
      },
      {
        item_id: id(4),
        action: "review",
        relation: null,
        valid_to: null,
        reason: "the fixture flags this one for review",
      },
    ],
    applied: [],
    stopped: null,
  },
  `head ${id(2)}, chain ${id(1)} -> ${id(2)}\n`,
);
const EXPLAIN_RUN = ran(
  ["explain", READ_ID, "--owner", "dana", "--db", "engram.db"],
  `/api/v1/explain/${READ_ID}`,
  {
    explanations: EXPLANATIONS,
    counts: {
      returned: 2,
      candidates: 2,
      filtered: 0,
      outside_validity: 0,
      not_active: 0,
      expired: 0,
      excluded: 0,
      out_of_reach: 0,
    },
  },
  `read ${READ_ID}: 2 explanations\n`,
);
/** The item page: v2 of an item whose v1 the viewer saw written, and the events naming it. */
const V2 = item(1, {
  version: 2,
  content: "Fixture memory 1: the deploy key rotates every 60 days.",
  lineage: [],
});
const PAGE_READ = ran(
  ["read", "--item", id(1), "--owner", "dana", "--db", "engram.db", "--root", "mem"],
  `/api/v1/read/${id(1)}`,
  {
    items: [V2],
    explanations: [EXPLANATIONS[0]],
    filtered: 0,
    event: READ_EVENT,
    policy: "fixture.policy v1",
    sync: null,
  },
  "read\n",
);
const PAGE_EVENTS = ran(
  ["events", "--owner", "dana", "--db", "engram.db"],
  "/api/v1/events",
  {
    events: [
      event(1, { item: item(1) }),
      event(5, { op: "write", reason: "a fixture rule admits the new version", item: V2 }),
      PROMOTE_DENY,
    ],
  },
  "events\n",
);

type Build = (h: Harness) => Screen | Promise<Screen>;
const spec = (name: string) => command(name) as never;
const set = <T extends object>(s: T, fields: Record<string, unknown>) => Object.assign(s, fields);

const SCREENS: Record<string, Build> = {
  read: (h) => set(new ReadScreen(spec("read"), h.app, {}, ["deploy"]), { result: READ, focus: 2 }),
  explain: (h) =>
    set(
      new ExplainScreen(spec("explain"), h.app, {}, [READ_ID], {
        event: READ_EVENT,
        contents: new Map(ITEMS.map((i) => [i.id, String(i.content)])),
      }),
      {
        result: EXPLAIN_RUN,
        focus: 1,
      },
    ),
  "write-preview": (h) => {
    const s = new WriteScreen(spec("write"), h.app, { content: "x", scope: "team:lantern" });
    return set(s, {
      preview: ran(
        ["check"],
        "/api/v1/items/check",
        { decision: "deny", reason: DENY.reason, policy_id: "fixture/write/team" },
        "",
      ),
      focus: 8,
    });
  },
  "write-denied": (h) =>
    set(new WriteScreen(spec("write"), h.app, { content: "x", scope: "team:lantern" }), {
      result: WRITE_DENIED,
    }),
  promote: (h) =>
    set(new PromoteScreen(spec("promote"), h.app, { to: "team:lantern" }, [id(1)]), {
      result: PROMOTED,
      focus: 4,
    }),
  grants: (h) => {
    h.app.results.push(READ);
    return set(new GrantsScreen(spec("grants"), h.app, {}, [id(1)]), {
      result: GRANTED,
      last: {
        item: id(1),
        changes: [
          { op: "add", spec: "person:sam,class=semantic,mode=read,expires=2026-12-01T00:00:00Z" },
        ],
      },
      focus: 1,
    });
  },
  events: (h) =>
    set(new EventsScreen(spec("events"), h.app), { result: EVENTS_RUN, focus: 5, selected: 2 }),
  policy: (h) => {
    const s = set(
      new PolicyScreen(spec("policy"), h.app, {}, [], { policy_id: "fixture/write/team" }),
      {
        result: POLICY_RUN,
        focus: 1,
      },
    );
    (s as unknown as { open: Set<string> }).open.add("write");
    return s;
  },
  who: (h) =>
    set(new WhoScreen(spec("who-can-read"), h.app, {}, [id(1)]), { result: WHO_RUN, focus: 3 }),
  supersede: (h) => {
    const s = set(new SupersedeScreen(spec("supersede"), h.app, {}, [id(2)]), {
      result: PLAN_RUN,
      plan: PLAN_RUN,
      focus: 1,
    });
    (s as unknown as { chosen: Set<string> }).chosen.add(id(1));
    return s;
  },
  item: (h) => {
    h.app.results.push(PAGE_READ);
    return set(new ItemScreen(spec("read --item"), h.app, {}, [id(1)]), {
      events: PAGE_EVENTS,
      result: PAGE_EVENTS,
      focus: 1,
    });
  },
};

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
  let run: { row: number; from: number; to: number; style: string } | undefined;
  for (const c of cells) {
    const style = key(c);
    if (run !== undefined && run.row === c.row && run.to === c.col - 1 && run.style === style)
      run.to = c.col;
    else {
      if (run !== undefined) out.push(`r${run.row} c${run.from}-${run.to} ${run.style}`);
      run = { row: c.row, from: c.col, to: c.col, style };
    }
  }
  if (run !== undefined) out.push(`r${run.row} c${run.from}-${run.to} ${run.style}`);
  return out;
}

const STATUS_SYMBOLS = new Set(["✓", "✗", "◆", "▲", "●", "ℹ", "+", "x", "?", "!", "*", "i"]);
const UNICODE_DRAWING = /[┌┐└┘─│▸▾✓✗◆▲·●ℹ█…]/;

describe("snapshot frames of the memory and audit screens", () => {
  for (const name of Object.keys(SCREENS))
    for (const [columns, rows] of SIZES)
      for (const mode of MODES)
        it(`${name} at ${columns}x${rows}, ${mode}`, async () => {
          const cwd = await tempDir();
          mkdirSync(join(cwd, "mem"));
          const h = await startHarness({
            cwd,
            home: cwd,
            env: ENV,
            given: GIVEN,
            options: {
              noColor: mode === "no-color",
              highContrast: mode === "high-contrast",
              ascii: mode === "ascii",
            },
            columns,
            rows,
          });
          const screen = await (SCREENS[name] as Build)(h);
          // Pushed as built: its answer is the fixture's, so opening runs nothing.
          (h.app as unknown as { stack: Screen[] }).stack.push(screen);
          const frame = await h.frame();
          const cells = await h.cells();
          const drawn = h.app.render(columns);
          await h.quit();
          expect(h.ran()).toEqual([]);
          expect(drawn).toHaveLength(rows);
          for (const line of drawn) expect(visibleWidth(line)).toBeLessThanOrEqual(columns);
          const coloured = cells.filter((c) => c.fg !== "default");
          if (mode === "no-color" || mode === "high-contrast") expect(coloured).toEqual([]);
          for (const c of coloured)
            expect(STATUS_SYMBOLS, `${name} r${c.row} c${c.col}`).toContain(c.char);
          if (mode === "ascii") expect(frame.join("\n")).not.toMatch(UNICODE_DRAWING);
          const text = `${frame.map((l) => l.replace(/\s+$/, "")).join("\n")}\n--- styles\n${styleRuns(cells).join("\n")}\n`;
          await expect(text).toMatchFileSnapshot(
            `__frames__/memory-${name}-${columns}x${rows}-${mode}.txt`,
          );
        });
});
