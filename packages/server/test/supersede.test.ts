// Card L6, review fix L6-1: the supersede route discloses and rewrites
// nothing the read filter refuses. Ported from the reviewer's probe: on the
// medium preset, a member of team:x who does not own the scope's items asks
// about, and accepts the close of, a candidate held for review and an item
// past its ttl, next to an active item it may read.
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createFilesAdapter } from "@engram/adapters";
import {
  appendEvent,
  closedVersion,
  itemById,
  loadPreset,
  type MemoryItem,
  migrate,
  openSqlite,
  writeClosures,
} from "@engram/core";
import { createEngramClient } from "@engram/sdk";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import * as C from "../src/contract.ts";
import { workspaceOf } from "../src/workspace.ts";
import { dana, itemFor, NOW, testWorkspace } from "./helpers.ts";

const id = (n: number) => `01960000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const mate = {
  id: "person:mate",
  level: "person" as const,
  memberships: ["person:mate", "team:x"],
  source: "user" as const,
};
const HIDDEN_FROM = "2026-03-03T03:03:03.000Z";
const VISIBLE_FROM = "2026-05-05T05:05:05.000Z";

/** The three team items, seeded as an adoption would leave them, and the mate's replacement. */
async function seeded() {
  const env = testWorkspace();
  const base = itemFor(0, {
    scope: "team:x",
    owner: "person:own",
    provenance: { kind: "user", ref: "r", hash: `sha256:${"0".repeat(64)}`, actor: "person:own" },
    valid_from: HIDDEN_FROM,
  });
  const items = [
    { ...base, id: id(1), status: "candidate", content: "SECRET-CANDIDATE held for review" },
    { ...base, id: id(2), ttl: 60, content: "SECRET-EXPIRED past its ttl" },
    { ...base, id: id(3), valid_from: VISIBLE_FROM, content: "the visible fact" },
  ] as unknown as MemoryItem[];
  for (const [n, item] of items.entries())
    appendEvent(env.db, {
      id: id(50 + n),
      ts: "2026-04-01T00:00:00.000Z",
      op: "write",
      item_id: item.id,
      actor: item.owner,
      scope_from: null,
      scope_to: item.scope,
      decision: "allow",
      reason: "seeded",
      policy_id: "seed",
      item,
      schema_version: 1,
    });
  const mine = itemFor(0, {
    id: id(10),
    scope: "team:x",
    owner: mate.id,
    content: "the mate's fact",
    valid_from: "2026-09-09T09:09:09.000Z",
    lineage: [id(1), id(2), id(3)],
  });
  // And one replacement of each hidden item alone, as the reviewer's probe wrote.
  const alone = [1, 2].map((n) => ({ ...mine, id: id(10 + n), lineage: [id(n)] }));
  for (const item of [mine, ...alone]) {
    const w = await env.client.POST("/api/v1/items", { body: { actor: mate, item } });
    expect(C.WriteResponse.parse(w.data).event.decision).toBe("allow");
  }
  return env;
}

const unknownAnswer = (itemId: string) => ({
  item_id: itemId,
  head: { ok: false, error: "unknown_id", chain: [] },
  proposals: [],
  submitted: [],
  applied: [],
  stopped: null,
});

describe("the supersede route and the read filter (L6-1)", () => {
  it("names only the readable ancestor, with no hidden content or instant", async () => {
    const { client } = await seeded();
    const { data } = await client.POST("/api/v1/supersede", {
      body: { actor: mate, item_id: id(10) },
    });
    const plan = C.SupersedeResponse.parse(data);
    expect(plan.proposals.map((p) => [p.item_id, p.action])).toEqual([[id(3), "close"]]);
    const json = JSON.stringify(plan);
    for (const secret of ["SECRET", HIDDEN_FROM, id(1), id(2)]) expect(json).not.toContain(secret);
  });

  it("a hidden item asked about is answered as an unknown id", async () => {
    const { client } = await seeded();
    for (const hidden of [id(1), id(2)]) {
      const { data } = await client.POST("/api/v1/supersede", {
        body: { actor: mate, item_id: hidden },
      });
      expect(data).toEqual(unknownAnswer(hidden));
    }
  });

  it("accepting a hidden item's close is refused as an unknown id's, and nothing is rewritten", async () => {
    const { client, db, workspace } = await seeded();
    const before = workspace.plane.events().length;
    const message = async (start: string, accept: string) => {
      const { response, error } = await client.POST("/api/v1/supersede", {
        body: { actor: mate, item_id: start, accept: [accept] },
      });
      expect(response.status).toBe(400);
      const text = (error as { error: { message: string } }).error.message;
      return text.replaceAll(accept, "<id>").replaceAll(start, "<start>");
    };
    for (const n of [1, 2]) {
      const hidden = id(n);
      // From the replacement that names it alone, and from the one naming all three.
      for (const start of [id(10 + n), id(10)])
        expect(await message(start, hidden)).toBe(await message(start, id(999)));
      expect(itemById(db, hidden)).toMatchObject({ version: 1, valid_to: null });
    }
    expect(workspace.plane.events()).toHaveLength(before);
  });
});

describe("the supersede route and the store (L6-7)", () => {
  it("adopts the store's own memories before planning, as a read does", async () => {
    const { adapter, client } = testWorkspace({ store: true });
    // Placed in the store outside the plane: only adoption brings it into the log.
    await adapter.write(itemFor(1) as unknown as MemoryItem);
    const { data } = await client.POST("/api/v1/supersede", {
      body: { actor: { ...dana, source: "user" }, item_id: itemFor(1).id as string },
    });
    expect(C.SupersedeResponse.parse(data).head).toMatchObject({ ok: true });
  });
});

describe("writing accepted closes (L6-3, L6-9)", () => {
  const dirs: string[] = [];
  afterAll(async () => {
    for (const dir of dirs) await rm(dir, { recursive: true, force: true });
  });
  const MEMORY = resolve(
    fileURLToPath(import.meta.url),
    "../../../../fixtures/stores/claude-code-memory/project_release_freeze.md",
  );
  const END = "2026-10-15T00:00:00.000Z";

  it("writes a writable close, then stops at the read-only one and reports both", async () => {
    // A plan proposes at most one close (test/property/supersede-one-close.test.ts),
    // so two closes are given to the write loop directly.
    const root = await mkdtemp(join(tmpdir(), "engram-l6-"));
    dirs.push(root);
    await copyFile(MEMORY, join(root, "project_release_freeze.md"));
    const db = openSqlite(":memory:");
    migrate(db);
    let n = 0;
    const adapter = createFilesAdapter({
      root,
      owner: "dana",
      importValidFrom: "2026-10-01T00:00:00.000Z",
    });
    const workspace = workspaceOf(
      { db, adapter, policy: loadPreset("medium"), newId: () => id(400 + ++n) },
      { store: { name: "files", root, adapter, owner: "dana", scope: "person:dana" } },
    );
    const owner = { ...dana, source: "user" as const };
    // The memory file adopted as a read-only item; a writable item written through the plane.
    const app = createApp(workspace, { port: 7313, now: () => NOW });
    const client = createEngramClient({
      baseUrl: "http://127.0.0.1:7313",
      fetch: async (request) => app.fetch(request),
    });
    expect((await client.POST("/api/v1/read", { body: { actor: owner } })).response.status).toBe(
      200,
    );
    const writable = itemFor(1, {
      valid_from: "2026-10-02T00:00:00.000Z",
    }) as unknown as MemoryItem;
    const later = itemFor(3, { valid_from: "2026-10-03T00:00:00.000Z" }) as unknown as MemoryItem;
    for (const item of [writable, later])
      expect((await workspace.plane.write(owner, item, NOW)).event.decision).toBe("allow");
    const imported = workspace.plane
      .events()
      .find((e) => e.item?.provenance.kind === "import")?.item;
    if (!imported) throw new Error("the memory file was not adopted");
    const bytes = await readFile(join(root, "project_release_freeze.md"), "utf8");
    const close = (item: MemoryItem) =>
      closedVersion(item, {
        item_id: item.id,
        action: "close",
        relation: "finishedBy",
        valid_to: END,
        reason: "test",
      });
    const first = close(itemById(db, writable.id) as MemoryItem);
    const second = close(imported);
    const third = close(itemById(db, later.id) as MemoryItem);
    const on = { plane: workspace.plane, db, policy: workspace.policy };
    const out = await writeClosures(on, owner, [first, second, third], NOW);
    // The third is never sent: the loop stops at the store's refusal.
    expect(out.submitted.map((i) => i.id)).toEqual([writable.id, imported.id]);
    expect(itemById(db, later.id)).toMatchObject({ version: 1, valid_to: null });
    expect(out.applied.map((a) => [a.event.item_id, a.event.decision])).toEqual([
      [writable.id, "allow"],
    ]);
    expect(out.stopped).toMatchObject({
      item_id: imported.id,
      event: { op: "write", decision: "deny", policy_id: "engram/write/store-failure" },
    });
    expect(itemById(db, writable.id)).toMatchObject({ version: 2, valid_to: END });
    expect(await readFile(join(root, "project_release_freeze.md"), "utf8")).toBe(bytes);
  });
});
