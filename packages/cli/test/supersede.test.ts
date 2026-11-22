// `engram supersede <item-id> [--accept <id>]...` (card L6): one call to
// the supersede route. Without --accept it prints the plan: the head of the
// item's chain and, for each ancestor the actor may read, a proposed close or
// a review flag, and writes nothing. Each --accept is one ordinary write of a
// new version through the write gate, which decides it and logs it. Exit 0
// when the chain resolves and every accepted close was allowed, 1 otherwise
// (an id the plan proposes no close for is the server's 400, refused before
// anything is written), 2 on bad usage.
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import type { MemoryEvent, MemoryItem } from "@engram/core";
import { describe, expect, it } from "vitest";
import { type SupersedeAnswer, supersedeLines } from "../src/format.ts";
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

/** A loopback port free a moment ago. */
const freePort = () =>
  new Promise<number>((done, fail) => {
    const probe = createServer();
    probe.once("error", fail);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => done(typeof address === "object" && address ? address.port : 0));
    });
  });

/** One JSON-RPC message of a streamable HTTP reply, JSON or a server-sent event. */
async function rpc(url: string, key: string, body: object, session?: string) {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(session ? { "mcp-session-id": session } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  const data = text.includes("data:")
    ? (text.split("\n").find((l) => l.startsWith("data:")) ?? "").slice(5)
    : text;
  return {
    session: r.headers.get("mcp-session-id") ?? undefined,
    message: JSON.parse(data || "{}"),
  };
}

describe("engram mcp --http with credentials and --supersede (L6-8)", () => {
  it("every authenticated session lists memory_supersede", async () => {
    const keys = join(await tempDir(), "keys.json");
    const made = await cli([
      ...["key", "create", "--keys", keys, "--as", "person:dana", "--member", "person:dana"],
      ...["--source", "user", "--expires", "2026-12-25T12:00:00.000Z"],
    ]);
    expect(made.code).toBe(0);
    const key = made.out.split("\n")[0] ?? "";
    const port = await freePort();
    const stop = new AbortController();
    const running = cli(
      ["mcp", "--http", String(port), "--keys", keys, "--db", ":memory:", "--supersede"],
      { stop: stop.signal },
    );
    try {
      const url = `http://127.0.0.1:${port}/mcp`;
      let init: Awaited<ReturnType<typeof rpc>> | undefined;
      for (let i = 0; i < 100 && init === undefined; i++)
        init = await rpc(url, key, {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "t", version: "0" },
          },
        }).catch(async () => {
          await new Promise((wait) => setTimeout(wait, 50));
          return undefined;
        });
      expect(init?.session).toBeDefined();
      await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-session-id": init?.session ?? "",
        },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      });
      const listed = await rpc(
        url,
        key,
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
        init?.session,
      );
      const names = (listed.message.result?.tools ?? []).map((t: { name: string }) => t.name);
      expect(names.at(-1)).toBe("memory_supersede");
    } finally {
      stop.abort();
      await running;
    }
  });
});

describe("engram supersede's lines when the store refuses a close (L6-9)", () => {
  it("lists the close that landed before the refused one, and the one not sent", () => {
    // A plan proposes at most one close (core test/property/supersede-one-close.test.ts),
    // so the answer of the route's write loop with three closes is given here as data.
    const A = "01990000-0000-7000-8000-000000000001";
    const B = "01990000-0000-7000-8000-000000000002";
    const C = "01990000-0000-7000-8000-000000000003";
    const event = (n: number, item_id: string, decision: "allow" | "deny", policy_id: string) =>
      ({
        id: `01990000-0000-7000-8000-00000000010${n}`,
        ts: "2026-10-25T12:00:00.000Z",
        op: "write",
        item_id,
        actor: "person:dana",
        decision,
        reason: decision === "allow" ? "allowed" : "the store failed: read-only",
        policy_id,
      }) as unknown as MemoryEvent;
    const landed = {
      id: A,
      class: "semantic",
      scope: "person:dana",
      status: "active",
      store_ref: null,
    };
    const answer: SupersedeAnswer = {
      item_id: NEW,
      head: { ok: true, head_id: NEW, chain: [NEW] },
      proposals: [],
      applied: [
        {
          item: landed as unknown as MemoryItem,
          event: event(1, A, "allow", "preset.medium/write/person"),
        },
      ],
      stopped: { item_id: B, event: event(2, B, "deny", "engram/write/store-failure") },
    };
    const text = supersedeLines(answer, [A, B, C]).join("\n");
    expect(text).toContain(`item ${A} semantic in person:dana, status active`);
    expect(text).toContain(`not applied: ${B}, the store refused it`);
    expect(text).toContain("policy engram/write/store-failure");
    expect(text).toContain(`landed before it: ${A}; not sent: ${C}`);
  });
});
