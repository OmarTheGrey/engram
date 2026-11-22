// The E8.15b review fix pass (card E8.15b; the reviewer's findings C1, I1 to
// I10 and M1 to M16, scratchpad/review-e8-15b.md): one test per finding the
// fix closes, each written before its fix and seen failing first.
import { describe, expect, it } from "vitest";
import { fixtureCopy, tempDir } from "../helpers.ts";
import { startHarness } from "./harness.ts";

const ESC = "\x1b";
const CTRL_S = "\x13";

describe("I1: a Postgres log is checked off the input path", () => {
  const PG = "postgres://dana:pw@127.0.0.1:1/engram";
  it("types at full speed while a slow check runs, shows its answer when it comes, and ctrl+c still quits", async () => {
    let calls = 0;
    const slow = () => {
      calls++;
      return new Promise<["ok" | "fail", string]>((r) => setTimeout(() => r(["ok", "postgres: opens; up to date"]), 1500));
    };
    const cwd = await tempDir();
    const h = await startHarness({ cwd, home: cwd, given: { db: PG }, logCheck: slow });
    expect(h.screen()).toBe("first-run");
    expect(await h.text()).toContain("checking");
    const t = Date.now();
    await h.type("dana");
    expect(Date.now() - t).toBeLessThan(1000);
    // Typing an answer runs no check; only a change of the log's answer does.
    expect(calls).toBe(1);
    await new Promise((r) => setTimeout(r, 1700));
    expect(await h.text()).toContain("postgres: opens; up to date");
    const quit = Date.now();
    h.term.send("\x03");
    await h.app.done;
    expect(Date.now() - quit).toBeLessThan(500);
  });

  it("checks a Postgres URL typed in first run once, when its question is left, not per key", async () => {
    let calls = 0;
    const check = async () => {
      calls++;
      return ["fail", "postgres 127.0.0.1:1: connection refused"] as ["fail", string];
    };
    const cwd = await tempDir();
    const h = await startHarness({ cwd, home: cwd, given: {}, logCheck: check });
    await h.press("\x1b[B", "\x1b[B", "\x1b[B"); // a Postgres server
    await h.type(PG);
    expect(calls).toBe(0);
    await h.press("\t");
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(1);
    await h.quit();
  });
});

describe("C1: a read with a store folder asks for the folder its own command line names", () => {
  it("asks for folder A, then again for folder B, each dialog naming its folder", async () => {
    const cwd = await tempDir();
    const a = (await fixtureCopy()).replaceAll("\\", "/");
    const b = (await fixtureCopy()).replaceAll("\\", "/");
    const h = await startHarness({ cwd, home: cwd, given: { owner: "dana", db: "engram.db" } });
    for (const root of [a, b]) {
      await h.press(";");
      await h.type(`read --root ${root}`);
      await h.press("\r");
      expect(h.screen()).toBe("form");
      await h.press(CTRL_S);
      expect(h.overlay(), `no dialog before the read of ${root}`).toBe("confirm");
      const text = await h.text();
      expect(text).toContain(`Read with .../${root.split("/").at(-1)}?`);
      expect(text).not.toContain("the server's store");
      await h.press("y");
      expect(h.screen()).toBe("result");
      await h.press(ESC, ESC);
    }
    expect(h.ran()).toHaveLength(2);
    // The same folder again in this session does not ask.
    await h.press(";");
    await h.type(`read --root ${a}`);
    await h.press("\r", CTRL_S);
    expect(h.overlay()).toBeUndefined();
    expect(h.ran()).toHaveLength(3);
    await h.quit();
  });
});
