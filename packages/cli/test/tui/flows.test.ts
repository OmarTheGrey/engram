// Key flows of the memory and audit screens (card E8.15c, docs/design/tui.md
// 8.5 to 8.8, 8.16 to 8.19, 8.22, 8.26 and 13), typed through a FakeTerminal
// as a person types them, on the real App over a temporary workspace: the
// files adapter on a copy of the fixture store, a SQLite log, a fixed clock
// and counted ids. Every decision on screen is the one the answer carried,
// its reason and policy id verbatim.
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Fetch } from "../../src/connect.ts";
import { command } from "../../src/registry.ts";
import type { EventsScreen, PolicyScreen } from "../../src/tui/screens/events.ts";
import type { GrantsScreen } from "../../src/tui/screens/grants.ts";
import type { ItemScreen } from "../../src/tui/screens/item.ts";
import { type ReadScreen, reachLine } from "../../src/tui/screens/read.ts";
import { outputLines } from "../../src/tui/screens/rich.ts";
import type { PromoteScreen, WriteScreen } from "../../src/tui/screens/write.ts";
import { ASCII } from "../../src/tui/theme.ts";
import { cli, fixtureCopy, NOW, tempDir, VALID_FROM } from "../helpers.ts";
import { type HarnessOptions, startHarness } from "./harness.ts";

const ENTER = "\r";
const TAB = "\t";
const ESC = "\x1b";
const CTRL_S = "\x13";
const CTRL_O = "\x0f";
const DOWN = "\x1b[B";
const RIGHT = "\x1b[C";

const ITEM = "01950000-0000-7000-8000-00000000c001";
const OLD = "01950000-0000-7000-8000-00000000c011";
const NEW = "01950000-0000-7000-8000-00000000c012";

/** Every request a TUI made, through the client transport. */
function counting() {
  const calls: { method: string; path: string; body: string }[] = [];
  const transport =
    (fetch: Fetch): Fetch =>
    async (request) => {
      calls.push({
        method: request.method,
        path: new URL(request.url).pathname,
        body: await request.clone().text(),
      });
      return fetch(request);
    };
  return { calls, transport };
}

/** dana's workspace: a copy of the fixture store, a SQLite log, both relative to a temporary cwd. */
async function workspace(extra: Record<string, string | string[]> = {}) {
  const cwd = await tempDir();
  const root = await fixtureCopy();
  const valid = { "import-valid-from": VALID_FROM };
  const given = { owner: "dana", db: "engram.db", root, ...valid, ...extra };
  const flags = [
    ...["--owner", "dana", "--db", join(cwd, "engram.db"), "--root", root],
    ...["--import-valid-from", VALID_FROM],
  ];
  return { cwd, root, given, flags };
}

async function start(w: Awaited<ReturnType<typeof workspace>>, more: Partial<HarnessOptions> = {}) {
  const counter = counting();
  const h = await startHarness({
    cwd: w.cwd,
    home: w.cwd,
    given: w.given,
    transport: counter.transport,
    ...more,
  });
  return { h, calls: counter.calls };
}

/** The frame's text with box drawing removed and white space collapsed, so a wrapped sentence reads whole. */
const flat = async (h: Awaited<ReturnType<typeof startHarness>>) =>
  (await h.text()).replace(/[│┌┐└┘─]/g, " ").replace(/\s+/g, " ");

/** The text inside the open dialog's box, one sentence however it wraps. */
const dialog = async (h: Awaited<ReturnType<typeof startHarness>>) =>
  (await h.frame())
    .flatMap((l) => {
      const a = l.indexOf("│");
      const b = l.lastIndexOf("│");
      return a >= 0 && b > a ? [l.slice(a + 1, b)] : [];
    })
    .join(" ")
    .replace(/\s+/g, " ");

const top = <T>(h: Awaited<ReturnType<typeof startHarness>>) => h.app.top() as unknown as T;

