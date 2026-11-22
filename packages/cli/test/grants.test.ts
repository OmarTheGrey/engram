// `engram grants` (card E8.15a, docs/design/tui.md 3.6): the inspector's
// grants editor from the command line, POST /grants: one governed change as
// a user-sourced actor, which the plane allows only to the item's owner.
// The CLI checks only a grant's form, as the editor's grantFrom does; what a
// grant may be is the plane's decision, with its event.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Fetch } from "../src/connect.ts";
import { cli, logEvents, tempDir } from "./helpers.ts";

const ITEM = "01920000-0000-7000-8000-00000000e815";

/** A log and store holding one item of dana's, with no grants. */
async function owned() {
  const root = await tempDir();
  const db = join(await tempDir(), "engram.db");
  const ws = ["--root", root, "--owner", "dana", "--db", db];
  const w = await cli(["write", ...ws, "--id", ITEM, "--content", "Dana prefers written standups."]);
  expect(w.code).toBe(0);
  return { db, ws };
}

const SAM = "person:sam,class=semantic,mode=read,expires=2026-12-01";

describe("engram grants", () => {
  it("adds a grant as the owner, then removes it, each one governed change", async () => {
    const { db, ws } = await owned();
    const added = await cli(["grants", ITEM, ...ws, "--add", SAM]);
    expect(added.err).toBe("");
    expect(added.code).toBe(0);
    const lines = added.out.split("\n");
    expect(lines[0]).toMatch(/^update \S+ at \S+ by person:dana$/);
    expect(lines[1]).toMatch(/^allow: /);
    expect(lines[2]).toBe("policy engram/grant/change");
    expect(added.out).toContain("grants:\n  person:sam: semantic, read, until 2026-12-01T00:00:00Z\n");
    expect(lines.at(-2)).toBe(`log ${db}`);

    const removed = await cli(["grants", ITEM, ...ws, "--remove", SAM, "--json"]);
    expect(removed.code).toBe(0);
    const answer = JSON.parse(removed.out);
    expect(Object.keys(answer).sort()).toEqual(["decision", "event", "item"]);
    expect(answer.decision).toBe("allow");
    expect(answer.item.grants).toEqual([]);
    expect(logEvents(db).filter((e) => e.op === "update")).toHaveLength(2);
  });

  it("is refused to anyone but the owner, and the plane decides what a grant may be", async () => {
    const { ws } = await owned();
    const sam = await cli(["grants", ITEM, ...ws, "--as", "person:sam", "--add", SAM]);
    expect(sam.code).toBe(1);
    expect(sam.out).toMatch(/^deny: /m);
    expect(sam.out).toContain("policy engram/grant/owner");
    // No expiry: well formed, so the CLI sends it, and the gate's grant rule refuses it.
    const open = await cli(["grants", ITEM, ...ws, "--add", "person:sam,class=semantic"]);
    expect(open.code).toBe(1);
    expect(open.out).toContain("policy engram/write/grant");
  });

  it("is exactly one request", async () => {
    const { ws } = await owned();
    const paths: string[] = [];
    const transport =
      (next: Fetch): Fetch =>
      async (request) => {
        paths.push(`${request.method} ${new URL(request.url).pathname}`);
        return next(request);
      };
    await cli(["grants", ITEM, ...ws, "--add", SAM, "--add", "person:eve,expires=2026-12-01"], {
      transport,
    });
    expect(paths).toEqual(["POST /api/v1/grants"]);
  });

  it("needs one item id, a change, and grants in the editor's form", async () => {
    const { ws } = await owned();
    for (const [args, message] of [
      [["--add", SAM], "give exactly one item id"],
      [["not-an-id", "--add", SAM], "not-an-id is not an item id"],
      [[ITEM], "give a change"],
      [[ITEM, "--add", "class=semantic"], "a grant names who it is for first"],
      [[ITEM, "--add", "person:sam,colour=red"], "unknown field colour"],
      [[ITEM, "--add", "person:sam,mode=write"], "unknown mode write"],
      [[ITEM, "--add", "person:sam,class=fact"], "unknown class fact"],
      [[ITEM, "--add", "person:sam,expires=tomorrow"], "expires tomorrow is not a UTC date"],
      [[ITEM, "--remove", "person:sam,mode=read,mode=read"], "mode is given twice"],
    ] as const) {
      const r = await cli(["grants", ...args, ...ws]);
      expect(r.code, args.join(" ")).toBe(2);
      expect(r.err, args.join(" ")).toContain(message);
    }
  });
});
