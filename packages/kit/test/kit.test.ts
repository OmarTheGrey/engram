// The kit on its own (card E8.14): the namespace mapper, and each call through
// the generated client bound in process to a workspace over the fake store,
// the medium preset and a fixed clock (no socket, no network).
import { createFakeAdapter } from "@engram/adapters";
import { loadPreset, migrate, openSqlite } from "@engram/core";
import { createEngramClient } from "@engram/sdk";
import { createApp, workspaceOf } from "@engram/server";
import { describe, expect, test } from "vitest";
import {
  createKit,
  EngramCallError,
  EngramRejected,
  InvalidNamespaceError,
  namespaceOf,
  scopeOf,
} from "../src/index.ts";

const NOW = "2026-11-01T12:00:00.000Z";
const dana = { id: "person:dana", level: "person" as const, memberships: ["person:dana"] };

function setup() {
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const ws = workspaceOf({
    db,
    adapter: createFakeAdapter(),
    policy: loadPreset("medium"),
    newId: () => `01980000-0000-7000-8000-${String(++n).padStart(12, "0")}`,
  });
  const app = createApp(ws, { port: 7313, now: () => NOW });
  const client = createEngramClient({
    baseUrl: "http://127.0.0.1:7313",
    fetch: async (r) => app.fetch(r),
  });
  let m = 0;
  const kit = createKit({
    client,
    actor: dana,
    now: () => NOW,
    newId: () => `01980000-0000-7000-8000-${String(500 + ++m).padStart(12, "0")}`,
  });
  return { ws, client, kit };
}

describe("scopeOf and namespaceOf", () => {
  test("map a framework's namespace to a scope and back", () => {
    expect(scopeOf(["person", "omar"])).toBe("person:omar");
    expect(scopeOf(["team", "platform"])).toBe("team:platform");
    expect(scopeOf(["role", "sre"])).toBe("role:sre");
    expect(scopeOf(["org"])).toBe("org");
    expect(scopeOf("team:platform")).toBe("team:platform");
    expect(scopeOf("org")).toBe("org");
    for (const scope of ["person:omar", "team:platform", "role:sre", "org"])
      expect(scopeOf(namespaceOf(scope))).toBe(scope);
  });

  test("refuse a namespace that names no scope rather than guess", () => {
    for (const bad of [
      [],
      ["person"],
      ["person", ""],
      ["person", "a:b"],
      ["person", "a b"],
      ["team", "platform", "notes"],
      ["org", "x"],
      ["group", "x"],
      "person:",
      "team",
      "person:a:b",
      "",
    ])
      expect(() => scopeOf(bad as string[]), JSON.stringify(bad)).toThrow(InvalidNamespaceError);
  });
});

describe("createKit", () => {
  test("its actor is a frozen copy with source model, whatever the given actor said", () => {
    const given = { ...dana, memberships: [...dana.memberships], source: "user" as const };
    const { client } = setup();
    const kit = createKit({ client, actor: given, now: () => NOW, newId: () => "x" });
    expect(kit.actor).toEqual({ ...dana, source: "model" });
    expect(Object.isFrozen(kit.actor)).toBe(true);
    expect(Object.isFrozen(kit.actor.memberships)).toBe(true);
    given.memberships.push("org");
    expect(kit.actor.memberships).toEqual(["person:dana"]);
  });

  test("remember stores an item as the actor with source model, and the plane recorded it", async () => {
    const { kit, ws } = setup();
    const item = await kit.remember({
      scope: "person:dana",
      content: "dana prefers short summaries",
      ref: "test:1",
    });
    expect(item).toMatchObject({ scope: "person:dana", owner: dana.id, status: "active" });
    expect(item.provenance).toMatchObject({ kind: "model", actor: dana.id, ref: "test:1" });
    expect(item.provenance.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    const event = ws.plane.events().at(-1);
    expect(event).toMatchObject({
      op: "write",
      decision: "allow",
      actor: dana.id,
      item_id: item.id,
    });
  });

  test("a denied write is EngramRejected carrying the deny event the log holds", async () => {
    const { kit, ws } = setup();
    const error = await kit
      .remember({ scope: "person:eve", content: "not mine", ref: "test:2" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EngramRejected);
    const rejected = error as EngramRejected;
    expect(rejected.event).toEqual(ws.plane.events().at(-1));
    expect(rejected.decision).toBe("deny");
    expect(rejected.policyId).toBe("engram/write/membership");
    expect(rejected.message).toBe(`engram: ${rejected.reason} (${rejected.policyId})`);
  });

  test("recall returns the memory tag of the governed read, with its event", async () => {
    const { kit } = setup();
    await kit.remember({ scope: "person:dana", content: "deploys <on> fridays", ref: "test:3" });
    const recall = await kit.recall("deploys");
    expect(recall.details.items.map((i) => i.content)).toEqual(["deploys <on> fridays"]);
    expect(recall.text).toContain(`<engram:memory read_id="${recall.event.id}"`);
    // Content is escaped, so it cannot open or close a tag.
    expect(recall.text).toContain("deploys &lt;on&gt; fridays");
    expect(recall.event).toMatchObject({ op: "read", actor: dana.id });
  });

  test("get reads one item by its id, and null for one the actor may not read", async () => {
    const { kit, client } = setup();
    const mine = await kit.remember({ scope: "person:dana", content: "mine", ref: "test:4" });
    expect((await kit.get(mine.id)).item?.id).toBe(mine.id);
    const eve = { id: "person:eve", level: "person" as const, memberships: ["person:eve"] };
    const eveKit = createKit({ client, actor: eve, now: () => NOW, newId: () => mine.id });
    const got = await eveKit.get(mine.id);
    expect(got.item).toBeNull();
    expect(got.event).toMatchObject({ op: "read", actor: eve.id, item_ids: [] });
  });

  test("scopes lists what the actor can see", async () => {
    const { kit } = setup();
    expect((await kit.scopes()).scopes).toEqual([{ scope: "person:dana", via: "membership" }]);
  });

  test("a call the plane refuses to decide is EngramCallError with its status", async () => {
    const { kit } = setup();
    const error = await kit.get("not-an-id").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EngramCallError);
    expect((error as EngramCallError).status).toBe(400);
    expect((error as EngramCallError).code).toBe("invalid_call");
  });
});
