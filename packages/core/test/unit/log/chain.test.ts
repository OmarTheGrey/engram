// The hash chain's parts (card E1.6, ADR 0038): the one canonical form, the
// RFC 6962 hashes and root, where the chain starts, a handle that keeps no
// chain, checkpoints signed and not, held checkpoints, and migration 5
// applied before or after a later migration (an attestation row added after
// its event was chained caught, card E1.9), on SQLite and on Postgres.
import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import type { Db } from "../../../src/db/db.ts";
import { MIGRATIONS, migrate } from "../../../src/db/migrate.ts";
import { appendEvent, type EventInput } from "../../../src/events.ts";
import {
  CHAIN_SEED,
  CHAIN_VERSION,
  chainCanonical,
  chainLink,
  keepChain,
  keepsChain,
  leafHash,
  nodeHash,
  readHead,
} from "../../../src/log/chain.ts";
import { EMPTY_ROOT, merkleRoot } from "../../../src/log/merkle.ts";
import { parseNote, VERDICT_EXIT, verifyChain, writeCheckpoint } from "../../../src/log/verify.ts";
import { forEachBackend } from "../../db/backends.ts";
import { ed25519Check, fixedSigner, seededKeeper } from "../../helpers/chain.ts";
import { AT, id, item } from "../plane/helpers.ts";

const sha = (...parts: Buffer[]) => createHash("sha256").update(Buffer.concat(parts)).digest("hex");

describe("the canonical form", () => {
  test("sorts keys at every level and drops undefined members", () => {
    expect(chainCanonical({ b: 1, a: { d: [2, { z: 1, y: null }], c: undefined } })).toBe(
      '{"a":{"d":[2,{"y":null,"z":1}]},"b":1}',
    );
  });
  test("writes every number one way, -0 as 0, and refuses what is not finite", () => {
    expect(chainCanonical([1.0, -0, 0.1, 1e21, 5e-7])).toBe("[1,0,0.1,1e+21,5e-7]");
    expect(() => chainCanonical({ x: Number.NaN })).toThrow(/not finite/);
    expect(() => chainCanonical({ x: Number.POSITIVE_INFINITY })).toThrow(/not finite/);
    expect(() => chainCanonical([undefined])).toThrow(/no canonical form/);
  });
  test("writes a timestamp field at nanosecond precision, and leaves other strings as they are", () => {
    expect(chainCanonical({ ts: "2026-10-25T12:00:00Z" })).toBe(
      chainCanonical({ ts: "2026-10-25T12:00:00.000Z" }),
    );
    expect(chainCanonical({ expires: "2026-10-25T12:00:00.5Z" })).toBe(
      '{"expires":"2026-10-25T12:00:00.500000000Z"}',
    );
    expect(chainCanonical({ content: "2026-10-25T12:00:00Z" })).not.toBe(
      chainCanonical({ content: "2026-10-25T12:00:00.000Z" }),
    );
    expect(chainCanonical({ ts: "not a time" })).toBe('{"ts":"not a time"}');
  });
});

describe("RFC 6962", () => {
  const leaf = (hex: string) => leafHash(Buffer.from(hex, "hex").toString("latin1"));
  test("the leaf and node hashes carry the 0x00 and 0x01 prefixes", () => {
    expect(leafHash("data")).toBe(sha(Buffer.from([0]), Buffer.from("data")));
    const l = "aa".repeat(32);
    const r = "bb".repeat(32);
    expect(nodeHash(l, r)).toBe(
      sha(Buffer.from([1]), Buffer.from(l, "hex"), Buffer.from(r, "hex")),
    );
    expect(nodeHash(l, r)).not.toBe(nodeHash(r, l));
  });
  test("the root of no leaves is SHA-256 of nothing; of one, the leaf; then split at a power of two", () => {
    expect(merkleRoot([])).toBe(EMPTY_ROOT);
    expect(EMPTY_ROOT).toBe(sha(Buffer.alloc(0)));
    const [a, b, c, d, e] = ["1", "2", "3", "4", "5"].map((x) => leafHash(x)) as string[];
    expect(merkleRoot([a as string])).toBe(a);
    expect(merkleRoot([a, b] as string[])).toBe(nodeHash(a as string, b as string));
    const ab = nodeHash(a as string, b as string);
    expect(merkleRoot([a, b, c] as string[])).toBe(nodeHash(ab, c as string));
    const abcd = nodeHash(ab, nodeHash(c as string, d as string));
    expect(merkleRoot([a, b, c, d, e] as string[])).toBe(nodeHash(abcd, e as string));
  });
  test("the Certificate Transparency test vector: eight leaves", () => {
    // RFC 6962's reference test data (the leaves of the CT and Trillian tests).
    const leaves = [
      "",
      "00",
      "10",
      "2021",
      "3031",
      "40414243",
      "5051525354555657",
      "606162636465666768696a6b6c6d6e6f",
    ].map((h) => sha(Buffer.from([0]), Buffer.from(h, "hex")));
    expect(leaves[0]).toBe("6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d");
    expect(merkleRoot(leaves)).toBe(
      "5dc9da79a70659a9ad559cb701ded9a2ab9d823aad2f4960cfe370eff4604328",
    );
    expect(leaf("00")).toBe(leaves[1]);
  });
});

