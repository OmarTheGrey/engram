// Card A6 of the second absorb plan: the mcp-memory adapter's own behaviour
// beyond the conformance suite. The MCP reference memory server's lines and
// members the adapter does not understand survive every governed write and
// delete byte for byte; observations and relations list as read-only items
// under stable derived refs; a server rewrite (server-format.ts, a port of
// its load and save) loses no Engram item; copies, unsafe files and the
// server's own lock are handled as the files adapter handles its folder.
import { createHash } from "node:crypto";
import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Actor,
  adoptStoreItems,
  createPlane,
  isNotDeletable,
  loadPreset,
  type MemoryItem,
  migrate,
  openSqlite,
} from "@engram/core";
import { afterAll, describe, expect, test } from "vitest";
import {
  createMcpMemoryAdapter,
  importedRecordId,
  MCP_MEMORY_LOCK_STALE_MS,
  observationKey,
  ReadOnlyRecordError,
  relationKey,
  UnsafeMemoryFileError,
} from "../../src/mcp-memory/index.ts";
import { addObservations, parseServerGraph, serverWrite } from "./server-format.ts";

const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../fixtures/stores/mcp-memory/memory.jsonl",
);
const AT = "2026-11-28T12:00:00Z";
const IMPORTED_AT = "2026-11-01T00:00:00Z";
const dana: Actor = { id: "person:dana", level: "person", memberships: ["person:dana"] };

const dirs: string[] = [];
afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

/** A fresh folder holding a copy of the fixture as `memory.jsonl` (or no file). */
async function workspace(copyFixture = true): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "engram-mcp-memory-"));
  dirs.push(dir);
  const file = join(dir, "memory.jsonl");
  if (copyFixture) await writeFile(file, await readFile(FIXTURE));
  return file;
}

const open = (file: string, more: { lockWaitMs?: number; now?: () => number } = {}) =>
  createMcpMemoryAdapter({
    file,
    owner: "dana",
    importValidFrom: IMPORTED_AT,
    lockWaitMs: more.lockWaitMs,
    lockSeams: more.now ? { now: more.now } : undefined,
  });

const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;
function item(n: number, over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: id(n),
    class: "semantic",
    scope: "person:dana",
    owner: "person:dana",
    content: `fact number ${n}`,
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
  } as MemoryItem;
}

function planeOver(file: string) {
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const deps = {
    db,
    adapter: open(file),
    policy: loadPreset("medium"),
    newId: () => id(900_000 + ++n),
  };
  return { deps, plane: createPlane(deps) };
}

const lines = (text: string) => text.split("\n").filter((l) => l !== "");
const hex32 = (parts: string[]) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);

