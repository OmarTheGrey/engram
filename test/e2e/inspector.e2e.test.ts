// Layer 6 (docs/conventions/testing.md), cards E8.5 and E8.6: the inspector in
// a real browser. The fixture workspace (fixtures/workspaces/inspector/) is
// built at test time through the generated client in process, then served on
// a loopback port with the built UI (make ui), and Chromium, driven by the
// `playwright` library, opens it as the fixture's viewer. It checks the scope
// lanes (what the viewer may read, and nothing else), the timeline's event
// count (core's visibleEvents over the log, the lanes' read included), and
// that the explain view's filtered count is the one the read event records.
//
// Chromium comes from `pnpm exec playwright install chromium`. Locally a
// missing browser skips with the reason printed; under CI (CI set) it fails.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  builtUi,
  inspectorWorkspace,
  type Listening,
  listen,
  readCounts,
  UI_DIST,
  visibleEvents,
} from "../../packages/ui/test/workspace.ts";

const ids = (n: number[]) => n.map((k) => `01940000-0000-7000-8000-${String(k).padStart(12, "0")}`);

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
if (skip) process.stderr.write(`[e2e] inspector skipped: ${skip}\n`);

describe.skipIf(skip !== undefined)("the inspector on the fixture workspace", () => {
  const browser = (launched as { browser: Browser }).browser;
  let fixture: Awaited<ReturnType<typeof inspectorWorkspace>>;
  let server: Listening;
  let page: Page;
  const outside: string[] = [];
  const failures: string[] = [];

  beforeAll(async () => {
    if (builtUi() === null)
      throw new Error(`the inspector is not built in ${UI_DIST}; run make ui (make test-e2e does)`);
    expect(existsSync(join(UI_DIST, "index.html"))).toBe(true);
    fixture = await inspectorWorkspace();
    server = await listen(fixture.workspace, { port: 0, now: () => fixture.workload.now });
    page = await browser.newPage();
    page.on("request", (r) => {
      if (!r.url().startsWith(`${server.url}/`)) outside.push(r.url());
    });
    page.on("pageerror", (e) => failures.push(String(e)));
    page.on("console", (m) => m.type() === "error" && failures.push(m.text()));
    await page.goto(`${server.url}/`);
    await page.getByTestId("timeline-row").first().waitFor();
  });

  afterAll(async () => {
    await browser.close();
    await server?.close();
  });

  it("opens as the viewer engram serve named", async () => {
    await expect
      .poll(() => page.getByTestId("viewer-current").textContent())
      .toContain(fixture.viewer.id);
    expect(await page.getByTestId("viewer-id").inputValue()).toBe(fixture.viewer.id);
  });

  it("shows in the scope lanes exactly what the viewer may read, from a read through the plane", async () => {
    const lanes = page.getByTestId("lane");
    expect(await lanes.evaluateAll((ls) => ls.map((l) => l.getAttribute("data-scope")))).toEqual([
      "person:dana",
      "team:core",
    ]);
    const shown = async (scope: string) =>
      (
        await page
          .locator(`[data-testid="lane"][data-scope="${scope}"] [data-testid="lane-item"]`)
          .evaluateAll((items) => items.map((i) => i.getAttribute("data-id") ?? ""))
      ).sort();
    expect(await shown("person:dana")).toEqual(ids([1, 9]));
    expect(await shown("team:core")).toEqual(ids([2, 6]));
    // The lanes came from a read the viewer made: its event is in the log and on the timeline.
    const readId = await page.getByTestId("lanes-read").textContent();
    const event = fixture.workspace.plane.events().find((e) => e.id === readId);
    expect(event).toMatchObject({ op: "read", actor: fixture.viewer.id });
    expect(await page.locator(`[data-testid="timeline-row"][data-id="${readId}"]`).count()).toBe(1);
  });

  it("shows on the timeline the events visibleEvents gives the viewer", async () => {
    const log = fixture.workspace.plane.events();
    const visible = visibleEvents(fixture.viewer, log);
    // The workload's twelve visible events and the lanes' read; the log holds more.
    expect(visible).toHaveLength(13);
    expect(log.length).toBeGreaterThan(visible.length);
    expect(await page.getByTestId("timeline-row").count()).toBe(visible.length);
    expect(
      await page.getByTestId("timeline-row").evaluateAll((rows) => rows.map((r) => r.dataset.id)),
    ).toEqual(visible.map((e) => e.id));
  });

  it("filters the timeline by decision", async () => {
    await page.getByTestId("filter-decision").selectOption("deny");
    expect(await page.getByTestId("timeline-row").count()).toBe(1);
    await page.getByTestId("filter-decision").selectOption("");
    expect(await page.getByTestId("timeline-row").count()).toBe(13);
  });

  it("explains the viewer's read with the filtered count its event records", async () => {
    const read = fixture.reads.get("dana");
    if (!read) throw new Error("the workload has no read by dana");
    const counts = readCounts(read.event);
    // Distinct counts per category, so a category shown under another's label fails.
    expect(counts).toMatchObject({
      filtered: 6,
      outside_validity: 3,
      not_active: 2,
      expired: 1,
      excluded: 0,
    });
    await page.locator(`[data-testid="timeline-row"][data-id="${read.event.id}"]`).click();
    const filtered = page.getByTestId("explain-filtered");
    await filtered.waitFor();
    expect(Number(await filtered.textContent())).toBe(counts?.filtered);
    expect(Number(await filtered.textContent())).toBe(read.filtered);
    const categories = await page
      .getByTestId("explain-category")
      .evaluateAll((li) =>
        li.map((l) => [l.dataset.key, Number.parseInt(l.textContent ?? "", 10)]),
      );
    expect(categories).toEqual([
      ["outside_validity", counts?.outside_validity],
      ["not_active", counts?.not_active],
      ["expired", counts?.expired],
      ["excluded", counts?.excluded],
    ]);
    expect(
      await page.getByTestId("explain-row").evaluateAll((rows) => rows.map((r) => r.dataset.id)),
    ).toEqual(read.explanations.map((e) => e.item_id));
  });

  it("shows another viewer's view of that read: its event, and that only its reader may explain it", async () => {
    await page.getByTestId("viewer-id").fill("person:sam");
    await page.getByTestId("viewer-memberships").fill("person:sam, team:core");
    await page.getByTestId("viewer-apply").click();
    await expect
      .poll(() => page.getByTestId("viewer-current").textContent())
      .toContain("person:sam");
    const other = page.getByTestId("explain-other");
    await other.waitFor();
    expect(await other.textContent()).toMatch(
      /Only person:dana, who made this read, may explain it/,
    );
    expect(await page.getByTestId("event-detail").textContent()).toContain("person:dana");
    expect(await page.getByTestId("explain-filtered").count()).toBe(0);
  });

  it("fetched nothing but its own server, with no error on the page", () => {
    expect(outside).toEqual([]);
    expect(failures).toEqual([]);
  });
});