describe("Read and explain (8.5, 8.6)", () => {
  it("asks before the first read with a store folder, before any call; the second read does not ask", async () => {
    const w = await workspace();
    const { h, calls } = await start(w);
    await h.press("r", CTRL_S);
    expect(h.overlay()).toBe("confirm");
    const asked = await dialog(h);
    expect(asked).toContain("sweeps the owner's retention");
    expect(asked).toContain("any item past its ttl is retired for good");
    expect(calls).toEqual([]);
    await h.press("y");
    expect(calls.map((c) => c.path)).toEqual(["/api/v1/read"]);
    expect(h.screen()).toBe("read");
    const text = await h.text();
    // Decision first, then the lanes and the selected item's explanation.
    expect(text).toMatch(/read 0193\S+ {2}✓ allow {3}4 items returned, 0 fil/);
    expect(text).toMatch(/│ > {2}1 {2}semantic/);
    expect(text).toContain("Person scope");
    expect(text).toContain("admitted by");
    expect(h.app.top().command(h.app)).toMatchObject({ exit: 0 });
    // The command row: the read as it ran, and the first read says nothing more (it asked).
    expect(text).toContain("$ engram read");
    expect(text).not.toContain("also changes the log, as asked");
    // esc goes back to the query; the second read in the session does not ask.
    await h.press(ESC);
    expect(h.focused()).toBe("pos:query");
    await h.press(CTRL_S);
    expect(h.overlay()).toBeUndefined();
    expect(h.ran()).toHaveLength(2);
    // A later read says, on its own row above the command row, what the first asked about (8.5, N5).
    const rows = (await h.frame()).map((l) => l.trimEnd());
    expect(rows.at(-3)).toContain("This read also changes the log, as asked");
    expect(rows.at(-2)).not.toContain("as asked");
    await h.quit();
  });

  it("says one projected item out of reach in the singular", () => {
    expect(reachLine(1)).toBe(" 1 projected item outside the reader's reach was not a candidate.");
    expect(reachLine(0)).toBe(" 0 projected items outside the reader's reach were not candidates.");
  });

  it("e explains the read; enter on a row opens the item page", async () => {
    const w = await workspace();
    const { h } = await start(w);
    await h.press("r", CTRL_S, "y", "e");
    expect(h.screen()).toBe("explain");
    let text = await h.text();
    expect(text).toContain("Returned 4 of 4 candidates; 0 filtered.");
    expect(text).toContain("outside the validity window");
    expect(text).toContain("projected items outside the reader's reach were not candidates.");
    expect(h.ran().at(-1)?.[0]).toBe("explain");
    await h.press(ENTER);
    expect(h.screen()).toBe("item");
    text = await h.text();
    expect(text).toContain("Provenance");
    expect(text).toContain("Events naming this item");
    expect(h.ran().at(-1)?.[0]).toBe("events");
    await h.quit();
  });

  it("explains another reader's read with the CLI's error and no remedy", async () => {
    const w = await workspace();
    const plain = await cli(["read", ...w.flags, "--json"], { cwd: w.cwd });
    const readId = JSON.parse(plain.out).read_id as string;
    const { h } = await start(w, { given: { as: "person:sam", db: "engram.db" } });
    h.app.openCommand(command("explain") as never, {}, [readId]);
    await h.press(CTRL_S);
    const text = await h.text();
    expect(text).toContain("✗ refused   exit 1");
    expect(text).toContain("only its reader may explain it");
    await h.quit();
  });
});

describe("Write with the check preview (8.7)", () => {
  it("shows a denied preview's reason and policy id verbatim, moves to Class and Scope, then records the denial", async () => {
    const w = await workspace({ member: ["team:platform"] });
    const { h, calls } = await start(w);
    await h.press("w");
    expect(h.screen()).toBe("write");
    await h.type("x");
    await h.focusField("scope");
    await h.type("team:platform");
    await h.focusField("class");
    await h.press(RIGHT); // episodic
    await h.focusField("check");
    await h.press(ENTER);
    const screen = top<WriteScreen>(h);
    const p = screen.previewAnswer();
    expect(p?.decision).toBe("deny");
    let text = (await h.frame()).join(" ").replace(/\s+/g, " ");
    expect(text).toContain("The gate would ✗ deny");
    expect(text).toContain(p?.reason.replace(/\s+/g, " ") as string);
    expect(text).toContain(`(${p?.policy_id})`);
    expect(text).toContain("preview, nothing stored");
    expect(text).toContain("Record this write (the gate will deny it)");
    // A check, never a write, and nothing stored.
    expect(calls.map((c) => c.path)).toEqual(["/api/v1/items/check"]);
    await h.focusField("change-class");
    await h.press(ENTER);
    expect(h.focused()).toBe("class");
    await h.focusField("change-scope");
    await h.press(ENTER);
    expect(h.focused()).toBe("scope");
    await h.press(CTRL_S);
    expect(h.overlay()).toBe("confirm");
    expect(await h.text()).toContain("The gate would (preview): deny");
    await h.press("y");
    text = await h.text();
    const lines = text.split("\n");
    expect(lines[1]).toMatch(/✗ deny {3}exit 1/);
    const out = h.app.results.at(-1)?.out ?? "";
    const reason = out.split("\n")[1] as string;
    expect(reason.startsWith("deny: ")).toBe(true);
    expect(text.replace(/\s+/g, " ")).toContain(reason.replace(/\s+/g, " "));
    expect(text).toContain(out.split("\n")[2] as string); // policy <id>, verbatim
    expect(text).toMatch(/Nothing was stored\. The decision is event \d+ in the log\./);
    expect(calls.map((c) => c.path).at(-1)).toBe("/api/v1/items");
    await h.quit();
  });

  it("runs the preview after a pause, never on every key", async () => {
    const w = await workspace();
    const { h, calls } = await start(w);
    await h.press("w");
    await h.type("The deploy key rotates every 90 days.");
    expect(calls).toEqual([]);
    await new Promise((r) => setTimeout(r, 600));
    await top<WriteScreen>(h).previewed();
    expect(calls.map((c) => c.path)).toEqual(["/api/v1/items/check"]);
    expect(top<WriteScreen>(h).previewAnswer()?.decision).toBe("allow");
    expect(await h.text()).toContain("The gate would  ✓ allow");
    // The preview is a look, not a command of the session.
    expect(h.ran()).toEqual([]);
    await h.quit();
  });
});