describe("the server's own records list as read-only items under derived refs", () => {
  test("each observation and relation of the fixture is one item, with the documented defaults", async () => {
    const file = await workspace();
    const adapter = open(file);
    const items = await adapter.list("person:dana");
    expect(items.map((i) => i.content).sort()).toEqual(
      [
        "Dana: Leads the platform team",
        "Dana: Prefers written status updates",
        "Release freeze: Starts on the Friday before each release",
        "Dana announces Release freeze",
        "Dana works_on Platform",
      ].sort(),
    );
    const lead = items.find((i) => i.content === "Dana: Leads the platform team");
    const key = `observation/${hex32(["Dana", "Leads the platform team"])}`;
    expect(lead).toEqual({
      id: importedRecordId(file, key),
      class: "semantic",
      scope: "person:dana",
      owner: "person:dana",
      content: "Dana: Leads the platform team",
      provenance: {
        kind: "import",
        ref: "mcp-memory/entity/person/Dana",
        hash: `sha256:${createHash("sha256")
          .update(JSON.stringify(["Dana", "person", "Leads the platform team"]))
          .digest("hex")}`,
        actor: "agent:mcp-memory",
      },
      confidence: 0.5,
      valid_from: IMPORTED_AT,
      valid_to: null,
      ttl: null,
      grants: [],
      version: 1,
      lineage: [],
      status: "active",
      store_ref: { adapter: "mcp-memory", key },
      schema_version: 1,
    });
    expect(items.find((i) => i.content === "Dana works_on Platform")?.store_ref?.key).toBe(
      `relation/${hex32(["Dana", "works_on", "Platform"])}`,
    );
    expect(await adapter.list("team:platform")).toEqual([]);
  });

  test("the lines the server would not read are reported, and a record of another type is not", async () => {
    const adapter = open(await workspace());
    await adapter.list("person:dana");
    expect(adapter.diagnostics()).toEqual([
      { key: "line/6", reason: "line 6 is not JSON; kept unchanged" },
      { key: "line/7", reason: "line 7 is an entity the server would not read; kept unchanged" },
    ]);
  });

  test("a ref survives reordering, sibling observations added or deleted and a new entity type; an edit is a new ref", async () => {
    const file = await workspace();
    const before = await open(file).list("person:dana");
    const keyOf = (items: MemoryItem[], content: string) =>
      items.find((i) => i.content === content)?.store_ref?.key;
    const lead = keyOf(before, "Dana: Leads the platform team");
    await serverWrite(file, (g) => {
      g.entities.reverse();
      g.relations.reverse();
      const d = g.entities.find((e) => e.name === "Dana");
      if (!d) throw new Error("no Dana");
      d.observations = [
        "Joined in 2024",
        ...d.observations.filter((o) => o !== "Prefers written status updates"),
      ];
      d.entityType = "employee";
    });
    const after = await open(file).list("person:dana");
    expect(keyOf(after, "Dana: Leads the platform team")).toBe(lead);
    expect(after.find((i) => i.store_ref?.key === lead)?.provenance.ref).toBe(
      "mcp-memory/entity/employee/Dana",
    );
    expect(keyOf(after, "Dana: Prefers written status updates")).toBeUndefined();
    await serverWrite(file, (g) => {
      const d = g.entities.find((e) => e.name === "Dana");
      if (d)
        d.observations = d.observations.map((o) =>
          o === "Leads the platform team" ? "Leads the data team" : o,
        );
    });
    const edited = await open(file).list("person:dana");
    expect(keyOf(edited, "Dana: Leads the platform team")).toBeUndefined();
    expect(keyOf(edited, "Dana: Leads the data team")).toBe(
      observationKey("Dana", "Leads the data team"),
    );
    expect(keyOf(edited, "Dana: Leads the data team")).not.toBe(lead);
  });

  test("an observation repeated by hand lists once", async () => {
    const file = await workspace(false);
    await writeFile(
      file,
      `${JSON.stringify({ type: "entity", name: "A", entityType: "t", observations: ["x", "x"] })}\n`,
    );
    expect(await open(file).list("person:dana")).toHaveLength(1);
  });

  test("a record the server wrote is read-only: a write over its id and its delete are refused for good", async () => {
    const file = await workspace();
    const adapter = open(file);
    const [record] = await adapter.list("person:dana");
    if (!record?.store_ref) throw new Error("no record");
    const original = await readFile(file, "utf8");
    await expect(adapter.write({ ...record, content: "rewritten" } as MemoryItem)).rejects.toThrow(
      ReadOnlyRecordError,
    );
    const refused = await adapter.delete(record.store_ref).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(ReadOnlyRecordError);
    expect(isNotDeletable(refused)).toBe(true);
    expect(await readFile(file, "utf8")).toBe(original);
  });

  test("a write is refused when an entity the server wrote already has the item's name", async () => {
    const file = await workspace(false);
    await writeFile(
      file,
      `${JSON.stringify({ type: "entity", name: `engram:${id(5)}`, entityType: "t", observations: [] })}\n`,
    );
    await expect(open(file).write(item(5))).rejects.toThrow(ReadOnlyRecordError);
  });
});

