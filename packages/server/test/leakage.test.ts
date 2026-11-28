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
  byLabel,
  CANARIES,
  CONTROL,
  DANA,
  FRED,
  HR,
  LIVE,
  leaksIn,
  MISSING_ID,
  MISSING_READ,
  NOW,
  needles,
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
    const headers = [...response.headers].map(([k, v]) => `${k}: ${v}`).join("\n");
    const text = await response.text();
    // What a leak scan reads: the headers and the body.
    return { status: response.status, text, scanned: `${headers}\n${text}` };
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
  out = out.replace(/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/g, (u) => {
    if (!seen.has(u)) seen.set(u, `<id${seen.size}>`);
    return seen.get(u) as string;
  });
  return out.replace(/"seq":\d+/g, '"seq":<n>');
}

type Answer = { status: number; text: string };

/** An answer as a pinned characterisation names it: its status, decisions and rule ids, or its error code. */
function summary(a: Answer): string {
  const json = JSON.parse(a.text) as unknown;
  const found = (key: string) => {
    const out = new Set<string>();
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v !== null && typeof v === "object")
        for (const [k, x] of Object.entries(v)) {
          if (k === key && typeof x === "string") out.add(x);
          walk(x);
        }
    };
    walk(json);
    return [...out].sort().join(",");
  };
  const counts = /(\d+) projected items outside the reader's reach/.exec(a.text)?.[1];
  return [
    a.status,
    found("decision"),
    found("policy_id"),
    found("code"),
    counts ? `${counts} out of reach` : "",
  ]
    .filter((x) => x !== "")
    .join(" ");
}

/**
 * Pinned characterisations (card E8.16, step 5): where a denied id and a
 * never-held one do not answer alike, for each probe actor and hidden id,
 * with what each side answers. Each is a leak RD1 leaves, logged in
 * docs/log/2026-11-28-e8-16-finding-*.md and not fixed here; the suite fails
 * when one goes away or a new one appears.
 */
function EXPECTED_ORACLES(): Record<string, string> {
  const out: Record<string, string> = {};
  const allowed = "200 allow preset.medium/write/person";
  for (const probe of PROBE_ACTORS) {
    for (const route of ["write", "checkWrite"])
      for (const c of CANARIES) {
        // A never-held id (the denied write's) answers as the missing id does.
        if (probe.allowed.includes(c.label) || c.path === "write-denied") continue;
        // A write under a held id the writer cannot access is refused under
        // engram/write/membership. Under an erased id the reason is the same
        // (core masks it, plane/write.ts) but the rule id is
        // engram/write/erased, to anyone: it tells a non-member that the id
        // was an offboarded person's (finding 2026-11-28-e8-16-finding-erased-rule-id.md).
        const rule =
          c.path === "offboard-erased" ? "engram/write/erased" : "engram/write/membership";
        out[`${route} ${probe.name} ${c.label}`] = `200 deny ${rule}${VS}${allowed}`;
      }
    // Decision D5: another actor's read is refused as explain_denied (403), an unknown one as not_found (404).
    out[`explain ${probe.name} (another's read)`] = `403 explain_denied${VS}404 not_found`;
    // The read reason counts the projected items outside the reader's reach:
    // the eleven projected canaries (thirteen but the denied write and the
    // erased item) less those granted to the reader, expired or live.
    const counts: Record<string, [string, number]> = {
      "non-member": ["preset.medium/read/person", 11],
      "expired-grantee": ["preset.medium/read/person", 9],
      "former-member": ["preset.medium/read/person", 11],
      "partial-grantee": ["preset.medium/read/grants,preset.medium/read/person", 10],
    };
    const [rules, n] = counts[probe.name] as [string, number];
    out[`read ${probe.name} (reason counts)`] =
      `200 allow ${rules} ${n} out of reach${VS}200 allow preset.medium/read/person 0 out of reach`;
  }
  return out;
}

/** What separates the two sides of a difference. */
const VS = "\n  vs\n";

const ROUTE = (id: string) => ROUTES.find((r) => r.id === id) as Route;

const records: ProbeRecord[] = [];
const oracles: OracleRecord[] = [];
const controls: { surface: string; found: string[] }[] = [];

/**
 * Every probe of every route as `probe`, in three passes: the calls that name
 * no id, before the actor has named any, so a listing (events, export) must
 * show no canary id at all; then each call naming ids, which may echo its
 * own; then the listings again, which may echo the ids the actor's own events
 * named, never a nonce. Each answer's headers and body are scanned. Every
 * probed route must make at least one call and answer at least once with
 * something other than 400, so a malformed probe cannot pass by being refused.
 */
