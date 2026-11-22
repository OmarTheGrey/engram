// `engram scopes` and `engram read --item <id>` (card E8.15a, over card
// E8.14's routes POST /scopes and POST /read/{itemId}): each one client
// call, each a read with its read event, and with a store folder the same
// sweep and adoption as `engram read` first.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Fetch } from "../src/connect.ts";
import { cli, FIXTURE, logEvents, readArgs, tempDir, VALID_FROM } from "./helpers.ts";

const ITEM = "01920000-0000-7000-8000-00000000e816";
const UNKNOWN = "01920000-0000-7000-8000-00000000e899";

/** A log with one item of dana's, granted to sam until the end of the year. */
async function granted() {
  const dir = await tempDir();
  const db = join(dir, "engram.db");
  const file = join(dir, "item.json");
  await writeFile(
    file,
    JSON.stringify({
      grants: [
        { to: "person:sam", class: "semantic", mode: "read", expires: "2026-12-31T00:00:00.000Z" },
      ],
    }),
  );
  const root = await tempDir();
  const w = await cli([
    "write",
    ...["--root", root, "--owner", "dana", "--db", db],
    ...["--id", ITEM, "--content", "Dana prefers written standups.", "--file", file],
  ]);
  expect(w.code).toBe(0);
  return { db, root };
}

function counting() {
  const paths: string[] = [];
  const transport =
    (next: Fetch): Fetch =>
    async (request) => {
      paths.push(`${request.method} ${new URL(request.url).pathname}`);
      return next(request);
    };
  return { paths, transport };
}

describe("engram scopes", () => {
  it("lists the actor's member scopes and the scopes a live grant opens, one read event", async () => {
    const { db } = await granted();
    const before = logEvents(db).length;
    const c = counting();
    const sam = await cli(["scopes", "--as", "person:sam", "--db", db], {
      transport: c.transport,
    });
    expect(sam.err).toBe("");
    expect(sam.code).toBe(0);
    const lines = sam.out.split("\n");
    expect(lines[0]).toMatch(
      /^scopes person:sam can see at \S+ under preset\.medium v\d+: 2 scopes$/,
    );
    expect(lines).toContain("  person:dana (grant)");
    expect(lines).toContain("  person:sam (membership)");
    expect(lines.at(-2)).toBe(`log ${db}`);
    expect(c.paths).toEqual(["POST /api/v1/scopes"]);
    const after = logEvents(db);
    expect(after).toHaveLength(before + 1);
    expect(after.at(-1)?.op).toBe("read");

    const eve = await cli(["scopes", "--as", "person:eve", "--db", db, "--json"]);
    const answer = JSON.parse(eve.out);
    expect(Object.keys(answer).sort()).toEqual(["event", "policy", "scopes", "sync"]);
    expect(answer.scopes).toEqual([{ scope: "person:eve", via: "membership" }]);
    expect(answer.sync).toBeNull();
  });

  it("with a store folder, adopts it first as read does", async () => {
    const db = join(await tempDir(), "engram.db");
    const r = await cli([
      "scopes",
      ...["--store", "files", "--root", FIXTURE, "--owner", "dana"],
      ...["--import-valid-from", VALID_FROM, "--db", db],
    ]);
    expect(r.code).toBe(0);
    expect(r.out).toContain(`store files at ${FIXTURE}`);
    expect(r.out).toContain("imported 4 of 4 memories: 4 allowed, 0 denied, 0 already in the log");
  });
});

describe("engram read --item", () => {
  it("reads one item by its id, explained, with read's output", async () => {
    const { db, root } = await granted();
    const c = counting();
    const r = await cli(["read", "--item", ITEM, "--root", root, "--owner", "dana", "--db", db], {
      transport: c.transport,
    });
    expect(r.err).toBe("");
    expect(r.code).toBe(0);
    expect(c.paths).toEqual([`POST /api/v1/read/${ITEM}`]);
    expect(r.out).toMatch(/^read \S+ at \S+ as person:dana \(person\) under preset\.medium v\d+\n/);
    expect(r.out).toContain("1 item returned, 0 filtered");
    expect(r.out).toContain(`1. ${ITEM}  semantic  person:dana`);
    expect(r.out).toContain("   > Dana prefers written standups.");
    const j = JSON.parse(
      (await cli(["read", "--item", ITEM, "--root", root, "--owner", "dana", "--db", db, "--json"]))
        .out,
    );
    expect(j.items.map((i: { item: { id: string } }) => i.item.id)).toEqual([ITEM]);
  });

  it("returns nothing for an item the actor may not read, as for an id the log never held", async () => {
    const { db } = await granted();
    const eveRoot = await tempDir();
    const eve = ["--root", eveRoot, "--owner", "eve", "--db", db, "--json"];
    const hidden = JSON.parse((await cli(["read", "--item", ITEM, ...eve])).out);
    const unknown = JSON.parse((await cli(["read", "--item", UNKNOWN, ...eve])).out);
    expect(hidden.returned).toBe(0);
    expect(unknown.returned).toBe(0);
    expect(hidden.items).toEqual([]);
  });

  it("takes an item id or a query, not both", async () => {
    const db = join(await tempDir(), "engram.db");
    const both = await cli(readArgs(db, FIXTURE, "deploy", "--item", ITEM));
    expect(both.code).toBe(2);
    expect(both.err).toContain("give a query or --item <id>, not both");
    const bad = await cli(readArgs(db, FIXTURE, "--item", "not-an-id"));
    expect(bad.code).toBe(2);
    expect(bad.err).toContain("--item not-an-id is not an item id (a UUIDv7)");
  });
});
