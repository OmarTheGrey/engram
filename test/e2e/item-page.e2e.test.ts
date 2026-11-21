// Layer 6 (docs/conventions/testing.md), card E8.11's acceptance in a real
// browser: an item's page in the inspector. The provenance fixture
// (fixtures/workspaces/inspector/provenance.json) is built at test time
// through the generated client in process and served with the built UI (make
// ui); Chromium, driven by the `playwright` library, opens it as dana.
//
// It checks the three views of the item page: the provenance graph (the item,
// its lineage and the decisions about them, laid out by dagre), the version
// diff (two versions side by side with the event that made the later one),
// and the event table. The leak test is the card's step 4: sam is a member
// of team:core and not of person:dana, so the note in dana's scope that the
// team items name in their lineage is an ancestor he cannot read, and his
// item page shows no node, no edge and no count that reveals it. Then the
// event table on a long log: tens of thousands of events, virtualised (a
// bounded number of rows in the page), sorted and filtered.
//
// Chromium comes from `pnpm exec playwright install chromium`. Locally a
// missing browser skips with the reason printed; under CI (CI set) it fails.
import { type Browser, chromium, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  builtUi,
  type Listening,
  listen,
  longLogWorkspace,
  provenanceWorkspace,
  UI_DIST,
} from "../../packages/ui/test/workspace.ts";

const ids = (n: number[]) => n.map((k) => `01980000-0000-7000-8000-${String(k).padStart(12, "0")}`);
/** The note in person:dana, the team item written from it, the team item written from both. */
const [NOTE, TEAM, CHECKLIST] = ids([1, 2, 3]) as [string, string, string];

async function launch(): Promise<{ browser: Browser } | { skip: string }> {
  try {
    return { browser: await chromium.launch() };
  } catch (e) {
    const reason = `Chromium is not available (${String(e).split("\n")[0]}); run pnpm exec playwright install chromium`;
    if (process.env.CI) throw new Error(reason);
    return { skip: reason };
  }
}

const launched = await launch();
const skip = "skip" in launched ? launched.skip : undefined;
// Written to stderr directly: vitest drops console output of a file whose tests all skip.
if (skip) process.stderr.write(`[e2e] item page skipped: ${skip}\n`);
// One browser for both suites, closed after the last.
afterAll(async () => {
  if ("browser" in launched) await launched.browser.close();
});

/** Collects requests to anything but the server, and errors on the page (a CSP refusal is one). */
function watch(page: Page, server: Listening) {
  const outside: string[] = [];
  const failures: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(`${server.url}/`)) outside.push(r.url());
  });
  page.on("pageerror", (e) => failures.push(String(e)));
  page.on("console", (m) => m.type() === "error" && failures.push(m.text()));
  return { outside, failures };
}

async function viewAs(page: Page, id: string, memberships: string[]) {
  await page.getByTestId("viewer-id").fill(id);
  await page.getByTestId("viewer-memberships").fill(memberships.join(", "));
  await page.getByTestId("viewer-apply").click();
  await expect.poll(() => page.getByTestId("viewer-current").textContent()).toContain(id);
}

