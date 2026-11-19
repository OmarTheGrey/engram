// Card E2.6 over the files adapter, the store the twin dogfood runs on (card
// E9.5): two handles on one SQLite log file, as `engram serve` and an
// `engram read` from the CLI share a workspace, over one memory folder. An
// offboarding on one handle and a grant change or a rewrite on the other
// never leave an erased item's file in the folder or its content in the log,
// whichever is slow, and adopting the folder again, which `engram read` does
// before every read, brings nothing back.
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Adapter,
  adoptStoreItems,
  allEvents,
  createPlane,
  ERASING_ID,
  GRANT_CONFLICT_ID,
  itemById,
  type MemoryItem,
  migrate,
  offboard,
  openSqlite,
  type PlaneDeps,
  parsePolicy,
  rebuild,
  type StoreRef,
  WRITE_CONFLICT_ID,
} from "@engram/core";
import { afterAll, describe, expect, test } from "vitest";
import { createFilesAdapter } from "../../src/files/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, "../../../pi-package/profiles/twin.yaml");
const AT = "2026-11-19T10:00:00Z";
const LATER = "2026-11-19T11:00:00Z";
const SECRET = "Dana's sister is Mira.";
const dana = {
  id: "person:dana",
  level: "person" as const,
  memberships: ["person:dana"],
  source: "user" as const,
};
const hr = {
  id: "person:hr",
  level: "person" as const,
  memberships: ["person:hr", "person:dana"],
  source: "user" as const,
};
const sam = { id: "person:sam", level: "person" as const, memberships: ["person:sam"] };
const toSam = {
  to: "person:sam",
  class: "semantic" as const,
  mode: "read" as const,
  expires: "2026-12-19T00:00:00Z",
};
const OWN = "01920000-0000-7000-8000-000000000001";

const dirs: string[] = [];
const logs: { close(): void }[] = [];
afterAll(async () => {
  for (const db of logs) {
    try {
      db.close();
    } catch {
      // closed by the test
    }
  }
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

/** Holds the next call of `method` on this handle's view of the folder, before or after it runs. */
function pausable(store: Adapter) {
  let armed: { key: string; arrive: () => void; gate: Promise<void> } | null = null;
  const at = async (key: string) => {
    if (armed?.key !== key) return;
    const hold = armed;
    armed = null;
    hold.arrive();
    await hold.gate;
  };
  const adapter: Adapter = Object.assign(Object.create(store) as Adapter, {
    write: async (it: MemoryItem) => {
      await at("write:before");
      return store.write(it);
    },
    delete: async (ref: StoreRef) => {
      await store.delete(ref);
      await at("delete:after");
    },
  });
  const pause = (key: "write:before" | "delete:after") => {
    let arrive = () => {};
    let release = () => {};
    const arrived = new Promise<void>((r) => {
      arrive = r;
    });
    const gate = new Promise<void>((r) => {
      release = r;
    });
    armed = { key, arrive, gate };
    return { arrived, release };
  };
  return { adapter, pause };
}

/** Dana's folder with one item the plane wrote into it, and two handles on one log file. */
async function twoHandles() {
  const root = await mkdtemp(join(tmpdir(), "engram-e26-"));
  dirs.push(root);
  const store = createFilesAdapter({
    root,
    owner: "dana",
    importValidFrom: "2026-10-01T00:00:00Z",
  });
  const logDir = await mkdtemp(join(tmpdir(), "engram-e26-log-"));
  dirs.push(logDir);
  const logPath = join(logDir, "engram.db");
  const mine = openSqlite(logPath);
  migrate(mine);
  const theirs = openSqlite(logPath);
  logs.push(mine, theirs);
  const policy = parsePolicy(await readFile(PROFILE, "utf8"), "twin.yaml");
  let n = 0;
  const newId = () => `01920000-0000-7000-8000-${String(900_000 + ++n).padStart(12, "0")}`;
  const a = pausable(store);
  const b = pausable(store);
  const depsMine: PlaneDeps = { db: mine, adapter: a.adapter, policy, newId };
  const depsTheirs: PlaneDeps = { db: theirs, adapter: b.adapter, policy, newId };
  const plane = createPlane(depsMine);
  const { item, event } = await plane.write(
    dana,
    {
      id: OWN,
      class: "semantic",
      scope: "person:dana",
      owner: dana.id,
      content: SECRET,
      provenance: { kind: "user", ref: "doc/1", hash: `sha256:${"0".repeat(64)}`, actor: dana.id },
      confidence: 0.9,
      valid_from: "2026-10-01T00:00:00Z",
      valid_to: null,
      ttl: null,
      grants: [],
      version: 1,
      lineage: [],
      status: "active",
      store_ref: null,
      schema_version: 1,
    } as MemoryItem,
    AT,
  );
  expect(event.decision).toBe("allow");
  const files = async () =>
    (await readdir(root)).filter((f) => f.endsWith(".md") && f !== "MEMORY.md");
  expect(await files()).toHaveLength(1);
  return {
    root,
    mine,
    theirs,
    a,
    b,
    depsMine,
    depsTheirs,
    plane,
    seeded: item as MemoryItem,
    files,
  };
}
type Env = Awaited<ReturnType<typeof twoHandles>>;

/** Nothing of Dana's erased item in the folder, the log, a rebuild, a read, or the next adoption. */
async function nothingComesBack(env: Env) {
  expect(await env.files()).toEqual([]);
  expect(itemById(env.mine, OWN)).toBeUndefined();
  rebuild(env.mine);
  expect(itemById(env.mine, OWN)).toBeUndefined();
  await adoptStoreItems(env.depsMine, dana, "person:dana", LATER);
  expect(itemById(env.mine, OWN)).toBeUndefined();
  expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
  expect((await env.plane.read(dana, { at: LATER })).items).toEqual([]);
  expect(JSON.stringify(allEvents(env.mine))).not.toContain("Mira");
}

describe("two handles on one log over a memory folder", () => {
  test("an offboarding slow to commit after deleting the file refuses a grant change in that window", async () => {
    const env = await twoHandles();
    const d = env.b.pause("delete:after");
    const off = offboard(env.depsTheirs, hr, { person: "person:dana", roles: [] }, AT);
    await d.arrived;
    const r = await env.plane.changeGrants(dana, OWN, { add: [toSam] }, AT);
    expect(r.event).toMatchObject({ decision: "deny", policy_id: ERASING_ID });
    d.release();
    expect((await off).erased.items).toEqual([OWN]);
    await nothingComesBack(env);
  });

  test("a grant change held at its file write while the offboarding completes deletes the file it wrote", async () => {
    const env = await twoHandles();
    const w = env.a.pause("write:before");
    const pending = env.plane.changeGrants(dana, OWN, { add: [toSam] }, AT);
    await w.arrived;
    await offboard(env.depsTheirs, hr, { person: "person:dana", roles: [] }, AT);
    w.release();
    expect((await pending).event.policy_id).toBe(GRANT_CONFLICT_ID);
    await nothingComesBack(env);
  });

  test("an owner's rewrite held at its file write while the offboarding completes deletes the file it wrote", async () => {
    const env = await twoHandles();
    const w = env.a.pause("write:before");
    const pending = env.plane.write(
      dana,
      { ...env.seeded, version: 2, grants: [toSam], store_ref: null } as MemoryItem,
      AT,
    );
    await w.arrived;
    await offboard(env.depsTheirs, hr, { person: "person:dana", roles: [] }, AT);
    w.release();
    const r = await pending;
    expect(r.event).toMatchObject({ decision: "deny", policy_id: WRITE_CONFLICT_ID });
    await nothingComesBack(env);
  });
});
