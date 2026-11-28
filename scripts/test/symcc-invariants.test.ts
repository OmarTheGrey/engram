// Card E2.18, review finding 2: each invariant's Cedar permit, the text the
// solver proves, says what its TypeScript `holds` says, the statement the
// replay judges a counterexample by. Every Engram request of a small grid is
// encoded by cedarReadRequest or cedarWriteRequest and decided by Cedar's
// engine (@cedar-policy/cedar-wasm, card E2.12's development dependency of
// packages/core, reached through that package) on the permit alone, and by
// `holds`; the two must agree, and the grid must hold requests on both sides
// of every invariant that can fail, so a weakened permit fails this test.
import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";
import type { Actor } from "../../packages/core/src/actor.ts";
import {
  cedarReadRequest,
  cedarWriteRequest,
  exportCedar,
} from "../../packages/core/src/policy/cedar.ts";
import { loadPreset } from "../../packages/core/src/policy/load.ts";
import type { Grant, MemoryItem } from "../../packages/core/src/schema.ts";
import { type Decoded, INVARIANTS, type InvariantId } from "../../tools/symcc/properties.ts";

/** The one call of cedar-wasm this test makes; the package resolves only from packages/core. */
interface Cedar {
  isAuthorized(
    call: object,
  ):
    | { type: "success"; response: { decision: string; diagnostics: { errors: unknown[] } } }
    | { type: "failure"; errors: unknown[] };
}
const cedar = createRequire(new URL("../../packages/core/package.json", import.meta.url))(
  "@cedar-policy/cedar-wasm/nodejs",
) as Cedar;
const SCHEMA = exportCedar(loadPreset("medium")).schema;
const AT = "2026-03-01T00:00:00Z";

const item = (over: Partial<MemoryItem>): MemoryItem =>
  ({
    id: "01900000-0000-7000-8000-0000000000aa",
    scope: "person:omar",
    owner: "person:omar",
    provenance: { kind: "user", ref: "t", hash: `sha256:${"1".repeat(64)}`, actor: "person:omar" },
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
    class: "semantic",
    content: "c",
    ...over,
  }) as MemoryItem;

const actors: Actor[] = [
  { id: "person:omar", level: "person", memberships: ["person:omar"] },
  { id: "person:sara", level: "person", memberships: ["person:sara", "team:core"] },
  { id: "agent:claude-code/1", level: "role", memberships: ["role:dev"], source: "model" },
];
const scopes = ["person:omar", "person:sara", "team:core", "role:dev", "org"];
const kinds = ["user", "model", "compaction"] as const;
const grants: Grant[][] = [
  [],
  [{ to: "person:sara", class: "semantic", mode: "read", expires: "2026-04-01T00:00:00Z" }],
  [{ to: "person:sara", class: "semantic", mode: "read", expires: "2026-02-01T00:00:00Z" }],
  [{ to: "person:sara", mode: "read" }],
  [{ to: "person:sara", class: "episodic", mode: "read" }],
  [{ to: "person:*", class: "semantic", mode: "read" }],
  [{ to: "agent:claude-code/*", mode: "read" }],
  [{ to: "person:bilal", mode: "read" }],
];

interface Case {
  decoded: Decoded;
  request: ReturnType<typeof cedarReadRequest>;
}

function readCases(): Case[] {
  const out: Case[] = [];
  for (const actor of actors)
    for (const scope of scopes)
      for (const g of grants) {
        const it = item({ scope, grants: g });
        out.push({
          decoded: {
            action: "read",
            actor,
            item: it,
            at: AT,
            validAt: AT,
            retired: new Map(),
            promotion: false,
          },
          request: cedarReadRequest(actor, it, AT),
        });
      }
  return out;
}

function writeCases(action: "write" | "write_without_review"): Case[] {
  const out: Case[] = [];
  for (const actor of actors)
    for (const scope of scopes)
      for (const kind of kinds) {
        const it = item({ scope, provenance: { ...item({}).provenance, kind } });
        out.push({
          decoded: { action, actor, item: it, retired: new Map(), promotion: false },
          request: cedarWriteRequest(actor, it, undefined, new Map(), action),
        });
      }
  return out;
}

function cedarAllows(permit: string, c: Case): boolean {
  const answer = cedar.isAuthorized({
    principal: c.request.principal,
    action: c.request.action,
    resource: c.request.resource,
    context: c.request.context as never,
    entities: c.request.entities as never,
    policies: { staticPolicies: permit },
    schema: SCHEMA,
    validateRequest: true,
  });
  if (answer.type !== "success") throw new Error(`Cedar refused: ${JSON.stringify(answer.errors)}`);
  if (answer.response.diagnostics.errors.length > 0)
    throw new Error(`Cedar errors: ${JSON.stringify(answer.response.diagnostics.errors)}`);
  return answer.response.decision === "allow";
}

describe("each invariant's Cedar permit agrees with its statement over Engram requests", () => {
  for (const id of Object.keys(INVARIANTS) as InvariantId[]) {
    const inv = INVARIANTS[id];
    test(id, () => {
      const outcomes = new Set<boolean>();
      for (const action of inv.actions) {
        const cases = action === "read" ? readCases() : writeCases(action);
        for (const c of cases) {
          const holds = inv.holds(c.decoded);
          const where = `${id} ${action}: ${c.decoded.actor.id} on ${c.decoded.item.scope} (${c.decoded.item.provenance.kind}, grants ${JSON.stringify(c.decoded.item.grants)})`;
          expect(cedarAllows(inv.cedar, c), where).toBe(holds);
          outcomes.add(holds);
        }
      }
      // A property that can fail has requests on both sides of it in the grid.
      expect(outcomes.has(false), `${id}: no request breaks it`).toBe(true);
      if (id !== "left-allows-some")
        expect(outcomes.has(true), `${id}: no request keeps it`).toBe(true);
    });
  }
});
