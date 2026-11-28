// Card E2.18: the checks tools/symcc/properties.ts writes for Cedar's
// symbolic compiler, and the decoding and replay of its counterexamples
// through Engram's evaluator. The solver itself runs only under
// `make verify-policy` (cargo and cvc5); here a counterexample is built the
// way the solver returns one, from a Cedar request with every entity renamed,
// so these tests need neither.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { Actor } from "../../packages/core/src/actor.ts";
import { contentHash } from "../../packages/core/src/content-hash.ts";
import {
  type CedarRequest,
  cedarReadRequest,
  cedarWriteRequest,
  exportCedar,
} from "../../packages/core/src/policy/cedar.ts";
import { loadPreset } from "../../packages/core/src/policy/load.ts";
import type { MemoryItem } from "../../packages/core/src/schema.ts";
import { parseProperties } from "../../tools/symcc/cli.ts";
import {
  type Answer,
  buildJob,
  type Counterexample,
  decode,
  domain,
  INVARIANTS,
  type Job,
  replay,
} from "../../tools/symcc/properties.ts";

const CONFIG = "research/configs/h2-cedar-properties.json";
const config = JSON.parse(readFileSync(new URL(`../../${CONFIG}`, import.meta.url), "utf8"));

const item = (over: Partial<MemoryItem> = {}): MemoryItem =>
  ({
    id: "01900000-0000-7000-8000-0000000000aa",
    scope: "person:omar",
    owner: "person:omar",
    provenance: {
      kind: "user",
      ref: "test",
      hash: `sha256:${"1".repeat(64)}`,
      actor: "person:omar",
    },
    confidence: 0.75,
    valid_from: "2026-01-01T00:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
    class: "episodic",
    content: "the plane never calls a model",
    ...over,
  }) as MemoryItem;

const omar: Actor = { id: "person:omar", level: "person", memberships: ["person:omar"] };

/**
 * A Cedar request as the solver returns one: every entity id replaced by an
 * opaque string, the action entities added, the entities in another order.
 */
function asSolver(r: CedarRequest): Counterexample {
  const ids = new Map<string, string>();
  const rename = (u: { type: string; id: string }) => {
    const k = `${u.type}::${u.id}`;
    if (!ids.has(k)) ids.set(k, "Z".repeat(ids.size));
    return { type: u.type, id: ids.get(k) as string };
  };
  const deep = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(deep);
    if (v !== null && typeof v === "object") {
      if ("__entity" in v) return { __entity: rename((v as { __entity: never }).__entity) };
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)]));
    }
    return v;
  };
  const entities = r.entities
    .map((e) => ({
      uid: rename(e.uid),
      attrs: deep(e.attrs) as Counterexample["entities"][number]["attrs"],
      parents: e.parents.map(rename),
    }))
    .reverse();
  for (const a of ["read", "write", "write_without_review"])
    entities.push({ uid: { type: "Engram::Action", id: a }, attrs: {}, parents: [] });
  return {
    principal: rename(r.principal),
    action: r.action,
    resource: rename(r.resource),
    context: deep(r.context) as Counterexample["context"],
    entities,
    left_decision: "allow",
    right_decision: "deny",
  };
}

const answer = (id: string, cex: Counterexample): Answer => ({
  id,
  action: "read",
  envs: 1,
  holds: false,
  counterexample: cex,
});

let job: Job;
const loadJob = async () => {
  job ??= await buildJob(parseProperties(config));
  return job;
};

