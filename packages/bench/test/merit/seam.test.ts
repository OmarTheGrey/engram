// The memory seam over HTTP, sent the request bodies merit-shim.py sends
// (WriteRequest and ReadRequest shapes): C5 through the plane, C2 without it.
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  MERIT_ACTOR,
  MERIT_READ_AT,
  type MemoryBackend,
  openMemoryBackend,
} from "../../src/merit/seam.ts";

const opened: MemoryBackend[] = [];
afterEach(async () => {
  for (const b of opened.splice(0)) await b.close();
});

const open = async (...args: Parameters<typeof openMemoryBackend>) => {
  const b = await openMemoryBackend(...args);
  opened.push(b);
  return b;
};

/** The item merit-shim.py writes for the n-th chunk. */
const shimItem = (n: number, content: string, scope = "person:merit-agent") => ({
  id: `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`,
  class: "episodic",
  scope,
  owner: MERIT_ACTOR.id,
  content,
  provenance: {
    kind: "model",
    ref: `merit:arc0-000-e${n}#0`,
    hash: `sha256:${createHash("sha256").update(content).digest("hex")}`,
    actor: MERIT_ACTOR.id,
  },
  confidence: 0.5,
  valid_from: `2026-01-01T00:00:${String(n).padStart(2, "0")}.000Z`,
  valid_to: null,
  ttl: null,
  grants: [],
  version: 1,
  lineage: [],
  status: "active",
  store_ref: null,
  schema_version: 1,
});

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const contents = (r: { body: Record<string, unknown> }) =>
  (r.body.items as { content: string }[]).map((i) => i.content);

describe("MERIT's memory seam", () => {
  it("C5 writes through Plane.write and reads through Plane.read, each with an event", async () => {
    const b = await open("plane", "fake", "medium");
    expect(b.base).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/api\/v1$/);
    // The item claims a user source; the plane records the actor's (finding B7-4).
    const claimed = shimItem(1, "[user] customer CUST-1001 moved to 1 Oak Ave");
    const w = await post(`${b.base}/items`, {
      actor: MERIT_ACTOR,
      item: { ...claimed, provenance: { ...claimed.provenance, kind: "user" } },
    });
    expect(w.status).toBe(200);
    expect((w.body.event as { decision: string }).decision).toBe("allow");
    const r = await post(`${b.base}/read`, { actor: MERIT_ACTOR, text: "CUST-1001 address" });
    expect(contents(r)).toEqual(["[user] customer CUST-1001 moved to 1 Oak Ave"]);
    const events = b.events();
    expect(events.map((e) => `${e.op}:${e.decision}`)).toEqual(["write:allow", "read:allow"]);
    expect(events.every((e) => e.reason !== "" && e.policy_id !== "")).toBe(true);
    expect(events.every((e) => e.ts === MERIT_READ_AT)).toBe(true);
    // The plane, not the caller, sets the provenance: the actor's source.
    expect(events[0]?.item?.provenance.kind).toBe("model");
    expect((w.body.item as { provenance: { kind: string } }).provenance.kind).toBe("model");
  });

  it("C5 denies a model-sourced write outside person scope at preset medium, and C2 stores it", async () => {
    const team = shimItem(1, "shared note", "team:support");
    const plane = await open("plane", "fake", "medium");
    const denied = await post(`${plane.base}/items`, { actor: MERIT_ACTOR, item: team });
    expect((denied.body.event as { decision: string }).decision).toBe("deny");
    expect(denied.body.item).toBeNull();
    expect(await plane.stored()).toBe(0);

    const ungoverned = await open("ungoverned", "fake", "medium");
    expect(ungoverned.base).toMatch(/\/ungoverned\/v1$/);
    await post(`${ungoverned.base}/items`, { actor: MERIT_ACTOR, item: team });
    expect(await ungoverned.stored()).toBe(1);
    expect(ungoverned.events()).toEqual([]);
  });

  it("C2 reads by core's retrieval pipeline over everything the store lists, newest first on a tie", async () => {
    const b = await open("ungoverned", "fake", "medium");
    await post(`${b.base}/items`, {
      actor: MERIT_ACTOR,
      item: shimItem(1, "order ORD-1 refund 300"),
    });
    await post(`${b.base}/items`, {
      actor: MERIT_ACTOR,
      item: shimItem(2, "order ORD-1 refund 400"),
    });
    await post(`${b.base}/items`, { actor: MERIT_ACTOR, item: shimItem(3, "unrelated text") });
    const r = await post(`${b.base}/read`, { actor: MERIT_ACTOR, text: "ORD-1 refund" });
    expect(contents(r)).toEqual(["order ORD-1 refund 400", "order ORD-1 refund 300"]);
  });

  it("C5 returns what C2 returns when the plane admits everything", async () => {
    const plane = await open("plane", "fake", "medium");
    const ungoverned = await open("ungoverned", "fake", "medium");
    for (const b of [plane, ungoverned]) {
      for (let n = 1; n <= 4; n++) {
        await post(`${b.base}/items`, {
          actor: MERIT_ACTOR,
          item: shimItem(n, `note ${n} on ORD-7`),
        });
      }
    }
    const q = { actor: MERIT_ACTOR, text: "ORD-7 note" };
    expect(contents(await post(`${plane.base}/read`, q))).toEqual(
      contents(await post(`${ungoverned.base}/read`, q)),
    );
  });
});
