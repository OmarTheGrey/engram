// The import cap over a server with credentials (card E9.8, the lead's
// decision on the finding of 2026-11-22). A credential's source replaces the
// one a client sends (bindActor, ADR 0042), so an import key held with
// source `import` would record a model row as `import`. The write route
// applies core's cap (capImportSource): an `import`-sourced actor writes at
// the least trusted of the item's claimed kind and `import`, so a client can
// only lower trust. Over `listen` with an API key, through real HTTP.
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { openCredentials } from "../src/auth.ts";
import { createKey, type HeldActor } from "../src/keys.ts";
import { type Listening, listen } from "../src/listen.ts";
import { attestedWorkspace, tempDir } from "./auth-helpers.ts";
import { itemFor, NOW } from "./helpers.ts";

const IMPORTER: HeldActor = {
  id: "import:person:dana",
  level: "person",
  memberships: ["person:dana", "team:platform"],
  source: "import",
};

const servers: Listening[] = [];
afterAll(async () => {
  for (const s of servers) await s.close();
});

async function served() {
  const dir = await tempDir();
  const path = join(dir, "keys.json");
  const key = createKey(path, {
    actor: IMPORTER,
    expires: "2026-12-29T12:00:00.000Z",
    now: NOW,
  }).key;
  const credentials = openCredentials({ keys: path }, (p) => p);
  if (credentials === undefined) throw new Error("no credentials");
  const { workspace } = attestedWorkspace();
  const server = await listen(workspace, {
    port: 0,
    now: () => NOW,
    ui: null,
    auth: { credentials },
  });
  servers.push(server);
  const write = async (n: number, kind: string, scope: string) => {
    const base = itemFor(n);
    const item = {
      ...base,
      scope,
      provenance: {
        ...(base.provenance as object),
        kind,
        ...(kind === "model" ? { model: "faux/scripted" } : {}),
      },
    };
    const response = await fetch(`${server.url}/api/v1/items`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      // The client claims source user; the credential's source (import) replaces it.
      body: JSON.stringify({ actor: { ...IMPORTER, source: "user" }, item }),
    });
    expect(response.status).toBe(200);
    return (await response.json()) as {
      item: { provenance: { kind: string; actor: string }; status: string } | null;
      event: { decision: string; policy_id: string; reason: string; actor: string };
    };
  };
  return { write };
}

describe("an import key's write never raises trust", () => {
  it.each([
    ["model", "source model is not allowed in team scope"],
    ["external", "source external is not allowed in team scope"],
  ])("a %s row aimed at team scope is denied as in process", async (kind, reason) => {
    const { write } = await served();
    const r = await write(1, kind, "team:platform");
    expect(r.item).toBeNull();
    expect(r.event).toMatchObject({
      decision: "deny",
      policy_id: "preset.medium/write/team",
      actor: "import:person:dana",
    });
    expect(r.event.reason).toContain(reason);
  });

  it("a model row in person scope keeps kind model", async () => {
    const { write } = await served();
    const r = await write(2, "model", "person:dana");
    expect(r.event.decision).toBe("allow");
    expect(r.item?.provenance).toMatchObject({ kind: "model", actor: "import:person:dana" });
  });

  it("a user row is recorded import, never more", async () => {
    const { write } = await served();
    const r = await write(3, "user", "team:platform");
    expect(r.event.decision).toBe("allow");
    expect(r.item?.provenance.kind).toBe("import");
  });
});