describe("the checks", () => {
  test("one check per property, pair or preset, and action, each left set bounded by the domain", async () => {
    const j = await loadJob();
    expect(j.checks.map((c) => c.id)).toEqual([
      "read-monotone/strict-before-medium/read",
      "read-monotone/medium-before-permissive/read",
      "model-write-person-scope/strict/write",
      "model-write-person-scope/strict/write_without_review",
      "model-write-person-scope/medium/write",
      "model-write-person-scope/medium/write_without_review",
      "model-write-person-scope/permissive/write",
      "model-write-person-scope/permissive/write_without_review",
      "person-read-needs-grant/strict/read",
      "person-read-needs-grant/medium/read",
      "person-read-needs-grant/permissive/read",
      "read-monotone-reversed/medium-before-strict/read",
      "read-monotone-reversed/permissive-before-medium/read",
    ]);
    for (const c of j.checks) {
      const left = exportCedar(loadPreset(c.left_preset)).policies;
      expect(c.left).toBe(`${left}\n${domain(c.action)}\n`);
      if (c.right_preset !== null)
        expect(c.right).toBe(exportCedar(loadPreset(c.right_preset)).policies);
      else expect(c.right).toBe(`${INVARIANTS[c.property as keyof typeof INVARIANTS].cedar}\n`);
    }
    expect(Object.keys(j.exports)).toEqual(["medium", "permissive", "strict"]);
    expect(j.schema).toBe(exportCedar(loadPreset("medium")).schema);
  });

  test("the domain forbids what Engram cannot express, for the check's action only", () => {
    const read = domain("read");
    expect(read).toContain('forbid (principal, action == Engram::Action::"read", resource)');
    expect(read).toContain("unless {");
    for (const s of ['"person", "role", "team", "org"', "253402300799", "999999999", "1072693248"])
      expect(read).toContain(s);
    expect(read).toContain("context.grant.expires");
    expect(domain("write")).toContain("context.existing.version");
    expect(domain("write")).not.toContain("context.grant");
  });

  test("a config naming a preset, action or invariant there is not is refused", () => {
    const one = (p: object) => ({ properties: [{ shape: "monotone", expect: "holds", ...p }] });
    expect(() => parseProperties(one({ id: "x", pairs: [["strict", "lax"]] }))).toThrow(/lax/);
    expect(() => parseProperties(one({ id: "x", actions: ["delete"] }))).toThrow(/delete/);
    expect(() =>
      parseProperties(one({ id: "nothing", shape: "invariant", presets: ["strict"] })),
    ).toThrow(/no such invariant/);
    expect(() => parseProperties(one({ id: "x", expect: "maybe" }))).toThrow(/expect/);
    expect(() => parseProperties({ properties: [] })).toThrow(/no properties/);
  });
});