/** A plain write of ITEM as dana, then the TUI's read of the store with it in. */
async function withItem(extra: Record<string, string | string[]> = {}) {
  const w = await workspace(extra);
  const wrote = await cli(
    ["write", ...w.flags, "--id", ITEM, "--content", "The deploy key rotates every 90 days."],
    { cwd: w.cwd },
  );
  expect(wrote.code).toBe(0);
  return w;
}

describe("Promote and the reviewer handoff (8.8)", () => {
  it("shows a denied promotion, hands off to a reviewer who may approve it, for this session only, and Switch back undoes it", async () => {
    // The design's case: a team item of dana's, widened to org, which needs a reviewer (review finding 3).
    const w = await workspace({ member: ["person:dana", "team:core"] });
    const wrote = await cli(
      [
        ...["write", ...w.flags, "--id", ITEM, "--content", "The team ships on Thursdays."],
        ...["--scope", "team:core", "--member", "team:core"],
      ],
      { cwd: w.cwd },
    );
    expect(wrote.code, wrote.err).toBe(0);
    const { h } = await start(w);
    await h.press("r", CTRL_S, "y", ESC);
    h.app.openCommand(command("promote") as never, { to: "org" }, [ITEM]);
    await h.press(CTRL_S);
    expect(h.overlay()).toBe("confirm");
    await h.press("y");
    let text = await h.text();
    const out = h.app.results.at(-1)?.out ?? "";
    expect(text).toMatch(/✗ deny {3}exit 1/);
    expect(text).toContain(out.split("\n")[2] as string); // policy <id>
    expect(text).toContain("Promotions cannot be undone from here.");
    expect(h.focused()).toBe("handoff");
    await h.press(ENTER);
    expect(h.focused()).toBe("reviewer");
    await h.type("person:sam");
    await h.press(TAB);
    // Member of, prefilled from the item: the target and the item's own scope, and editable.
    expect(h.focused()).toBe("members");
    expect(await h.text()).toContain("[ org, team:core");
    await h.press(TAB, ENTER);
    expect(h.overlay()).toBe("confirm");
    text = await dialog(h);
    expect(text).toContain("Acting as becomes person:sam and Member of becomes org, team:core");
    expect(text).toContain("for this session only");
    await h.press("y");
    expect(h.screen()).toBe("promote");
    const again = top<PromoteScreen>(h);
    expect(again.form.get("review")).toBe(true);
    expect(again.form.get("pos:itemId")).toBe(ITEM);
    expect(h.app.ws.get("as")).toBe("person:sam");
    expect(h.app.ws.list("member")).toEqual(["org", "team:core"]);
    expect((await h.frame())[0]).toContain("person:sam (person) reviewer");
    // Never saved: tui.json keeps the actor and memberships from before.
    h.app.save();
    const saved = readFileSync(join(w.cwd, ".engram", "tui.json"), "utf8");
    expect(saved).not.toContain("person:sam");
    expect(JSON.parse(saved).flags.member).toEqual(["person:dana", "team:core"]);
    // The reviewer's promotion is the plane's answer: here it lands.
    await h.press(CTRL_S, "y");
    expect(h.ran().at(-1)).toContain("--review");
    expect(h.ran().at(-1)).toContain("person:sam");
    expect(h.app.results.at(-1)?.code).toBe(0);
    expect(await h.text()).toMatch(/✓ allow {3}exit 0/);
    // Switch back in the workspace panel.
    await h.press(ESC, CTRL_O);
    expect(h.screen()).toBe("workspace");
    expect(h.focused()).toBe("switch-back");
    expect(await flat(h)).toContain("Switch back restores person:dana (person)");
    await h.press(ENTER);
    expect(h.app.handoff).toBeUndefined();
    expect(h.app.ws.get("as")).toBeUndefined();
    expect(h.app.ws.list("member")).toEqual(["person:dana", "team:core"]);
    expect((await h.frame())[0]).not.toContain("reviewer");
    await h.quit();
  });

  it("does not offer the handoff against a server with credentials", async () => {
    const event = {
      id: "01950000-0000-7000-8000-00000000e001",
      seq: 7,
      ts: NOW,
      op: "promote",
      decision: "deny",
      actor: "person:dana",
      item_id: ITEM,
      item_ids: null,
      scope_from: "person:dana",
      scope_to: "team:platform",
      policy_id: "fixture/promote/rule",
      reason: "a fixture refuses it",
      item: null,
    };
    const fetch: Fetch = async (request) => {
      const path = new URL(request.url).pathname;
      if (path.endsWith("/health")) return Response.json({ ok: true });
      return Response.json({ decision: "deny", event, events: [event], item: null });
    };
    for (const token of ["a-key", undefined]) {
      const cwd = await tempDir();
      const h = await startHarness({
        cwd,
        home: cwd,
        given: { owner: "dana", server: "http://engram.test" },
        env: token === undefined ? {} : { ENGRAM_TOKEN: token },
        fetch,
      });
      h.app.openCommand(command("promote") as never, { to: "team:platform" }, [ITEM]);
      await h.press(CTRL_S, "y");
      const text = await flat(h);
      expect(text).toContain("✗ deny");
      expect(text).toContain("a fixture refuses it");
      if (token === undefined) expect(text).toContain("Switch to a reviewer and approve");
      else {
        expect(text).not.toContain("Switch to a reviewer");
        expect(text).toContain("Against a server with credentials");
      }
      await h.quit();
    }
  });
});

