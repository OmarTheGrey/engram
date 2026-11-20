// The inspector's fixture workspaces, built at test time: fixtures/workspaces/
// inspector/ (cards E8.5 and E8.6) with its own policy, and fixtures/
// workspaces/twin/ (card E9.4) under the twin profile itself
// (packages/pi-package/profiles/twin.yaml). Each is a workload of writes and
// reads with fixed item ids and times, each step one call of the generated
// client bound to the app in process. Event ids come from a counter, so the
// log is the same on every run. The UI's tests and the layer 6 Playwright
// tests (test/e2e/inspector.e2e.test.ts, test/e2e/twin.e2e.test.ts) share them.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createFakeAdapter } from "@engram/adapters";
import { currentItems, migrate, openSqlite, parsePolicy, visibleEvents } from "@engram/core";
import { createApp, workspaceOf } from "@engram/server";
import { type Actor, createEngramClient, type ReadResponse } from "../src/api/index.ts";

// What the layer 6 test needs from core and the server, which the repository
// root does not depend on.
export { readCounts } from "@engram/core";
export { builtUi, type Listening, listen, UI_DIST } from "@engram/server";

export const FIXTURE_DIR = fileURLToPath(
  new URL("../../../fixtures/workspaces/inspector/", import.meta.url),
);
export const TWIN_DIR = fileURLToPath(
  new URL("../../../fixtures/workspaces/twin/", import.meta.url),
);
export const TWIN_PROFILE = fileURLToPath(
  new URL("../../pi-package/profiles/twin.yaml", import.meta.url),
);
export const PORT = 7313;
export const BASE = `http://127.0.0.1:${PORT}`;

type Step =
  | { op: "write"; as: string; at: string; item: Record<string, unknown> }
  | { op: "read"; as: string; at: string; text?: string };

export interface Workload {
  now: string;
  viewer: string;
  actors: Record<string, Actor>;
  steps: Step[];
}

export const workload = (dir = FIXTURE_DIR): Workload =>
  JSON.parse(readFileSync(`${dir}workload.json`, "utf8")) as Workload;

/** An item as the fixture names it, with every other field at its plain default. */
function itemOf(actor: Actor, over: Record<string, unknown>) {
  return {
    class: "semantic",
    owner: actor.id,
    provenance: {
      kind: "user",
      ref: "fixture/inspector",
      hash: `sha256:${"0".repeat(64)}`,
      actor: actor.id,
    },
    confidence: 0.9,
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
    ...over,
  };
}

/** The client bound to an app over `workspace`, in process. */
export function clientOf(app: { fetch: (r: Request) => Response | Promise<Response> }) {
  return createEngramClient({ baseUrl: BASE, fetch: async (r) => app.fetch(r) });
}

/** The inspector's fixture workspace (cards E8.5 and E8.6). */
export const inspectorWorkspace = () => fixtureWorkspace(FIXTURE_DIR, `${FIXTURE_DIR}policy.yaml`);

/** The twin screens' fixture workspace (card E9.4), under the twin profile. */
export const twinWorkspace = () => fixtureWorkspace(TWIN_DIR, TWIN_PROFILE);

/** The workspace after a fixture's workload, with each read's response by actor name. */
export async function fixtureWorkspace(dir: string, policyFile: string) {
  const w = workload(dir);
  const policy = parsePolicy(readFileSync(policyFile, "utf8"), policyFile);
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const viewer = w.actors[w.viewer] as Actor;
  const workspace = workspaceOf(
    {
      db,
      adapter: createFakeAdapter(),
      policy,
      newId: () => `01940000-0000-7000-8000-1${String(++n).padStart(11, "0")}`,
    },
    { viewer },
  );
  // The server's clock, set to each step's time while the workload runs: a
  // request names no time of its own (card RV5, ADR 0027's amendment).
  let clock = w.now;
  const app = createApp(workspace, { port: PORT, now: () => clock });
  const client = clientOf(app);
  const reads = new Map<string, ReadResponse>();
  const decisions: string[] = [];
  for (const step of w.steps) {
    const actor = w.actors[step.as] as Actor;
    clock = step.at;
    if (step.op === "write") {
      const { data, error } = await client.POST("/api/v1/items", {
        body: { actor, item: itemOf(actor, step.item) },
      });
      if (data === undefined) throw new Error(`fixture write failed: ${JSON.stringify(error)}`);
      decisions.push(`${step.item.id} ${data.event.decision}`);
    } else {
      const { data, error } = await client.POST("/api/v1/read", {
        body: { actor, ...(step.text ? { text: step.text } : {}) },
      });
      if (data === undefined) throw new Error(`fixture read failed: ${JSON.stringify(error)}`);
      reads.set(step.as, data);
    }
  }
  clock = w.now;
  /**
   * The timeline core's visibleEvents gives `actor` over the log as it is now,
   * at the server's clock: the events it may see, each item withheld unless
   * the read filter would return it (what POST /events answers).
   */
  const timelineOf = (actor: Actor) => {
    const items = new Map(currentItems(db).map((i) => [i.id, i]));
    return visibleEvents(actor, workspace.plane.events(), {
      policy,
      at: w.now,
      current: (id) => items.get(id),
    });
  };
  return { workload: w, workspace, policy, viewer, app, client, reads, decisions, timelineOf };
}