describe("counterexamples", () => {
  // Sixty days old: medium's ninety-day episodic ttl admits it, strict's thirty does not.
  const old = item({ valid_from: "2026-01-01T00:00:00.5Z" });
  const at = "2026-03-02T00:00:00Z";

  test("a read decodes to the Engram request it came from and round-trips", () => {
    const { decoded, faithful, problems } = decode(
      asSolver(cedarReadRequest(omar, old, at)),
      "read",
    );
    expect(problems).toEqual([]);
    expect(faithful).toBe(true);
    expect(decoded.actor.level).toBe("person");
    expect(decoded.actor.memberships).toEqual([decoded.item.scope]);
    expect(decoded.item.scope).toMatch(/^person:/);
    expect(decoded.item.valid_from).toBe("2026-01-01T00:00:00.500000000Z");
    expect(decoded.item.confidence).toBe(0.75);
    expect(decoded.at).toBe(at);
  });

  test("the evaluator reproduces a counterexample: medium admits the read, strict does not", async () => {
    const id = "read-monotone-reversed/medium-before-strict/read";
    const [r] = replay(await loadJob(), [answer(id, asSolver(cedarReadRequest(omar, old, at)))]);
    expect(r).toMatchObject({ id, faithful: true, left_allows: true, right_allows: false });
    expect(r?.reproduced).toBe(true);
  });

  test("a counterexample both presets admit is not reproduced", async () => {
    const fresh = item({ valid_from: "2026-03-01T00:00:00Z" });
    const id = "read-monotone-reversed/medium-before-strict/read";
    const [r] = replay(await loadJob(), [answer(id, asSolver(cedarReadRequest(omar, fresh, at)))]);
    expect(r).toMatchObject({ faithful: true, left_allows: true, right_allows: true });
    expect(r?.reproduced).toBe(false);
  });

  test("a read under a live grant decodes to a grant naming the reader", async () => {
    const reader: Actor = { id: "person:sara", level: "person", memberships: ["person:sara"] };
    const granted = item({
      class: "semantic",
      grants: [{ to: "person:sara", mode: "read", expires: "2026-04-01T00:00:00Z" }],
    });
    const cex = asSolver(cedarReadRequest(reader, granted, at));
    const { decoded, faithful } = decode(cex, "read");
    expect(faithful).toBe(true);
    expect(decoded.item.grants).toEqual([
      { to: decoded.actor.id, mode: "read", expires: "2026-04-01T00:00:00Z" },
    ]);
    // The property's own statement over the Engram request: a live grant names the reader.
    expect(INVARIANTS["person-read-needs-grant"].holds(decoded)).toBe(true);
    const [r] = replay(await loadJob(), [answer("person-read-needs-grant/medium/read", cex)]);
    expect(r).toMatchObject({
      faithful: true,
      left_allows: true,
      right_allows: true,
      reproduced: false,
    });
  });

  test("a read of another person's item with no grant breaks the property's statement", () => {
    const reader: Actor = { id: "person:sara", level: "person", memberships: ["person:sara"] };
    const { decoded } = decode(asSolver(cedarReadRequest(reader, item(), at)), "read");
    expect(INVARIANTS["person-read-needs-grant"].holds(decoded)).toBe(false);
  });

  test("a write round-trips, with the projected item, its grants and the retired content", () => {
    const writer: Actor = {
      id: "person:omar",
      level: "person",
      memberships: ["person:omar", "team:core"],
      source: "model",
    };
    const next = item({
      scope: "team:core",
      class: "semantic",
      version: 2,
      provenance: { ...item().provenance, kind: "model" },
      grants: [{ to: "person:sara", mode: "read" }],
    });
    const prior = item({ class: "semantic" });
    // The content was retired in the scope: the evaluator's map is keyed by its hash.
    const retired = new Map([[contentHash(next.content), "01900000-0000-7000-8000-0000000000bb"]]);
    const cex = asSolver(cedarWriteRequest(writer, next, prior, retired, "write"));
    const { decoded, faithful, problems } = decode(cex, "write");
    expect(problems).toEqual([]);
    expect(faithful).toBe(true);
    expect(decoded.existing?.scope).toMatch(/^person:/);
    expect(decoded.item.scope).toMatch(/^team:/);
    expect(decoded.actor.source).toBe("model");
    expect(decoded.item.grants.length).toBe(1);
    expect(decoded.existing?.grants).toEqual([]);
    expect([...decoded.retired.keys()]).toEqual([contentHash(decoded.item.content)]);
    // A model-sourced write into a team scope breaks the write property's statement.
    expect(INVARIANTS["model-write-person-scope"].holds(decoded)).toBe(false);
  });

  test("two org scopes the solver keeps apart, which Engram's one org would merge, make a decode unfaithful", () => {
    const cex = asSolver(
      cedarReadRequest({ ...omar, memberships: ["org"] }, item({ scope: "org" }), at),
    );
    // A second org-level scope entity that the principal is in.
    cex.entities.push({
      uid: { type: "Engram::Scope", id: "other" },
      attrs: { level: "org" },
      parents: [],
    });
    const principal = cex.entities.find(
      (e) => e.uid.id === cex.principal.id && e.uid.type === cex.principal.type,
    );
    principal?.parents.push({ type: "Engram::Scope", id: "other" });
    const { faithful, problems } = decode(cex, "read");
    expect(faithful).toBe(false);
    expect(problems.join(" ")).toMatch(/2 org scopes collapse/);
  });

  test("a counterexample whose encoding the decoder cannot give back is reported, not replayed as faithful", () => {
    const cex = asSolver(cedarReadRequest(omar, item(), at));
    // A flag no Engram item carries: a ttl of zero seconds.
    const resource = cex.entities.find((e) => e.uid.type === "Engram::Item");
    if (resource) resource.attrs.ttl = 0;
    const { faithful, problems } = decode(cex, "read");
    expect(faithful).toBe(false);
    expect(problems.join(" ")).toMatch(/not a valid MemoryItem/);
  });
});
