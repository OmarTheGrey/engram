// `engram read` over the synthetic Claude Code memory folder: the Gate A
// demo (card A3's acceptance) on a fixture, through Plane.read.
import { existsSync } from "node:fs";
import { rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadPreset } from "@engram/core";
import { describe, expect, it } from "vitest";
import {
  cli,
  FIXTURE,
  FIXTURE_FILES,
  fixtureCopy,
  logEvents,
  NOW,
  readArgs,
  tempDir,
} from "./helpers.ts";

const itemLines = (out: string) => out.match(/^\d+\. /gm) ?? [];

describe("engram read", () => {
  it("lists every memory in the folder to its owner, each with its explanation", async () => {
    const db = join(await tempDir(), "engram.db");
    const { code, out, err } = await cli(readArgs(db));
    expect(err).toBe("");
    expect(code).toBe(0);
    expect(out).toContain("4 items returned, 0 filtered");
    expect(itemLines(out)).toEqual(["1. ", "2. ", "3. ", "4. "]);
    expect(out.match(/admitted by preset\.medium\/read\/person/g)).toHaveLength(4);
    expect(out.match(/score 1\.0505 = confidence 0\.5000 \+ recency 0\.5505/g)).toHaveLength(4);
    for (const file of FIXTURE_FILES) expect(out).toContain(`/${file}`);
    expect(out).toContain(`at ${NOW} as person:dana (person)`);
  });

  it("imports the folder's memories through the write gate, once", async () => {
    const db = join(await tempDir(), "engram.db");
    const first = await cli(readArgs(db));
    expect(first.out).toContain(
      "imported 4 of 4 memories: 4 allowed, 0 denied, 0 already in the log",
    );
    const second = await cli(readArgs(db));
    expect(second.out).toContain(
      "imported 0 of 4 memories: 0 allowed, 0 denied, 4 already in the log",
    );
    expect(second.out).toContain("4 items returned, 0 filtered");
  });

  it("returns nothing to another person and reveals no count of what it cannot reach", async () => {
    const db = join(await tempDir(), "engram.db");
    const { code, out } = await cli(readArgs(db, FIXTURE, "--as", "person:eve"));
    expect(code).toBe(0);
    expect(out).toContain("0 items returned, 0 filtered");
    expect(itemLines(out)).toEqual([]);
  });

  it("adopts the folder as its owner, whoever reads (decision D8)", async () => {
    const db = join(await tempDir(), "engram.db");
    await cli(readArgs(db, FIXTURE, "--as", "person:eve"));
    const events = logEvents(db);
    const writes = events.filter((e) => e.op === "write");
    expect(writes).toHaveLength(4);
    for (const e of writes) {
      expect(e.actor).toBe("person:dana");
      expect(e.decision).toBe("allow");
      expect(e.reason).toMatch(/^adopted from store files: /);
      expect(e.item?.provenance).toMatchObject({ kind: "import", actor: "person:dana" });
    }
    expect(events.filter((e) => e.op === "read").map((e) => e.actor)).toEqual(["person:eve"]);
  });

  it("stops returning a memory once its file is deleted, and says it retired it", async () => {
    const root = await fixtureCopy();
    const db = join(await tempDir(), "engram.db");
    await cli(readArgs(db, root));
    await rm(join(root, "reference_runbook.md"));

    const { out } = await cli(readArgs(db, root));

    expect(out).toContain("imported 0 of 3 memories: 0 allowed, 0 denied, 3 already in the log");
    expect(out).toMatch(
      /^ {2}retired [0-9a-f-]{36}: adopted from store files: item .* is no longer/m,
    );
    // The retired item is still in the owner's reach, so it counts as filtered (not active).
    expect(out).toContain("3 items returned, 1 filtered");
    expect(out).not.toContain("/reference_runbook.md");
  });

  it("touching a memory file, its content unchanged, adds no write, retire or deny", async () => {
    const root = await fixtureCopy();
    const first = new Date("2026-10-01T00:00:00.000Z");
    for (const file of FIXTURE_FILES) await utimes(join(root, file), first, first);
    const db = join(await tempDir(), "engram.db");
    // No --import-valid-from: each imported memory's valid_from is its file's mtime.
    const args = readArgs(db, root).filter(
      (a, i, all) => a !== "--import-valid-from" && all[i - 1] !== "--import-valid-from",
    );
    await cli(args);
    const before = logEvents(db).filter((e) => e.op !== "read");

    const touched = new Date("2026-10-20T00:00:00.000Z");
    await utimes(join(root, "user_role.md"), touched, touched);
    const { code, out } = await cli(args);

    expect(code).toBe(0);
    expect(out).toContain("imported 0 of 4 memories: 0 allowed, 0 denied, 4 already in the log");
    expect(logEvents(db).filter((e) => e.op !== "read")).toEqual(before);
    expect(out).toContain("4 items returned, 0 filtered");
  });

  it("retires a memory file it can no longer parse, saying the store cannot read it", async () => {
    const root = await fixtureCopy();
    const db = join(await tempDir(), "engram.db");
    await cli(readArgs(db, root));
    await writeFile(join(root, "reference_runbook.md"), "---\nname: [unclosed\n---\nBody.\n");

    const { out } = await cli(readArgs(db, root));

    expect(out).toMatch(
      /^ {2}retired [0-9a-f-]{36}: adopted from store files: store files can no longer read item [0-9a-f-]{36} \(reference_runbook\.md\): files adapter: reference_runbook\.md has unreadable frontmatter/m,
    );
    expect(out).not.toContain("is no longer in store");
    expect(out).not.toContain("/reference_runbook.md\n");
  });

  it("keeps the log under the home folder by default, not the working directory (D9)", async () => {
    const cwd = await tempDir();
    const home = await tempDir();
    const args = readArgs("unused", FIXTURE).slice(0, -2);
    const { code, out } = await cli(args, { cwd, home });
    expect(code).toBe(0);
    const expected = join(home, ".engram", "engram.db");
    expect(existsSync(expected)).toBe(true);
    expect(existsSync(join(cwd, ".engram"))).toBe(false);
    expect(out).toContain(`log ${expected}`);
  });

  it("takes every id from its Io, so a run is reproducible", async () => {
    const db = join(await tempDir(), "engram.db");
    const { out } = await cli(readArgs(db, FIXTURE, "--json"));
    const ids = logEvents(db).map((e) => e.id);
    expect(ids.every((i) => i.startsWith("01930000-0000-7000-8000-"))).toBe(true);
    expect(JSON.parse(out).read_id).toBe(ids.at(-1));
  });

  it("narrows to the memories the query text matches, with a relevance component", async () => {
    const db = join(await tempDir(), "engram.db");
    const { out } = await cli(readArgs(db, FIXTURE, "release freeze"));
    expect(out).toContain("1 item returned, 0 filtered");
    expect(out).toContain("/project_release_freeze.md");
    expect(out).toMatch(/score 2\.0505 = relevance 1\.0000 \+ confidence 0\.5000/);
  });

  it("filters memories that are not yet valid at the read time", async () => {
    const db = join(await tempDir(), "engram.db");
    const { out } = await cli(readArgs(db, FIXTURE, "--at", "2026-09-01T00:00:00Z"));
    expect(out).toContain("0 items returned, 4 filtered");
  });

  it("prints machine-readable output with --json", async () => {
    const db = join(await tempDir(), "engram.db");
    const { code, out } = await cli(readArgs(db, FIXTURE, "--json"));
    expect(code).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed.filtered).toBe(0);
    expect(parsed.items).toHaveLength(4);
    expect(parsed.items.map((i: { explanation: { rank: number } }) => i.explanation.rank)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(parsed.items[0].item.provenance.kind).toBe("import");
    expect(parsed.items[0].explanation.policy_id).toBe("preset.medium/read/person");
    expect(parsed.read_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(parsed.imported).toEqual({
      listed: 4,
      allowed: 4,
      denied: 0,
      unchanged: 0,
      retired: 0,
    });
  });

  it("reads under another preset by name", async () => {
    const db = join(await tempDir(), "engram.db");
    const { out } = await cli(readArgs(db, FIXTURE, "--policy", "strict"));
    expect(out).toContain("under preset.strict");
    expect(out.match(/admitted by preset\.strict\/read\/person/g)).toHaveLength(4);
  });

  it("runs retention before adoption: expired memories are excluded, then retired (ADR 0025)", async () => {
    const dir = await tempDir();
    const db = join(dir, "engram.db");
    // The medium preset with a one-day ttl on every person-scope class: the
    // fixture's memories are valid from 2026-10-01, so at NOW they are expired.
    const medium = loadPreset("medium");
    const policy = join(dir, "short-ttl.yaml");
    await writeFile(
      policy,
      JSON.stringify({
        ...medium,
        retention: medium.retention.map((r) => (r.scope === "person" ? { ...r, ttl: 86_400 } : r)),
      }),
    );
    // First read: nothing in the log to sweep; adopted, then excluded at read.
    const first = await cli(readArgs(db, FIXTURE, "--policy", policy));
    expect(first.out).toContain("retention: 0 expired, 0 evicted");
    expect(first.out).toContain("0 items returned, 4 filtered");
    expect(first.out).toContain("4 past their ttl");
    // Second read: the sweep retires them first, and adoption leaves them retired.
    const second = await cli(readArgs(db, FIXTURE, "--policy", policy, "--json"));
    const parsed = JSON.parse(second.out);
    expect(parsed.retention.expired).toHaveLength(4);
    expect(parsed.retention.events.map((e: { op: string }) => e.op)).toEqual([
      "retire",
      "retire",
      "retire",
      "retire",
    ]);
    expect(parsed.imported).toMatchObject({ allowed: 0, unchanged: 4 });
    expect(parsed.returned).toBe(0);
    const retires = logEvents(db).filter((e) => e.op === "retire");
    expect(retires.every((e) => e.actor === "person:dana" && e.decision === "allow")).toBe(true);
  });

  it("prints the evictions adoption causes (review finding P4-10)", async () => {
    const dir = await tempDir();
    const db = join(dir, "engram.db");
    const medium = loadPreset("medium");
    const policy = join(dir, "one-slot.yaml");
    await writeFile(
      policy,
      JSON.stringify({
        ...medium,
        retention: medium.retention.map((r) =>
          r.scope === "person" ? { ...r, budget: 1, eviction: "recency" } : r,
        ),
      }),
    );
    const { out } = await cli(readArgs(db, FIXTURE, "--policy", policy));
    expect(out).toMatch(/^ {2}evicted \S+ during adoption: /m);
    const json = JSON.parse(
      (await cli(readArgs(join(dir, "b.db"), FIXTURE, "--policy", policy, "--json"))).out,
    );
    expect(json.evictions.length).toBeGreaterThan(0);
    expect(json.evictions.every((e: { op: string }) => e.op === "evict")).toBe(true);
  });

  it("refuses a read without a store root", async () => {
    const { code, err } = await cli(["read", "--owner", "dana"]);
    expect(code).toBe(2);
    expect(err).toContain("--root");
  });

  it("refuses a store the CLI cannot open yet", async () => {
    const { code, err } = await cli(["read", "--store", "mem0", "--root", FIXTURE]);
    expect(code).toBe(2);
    expect(err).toContain("mem0");
  });
});
