// A change of actor mid-session (card E8.15c review fix pass, findings 1, 2
// and 8; the lead's decision): every screen records the actor its results
// were made as, and after a change of actor (the reviewer handoff, Switch
// back, applying the workspace panel) no screen draws an answer made as
// another actor: it says whom it was made as and that r runs it again as the
// actor now. r rebuilds the command line from the workspace as it is now;
// Follow restarts as the new actor; the item page never builds its graph or
// its versions from another actor's answers. No frame, no plain or JSON
// view, nothing copied and nothing printed on quit holds what the plane
// returned to the earlier actor.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { command } from "../../src/registry.ts";
import { summaryText } from "../../src/tui/app.ts";
import type { EventsScreen } from "../../src/tui/screens/events.ts";
import type { ItemScreen } from "../../src/tui/screens/item.ts";
import { cli, fixtureCopy, tempDir, VALID_FROM } from "../helpers.ts";
import { type Harness, startHarness } from "./harness.ts";

const CTRL_S = "\x13";
const CTRL_O = "\x0f";
const ENTER = "\r";
const ESC = "\x1b";
const HOME = "\x1b[H";
const NOTE = "01950000-0000-7000-8000-00000000d001";
const TEAM = "01950000-0000-7000-8000-00000000d002";
const OLD = "01950000-0000-7000-8000-00000000d011";
const NEW = "01950000-0000-7000-8000-00000000d012";
const SECRET = "the alarm code is 4417";

/**
 * dana's workspace: a private note in person:dana, a team item whose lineage
 * names the note, a two-version chain in person:dana, and a grant on the team
 * item that only its owner is shown.
 */
async function workspace() {
  const cwd = await tempDir();
  const root = await fixtureCopy();
  const given = {
    owner: "dana",
    db: "engram.db",
    root,
    "import-valid-from": VALID_FROM,
    member: ["person:dana", "team:core"],
  };
  const flags = [
    ...["--owner", "dana", "--db", join(cwd, "engram.db"), "--root", root],
    ...["--import-valid-from", VALID_FROM, "--member", "person:dana", "--member", "team:core"],
  ];
  await writeFile(join(cwd, "lineage.json"), JSON.stringify({ lineage: [NOTE] }));
  await writeFile(join(cwd, "chain.json"), JSON.stringify({ lineage: [OLD] }));
  const steps = [
    ["write", "--id", NOTE, "--content", `dana's private note: ${SECRET}`],
    [
      ...["write", "--id", TEAM, "--content", "The team's fact.", "--scope", "team:core"],
      ...["--file", join(cwd, "lineage.json")],
    ],
    ["write", "--id", OLD, "--content", "Tuesday.", "--valid-from", "2026-10-01T00:00:00Z"],
    [
      ...["write", "--id", NEW, "--content", "Thursday.", "--valid-from", "2026-10-15T00:00:00Z"],
      ...["--file", join(cwd, "chain.json")],
    ],
    ["grants", TEAM, "--add", "person:eve,class=semantic,mode=read,expires=2026-12-01"],
  ];
  for (const s of steps) {
    const r = await cli([...s, ...flags], { cwd });
    expect(r.code, r.err).toBe(0);
  }
  return { cwd, given };
}

/**
 * What dana's answers hold that sam may not be shown: the note and the chain
 * live in person:dana. The grant to person:eve is named to the owner only by
 * Who can read (sam is shown the grant change's event in team:core, whose
 * reason is sam's to see), so it is that screen's mark alone.
 */
const MARKS = [NOTE, SECRET, "private note", OLD];

/** Every frame, view, copy and summary after the switch, checked for dana's answers. */
async function holdsNothingOfDana(h: Harness, frames: string[], marks: readonly string[]) {
  const seen: string[] = [...frames];
  seen.push(await h.text());
  await h.press("v");
  seen.push(await h.text());
  await h.press(ESC, "J");
  seen.push(await h.text());
  await h.press(ESC, "c");
  const summary = await h.quit();
  seen.push(summary.deferred.join("\n"), summaryText(summary, "posix", false));
  for (const s of seen)
    for (const m of marks) expect(s, `"${m}" after the switch`).not.toContain(m);
}

type Open = (h: Harness) => Promise<void>;