describe.skipIf(skip !== undefined)("an item's page on the provenance fixture", () => {
  const browser = (launched as { browser: Browser }).browser;
  let fixture: Awaited<ReturnType<typeof provenanceWorkspace>>;
  let server: Listening;
  let page: Page;
  let seen: ReturnType<typeof watch>;

  const attr = (selector: string, name: string) =>
    page
      .locator(selector)
      .evaluateAll((els, n) => els.map((e) => e.getAttribute(n) ?? "").sort(), name);
  const graphItems = () => attr('[data-testid="graph-node"][data-kind="item"]', "data-id");
  const graphEvents = () => attr('[data-testid="graph-node"][data-kind="event"]', "data-id");
  const edges = () => attr(".react-flow__edge", "data-id");
  /** The non-read events of the log that name one of `items`, as the viewer's timeline has them. */
  const decisionsOn = (viewer: "dana" | "sam", items: string[]) =>
    fixture
      .timelineOf(fixture.workload.actors[viewer] as never)
      .filter((e) => e.op !== "read" && e.item_id !== null && items.includes(e.item_id));
  const writeOf = (itemId: string, version: number) => {
    const e = fixture.workspace.plane
      .events()
      .find((x) => x.op === "write" && x.item_id === itemId && x.item?.version === version);
    if (!e) throw new Error(`no write of ${itemId} at version ${version}`);
    return e;
  };
  const open = async (itemId: string) => {
    await page.goto(`${server.url}/#/item/${itemId}`);
    await page.locator(`[data-testid="item-page"][data-id="${itemId}"]`).waitFor();
  };
  const settledGraph = async (count: number) => {
    await expect
      .poll(async () => (await graphItems()).length + (await graphEvents()).length)
      .toBe(count);
  };

  beforeAll(async () => {
    if (builtUi() === null)
      throw new Error(`the inspector is not built in ${UI_DIST}; run make ui (make test-e2e does)`);
    fixture = await provenanceWorkspace();
    server = await listen(fixture.workspace, { port: 0, now: () => fixture.workload.now });
    page = await browser.newPage();
    seen = watch(page, server);
    await page.goto(`${server.url}/`);
    await page.getByTestId("lane-item").first().waitFor();
  });

  afterAll(async () => {
    await page?.close();
    await server?.close();
  });

  it("loads the graph library only on the item page", async () => {
    const chunks = () =>
      page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .map((r) => r.name)
          .filter((n) => /ItemPage/.test(n)),
      );
    expect(await chunks()).toEqual([]);
    // The entry bundle holds no xyflow code: its class names are not in it.
    const src = await page.locator('script[type="module"]').getAttribute("src");
    const entry = await (await fetch(new URL(src ?? "", server.url))).text();
    expect(entry.length).toBeGreaterThan(0);
    expect(entry).not.toContain("react-flow__");
    await page
      .locator(`[data-testid="lane-item"][data-id="${CHECKLIST}"] [data-testid="lane-item-open"]`)
      .click();
    await page.locator(`[data-testid="item-page"][data-id="${CHECKLIST}"]`).waitFor();
    expect((await chunks()).length).toBeGreaterThan(0);
  });

  it("shows the item, its lineage and the decisions about them as a graph", async () => {
    const decisions = decisionsOn("dana", [NOTE, TEAM, CHECKLIST]);
    // The three writes allowed, the rewrite allowed and the rewrite denied.
    expect(decisions.map((e) => `${e.decision}`)).toEqual([
      "allow",
      "allow",
      "allow",
      "deny",
      "allow",
    ]);
    await settledGraph(3 + decisions.length);
    expect(await graphItems()).toEqual([NOTE, TEAM, CHECKLIST].sort());
    expect(await graphEvents()).toEqual(decisions.map((e) => e.id).sort());
    await expect.poll(async () => (await edges()).length).toBe(3 + decisions.length);
    expect(await edges()).toEqual(
      [
        `lineage:${NOTE}>${TEAM}`,
        `lineage:${NOTE}>${CHECKLIST}`,
        `lineage:${TEAM}>${CHECKLIST}`,
        ...decisions.map((e) => `decision:${e.item_id}>${e.id}`),
      ].sort(),
    );
    expect(await page.getByTestId("graph-summary").textContent()).toBe(
      `3 items and ${decisions.length} decisions this viewer may see.`,
    );
    expect(
      await page
        .locator(`[data-testid="graph-node"][data-id="${CHECKLIST}"]`)
        .getAttribute("data-focus"),
    ).toBe("true");
  });

  it("lays the graph out by dagre: each version below the versions its lineage names", async () => {
    const top = async (id: string) => {
      const box = await page.locator(`[data-testid="graph-node"][data-id="${id}"]`).boundingBox();
      if (!box) throw new Error(`node ${id} has no box`);
      return box;
    };
    const [note, team, checklist] = await Promise.all([top(NOTE), top(TEAM), top(CHECKLIST)]);
    expect(note.y + note.height).toBeLessThanOrEqual(team.y);
    expect(team.y + team.height).toBeLessThanOrEqual(checklist.y);
    // No two nodes overlap.
    const boxes = await page
      .locator('[data-testid="graph-node"]')
      .evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().toJSON()));
    for (const [i, a] of boxes.entries())
      for (const b of boxes.slice(i + 1))
        expect(
          a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
        ).toBe(true);
  });

  it("opens an ancestor's page from the graph's list with the keyboard", async () => {
    // The graph's nodes take the focus too (xyflow), each with a label.
    const node = page.locator(
      `.react-flow__node:has([data-testid="graph-node"][data-id="${TEAM}"])`,
    );
    expect(await node.getAttribute("tabindex")).toBe("0");
    expect(await node.getAttribute("aria-label")).toContain(TEAM);
    await page.locator(`[data-testid="graph-list-item"][data-id="${TEAM}"] a`).focus();
    await page.keyboard.press("Enter");
    await page.locator(`[data-testid="item-page"][data-id="${TEAM}"]`).waitFor();
    expect(new URL(page.url()).hash).toBe(`#/item/${TEAM}`);
  });

  it("diffs two versions side by side, with the event that made the later one", async () => {
    await open(TEAM);
    const options = await attr('[data-testid="version-after"] option', "value");
    // The note it was written from, and its two versions; the denied rewrite made none.
    expect(options).toEqual([writeOf(NOTE, 1).id, writeOf(TEAM, 1).id, writeOf(TEAM, 2).id].sort());
    expect(await page.getByTestId("version-before").inputValue()).toBe(writeOf(TEAM, 1).id);
    expect(await page.getByTestId("version-after").inputValue()).toBe(writeOf(TEAM, 2).id);
    const removed = await page.getByTestId("diff-removed").allTextContents();
    const added = await page.getByTestId("diff-added").allTextContents();
    expect(removed.join(" ")).toContain("Monday");
    expect(added.join(" ")).toContain("Tuesday");
    expect(added.join("")).toContain("security review");
    expect(removed.join(" ")).not.toContain("freeze");
    const made = page.getByTestId("version-event");
    expect(await made.getAttribute("data-event")).toBe(writeOf(TEAM, 2).id);
    expect(await made.textContent()).toContain("fixture.inspector/write/team");
    // Another pair: the note against the team item's first version.
    await page.getByTestId("version-before").selectOption(writeOf(NOTE, 1).id);
    await page.getByTestId("version-after").selectOption(writeOf(TEAM, 1).id);
    expect((await page.getByTestId("diff-removed").allTextContents()).join("")).toContain("Draft");
    expect(await made.getAttribute("data-event")).toBe(writeOf(TEAM, 1).id);
  });

  it("lists the events naming the item in its own table", async () => {
    const naming = fixture
      .timelineOf(fixture.viewer)
      .filter((e) => e.item_id === TEAM || (e.item_ids ?? []).includes(TEAM));
    expect(
      await page
        .getByTestId("item-timeline-row")
        .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-id"))),
    ).toEqual(naming.map((e) => e.id));
  });

  it("shows sam, who cannot read the note, no node, edge or count that reveals it", async () => {
    await viewAs(page, "person:sam", ["person:sam", "team:core"]);
    await open(CHECKLIST);
    const decisions = decisionsOn("sam", [TEAM, CHECKLIST]);
    await settledGraph(2 + decisions.length);
    // The note's own write is not among sam's events, and none of them carries it.
    expect(decisionsOn("sam", [NOTE])).toEqual([]);
    expect(await graphItems()).toEqual([TEAM, CHECKLIST].sort());
    expect(await graphEvents()).toEqual(decisions.map((e) => e.id).sort());
    await expect.poll(async () => (await edges()).length).toBe(1 + decisions.length);
    expect(await edges()).toEqual(
      [
        `lineage:${TEAM}>${CHECKLIST}`,
        ...decisions.map((e) => `decision:${e.item_id}>${e.id}`),
      ].sort(),
    );
    expect(await page.getByTestId("graph-summary").textContent()).toBe(
      `2 items and ${decisions.length} decisions this viewer may see.`,
    );
    // The items sam reads carry the note's id in their lineage; the page shows none of it.
    const html = await page.getByTestId("item-page").innerHTML();
    expect(html).not.toContain(NOTE);
    expect(await page.getByTestId("item-page").textContent()).not.toMatch(/\b3 items\b/);

    // From the team item: the checklist written from it below, nothing above it.
    await open(TEAM);
    await settledGraph(2 + decisions.length);
    expect(await graphItems()).toEqual([TEAM, CHECKLIST].sort());
    expect((await edges()).filter((e) => e.startsWith("lineage:"))).toEqual([
      `lineage:${TEAM}>${CHECKLIST}`,
    ]);
    expect(await attr('[data-testid="version-after"] option', "value")).toEqual(
      [writeOf(TEAM, 1).id, writeOf(TEAM, 2).id].sort(),
    );
    expect(await page.getByTestId("item-page").innerHTML()).not.toContain(NOTE);

    // The note's own page, asked for by its id, shows nothing of it.
    await open(NOTE);
    expect(await page.locator('[data-testid="graph-node"]').count()).toBe(0);
    expect(await page.getByTestId("item-unknown").count()).toBe(1);
    expect(await page.getByTestId("versions").count()).toBe(0);
  });

  it("follows the colour scheme: the graph's nodes change with it", async () => {
    await open(CHECKLIST);
    const node = page.locator(`[data-testid="graph-node"][data-id="${CHECKLIST}"]`);
    await node.waitFor();
    const colours = () =>
      node.evaluate((n) => {
        type Styles = { getComputedStyle(e: unknown): { backgroundColor: string; color: string } };
        const s = (globalThis as unknown as Styles).getComputedStyle(n);
        return `${s.backgroundColor} ${s.color}`;
      });
    await page.emulateMedia({ colorScheme: "light" });
    const light = await colours();
    await page.emulateMedia({ colorScheme: "dark" });
    const dark = await colours();
    expect(dark).not.toBe(light);
    await page.emulateMedia({ colorScheme: "light" });
  });

  it("goes back to the workspace, and fetched nothing but its own server, with no error", async () => {
    await page.getByTestId("item-back").click();
    await page.getByTestId("timeline-row").first().waitFor();
    expect(await page.getByTestId("item-page").count()).toBe(0);
    expect(seen.outside).toEqual([]);
    expect(seen.failures).toEqual([]);
  });
});