describe("a governed write keeps what the adapter does not understand (card A6, step 3)", () => {
  test("through the plane: write, rewrite and delete leave every other line byte for byte", async () => {
    const file = await workspace();
    const original = await readFile(file, "utf8");
    const { plane } = planeOver(file);

    const first = await plane.write(
      dana,
      item(1, { content: "The freeze moved to Thursday." }),
      AT,
    );
    expect(first.event.decision).toBe("allow");
    const written = await readFile(file, "utf8");
    expect(lines(written).slice(0, -1)).toEqual(lines(original));
    const own = JSON.parse(lines(written).at(-1) ?? "");
    expect(own).toMatchObject({
      type: "entity",
      name: `engram:${id(1)}`,
      entityType: "engram",
      observations: [],
    });
    expect(own.engram.content).toBe("The freeze moved to Thursday.");

    const read = await plane.read(dana, { text: "freeze moved", at: AT });
    expect(read.items.map((i) => i.content)).toEqual(["The freeze moved to Thursday."]);

    const stored = first.item as MemoryItem;
    const adapter = open(file);
    await adapter.write({
      ...stored,
      version: 2,
      content: "The freeze moved to Wednesday.",
    } as MemoryItem);
    expect(lines(await readFile(file, "utf8")).slice(0, -1)).toEqual(lines(original));
    await adapter.delete(stored.store_ref as NonNullable<MemoryItem["store_ref"]>);
    expect(await readFile(file, "utf8")).toBe(original);
  });

  test("a client's members and observations on an Engram entity survive the item's rewrite, in place", async () => {
    const file = await workspace(false);
    const adapter = open(file);
    const ref = await adapter.write(item(2));
    await serverWrite(file, (g) => {
      addObservations(g, `engram:${id(2)}`, ["seen by another client"]);
      const e = g.entities.find((x) => x.name === `engram:${id(2)}`);
      if (e) e.extras = { createdAt: "2026-11-02T00:00:00Z", ...e.extras };
    });
    await adapter.write({ ...item(2), version: 2, content: "second version" } as MemoryItem);
    const record = JSON.parse(lines(await readFile(file, "utf8"))[0] ?? "");
    expect(Object.keys(record)).toEqual([
      "type",
      "name",
      "entityType",
      "observations",
      "createdAt",
      "engram",
    ]);
    expect(record.observations).toEqual(["seen by another client"]);
    expect(await adapter.read(ref)).toEqual({
      ...item(2),
      version: 2,
      content: "second version",
      store_ref: ref,
    });
    // The client's observation lists as a read-only record of its own.
    const listed = await adapter.list("person:dana");
    expect(listed.map((i) => i.content).sort()).toEqual(
      ["second version", `engram:${id(2)}: seen by another client`].sort(),
    );
  });
});

describe("the server may rewrite the file (the card's risk)", () => {
  test("a server rewrite keeps every Engram item whole, and leaves the adapter's line byte for byte", async () => {
    const file = await workspace();
    const adapter = open(file);
    const items = [
      item(3, { content: "line one\r\nline two, with a   separator and 😀" }),
      item(4, {
        class: "procedural",
        content: { body: "Run the checks.", tools: ["bash"] },
      } as Partial<MemoryItem>),
      item(6, { content: { nested: { n: 1.5, list: [true, null, "x"] } } }),
      item(7, { content: "a lone surrogate \ud800 stays" }),
    ];
    const refs = [];
    for (const i of items) refs.push(await adapter.write(i));
    const ours = lines(await readFile(file, "utf8")).filter((l) => l.includes('"engram"'));

    await serverWrite(file, (g) => {
      g.entities.push({
        name: "New",
        entityType: "thing",
        observations: ["made by a model"],
        extras: {},
      });
    });
    const rewritten = await readFile(file, "utf8");
    for (const line of ours) expect(lines(rewritten)).toContain(line);
    for (const [n, i] of items.entries())
      expect(await adapter.read(refs[n] as NonNullable<MemoryItem["store_ref"]>)).toEqual({
        ...i,
        store_ref: refs[n],
      });
    // The server keeps the unreadable lines too, after its own.
    expect(lines(rewritten).slice(-2)).toEqual(lines(await readFile(FIXTURE, "utf8")).slice(-2));
    // The server sees each Engram item as an entity with no observations: its tools show no content.
    const graph = parseServerGraph(rewritten);
    for (const i of items) {
      const e = graph.entities.find((x) => x.name === `engram:${i.id}`);
      expect(e?.observations).toEqual([]);
      expect(e?.entityType).toBe("engram");
    }
  });
});

