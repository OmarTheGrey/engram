// `engram explain <readId>`: the explanations a read stored, from the log
// alone, for the actor who made the read only (decision D5). And `engram
// explain --absent <id> [query]` (card E2.17): why an item is not in a read.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, logEvents, readArgs, tempDir } from "./helpers.ts";

describe("engram explain", () => {
  it("prints exactly the explanations the read returned", async () => {
    const db = join(await tempDir(), "engram.db");
    const read = JSON.parse((await cli(readArgs(db, undefined, "--json"))).out);
    const { code, out } = await cli(["explain", read.read_id, "--db", db, "--owner", "dana"]);
    expect(code).toBe(0);
    expect(out).toContain(`read ${read.read_id}: 4 explanations`);
    expect(out.match(/^\d+\. /gm)).toHaveLength(4);
    for (const { item } of read.items) expect(out).toContain(item.id);
    expect(out.match(/admitted by preset\.medium\/read\/person/g)).toHaveLength(4);

    const json = JSON.parse(
      (await cli(["explain", read.read_id, "--db", db, "--as", "person:dana", "--json"])).out,
    );
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
      "--owner",
      "dana",
    ]);
    expect(code).toBe(1);
    expect(err).toContain("names no read event");
  });

  it("refuses another actor the explanations of a read it did not make", async () => {
    const db = join(await tempDir(), "engram.db");
    const read = JSON.parse((await cli(readArgs(db, undefined, "--json"))).out);
    const { code, out, err } = await cli([
      "explain",
      read.read_id,
      "--db",
      db,
      "--as",
      "person:eve",
    ]);
    expect(code).toBe(1);
    expect(out).toBe("");
    expect(err).toContain("only its reader may explain it");
  });

  it("needs the actor who made the read", async () => {
    const { code, err } = await cli(["explain", "x", "--db", "unused.db"]);
    expect(code).toBe(2);
    expect(err).toContain("--as");
  });

  it("fails on a log that does not exist rather than creating one", async () => {
    const db = join(await tempDir(), "missing.db");
    const { code, err } = await cli(["explain", "x", "--db", db, "--owner", "dana"]);
    expect(code).toBe(1);
    expect(err).toContain("no event log");
  });

  it("needs a read id", async () => {
    const { code, err } = await cli(["explain"]);
    expect(code).toBe(2);
    expect(err).toContain("read id");
  });
});

describe("engram explain --absent", () => {
  it("names the stage that keeps an item out, says when the read returns it, and appends no event", async () => {
    const db = join(await tempDir(), "engram.db");
    const read = JSON.parse((await cli(readArgs(db, undefined, "--json"))).out);
    const id = read.items[0].item.id as string;
    const owner = ["--db", db, "--owner", "dana"];
    const logged = logEvents(db).length;
    const missed = await cli(["explain", "--absent", id, "zzz-nothing", ...owner]);
    expect(missed.code).toBe(0);
    expect(missed.out).toContain(`why not ${id} in a read at `);
    expect(missed.out).toContain('with query "zzz-nothing" as person:dana: absent at match');
    expect(missed.out).toContain("(engram/read/match)");
    const json = JSON.parse((await cli(["explain", "--absent", id, ...owner, "--json"])).out);
    expect(json).toMatchObject({ answered: true, absent: false, item_id: id, stage: null });
    // Another person is refused as for an id the log never held, exit 1.
    const eve = ["--db", db, "--as", "person:eve", "--json"];
    const hidden = await cli(["explain", "--absent", id, ...eve]);
    const missing = "01920000-0000-7000-8000-000000000999";
    const unknown = await cli(["explain", "--absent", missing, ...eve]);
    expect(hidden.code).toBe(1);
    expect(unknown.code).toBe(1);
    expect(hidden.out.replaceAll(id, "<id>")).toBe(unknown.out.replaceAll(missing, "<id>"));
    expect(logEvents(db)).toHaveLength(logged);
  });

  it("refuses --at without --absent, and an --absent that is not an item id", async () => {
    const at = await cli(["explain", "x", "--at", "2026-10-01T00:00:00Z", "--owner", "dana"]);
    expect(at.code).toBe(2);
    expect(at.err).toContain("only with --absent");
    const bad = await cli(["explain", "--absent", "nope", "--owner", "dana"]);
    expect(bad.code).toBe(2);
    expect(bad.err).toContain("is not an item id");
  });
});
