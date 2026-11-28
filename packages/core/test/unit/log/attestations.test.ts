// Attestations in the chain (card E1.9): from chain version 2, each event's
// attestation row (card E8.12's event_attestations, migration 6) is chained
// with its event, as a digest in its entry, in the transaction that appends
// it. An edited, deleted, added or moved row fails the `attestations` check;
// a chain begun under version 1 still verifies, is upgraded by one version
// entry at the next event a keeping handle appends, and states the rows its
// version 1 part leaves uncovered. On SQLite and on Postgres.
//
// The tamper cases (an edited field, a deleted row, a reorder) follow
// world-model-mcp's tamper matrix (MIT, SaravananJaichandar/world-model-mcp
// at c8be3765e87dfd1d69931e37622af048ba67fcb3,
// tests/test_v0130_tamper_evident_log.py), ported to the attestation rows.
import { describe, expect, test } from "vitest";
import type { Db } from "../../../src/db/db.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { appendEvent, type EventInput } from "../../../src/events.ts";
import {
  ATTESTATION_KEY,
  attestationDigest,
  CHAIN_SEED,
  CHAIN_VERSION,
  chainCanonical,
  chainLink,
  eventRecord,
  keepChain,
  leafHash,
} from "../../../src/log/chain.ts";
import { verifyChain } from "../../../src/log/verify.ts";
import { forEachBackend } from "../../db/backends.ts";
import {
  attestingHandle,
  bodyAt,
  forgeAppend,
  rehash,
  seededKeeper,
  type TestAttestation,
} from "../../helpers/chain.ts";
import { AT, id, item } from "../plane/helpers.ts";

let e = 0;
const event = (over: Partial<EventInput> = {}): EventInput => ({
  id: id(900_000 + ++e),
  ts: AT,
  op: "write",
  item_id: id(1),
  actor: "person:dana",
  scope_from: null,
  scope_to: "person:dana",
  decision: "allow",
  reason: "allowed",
  policy_id: "p/write",
  item: item(1, { scope: "person:dana", owner: "person:dana" }),
  schema_version: 1,
  ...over,
});
const read = () => event({ op: "read", item: null, item_id: null, item_ids: [] });

const KEY: TestAttestation = {
  surface: "http",
  method: "api_key",
  actor: "person:dana",
  issuer: null,
  subject: "k1",
};
const JWT: TestAttestation = {
  surface: "mcp_http",
  method: "jwt",
  actor: "person:dana",
  issuer: "https://issuer.example",
  subject: "dana",
};

const rowAt = (db: Db, seq: number) =>
  db
    .prepare(
      "SELECT seq, event_id, surface, method, actor, issuer, subject FROM event_attestations WHERE seq = ?",
    )
    .get(seq);

/** Rewrites the genesis as version 1 and recomputes every link: a log chained before this card. */
function asVersionOne(db: Db) {
  const g = JSON.parse(String(db.prepare("SELECT data FROM chain WHERE pos = 0").get()?.data));
  const text = chainCanonical({ ...g, version: 1 });
  db.prepare("UPDATE chain SET data = ?, hash = ? WHERE pos = 0").run(
    text,
    chainLink(CHAIN_SEED, leafHash(text)),
  );
  rehash(db, 1);
}

