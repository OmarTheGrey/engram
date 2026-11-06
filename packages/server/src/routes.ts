// The route table (card E8.1, ADR 0027 decision 1): the single source of the
// HTTP contract. Each route names its method, its path (OpenAPI style, with
// `{param}`), its request and response schemas from ./contract.ts, and a
// handler that calls the Plane or another core function and holds no policy
// logic (AGENTS.md rule 1). createApp serves the table; openapi.ts documents
// it; the generated client is built from that document.
//
// A decision is a response, not an error (ADR 0027 decision 6): allow, deny
// and ask are 200 with their event. Errors are thrown and mapped in app.ts;
// lint, simulate and distill throw core's NotImplementedYet until their
// cards land, which app.ts answers with 501 naming the card.
import {
  adoptStoreItems,
  currentItems,
  eventById,
  type MemoryItem,
  readCounts,
  visibleEvents,
} from "@engram/core";
import type { z } from "zod";
import * as C from "./contract.ts";
import { storeOwner, type Workspace } from "./workspace.ts";

export type Method = "get" | "post";

export interface RouteContext<Req> {
  workspace: Workspace;
  body: Req;
  params: Record<string, string>;
  /** The call's time: the request's `at`, else the server's clock. */
  now: () => string;
}

export interface Route<Req = unknown> {
  /** The operation id in the OpenAPI document. */
  id: string;
  method: Method;
  /** Under /api/v1, OpenAPI style: `/explain/{readId}`. */
  path: string;
  summary: string;
  request?: z.ZodType<Req>;
  response: z.ZodType;
  /** The error statuses this route can answer with besides the guards' (app.ts). */
  errors: number[];
  handler(ctx: RouteContext<Req>): Promise<unknown>;
}

export const API_PREFIX = "/api/v1";

const route = <Req>(r: Route<Req>): Route => r as unknown as Route;

const policyLabel = (w: Workspace) => `${w.policy.id} v${w.policy.version}`;

/** The store owner's sweep and adoption before a read, as `engram read` has always run them. */
async function syncStore(workspace: Workspace, at: string) {
  const { store } = workspace;
  if (store === null) return null;
  const owner = storeOwner(store.owner);
  // Retention first (ADR 0025): the plane has no clock, so the surface sweeps;
  // then the folder's own memories are adopted as its owner (decision D8).
  const retention = await workspace.plane.retain(owner, store.scope, at);
  const adoption = await adoptStoreItems(workspace.deps, owner, store.scope, at);
  return { store: { name: store.name, root: store.root, scope: store.scope }, retention, adoption };
}

