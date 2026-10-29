// `--store letta` (card A2, Gate B plan PR 2 item 5 with PR 3's workspace):
// write, read and explain through the CLI on a temporary MemFS repository,
// one git commit per allowed write, none for a denied one; a folder the
// adapter would refuse is a usage error before anything runs.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, tempDir } from "./helpers.ts";

const ID = "01920000-0000-7000-8000-0000000000a2";

const store = (root: string, db: string) => [
  "--store",
  "letta",
  "--root",
  root,
  "--owner",
  "dana",
  "--db",
  db,
];

/** Commit subjects in the repository, newest first. */
const log = (root: string) =>
  spawnSync("git", ["log", "--format=%s"], { cwd: root, encoding: "utf8" })
    .stdout.split("\n")
    .filter(Boolean);

describe("engram with --store letta", () => {
  it("writes into a fresh MemFS repository, reads it back, and explains the read", async () => {
    const root = join(await tempDir(), "memory");
    const db = join(await tempDir(), "engram.db");
    const write = await cli([
      "write",
      ...store(root, db),
      "--id",
      ID,
      "--content",
      "Dana deploys on Tuesdays.",
    ]);
    expect(write.err).toBe("");
    expect(write.code).toBe(0);
    expect(write.out).toContain("policy preset.medium/write/person");
    expect(await readdir(join(root, "engram"))).toContain(`${ID}.md`);
    expect(log(root)).toEqual([
      `engram: write ${ID} (semantic in person:dana, version 1)`,
      "engram: list engram/ in MEMORY.md",
    ]);

    const denied = await cli([
      "write",
      ...store(root, db),
      "--content",
      "Bob prefers mornings.",
      "--scope",
      "person:bob",
    ]);
    expect(denied.code).toBe(1);
    expect(denied.out).toContain("policy engram/write/membership");
    expect(log(root)).toHaveLength(2);

    const read = await cli(["read", ...store(root, db), "--json"]);
    expect(read.code).toBe(0);
    const parsed = JSON.parse(read.out);
    expect(parsed.items.map((i: { item: { id: string } }) => i.item.id)).toEqual([ID]);
    expect(parsed.items[0].item.store_ref).toEqual({
      adapter: "letta",
      key: `engram/${ID}.md`,
    });

    const explain = await cli(["explain", parsed.read_id, "--db", db, "--owner", "dana"]);
    expect(explain.code).toBe(0);
    expect(explain.out).toContain(`read ${parsed.read_id}: 1 explanation`);
    expect(explain.out).toContain(ID);
    expect(explain.out).toContain("admitted by preset.medium/read/person");
  }, 60_000);

  it("refuses a folder that is neither a repository nor empty, before writing anything", async () => {
    const root = await tempDir();
    await writeFile(join(root, "notes.txt"), "mine");
    const db = join(await tempDir(), "engram.db");
    const { code, err } = await cli(["write", ...store(root, db), "--content", "x"]);
    expect(code).toBe(2);
    expect(err).toContain("neither a git repository's top level nor an empty folder");
    expect(await readdir(root)).toEqual(["notes.txt"]);
  });

  it("a bad --db leaves a missing --root missing (review finding I-1)", async () => {
    const root = join(await tempDir(), "memory");
    const { code, err } = await cli([
      "write",
      ...store(root, "postgres://u:p@[bad/db"),
      "--content",
      "x",
    ]);
    expect(code).toBe(2);
    expect(err).not.toBe("");
    expect(existsSync(root)).toBe(false);
  });

  it("read and retain never create or initialise a folder; the error names it (M-1)", async () => {
    const db = join(await tempDir(), "engram.db");
    const missing = join(await tempDir(), "memory");
    const read = await cli(["read", ...store(missing, db)]);
    expect(read.code).toBe(2);
    expect(read.err).toContain(missing);
    expect(read.err).toContain("only a command that writes initialises a MemFS repository");
    expect(existsSync(missing)).toBe(false);

    const empty = await tempDir();
    const retain = await cli(["retain", ...store(empty, db), "--scope", "person:dana"]);
    expect(retain.code).toBe(2);
    expect(retain.err).toContain(empty);
    expect(await readdir(empty)).toEqual([]);
  });

  it("read on a repository a write made reads it without a new commit", async () => {
    const root = join(await tempDir(), "memory");
    const db = join(await tempDir(), "engram.db");
    await cli(["write", ...store(root, db), "--id", ID, "--content", "Dana deploys on Tuesdays."]);
    const before = log(root);
    const read = await cli(["read", ...store(root, db)]);
    expect(read.code).toBe(0);
    expect(read.out).toContain("Dana deploys on Tuesdays.");
    expect(log(root)).toEqual(before);
  }, 60_000);

  it("needs --root and --owner", async () => {
    const db = join(await tempDir(), "engram.db");
    const noRoot = await cli(["read", "--store", "letta", "--owner", "dana", "--db", db]);
    expect(noRoot.code).toBe(2);
    expect(noRoot.err).toContain("the letta store needs --root <MemFS folder>");
    const noOwner = await cli(["read", "--store", "letta", "--root", await tempDir(), "--db", db]);
    expect(noOwner.code).toBe(2);
    expect(noOwner.err).toContain("the letta store needs --owner <id>");
  });
});
