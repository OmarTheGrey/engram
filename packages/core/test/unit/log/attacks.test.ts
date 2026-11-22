// The review's attacks on the chain (card E1.6 review fix pass, findings
// E1.6-2 to E1.6-7 and E1.6-10), ported from the reviewer's harness, each
// with the verdict and the check the fix pass requires. Each attack works as
// someone with database access and the code, but without the operator's key:
// rows edited, entries appended and hashes recomputed (forgeAppend, rehash).
import { createHash } from "node:crypto";
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import type { Actor } from "../../../src/actor.ts";
import type { Db } from "../../../src/db/db.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { allEvents, appendEvent, ERASURE_ID, type EventInput } from "../../../src/events.ts";
import {
  CHAIN_SEED,
  chainCanonical,
  chainLink,
  commitments,
  eventRecord,
  keepChain,
  leafHash,
  nodeHash,
  readHead,
} from "../../../src/log/chain.ts";
import { redacted, redactedLintReason } from "../../../src/log/redact.ts";
import {
  checkpointNote,
  parseNote,
  verifyChain,
  writeCheckpoint,
} from "../../../src/log/verify.ts";
import { createPlane, offboard } from "../../../src/plane.ts";
import type { MemoryEvent, MemoryItem } from "../../../src/schema.ts";
import { forEachBackend } from "../../db/backends.ts";
import { ed25519Check, fixedSigner, seededKeeper } from "../../helpers/chain.ts";
import { AT, id, item, testPolicy } from "../plane/helpers.ts";

let e = 0;
const event = (over: Partial<EventInput> = {}): EventInput => ({
  id: id(700_000 + ++e),
  ts: AT,
  op: "write",
  item_id: id(1),
  actor: "person:dana",
  scope_from: null,
  scope_to: "person:dana",
  decision: "allow",
  reason: "allowed",
  policy_id: "p/write",
  item: item(1, { scope: "person:dana", owner: "person:dana", content: "the secret" }),
  schema_version: 1,
  ...over,
});

/** Appends a chain entry as the writer does, with no key. */
function forgeAppend(db: Db, kind: string, seq: number | null, data: string, record: string) {
  const head = readHead(db) as { size: number; hash: string; seq: number };
  const hash = chainLink(head.hash, leafHash(record));
  db.prepare("INSERT INTO chain (pos, kind, seq, data, hash) VALUES (?, ?, ?, ?, ?)").run(
    head.size,
    kind,
    seq,
    data,
    hash,
  );
  db.prepare("UPDATE chain_head SET size = ?, hash = ?, seq = ? WHERE id = 0").run(
    head.size + 1,
    hash,
    seq ?? head.seq,
  );
}

/** Recomputes every chain hash from position `from` on, and the head: a rewrite with no key. */
function rehash(db: Db, from: number) {
  const rows = db.prepare("SELECT pos, kind, seq, data FROM chain ORDER BY pos").all();
  let prev = String(db.prepare("SELECT hash FROM chain WHERE pos = ?").get(from - 1)?.hash);
  for (const r of rows) {
    const pos = Number(r.pos);
    if (pos < from) continue;
    const record =
      r.kind === "event"
        ? eventRecord(body(db, Number(r.seq)), JSON.parse(String(r.data)))
        : String(r.data);
    prev = chainLink(prev, leafHash(record));
    db.prepare("UPDATE chain SET hash = ? WHERE pos = ?").run(prev, pos);
  }
  db.prepare("UPDATE chain_head SET hash = ? WHERE id = 0").run(prev);
}

const setBody = (db: Db, seq: number, ev: MemoryEvent) =>
  db.prepare("UPDATE events SET body = ? WHERE seq = ?").run(JSON.stringify(ev), seq);
const body = (db: Db, seq: number) =>
  JSON.parse(
    String(db.prepare("SELECT body FROM events WHERE seq = ?").get(seq)?.body),
  ) as MemoryEvent;
const manifest = (redactedSeqs: number[], erase: number[]) =>
  chainCanonical({ kind: "manifest", redacted: redactedSeqs, erase });

const DANA: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana"],
  source: "user",
};