describe("Grants with undo (8.19, 9.6)", () => {
  it("adds a grant, then u undoes it as a new governed change", async () => {
    const w = await withItem();
    const { h } = await start(w);
    await h.press("r", CTRL_S, "y");
    const read = top<ReadScreen>(h);
    for (let i = 0; i < 10 && read.selectedItem()?.id !== ITEM; i++) await h.press(DOWN);
    expect(read.selectedItem()?.id).toBe(ITEM);
    await h.press("g");
    expect(h.screen()).toBe("grants");
    expect(await h.text()).toContain("You own this item: every grant is shown.");
    await h.focusField("to");
    await h.type("person:sam");
    await h.focusField("expires");
    await h.type("2026-12-01");
    await h.press(CTRL_S);
    expect(h.overlay()).toBe("confirm");
    expect(await dialog(h)).toContain(
      "--add person:sam,class=semantic,mode=read,expires=2026-12-01T00:00:00Z",
    );
    await h.press("y");
    let text = await h.text();
    expect(text).toContain("✓ allow");
    expect(text).toContain("person:sam: semantic, read, until 2026-12-01T00:00:00Z");
    expect(text).toContain(`u undo on ${ITEM} (removes it again`);
    expect(top<GrantsScreen>(h).inField()).toBe(false);
    await h.press("u");
    expect(h.overlay()).toBe("confirm");
    text = await dialog(h);
    expect(text).toContain(
      "--remove person:sam,class=semantic,mode=read,expires=2026-12-01T00:00:00Z",
    );
    expect(text).toContain("This undoes the last change");
    await h.press("y");
    text = await h.text();
    expect(text).toContain("✓ allow");
    expect(text).not.toContain("person:sam: semantic");
    const ran = h.ran().slice(-2);
    expect(ran[0]).toEqual(expect.arrayContaining(["grants", ITEM, "--add"]));
    expect(ran[1]).toEqual(expect.arrayContaining(["grants", ITEM, "--remove"]));
    // Undo belongs to the item it changed: editing the item's field clears it (review finding 12).
    await h.focusField("pos:itemId");
    await h.press("");
    await h.focusField("send"); // off the fields, so u is a key, not a letter
    await h.press("u");
    expect(h.overlay()).toBeUndefined();
    expect(await h.text()).toContain("nothing to undo");
    await h.quit();
  });
});

