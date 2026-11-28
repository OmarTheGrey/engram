// Card E8.16 over the HTTP API: every route of the route table is probed as
// each probe actor of the canary workspace (leakage-kit.ts), and no answer
// carries a canary its actor may not see; every answer is a status the route
// declares, never a 500; a denied id and a never-held id answer alike, except
// where a pinned characterisation below says otherwise; and a route with no
// probe and no listed exemption fails the suite.
//
// The structure is ported from ClickHouse/loom's
// tests/integration/test_cross_principal_leakage.py (commit 61b22646a1af,
// Apache-2.0; see leakage-kit.ts and docs/absorbed.md): probes derived from
// the registry of operations, a closed list of unprobed operations each with
// its reason, a positive control, and no 500.
import { createFakeAdapter } from "@engram/adapters";
import { loadPreset, migrate, openSqlite } from "@engram/core";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { API_PREFIX, ROUTES, type Route } from "../src/routes.ts";
import { workspaceOf } from "../src/workspace.ts";
import {
  CANARIES,
  CONTROL,
  DANA,
  LIVE,
  leaksIn,
  MISSING_ID,
  MISSING_READ,
  NOW,
  noncesIn,
  type OracleRecord,
  PROBE_ACTORS,
  type ProbeActor,
  type ProbeRecord,
  recordProbes,
  seedCanaries,
  seededId,
} from "./leakage-kit.ts";

const eventId = (n: number) => `01960000-0000-7000-8000-${String(n).padStart(12, "0")}`;

/** A canary workspace over the fake store, served by the app in process. */
async function served(seed = true) {
  const db = openSqlite(":memory:");
  migrate(db);
  const adapter = createFakeAdapter();
  const policy = loadPreset("medium");
  let n = 0;
  const newId = () => eventId(++n);
  const seeded = seed
    ? await seedCanaries({ db, adapter, policy, newId })
    : { danaReadId: "", events: 0 };
  const workspace = workspaceOf(
    { db, adapter, policy, newId },
    {
      store: { name: "fake", root: "(memory)", adapter, owner: "dana", scope: "person:dana" },
      viewer: null,
    },
  );
  const errors: unknown[] = [];
  const app = createApp(workspace, { port: 7313, now: () => NOW, onError: (e) => errors.push(e) });
  const call = async (route: Route, request: Request_) => {
    const path = route.path.replace(/\{(\w+)\}/g, (_, k: string) => request.params?.[k] ?? "");
    const response = await app.fetch(
      new Request(`http://127.0.0.1:7313${API_PREFIX}${path}`, {
        method: route.method.toUpperCase(),
        ...(route.method === "post"
          ? { body: JSON.stringify(request.body), headers: { "content-type": "application/json" } }
          : {}),
      }),
    );
    return { status: response.status, text: await response.text() };
  };
  return { seeded, call, errors };
}

/** One probe request: the body and path parameters, and the ids it names itself. */
interface Request_ {
  body?: unknown;
  params?: Record<string, string>;
  /** Ids the request names, which an answer may echo. */
  asks?: string[];
}

interface Ctx {
  actor: ProbeActor["actor"];
  danaReadId: string;
}

const grantTo = (to: string) => ({ to, class: "semantic", mode: "read", expires: LIVE });
/** An item of the probe actor's own, written into `scope` under `id`. */
const ownItem = (actor: Ctx["actor"], scope: string, id: string) => ({
  id,
  class: "semantic",
  scope,
  owner: actor.id,
  content: "a probe's own note",
  provenance: { kind: "user", ref: "probe", hash: `sha256:${"0".repeat(64)}`, actor: actor.id },
  confidence: 0.9,
  valid_from: "2026-10-01T00:00:00.000Z",
  valid_to: null,
  ttl: null,
  grants: [],
  version: 1,
  lineage: [],
  status: "active",
  store_ref: null,
  schema_version: 1,
});
const SCOPES = ["person:dana", "team:x", "person:fred"];
const ids = CANARIES.map((c) => c.id);
const byId = (make: (id: string) => Request_) => [...ids, MISSING_ID].map(make);

/**
 * The probes of each route, by operation id: data, so a new route needs one
 * line here or one in EXEMPT. Each names the canary ids it asks about.
 */