describe("chain links have their own prefix (E1.6-10)", () => {
  test("a link is SHA-256(0x02 || previous || leaf), not an RFC 6962 interior node", () => {
    const a = "aa".repeat(32);
    const b = "bb".repeat(32);
    const expected = createHash("sha256")
      .update(Buffer.concat([Buffer.from([2]), Buffer.from(a, "hex"), Buffer.from(b, "hex")]))
      .digest("hex");
    expect(chainLink(a, b)).toBe(expected);
    expect(chainLink(a, b)).not.toBe(nodeHash(a, b));
  });
});

describe("the note parser is strict (E1.6-10)", () => {
  const root = "11".repeat(32);
  const head = "22".repeat(32);
  const note = checkpointNote("ab".repeat(32), 3, root, head, AT);
  test("accepts what checkpointNote writes", () => {
    expect(parseNote(note)).toMatchObject({ size: 3, root, head });
  });
  test("refuses a size with a leading zero", () => {
    expect(parseNote(note.replace("\n3\n", "\n03\n"))).toBeNull();
  });
  test("refuses non-canonical base64 and a hash of the wrong length", () => {
    const b64 = Buffer.from(root, "hex").toString("base64");
    // The last character's unused bits set: decodes to the same bytes, not canonical.
    const loose = `${b64.slice(0, -2)}${String.fromCharCode(b64.charCodeAt(b64.length - 2) + 1)}=`;
    expect(Buffer.from(loose, "base64").toString("hex")).toBe(root);
    expect(parseNote(note.replace(b64, loose))).toBeNull();
    expect(parseNote(note.replace(b64, Buffer.from("short").toString("base64")))).toBeNull();
  });
});