describe("Events (8.16)", () => {
  it("lists the events, filters, finds, follows only while open, and opens an event's item", async () => {
    const w = await withItem();
    const { h, calls } = await start(w);
    await h.press("e");
    expect(h.screen()).toBe("events");
    const screen = top<EventsScreen>(h);
    let text = await h.text();
    expect(text).toMatch(/\d+ of \d+ events?/);
    expect(text).toContain("write");
    expect(h.ran()).toEqual([["events", "--db", "engram.db", "--owner", "dana"]]);
    await h.focusField("filter:decision");
    await h.press(RIGHT);
    expect(await h.text()).toContain("decision [ allow");
    await h.focusField("events");
    await h.press("f");
    expect(screen.following()).toBe(true);
    const before = screen.events().length;
    await cli(["write", ...w.flags, "--content", "A later memory."], { cwd: w.cwd });
    await screen.pollNow(h.app);
    expect(screen.events().length).toBe(before + 1);
    // The poll asked only for what is after the last seq seen, and is no command of the session.
    expect(calls.at(-1)?.body).toContain('"after"');
    expect(h.ran()).toHaveLength(1);
    await h.press(ENTER);
    text = await h.text();
    expect(text).toContain("policy id");
    expect(text).toContain("reason");
    await h.press("o");
    // No read of the item yet this session: the page reads it by id, a read with a store folder (8.5).
    expect(h.overlay()).toBe("confirm");
    await h.press("y");
    expect(h.screen()).toBe("item");
    expect(screen.following()).toBe(true);
    await h.press(ESC, ESC);
    expect(h.screen()).toBe("home");
    expect(screen.following()).toBe(false);
    await h.quit();
  });
});

describe("Policy (8.18)", () => {
  it("shows the policy in force as a foldable tree, read only, and finds in it", async () => {
    const w = await workspace();
    const { h } = await start(w);
    await h.press("y");
    expect(h.screen()).toBe("policy");
    const screen = top<PolicyScreen>(h);
    let text = await h.text();
    expect(text).toContain("read only");
    expect(text).toMatch(/▸ write/);
    await h.press(ENTER);
    await h.focusField("tree");
    for (let i = 0; i < 2; i++) await h.press(DOWN); // id, version, then write
    await h.press(ENTER);
    expect(await h.text()).toMatch(/▾ write/);
    expect(screen.rows().length).toBeGreaterThan(5);
    await h.press("/");
    expect(h.focused()).toBe("find");
    await h.type("forbidden");
    text = await h.text();
    expect(screen.rows().every((r) => r.depth === 0 || r.path.includes("."))).toBe(true);
    expect(text).toContain("forbidden");
    // ctrl+s does not run it again; r does.
    await h.press(CTRL_S);
    expect(h.ran()).toHaveLength(1);
    await h.press(TAB, "r");
    expect(h.ran()).toHaveLength(2);
    await h.quit();
  });
});

describe("Who can read (8.22)", () => {
  it("w on a read's item asks the plane and shows each reader with its rule", async () => {
    const w = await withItem();
    const { h } = await start(w);
    await h.press("r", CTRL_S, "y");
    const read = top<ReadScreen>(h);
    for (let i = 0; i < 10 && read.selectedItem()?.id !== ITEM; i++) await h.press(DOWN);
    await h.press("w");
    expect(h.screen()).toBe("who");
    const text = await h.text();
    expect(text).toContain("✓ answered");
    expect(text).toContain("every member of person:dana reading as person");
    expect(h.ran().at(-1)).toEqual(expect.arrayContaining(["who-can-read", ITEM]));
    await h.quit();
  });
});

describe("Supersede (8.26)", () => {
  it("plans, lets only a close be chosen, and accepts it through the write gate", async () => {
    const w = await workspace();
    const replacement = join(w.cwd, "replacement.json");
    await writeFile(replacement, JSON.stringify({ lineage: [OLD] }));
    for (const [id, content, from, more] of [
      [OLD, "The deploy window is Tuesday.", "2026-10-01T00:00:00Z", []],
      [NEW, "The deploy window is Thursday.", "2026-10-15T00:00:00Z", ["--file", replacement]],
    ] as const)
      expect(
        (
          await cli(
            ["write", ...w.flags, "--id", id, "--content", content, "--valid-from", from, ...more],
            { cwd: w.cwd },
          )
        ).code,
      ).toBe(0);
    const { h } = await start(w);
    h.app.openCommand(command("supersede") as never, {}, [NEW]);
    await h.app.settled(); // the plan runs on opening
    let text = await h.text();
    expect(text).toContain(`[ ] close  ${OLD}`);
    expect(h.ran()).toEqual([expect.arrayContaining(["supersede", NEW, "--root", w.root])]);
    await h.press(" ");
    expect(await h.text()).toContain(`[x] close  ${OLD}`);
    expect(h.app.top().command(h.app).argv).toEqual(expect.arrayContaining(["--accept", OLD]));
    await h.press(CTRL_S);
    expect(h.overlay()).toBe("confirm");
    await h.press("y");
    text = await h.text();
    expect(text).toContain("✓ allow");
    // The accept, then the plan again (review 11): the close is no longer offered.
    expect(h.ran().at(-2)).toEqual(expect.arrayContaining(["--accept", OLD]));
    expect(h.ran().at(-1)).not.toContain("--accept");
    expect(await h.text()).not.toContain(`[x] close  ${OLD}`);
    await h.quit();
  });
});

