// The MCP reference memory server's own tests that apply to the file format,
// ported to the mcp-memory adapter (card A6 of the second absorb plan,
// docs/conventions/absorption.md: the source's tests for the part taken).
//
// Ported from modelcontextprotocol/servers, src/memory/__tests__/
// (extra-fields.test.ts, persistence.test.ts, file-lock.test.ts,
// atomic-save.test.ts), version 2.2.1 at
// c799c8552b0f27b7a33a7b9233773da144dddcf5, licence in transition from MIT to
// Apache-2.0: the cases rewritten against the adapter, no code copied. Each
// case names the upstream case it ports. Left out: the cases about the
// server's tools, protocol, limits, exit handlers and lock heartbeat, which
// the adapter does not have, and the lock-break races (#5560), which the
// shared lock does not yet guard (docs/tasks/backlog.md, card A6's rows).
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import type { MemoryItem } from "@engram/core";
import { afterAll, describe, expect, test } from "vitest";
import { createMcpMemoryAdapter } from "../../src/mcp-memory/index.ts";

const dirs: string[] = [];
afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

async function fresh(): Promise<{ dir: string; file: string }> {
  const dir = await mkdtemp(join(tmpdir(), "engram-mcp-upstream-"));
  dirs.push(dir);
  return { dir, file: join(dir, "memory.jsonl") };
}

const open = (file: string, lockWaitMs?: number) =>
  createMcpMemoryAdapter({
    file,
    owner: "dana",
    importValidFrom: "2026-11-01T00:00:00Z",
    lockWaitMs,
  });

const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const item = (n: number): MemoryItem =>
  ({
    id: id(n),
    class: "semantic",
    scope: "person:dana",
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
  }) as MemoryItem;

describe("unmodelled fields on stored records (upstream extra-fields.test.ts)", () => {
  test("keeps a __proto__ member as data (keeps a __proto__ member as data)", async () => {
    const { file } = await fresh();
    const line =
      '{"type":"entity","name":"Dave","entityType":"person","observations":["x"],"__proto__":{"polluted":true}}';
    await writeFile(file, `${line}\n`);
    const adapter = open(file);
    const ref = await adapter.write(item(1));
    expect((await readFile(file, "utf8")).split("\n")[0]).toBe(line);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    await adapter.delete(ref);
    expect(await readFile(file, "utf8")).toBe(`${line}\n`);
  });

  test("keeps a client's members on the item's line across a restart (keeps them across a restart of the server)", async () => {
    const { file } = await fresh();
    await open(file).write(item(2));
    const text = await readFile(file, "utf8");
    const withField = text.replace(
      '"observations":[]',
      '"observations":[],"createdAt":"2026-11-02"',
    );
    await writeFile(file, withField);
    await open(file).write({ ...item(2), version: 2, content: "again" } as MemoryItem);
    expect(JSON.parse((await readFile(file, "utf8")).trim()).createdAt).toBe("2026-11-02");
  });
});

describe("the file format (upstream persistence.test.ts)", () => {
  test("one JSON object a line with a trailing newline (writes one JSON object per line, ...)", async () => {
    const { file } = await fresh();
    await open(file).write(item(3));
    const text = await readFile(file, "utf8");
    expect(text.endsWith("\n")).toBe(true);
    expect(
      text
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l).type),
    ).toEqual(["entity"]);
  });

  test("a read creates no file (does not create the file until the first write)", async () => {
    const { dir, file } = await fresh();
    const adapter = open(file);
    await adapter.list("person:dana");
    await adapter.search?.("x", ["person:dana"]);
    expect(await readdir(dir)).toEqual([]);
  });

  test("a write leaves only the graph file (leaves only the graph file behind after a write)", async () => {
    const { dir, file } = await fresh();
    await open(file).write(item(4));
    expect(await readdir(dir)).toEqual(["memory.jsonl"]);
  });

  test("keeps the unreadable lines on the next unrelated write (#4885)", async () => {
    const { file } = await fresh();
    const unreadable = ["not json", "[1,2]", '{"type":"entity","name":"x"}', '{"type":"other"}'];
    await writeFile(file, `${unreadable.join("\n")}\n`);
    await open(file).write(item(5));
    expect((await readFile(file, "utf8")).split("\n").slice(0, 4)).toEqual(unreadable);
  });

  test("keeps both of two concurrent writes from two writers on one file (#4797)", async () => {
    const { file } = await fresh();
    await Promise.all([open(file).write(item(6)), open(file).write(item(7))]);
    expect((await open(file).list("person:dana")).map((i) => i.id).sort()).toEqual([id(6), id(7)]);
  });

  test.skipIf(process.platform === "win32")(
    "keeps a hardened graph file's mode across a save",
    async () => {
      const { file } = await fresh();
      await writeFile(file, "", { mode: 0o600 });
      await open(file).write(item(8));
      expect((await stat(file)).mode & 0o777).toBe(0o600);
    },
  );
});

describe("the lock file (upstream file-lock.test.ts)", () => {
  test("holds the lock file while the operation runs and removes it after", async () => {
    const { file } = await fresh();
    let held = false;
    const adapter = createMcpMemoryAdapter({
      file,
      owner: "dana",
      lockSeams: {
        afterAcquire: async () => {
          held = (await readFile(`${file}.lock`, "utf8")).length > 0;
        },
      },
    });
    await adapter.write(item(9));
    expect(held).toBe(true);
    await expect(readFile(`${file}.lock`)).rejects.toThrow();
  });

  test("releases the lock when the operation fails", async () => {
    const { file } = await fresh();
    const adapter = open(file);
    await expect(adapter.write({ ...item(10), id: "not-a-uuid" } as MemoryItem)).rejects.toThrow();
    await expect(readFile(`${file}.lock`)).rejects.toThrow();
    await adapter.write(item(10));
  });

  test("breaks a lock whose owner on this host has exited", async () => {
    const { file } = await fresh();
    const { pid } = spawnSync(process.execPath, ["-e", ""]);
    await writeFile(`${file}.lock`, JSON.stringify({ pid, hostname: hostname(), token: "dead" }));
    await open(file, 500).write(item(11));
    await expect(readFile(`${file}.lock`)).rejects.toThrow();
  });
});

describe("atomic saves (upstream atomic-save.test.ts)", () => {
  test("does not leave temporary files behind after a successful write", async () => {
    const { dir, file } = await fresh();
    const adapter = open(file);
    for (let n = 12; n < 17; n++) await adapter.write(item(n));
    expect(await readdir(dir)).toEqual(["memory.jsonl"]);
  });

  test("still persists graph contents correctly across reloads", async () => {
    const { file } = await fresh();
    const refs = [];
    for (let n = 17; n < 20; n++) refs.push(await open(file).write(item(n)));
    for (const [k, ref] of refs.entries())
      expect((await open(file).read(ref))?.content).toBe(`fact ${17 + k}`);
  });
});
