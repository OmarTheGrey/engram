// Card A6's review (second absorb plan): what the first round left untested
// or got wrong. A governed delete keeps the records other clients added to
// the item's line; the file's bytes survive where the text would not (a
// missing final newline, invalid UTF-8); the copy and collision edge cases;
// the lock as the server and the adapter judge each other's crashed holder;
// two instances writing at once; the sweep of a crashed writer's temp file.
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import type { MemoryItem } from "@engram/core";
import { afterAll, describe, expect, test } from "vitest";
import { createMcpMemoryAdapter, ReadOnlyRecordError } from "../../src/mcp-memory/index.ts";
import { addObservations, serverJudgesOwnerDead, serverWrite } from "./server-format.ts";

const dirs: string[] = [];
afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

async function fresh(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "engram-mcp-review-"));
  dirs.push(dir);
  return join(dir, "memory.jsonl");
}

const open = (file: string, lockWaitMs?: number) =>
  createMcpMemoryAdapter({
    file,
    owner: "dana",
    importValidFrom: "2026-11-01T00:00:00Z",
    lockWaitMs,
  });

const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const item = (n: number, over: Partial<MemoryItem> = {}): MemoryItem =>
  ({
    id: id(n),
    class: "semantic",
    scope: "team:platform",
    owner: "person:dana",
    content: `fact ${n}`,
    provenance: {
      kind: "user",
      ref: "doc/1",
      hash: `sha256:${"0".repeat(64)}`,
      actor: "person:dana",
    },
    confidence: 0.9,
    valid_from: "2026-10-01T00:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
    ...over,
  }) as MemoryItem;

/** The pid of a process that has exited. */
const deadPid = () => spawnSync(process.execPath, ["-e", ""]).pid as number;

describe("a governed delete keeps other clients' records (review finding 2)", () => {
  test("a line a client added observations to loses only its engram member", async () => {
    const file = await fresh();
    const adapter = open(file);
    const ref = await adapter.write(item(1));
    await serverWrite(file, (g) => addObservations(g, `engram:${id(1)}`, ["noted by a client"]));
    const before = (await adapter.list("person:dana")).map((i) => i.store_ref?.key);
    await adapter.delete(ref);
    expect(await adapter.read(ref)).toBeUndefined();
    const line = JSON.parse((await readFile(file, "utf8")).trim());
    expect(line).toEqual({
      type: "entity",
      name: `engram:${id(1)}`,
      entityType: "engram",
      observations: ["noted by a client"],
    });
    // The client's observation keeps its ref.
    expect((await adapter.list("person:dana")).map((i) => i.store_ref?.key)).toEqual(before);
  });

  test("a line holding a client's own field keeps it; a bare line goes", async () => {
    const file = await fresh();
    const adapter = open(file);
    const kept = await adapter.write(item(2));
    const gone = await adapter.write(item(3));
    await serverWrite(file, (g) => {
      const e = g.entities.find((x) => x.name === `engram:${id(2)}`);
      if (e) e.extras = { ...e.extras, createdAt: "2026-11-02T00:00:00Z" };
    });
    await adapter.delete(kept);
    await adapter.delete(gone);
    const lines = (await readFile(file, "utf8")).split("\n").filter(Boolean);
    expect(lines.map((l) => JSON.parse(l))).toEqual([
      {
        type: "entity",
        name: `engram:${id(2)}`,
        entityType: "engram",
        observations: [],
        createdAt: "2026-11-02T00:00:00Z",
      },
    ]);
  });
});

describe("the file's bytes, not only its text (review finding 6)", () => {
  test("a file with no final newline comes back identical after a write and a delete", async () => {
    const file = await fresh();
    const original = JSON.stringify({
      type: "entity",
      name: "A",
      entityType: "t",
      observations: ["x"],
    });
    await writeFile(file, original);
    const adapter = open(file);
    const ref = await adapter.write(item(4));
    expect((await readFile(file, "utf8")).startsWith(`${original}\n`)).toBe(true);
    await adapter.delete(ref);
    expect(await readFile(file, "utf8")).toBe(original);
  });

  test("a line of invalid UTF-8 is written back as its bytes", async () => {
    const file = await fresh();
    const bad = Buffer.concat([
      Buffer.from('{"type":"note","text":"'),
      Buffer.from([0xff, 0xfe]),
      Buffer.from('"}\n'),
    ]);
    await writeFile(file, bad);
    const adapter = open(file);
    const ref = await adapter.write(item(5));
    expect((await readFile(file)).subarray(0, bad.length).equals(bad)).toBe(true);
    await adapter.delete(ref);
    expect((await readFile(file)).equals(bad)).toBe(true);
  });
});

