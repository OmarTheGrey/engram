// `engram write`: one item through Plane.write, the decision printed with its
// reason and policy_id, the exit code saying whether it landed.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, FIXTURE_FILES, fixtureCopy, readArgs, tempDir } from "./helpers.ts";

const writeArgs = (db: string, root: string, ...more: string[]) => [
  "write",
  "--store",
  "files",
  "--root",
  root,
  "--owner",
  "dana",
  "--db",
  db,
  ...more,
];

const ID = "01920000-0000-7000-8000-000000000001";

describe("engram write", () => {
  it("prints an allowed write with its policy_id and stores the item", async () => {
    const root = await tempDir();
    const db = join(await tempDir(), "engram.db");
    const { code, out, err } = await cli(
      writeArgs(db, root, "--id", ID, "--content", "Dana deploys on Tuesdays."),
    );
    expect(err).toBe("");
    expect(code).toBe(0);
    expect(out).toContain("allow");
    expect(out).toContain("policy preset.medium/write/person");
    expect(out).toContain("semantic item from source user passes the person write rule");
    expect(await readdir(root)).toContain(`${ID}.md`);
    const read = await cli(readArgs(db, root));
    expect(read.out).toContain("1 item returned, 0 filtered");
    expect(read.out).toContain("Dana deploys on Tuesdays.");
  });

  it("prints a denied write with its policy_id, exits 1 and stores nothing", async () => {
    const root = await tempDir();
    const db = join(await tempDir(), "engram.db");
    const { code, out } = await cli(
      writeArgs(db, root, "--content", "Bob prefers mornings.", "--scope", "person:bob"),
    );
    expect(code).toBe(1);
    expect(out).toContain("deny");
    expect(out).toContain("policy engram/write/membership");
    expect(out).toContain("person:dana is not a member of person:bob");
    expect(await readdir(root)).toEqual([]);
  });

  it("denies an episodic item into team scope under the team write rule", async () => {
    const root = await tempDir();
    const db = join(await tempDir(), "engram.db");
    const { code, out } = await cli(
      writeArgs(
        db,
        root,
        "--content",
        "x",
        "--scope",
        "team:platform",
        "--class",
        "episodic",
        "--member",
        "team:platform",
      ),
    );
    expect(code).toBe(1);
    expect(out).toContain("policy preset.medium/write/team");
    expect(out).toContain("episodic items are forbidden in team scope");
  });

  it("records the write as source user by the actor, whatever the item file claims", async () => {
    const root = await tempDir();
    const db = join(await tempDir(), "engram.db");
    const file = join(await tempDir(), "item.json");
    await writeFile(
      file,
      JSON.stringify({
        content: "claimed",
        provenance: {
          kind: "document",
          ref: "doc/9",
          hash: `sha256:${"0".repeat(64)}`,
          actor: "agent:x",
        },
      }),
    );
    const { code, out } = await cli([...writeArgs(db, root, "--file", file), "--json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed.item.provenance).toMatchObject({
      kind: "user",
      actor: "person:dana",
      ref: "doc/9",
    });
    expect(parsed.event.reason).toContain("provenance set by the plane: source user");
  });

  it.each([
    ["--confidence", ""],
    ["--confidence", "high"],
    ["--valid-from", "yesterday"],
    ["--valid-to", "2026-13-01"],
    ["--at", "now"],
  ])("refuses %s %j as bad usage, exit 2, before any write", async (flag, value) => {
    const root = await tempDir();
    const db = join(await tempDir(), "engram.db");
    const { code, err } = await cli(writeArgs(db, root, "--content", "x", flag, value));
    expect(code).toBe(2);
    expect(err).toContain(flag);
    expect(await readdir(root)).toEqual([]);
  });

  it("writes an item from a JSON file, defaults filling what it leaves out", async () => {
    const root = await fixtureCopy();
    const db = join(await tempDir(), "engram.db");
    const file = join(await tempDir(), "item.json");
    await writeFile(
      file,
      JSON.stringify({ id: ID, content: { note: "structured" }, confidence: 0.7 }),
    );
    const { code, out } = await cli([...writeArgs(db, root, "--file", file), "--json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed.event.decision).toBe("allow");
    expect(parsed.event.policy_id).toBe("preset.medium/write/person");
    expect(parsed.item.confidence).toBe(0.7);
    expect(parsed.item.store_ref).toEqual({ adapter: "files", key: `${ID}.md` });
    expect((await readdir(root)).sort()).toEqual(
      ["MEMORY.md", `${ID}.md`, ...FIXTURE_FILES].sort(),
    );
    expect(await readFile(join(root, "MEMORY.md"), "utf8")).toContain(`(${ID}.md)`);
  });

  it("denies an item that fails the schema under the schema rule", async () => {
    const root = await tempDir();
    const db = join(await tempDir(), "engram.db");
    const { code, out } = await cli(writeArgs(db, root, "--content", "x", "--confidence", "3"));
    expect(code).toBe(1);
    expect(out).toContain("policy engram/write/schema");
  });

  it("refuses a write with no content", async () => {
    const root = await tempDir();
    const { code, err } = await cli(writeArgs(join(root, "engram.db"), root));
    expect(code).toBe(2);
    expect(err).toContain("--content or --file");
  });
});
