// The E8.15b review fix pass (card E8.15b; the reviewer's findings C1, I1 to
// I10 and M1 to M16, scratchpad/review-e8-15b.md): one test per finding the
// fix closes, each written before its fix and seen failing first.
import { describe, expect, it } from "vitest";
import { fixtureCopy, tempDir } from "../helpers.ts";
import { startHarness } from "./harness.ts";

const ESC = "\x1b";
const CTRL_S = "\x13";

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
