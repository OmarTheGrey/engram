// The invariant of card E8.12 (ADR 0042 decision 8): every event written
// through a served HTTP surface names an actor that was authenticated, or
// the flag that waived it. Concretely, after any run of requests against a
// real socket over a workspace `openWorkspace` opened (the CLI's path, a
// SQLite file and the files store):
//   - every event in the log has exactly one row in event_attestations, with
//     its seq and id;
//   - the row's method is `jwt` or `api_key` on a server with credentials,
//     `insecure_loopback` under the waiver;
//   - the event's actor is the row's actor (the requester), or the store's
//     owner for the adoption a read runs first (source import, ADR 0025 D8);
//   - a refused request (no credential, a forged one, another actor's id)
//     appends nothing.
// The requests are drawn from a seed (the test name's), sent four at a time
// so their events interleave in the log; a failure prints the seed.
import { createHash } from "node:crypto";
import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { allEvents, type MemoryEvent, openSqlite } from "@engram/core";
import { afterAll, describe, expect, it } from "vitest";
import { attestations } from "../src/attest.ts";
import { type Listening, listen, type ServeAuth } from "../src/listen.ts";
import { type LocalWorkspace, openWorkspace } from "../src/workspace.ts";
import { credentials, DANA, EVE, tempDir } from "./auth-helpers.ts";
import { id, itemFor, NOW } from "./helpers.ts";

const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/stores/claude-code-memory",
);

const opened: { server: Listening; workspace: LocalWorkspace }[] = [];
afterAll(async () => {
  for (const o of opened) {
    await o.server.close();
    o.workspace.close();
  }
});

/** A served workspace over a SQLite file and a copy of the memory fixture, owned by dana. */
async function served(auth: (dir: string) => Promise<ServeAuth>) {
  const dir = await tempDir();
  const root = await mkdtemp(join(tmpdir(), "engram-attest-root-"));
  await cp(FIXTURE, root, { recursive: true });
  let n = 0;
  const workspace = openWorkspace({
    root,
    owner: "dana",
    db: join(dir, "engram.db"),
    importValidFrom: "2026-10-01T00:00:00.000Z",
    cwd: dir,
    home: dir,
    env: {},
    newId: () => id(700_000 + ++n),
  });
  const log = workspace.open();
  const server = await listen(workspace, {
    port: 0,
    now: () => NOW,
    ui: null,
    auth: await auth(dir),
  });
  opened.push({ server, workspace });
  return { server, log, dir };
}

/** A seeded generator (mulberry32) from the test's name. */
function rng(name: string) {
  let a = createHash("sha256").update(name).digest().readUInt32LE(0);
  const seed = a;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return { seed, pick: <T>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)] as T };
}

