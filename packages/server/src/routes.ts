// The route table (card E8.1, ADR 0027 decision 1): the single source of the
// HTTP contract. Each route names its method, its path (OpenAPI style, with
// `{param}`), its request and response schemas from ./contract.ts, and a
// handler that calls the Plane or another core function and holds no policy
// logic (AGENTS.md rule 1). createApp serves the table; openapi.ts documents
// it; the generated client is built from that document.
//
// A decision is a response, not an error (ADR 0027 decision 6): allow, deny
// and ask are 200 with their event. Errors are thrown and mapped in app.ts;
// distill throws core's NotImplementedYet until a card implements it (the
// backlog row "Plane.distill and the /distill route"), which app.ts answers
// with 501 naming the card, `backlog` while none does.
import {
  type Actor,
  acceptedClosures,
  accessTime,
  BUNDLE_FORMAT,
  BUNDLE_VERSION,
  currentItems,
  eventById,
  itemById,
  type MemoryItem,
  planSupersession,
  readCounts,
  servedImport,
  syncBeforeRead,
  visibleEvents,
  writeClosures,
} from "@engram/core";
import type { z } from "zod";
import * as C from "./contract.ts";
import { storeOwner, type Workspace } from "./workspace.ts";

export type Method = "get" | "post";

export interface RouteContext<Req> {
  workspace: Workspace;
  body: Req;
  params: Record<string, string>;
  /**
   * The server's clock: the time of every call and its events' ts. A request
   * names no time of its own (card RV5, finding RV-SRF-2); a read's `at` is
   * only the time its validity windows are judged at.
   */
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

/** The projected item of an id, through core, for servedImport's held kind. */
const heldItem = (w: Workspace) => (id: string) => itemById(w.deps.db, id);

/**
 * What runs before a read (core's syncBeforeRead, card RV5, finding
 * RV-SRF-1): the store owner's sweep when the owner reads, at the server's
 * clock, and the adoption of the store's own memories; core decides what the
 * reader is shown, and the route only shapes it.
 */
async function syncStore(workspace: Workspace, reader: Actor, now: string) {
  const { store } = workspace;
  if (store === null) return null;
  const { forReader } = await syncBeforeRead(workspace.plane, {
    reader,
    now,
    store: { deps: workspace.deps, scope: store.scope, owner: storeOwner(store.owner) },
  });
  const [sweep] = forReader.sweeps;
  if (sweep === undefined || forReader.adoption === null) return null;
  return {
    store: { name: store.name, root: store.root, scope: store.scope },
    retention: sweep.report,
    adoption: forReader.adoption,
  };
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
    // An import-sourced actor's write is mapped as an imported row (core's
    // servedImport, card E9.8): a client can only lower trust.
    handler: ({ workspace, body, now }) => {
      const { actor, item } = servedImport(body.actor, body.item, heldItem(workspace));
      return workspace.plane.write(actor, item as MemoryItem, now());
    },
  }),
  route<z.infer<typeof C.WriteRequest>>({
    id: "checkWrite",
    method: "post",
    path: "/items/check",
    summary: "The decision a write would get now, with nothing stored and no event (decision D12).",
    request: C.WriteRequest,
    response: C.CheckResponse,
    errors: [400],
    handler: ({ workspace, body, now }) => {
      const { actor, item } = servedImport(body.actor, body.item, heldItem(workspace));
      return workspace.plane.checkWrite(actor, item as MemoryItem, now());
    },
  }),
  route<z.infer<typeof C.ReadRequest>>({
    id: "read",
    method: "post",
    path: "/read",
    summary:
      "Read through the plane as the actor at the server's clock, validity windows at `at` when given: with a store, its owner's sweep when the owner reads and the adoption of its memories run first; every returned item is explained.",
    request: C.ReadRequest,
    response: C.ReadResponse,
    errors: [400],
    handler: async ({ workspace, body, now }) => {
      const at = now();
      // The sync report is the owner's own sweep and adoption (item ids,
      // reasons, a content hash); core gives it to the owner only (R3-3).
      const sync = await syncStore(workspace, body.actor, at);
      const result = await workspace.plane.read(body.actor, {
        text: body.text,
        at,
        ...(body.at === undefined ? {} : { valid_at: body.at }),
      });
      return { ...result, sync, policy: policyLabel(workspace) };
    },
  }),
  route<z.infer<typeof C.ReadByIdRequest>>({
    id: "readById",
    method: "post",
    path: "/read/{itemId}",
    summary:
      "Read one item by its id through the plane's read filter as the actor at the server's clock (card E8.14): the item and its explanation when the actor may read it, nothing otherwise, and one read event; with a store, the same sweep and adoption as /read run first.",
    request: C.ReadByIdRequest,
    response: C.ReadResponse,
    errors: [400],
    handler: async ({ workspace, body, params, now }) => {
      const at = now();
      const sync = await syncStore(workspace, body.actor, at);
      const result = await workspace.plane.readById(body.actor, params.itemId ?? "", {
        at,
        ...(body.at === undefined ? {} : { valid_at: body.at }),
      });
      return { ...result, sync, policy: policyLabel(workspace) };
    },
  }),
  route<z.infer<typeof C.ScopesRequest>>({
    id: "listScopes",
    method: "post",
    path: "/scopes",
    summary:
      "The scopes the actor can see at the server's clock (card E8.14): its member scopes the read matrix lets its level read, and the scope of every item a read would admit through a live grant; one read event records the decision; with a store, the same sweep and adoption as /read run first.",
    request: C.ScopesRequest,
    response: C.ScopesResponse,
    errors: [400],
    handler: async ({ workspace, body, now }) => {
      const at = now();
      // As for a read (review finding E8.14-11): a grant the store's own
      // memories carry is adopted before the scopes are listed.
      const sync = await syncStore(workspace, body.actor, at);
      return {
        ...(await workspace.plane.listScopes(body.actor, at)),
        sync,
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
  route<z.infer<typeof C.ExplainAbsentRequest>>({
    id: "explainAbsent",
    method: "post",
    path: "/explain-absent",
    summary:
      "Why not this item (card E2.17): the first stage (match, status, ttl, validity, the rank cut) that keeps one item out of a read with the same text and validity time over the projection as it stands, before the sweep and adoption /read runs first with a store, from the read's own predicates; or that the read returns it. With a store, an item past its ttl answers ttl where /read, after its sweep, counts it not active, and a record not yet adopted answers as an unknown id. Answered only for an actor who may ask for the item by id (ADR 0047); anyone else gets the refusal an unknown id gets. Runs no sweep or adoption; appends no event.",
    request: C.ExplainAbsentRequest,
    response: C.AbsenceExplanation,
    errors: [400],
    handler: ({ workspace, body, now }) =>
      workspace.plane.explainAbsent(body.actor, body.item_id, {
        at: now(),
        ...(body.text === undefined ? {} : { text: body.text }),
        ...(body.at === undefined ? {} : { valid_at: body.at }),
      }),
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
      workspace.plane.promote(body.actor, body.item_id, body.to, now(), {
        review: body.review === true,
      }),
  }),
  route<z.infer<typeof C.GrantRequest>>({
    id: "changeGrants",
    method: "post",
    path: "/grants",
    summary:
      "Add or remove grants on one item as its owner (card E9.4, ADR 0034); 200 with the decision's update event.",
    request: C.GrantRequest,
    response: C.GrantResponse,
    errors: [400, 503],
    handler: ({ workspace, body, now }) =>
      workspace.plane.changeGrants(
        body.actor,
        body.item_id,
        { add: body.add, remove: body.remove },
        now(),
      ),
  }),
  route<z.infer<typeof C.WhoCanReadItemRequest>>({
    id: "whoCanReadItem",
    method: "post",
    path: "/who-can-read/item",
    summary:
      "Who can read one item now (card E2.13): a symbolic set of readers, each with the rule or grant that admits it. Answered only for an actor who may read the item or its scope; grant holders named to its owner only; anyone else gets the refusal an unknown id gets. Appends no event.",
    request: C.WhoCanReadItemRequest,
    response: C.WhoCanReadAnswer,
    errors: [400],
    handler: ({ workspace, body, now }) =>
      workspace.plane.whoCanReadItem(body.actor, body.item_id, now()),
  }),
  route<z.infer<typeof C.WhoCanReadScopeRequest>>({
    id: "whoCanRead",
    method: "post",
    path: "/who-can-read/scope",
    summary:
      "Who can read a scope's items by the read matrix (card E2.13), each entry with its rule. Answered only for an actor who may read the scope as a member. Appends no event.",
    request: C.WhoCanReadScopeRequest,
    response: C.WhoCanReadAnswer,
    errors: [400],
    handler: ({ workspace, body, now }) =>
      workspace.plane.whoCanRead(body.actor, body.scope, now()),
  }),
  route<z.infer<typeof C.RetainRequest>>({
    id: "retain",
    method: "post",
    path: "/retain",
    summary: "Sweep one scope's retention as a member of it (ADR 0025).",
    request: C.RetainRequest,
    response: C.RetentionReport,
    errors: [400],
    handler: ({ workspace, body, now }) => workspace.plane.retain(body.actor, body.scope, now()),
  }),
  route<z.infer<typeof C.EventsRequest>>({
    id: "events",
    method: "post",
    path: "/events",
    summary:
      "The events the actor may see: those naming a member scope the read matrix lets its level read, and those it made that name no scope; each item shown only if the read filter would return it (visibleEvents).",
    request: C.EventsRequest,
    response: C.EventsResponse,
    errors: [400],
    handler: async ({ workspace, body, now }) => {
      const after = body.after ?? -1;
      const events = workspace.plane.events().filter((e) => e.seq > after);
      const items = new Map(currentItems(workspace.deps.db).map((i) => [i.id, i]));
      const view = {
        policy: workspace.policy,
        // Never before the log's head (card RV5, RV-CORE-3), as a read is judged.
        at: accessTime(workspace.deps.db, now()),
        current: (id: string) => items.get(id),
      };
      return { events: visibleEvents(body.actor, events, view) };
    },
  }),
  route<z.infer<typeof C.ExportRequest>>({
    id: "export",
    method: "post",
    path: "/export",
    summary:
      "The actor's memory bundle (card E9.8, docs/bundle.md): the items core's bundleRows picks, each with its visible events; one read event by the actor records the export (Plane.export).",
    request: C.ExportRequest,
    response: C.ExportResponse,
    errors: [400],
    handler: async ({ workspace, body, now }) => {
      const at = now();
      // Plane.export picks the rows (core's bundleRows) and records the export.
      const { rows } = await workspace.plane.export(body.actor, at);
      return {
        format: BUNDLE_FORMAT,
        version: BUNDLE_VERSION,
        exported_at: at,
        exported_by: body.actor.id,
        policy: policyLabel(workspace),
        rows,
      };
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
    summary:
      "Run the policy's enabled deterministic lints over one scope as a member of it; each finding is a lint event (card L1).",
    request: C.LintRequest,
    response: C.LintResponse,
    errors: [400],
    handler: ({ workspace, body, now }) => workspace.plane.lint(body.actor, now(), body.scope),
  }),
  route<z.infer<typeof C.SimulateRequest>>({
    id: "simulate",
    method: "post",
    path: "/simulate",
    summary:
      "Replay a recorded workload under the workspace's policy and a candidate, on scratch logs and stores; zero model calls.",
    request: C.SimulateRequest,
    response: C.SimReport,
    errors: [400],
    handler: ({ workspace, body }) =>
      workspace.plane.simulate(body.workload, body.policy ?? workspace.policy),
  }),
  route<z.infer<typeof C.DistillRequest>>({
    id: "distill",
    method: "post",
    path: "/distill",
    summary:
      "Candidate procedures from sessions; 501 until a card implements Plane.distill (docs/tasks/backlog.md).",
    request: C.DistillRequest,
    response: C.OpenReport,
    errors: [400, 501],
    handler: ({ workspace, body }) =>
      workspace.plane.distill(
        body.sessions as unknown as Parameters<typeof workspace.plane.distill>[0],
        body.method,
      ),
  }),
  route<z.infer<typeof C.SupersedeRequest>>({
    id: "supersede",
    method: "post",
    path: "/supersede",
    summary:
      "The supersession plan for a new version (card L6): the head of its chain and, for each ancestor the actor may read, a proposed close or a review flag; each accepted close is then one ordinary write through the gate.",
    request: C.SupersedeRequest,
    response: C.SupersedeResponse,
    errors: [400, 503],
    handler: async ({ workspace, body, now }) => {
      const at = now();
      const { db } = workspace.deps;
      // The store's sweep and adoption run first, as before a read (L6-7).
      await syncStore(workspace, body.actor, at);
      // Core plans and refuses an id with no proposed close; the gate decides each write.
      const plan = planSupersession(
        db,
        workspace.policy,
        body.actor,
        body.item_id,
        accessTime(db, at),
      );
      const closes = acceptedClosures(db, plan, body.accept ?? []);
      // Core writes each close and answers with the actor's view of it (card RD1).
      const written = await writeClosures(
        { plane: workspace.plane, db, policy: workspace.policy },
        body.actor,
        closes,
        at,
      );
      return { ...plan, ...written };
    },
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
      event: await workspace.plane.recordBypass(body.actor, body.bypass, now()),
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