describe("the item page's leak rule (8.17, card E8.11)", () => {
  it("never shows a viewer an ancestor it cannot read, in any frame", async () => {
    const w = await workspace();
    const note = "01950000-0000-7000-8000-00000000d001";
    const team = "01950000-0000-7000-8000-00000000d002";
    const lineage = join(w.cwd, "lineage.json");
    await writeFile(lineage, JSON.stringify({ lineage: [note] }));
    expect(
      (
        await cli(["write", ...w.flags, "--id", note, "--content", "dana's private note"], {
          cwd: w.cwd,
        })
      ).code,
    ).toBe(0);
    expect(
      (
        await cli(
          [
            "write",
            ...w.flags,
            ...["--id", team, "--content", "The team's fact.", "--scope", "team:core"],
            ...["--member", "team:core", "--member", "person:dana", "--file", lineage],
          ],
          { cwd: w.cwd },
        )
      ).code,
    ).toBe(0);
    // dana sees both, linked: the rule is not vacuous.
    const dana = await start(w, {
      given: { ...w.given, member: ["person:dana", "team:core"] },
    });
    dana.h.app.openCommand(command("read --item") as never, {}, [team]);
    await dana.h.app.settled();
    await dana.h.press("y"); // the read by id, with a store folder, asks first
    expect(await dana.h.text()).toContain(note);
    await dana.h.quit();
    // sam, a member of team:core only, may not read the note.
    const { h } = await start(w, {
      given: { ...w.given, as: "person:sam", member: ["team:core"] },
    });
    const frames: string[] = [];
    const shoot = async () => frames.push(await h.text());
    await h.press("r", CTRL_S, "y");
    await shoot();
    h.app.openCommand(command("read --item") as never, {}, [team]);
    await h.app.settled();
    expect(h.screen()).toBe("item");
    const page = top<ItemScreen>(h).page(h.app);
    expect(page.graph?.nodes.map((n) => n.id)).toContain(team);
    for (const pane of ["provenance", "versions", "events"]) {
      await h.focusField(pane);
      for (let i = 0; i < 4; i++) {
        await shoot();
        await h.press(DOWN);
      }
      await h.press(ENTER);
      await shoot();
    }
    for (const size of [
      [120, 40],
      [80, 24],
    ] as const) {
      await h.resize(size[0], size[1]);
      await shoot();
    }
    expect(frames.join("\n")).toContain(team.slice(0, 20));
    for (const f of frames) expect(f).not.toContain(note);
    expect(frames.join("\n")).not.toContain("private note");
    await h.quit();
  });
});

describe("text fields take every printable key", () => {
  it("types : ; ? q c j v J p g w e S u f / and space into Write's content and Read's query", async () => {
    const w = await workspace();
    const { h } = await start(w);
    const keys = ":;?qcjvJpgweSuf/ x";
    await h.press("w");
    await h.type(keys);
    expect(top<WriteScreen>(h).form.get("content")).toBe(keys);
    expect(h.overlay()).toBeUndefined();
    await h.press(ESC, "y", "r");
    await h.type(keys);
    expect(top<ReadScreen>(h).form.get("pos:query")).toBe(keys);
    expect(h.screen()).toBe("read");
    expect(existsSync(join(w.cwd, "engram.db"))).toBe(false);
    await h.quit();
  });
});