const post = (url: string, path: string, body: unknown, token?: string) =>
  fetch(`${url}/api/v1${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });

const actorOf = (a: { id: string; level: string }, memberships: string[]) => ({
  id: a.id,
  level: a.level,
  memberships,
});

/** Checks the invariant over the whole log; returns the events. */
function checkInvariant(path: string, methods: string[], owner: string): MemoryEvent[] {
  const db = openSqlite(path);
  try {
    const events = allEvents(db);
    const rows = new Map(attestations(db).map((r) => [r.seq, r]));
    expect(rows.size).toBe(events.length);
    for (const e of events) {
      const row = rows.get(e.seq);
      expect(row, `event ${e.seq} (${e.op} by ${e.actor}) has no attestation`).toBeDefined();
      if (row === undefined) continue;
      expect(row.event_id).toBe(e.id);
      expect(methods).toContain(row.method);
      const adoption = e.actor === owner && e.item?.provenance.kind === "import";
      expect(e.actor === row.actor || adoption, `event ${e.seq}: ${e.actor} vs ${row.actor}`).toBe(
        true,
      );
    }
    return events;
  } finally {
    db.close();
  }
}

describe("every event a served HTTP surface writes names an authenticated actor or the waiver", () => {
  it("with credentials: a seeded mix of keys, tokens and refusals, four at a time", async () => {
    const { seed, pick } = rng("with credentials: a seeded mix of keys, tokens and refusals");
    let creds: Awaited<ReturnType<typeof credentials>> | undefined;
    const { server, log } = await served(async (dir) => {
      creds = await credentials(dir);
      return { credentials: creds.creds };
    });
    if (creds === undefined) throw new Error("no credentials");
    const { keys, iss } = creds;
    const resource = server.resource ?? "";
    const danaToken = await iss.token("sub-dana", resource);
    const eveToken = await iss.token("sub-eve", resource);
    const callers = [
      { token: keys.dana, actor: actorOf(DANA, ["person:dana"]), scope: "person:dana" },
      {
        token: danaToken,
        actor: actorOf(DANA, ["person:dana", "team:platform"]),
        scope: "person:dana",
      },
      { token: eveToken, actor: actorOf(EVE, ["person:eve"]), scope: "person:eve" },
      {
        token: keys.agent,
        actor: { id: "agent:ci", level: "team", memberships: ["team:platform"] },
        scope: "team:platform",
      },
    ] as const;
    let n = 0;
    const refusals: Promise<Response>[] = [];
    const request = () => {
      const c = pick(callers);
      const kind = pick([
        "write",
        "write",
        "read",
        "events",
        "retain",
        "lint",
        "bypass",
        "refused",
      ]);
      n++;
      switch (kind) {
        case "write":
          return post(
            server.url,
            "/items",
            {
              actor: c.actor,
              item: itemFor(n, {
                scope: c.scope,
                owner: c.actor.id,
                content: `fact ${n} of ${c.actor.id}`,
              }),
            },
            c.token,
          );
        case "read":
          return post(server.url, "/read", { actor: c.actor, text: "" }, c.token);
        case "events":
          return post(server.url, "/events", { actor: c.actor }, c.token);
        case "retain":
          return post(server.url, "/retain", { actor: c.actor, scope: c.scope }, c.token);
        case "lint":
          return post(server.url, "/lint", { actor: c.actor, scope: c.scope }, c.token);
        case "bypass":
          return post(
            server.url,
            "/bypass",
            {
              actor: c.actor,
              bypass: { command: "cat ~/.claude/memory", store: "files" },
            },
            c.token,
          );
        default: {
          // One of three refusals, none of which may append an event.
          const which = pick(["none", "forged", "other"]);
          const r =
            which === "none"
              ? post(server.url, "/items", { actor: c.actor, item: itemFor(n) })
              : which === "forged"
                ? post(
                    server.url,
                    "/items",
                    { actor: c.actor, item: itemFor(n) },
                    `${keys.dana.slice(0, -2)}zz`,
                  )
                : post(
                    server.url,
                    "/items",
                    { actor: actorOf(EVE, ["person:eve"]), item: itemFor(n) },
                    keys.dana,
                  );
          refusals.push(r);
          return r;
        }
      }
    };
    for (let batch = 0; batch < 12; batch++)
      await Promise.all(Array.from({ length: 4 }, () => request()));
    for (const r of await Promise.all(refusals))
      expect([401, 403], `seed ${seed}`).toContain(r.status);
    const events = checkInvariant(log.target.label, ["jwt", "api_key"], "person:dana");
    expect(events.length, `seed ${seed}`).toBeGreaterThan(10);
  });

  it("under --insecure-loopback every event is attested as waived", async () => {
    const { server, log } = await served(async () => ({ insecureLoopback: true }));
    const dana = { ...actorOf(DANA, ["person:dana"]), source: "user" };
    for (let n = 0; n < 3; n++)
      expect((await post(server.url, "/items", { actor: dana, item: itemFor(n) })).status).toBe(
        200,
      );
    expect(
      (await post(server.url, "/read", { actor: actorOf(EVE, ["person:eve"]), text: "" })).status,
    ).toBe(200);
    const events = checkInvariant(log.target.label, ["insecure_loopback"], "person:dana");
    expect(events.length).toBeGreaterThan(4);
  });
});