const PROBES: Record<string, (ctx: Ctx) => Request_[]> = {
  // Under fresh ids only: a write under a canary id the log never held (the
  // denied one) would land, and the probe would then read its own item.
  // checkWrite asks under every canary id, storing nothing.
  write: ({ actor }) =>
    [...SCOPES, actor.memberships[0] as string].map((scope) => ({
      body: { actor, item: ownItem(actor, scope, seededId(`probe:${actor.id}:${scope}`)) },
    })),
  checkWrite: ({ actor }) =>
    [...ids, MISSING_ID].map((id) => ({
      body: { actor, item: ownItem(actor, actor.memberships[0] as string, id) },
      asks: [id],
    })),
  read: ({ actor }) => [
    { body: { actor, text: "canary" } },
    { body: { actor } },
    ...CANARIES.map((c) => ({ body: { actor, text: c.nonce } })),
  ],
  readById: ({ actor }) => byId((id) => ({ params: { itemId: id }, body: { actor }, asks: [id] })),
  listScopes: ({ actor }) => [{ body: { actor } }],
  explain: ({ actor, danaReadId }) =>
    [danaReadId, MISSING_READ].map((readId) => ({
      params: { readId },
      body: { actor },
      asks: [readId],
    })),
  promote: ({ actor }) =>
    byId((id) => ({ body: { actor, item_id: id, to: "team:x", review: true }, asks: [id] })),
  changeGrants: ({ actor }) =>
    byId((id) => ({ body: { actor, item_id: id, add: [grantTo(actor.id)] }, asks: [id] })),
  whoCanReadItem: ({ actor }) => byId((id) => ({ body: { actor, item_id: id }, asks: [id] })),
  whoCanRead: ({ actor }) =>
    [...SCOPES, "team:nobody"].map((scope) => ({ body: { actor, scope } })),
  retain: ({ actor }) => [...SCOPES, "team:nobody"].map((scope) => ({ body: { actor, scope } })),
  events: ({ actor }) => [{ body: { actor } }, { body: { actor, after: 0 } }],
  export: ({ actor }) => [{ body: { actor } }],
  policy: () => [{}],
  lint: ({ actor }) => [...SCOPES, "team:nobody"].map((scope) => ({ body: { actor, scope } })),
  simulate: ({ actor }) => [
    {
      body: {
        workload: {
          id: "probe",
          actors: { a: actor },
          steps: [{ op: "read", as: "a", at: NOW, text: "canary" }],
        },
      },
    },
  ],
  supersede: ({ actor }) =>
    byId((id) => ({ body: { actor, item_id: id, accept: [] }, asks: [id] })),
  bypass: ({ actor }) => [
    { body: { actor, bypass: { command: "cat person:dana", store: "fake", route: "command" } } },
  ],
  viewer: () => [{}],
  health: () => [{}],
};

/**
 * The routes no probe calls, each with its reason and a check that the
 * reason still holds: an entry naming no route, a route also probed, or a
 * reason that no longer holds fails the suite (the stale-entry check).
 */
const EXEMPT: Record<string, { reason: string; holds: (status: number) => boolean }> = {
  distill: {
    reason:
      "Plane.distill is not implemented: the route answers 501 before it reads anything (docs/tasks/backlog.md); once it reads, it needs a probe",
    holds: (status) => status === 501,
  },
};

/** The routes with neither a probe nor an exemption, and the exemptions that are stale by name. */
export function coverage(
  routes: readonly Pick<Route, "id">[],
  probes: Readonly<Record<string, unknown>>,
  exempt: Readonly<Record<string, unknown>>,
) {
  const names = new Set(routes.map((r) => r.id));
  return {
    unprobed: [...names].filter((id) => !Object.hasOwn(probes, id) && !Object.hasOwn(exempt, id)),
    staleProbes: Object.keys(probes).filter((id) => !names.has(id)),
    staleExemptions: Object.keys(exempt).filter(
      (id) => !names.has(id) || Object.hasOwn(probes, id),
    ),
  };
}

/** The answer with the asked ids, every other id, seq and the read counts made position-blind. */
function normalised(text: string, asked: readonly string[]) {
  let out = asked.reduce((t, id) => t.replaceAll(id, "<asked>"), text);
  const seen = new Map<string, string>();
  out = out.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/g,
    (u) => seen.get(u) ?? (seen.set(u, `<id${seen.size}>`), `<id${seen.size - 1}>`),
  );
  return out.replace(/"seq":\d+/g, '"seq":<n>');
}

