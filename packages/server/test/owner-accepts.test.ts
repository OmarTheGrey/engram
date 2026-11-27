// Card E9.9 (ADR 0049, amending ADR 0026) through the promote route: the
// owner accepts an imported candidate in her own person scope; her agent
// cannot, whatever source it sends once a key names it (ADR 0042); a team
// candidate keeps the reviewer who is not its owner. The route passes
// `review` to Plane.promote and decides nothing itself (AGENTS.md rule 1).
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type AppAuth, createApp } from "../src/app.ts";
import { openCredentials } from "../src/auth.ts";
import * as C from "../src/contract.ts";
import { createKey } from "../src/keys.ts";
import { attestedWorkspace, tempDir } from "./auth-helpers.ts";
import { BASE, id, itemFor, NOW, PORT, testWorkspace } from "./helpers.ts";

const MEMBERS = ["person:dana", "team:x"];
const dana = { id: "person:dana", level: "person" as const, memberships: MEMBERS };
/** The import actor a served import writes as (card E9.8): the row becomes dana's candidate. */
const importer = { id: "import:person:dana", level: "person" as const, memberships: MEMBERS };

describe("POST /api/v1/promote: an owner's acceptance (card E9.9)", () => {
  async function withCandidate(scope = "person:dana") {
    const t = testWorkspace();
    const w = await t.client.POST("/api/v1/items", {
      body: { actor: { ...importer, source: "import" }, item: itemFor(1, { scope }) },
    });
    const written = C.WriteResponse.parse(w.data);
    expect(written.item).toMatchObject({ status: "candidate", owner: "person:dana" });
    return t;
  }
  const promote = (
    t: ReturnType<typeof testWorkspace>,
    source: "user" | "model",
    to = "person:dana",
  ) =>
    t.client.POST("/api/v1/promote", {
      body: { actor: { ...dana, source }, item_id: id(501), to, review: true },
    });

  it("the owner, as user, accepts it: 200 with one promote event under its own rule", async () => {
    const t = await withCandidate();
    const { data, response } = await promote(t, "user");
    expect(response.status).toBe(200);
    const body = C.GateResponse.parse(data);
    expect(body.decision).toBe("allow");
    expect(body.events).toHaveLength(1);
    expect(body.event).toMatchObject({
      op: "promote",
      actor: "person:dana",
      policy_id: "engram/promote/owner-person",
      ts: NOW,
    });
    expect(body.event.reason).toContain("owner accepts in own person scope");
    expect(body.item).toMatchObject({ status: "active", provenance: { kind: "import" } });
  });

  it("her agent, model-sourced, is refused and the item stays a candidate", async () => {
    const t = await withCandidate();
    const body = C.GateResponse.parse((await promote(t, "model")).data);
    expect(body).toMatchObject({ decision: "deny", item: null });
    expect(body.event.policy_id).toBe("engram/promote/reviewer");
    expect(body.event.reason).toContain("only the owner acting as user may accept");
    const read = await t.client.POST("/api/v1/read", { body: { actor: dana } });
    expect(C.ReadResponse.parse(read.data).items).toEqual([]);
  });

  it("in a team scope the owner is refused, as before", async () => {
    const t = await withCandidate("team:x");
    const body = C.GateResponse.parse((await promote(t, "user", "team:x")).data);
    expect(body.decision).toBe("deny");
    expect(body.event.policy_id).toBe("engram/promote/reviewer");
    expect(body.event.reason).toContain("cannot approve its own item");
  });
});

describe("POST /api/v1/promote with verified actors (ADR 0042)", () => {
  it("a key held for dana's agent cannot accept by sending source user", async () => {
    const dir = await tempDir();
    const path = join(dir, "keys.json");
    const expires = "2026-12-29T12:00:00.000Z";
    const held = { ...dana, memberships: ["person:dana"] };
    const userKey = createKey(path, { actor: { ...held, source: "user" }, expires, now: NOW }).key;
    const agentKey = createKey(path, {
      actor: { ...held, source: "model" },
      expires,
      now: NOW,
    }).key;
    const creds = openCredentials({ keys: path }, (p) => p);
    if (creds === undefined) throw new Error("no credentials");
    const { workspace } = attestedWorkspace();
    const auth: AppAuth = { mode: "credentials", credentials: creds, resource: BASE };
    const app = createApp(workspace, { port: PORT, now: () => NOW, auth });
    const call = (path: string, key: string, body: unknown) =>
      app.fetch(
        new Request(`${BASE}/api/v1${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify(body),
        }),
      );
    // dana writes a candidate into her own scope (the status is hers to set).
    const item = itemFor(1, { status: "candidate" });
    const w = C.WriteResponse.parse(
      await (await call("/items", userKey, { actor: { ...held, source: "user" }, item })).json(),
    );
    expect(w.item?.status).toBe("candidate");
    const ask = (key: string) =>
      call("/promote", key, {
        actor: { ...held, source: "user" },
        item_id: id(501),
        to: "person:dana",
        review: true,
      });
    const refused = C.GateResponse.parse(await (await ask(agentKey)).json());
    expect(refused.decision).toBe("deny");
    expect(refused.event.policy_id).toBe("engram/promote/reviewer");
    expect(refused.event.reason).toContain("acts with source model");
    const accepted = C.GateResponse.parse(await (await ask(userKey)).json());
    expect(accepted.decision).toBe("allow");
    expect(accepted.event.policy_id).toBe("engram/promote/owner-person");
  });
});