forEachBackend((backend) => {
  const open = () => {
    const db = backend.open();
    migrate(db);
    keepChain(db, seededKeeper(42));
    return db;
  };
  const signer = fixedSigner();
  const pinned = { verify: ed25519Check, pin: signer.publicKey };

  describe("manifests reusing a real erasure (E1.6-12)", () => {
    /** A real offboarding of Dana, and a lint event about a surviving team item. */
    async function offboarded() {
      const db = open();
      let n = 0;
      const deps = {
        db,
        adapter: createFakeAdapter(),
        policy: testPolicy({}),
        newId: () => id(994_000 + ++n),
      };
      await createPlane(deps).write(
        DANA,
        item(1, { scope: "person:dana", owner: "person:dana", content: "x" }),
        AT,
      );
      const lint = appendEvent(
        db,
        event({
          op: "lint",
          item_id: id(2),
          item: undefined,
          scope_to: "team:core",
          reason: "duplicate (info): two team notes hold one content; evidence: sha256:ab",
        }),
      );
      expect(
        (await offboard(deps, DANA, { person: "person:dana", roles: [] }, "2026-10-26T00:00:00Z"))
          .decision,
      ).toBe("allow");
      expect(verifyChain(db).first_break).toBeNull();
      const erase = allEvents(db).find((x) => x.policy_id === ERASURE_ID) as MemoryEvent;
      const real = String(db.prepare("SELECT data FROM chain WHERE kind = 'manifest'").get()?.data);
      return { db, lint, erase, real };
    }

    test("a surviving lint event's evidence blanked, its salt deleted, a manifest reusing the real erase event", async () => {
      const { db, lint, erase } = await offboarded();
      setBody(db, lint.seq, { ...lint, reason: redactedLintReason(lint.reason) });
      db.prepare("DELETE FROM chain_salts WHERE seq = ?").run(lint.seq);
      const m = manifest([lint.seq], [erase.seq]);
      forgeAppend(db, "manifest", null, m, m);
      const r = verifyChain(db, pinned);
      expect(r.verdict).toBe("FAILED");
      expect(r.first_break?.check).toBe("links");
      expect(r.first_break?.detail).toMatch(/not the entries chained just before it/);
      expect(() => writeCheckpoint(db, AT, signer, pinned)).toThrow(/does not verify/);
    });

    test("a duplicate of a real manifest", async () => {
      const { db, real } = await offboarded();
      forgeAppend(db, "manifest", null, real, real);
      const r = verifyChain(db);
      expect(r.verdict).toBe("FAILED");
      expect(r.first_break?.check).toBe("links");
    });

    test("an erase event named by a second manifest", async () => {
      const { db, erase } = await offboarded();
      const m = manifest([], [erase.seq]);
      forgeAppend(db, "manifest", null, m, m);
      const r = verifyChain(db);
      expect(r.first_break?.check).toBe("links");
    });
  });

  describe("forged redactions (E1.6-3)", () => {
    test("A1: a blanked event, its salt deleted and a manifest with no erase event appended", () => {
      const db = open();
      appendEvent(db, event());
      appendEvent(db, event());
      writeCheckpoint(db, AT, signer);
      const b = body(db, 0);
      setBody(db, 0, { ...b, item: redacted(b.item as MemoryItem) });
      db.prepare("DELETE FROM chain_salts WHERE seq = 0").run();
      const m = manifest([0], []);
      forgeAppend(db, "manifest", null, m, m);
      const r = verifyChain(db, pinned);
      expect(r.verdict).toBe("FAILED");
      expect(r.first_break?.check).toBe("links");
      expect(r.first_break?.detail).toMatch(/no erase event/);
      expect(() => writeCheckpoint(db, AT, signer)).toThrow(/does not verify/);
    });

    test("a manifest whose erase events erased another item does not cover this one", () => {
      const db = open();
      appendEvent(db, event());
      appendEvent(
        db,
        event({ item_id: id(2), item: item(2, { scope: "person:dana", owner: "person:dana" }) }),
      );
      const erase = appendEvent(
        db,
        event({
          op: "retire",
          item_id: id(2),
          item: undefined,
          scope_from: "person:dana",
          scope_to: null,
          policy_id: ERASURE_ID,
        }),
      );
      const b = body(db, 0);
      setBody(db, 0, { ...b, item: redacted(b.item as MemoryItem) });
      db.prepare("DELETE FROM chain_salts WHERE seq = 0").run();
      const m = manifest([0], [erase.seq]);
      forgeAppend(db, "manifest", null, m, m);
      const r = verifyChain(db);
      expect(r.first_break?.check).toBe("links");
      expect(r.first_break?.detail).toMatch(/not among .* erase events/);
    });

    test("a manifest placed before the events it names covers none of them", () => {
      const db = open();
      appendEvent(
        db,
        event({ item_id: id(2), item: item(2, { scope: "person:dana", owner: "person:dana" }) }),
      );
      const erase = appendEvent(
        db,
        event({
          op: "retire",
          item_id: id(1),
          item: undefined,
          scope_from: "person:dana",
          scope_to: null,
          policy_id: ERASURE_ID,
        }),
      );
      // Names seq 2 before it exists, with a valid erase event for item 1.
      const m = manifest([2], [erase.seq]);
      forgeAppend(db, "manifest", null, m, m);
      appendEvent(db, event());
      const b = body(db, 2);
      setBody(db, 2, { ...b, item: redacted(b.item as MemoryItem) });
      db.prepare("DELETE FROM chain_salts WHERE seq = 2").run();
      const r = verifyChain(db);
      expect(r.first_break).toMatchObject({ check: "commitments", seq: 2 });
      expect(r.first_break?.detail).toMatch(/no chained manifest names it/);
    });

    test("a manifest naming as an erase event what is not one", () => {
      const db = open();
      appendEvent(db, event());
      const m = manifest([], [0]);
      forgeAppend(db, "manifest", null, m, m);
      const r = verifyChain(db);
      expect(r.first_break).toMatchObject({ check: "links", seq: 0 });
      expect(r.first_break?.detail).toMatch(/as an erase event/);
    });

    test("A11: an erased event rewritten after its erasure", async () => {
      const db = open();
      let n = 0;
      const deps = {
        db,
        adapter: createFakeAdapter(),
        policy: testPolicy({}),
        newId: () => id(990_000 + ++n),
      };
      const plane = createPlane(deps);
      await plane.write(
        DANA,
        item(1, { scope: "person:dana", owner: "person:dana", content: "x" }),
        AT,
      );
      expect(
        (await offboard(deps, DANA, { person: "person:dana", roles: [] }, "2026-10-26T00:00:00Z"))
          .decision,
      ).toBe("allow");
      const ok = verifyChain(db);
      expect(ok.first_break).toBeNull();
      expect(ok.counts.erased).toBe(1);
      const seq = allEvents(db).find((x) => x.item?.content === "[erased]")?.seq as number;
      const b = body(db, seq);
      setBody(db, seq, {
        ...b,
        item: { ...(b.item as MemoryItem), content: "planted" } as MemoryItem,
      });
      const r = verifyChain(db);
      expect(r.first_break).toMatchObject({ check: "commitments", seq });
      expect(r.first_break?.detail).toMatch(/no longer hold the redaction marker/);
    });

    test("an erased event whose salt was kept, and a stray salt", async () => {
      const db = open();
      let n = 0;
      const deps = {
        db,
        adapter: createFakeAdapter(),
        policy: testPolicy({}),
        newId: () => id(993_000 + ++n),
      };
      await createPlane(deps).write(
        DANA,
        item(1, { scope: "person:dana", owner: "person:dana" }),
        AT,
      );
      await offboard(deps, DANA, { person: "person:dana", roles: [] }, "2026-10-26T00:00:00Z");
      db.prepare("INSERT INTO chain_salts (seq, salt) VALUES (0, ?)").run("00".repeat(32));
      expect(verifyChain(db).first_break?.detail).toMatch(/erased but its salt was kept/);
      db.prepare("DELETE FROM chain_salts WHERE seq = 0").run();
      db.prepare("INSERT INTO chain_salts (seq, salt) VALUES (999, ?)").run("00".repeat(32));
      expect(verifyChain(db).first_break?.detail).toMatch(/a salt is stored for seq 999/);
    });
  });

  describe("checkpoints (E1.6-2)", () => {
    test("A16: no checkpoint is signed over a history a stored checkpoint contradicts", () => {
      const db = open();
      appendEvent(db, event());
      appendEvent(db, event());
      writeCheckpoint(db, AT, signer);
      const b = body(db, 0);
      setBody(db, 0, { ...b, policy_id: "forged" });
      rehash(db, 1);
      expect(verifyChain(db, pinned).first_break?.check).toBe("checkpoints");
      expect(() => writeCheckpoint(db, "2026-10-25T14:00:00Z", signer, pinned)).toThrow(
        /does not verify/,
      );
    });

    test("A16b: with the old checkpoint row deleted, the held one refuses the signature", () => {
      const db = open();
      appendEvent(db, event());
      appendEvent(db, event());
      const held = writeCheckpoint(db, AT, signer);
      const b = body(db, 0);
      setBody(db, 0, { ...b, policy_id: "forged" });
      rehash(db, 1);
      db.prepare("DELETE FROM chain_checkpoints").run();
      expect(() =>
        writeCheckpoint(db, "2026-10-25T15:00:00Z", signer, { ...pinned, held: [held] }),
      ).toThrow(/does not verify/);
      expect(Number(db.prepare("SELECT count(*) AS n FROM chain_checkpoints").get()?.n)).toBe(0);
    });

    test("a signer whose key is not the pinned one is refused", () => {
      const db = open();
      appendEvent(db, event());
      expect(() => writeCheckpoint(db, AT, fixedSigner("mallory"), pinned)).toThrow(/pinned/);
    });

    test("a checkpoint's columns edited away from its note", () => {
      const db = open();
      appendEvent(db, event());
      writeCheckpoint(db, AT, signer);
      db.prepare("UPDATE chain_checkpoints SET at = '2026-10-25T13:00:00Z'").run();
      expect(verifyChain(db, pinned).first_break?.detail).toMatch(/columns differ from its note/);
    });

    test("head and genesis rewritten together: a signed checkpoint still holds the old log", () => {
      const db = open();
      appendEvent(db, event());
      writeCheckpoint(db, AT, signer);
      // A new genesis with another log id, and every link after it recomputed.
      const g = chainCanonical({ kind: "genesis", version: 1, log: "cd".repeat(32), start: 0 });
      db.prepare("UPDATE chain SET data = ?, hash = ? WHERE pos = 0").run(
        g,
        chainLink(CHAIN_SEED, leafHash(g)),
      );
      rehash(db, 1);
      const r = verifyChain(db, pinned);
      expect(r.first_break?.check).toBe("checkpoints");
      expect(r.first_break?.detail).toMatch(/not this log/);
      // With no checkpoint at all, the rebuilt chain is UNSIGNED, never OK.
      db.prepare("DELETE FROM chain_checkpoints").run();
      expect(verifyChain(db, pinned).verdict).toBe("UNSIGNED");
    });
  });

  describe("the verdict rule (E1.6-4): OK only when a pinned signed checkpoint covers the whole chain", () => {
    test("OK when it does", () => {
      const db = open();
      appendEvent(db, event());
      writeCheckpoint(db, AT, signer);
      expect(verifyChain(db, pinned).verdict).toBe("OK");
    });

    test("A2: an entry after the latest checkpoint, even a rewritten one, is UNSIGNED", () => {
      const db = open();
      appendEvent(db, event());
      writeCheckpoint(db, AT, signer);
      appendEvent(db, event());
      const b = body(db, 1);
      setBody(db, 1, { ...b, reason: "rewritten" });
      rehash(db, 2);
      const r = verifyChain(db, pinned);
      expect(r.verdict).toBe("UNSIGNED");
      expect(r.notes.join(" ")).toMatch(/1 chain entries after the latest signed checkpoint/);
    });

    test("A3: the newest checkpoint row deleted after an edit between the two is UNSIGNED", () => {
      const db = open();
      appendEvent(db, event());
      writeCheckpoint(db, AT, signer);
      appendEvent(db, event());
      appendEvent(db, event());
      writeCheckpoint(db, "2026-10-25T13:00:00Z", signer);
      const b = body(db, 1);
      setBody(db, 1, { ...b, policy_id: "forged" });
      rehash(db, 2);
      expect(verifyChain(db, pinned).verdict).toBe("FAILED");
      db.prepare("DELETE FROM chain_checkpoints WHERE n = 1").run();
      expect(verifyChain(db, pinned).verdict).toBe("UNSIGNED");
    });

    test("A4: a history re-signed with another key is UNSIGNED unpinned, FAILED pinned", () => {
      const db = open();
      appendEvent(db, event());
      writeCheckpoint(db, AT, signer);
      const b = body(db, 0);
      setBody(db, 0, { ...b, policy_id: "forged" });
      rehash(db, 1);
      db.prepare("DELETE FROM chain_checkpoints").run();
      writeCheckpoint(db, AT, fixedSigner("mallory"));
      const unpinned = verifyChain(db, { verify: ed25519Check });
      expect(unpinned.verdict).toBe("UNSIGNED");
      expect(unpinned.notes.join(" ")).toMatch(/no public key is pinned/);
      expect(verifyChain(db, pinned).verdict).toBe("FAILED");
    });

    test("no checkpoint at all is UNSIGNED, and the note says what that cannot detect (E1.6-7)", () => {
      const db = open();
      appendEvent(db, event());
      const r = verifyChain(db, pinned);
      expect(r.verdict).toBe("UNSIGNED");
      expect(r.notes.join(" ")).toMatch(/anyone with database access can cut the tail or rewrite/);
    });
  });

  describe("tampers each named by the check that catches them (E1.6-5)", () => {
    test("A5: a committed field edited with its commitment recomputed from the stored salt", () => {
      const db = open();
      appendEvent(db, event());
      appendEvent(db, event());
      const b = body(db, 0);
      const forged = {
        ...b,
        item: { ...(b.item as MemoryItem), content: "forged" },
      } as MemoryEvent;
      setBody(db, 0, forged);
      const salt = Buffer.from(
        String(db.prepare("SELECT salt FROM chain_salts WHERE seq = 0").get()?.salt),
        "hex",
      );
      db.prepare("UPDATE chain SET data = ? WHERE seq = 0").run(
        chainCanonical(commitments(forged, salt)),
      );
      expect(verifyChain(db).first_break).toMatchObject({ check: "links", pos: 1 });
      // Rehashed, with no checkpoint held: the honest limit, UNSIGNED (E1.6-7).
      rehash(db, 1);
      expect(verifyChain(db, pinned).verdict).toBe("UNSIGNED");
    });

    test("A6: every salt deleted", () => {
      const db = open();
      appendEvent(db, event());
      appendEvent(db, event());
      db.prepare("DELETE FROM chain_salts").run();
      expect(verifyChain(db).first_break).toMatchObject({ check: "commitments", seq: 0 });
    });

    test("A7: an unchained event inserted", () => {
      const db = open();
      appendEvent(db, event());
      const b = body(db, 0);
      db.prepare(
        "INSERT INTO events (seq, id, op, item_id, actor, scope_from, scope_to, decision, body) VALUES (1, 'x', ?, ?, ?, ?, ?, ?, ?)",
      ).run(
        b.op,
        b.item_id,
        b.actor,
        b.scope_from,
        b.scope_to,
        b.decision,
        JSON.stringify({ ...b, seq: 1, id: "x" }),
      );
      expect(verifyChain(db).first_break).toMatchObject({ check: "anchor", seq: 1 });
    });

    test("A13: a column-only edit", () => {
      const db = open();
      appendEvent(db, event());
      db.prepare("UPDATE events SET actor = 'person:mallory' WHERE seq = 0").run();
      const r = verifyChain(db);
      expect(r.first_break).toMatchObject({ check: "links", seq: 0 });
      expect(r.first_break?.detail).toMatch(/actor column/);
    });

    test("the head's last seq moved", () => {
      const db = open();
      appendEvent(db, event());
      db.prepare("UPDATE chain_head SET seq = 5 WHERE id = 0").run();
      expect(verifyChain(db).first_break?.check).toBe("anchor");
    });

    test("a genesis respelled non-canonically", () => {
      const db = open();
      const row = db.prepare("SELECT data FROM chain WHERE pos = 0").get();
      const loose = ` ${String(row?.data)}`;
      db.prepare("UPDATE chain SET data = ? WHERE pos = 0").run(loose);
      expect(verifyChain(db).first_break?.check).toBe("genesis");
    });
  });

  describe("crafted rows fail, never throw (E1.6-6)", () => {
    test("A10: a manifest whose erase list is a number", () => {
      const db = open();
      appendEvent(db, event());
      const m = '{"erase":5,"kind":"manifest","redacted":[]}';
      forgeAppend(db, "manifest", null, m, m);
      expect(verifyChain(db).first_break).toMatchObject({ check: "links", pos: 2 });
    });

    test("a manifest naming seqs that are not integers", () => {
      const db = open();
      appendEvent(db, event());
      const m = '{"erase":[],"kind":"manifest","redacted":["x"]}';
      forgeAppend(db, "manifest", null, m, m);
      expect(verifyChain(db).first_break).toMatchObject({ check: "links", pos: 2 });
    });

    test("an event body that is null, or an array", () => {
      const db = open();
      appendEvent(db, event());
      appendEvent(db, event());
      db.prepare("UPDATE events SET body = 'null' WHERE seq = 0").run();
      expect(verifyChain(db).first_break).toMatchObject({ check: "links", seq: 0 });
      db.prepare("UPDATE events SET body = '[]' WHERE seq = 0").run();
      expect(verifyChain(db).first_break).toMatchObject({ check: "links", seq: 0 });
    });

    test("commitments that are null, and a genesis that is null", () => {
      const db = open();
      appendEvent(db, event());
      db.prepare("UPDATE chain SET data = 'null' WHERE pos = 1").run();
      expect(verifyChain(db).first_break).toMatchObject({ check: "links", pos: 1 });
      db.prepare("UPDATE chain SET data = 'null' WHERE pos = 0").run();
      expect(verifyChain(db).first_break?.check).toBe("genesis");
    });

    test("a lint event whose reason is not a string", () => {
      const db = open();
      appendEvent(db, event({ op: "lint", item: undefined, reason: "orphan (warn): evidence" }));
      const b = body(db, 0);
      db.prepare("UPDATE events SET body = ? WHERE seq = 0").run(
        JSON.stringify({ ...b, reason: 7 }),
      );
      expect(verifyChain(db).verdict).toBe("FAILED");
      // and a lint redaction needs an erase event beside it
      const db2 = open();
      appendEvent(db2, event({ op: "lint", item: undefined, reason: "orphan (warn): evidence" }));
      const l = body(db2, 0);
      setBody(db2, 0, { ...l, reason: redactedLintReason(l.reason) });
      db2.prepare("DELETE FROM chain_salts WHERE seq = 0").run();
      const m = manifest([0], []);
      forgeAppend(db2, "manifest", null, m, m);
      expect(verifyChain(db2).first_break?.check).toBe("links");
    });
  });

  test("the reference: nodeHash stays RFC 6962's for the root", () => {
    expect(nodeHash("aa".repeat(32), "bb".repeat(32))).toBe(
      createHash("sha256")
        .update(Buffer.concat([Buffer.from([1]), Buffer.alloc(32, 0xaa), Buffer.alloc(32, 0xbb)]))
        .digest("hex"),
    );
  });
});