describe("copies and renames are never read (as the files adapter's, RV-ADP-1)", () => {
  test("an Engram entity renamed, or repeated, is reported and lists once; the item's delete removes every copy", async () => {
    const file = await workspace(false);
    const adapter = open(file);
    const ref = await adapter.write(item(8));
    const own = lines(await readFile(file, "utf8"))[0] ?? "";
    const renamed = own.replace(`"engram:${id(8)}"`, '"engram:someone-else"');
    await writeFile(file, `${own}\n${own}\n${renamed}\n`);
    const listed = await adapter.list("person:dana");
    expect(listed.map((i) => i.id)).toEqual([id(8)]);
    expect(adapter.diagnostics().map((d) => d.key)).toEqual([`item/${id(8)}`, "line/2"]);
    await adapter.delete(ref);
    expect(await readFile(file, "utf8")).toBe(`${renamed}\n`);
  });

  test("an Engram entity whose item no longer parses is reported, not read, and the next write replaces it", async () => {
    const file = await workspace(false);
    const adapter = open(file);
    const ref = await adapter.write(item(9));
    const record = JSON.parse(lines(await readFile(file, "utf8"))[0] ?? "");
    record.engram.confidence = 7;
    record.observations = ["kept by the rewrite"];
    await writeFile(file, `${JSON.stringify(record)}\n`);
    expect(await adapter.read(ref)).toBeUndefined();
    expect(adapter.diagnostics()[0]?.key).toBe(`item/${id(9)}`);
    await adapter.write(item(9));
    expect(await adapter.read(ref)).toEqual({ ...item(9), store_ref: ref });
    const after = lines(await readFile(file, "utf8"));
    expect(after).toHaveLength(1);
    expect(JSON.parse(after[0] ?? "").observations).toEqual(["kept by the rewrite"]);
  });
});

const isUnavailable = (e: unknown) =>
  ["EPERM", "EACCES", "ENOSYS", "ENOTSUP"].includes((e as NodeJS.ErrnoException).code ?? "");

describe("the memory file must be a regular file with one name (as the files adapter's)", () => {
  test("a directory at the path is refused", async () => {
    const file = await workspace(false);
    await mkdir(file);
    const adapter = open(file);
    await expect(adapter.list("person:dana")).rejects.toThrow(UnsafeMemoryFileError);
    await expect(adapter.write(item(10))).rejects.toThrow(UnsafeMemoryFileError);
  });

  test("a hard link is never read or replaced", async () => {
    const file = await workspace();
    await link(file, `${file}.other`);
    const adapter = open(file);
    await expect(adapter.list("person:dana")).rejects.toThrow(/hard link/);
    await expect(adapter.write(item(11))).rejects.toThrow(UnsafeMemoryFileError);
  });

  test("a symlink is never followed", async ({ skip }) => {
    const file = await workspace(false);
    const target = await workspace();
    try {
      await symlink(target, file, "file");
    } catch (e) {
      if (isUnavailable(e)) return skip("symlinks are unavailable here");
      throw e;
    }
    const adapter = open(file);
    await expect(adapter.list("person:dana")).rejects.toThrow(/symlinks/);
    await expect(adapter.write(item(12))).rejects.toThrow(UnsafeMemoryFileError);
    expect(await readFile(target, "utf8")).toBe(await readFile(FIXTURE, "utf8"));
  });

  test("a memory file this process may not write is refused, not replaced", async () => {
    const file = await workspace();
    await chmod(file, 0o444);
    try {
      await expect(open(file).write(item(13))).rejects.toThrow(/read-only/);
      expect(await readFile(file, "utf8")).toBe(await readFile(FIXTURE, "utf8"));
    } finally {
      await chmod(file, 0o644);
    }
  });

  test.skipIf(process.platform === "win32")(
    "a write keeps the file's permission bits",
    async () => {
      const file = await workspace();
      await chmod(file, 0o600);
      await open(file).write(item(14));
      const { stat } = await import("node:fs/promises");
      expect((await stat(file)).mode & 0o777).toBe(0o600);
    },
  );

  test("a missing file is an empty graph, and the first write creates it", async () => {
    const file = await workspace(false);
    const adapter = open(file);
    expect(await adapter.list("person:dana")).toEqual([]);
    await adapter.write(item(15));
    expect(lines(await readFile(file, "utf8"))).toHaveLength(1);
  });
});

