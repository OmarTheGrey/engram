// `engram promote <item-id> --to <scope> [--review]` (card E2.5, ADR 0026):
// one Plane.promote call, the decision printed with its reason and
// policy_id; exit 0 when it landed, 1 on deny or ask, 2 on bad usage.
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, logEvents, tempDir } from "./helpers.ts";

const store = (db: string, root: string) => [
  "--store",
  "files",
  "--root",
  root,
  "--owner",
  "dana",
  "--db",
  db,
];

const EPISODE = "01940000-0000-7000-8000-000000000001";
const FACT = "Dana deploys on Tuesdays.";
const MEMBERS = ["--member", "person:dana", "--member", "team:platform"];

/** `engram write` of FACT as an episodic item in dana's scope, by `as`. */
const record = (db: string, root: string, as: string, n: number, content = FACT) => [
  "write",
  ...store(db, root),
  "--as",
  as,
  ...MEMBERS,
  "--id",
  `01940000-0000-7000-8000-00000000000${n}`,
  "--scope",
  "person:dana",
  "--class",
  "episodic",
  "--content",
  content,
];

const promote = (db: string, root: string, ...more: string[]) => [
  "promote",
  EPISODE,
  "--to",
  "team:platform",
  ...store(db, root),
  ...MEMBERS,
  ...more,
];

async function setup() {
  const root = await tempDir();
  const db = join(await tempDir(), "engram.db");
  return { root, db };
}

describe("engram promote", () => {
  it("promotes only after k confirmations by distinct people (medium: 3)", async () => {
    const { root, db } = await setup();
    expect((await cli(record(db, root, "person:dana", 1))).code).toBe(0);
    // dana restating her own fact does not count again.
    expect((await cli(record(db, root, "person:dana", 2, "dana deploys on tuesdays."))).code).toBe(
      0,
    );
    expect((await cli(record(db, root, "person:sam", 3))).code).toBe(0);

    const early = await cli(promote(db, root));
    expect(early.code).toBe(1);
    expect(early.out).toContain("promote");
    expect(early.out).toContain("deny");
    expect(early.out).toContain("policy engram/promote/no-evidence");
    expect(early.out).toContain("2 of the 3");

    expect((await cli(record(db, root, "person:lee", 4))).code).toBe(0);
    const { code, out } = await cli([...promote(db, root), "--json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed.decision).toBe("allow");
    expect(parsed.event.policy_id).toBe("preset.medium/promotion/episodic-to-semantic");
    expect(parsed.item).toMatchObject({
      class: "semantic",
      scope: "team:platform",
      lineage: [
        EPISODE,
        "01940000-0000-7000-8000-000000000003",
        "01940000-0000-7000-8000-000000000004",
      ],
    });
    expect(parsed.events.map((e: { op: string }) => e.op)).toEqual(["promote", "retire"]);
    expect(await readdir(root)).toContain(`${parsed.item.id}.md`);
  });

  it("records the approver on the review path and refuses the owner", async () => {
    const { root, db } = await setup();
    await cli(record(db, root, "person:dana", 1));
    const own = await cli([...promote(db, root), "--review"]);
    expect(own.code).toBe(1);
    expect(own.out).toContain("policy engram/promote/reviewer");
    expect(own.out).toContain("cannot approve its own item");

    const { code, out } = await cli([...promote(db, root), "--review", "--as", "person:sam"]);
    expect(code).toBe(0);
    expect(out).toContain("promote");
    expect(out).toContain("by person:sam");
    expect(out).toContain("approved by person:sam");
    expect(out).toContain("policy preset.medium/promotion/review");
    expect(out).toMatch(/item \S+ semantic in team:platform, status active/);
    const events = logEvents(db);
    expect(events.at(-2)).toMatchObject({ op: "promote", decision: "allow", actor: "person:sam" });
    expect(events.at(-1)).toMatchObject({ op: "retire", item_id: EPISODE });
  });

  it("asks, exit 1, when the target requires review and nobody reviews", async () => {
    const { root, db } = await setup();
    await cli(record(db, root, "person:dana", 1));
    const { code, out } = await cli([
      "promote",
      EPISODE,
      "--to",
      "org",
      ...store(db, root),
      "--member",
      "person:dana",
      "--member",
      "org",
    ]);
    expect(code).toBe(1);
    expect(out).toContain("gate");
    expect(out).toContain("ask");
    expect(out).toContain("policy preset.medium/promotion/review");
    expect(logEvents(db).at(-1)).toMatchObject({ op: "gate", decision: "ask" });
  });

  it.each([
    [[], "give exactly one item id"],
    [[EPISODE, "extra"], "give exactly one item id"],
    [[EPISODE], "--to <scope>"],
    [[EPISODE, "--to", "everywhere"], "--to everywhere is not a scope"],
    [["not-an-id", "--to", "org"], "not-an-id is not an item id"],
  ])("refuses %j as bad usage, exit 2", async (args, text) => {
    const { root, db } = await setup();
    const { code, err } = await cli(["promote", ...args, ...store(db, root)]);
    expect(code).toBe(2);
    expect(err).toContain(text);
  });
});