const SCREENS: Record<string, { open: Open; mark: string }> = {
  "the item page": {
    // dana's read returns her note too, so the session holds its state: the page must not use it for sam.
    open: async (h) => {
      await h.press("r", CTRL_S, "y", ESC, ESC);
      h.app.openCommand(command("read --item") as never, {}, [TEAM]);
      await h.app.settled();
      if (h.overlay() === "confirm") await h.press("y");
    },
    mark: NOTE,
  },
  Read: { open: (h) => h.press("r", CTRL_S, "y"), mark: SECRET },
  // The first event, dana's write of her note: its detail names the note.
  Events: { open: (h) => h.press("e", HOME, ENTER), mark: NOTE },
  Explain: { open: (h) => h.press("r", CTRL_S, "y", "e"), mark: NOTE },
  "Who can read": {
    open: async (h) => {
      h.app.openCommand(command("who-can-read") as never, {}, [TEAM]);
      await h.app.settled();
    },
    mark: "person:eve",
  },
  Supersede: {
    open: async (h) => {
      h.app.openCommand(command("supersede") as never, {}, [NEW]);
      await h.app.settled();
    },
    mark: OLD,
  },
};

/** The two ways an actor changes: the reviewer handoff, and the workspace panel applied. */
const SWITCHES: Record<string, (h: Harness) => Promise<void>> = {
  "the reviewer handoff": async (h) => {
    h.app.startHandoff("person:sam", ["team:core"]);
    await h.app.settled();
  },
  "the workspace panel": async (h) => {
    await h.press(CTRL_O);
    await h.focusField("as");
    await h.type("person:sam");
    await h.focusField("member");
    for (let i = 0; i < 2; i++) await h.press("\x7f");
    await h.type("team:core");
    await h.press(ENTER, CTRL_S);
    expect(h.screen()).not.toBe("workspace");
  },
};

describe("after a change of actor, no screen draws another actor's answer", () => {
  for (const [name, s] of Object.entries(SCREENS))
    for (const [how, change] of Object.entries(SWITCHES))
      it(`${name}, through ${how}`, async () => {
        const w = await workspace();
        const h = await startHarness({
          cwd: w.cwd,
          home: w.cwd,
          given: w.given,
          options: { noSaved: true },
        });
        await s.open(h);
        // dana sees it: the check is not vacuous.
        expect(await h.text()).toContain(s.mark);
        await change(h);
        expect(h.app.ws.actorLabel()).toContain("person:sam");
        const frames = [await h.text()];
        // The item page builds nothing from dana's answers: not its graph, not its versions (finding 1).
        if (h.screen() === "item")
          for (const m of MARKS)
            expect(
              JSON.stringify((h.app.top() as unknown as ItemScreen).page(h.app)),
            ).not.toContain(m);
        expect(frames[0]).toContain("made as person:dana");
        expect(frames[0]).toContain("r runs it again as you");
        // r runs the command again, as the actor now: the command line is rebuilt from the workspace.
        await h.press("r");
        if (h.overlay() === "confirm") await h.press("y");
        await h.app.settled();
        const last = h.ran().at(-1) ?? [];
        expect(last).toContain("person:sam");
        expect(last.join(" ")).not.toMatch(/--member person:dana/);
        frames.push(await h.text());
        await holdsNothingOfDana(h, frames, [...new Set([...MARKS, s.mark])]);
      });
});

describe("Follow after a change of actor", () => {
  it("stops polling as the earlier actor and restarts as the new one", async () => {
    const w = await workspace();
    const h = await startHarness({
      cwd: w.cwd,
      home: w.cwd,
      given: w.given,
      options: { noSaved: true },
    });
    await h.press("e");
    const screen = h.app.top() as unknown as EventsScreen;
    await h.focusField("events");
    await h.press("f");
    expect(screen.following()).toBe(true);
    h.app.startHandoff("person:sam", ["team:core"]);
    await screen.pollNow(h.app);
    // The poll asked as sam, for every event sam may see, and kept following.
    expect(screen.following()).toBe(true);
    const shown = await h.text();
    expect(shown).not.toContain("made as person:dana");
    for (const m of MARKS) expect(shown).not.toContain(m);
    expect(screen.events().every((e) => !MARKS.includes(e.item_id ?? ""))).toBe(true);
    await h.quit();
  });

  it("does not poll while another screen covers it", async () => {
    const w = await workspace();
    const h = await startHarness({
      cwd: w.cwd,
      home: w.cwd,
      given: w.given,
      options: { noSaved: true },
    });
    await h.press("e");
    const screen = h.app.top() as unknown as EventsScreen;
    await h.focusField("events");
    await h.press("f");
    const before = screen.events().length;
    await h.press("o");
    if (h.overlay() === "confirm") await h.press("y");
    await cli(
      [
        "write",
        "--content",
        "Later.",
        "--owner",
        "dana",
        "--db",
        join(w.cwd, "engram.db"),
        "--root",
        w.given.root,
      ],
      { cwd: w.cwd },
    );
    await screen.pollNow(h.app);
    expect(screen.events().length).toBe(before);
    await h.quit();
  });
});