describe("the server's lock file is the adapter's (`<file>.lock`)", () => {
  /** The lock as the server writes it: its pid, host name and a token, no start time. */
  const serverLock = (pid: number) =>
    JSON.stringify({ pid, hostname: hostname(), token: "0".repeat(32) });

  test("a write waits for a live server holding the lock and refuses, naming it, after the wait", async () => {
    const file = await workspace();
    await writeFile(`${file}.lock`, serverLock(process.pid));
    const adapter = open(file, { lockWaitMs: 200 });
    await expect(adapter.write(item(16))).rejects.toThrow(/memory\.jsonl\.lock is held by/);
    expect(await readFile(file, "utf8")).toBe(await readFile(FIXTURE, "utf8"));
  });

  test("a server lock left unrefreshed past the server's own 30 s is broken, and the write goes through", async () => {
    const file = await workspace();
    await writeFile(`${file}.lock`, serverLock(process.pid));
    const old = new Date(Date.now() - MCP_MEMORY_LOCK_STALE_MS - 5_000);
    await utimes(`${file}.lock`, old, old);
    const adapter = open(file, { lockWaitMs: 2_000 });
    await adapter.write(item(17));
    expect(lines(await readFile(file, "utf8"))).toHaveLength(
      lines(await readFile(FIXTURE, "utf8")).length + 1,
    );
    await expect(readFile(`${file}.lock`)).rejects.toThrow();
  });

  test("the adapter's own write holds the lock and releases it", async () => {
    const file = await workspace(false);
    const seen: string[] = [];
    const adapter = createMcpMemoryAdapter({
      file,
      owner: "dana",
      lockSeams: {
        afterAcquire: async () => void seen.push(await readFile(`${file}.lock`, "utf8")),
      },
    });
    await adapter.write(item(18));
    expect(seen).toHaveLength(1);
    expect(JSON.parse(seen[0] ?? "")).toMatchObject({ pid: process.pid, host: hostname() });
    await expect(readFile(`${file}.lock`)).rejects.toThrow();
  });
});

describe("adoption through the plane", () => {
  test("the server's records are adopted into the owner's scope and read through the plane; the file is untouched", async () => {
    const file = await workspace();
    const original = await readFile(file, "utf8");
    const { deps, plane } = planeOver(file);
    const report = await adoptStoreItems(deps, dana, "person:dana", AT);
    expect(report).toMatchObject({ listed: 5, allowed: 5, denied: 0 });
    const read = await plane.read(dana, { text: "freeze", at: AT });
    expect(read.items.map((i) => i.content).sort()).toEqual(
      [
        "Dana announces Release freeze",
        "Release freeze: Starts on the Friday before each release",
      ].sort(),
    );
    expect(await readFile(file, "utf8")).toBe(original);
    expect(relationKey("Dana", "announces", "Release freeze")).toMatch(/^relation\/[0-9a-f]{32}$/);
  });
});