forEachBackend((backend) => {
  /** A chained log whose appends go through an attesting handle. */
  const open = () => {
    const raw = backend.open();
    migrate(raw);
    const db = attestingHandle(raw);
    keepChain(db, seededKeeper(11));
    return db;
  };
  /** Three events: attested by an API key, unattested, attested by a token. */
  const three = (db: ReturnType<typeof open>) => {
    db.next = KEY;
    const a = appendEvent(db, event());
    db.next = undefined;
    const b = appendEvent(db, read());
    db.next = JWT;
    const c = appendEvent(db, event());
    db.next = undefined;
    return [a, b, c] as const;
  };

  describe("attestations under chain version 2", () => {
    test("a new chain begins at version 2 and chains each attestation with its event", () => {
      expect(CHAIN_VERSION).toBe(2);
      const db = open();
      const [a, b, c] = three(db);
      const r = verifyChain(db);
      expect(r.first_break, JSON.stringify(r.first_break)).toBeNull();
      expect(r.version).toBe(2);
      expect(r.checks.map((x) => x.name)).toContain("attestations");
      expect(r.counts).toMatchObject({ events: 3, attested: 2, attestations_uncovered: 0 });
      // The digest is in the entry, beside the commitments, only where a row is.
      const data = (seq: number) =>
        JSON.parse(String(db.prepare("SELECT data FROM chain WHERE seq = ?").get(seq)?.data));
      expect(data(a.seq)[ATTESTATION_KEY]).toBe(attestationDigest(rowAt(db, a.seq) ?? {}));
      expect(data(b.seq)[ATTESTATION_KEY]).toBeUndefined();
      expect(data(c.seq)[ATTESTATION_KEY]).toMatch(/^sha256:[0-9a-f]{64}$/);
    });

    test("an edited attestation fails the attestations check, field by field", () => {
      for (const [column, value] of [
        ["actor", "person:mallory"],
        ["method", "insecure_loopback"],
        ["surface", "mcp_http"],
        ["subject", "k2"],
        ["issuer", "https://other.example"],
        ["event_id", id(1)],
      ] as const) {
        const db = open();
        const [a] = three(db);
        db.prepare(`UPDATE event_attestations SET ${column} = ? WHERE seq = ?`).run(value, a.seq);
        const r = verifyChain(db);
        expect(r.verdict, column).toBe("FAILED");
        expect(r.first_break, column).toMatchObject({ check: "attestations", seq: a.seq });
        expect(r.first_break?.detail, column).toMatch(/does not match the digest chained/);
      }
    });

    test("a deleted attestation fails the attestations check", () => {
      const db = open();
      const [, , c] = three(db);
      db.prepare("DELETE FROM event_attestations WHERE seq = ?").run(c.seq);
      const r = verifyChain(db);
      expect(r.first_break).toMatchObject({ check: "attestations", seq: c.seq });
      expect(r.first_break?.detail).toMatch(/row is gone/);
    });

    test("an attestation added to an event chained without one fails the attestations check", () => {
      const db = open();
      const [, b] = three(db);
      db.prepare(
        "INSERT INTO event_attestations (seq, event_id, surface, method, actor, issuer, subject) VALUES (?, ?, 'http', 'jwt', 'person:dana', 'i', 's')",
      ).run(b.seq, b.id);
      const r = verifyChain(db);
      expect(r.first_break).toMatchObject({ check: "attestations", seq: b.seq });
      expect(r.first_break?.detail).toMatch(/chained without one/);
    });

    test("two attestations swapped between their events fail the attestations check", () => {
      const db = open();
      const [a, , c] = three(db);
      const ra = rowAt(db, a.seq);
      const rc = rowAt(db, c.seq);
      db.prepare("DELETE FROM event_attestations").run();
      const put = db.prepare(
        "INSERT INTO event_attestations (seq, event_id, surface, method, actor, issuer, subject) VALUES (?, ?, ?, ?, ?, ?, ?)",
      );
      put.run(
        a.seq,
        a.id,
        String(rc?.surface),
        String(rc?.method),
        String(rc?.actor),
        rc?.issuer as string | null,
        rc?.subject as string | null,
      );
      put.run(
        c.seq,
        c.id,
        String(ra?.surface),
        String(ra?.method),
        String(ra?.actor),
        ra?.issuer as string | null,
        ra?.subject as string | null,
      );
      expect(verifyChain(db).first_break).toMatchObject({ check: "attestations", seq: a.seq });
    });

    test("a digest rewritten in the entry with the row breaks the links", () => {
      const db = open();
      const [a] = three(db);
      db.prepare("UPDATE event_attestations SET actor = 'person:mallory' WHERE seq = ?").run(a.seq);
      const row = db.prepare("SELECT data FROM chain WHERE seq = ?").get(a.seq);
      const given = JSON.parse(String(row?.data));
      given[ATTESTATION_KEY] = attestationDigest(rowAt(db, a.seq) ?? {});
      db.prepare("UPDATE chain SET data = ? WHERE seq = ?").run(chainCanonical(given), a.seq);
      expect(verifyChain(db).first_break).toMatchObject({ check: "links", seq: a.seq });
    });

    test("an attestation naming an event the log does not hold fails", () => {
      const db = open();
      three(db);
      // The foreign key to events refuses such a row; someone with database
      // access can turn it off on SQLite (Postgres needs a superuser's
      // replication role, not tried here).
      if (db.dialect !== "sqlite") return;
      db.exec("PRAGMA foreign_keys = OFF");
      db.prepare(
        "INSERT INTO event_attestations (seq, event_id, surface, method, actor, issuer, subject) VALUES (99, 'x', 'http', 'jwt', 'a', NULL, NULL)",
      ).run();
      expect(verifyChain(db).first_break).toMatchObject({ check: "attestations", seq: 99 });
    });
  });

  describe("a chain begun under version 1", () => {
    test("still verifies, states its uncovered rows, and is upgraded by one version entry at the next event", () => {
      const db = open();
      db.next = KEY;
      // The version 1 writer chained events without their attestations.
      const raw = appendEvent(db, read());
      db.next = undefined;
      asVersionOne(db);
      // Under version 1 the entry was the same record with no digest.
      const entry = db.prepare("SELECT data FROM chain WHERE seq = ?").get(raw.seq);
      const given = JSON.parse(String(entry?.data));
      delete given[ATTESTATION_KEY];
      db.prepare("UPDATE chain SET data = ? WHERE seq = ?").run(chainCanonical(given), raw.seq);
      rehash(db, 1);
      const old = verifyChain(db);
      expect(old.first_break, JSON.stringify(old.first_break)).toBeNull();
      expect(old.version).toBe(1);
      expect(old.counts).toMatchObject({ attested: 0, attestations_uncovered: 1 });
      expect(old.notes.join(" ")).toMatch(/1 attestation row .* nothing vouches/);
      // An edit to the uncovered row is not detected: version 1 never held it.
      db.prepare("UPDATE event_attestations SET actor = 'person:mallory' WHERE seq = ?").run(
        raw.seq,
      );
      expect(verifyChain(db).first_break).toBeNull();

      // A keeping handle's next event upgrades the chain, then chains its attestation.
      const keeper = attestingHandle(db);
      keepChain(keeper, seededKeeper(12));
      keeper.next = JWT;
      const next = appendEvent(keeper, event());
      const kinds = db.prepare("SELECT kind FROM chain ORDER BY pos").all();
      expect(kinds.map((k) => k.kind)).toEqual(["genesis", "event", "version", "event"]);
      const r = verifyChain(db);
      expect(r.first_break, JSON.stringify(r.first_break)).toBeNull();
      expect(r.version).toBe(2);
      expect(r.counts).toMatchObject({ entries: 4, events: 2, attested: 1 });
      expect(r.counts.attestations_uncovered).toBe(1);
      db.prepare("UPDATE event_attestations SET actor = 'person:mallory' WHERE seq = ?").run(
        next.seq,
      );
      expect(verifyChain(db).first_break).toMatchObject({ check: "attestations", seq: next.seq });
    });

    test("a version entry removed, repeated, skipping a version or carrying a digest under version 1 fails the links", () => {
      const v1 = () => {
        const db = open();
        appendEvent(db, read());
        asVersionOne(db);
        return db;
      };
      // Removed: the event after it was chained under version 2, so a digest no longer fits.
      const removed = v1();
      const keeper = attestingHandle(removed);
      keepChain(keeper, seededKeeper(13));
      keeper.next = KEY;
      appendEvent(keeper, event());
      removed.prepare("DELETE FROM chain WHERE kind = 'version'").run();
      removed.prepare("UPDATE chain SET pos = pos - 1 WHERE pos > 2").run();
      removed.prepare("UPDATE chain_head SET size = size - 1 WHERE id = 0").run();
      rehash(removed, 2);
      const r = verifyChain(removed);
      expect(r.first_break?.check).toBe("links");
      expect(r.first_break?.detail).toMatch(/digest under chain version 1/);

      const twice = v1();
      const v2 = chainCanonical({ kind: "version", version: 2 });
      forgeAppend(twice, "version", null, v2, v2);
      forgeAppend(twice, "version", null, v2, v2);
      expect(verifyChain(twice).first_break?.detail).toMatch(/not the next version/);

      const skip = v1();
      const v3 = chainCanonical({ kind: "version", version: 3 });
      forgeAppend(skip, "version", null, v3, v3);
      expect(verifyChain(skip).first_break?.detail).toMatch(/not the next version/);

      const spelled = v1();
      forgeAppend(spelled, "version", null, ` ${v2}`, ` ${v2}`);
      expect(verifyChain(spelled).first_break?.detail).toMatch(/version record is not one/);

      // A version 1 entry given a digest by hand, links recomputed.
      const forged = v1();
      const seq = Number(forged.prepare("SELECT seq FROM chain WHERE kind = 'event'").get()?.seq);
      const given = { [ATTESTATION_KEY]: `sha256:${"ab".repeat(32)}` };
      forged.prepare("UPDATE chain SET data = ? WHERE seq = ?").run(chainCanonical(given), seq);
      rehash(forged, 1);
      expect(eventRecord(bodyAt(forged, seq), given)).toContain(ATTESTATION_KEY);
      expect(verifyChain(forged).first_break?.detail).toMatch(/digest under chain version 1/);
    });
  });
});