let e = 0;
const event = (over: Partial<EventInput> = {}): EventInput => ({
  id: id(600_000 + ++e),
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

forEachBackend((backend) => {
  const open = () => {
    const db = backend.open();
    migrate(db);
    return db;
  };

  test("the chain starts at the next seq, and the events before it are counted as unchained", () => {
    const db = open();
    appendEvent(db, event());
    appendEvent(db, event({ op: "read", item: null, item_id: null, item_ids: [] }));
    expect(readHead(db)).toBeUndefined();
    const genesis = keepChain(db, seededKeeper(1));
    expect(genesis).toMatchObject({ kind: "genesis", version: CHAIN_VERSION, start: 2 });
    expect(keepChain(db, seededKeeper(2))).toEqual(genesis);
    appendEvent(db, event());
    const report = verifyChain(db);
    expect(report.first_break).toBeNull();
    expect(report.counts).toMatchObject({ entries: 2, events: 1, unchained: 2 });
    expect(report.verdict).toBe("UNSIGNED");
    expect(report.notes.join(" ")).toMatch(/2 events before seq 2 .* nothing vouches/);
    expect(report.notes.join(" ")).toMatch(/vouches for the log only/);
  });

  test("a handle that does not keep the chain writes no link, and its event is reported unchained", () => {
    const [a, b] = backend.pair();
    migrate(a);
    keepChain(a, seededKeeper(1));
    appendEvent(a, event());
    expect(keepsChain(b)).toBe(false);
    appendEvent(b, event());
    expect(readHead(a)?.seq).toBe(0);
    const report = verifyChain(a);
    expect(report.verdict).toBe("FAILED");
    expect(report.first_break).toMatchObject({ check: "anchor", seq: 1 });
    expect(report.first_break?.detail).toMatch(/not chained/);
  });

  test("an unchained log fails closed: no genesis is a broken link", () => {
    const db = open();
    appendEvent(db, event());
    expect(verifyChain(db).first_break).toMatchObject({ check: "genesis" });
  });

  test("a signed checkpoint verifies OK under the pinned key, and fails under any other", () => {
    const db = open();
    keepChain(db, seededKeeper(3));
    appendEvent(db, event());
    const signer = fixedSigner();
    const unsigned = writeCheckpoint(db, AT);
    expect(unsigned.signature).toBeNull();
    expect(verifyChain(db, { verify: ed25519Check }).verdict).toBe("UNSIGNED");
    const cp = writeCheckpoint(db, "2026-10-25T13:00:00Z", signer);
    expect(parseNote(cp.note)).toMatchObject({ size: 2, at: "2026-10-25T13:00:00Z" });
    expect(cp.note.split("\n")[0]).toMatch(/^engram\.log\/[0-9a-f]{64}$/);
    const ok = verifyChain(db, { verify: ed25519Check, pin: signer.publicKey });
    expect(ok.verdict).toBe("OK");
    expect(VERDICT_EXIT[ok.verdict]).toBe(0);
    // Unverifiable without a check: at best UNSIGNED.
    expect(verifyChain(db).verdict).toBe("UNSIGNED");
    expect(VERDICT_EXIT.UNSIGNED).toBe(3);
    const other = fixedSigner("someone else");
    expect(
      verifyChain(db, { verify: ed25519Check, pin: other.publicKey }).first_break?.detail,
    ).toMatch(/other than the pinned/);
    // A signature changed in the table.
    db.prepare("UPDATE chain_checkpoints SET signature = ? WHERE n = ?").run(
      other.sign(Buffer.from(cp.note)),
      cp.n,
    );
    expect(verifyChain(db, { verify: ed25519Check }).first_break?.detail).toMatch(
      /does not verify/,
    );
  });

  test("a checkpoint the operator holds detects a history rewritten with its head", () => {
    const db = open();
    keepChain(db, seededKeeper(4));
    appendEvent(db, event());
    appendEvent(db, event());
    const held = writeCheckpoint(db, AT, fixedSigner());
    // A rewriter with the code rebuilds the chain over an edited first event.
    const fresh = open();
    keepChain(fresh, seededKeeper(4));
    appendEvent(fresh, { ...event(), reason: "rewritten" });
    appendEvent(fresh, event());
    const report = verifyChain(fresh, { verify: ed25519Check, held: [held] });
    expect(report.first_break).toMatchObject({ check: "held" });
    // And the log it was taken from extends it.
    appendEvent(db, event());
    // It extends the held checkpoint; the new entry is covered by no signature yet.
    const extended = verifyChain(db, {
      verify: ed25519Check,
      pin: fixedSigner().publicKey,
      held: [held],
    });
    expect(extended.first_break).toBeNull();
    expect(extended.verdict).toBe("UNSIGNED");
  });

  test("no checkpoint is written over a chain that does not verify", () => {
    const db = open();
    keepChain(db, seededKeeper(5));
    appendEvent(db, event());
    db.prepare("UPDATE events SET body = replace(body, 'allowed', 'edited') WHERE seq = 0").run();
    expect(() => writeCheckpoint(db, AT)).toThrow(/does not verify/);
    expect(() => writeCheckpoint(db, "yesterday")).toThrow(/not a UTC timestamp/);
  });

  test("migration 5 applies after card E8.12's 6 already applied, and before it on a fresh log", () => {
    const later = backend.open();
    expect(
      migrate(
        later,
        MIGRATIONS.filter((m) => m.id !== 5),
      ),
    ).toEqual([1, 2, 3, 4, 6]);
    const first = appendEvent(later, event());
    const attest = (seq: number, id: string) =>
      later
        .prepare(
          "INSERT INTO event_attestations (seq, event_id, surface, method, actor, issuer, subject) VALUES (?, ?, 'http', 'api_key', 'person:dana', NULL, 'k1')",
        )
        .run(seq, id);
    attest(first.seq, first.id);
    expect(migrate(later)).toEqual([5]);
    keepChain(later, seededKeeper(6));
    appendEvent(later, event());
    const before = verifyChain(later);
    expect(before.first_break).toBeNull();
    expect(before.counts.unchained).toBe(1);
    // The row of the event before the chain began is counted, vouched for by nothing.
    expect(before.counts).toMatchObject({ attested: 0, attestations_uncovered: 1 });
    // Since card E1.9 the chain holds each event's attestation: a row added
    // after its event was chained (here, outside the append) is caught.
    const third = appendEvent(later, event());
    attest(third.seq, third.id);
    expect(verifyChain(later).first_break).toMatchObject({
      check: "attestations",
      seq: third.seq,
    });

    const fresh = backend.open();
    expect(migrate(fresh)).toEqual(MIGRATIONS.map((m) => m.id));
    keepChain(fresh, seededKeeper(6));
    appendEvent(fresh, event());
    expect(verifyChain(fresh).first_break).toBeNull();
    expect(migrate(fresh)).toEqual([]);
  });

  test("the genesis links from the chain's seed", () => {
    const db: Db = open();
    keepChain(db, seededKeeper(7));
    const row = db.prepare("SELECT data, hash FROM chain WHERE pos = 0").get();
    expect(String(row?.hash)).toBe(chainLink(CHAIN_SEED, leafHash(String(row?.data))));
  });
});