describe("found driving the real terminal (E8.15c's pseudoconsole pass)", () => {
  it("keeps a confirmation's buttons in sight when its command is long", async () => {
    const w = await workspace();
    const long = join(
      w.cwd,
      ...Array.from({ length: 16 }, (_, i) => `a-folder-with-a-long-name-${i}`),
    );
    const { h } = await start(w, { given: { ...w.given, db: join(long, "engram.db") } });
    await h.press("w");
    await h.type("x");
    await h.press(CTRL_S);
    expect(h.overlay()).toBe("confirm");
    const asked = await dialog(h);
    expect(asked).toContain("[ Cancel ]");
    expect(asked).toContain("[ Write ]");
    expect(asked).toContain("cut to fit the dialog; it runs whole");
    await h.press("n");
    await h.quit();
  });

  it("wraps an output line whose word is wider than the pane without splitting the word", () => {
    const word = "C:/a/very/long/path/with/no/spaces/in/it/at/all/engram.db";
    const r = { argv: [], code: 0, out: `log ${word}${word}\n`, err: "", calls: [] };
    const lines = outputLines(r, 40);
    // Every piece of the long word is the word's own text: no space was put inside it.
    expect(lines.map((l) => l.trim()).join(" ")).toBe(
      `log ${lines
        .slice(1)
        .map((l) => l.trim())
        .join(" ")}`.trim(),
    );
    const rejoined = lines
      .map((l) => l.trim())
      .join("")
      .replace(/^log/, "");
    expect(rejoined).toBe(`${word}${word}`);
  });
});

describe("the review fix pass (E8.15c)", () => {
  it("7: Open the event for an event the viewer may not see says so and selects nothing", async () => {
    // An allowed write first, so the timeline has an event that could be selected in its place.
    const w = await withItem();
    const { h } = await start(w);
    await h.press("w");
    await h.type("x");
    await h.focusField("scope");
    await h.type("team:platform");
    await h.press(CTRL_S, "y");
    expect(await h.text()).toMatch(/✗ deny {3}exit 1/);
    await h.focusField("event");
    await h.press(ENTER);
    expect(h.screen()).toBe("events");
    const text = await h.text();
    expect(text).toMatch(/event \d+ is not one you may see; nothing is selected/);
    expect(text.split("\n").filter((l) => /^ >\s+\d/.test(l))).toEqual([]);
    expect(text).not.toContain("Events show to their maker");
    expect(text).toMatch(/1 of 1 event/);
    await h.quit();
  });

  it("9: Who can read sends nothing more on ctrl+s when it ran on opening and nothing changed", async () => {
    const w = await withItem();
    const { h, calls } = await start(w);
    h.app.openCommand(command("who-can-read") as never, {}, [ITEM]);
    await h.app.settled();
    const asked = calls.length;
    expect(asked).toBe(1);
    await h.press(CTRL_S);
    expect(calls.length).toBe(asked);
    await h.press("r");
    expect(calls.length).toBe(asked + 1);
    await h.quit();
  });

  it("13: J after a failed run says the command failed before it printed", async () => {
    const w = await workspace();
    const { h } = await start(w);
    h.app.openCommand(command("explain") as never, {}, ["01930000-0000-7000-8000-0000000fffff"]);
    await h.press(CTRL_S);
    expect(h.app.results.at(-1)?.code).not.toBe(0);
    await h.press("J");
    expect(await h.text()).toContain("The command failed before it printed (exit 1):");
    await h.quit();
  });

  it("10: Write marks the fields From file sets, until they are edited", async () => {
    const w = await workspace();
    await writeFile(
      join(w.cwd, "item.json"),
      JSON.stringify({ scope: "team:core", content: "From the file." }),
    );
    const { h } = await start(w);
    await h.press("w");
    await h.focusField("file");
    await h.type("item.json");
    const rows = (await h.frame()).filter((l) => l.includes("from file"));
    expect(rows.map((l) => l.trim().split(/\s+/)[0])).toEqual(["Content", "Scope"]);
    await h.quit();
  });

  it("UX: S on an item that is not its chain's head offers the head", async () => {
    const w = await workspace();
    const replacement = join(w.cwd, "replacement.json");
    await writeFile(replacement, JSON.stringify({ lineage: [OLD] }));
    for (const [id, content, more] of [
      [OLD, "Tuesday.", []],
      [NEW, "Thursday.", ["--file", replacement]],
    ] as const)
      expect(
        (
          await cli(["write", ...w.flags, "--id", id, "--content", content, ...more], {
            cwd: w.cwd,
          })
        ).code,
      ).toBe(0);
    const { h } = await start(w);
    h.app.openCommand(command("supersede") as never, {}, [OLD]);
    await h.app.settled();
    expect(await flat(h)).toContain(`This item is not the head of its chain; ${NEW} is.`);
    await h.focusField("head");
    await h.press(ENTER);
    expect(h.ran().at(-1)).toEqual(expect.arrayContaining(["supersede", NEW]));
    await h.quit();
  });
});

