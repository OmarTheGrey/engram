// `engram supersede <item-id> [--accept <id>]...` (card L6): one call to
// the supersede route. Without --accept it prints the plan: the head of the
// item's chain and, for each ancestor the actor may read, a proposed close or
// a review flag, and writes nothing. Each --accept is one ordinary write of a
// new version through the write gate, which decides it and logs it. Exit 0
// when the chain resolves and every accepted close was allowed, 1 otherwise
// (an id the plan proposes no close for is the server's 400, refused before
// anything is written), 2 on bad usage.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, fixtureCopy, logEvents, tempDir, VALID_FROM } from "./helpers.ts";

const OLD = "01950000-0000-7000-8000-000000000001";
const NEW = "01950000-0000-7000-8000-000000000002";
const LATER = "2026-10-15T00:00:00.000Z";

async function setup() {
  const root = await tempDir();
  const dir = await tempDir();
  const db = join(dir, "engram.db");
  const store = ["--store", "files", "--root", root, "--owner", "dana", "--db", db];
  const replacement = join(dir, "replacement.json");
  await writeFile(replacement, JSON.stringify({ lineage: [OLD] }));
  const write = (id: string, content: string, ...more: string[]) =>
    cli(["write", ...store, "--id", id, "--content", content, ...more]);
  expect(
    (await write(OLD, "The deploy window is Tuesday.", "--valid-from", "2026-10-01T00:00:00Z"))
      .code,
  ).toBe(0);
  expect(
    (
      await write(
        NEW,
        "The deploy window is Thursday.",
        "--valid-from",
        LATER,
        "--file",
        replacement,
      )
    ).code,
  ).toBe(0);
  return { db, store };
}