export const ROUTES: readonly Route[] = [
  route<z.infer<typeof C.WriteRequest>>({
    id: "write",
    method: "post",
    path: "/items",
    summary: "Write one item through the write gate; 200 with the decision's event.",
    request: C.WriteRequest,
    response: C.WriteResponse,
    errors: [400, 503],
    handler: ({ workspace, body, now }) =>
      workspace.plane.write(body.actor, body.item as unknown as MemoryItem, body.at ?? now()),
  }),
  route<z.infer<typeof C.WriteRequest>>({
    id: "checkWrite",
    method: "post",
    path: "/items/check",
    summary: "The decision a write would get now, with nothing stored and no event (decision D12).",
    request: C.WriteRequest,
    response: C.CheckResponse,
    errors: [400],
    handler: ({ workspace, body, now }) =>
      workspace.plane.checkWrite(body.actor, body.item as unknown as MemoryItem, body.at ?? now()),
  }),
  route<z.infer<typeof C.ReadRequest>>({
    id: "read",
    method: "post",
    path: "/read",
    summary:
      "Read through the plane as the actor: the store's owner sweeps and adopts first when the workspace has a store; every returned item is explained.",
    request: C.ReadRequest,
    response: C.ReadResponse,
    errors: [400],
    handler: async ({ workspace, body, now }) => {
      const at = body.at ?? now();
      const sync = await syncStore(workspace, at);
      const result = await workspace.plane.read(body.actor, { text: body.text, at });
      // The sync report is the owner's own sweep and adoption (item ids,
      // reasons, a content hash); only the owner gets it back (finding R3-3).
      const owner = workspace.store === null ? null : storeOwner(workspace.store.owner).id;
      return {
        ...result,
        sync: body.actor.id === owner ? sync : null,
        policy: policyLabel(workspace),
      };
    },
  }),
  route<z.infer<typeof C.ExplainRequest>>({
    id: "explain",
    method: "post",
    path: "/explain/{readId}",
    summary:
      "The explanations a read recorded and the counts its event's reason records, for the actor who made it only (decision D5).",
    request: C.ExplainRequest,
    response: C.ExplainResponse,
    errors: [400, 403, 404],
    handler: async ({ workspace, body, params }) => {
      const readId = params.readId ?? "";
      // Plane.explain refuses an unknown read and another actor's read first.
      const explanations = await workspace.plane.explain(body.actor, readId);
      const event = eventById(workspace.deps.db, readId);
      return { read_id: readId, explanations, counts: event ? readCounts(event) : null };
    },
  }),
  route<z.infer<typeof C.PromoteRequest>>({
    id: "promote",
    method: "post",
    path: "/promote",
    summary: "Promote an item through the promotion gate (ADR 0026); 200 with the decision.",
    request: C.PromoteRequest,
    response: C.GateResponse,
    errors: [400, 503],
    handler: ({ workspace, body, now }) =>
      workspace.plane.promote(body.actor, body.item_id, body.to, body.at ?? now(), {
        review: body.review === true,
      }),
  }),
  route<z.infer<typeof C.RetainRequest>>({
    id: "retain",
    method: "post",
    path: "/retain",
    summary: "Sweep one scope's retention as a member of it (ADR 0025).",
    request: C.RetainRequest,
    response: C.RetentionReport,
    errors: [400],
    handler: ({ workspace, body, now }) =>
      workspace.plane.retain(body.actor, body.scope, body.at ?? now()),
  }),
  route<z.infer<typeof C.EventsRequest>>({
    id: "events",
    method: "post",
    path: "/events",
    summary:
      "The events the actor may see: those in its member scopes and those it made, each item shown only if the read filter would return it (visibleEvents).",
    request: C.EventsRequest,
    response: C.EventsResponse,
    errors: [400],
    handler: async ({ workspace, body, now }) => {
      const after = body.after ?? -1;
      const events = workspace.plane.events().filter((e) => e.seq > after);
      const items = new Map(currentItems(workspace.deps.db).map((i) => [i.id, i]));
      const view = {
        policy: workspace.policy,
        at: body.at ?? now(),
        current: (id: string) => items.get(id),
      };
      return { events: visibleEvents(body.actor, events, view) };
    },
  }),
  route({
    id: "policy",
    method: "get",
    path: "/policy",
    summary: "The policy the workspace decides with.",
    response: C.PolicyResponse,
    errors: [],
    handler: async ({ workspace }) => ({ policy: workspace.policy, label: policyLabel(workspace) }),
  }),
  route<z.infer<typeof C.LintRequest>>({
    id: "lint",
    method: "post",
    path: "/lint",
    summary: "Run the enabled lints over one scope; 501 until card L1.",
    request: C.LintRequest,
    response: C.LintResponse,
    errors: [400, 501],
    handler: async ({ workspace, body }) => ({ findings: await workspace.plane.lint(body.scope) }),
  }),
  route<z.infer<typeof C.SimulateRequest>>({
    id: "simulate",
    method: "post",
    path: "/simulate",
    summary: "Replay a workload under a policy; 501 until card E8.9.",
    request: C.SimulateRequest,
    response: C.OpenReport,
    errors: [400, 501],
    handler: ({ workspace, body }) =>
      workspace.plane.simulate(body.workload, body.policy ?? workspace.policy),
  }),
  route<z.infer<typeof C.DistillRequest>>({
    id: "distill",
    method: "post",
    path: "/distill",
    summary: "Candidate procedures from sessions; 501 until card D2.",
    request: C.DistillRequest,
    response: C.OpenReport,
    errors: [400, 501],
    handler: ({ workspace, body }) =>
      workspace.plane.distill(
        body.sessions as unknown as Parameters<typeof workspace.plane.distill>[0],
        body.method,
      ),
  }),
  route<z.infer<typeof C.BypassRequest>>({
    id: "bypass",
    method: "post",
    path: "/bypass",
    summary:
      "Record a bypass a surface blocked (ADR 0014) as one bypass_blocked event; nothing reaches the store.",
    request: C.BypassRequest,
    response: C.EventResponse,
    errors: [400],
    handler: async ({ workspace, body, now }) => ({
      event: await workspace.plane.recordBypass(body.actor, body.bypass, body.at ?? now()),
    }),
  }),
  route({
    id: "viewer",
    method: "get",
    path: "/viewer",
    summary: "The viewer `engram serve --as` named, or null.",
    response: C.ViewerResponse,
    errors: [],
    handler: async ({ workspace }) => ({ viewer: workspace.viewer }),
  }),
  route({
    id: "health",
    method: "get",
    path: "/health",
    summary: "The server answers.",
    response: C.HealthResponse,
    errors: [],
    handler: async () => ({ status: "ok", schema_version: 1 }),
  }),
];