describe("the verification's findings (E8.15c)", () => {
  it("N5: the later-read note follows the read that asked, whatever else the session's command list holds", async () => {
    const w = await workspace();
    const { h } = await start(w);
    // A command the summary lists with no result of the TUI's (E8.15d's record() does this).
    h.app.ran.push({ argv: ["serve", "--insecure-loopback"], code: 0 });
    await h.press("r", CTRL_S, "y");
    expect(await h.text()).not.toContain("also changes the log, as asked");
    await h.press(ESC, CTRL_S);
    expect((await h.frame()).at(-3)).toContain("This read also changes the log, as asked");
    await h.quit();
  });

  it("N4: the handoff never prefills another person's scope", async () => {
    const w = await withItem({ member: ["person:dana"] });
    const { h } = await start(w);
    await h.press("r", CTRL_S, "y", ESC);
    h.app.openCommand(command("promote") as never, { to: "team:core" }, [ITEM]);
    await h.press(CTRL_S, "y");
    expect(h.focused()).toBe("handoff");
    await h.press(ENTER);
    const members = (
      h.app.top() as unknown as { extras: Map<string, { value: string }> }
    ).extras.get("members");
    expect(members?.value).toBe("team:core");
    await h.quit();
  });

  it("N5: the ASCII closed fold is no other ASCII glyph and not the selection mark", () => {
    const { closed, ...rest } = ASCII;
    expect(Object.values(rest)).not.toContain(closed);
    expect(closed).not.toBe(">");
    expect([...closed].every((c) => c.charCodeAt(0) < 128)).toBe(true);
  });
});

describe("the write preview's check is sent once for the same input (the flake of 2026-11-23)", () => {
  /** A scheduler the test fires by hand: the preview's pause, without a clock. */
  function manual() {
    const pending: (() => void)[] = [];
    return {
      pending,
      schedule: (fn: () => void) => {
        pending.push(fn);
        return { cancel: () => pending.splice(pending.indexOf(fn), 1) };
      },
      fire: async () => {
        for (const fn of pending.splice(0)) fn();
      },
    };
  }

  it("Check again before the pause ends: the pause's own check is not sent too", async () => {
    const w = await workspace();
    const { h, calls } = await start(w);
    await h.press("w");
    const screen = top<WriteScreen>(h);
    const clock = manual();
    (screen as unknown as { schedule: typeof clock.schedule }).schedule = clock.schedule;
    await h.type("x");
    expect(clock.pending.length).toBe(1);
    await h.focusField("check");
    await h.press(ENTER);
    await screen.previewed();
    // The racing order: the pause ends after the person asked.
    await clock.fire();
    await screen.previewed();
    await h.app.settled();
    expect(calls.filter((c) => c.path === "/api/v1/items/check")).toHaveLength(1);
    await h.quit();
  });

  it("after a write, Check again on the same input checks again: the preview was cleared", async () => {
    const w = await workspace();
    const { h, calls } = await start(w);
    await h.press("w");
    const screen = top<WriteScreen>(h);
    (screen as unknown as { schedule: ReturnType<typeof manual>["schedule"] }).schedule =
      manual().schedule;
    await h.type("x");
    await h.focusField("check");
    await h.press(ENTER);
    await screen.previewed();
    await h.press(CTRL_S, "y");
    await h.focusField("retry");
    await h.press(ENTER);
    await h.focusField("check");
    await h.press(ENTER);
    await screen.previewed();
    expect(calls.filter((c) => c.path === "/api/v1/items/check")).toHaveLength(2);
    await h.quit();
  });

  it("the pause ends, then Check again with nothing changed: one check", async () => {
    const w = await workspace();
    const { h, calls } = await start(w);
    await h.press("w");
    const screen = top<WriteScreen>(h);
    const clock = manual();
    (screen as unknown as { schedule: typeof clock.schedule }).schedule = clock.schedule;
    await h.type("x");
    await clock.fire();
    await screen.previewed();
    await h.focusField("check");
    await h.press(ENTER);
    await screen.previewed();
    expect(calls.filter((c) => c.path === "/api/v1/items/check")).toHaveLength(1);
    // A change, and the next pause, checks again.
    await h.focusField("content");
    await h.type("y");
    await clock.fire();
    await screen.previewed();
    expect(calls.filter((c) => c.path === "/api/v1/items/check")).toHaveLength(2);
    await h.quit();
  });
});