describe("the same principal at another level is another actor (re-verification 4)", () => {
  it("dana's answer as a person is not drawn for dana at level team", async () => {
    const w = await workspace();
    const h = await startHarness({
      cwd: w.cwd,
      home: w.cwd,
      given: w.given,
      options: { noSaved: true },
    });
    await h.press("r", CTRL_S, "y");
    expect(await h.text()).toContain(SECRET);
    h.app.ws.set("level", "team", "set");
    h.app.recheck(false);
    const text = await h.text();
    expect(text).toContain("This answer was made as person:dana (person) as a member of");
    expect(text).not.toContain(SECRET);
    await h.quit();
  });
});

describe("the same principal with other memberships is another actor (verification N3)", () => {
  it("dana drops team:core: the team item is no longer shown, before r or after", async () => {
    const w = await workspace();
    const h = await startHarness({
      cwd: w.cwd,
      home: w.cwd,
      given: w.given,
      options: { noSaved: true },
      columns: 120,
      rows: 40,
    });
    await h.press("r", CTRL_S, "y");
    expect(await h.text()).toContain("The team's fact.");
    h.app.openCommand(command("read --item") as never, {}, [TEAM]);
    await h.app.settled();
    expect(await h.text()).toContain("The team's fact.");
    // The workspace panel: Member of loses team:core.
    await h.press(CTRL_O);
    await h.focusField("member");
    await h.press("\x7f", ENTER, CTRL_S);
    expect(h.app.ws.list("member")).toEqual(["person:dana"]);
    const page = h.app.top() as unknown as ItemScreen;
    expect(JSON.stringify(page.page(h.app))).not.toContain("The team's fact.");
    let text = await h.text();
    expect(text).toContain("made as person:dana (person) as a member of person:dana, team:core");
    expect(text).not.toContain("The team's fact.");
    await h.press("r");
    if (h.overlay() === "confirm") await h.press("y");
    text = await h.text();
    expect(text).not.toContain("The team's fact.");
    await h.press(ESC);
    expect(await h.text()).not.toContain("The team's fact.");
    await h.quit();
  });
});

// Card E8.15d's screens whose answers are made as an actor: Retention sweep,
// Lint, Export and Import. Doctor, Simulate, Keys and Log verify answer for
// no actor (their requests name none), so a change of actor leaves them drawn.
const SURFACES: Record<string, { open: Open; mark: string }> = {
  "Retention sweep": { open: (h) => h.press("t", CTRL_S, "y"), mark: "as person:dana:" },
  Lint: {
    open: async (h) => {
      await h.press("l");
      await h.type("person:dana");
      await h.press(CTRL_S);
    },
    mark: "as person:dana:",
  },
  Export: {
    open: async (h) => {
      await h.press("x");
      await h.type("dana.jsonl");
      await h.press(CTRL_S, "y");
    },
    mark: "as person:dana under",
  },
};

describe("after a change of actor, card E8.15d's screens draw no other actor's answer", () => {
  for (const [name, s] of Object.entries(SURFACES))
    for (const [how, change] of Object.entries(SWITCHES))
      it(`${name}, through ${how}`, async () => {
        const w = await workspace();
        const h = await startHarness({
          cwd: w.cwd,
          home: w.cwd,
          given: w.given,
          options: { noSaved: true },
        });
        await s.open(h);
        expect(await h.text()).toContain(s.mark);
        await change(h);
        expect(h.screen()).toBe("surface");
        const frames = [await h.text()];
        expect(frames[0]).toContain("made as person:dana");
        expect(frames[0]).toContain("r runs it again as you");
        await h.press("r");
        if (h.overlay() === "confirm") await h.press("y");
        await h.app.settled();
        expect(h.ran().at(-1)).toContain("person:sam");
        frames.push(await h.text());
        for (const f of frames.slice(1)) expect(f).not.toContain(s.mark);
        await h.quit();
      });

  it("Simulate's answer, made as no one, is still drawn after a change of actor", async () => {
    const w = await workspace();
    const h = await startHarness({
      cwd: w.cwd,
      home: w.cwd,
      given: w.given,
      options: { noSaved: true },
    });
    await h.press("s", CTRL_S);
    expect(await h.text()).toContain("workload empty");
    await SWITCHES["the reviewer handoff"]?.(h);
    const text = await h.text();
    expect(text).toContain("workload empty");
    expect(text).not.toContain("made as");
    await h.quit();
  });
});