/** Tens of thousands of events: every write of the long log is one. */
const LONG_LOG = 20_000;

describe.skipIf(skip !== undefined)("the event table on a long log", () => {
  const browser = (launched as { browser: Browser }).browser;
  let fixture: Awaited<ReturnType<typeof longLogWorkspace>>;
  let server: Listening;
  let page: Page;
  let seen: ReturnType<typeof watch>;
  let visible: ReturnType<Awaited<ReturnType<typeof longLogWorkspace>>["timelineOf"]>;

  const rows = () =>
    page
      .getByTestId("timeline-row")
      .evaluateAll((rs) => rs.map((r) => r.getAttribute("data-id") ?? ""));
  const timed = async (what: string, work: () => Promise<void>) => {
    const start = performance.now();
    await work();
    const ms = Math.round(performance.now() - start);
    process.stderr.write(`[e2e] long log: ${what} in ${ms} ms\n`);
    return ms;
  };

  beforeAll(async () => {
    if (builtUi() === null)
      throw new Error(`the inspector is not built in ${UI_DIST}; run make ui (make test-e2e does)`);
    fixture = await longLogWorkspace(LONG_LOG);
    server = await listen(fixture.workspace, { port: 0, now: () => fixture.now });
    page = await browser.newPage();
    seen = watch(page, server);
    await page.goto(`${server.url}/`);
  }, 240_000);

  afterAll(async () => {
    await page?.close();
    await server?.close();
  });

  it("shows every event the viewer may see, a bounded number of rows at a time", async () => {
    await timed("first render", async () => {
      await expect
        .poll(() => page.getByTestId("timeline-count").textContent(), { timeout: 60_000 })
        .toMatch(/ of \d+ events$/);
    });
    // What the viewer may see now: the log and the lanes' read, which came after it.
    visible = fixture.timelineOf(fixture.viewer);
    expect(visible.length).toBeGreaterThan(10_000);
    expect(await page.getByTestId("timeline-count").textContent()).toBe(
      `${visible.length} of ${visible.length} events`,
    );
    const shown = await rows();
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(200);
    expect(shown).toEqual(visible.slice(0, shown.length).map((e) => e.id));
  });

  it("sorts by a column, from its header, by mouse and by keyboard", async () => {
    const last = visible.at(-1)?.id;
    const ms = await timed("sort by seq, descending", async () => {
      await page.getByTestId("sort-seq").click();
      await expect.poll(async () => (await rows())[0]).toBe(last);
    });
    expect(ms).toBeLessThan(10_000);
    expect(await page.locator('th:has([data-testid="sort-seq"])').getAttribute("aria-sort")).toBe(
      "descending",
    );
    // Scrolled to the end, the table shows the first event of the log.
    await page.getByTestId("timeline-scroll").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect.poll(async () => (await rows()).at(-1)).toBe(visible[0]?.id);
    expect((await rows()).length).toBeLessThan(200);
    // By actor, from the keyboard.
    await page.getByTestId("sort-actor").focus();
    await page.keyboard.press("Enter");
    expect(await page.locator('th:has([data-testid="sort-actor"])').getAttribute("aria-sort")).toBe(
      "ascending",
    );
  });

  it("filters by type, actor and scope together", async () => {
    const sam = visible.filter((e) => e.actor === "person:sam");
    await timed("filter by actor", async () => {
      await page.getByTestId("filter-actor").selectOption("person:sam");
      await expect
        .poll(() => page.getByTestId("timeline-count").textContent())
        .toBe(`${sam.length} of ${visible.length} events`);
    });
    const deniedInTeam = sam.filter(
      (e) => e.op === "write" && e.decision === "deny" && e.scope_to === "team:core",
    );
    await page.getByTestId("filter-op").selectOption("write");
    await page.getByTestId("filter-scope").selectOption("team:core");
    await page.getByTestId("filter-decision").selectOption("deny");
    await expect
      .poll(() => page.getByTestId("timeline-count").textContent())
      .toBe(`${deniedInTeam.length} of ${visible.length} events`);
    expect(deniedInTeam.length).toBeGreaterThan(1000);
    expect((await rows()).length).toBeLessThan(200);
  });

  it("fetched nothing but its own server, with no error on the page", () => {
    expect(seen.outside).toEqual([]);
    expect(seen.failures).toEqual([]);
  });
});
