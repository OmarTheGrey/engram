// Review fix pass of PR #59 (RV5-3): in process, `--at` set the clock of a
// write, promote, retain or lint, so `retain --at <future>` retired the
// member's own items for good (ADR 0025 decision 6: nothing reinstates
// them), and a backdated write put an event before the log's history. The
// CLI now refuses `--at` in process on every command but read, unless the
// caller names `--test-clock`, a flag for tests and fixtures only; over
// --server it is refused as before. A read's `--at` is its valid_at and
// sweeps nothing, so it stays.
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { allEvents, openSqlite } from "@engram/core";
import { describe, expect, it } from "vitest";
import { cli, NOW, tempDir, testId } from "./helpers.ts";

const AT = "2030-01-01T00:00:00.000Z";

async function workspace() {
  const root = await tempDir();
  const db = join(await tempDir(), "engram.db");
  return { root, db, store: ["--root", root, "--owner", "dana", "--db", db] };
}

function events(db: string) {
  const conn = openSqlite(db);
  try {
    return allEvents(conn);
  } finally {
    conn.close();
  }
}

describe("RV5-3: --at in process is refused on every command but read, unless --test-clock", () => {
  it("write --at is refused before anything is written or logged", async () => {
    const { root, db, store } = await workspace();
    const r = await cli(["write", ...store, "--content", "x", "--at", AT]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("--at");
    expect(r.err).toContain("--test-clock");
    expect(await readdir(root)).toEqual([]);
    expect(await readdir(join(db, ".."))).toEqual([]);
  });

  it.each([
    ["retain", ["--scope", "person:dana"]],
    ["lint", ["--scope", "person:dana"]],
    ["promote", ["--to", "team:platform"]],
  ])("%s --at is refused and appends no event", async (command, more) => {
    const { db, store } = await workspace();
    const id = testId(7001);
    expect((await cli(["write", ...store, "--id", id, "--content", "Dana is on call."])).code).toBe(
      0,
    );
    const before = events(db).length;
    const args = [command, ...store, ...more, "--at", AT];
    if (command === "promote") args.splice(1, 0, id);
    const r = await cli(args);
    expect(r.code).toBe(2);
    expect(r.err).toContain("--test-clock");
    expect(events(db)).toHaveLength(before);
  });

  it("retain --at <future> no longer retires the member's own items", async () => {
    const { db, store } = await workspace();
    const id = testId(7002);
    expect(
      (await cli(["write", ...store, "--id", id, "--class", "episodic", "--content", "standup"]))
        .code,
    ).toBe(0);
    const r = await cli(["retain", ...store, "--scope", "person:dana", "--at", AT]);
    expect(r.code).toBe(2);
    expect(events(db).filter((e) => e.op === "retire")).toEqual([]);
  });

  it("with --test-clock, --at sets the call's clock, for tests and fixtures", async () => {
    const { db, store } = await workspace();
    const r = await cli([
      "write",
      ...store,
      "--content",
      "x",
      "--at",
      "2026-10-01T00:00:00.000Z",
      "--test-clock",
    ]);
    expect(r.code).toBe(0);
    expect(events(db).at(-1)?.ts).toBe("2026-10-01T00:00:00.000Z");
  });

  it("read --at still runs in process, as the read's valid_at; the read itself at the clock", async () => {
    const { db, store } = await workspace();
    expect((await cli(["write", ...store, "--content", "x"])).code).toBe(0);
    const r = await cli(["read", ...store, "--at", "2026-10-20T00:00:00.000Z"]);
    expect(r.code).toBe(0);
    const read = events(db).at(-1);
    expect(read?.op).toBe("read");
    expect(read?.ts).toBe(NOW);
  });

  it("--test-clock does not lift the refusal over --server", async () => {
    const r = await cli([
      "retain",
      "--scope",
      "person:dana",
      "--server",
      "http://127.0.0.1:1",
      "--at",
      AT,
      "--test-clock",
    ]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("own clock");
  });
});
