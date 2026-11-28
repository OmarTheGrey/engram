// The shared opener keeps the hash chain (card E1.6 review fix pass, E1.6-1,
// the lead's widening of the card to this package). A workspace opened as
// the pi package opens it (packages/pi-package/src/extension.ts: the default
// home log, a files store, requireStore) and one opened as the CLI opens it
// (connect.ts: --db, --store files, --root, --owner) write to one SQLite file,
// with an offboarding between them; the log verifies clean. `workspaceOf`,
// which the bench seams use over a log they opened, keeps no chain, so the
// registered runs and X15's query counts are unchanged. Since card E1.9 a
// served request's attestation (attest.ts, card E8.12) is chained with its
// event: an attestation edited afterwards fails the log's verification.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeAdapter } from "@engram/adapters";
import {
  type Actor,
  allEvents,
  keepsChain,
  loadPreset,
  type MemoryItem,
  migrate,
  offboard,
  openSqlite,
  verifyChain,
} from "@engram/core";
import { describe, expect, test } from "vitest";
import { attested } from "../src/attest.ts";
import { defaultDb, openWorkspace, workspaceOf } from "../src/workspace.ts";
import { id } from "./helpers.ts";

const AT = "2026-10-25T12:00:00.000Z";
const DANA: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana", "team:core"],
  source: "user",
};

const note = (n: number, scope: string, content: string): MemoryItem =>
  ({
    id: id(500 + n),
    class: "semantic",
    scope,
    owner: "person:dana",
    content,
    provenance: {
      kind: "user",
      ref: "doc/1",
      hash: `sha256:${"0".repeat(64)}`,
      actor: "person:dana",
    },
    confidence: 0.9,
    valid_from: AT,
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
  }) as MemoryItem;

describe("the shared opener keeps the chain", () => {
  test("a pi-package workspace and a CLI workspace on one log, an offboarding between them, verify clean", async () => {
    const home = mkdtempSync(join(tmpdir(), "engram-chain-home-"));
    const root = mkdtempSync(join(tmpdir(), "engram-chain-root-"));
    let n = 0;
    const newId = () => id(++n);
    // As packages/pi-package/src/extension.ts opens it.
    const pi = openWorkspace({
      cwd: root,
      home,
      env: {},
      newId,
      requireStore: true,
      root,
      owner: "dana",
    });
    // As the CLI opens it: the same default home log, named by --db.
    const cli = openWorkspace({
      db: defaultDb(home),
      store: "files",
      root,
      owner: "dana",
      cwd: root,
      home,
      env: {},
      newId,
    });
    try {
      expect(keepsChain(pi.open().db)).toBe(true);
      expect(keepsChain(cli.open().db)).toBe(true);
      const write = async (ws: typeof pi, m: number, scope: string, content: string) =>
        (await ws.plane.write(DANA, note(m, scope, content), AT)).event.decision;
      expect(await write(cli, 1, "person:dana", "a person note")).toBe("allow");
      expect(await write(pi, 2, "person:dana", "a note pi wrote")).toBe("allow");
      expect(await write(pi, 3, "team:core", "a team note")).toBe("allow");
      await cli.plane.read(DANA, { at: AT });
      const report = await offboard(
        cli.deps,
        DANA,
        { person: "person:dana", roles: [] },
        "2026-10-26T00:00:00.000Z",
      );
      expect(report.decision).toBe("allow");
      expect(report.erased.items.length).toBeGreaterThan(0);
      expect(await write(pi, 4, "team:core", "after the offboarding")).toBe("allow");
      expect(await write(cli, 5, "team:core", "and the CLI again")).toBe("allow");
      const r = verifyChain(cli.open().db);
      expect(r.first_break, JSON.stringify(r.first_break)).toBeNull();
      expect(r.counts.unchained).toBe(0);
      expect(r.counts.erased).toBeGreaterThan(0);
      expect(r.counts.manifests).toBe(1);
      expect(r.counts.events).toBe(allEvents(cli.open().db).length);
    } finally {
      pi.close();
      cli.close();
    }
  });

  test("workspaceOf keeps no chain: the bench seams' handles are unchanged", () => {
    const db = openSqlite(":memory:");
    migrate(db);
    const ws = workspaceOf({
      db,
      adapter: createFakeAdapter(),
      policy: loadPreset("medium"),
      newId: () => id(1),
    });
    expect(keepsChain(ws.deps.db)).toBe(false);
    expect(Number(db.prepare("SELECT count(*) AS n FROM chain").get()?.n)).toBe(0);
  });

  test("a served request's attestation is chained with its event, and an edit to it is caught", async () => {
    const home = mkdtempSync(join(tmpdir(), "engram-chain-home-"));
    const root = mkdtempSync(join(tmpdir(), "engram-chain-root-"));
    let n = 0;
    const ws = openWorkspace({
      db: defaultDb(home),
      store: "files",
      root,
      owner: "dana",
      cwd: root,
      home,
      env: {},
      newId: () => id(++n),
    });
    try {
      const served = await attested(
        { surface: "http", method: "api_key", actor: DANA.id, issuer: null, subject: "k1" },
        () => ws.plane.write(DANA, note(1, "person:dana", "a served note"), AT),
      );
      expect(served.event.decision).toBe("allow");
      await ws.plane.write(DANA, note(2, "person:dana", "an in-process note"), AT);
      const db = ws.open().db;
      const r = verifyChain(db);
      expect(r.first_break, JSON.stringify(r.first_break)).toBeNull();
      expect(r.version).toBe(2);
      expect(r.counts).toMatchObject({ attested: 1, attestations_uncovered: 0 });
      db.prepare("UPDATE event_attestations SET actor = 'person:mallory' WHERE seq = ?").run(
        served.event.seq,
      );
      expect(verifyChain(db).first_break).toMatchObject({
        check: "attestations",
        seq: served.event.seq,
      });
    } finally {
      ws.close();
    }
  });
});