describe("copies and collisions (review finding 7)", () => {
  test("an Engram entity the server would not read blocks a write of its id instead of being duplicated", async () => {
    const file = await fresh();
    const broken = JSON.stringify({
      type: "entity",
      name: `engram:${id(6)}`,
      entityType: "engram",
      observations: [1],
      engram: item(6),
    });
    await writeFile(file, `${broken}\n`);
    await expect(open(file).write(item(6))).rejects.toThrow(ReadOnlyRecordError);
    expect(await readFile(file, "utf8")).toBe(`${broken}\n`);
  });

  test("a renamed copy carrying another item's name does not block that item's own writes", async () => {
    const file = await fresh();
    const adapter = open(file);
    const refB = await adapter.write(item(8));
    await adapter.write(item(7));
    const text = await readFile(file, "utf8");
    const copyOfSeven = (text.split("\n")[1] ?? "").replace(
      `"engram:${id(7)}"`,
      `"engram:${id(8)}"`,
    );
    await writeFile(file, `${text}${copyOfSeven}\n`);
    await adapter.write(item(8, { version: 2, content: "B again" }));
    expect((await adapter.read(refB))?.content).toBe("B again");
  });
});

describe("the shared lock, judged from both sides (review finding 3)", () => {
  test("a lock the server left on this machine with a dead pid is broken at once", async () => {
    const file = await fresh();
    await writeFile(
      `${file}.lock`,
      JSON.stringify({ pid: deadPid(), hostname: hostname(), token: "dead" }),
    );
    // Fresh by its file time, so only the dead pid can break it inside the wait.
    await open(file, 500).write(item(9));
    await expect(readFile(`${file}.lock`)).rejects.toThrow();
  });

  test("a live server's lock is named as the server's when the wait runs out", async () => {
    const file = await fresh();
    await writeFile(
      `${file}.lock`,
      JSON.stringify({ pid: process.pid, hostname: hostname(), token: "x" }),
    );
    await expect(open(file, 200).write(item(10))).rejects.toThrow(
      /held by the MCP memory server, pid/,
    );
  });

  test("an Engram lock left by a dead pid is broken by the next Engram writer", async () => {
    const file = await fresh();
    const record = {
      pid: deadPid(),
      host: hostname(),
      hostname: hostname(),
      token: "t",
      started: new Date().toISOString(),
    };
    await writeFile(`${file}.lock`, JSON.stringify(record));
    await open(file, 500).write(item(11));
    await expect(readFile(`${file}.lock`)).rejects.toThrow();
  });

  test("the server reads an Engram lock's record: its holder's pid and hostname", async () => {
    const file = await fresh();
    const seen: string[] = [];
    const adapter = createMcpMemoryAdapter({
      file,
      owner: "dana",
      lockSeams: {
        afterAcquire: async () => void seen.push(await readFile(`${file}.lock`, "utf8")),
      },
    });
    await adapter.write(item(12));
    const text = seen[0] ?? "";
    expect(JSON.parse(text)).toMatchObject({ pid: process.pid, hostname: hostname() });
    // Alive now, so the server waits; the same record from a dead pid it breaks at once.
    expect(serverJudgesOwnerDead(text)).toBe(false);
    expect(serverJudgesOwnerDead(JSON.stringify({ ...JSON.parse(text), pid: deadPid() }))).toBe(
      true,
    );
  });
});

describe("writers sharing the file (review finding 5)", () => {
  test("two instances writing at once keep every write", async () => {
    const file = await fresh();
    const a = open(file);
    const b = open(file);
    await Promise.all(
      Array.from({ length: 20 }, (_, n) => (n % 2 === 0 ? a : b).write(item(100 + n))),
    );
    const listed = (await open(file).list("team:platform")).map((i) => i.id).sort();
    expect(listed).toEqual(Array.from({ length: 20 }, (_, n) => id(100 + n)).sort());
  });

  test("a crashed writer's temporary file is swept by the first write; another file's is not", async () => {
    const file = await fresh();
    const dir = join(file, "..");
    const crashed = ".memory.jsonl.99999.1.engram-tmp";
    const other = ".notes.md.99999.1.engram-tmp";
    await writeFile(join(dir, crashed), "half a graph");
    await writeFile(join(dir, other), "someone else's");
    await open(file).write(item(13));
    expect((await readdir(dir)).sort()).toEqual([other, "memory.jsonl"].sort());
  });
});
