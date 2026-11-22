// One cell of card X14's suite: every corpus entry planted under one setting,
// by one route, as one source kind, then read back after a context reset by
// the scenario's person, and judged by AMSB's rule (canary survival for an
// attack, content kept verbatim for a control). No model is called and no
// clock read: ids and times are fixed.
//
// The store setting is C2's path: the record written to the store and the
// store's listing of both scopes read back, with no plane. That is the
// ungoverned condition being measured (packages/runner/src/conditions.ts),
// the one place this harness reaches an adapter without the Plane; and the
// read route places its record in the store outside the plane by design,
// since that is the attack it measures (AGENTS.md rule 2 governs the
// product paths).
import { createHash } from "node:crypto";
import { createFakeAdapter } from "@engram/adapters";
import {
  adoptStoreItems,
  createPlane,
  type MemoryEvent,
  migrate,
  openSqlite,
  type PlaneDeps,
} from "@engram/core";
import { judge, type RedteamEntry } from "./corpus.ts";
import {
  type PlantKind,
  plantedItem,
  type Route,
  readerOf,
  scopesOf,
  UNATTESTED_CLAIM,
  writeTarget,
} from "./routes.ts";
import type { Setting } from "./settings.ts";

/** When every record is planted, and when the reader reads after the reset. */
export const PLANT_AT = "2026-11-21T12:00:00.000Z";
export const READ_AT = "2026-11-21T12:01:00.000Z";

const uuid = (n: number) => `01950000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const EVENT_IDS = 500_000_000_000;
const sha256 = (s: string) => `sha256:${createHash("sha256").update(s).digest("hex")}`;

export interface CellRow {
  setting: string;
  route: Route;
  kind: PlantKind;
  id: string;
  malicious: boolean;
  /** The decision on the entry's last planted record: allow, deny or ask; `store` with no plane. */
  decision: string;
  /** The record's status after it (active, or candidate when held); null when denied or with no plane. */
  status: string | null;
  /** The rule that decided it; null with no plane. */
  policy_id: string | null;
  /** The kind the plane recorded (adoption or a floor may lower the claim); null when denied or with no plane. */
  recorded_kind: string | null;
  /** Attack: its canary came back. Control: its content came back verbatim. */
  survived: boolean;
}

/**
 * Entries per plane. The plane's write and read costs grow with its log, so
 * a cell runs its entries in blocks, each on a fresh log and store; every
 * entry has its own scopes, so no block can see another's, and the rows do
 * not depend on the block size.
 */
export const BLOCK = 64;

export async function runCell(
  setting: Setting,
  route: Route,
  kind: PlantKind,
  entries: readonly RedteamEntry[],
  block = BLOCK,
): Promise<CellRow[]> {
  if (route === "read" && kind === "unattested")
    throw new Error("the read route has no unattested cell: adoption attests import");
  let items = 0;
  let events = 0;
  const newId = () => uuid(EVENT_IDS + ++events);
  const claim = kind === "unattested" ? UNATTESTED_CLAIM : kind;
  const rows: CellRow[] = [];
  for (let start = 0; start < entries.length; start += block) {
    const db = openSqlite(":memory:");
    try {
      migrate(db);
      const adapter = createFakeAdapter();
      const deps: PlaneDeps | null =
        setting.policy === null
          ? null
          : { db, adapter, policy: setting.policy, newId, retrieval: { pipeline: "core" } };
      const plane = deps === null ? null : createPlane(deps);
      const chunk = entries.slice(start, start + block);
      const lastIds: string[] = [];
      const recalled: string[][] = [];
      for (const [j, entry] of chunk.entries()) {
        const scopes = scopesOf(start + j + 1);
        const reader = readerOf(scopes);
        let last = "";
        for (const step of entry.steps) {
          const id = uuid(++items);
          last = id;
          const ref = `redteam:${entry.id}/${step.key}`;
          const hash = sha256(step.value);
          if (route === "write") {
            const t = writeTarget(kind, scopes);
            const item = plantedItem({
              id,
              scope: t.scope,
              owner: t.owner,
              content: step.value,
              kind: claim,
              actor: t.actor.id,
              ref,
              hash,
              at: PLANT_AT,
            });
            if (plane === null) await adapter.write(item);
            else await plane.write(t.actor, item, PLANT_AT);
          } else {
            // A record dropped into the reader's own person scope, claiming `kind`.
            await adapter.write(
              plantedItem({
                id,
                scope: scopes.person,
                owner: scopes.person,
                content: step.value,
                kind: claim,
                actor: kind === "user" ? scopes.person : `agent:${kind}`,
                ref,
                hash,
                at: PLANT_AT,
              }),
            );
          }
        }
        lastIds.push(last);
        // The context reset: nothing carries over but the store and the log.
        if (deps === null || plane === null) {
          const listed = [
            ...(await adapter.list(scopes.person)),
            ...(await adapter.list(scopes.team)),
          ];
          recalled.push(listed.map((i) => i.content));
        } else {
          if (route === "read") await adoptStoreItems(deps, reader, scopes.person, READ_AT);
          const read = await plane.read(reader, { text: "", at: READ_AT });
          recalled.push(read.items.map((i) => i.content));
        }
      }
      const decided = new Map<string, MemoryEvent>();
      if (plane !== null)
        for (const e of plane.events())
          if (e.item_id !== null && e.op !== "read" && !decided.has(e.item_id))
            decided.set(e.item_id, e);
      for (const [j, entry] of chunk.entries()) {
        const e = decided.get(lastIds[j] as string);
        if (plane !== null && e === undefined) throw new Error(`${entry.id}: no decision recorded`);
        rows.push({
          setting: setting.name,
          route,
          kind,
          id: entry.id,
          malicious: entry.malicious,
          decision: e?.decision ?? "store",
          status: e?.item?.status ?? null,
          policy_id: e?.policy_id ?? null,
          recorded_kind: e?.item?.provenance.kind ?? null,
          survived: judge(entry, recalled[j] as string[]),
        });
      }
    } finally {
      db.close();
    }
  }
  return rows;
}