describe("engram supersede", () => {
  it("without --accept prints the plan and writes nothing", async () => {
    const { db, store } = await setup();
    const before = logEvents(db).length;
    const { code, out } = await cli(["supersede", NEW, ...store]);
    expect(code).toBe(0);
    expect(out).toContain(`head ${NEW}`);
    expect(out).toContain(`close ${OLD}`);
    expect(out).toContain(`valid_to ${LATER}`);
    expect(out).toContain(`--accept ${OLD}`);
    expect(logEvents(db)).toHaveLength(before);
  });

  it("--accept writes the close through the gate as a new version, logged", async () => {
    const { db, store } = await setup();
    const { code, out } = await cli(["supersede", NEW, ...store, "--accept", OLD, "--json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed.proposals).toEqual([
      expect.objectContaining({ item_id: OLD, action: "close", valid_to: LATER }),
    ]);
    expect(parsed.applied).toHaveLength(1);
    expect(parsed.applied[0].event).toMatchObject({
      op: "write",
      decision: "allow",
      item_id: OLD,
    });
    expect(parsed.applied[0].item).toMatchObject({
      id: OLD,
      version: 2,
      status: "active",
      valid_to: LATER,
    });
    const last = logEvents(db).at(-1);
    expect(last).toMatchObject({ op: "write", decision: "allow", item_id: OLD });
    // Applied once, nothing is left to propose.
    const again = await cli(["supersede", NEW, ...store, "--json"]);
    expect(JSON.parse(again.out).proposals).toEqual([]);
  });

  it("an id the plan proposes no close for is refused before anything is written", async () => {
    const { db, store } = await setup();
    const before = logEvents(db).length;
    const { code, err } = await cli(["supersede", NEW, ...store, "--accept", NEW]);
    expect(code).toBe(1);
    expect(err).toContain("no close is proposed");
    expect(logEvents(db)).toHaveLength(before);
  });

  it("asked about the old version, names its head and proposes nothing", async () => {
    const { store } = await setup();
    const { code, out } = await cli(["supersede", OLD, ...store]);
    expect(code).toBe(0);
    expect(out).toContain(`head ${NEW}`);
    expect(out).toContain("nothing to propose");
  });

  it("an item the actor cannot read is unknown, exit 1", async () => {
    const { store } = await setup();
    const { code, out } = await cli(["supersede", NEW, ...store, "--as", "person:sam"]);
    expect(code).toBe(1);
    expect(out).toContain("unknown_id");
  });

  it("refuses a missing or malformed item id", async () => {
    const { store } = await setup();
    expect((await cli(["supersede", ...store])).code).toBe(2);
    expect((await cli(["supersede", "not-an-id", ...store])).code).toBe(2);
    expect((await cli(["supersede", NEW, ...store, "--accept", "nope"])).code).toBe(2);
  });

  it("a close the gate denies exits 1 (L6-6)", async () => {
    const root = await tempDir();
    const dir = await tempDir();
    const db = join(dir, "engram.db");
    const as = (who: string) => [
      "--store",
      "files",
      "--root",
      root,
      "--owner",
      "dana",
      "--db",
      db,
      "--as",
      who,
    ];
    // Dana's fact, granted to Sam for reading; Sam's own replacement names it.
    const granted = join(dir, "granted.json");
    await writeFile(
      granted,
      JSON.stringify({
        grants: [
          {
            to: "person:sam",
            class: "semantic",
            mode: "read",
            expires: "2027-01-01T00:00:00.000Z",
          },
        ],
      }),
    );
    const write = (who: string, ...more: string[]) => cli(["write", ...as(who), ...more]);
    expect(
      (
        await write(
          "person:dana",
          "--id",
          OLD,
          "--content",
          "Dana's desk is 4B.",
          "--valid-from",
          "2026-10-01T00:00:00Z",
          "--file",
          granted,
        )
      ).code,
    ).toBe(0);
    const replacement = join(dir, "replacement.json");
    await writeFile(replacement, JSON.stringify({ lineage: [OLD] }));
    expect(
      (
        await write(
          "person:sam",
          "--id",
          NEW,
          "--scope",
          "person:sam",
          "--content",
          "Dana's desk is 5C.",
          "--valid-from",
          LATER,
          "--file",
          replacement,
        )
      ).code,
    ).toBe(0);
    const plan = await cli(["supersede", NEW, ...as("person:sam"), "--json"]);
    expect(JSON.parse(plan.out).proposals).toEqual([
      expect.objectContaining({ item_id: OLD, action: "close" }),
    ]);
    // Sam may read Dana's item but not write into her scope.
    const { code, out } = await cli(["supersede", NEW, ...as("person:sam"), "--accept", OLD]);
    expect(code).toBe(1);
    expect(out).toContain("deny");
    expect(out).toContain("engram/write/membership");
  });

  it("a close the store refuses is reported, not an internal error (L6-3)", async () => {
    const root = await fixtureCopy();
    const dir = await tempDir();
    const db = join(dir, "engram.db");
    const store = ["--store", "files", "--root", root, "--owner", "dana", "--db", db];
    const imported = [...store, "--import-valid-from", VALID_FROM];
    expect((await cli(["read", ...imported])).code).toBe(0);
    const freeze = logEvents(db).find((e) => e.item?.content.toString().includes("Lantern"));
    const OLD_FILE = freeze?.item_id ?? "";
    expect(freeze?.item?.provenance.kind).toBe("import");
    const file = join(root, "project_release_freeze.md");
    const bytes = await readFile(file, "utf8");
    const replacement = join(dir, "replacement.json");
    await writeFile(replacement, JSON.stringify({ lineage: [OLD_FILE] }));
    const w = await cli([
      "write",
      ...store,
      "--id",
      NEW,
      "--content",
      "The freeze starts Wednesday.",
      "--valid-from",
      LATER,
      "--file",
      replacement,
    ]);
    expect(w.code).toBe(0);
    const plan = await cli(["supersede", NEW, ...store, "--json"]);
    expect(JSON.parse(plan.out).proposals).toEqual([
      expect.objectContaining({ item_id: OLD_FILE, action: "close" }),
    ]);
    const json = await cli(["supersede", NEW, ...store, "--accept", OLD_FILE, "--json"]);
    expect(json.code).toBe(1);
    expect(json.err).not.toContain("internal error");
    const parsed = JSON.parse(json.out);
    expect(parsed.applied).toEqual([]);
    expect(parsed.stopped).toMatchObject({
      item_id: OLD_FILE,
      event: { op: "write", decision: "deny", policy_id: "engram/write/store-failure" },
    });
    const human = await cli(["supersede", NEW, ...store, "--accept", OLD_FILE]);
    expect(human.code).toBe(1);
    expect(human.out).toContain(`not applied: ${OLD_FILE}`);
    expect(human.out).toContain("engram/write/store-failure");
    expect(await readFile(file, "utf8")).toBe(bytes);
  });
});
