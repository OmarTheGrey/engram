// C5's memory for tau2 (card B11, review B11-1 to B11-3): `engram serve`'s
// app, in process (@engram/server's `listen`), over a scratch log and the
// condition's store, so the shim calls /api/v1 and every write crosses
// Plane.write and every read Plane.read. It is the runner's C5, as card B7's
// planeBackend is (packages/bench/src/merit/seam.ts):
//
// - reads through a plane over the same log and store built with the core
//   retrieval pipeline and the shared limit (coreReadPlane in
//   packages/runner/src/conditions.ts), so C5 is C2 plus the read filter and
//   no condition uses a store's own search (the pre-registration's "Shared
//   retrieval for C2 to C5");
// - a fixed clock, the config's memory_time, which every item is dated at, so
//   validity, retention and recency are judged at the time the items carry
//   and do not depend on when the run happens (rule 7);
// - seeded ids (the runner's sequentialIds), so the read id in the memory tag
//   is the same on every run and a prompt holding one replays.
import {
  type Actor,
  type Adapter,
  createPlane,
  loadPreset,
  migrate,
  openSqlite,
  type PresetName,
} from "@engram/core";
import { listen, workspaceOf } from "@engram/server";

/** Deterministic UUIDv7-shaped ids, as the runner's sequentialIds (gatemem-probe.ts). */
export const sequentialIds = (variant: "8" | "9") => {
  let n = 0;
  return () => `01920000-0000-7000-${variant}000-${String(++n).padStart(12, "0")}`;
};

export interface PlaneMemory {
  /** `http://127.0.0.1:<port>`: the shim calls `<url>/api/v1/...`. */
  url: string;
  close(): Promise<void>;
}

export interface PlaneMemoryOptions {
  adapter: Adapter;
  preset: PresetName;
  /** The server's clock: every write, read and event happens at this instant. */
  at: string;
  /** The runner's READ_LIMIT. */
  readLimit: number;
}

/** Starts C5's plane on a free loopback port. */
export async function startPlaneMemory(options: PlaneMemoryOptions): Promise<PlaneMemory> {
  const db = openSqlite(":memory:");
  migrate(db);
  const deps = {
    db,
    adapter: options.adapter,
    policy: loadPreset(options.preset),
    newId: sequentialIds("9"),
  };
  const core = createPlane({ ...deps, retrieval: { pipeline: "core", limit: options.readLimit } });
  const base = workspaceOf(deps);
  const workspace = {
    ...base,
    plane: {
      ...base.plane,
      read: (actor: Actor, query: Parameters<typeof core.read>[1]) => core.read(actor, query),
    },
  };
  const server = await listen(workspace, { port: 0, now: () => options.at, ui: null });
  return {
    url: server.url.replace(/\/$/, ""),
    close: async () => {
      await server.close();
      db.close();
    },
  };
}