/**
 * Pinned characterisations (card E8.16, step 5): the routes where a denied
 * id and a never-held one do not answer alike, with what differs. Each is a
 * leak RD1 leaves, logged in docs/log/2026-11-28-e8-16-finding-*.md and not
 * fixed here; the suite fails when one goes away or a new one appears.
 */
const ORACLES: Record<string, [denied: string, missing: string]> = {
  // A write under the id of an item the writer cannot access is refused, and
  // says so; under a never-held id it lands. Ids are unique across scopes, so
  // the refusal cannot be the fresh id's answer; an id is a UUIDv7 the
  // writer must already hold to ask.
  write: ["the item id is held by an item you cannot access", "passes the person write rule"],
  checkWrite: ["the item id is held by an item you cannot access", "passes the person write rule"],
  // Decision D5: only a read's reader may explain it; another actor's read id
  // is refused as explain_denied (403), an unknown one as not_found (404).
  explain: ["403 ", "404 "],
  // The read event's reason, which the HTTP API and the CLI return to the
  // reader (MCP keeps it from the model), counts the projected items outside
  // the reader's reach: how many items the log holds that it may not see
  // (eleven: the thirteen canaries but the denied write and the erased item).
  "read (reason counts)": [
    "11 projected items outside the reader's reach were not candidates",
    "0 projected items outside the reader's reach were not candidates",
  ],
};

/** What separates the two sides of a difference. */
const VS = "\n  vs\n";

const ROUTE = (id: string) => ROUTES.find((r) => r.id === id) as Route;

const records: ProbeRecord[] = [];
const oracles: OracleRecord[] = [];
const controls: { surface: string; found: string[] }[] = [];

