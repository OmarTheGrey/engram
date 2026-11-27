// Card RD1 over the HTTP API: the read route, the by-id route, explain, the
// events route and the supersede route show a reader only the grants that
// name it (all of them to the owner) and only the lineage ids it may ask for
// by id (ADR 0047). Core decides (visible.ts); the routes return its answer.
import { appendEvent, type MemoryItem } from "@engram/core";
import { describe, expect, it } from "vitest";
import * as C from "../src/contract.ts";
import { dana, itemFor, testWorkspace } from "./helpers.ts";

const id = (n: number) => `01970000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const UNTIL = "2026-12-31T00:00:00.000Z";
const grant = (to: string) => ({
  to,
  class: "semantic" as const,
  mode: "read" as const,
  expires: UNTIL,
});
const owner = { ...dana, source: "user" as const };
const sam = { id: "person:sam", level: "person" as const, memberships: ["person:sam"] };
const eve = { id: "person:eve", level: "person" as const, memberships: ["person:eve"] };
const NOTE = id(1);
const ITEM = id(2);

/** Dana's note, and her item granted to sam then eve whose lineage names the note. */
async function seeded() {
  const env = testWorkspace();
  const note = itemFor(1, { id: NOTE, content: "Dana's sister is Mira." });
  const item = itemFor(2, {
    id: ITEM,
    content: "Dana prefers written standups.",
    grants: [grant(sam.id), grant(eve.id)],
    lineage: [NOTE],
  });
  for (const it of [note, item]) {
    const w = await env.client.POST("/api/v1/items", { body: { actor: owner, item: it } });
    expect(C.WriteResponse.parse(w.data).event.decision).toBe("allow");
  }
  return env;
}

type Shown = { id: string; grants: { to: string }[]; lineage: string[] };
const shown = (items: Shown[]) => items.find((i) => i.id === ITEM);

describe("the read routes disclose what the reader may see (RD1)", () => {
  it("POST /read: sam his grant and no ancestor id, eve hers, dana every grant and the note", async () => {
    const { client } = await seeded();
    const read = async (actor: typeof sam) => {
      const { data } = await client.POST("/api/v1/read", { body: { actor } });
      return { data, json: JSON.stringify(data) };
    };
    const s = await read(sam);
    expect(shown(s.data?.items as Shown[])?.grants.map((g) => g.to)).toEqual([sam.id]);
    expect(shown(s.data?.items as Shown[])?.lineage).toEqual([]);
    expect(s.json).not.toContain(NOTE);
    expect(s.json).not.toContain(eve.id);
    const e = await read(eve);
    expect(shown(e.data?.items as Shown[])?.grants.map((g) => g.to)).toEqual([eve.id]);
    expect(e.data?.explanations[0]?.grants_used).toEqual([`grants[0]:${eve.id}`]);
    expect(e.json).not.toContain(sam.id);
    const d = await read(dana);
    expect(shown(d.data?.items as Shown[])?.grants.map((g) => g.to)).toEqual([sam.id, eve.id]);
    expect(shown(d.data?.items as Shown[])?.lineage).toEqual([NOTE]);
  });

  it("POST /read/{itemId} and /explain/{readId} give sam the same narrowing", async () => {
    const { client } = await seeded();
    const { data } = await client.POST("/api/v1/read/{itemId}", {
      params: { path: { itemId: ITEM } },
      body: { actor: sam },
    });
    expect(shown(data?.items as Shown[])).toMatchObject({ lineage: [] });
    expect(shown(data?.items as Shown[])?.grants.map((g) => g.to)).toEqual([sam.id]);
    expect(JSON.stringify(data)).not.toContain(NOTE);
    const readId = data?.event.id;
    const explained = await client.POST("/api/v1/explain/{readId}", {
      params: { path: { readId: readId as string } },
      body: { actor: sam },
    });
    expect(explained.data?.explanations[0]?.grants_used).toEqual([`grants[0]:${sam.id}`]);
  });

  it("POST /events: a member who is not the owner sees no grant and no hidden ancestor", async () => {
    const { client, db } = await seeded();
    // A member of the team, and a team item of dana's granted to sam whose lineage names her note.
    const lee = {
      id: "person:lee",
      level: "person" as const,
      memberships: ["person:lee", "team:x"],
    };
    const team = {
      ...(itemFor(3, {
        id: id(3),
        scope: "team:x",
        grants: [grant(sam.id)],
        lineage: [NOTE],
      }) as unknown as MemoryItem),
    };
    appendEvent(db, {
      id: id(50),
      ts: "2026-10-28T00:00:00.000Z",
      op: "write",
      item_id: team.id,
      actor: dana.id,
      scope_from: null,
      scope_to: team.scope,
      decision: "allow",
      reason: "seeded",
      policy_id: "seed",
      item: team,
      schema_version: 1,
    });
    const { data } = await client.POST("/api/v1/events", { body: { actor: lee } });
    const write = data?.events.find((e) => e.item_id === team.id);
    expect(write?.item).toMatchObject({ grants: [], lineage: [] });
    expect(JSON.stringify(data)).not.toContain(sam.id);
    expect(JSON.stringify(data)).not.toContain(NOTE);
  });

  it("POST /events: a refused grant change under engram/write/grant names the proposed grantee only to its maker (review finding 1)", async () => {
    const { client } = testWorkspace();
    const owns = { ...owner, memberships: ["person:dana", "team:x"] };
    const lee = {
      id: "person:lee",
      level: "person" as const,
      memberships: ["person:lee", "team:x"],
    };
    const team = itemFor(4, { id: id(4), scope: "team:x" });
    const w = await client.POST("/api/v1/items", { body: { actor: owns, item: team } });
    expect(C.WriteResponse.parse(w.data).event.decision).toBe("allow");
    const zoe = "person:zoe";
    const asked = await client.POST("/api/v1/grants", {
      body: { actor: owns, item_id: id(4), add: [{ ...grant(zoe), class: "episodic" }] },
    });
    const refused = C.GrantResponse.parse(asked.data).event;
    expect(refused).toMatchObject({ decision: "deny", policy_id: "engram/write/grant" });
    expect(refused.reason).toContain(zoe);
    const seen = async (actor: typeof lee) =>
      (await client.POST("/api/v1/events", { body: { actor } })).data?.events ?? [];
    const leeSees = await seen(lee);
    expect(leeSees.find((e) => e.id === refused.id)?.reason).toContain(dana.id);
    expect(JSON.stringify(leeSees)).not.toContain(zoe);
    expect((await seen(owns)).find((e) => e.id === refused.id)?.reason).toBe(refused.reason);
  });

  it("POST /supersede: a member's accepted close shows no lineage id it may not read", async () => {
    const { client, db } = testWorkspace();
    const mate = {
      id: "person:mate",
      level: "person" as const,
      memberships: ["person:mate", "team:x"],
      source: "user" as const,
    };
    const base = {
      scope: "team:x",
      owner: "person:own",
      provenance: { kind: "user", ref: "r", hash: `sha256:${"0".repeat(64)}`, actor: "person:own" },
    } as const;
    const hidden = itemFor(7, { ...base, id: id(7), scope: "person:own", content: "own's note" });
    const old = itemFor(8, {
      ...base,
      id: id(8),
      content: "the visible fact",
      valid_from: "2026-05-05T05:05:05.000Z",
      lineage: [id(7)],
    });
    for (const [n, item] of [hidden, old].entries())
      appendEvent(db, {
        id: id(60 + n),
        ts: "2026-06-01T00:00:00.000Z",
        op: "write",
        item_id: item.id as string,
        actor: "person:own",
        scope_from: null,
        scope_to: item.scope as string,
        decision: "allow",
        reason: "seeded",
        policy_id: "seed",
        item: item as unknown as MemoryItem,
        schema_version: 1,
      });
    const mine = itemFor(9, {
      id: id(9),
      scope: "team:x",
      owner: mate.id,
      content: "the mate's fact",
      valid_from: "2026-09-09T09:09:09.000Z",
      lineage: [id(8)],
    });
    const w = await client.POST("/api/v1/items", { body: { actor: mate, item: mine } });
    expect(C.WriteResponse.parse(w.data).event.decision).toBe("allow");
    const { data } = await client.POST("/api/v1/supersede", {
      body: { actor: mate, item_id: id(9), accept: [id(8)] },
    });
    const answer = C.SupersedeResponse.parse(data);
    expect(answer.submitted.map((i) => [i.id, i.lineage])).toEqual([[id(8), []]]);
    expect(answer.applied[0]?.event.decision).toBe("allow");
    expect(JSON.stringify(answer)).not.toContain(id(7));
  });
});
