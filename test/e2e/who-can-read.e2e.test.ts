// Layer 6 (docs/conventions/testing.md), card E2.13 in a real browser: the
// who-can-read panel on the inspector's item cards, on the twin fixture
// workspace (fixtures/workspaces/twin/). Dana owns item two, granted to sam:
// she is shown every reader, her own scope's members and sam's grant, each
// with its rule. Sam, reading it through that grant, is shown the scope's
// members and his own grant, and told that grants naming others are the
// owner's to see. Each answer is the plane's (POST /who-can-read/item), and
// asking appends no event.
//
// Chromium comes from `pnpm exec playwright install chromium`. Locally a
// missing browser skips with the reason printed; under CI (CI set) it fails.
import { type Browser, chromium, type Locator, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  builtUi,
  type Listening,
  listen,
  twinWorkspace,
  UI_DIST,
} from "../../packages/ui/test/workspace.ts";

const TWO = "01970000-0000-7000-8000-000000000002";

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

describe.skipIf(skip !== undefined)("the who-can-read panel on the twin fixture workspace", () => {
  const browser = (launched as { browser: Browser }).browser;
  let fixture: Awaited<ReturnType<typeof twinWorkspace>>;
  let server: Listening;
  let page: Page;
  const failures: string[] = [];

  const card = (itemId: string): Locator =>
    page.locator(`[data-testid="lane-item"][data-id="${itemId}"]`);

  /** Asks the panel of one card and returns its reader rows as kind, who and rule. */
  async function ask(itemId: string) {
    const panel = card(itemId).getByTestId("who-can-read");
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
    return { panel, rows };
  }

  beforeAll(async () => {
    if (builtUi() === null)
      throw new Error(`the inspector is not built in ${UI_DIST}; run make ui (make test-e2e does)`);
    fixture = await twinWorkspace();
    server = await listen(fixture.workspace, { port: 0, now: () => fixture.workload.now });
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
    const { panel, rows } = await ask(TWO);
    expect(await panel.getByTestId("who-can-read-answer").getAttribute("data-answered")).toBe(
      "true",
    );
    expect(rows).toEqual([
      ["members", "person:dana", "profile.twin/read/person"],
      ["grant", "person:sam", "profile.twin/read/grants"],
    ]);
    expect(await panel.getByTestId("who-can-read-withheld").count()).toBe(0);
    expect(fixture.workspace.plane.events().length).toBe(logged);
  });

  it("shows the grantee its own grant and the scope's members, and withholds the rest", async () => {
    await page.getByTestId("viewer-id").fill("person:sam");
    await page.getByTestId("viewer-memberships").fill("person:sam");
    await page.getByTestId("viewer-apply").click();
    await expect
      .poll(() => page.getByTestId("viewer-current").textContent())
      .toContain("person:sam");
    await card(TWO).waitFor();
    const { panel, rows } = await ask(TWO);
    expect(rows).toEqual([
      ["members", "person:dana", "profile.twin/read/person"],
      ["grant", "person:sam", "profile.twin/read/grants"],
    ]);
    expect(await panel.getByTestId("who-can-read-withheld").count()).toBe(1);
    expect(await panel.getByTestId("who-can-read-reason").textContent()).toContain(
      "its owner person:dana sees all of them",
    );
  });

  it("raised no error on the page", () => {
    expect(failures).toEqual([]);
  });
});