async function probeAll(probe: ProbeActor, surface: string) {
  const { seeded, call, errors } = await served();
  const leaks: string[] = [];
  const texts = new Map<string, string[]>();
  const all = ROUTES.flatMap((route) =>
    (PROBES[route.id]?.({ actor: probe.actor, danaReadId: seeded.danaReadId }) ?? []).map(
      (request) => ({ route, request }),
    ),
  );
  const naming = all.filter((p) => (p.request.asks ?? []).length > 0);
  const listing = all.filter((p) => (p.request.asks ?? []).length === 0);
  const asked = naming.flatMap((p) => p.request.asks ?? []);
  const passes = [
    { calls: listing, echo: (_: Request_) => [] as string[] },
    { calls: naming, echo: (r: Request_) => r.asks ?? [] },
    { calls: listing, echo: (_: Request_) => asked },
  ];
  const reached = new Set<string>();
  for (const { calls, echo } of passes)
    for (const { route, request } of calls) {
      const { status, text, scanned } = await call(route, request);
      expect([200, ...route.errors], `${route.id} answered ${status}: ${text}`).toContain(status);
      if (status !== 400) reached.add(route.id);
      texts.set(route.id, [...(texts.get(route.id) ?? []), text]);
      const leaked = leaksIn(scanned, probe, echo(request));
      records.push({ surface, probe: route.id, actor: probe.name, leaked });
      if (leaked.length > 0) leaks.push(`${route.id}: ${leaked.join(", ")}: ${text}`);
    }
  const probed = ROUTES.filter((r) => Object.hasOwn(PROBES, r.id)).map((r) => r.id);
  expect(
    probed.filter((id) => !texts.has(id)),
    "routes whose probe made no call",
  ).toEqual([]);
  expect(
    probed.filter((id) => !reached.has(id)),
    "routes that only answered 400",
  ).toEqual([]);
  return { leaks, errors, texts };
}

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
      const { leaks, errors } = await probeAll(probe, "http");
      expect(errors).toEqual([]);
      expect(leaks).toEqual([]);
    });

  it("an erased canary is gone for the members of its scope too: no route shows its content", async () => {
    const { seeded, call } = await served();
    // HR, who offboarded fred, and fred are members of person:fred: they may
    // see the erased item's id in its scope's events (ADR 0010), never its content.
    const members: ProbeActor[] = [
      { name: "erasing-member", actor: HR, allowed: [] },
      { name: "former-member", actor: FRED, allowed: [] },
    ];
    for (const member of members)
      for (const route of ROUTES.filter((r) =>
        ["read", "events", "export", "readById"].includes(r.id),
      ))
        for (const request of PROBES[route.id]?.({
          actor: member.actor,
          danaReadId: seeded.danaReadId,
        }) ?? []) {
          const { scanned } = await call(route, request);
          const leaked = leaksIn(scanned, member, request.asks).filter((l) => l === "fred-person");
          records.push({
            surface: "http",
            probe: `${route.id} (erased)`,
            actor: member.name,
            leaked,
          });
          expect(leaked, `${route.id} as ${member.actor.id}`).toEqual([]);
        }
  });

  it("the positive control: on every route that returns items or events, a member of team:x is shown the team's canaries", async () => {
    const { texts, leaks } = await probeAll(CONTROL, "http");
    expect(leaks).toEqual([]);
    const found = new Set<string>();
    for (const id of ["read", "readById", "events", "export"]) {
      const shown = noncesIn((texts.get(id) ?? []).join("\n"));
      expect(shown, id).toEqual(expect.arrayContaining(["lee-team"]));
      for (const l of shown) found.add(l);
    }
    expect(noncesIn((texts.get("read") ?? []).join("\n"))).toEqual(
      expect.arrayContaining(["dana-team", "fred-team", "lee-team"]),
    );
    controls.push({ surface: "http", found: [...found].sort() });
    const { call } = await served();
    const owner = await call(ROUTE("read"), { body: { actor: DANA, text: "canary" } });
    expect(noncesIn(owner.text)).toContain("dana-person");
  });

  it("the scanner finds a canary in every shape it names, and exempts the erased id only for its scope's members", () => {
    const c = byLabel("dana-person");
    const n = needles(c);
    const mallory = PROBE_ACTORS[0] as ProbeActor;
    for (const shape of [
      ...n.text,
      ...n.encoded,
      ...n.ids,
      c.nonce.toUpperCase(),
      c.id.toUpperCase(),
    ])
      expect(leaksIn(`x ${shape} x`, mallory), shape).toEqual(["dana-person"]);
    expect(leaksIn("nothing here", mallory)).toEqual([]);
    const erased = byLabel("fred-person");
    const fred = PROBE_ACTORS.find((p) => p.name === "former-member") as ProbeActor;
    expect(leaksIn(erased.id, fred)).toEqual([]);
    expect(leaksIn(erased.id, mallory)).toEqual(["fred-person"]);
    expect(leaksIn(erased.nonce, fred)).toEqual(["fred-person"]);
  });

  it("a denied id and a never-held id answer alike, for every probe actor and hidden id, but for the pinned characterisations", async () => {
    const { seeded } = await served();
    const differs: Record<string, string> = {};
    /** Each route that names an id, with the request under a given id as `actor`. */
    const pairs: [string, (actor: Ctx["actor"], id: string) => Request_][] = [
      ["readById", (actor, id) => ({ params: { itemId: id }, body: { actor } })],
      ["whoCanReadItem", (actor, id) => ({ body: { actor, item_id: id } })],
      ["promote", (actor, id) => ({ body: { actor, item_id: id, to: "team:x" } })],
      ["changeGrants", (actor, id) => ({ body: { actor, item_id: id, add: [grantTo(actor.id)] } })],
      ["supersede", (actor, id) => ({ body: { actor, item_id: id, accept: [] } })],
      [
        "write",
        (actor, id) => ({
          body: { actor, item: ownItem(actor, actor.memberships[0] as string, id) },
        }),
      ],
      [
        "checkWrite",
        (actor, id) => ({
          body: { actor, item: ownItem(actor, actor.memberships[0] as string, id) },
        }),
      ],
    ];
    const compare = (key: string, a: Answer, aIds: string[], b: Answer, bIds: string[]) => {
      // The whole answer, normalised: status, decision, reason and rule id alike.
      const left = `${a.status} ${normalised(a.text, aIds)}`;
      const right = `${b.status} ${normalised(b.text, bIds)}`;
      oracles.push({ surface: "http", probe: key, alike: left === right });
      if (left !== right) differs[key] = `${summary(a)}${VS}${summary(b)}`;
    };
    for (const probe of PROBE_ACTORS) {
      const hidden = CANARIES.filter((c) => !probe.allowed.includes(c.label));
      for (const [routeId, make] of pairs) {
        // The hidden ids in turn on one workspace, the never-held id on another.
        const { call } = await served();
        const missing = await (await served()).call(ROUTE(routeId), make(probe.actor, MISSING_ID));
        for (const c of hidden) {
          const denied = await call(ROUTE(routeId), make(probe.actor, c.id));
          compare(`${routeId} ${probe.name} ${c.label}`, denied, [c.id], missing, [MISSING_ID]);
        }
      }
      const explain = (id: string) => ({ params: { readId: id }, body: { actor: probe.actor } });
      compare(
        `explain ${probe.name} (another's read)`,
        await (await served()).call(ROUTE("explain"), explain(seeded.danaReadId)),
        [seeded.danaReadId],
        await (await served()).call(ROUTE("explain"), explain(MISSING_READ)),
        [MISSING_READ],
      );
      for (const scopeRoute of ["whoCanRead", "retain", "lint"]) {
        const make = (scope: string) => ({ body: { actor: probe.actor, scope } });
        const a = await (await served()).call(ROUTE(scopeRoute), make("team:x"));
        const b = await (await served()).call(ROUTE(scopeRoute), make("team:nobody"));
        compare(
          `${scopeRoute} ${probe.name} (scope)`,
          { ...a, text: a.text.replaceAll("team:x", "<scope>") },
          [],
          { ...b, text: b.text.replaceAll("team:nobody", "<scope>") },
          [],
        );
      }
      // A read with text, on the canary workspace and on an empty one.
      const read = { body: { actor: probe.actor, text: "canary" } };
      compare(
        `read ${probe.name} (reason counts)`,
        await (await served()).call(ROUTE("read"), read),
        [],
        await (await served(false)).call(ROUTE("read"), read),
        [],
      );
    }
    expect(differs).toEqual(EXPECTED_ORACLES());
  });

  it("writes its probe records when ENGRAM_LEAKAGE_OUT names a folder", () => {
    recordProbes({ suite: "server", probes: records, oracles, parity: [], controls });
    expect(records.length).toBeGreaterThan(0);
  });
});
