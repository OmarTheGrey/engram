// Layer 6 (docs/conventions/testing.md), card E2.13 in a real browser: the
// who-can-read panel on the inspector's item page (card E8.11's
// `#/item/<id>`), on the twin fixture workspace (fixtures/workspaces/twin/).
// Dana owns item two, granted to sam: she is shown every reader, her own
// scope's members and sam's grant, each with its rule. Sam, reading it
// through that grant, is shown the scope's members and his own grant, and
// told that grants naming others are the owner's to see. An outsider is
// refused in the words an unknown id gets. Each answer is the plane's (POST
// /who-can-read/item), and asking appends no event.
//
// Chromium comes from `pnpm exec playwright install chromium`. Locally a
// missing browser skips with the reason printed; under CI (CI set) it fails.
import { type Browser, chromium, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  builtUi,
  type Listening,
  listen,
  twinWorkspace,
  UI_DIST,
} from "../../packages/ui/test/workspace.ts";

const TWO = "01970000-0000-7000-8000-000000000002";
const UNKNOWN = "01970000-0000-7000-8000-000000000099";

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
if (skip) process.stderr.write(`[e2e] who-can-read panel skipped: ${skip}\n`);

describe.skipIf(skip !== undefined)("the who-can-read panel on the item page", () => {
  const browser = (launched as { browser: Browser }).browser;
  let fixture: Awaited<ReturnType<typeof twinWorkspace>>;
  let server: Listening;
  let page: Page;
  const failures: string[] = [];

  /** Opens an item's page as the current viewer, asks the panel, and returns what it shows. */
  async function ask(itemId: string) {
    await page.goto(`${server.url}/#/item/${itemId}`);
    const panel = page
      .locator(`[data-testid="item-page"][data-id="${itemId}"]`)
      .getByTestId("who-can-read");
    await panel.getByTestId("who-can-read-ask").click();
    await panel.getByTestId("who-can-read-answer").waitFor();
    const rows = await panel
      .getByTestId("who-can-read-reader")
      .evaluateAll((rs) =>
        rs.map((r) => [
          r.getAttribute("data-kind"),
          r.getAttribute("data-who"),
          r.querySelector("code")?.textContent ?? "",
        ]),
      );
    return {
      panel,
      rows,
      answered: await panel.getByTestId("who-can-read-answer").getAttribute("data-answered"),
      reason: (await panel.getByTestId("who-can-read-reason").textContent()) ?? "",
    };
  }

  /** Views the workspace as another viewer, through the picker. */
  async function viewAs(id: string) {
    await page.goto(`${server.url}/`);
    await page.getByTestId("viewer-id").fill(id);
    await page.getByTestId("viewer-memberships").fill(id);
    await page.getByTestId("viewer-apply").click();
    await expect.poll(() => page.getByTestId("viewer-current").textContent()).toContain(id);
  }

  beforeAll(async () => {
    if (builtUi() === null)
      throw new Error(`the inspector is not built in ${UI_DIST}; run make ui (make test-e2e does)`);
    fixture = await twinWorkspace();
    server = await listen(fixture.workspace, {
      port: 0,
      now: () => fixture.workload.now,
      auth: { insecureLoopback: true },
    });
    page = await browser.newPage();
    page.on("pageerror", (e) => failures.push(String(e)));
    page.on("console", (m) => m.type() === "error" && failures.push(m.text()));
    await page.goto(`${server.url}/`);
    await page.getByTestId("lane-item").first().waitFor();
  });

  afterAll(async () => {
    await browser.close();
    await server?.close();
  });

  it("shows the owner every reader of her item, each with its rule, and appends no event", async () => {
    const logged = fixture.workspace.plane.events().length;
    const { panel, rows, answered } = await ask(TWO);
    expect(answered).toBe("true");
    expect(rows).toEqual([
      ["members", "person:dana", "profile.twin/read/person"],
      ["grant", "person:sam", "profile.twin/read/grants"],
    ]);
    expect(await panel.getByTestId("who-can-read-withheld").count()).toBe(0);
    // The page's own read and events calls append a read event; the question appends nothing.
    const reads = fixture.workspace.plane.events().slice(logged);
    expect(reads.every((e) => e.op === "read")).toBe(true);
  });

  it("shows the grantee its own grant and the scope's members, and withholds the rest", async () => {
    await viewAs("person:sam");
    const { panel, rows, reason } = await ask(TWO);
    expect(rows).toEqual([
      ["members", "person:dana", "profile.twin/read/person"],
      ["grant", "person:sam", "profile.twin/read/grants"],
    ]);
    expect(await panel.getByTestId("who-can-read-withheld").count()).toBe(1);
    expect(reason).toContain("its owner person:dana sees all of them");
  });

  it("refuses an outsider in the words an unknown id gets, naming no reader", async () => {
    await viewAs("person:eve");
    const hidden = await ask(TWO);
    const unknown = await ask(UNKNOWN);
    expect([hidden.answered, unknown.answered]).toEqual(["false", "false"]);
    expect(hidden.rows).toEqual([]);
    expect(hidden.reason).toBe(unknown.reason.replace(UNKNOWN, TWO));
    expect(hidden.reason).not.toContain("person:dana");
    expect(hidden.reason).not.toContain("person:sam");
  });

  it("raised no error on the page", () => {
    expect(failures).toEqual([]);
  });
});
