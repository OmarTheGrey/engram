// `--store mcp-memory` (card A6 of the second absorb plan): write, read and
// explain through the CLI on the MCP reference memory server's JSONL file,
// --root naming the file as MEMORY_FILE_PATH does. A read adopts the
// server's own observations and relations into the owner's scope; the
// server's lines stay byte for byte through a governed write.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cli, tempDir } from "./helpers.ts";

const ID = "01920000-0000-7000-8000-0000000000a6";
const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/stores/mcp-memory/memory.jsonl",
);

const store = (file: string, db: string) => [
  ...["--store", "mcp-memory", "--root", file, "--owner", "dana", "--db", db],
];

describe("engram with --store mcp-memory", () => {
  it("writes into the server's file, keeps its lines, reads both back and explains the read", async () => {
    const file = join(await tempDir(), "memory.jsonl");
    const original = await readFile(FIXTURE, "utf8");
    await writeFile(file, original);
    const db = join(await tempDir(), "engram.db");

    const write = await cli([
      "write",
      ...store(file, db),
      ...["--id", ID, "--content", "Dana deploys on Tuesdays."],
    ]);
    expect(write.err).toBe("");
    expect(write.code).toBe(0);
    expect(write.out).toContain("policy preset.medium/write/person");
    const text = await readFile(file, "utf8");
    expect(text.startsWith(original)).toBe(true);
    expect(JSON.parse(text.slice(original.length))).toMatchObject({
      type: "entity",
      name: `engram:${ID}`,
      entityType: "engram",
      observations: [],
    });

    const read = await cli(["read", "deploys", ...store(file, db), "--json"]);
    expect(read.code).toBe(0);
    const parsed = JSON.parse(read.out);
    expect(parsed.items.map((i: { item: { id: string } }) => i.item.id)).toEqual([ID]);
    expect(parsed.items[0].item.store_ref).toEqual({ adapter: "mcp-memory", key: `item/${ID}` });

    // The tests' clock (helpers.ts NOW) is fixed; the file's modification time is not.
    const at = ["--import-valid-from", "2026-10-01T00:00:00Z"];
    const adopted = await cli(["read", "freeze", ...store(file, db), ...at, "--json"]);
    expect(adopted.code).toBe(0);
    const contents = JSON.parse(adopted.out)
      .items.map((i: { item: { content: string } }) => i.item.content)
      .sort();
    expect(contents).toEqual([
      "Dana announces Release freeze",
      "Release freeze: Starts on the Friday before each release",
    ]);

    const explain = await cli(["explain", parsed.read_id, "--db", db, "--owner", "dana"]);
    expect(explain.code).toBe(0);
    expect(explain.out).toContain(`read ${parsed.read_id}: 1 explanation`);
    expect(explain.out).toContain("admitted by preset.medium/read/person");
    expect((await readFile(file, "utf8")).startsWith(original)).toBe(true);
  }, 60_000);

  it("names the file --root takes when it is missing", async () => {
    const { code, err } = await cli(["read", "--store", "mcp-memory", "--owner", "dana"]);
    expect(code).toBe(2);
    expect(err).toContain("the mcp-memory store needs --root <memory.jsonl>");
  });
});
