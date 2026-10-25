// `engram explain <readId>`: the explanations a read stored, from the log alone.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, readArgs, tempDir } from "./helpers.ts";

describe("engram explain", () => {
  it("prints exactly the explanations the read returned", async () => {
    const db = join(await tempDir(), "engram.db");
    const read = JSON.parse((await cli(readArgs(db, undefined, "--json"))).out);
    const { code, out } = await cli(["explain", read.read_id, "--db", db]);
    expect(code).toBe(0);
    expect(out).toContain(`read ${read.read_id}: 4 explanations`);
    expect(out.match(/^\d+\. /gm)).toHaveLength(4);
    for (const { item } of read.items) expect(out).toContain(item.id);
    expect(out.match(/admitted by preset\.medium\/read\/person/g)).toHaveLength(4);

    const json = JSON.parse((await cli(["explain", read.read_id, "--db", db, "--json"])).out);
    expect(json).toEqual(read.items.map((i: { explanation: unknown }) => i.explanation));
  });

  it("fails on an id that names no read", async () => {
    const db = join(await tempDir(), "engram.db");
    await cli(readArgs(db));
    const { code, err } = await cli([
      "explain",
      "01920000-0000-7000-8000-000000000999",
      "--db",
      db,
    ]);
    expect(code).toBe(1);
    expect(err).toContain("names no read event");
  });

  it("fails on a log that does not exist rather than creating one", async () => {
    const db = join(await tempDir(), "missing.db");
    const { code, err } = await cli(["explain", "x", "--db", db]);
    expect(code).toBe(1);
    expect(err).toContain("no event log");
  });

  it("needs a read id", async () => {
    const { code, err } = await cli(["explain"]);
    expect(code).toBe(2);
    expect(err).toContain("read id");
  });
});