describe("E8.16: no route of the HTTP API leaks a canary", () => {
  it("every route has a probe or a listed exemption, and no entry is stale", () => {
    expect(coverage(ROUTES, PROBES, EXEMPT)).toEqual({
      unprobed: [],
      staleProbes: [],
      staleExemptions: [],
    });
  });

  it("a new route with no probe fails the coverage check, and a stale exemption is caught", () => {
    const added = [...ROUTES, { id: "newRoute" }];
    expect(coverage(added, PROBES, EXEMPT).unprobed).toEqual(["newRoute"]);
    expect(coverage(ROUTES, PROBES, { ...EXEMPT, gone: {} }).staleExemptions).toEqual(["gone"]);
    expect(coverage(ROUTES, PROBES, { ...EXEMPT, read: {} }).staleExemptions).toEqual(["read"]);
  });

  it("each exemption's reason still holds", async () => {
    const { call } = await served();
    for (const [id, { holds }] of Object.entries(EXEMPT)) {
      const route = ROUTE(id);
      const { status } = await call(route, {
        body: { sessions: [], method: { id: "awm", model: "scripted/none", seed: 1 } },
      });
      expect(holds(status), `${id} answered ${status}`).toBe(true);
    }
  });

  for (const probe of PROBE_ACTORS)
    it(`${probe.name} (${probe.actor.id}) is shown no canary it may not see, on any route`, async () => {
      const { seeded, call, errors } = await served();
      const leaks: string[] = [];
      // The ids this actor has named so far: its own events may echo them.
      const asked = new Set<string>();
      for (const route of ROUTES) {
        const make = PROBES[route.id];
        if (make === undefined) continue;
        for (const request of make({ actor: probe.actor, danaReadId: seeded.danaReadId })) {
          const { status, text } = await call(route, request);
          expect([200, ...route.errors], `${route.id} answered ${status}: ${text}`).toContain(
            status,
          );
          for (const id of request.asks ?? []) asked.add(id);
          const leaked = leaksIn(text, probe, [...asked]);
          records.push({ surface: "http", probe: route.id, actor: probe.name, leaked });
          if (leaked.length > 0) leaks.push(`${route.id}: ${leaked.join(", ")}: ${text}`);
        }
      }
      expect(errors).toEqual([]);
      expect(leaks).toEqual([]);
    });

  it("the positive control: a member of team:x is shown the team's canaries", async () => {
    const { call } = await served();
    const { text } = await call(ROUTE("read"), { body: { actor: CONTROL.actor, text: "canary" } });
    const found = noncesIn(text);
    controls.push({ surface: "http", found });
    expect(found).toEqual(expect.arrayContaining(["dana-team", "fred-team", "lee-team"]));
    expect(leaksIn(text, CONTROL)).toEqual([]);
    const owner = await call(ROUTE("read"), { body: { actor: DANA, text: "canary" } });
    expect(noncesIn(owner.text)).toContain("dana-person");
  });

  it("a denied id and a never-held id answer alike, but for the pinned characterisations", async () => {
    const { seeded, call } = await served();
    const differs: Record<string, string> = {};
    const actor = PROBE_ACTORS[0]?.actor as Ctx["actor"];
    const hidden = CANARIES[0]?.id as string;
    /** Each route that names an id, with the request under a given id. */
    const pairs: [string, string, string, (id: string) => Request_][] = [
      ["readById", hidden, MISSING_ID, (id) => ({ params: { itemId: id }, body: { actor } })],
      ["whoCanReadItem", hidden, MISSING_ID, (id) => ({ body: { actor, item_id: id } })],
      ["promote", hidden, MISSING_ID, (id) => ({ body: { actor, item_id: id, to: "team:x" } })],
      [
        "changeGrants",
        hidden,
        MISSING_ID,
        (id) => ({ body: { actor, item_id: id, add: [grantTo(actor.id)] } }),
      ],
      ["supersede", hidden, MISSING_ID, (id) => ({ body: { actor, item_id: id, accept: [] } })],
      [
        "write",
        hidden,
        MISSING_ID,
        (id) => ({ body: { actor, item: ownItem(actor, "person:mallory", id) } }),
      ],
      [
        "checkWrite",
        hidden,
        MISSING_ID,
        (id) => ({ body: { actor, item: ownItem(actor, "person:mallory", id) } }),
      ],
      [
        "explain",
        seeded.danaReadId,
        MISSING_READ,
        (id) => ({ params: { readId: id }, body: { actor } }),
      ],
    ];
    for (const [routeId, denied, missing, make] of pairs) {
      // Each on a fresh workspace, so the first call's event cannot change the second's answer.
      const a = await (await served()).call(ROUTE(routeId), make(denied));
      const b = await (await served()).call(ROUTE(routeId), make(missing));
      const left = `${a.status} ${normalised(a.text, [denied])}`;
      const right = `${b.status} ${normalised(b.text, [missing])}`;
      const alike = left === right;
      oracles.push({ surface: "http", probe: routeId, alike });
      if (!alike) differs[routeId] = `${left}\n  vs\n${right}`;
    }
    for (const [scopeRoute, make] of [
      ["whoCanRead", (scope: string) => ({ body: { actor, scope } })],
      ["retain", (scope: string) => ({ body: { actor, scope } })],
      ["lint", (scope: string) => ({ body: { actor, scope } })],
    ] as const) {
      const a = await (await served()).call(ROUTE(scopeRoute), make("team:x"));
      const b = await (await served()).call(ROUTE(scopeRoute), make("team:nobody"));
      const left = `${a.status} ${normalised(a.text.replaceAll("team:x", "<scope>"), [])}`;
      const right = `${b.status} ${normalised(b.text.replaceAll("team:nobody", "<scope>"), [])}`;
      const alike = left === right;
      oracles.push({ surface: "http", probe: `${scopeRoute} (scope)`, alike });
      if (!alike) differs[`${scopeRoute} (scope)`] = `${left}\n  vs\n${right}`;
    }
    // A read with text, on the canary workspace and on an empty one.
    {
      const read = (await served()).call(ROUTE("read"), { body: { actor, text: "canary" } });
      const empty = (await served(false)).call(ROUTE("read"), { body: { actor, text: "canary" } });
      const left = `${(await read).status} ${normalised((await read).text, [])}`;
      const right = `${(await empty).status} ${normalised((await empty).text, [])}`;
      oracles.push({ surface: "http", probe: "read (reason counts)", alike: left === right });
      if (left !== right) differs["read (reason counts)"] = `${left}${VS}${right}`;
    }
    expect(Object.keys(differs).sort()).toEqual(Object.keys(ORACLES).sort());
    for (const [probe, [denied, missing]] of Object.entries(ORACLES)) {
      const [left, right] = (differs[probe] ?? "").split(VS);
      expect(left, probe).toContain(denied);
      expect(right, probe).toContain(missing);
    }
  });

  it("writes its probe records when ENGRAM_LEAKAGE_OUT names a folder", () => {
    recordProbes({ suite: "server", probes: records, oracles, parity: [], controls });
    expect(records.length).toBeGreaterThan(0);
  });
});
