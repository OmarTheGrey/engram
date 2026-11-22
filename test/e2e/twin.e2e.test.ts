// Layer 6 (docs/conventions/testing.md), card E9.4's acceptance in a real
// browser: the twin screens. The twin fixture workspace (fixtures/workspaces/
// twin/, under packages/pi-package/profiles/twin.yaml) is built at test time
// through the generated client in process, served on a loopback port with
// the built UI (make ui), and Chromium, driven by the `playwright` library,
// opens it as dana. It checks the person versus role lanes, then works the
// grants editor: a grant added and one removed are each one update event in
// the plane's log and a row on the timeline; grants the plane refuses (no
// expiry, on model content, on another member's role item) are deny events
// the editor shows with their rule; and the grantee's view follows the
// grants. A grant change recorded as an event is the card's acceptance.
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

const ids = (n: number[]) => n.map((k) => `01970000-0000-7000-8000-${String(k).padStart(12, "0")}`);
const [ONE, TWO, THREE, FOUR, FIVE, SIX] = ids([1, 2, 3, 4, 5, 6]) as string[];

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
if (skip) process.stderr.write(`[e2e] twin screens skipped: ${skip}\n`);

describe.skipIf(skip !== undefined)("the twin screens on the twin fixture workspace", () => {
  const browser = (launched as { browser: Browser }).browser;
  let fixture: Awaited<ReturnType<typeof twinWorkspace>>;
  let server: Listening;
  let page: Page;
  const outside: string[] = [];
  const failures: string[] = [];

  const card = (itemId: string): Locator =>
    page.locator(`[data-testid="lane-item"][data-id="${itemId}"]`);
  const laneItems = async (group: string) =>
    (
      await page
        .locator(`[data-testid="lane-group"][data-group="${group}"] [data-testid="lane-item"]`)
        .evaluateAll((items) => items.map((i) => i.getAttribute("data-id") ?? ""))
    ).sort();
  /** The update events the plane appended since `seq`, in log order. */
  const updatesAfter = (seq: number) =>
    fixture.workspace.plane.events().filter((e) => e.op === "update" && e.seq > seq);
  const lastSeq = () => fixture.workspace.plane.events().at(-1)?.seq ?? -1;
  /** The grants the editor lists on an item, as `to` values (review M4). */
  const listed = (itemId: string) =>
    card(itemId)
      .getByTestId("grant")
      .evaluateAll((gs) => gs.map((g) => g.getAttribute("data-to")));

  /**
   * Adds a grant on an item through the editor and waits for the plane's
   * decision on screen; returns the one update event it appended.
   */
  async function addGrant(itemId: string, to: string, expires: string, cls = "semantic") {
    const since = lastSeq();
    const form = card(itemId).getByTestId("grant-add");
    await form.locator("summary").click();
    await form.getByTestId("grant-to").fill(to);
    await form.getByTestId("grant-class").selectOption(cls);
    await form.getByTestId("grant-expires").fill(expires);
    await form.getByTestId("grant-submit").click();
    return settled(itemId, since);
  }

  /** Waits for the one update event since `since` to be shown as the item's outcome, and the timeline to list it. */
  async function settled(itemId: string, since: number) {
    await expect.poll(() => updatesAfter(since).length).toBe(1);
    const [event] = updatesAfter(since);
    if (!event) throw new Error("no update event");
    await expect
      .poll(() => card(itemId).getByTestId("grant-outcome").getAttribute("data-event"))
      .toBe(event.id);
    await page.locator(`[data-testid="timeline-row"][data-id="${event.id}"]`).waitFor();
    return event;
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
    page.on("request", (r) => {
      if (!r.url().startsWith(`${server.url}/`)) outside.push(r.url());
    });
    page.on("pageerror", (e) => failures.push(String(e)));
    page.on("console", (m) => m.type() === "error" && failures.push(m.text()));
    await page.goto(`${server.url}/`);
    await page.getByTestId("lane-item").first().waitFor();
  });

  afterAll(async () => {
    await browser.close();
    await server?.close();
  });

  it("shows the viewer's person scope and role scope as separate lanes, under the twin profile", async () => {
    expect(await page.getByTestId("lanes-policy").textContent()).toBe("profile.twin v1");
    expect(
      await page
        .getByTestId("lane-group")
        .evaluateAll((gs) => gs.map((g) => g.getAttribute("data-group"))),
    ).toEqual(["person", "role"]);
    expect(await laneItems("person")).toEqual([ONE, TWO, SIX].sort());
    expect(await laneItems("role")).toEqual([THREE, FOUR].sort());
    expect(
      await page
        .locator('[data-testid="lane-group"][data-group="role"] [data-testid="lane"]')
        .getAttribute("data-kind"),
    ).toBe("role");
    // Sam's person scope is not the viewer's to read.
    expect(await card(FIVE as string).count()).toBe(0);
  });

  it("lists each item's grants", async () => {
    expect(
      await card(TWO as string)
        .getByTestId("grant")
        .evaluateAll((gs) => gs.map((g) => g.getAttribute("data-to"))),
    ).toEqual(["person:sam"]);
    expect(
      await card(ONE as string)
        .getByTestId("grants-none")
        .count(),
    ).toBe(1);
  });

  it("records a grant added in the editor as one update event, and lists the grant", async () => {
    const event = await addGrant(ONE as string, "person:sam", "2026-12-19");
    expect(event).toMatchObject({
      decision: "allow",
      actor: "person:dana",
      item_id: ONE,
      policy_id: "engram/grant/change",
    });
    expect(event.reason).toContain("added grant to person:sam");
    expect(event.item?.grants).toEqual([
      { to: "person:sam", class: "semantic", mode: "read", expires: "2026-12-19T00:00:00Z" },
    ]);
    const outcome = card(ONE as string).getByTestId("grant-outcome");
    expect(await outcome.getAttribute("data-decision")).toBe("allow");
    await card(ONE as string)
      .getByTestId("grant")
      .first()
      .waitFor();
    expect(
      await card(ONE as string)
        .getByTestId("grant")
        .evaluateAll((gs) => gs.map((g) => g.getAttribute("data-to"))),
    ).toEqual(["person:sam"]);
  });

  it("records a grant the plane refuses as a deny event, shown with its rule, and lists the grants unchanged", async () => {
    const before = await Promise.all([ONE, SIX, FOUR].map((i) => listed(i as string)));
    const noExpiry = await addGrant(ONE as string, "person:lee", "");
    expect(noExpiry).toMatchObject({ decision: "deny", policy_id: "engram/write/grant" });
    const outcome = card(ONE as string).getByTestId("grant-outcome");
    expect(await outcome.getAttribute("data-decision")).toBe("deny");
    expect(await outcome.getByTestId("grant-outcome-policy").textContent()).toBe(
      "engram/write/grant",
    );
    expect(await outcome.textContent()).toContain("has no expiry");

    const model = await addGrant(SIX as string, "person:sam", "2026-12-19");
    expect(model).toMatchObject({ decision: "deny", policy_id: "engram/write/grant" });
    expect(model.reason).toContain("model content carries no grants");

    const lees = await addGrant(FOUR as string, "person:sam", "2026-12-19");
    expect(lees).toMatchObject({ decision: "deny", policy_id: "engram/grant/owner" });
    expect(
      await card(FOUR as string)
        .getByTestId("grant-outcome")
        .textContent(),
    ).toContain("only its owner person:lee");
    // Each refusal left the grants the editor lists as they were (review M4).
    expect(await Promise.all([ONE, SIX, FOUR].map((i) => listed(i as string)))).toEqual(before);
  });

  it("lists every grant to the owner, which a grantee sees only its own of (review M2)", async () => {
    const event = await addGrant(ONE as string, "person:lee", "2026-12-19");
    expect(event).toMatchObject({ decision: "allow", policy_id: "engram/grant/change" });
    await expect.poll(() => listed(ONE as string)).toEqual(["person:sam", "person:lee"]);
    expect(
      await card(ONE as string)
        .getByTestId("grants-yours")
        .count(),
    ).toBe(0);
  });

  it("records a grant removed in the editor as one update event, and the item lists none", async () => {
    const since = lastSeq();
    await card(TWO as string)
      .getByTestId("grant-remove")
      .click();
    const event = await settled(TWO as string, since);
    expect(event).toMatchObject({ decision: "allow", policy_id: "engram/grant/change" });
    expect(event.reason).toContain("removed grant to person:sam");
    await card(TWO as string)
      .getByTestId("grants-none")
      .waitFor();
  });

  it("shows the grantee, through a grant, only what is granted to it now", async () => {
    await page.getByTestId("viewer-id").fill("person:sam");
    await page.getByTestId("viewer-memberships").fill("person:sam");
    await page.getByTestId("viewer-apply").click();
    await expect
      .poll(() => page.getByTestId("viewer-current").textContent())
      .toContain("person:sam");
    await page.locator('[data-testid="lane-group"][data-group="granted"]').waitFor();
    expect(await laneItems("granted")).toEqual([ONE]);
    // Item one also carries a grant to lee, which sam is not shown (review M2).
    expect(await listed(ONE as string)).toEqual(["person:sam"]);
    expect(
      await card(ONE as string)
        .getByTestId("grants-yours")
        .textContent(),
    ).toContain("person:dana sees all of them");
    expect(await laneItems("person")).toEqual([FIVE]);
    expect(
      await page
        .locator('[data-testid="lane-group"][data-group="role"] [data-testid="lane-group-empty"]')
        .count(),
    ).toBe(1);
    // An item reached through a grant offers no editor; its grants are the owner's to change.
    expect(
      await card(ONE as string)
        .getByTestId("grant-add")
        .count(),
    ).toBe(0);
  });

  it("fetched nothing but its own server, with no error on the page", () => {
    expect(outside).toEqual([]);
    expect(failures).toEqual([]);
  });
});
