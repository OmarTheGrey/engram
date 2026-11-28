// The signed audit report (card E9.15): a content-free in-toto Statement of a
// window of the log in a DSSE envelope. The acceptance: verify passes on a
// fixture log; a tampered statement and an edited log both fail. Around it:
// DSSE's own test vector, deterministic bytes for a given log, clock and key,
// no content or name in the bytes (AGENTS.md rule 12), a viewer's report
// counting only what the viewer may see (RD1), and the refusals.
import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import type { Actor } from "../../../src/actor.ts";
import {
  envelopeSignedBy,
  envelopeText,
  IN_TOTO_PAYLOAD_TYPE,
  pae,
  parseEnvelope,
  payloadBytes,
} from "../../../src/audit/dsse.ts";
import {
  AUDIT_PREDICATE_TYPE,
  type AuditStatement,
  auditStatement,
  STATEMENT_TYPE,
  signAuditStatement,
  statementBytes,
  verifyAuditReport,
} from "../../../src/audit/report.ts";
import type { Db } from "../../../src/db/db.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { dogfoodReport, parseEventRows } from "../../../src/dogfood.ts";
import { keepChain } from "../../../src/log/chain.ts";
import { writeCheckpoint } from "../../../src/log/verify.ts";
import { createPlane } from "../../../src/plane.ts";
import type { Policy } from "../../../src/schema.ts";
import { forEachBackend, sqliteBackend } from "../../db/backends.ts";
import {
  bodyAt,
  ed25519Check,
  fixedSigner,
  rehash,
  seededKeeper,
  setBodyAt,
} from "../../helpers/chain.ts";
import { id, item, testPolicy } from "../plane/helpers.ts";

const FROM = "2026-11-01T00:00:00Z";
const TO = "2026-11-02T00:00:00Z";
const ISSUED = "2026-11-03T08:00:00Z";
const CANARY = "CANARY-e915-7f3a";

const dana: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana", "team:platform"],
};
const omar: Actor = { id: "person:omar", level: "person", memberships: ["person:omar"] };
/** A viewer of the team only: none of dana's person scope. */
const teamViewer: Actor = { id: "team:platform", level: "team", memberships: ["team:platform"] };

const signer = fixedSigner();
const pinned = { verify: ed25519Check, pin: signer.key };

/** The fixture log: a chained log of writes, denials and a read, around and in the window, checkpointed and signed. */
async function fixtureLog(db: Db, policy: Policy = testPolicy()) {
  migrate(db);
  keepChain(db, seededKeeper(915));
  let n = 0;
  const plane = createPlane({
    db,
    adapter: createFakeAdapter(),
    policy,
    newId: () => id(915_000 + ++n),
  });
  const mine = (k: number, over = {}) =>
    item(k, { scope: "person:dana", owner: "person:dana", content: `${CANARY} ${k}`, ...over });
  await plane.write(dana, mine(1), "2026-10-31T23:00:00Z"); // before the window
  await plane.write(dana, mine(2), "2026-11-01T09:00:00Z");
  await plane.write(
    dana,
    item(3, { scope: "team:platform", owner: "person:dana", content: `${CANARY} team` }),
    "2026-11-01T10:00:00Z",
  );
  await plane.write(dana, mine(4, { confidence: 0.1 }), "2026-11-01T11:00:00Z"); // under the floor
  await plane.write(omar, mine(5), "2026-11-01T12:00:00Z"); // not a member
  await plane.read(dana, { at: "2026-11-01T13:00:00Z" });
  await plane.write(dana, mine(6), "2026-11-02T00:00:00Z"); // at `to`: outside
  writeCheckpoint(db, "2026-11-02T01:00:00Z", signer, pinned);
  return { plane, policy };
}

async function exported(db: Db, viewer?: Actor) {
  const { plane, policy } = await fixtureLog(db);
  const statement = auditStatement(db, {
    from: FROM,
    to: TO,
    at: ISSUED,
    policy,
    ...pinned,
    ...(viewer === undefined ? {} : { viewer }),
  });
  const envelope = signAuditStatement(statement, signer);
  return { plane, policy, statement, envelope, text: envelopeText(envelope) };
}

const fresh = () => sqliteBackend.open();
const reparse = (text: string) => JSON.parse(text) as unknown;

forEachBackend((backend) => {
  describe("the acceptance", () => {
    test("verify passes on a fixture log", async () => {
      const db = backend.open();
      const { policy, text } = await exported(db);
      const v = verifyAuditReport(db, reparse(text), { policy, ...pinned });
      expect(v.checks.map((c) => [c.name, c.ok])).toEqual([
        ["envelope", true],
        ["signature", true],
        ["statement", true],
        ["chain", true],
        ["head", true],
        ["checkpoint", true],
        ["counts", true],
      ]);
      expect(v.verdict).toBe("OK");
    });

    test("a tampered statement fails: its signature no longer verifies", async () => {
      const db = backend.open();
      const { policy, envelope } = await exported(db);
      const s = JSON.parse(payloadBytes(envelope).toString("utf8")) as AuditStatement;
      s.predicate.by_decision.allow = (s.predicate.by_decision.allow ?? 0) + 1;
      const tampered = { ...envelope, payload: statementBytes(s).toString("base64") };
      const v = verifyAuditReport(db, tampered, { policy, ...pinned });
      expect(v.verdict).toBe("FAILED");
      expect(v.checks.at(-1)).toMatchObject({ name: "signature", ok: false });
    });

    test("an edited log fails: the chain names the break", async () => {
      const db = backend.open();
      const { policy, text } = await exported(db);
      const seq = 3; // dana's denied write, in the window
      const body = bodyAt(db, seq);
      setBodyAt(db, seq, { ...body, decision: "allow" });
      db.prepare("UPDATE events SET decision = 'allow' WHERE seq = ?").run(seq);
      const v = verifyAuditReport(db, reparse(text), { policy, ...pinned });
      expect(v.verdict).toBe("FAILED");
      expect(v.checks.at(-1)).toMatchObject({ name: "chain", ok: false });
      expect(v.checks.at(-1)?.detail).toMatch(/does not verify/);
    });
  });
});

describe("a forger with database access and no key", () => {
  test("an edit rehashed through the chain fails at the stored checkpoint", async () => {
    const db = fresh();
    const { policy, text } = await exported(db);
    setBodyAt(db, 3, { ...bodyAt(db, 3), decision: "allow" });
    db.prepare("UPDATE events SET decision = 'allow' WHERE seq = 3").run();
    rehash(db, 1);
    const v = verifyAuditReport(db, reparse(text), { policy, ...pinned });
    expect(v.checks.at(-1)).toMatchObject({ name: "chain", ok: false });
    expect(v.checks.at(-1)?.detail).toMatch(/checkpoints/);
  });

  test("an edit rehashed with the checkpoints deleted fails at the report's head", async () => {
    const db = fresh();
    const { policy, text } = await exported(db);
    setBodyAt(db, 3, { ...bodyAt(db, 3), decision: "allow" });
    db.prepare("UPDATE events SET decision = 'allow' WHERE seq = 3").run();
    rehash(db, 1);
    db.prepare("DELETE FROM chain_checkpoints").run();
    const v = verifyAuditReport(db, reparse(text), { policy, ...pinned });
    expect(v.verdict).toBe("FAILED");
    expect(v.checks.at(-1)).toMatchObject({ name: "head", ok: false });
  });

  test("a statement re-signed under another key fails under the pinned one", async () => {
    const db = fresh();
    const { policy, statement } = await exported(db);
    const other = signAuditStatement(statement, fixedSigner("someone else"));
    const v = verifyAuditReport(db, reparse(envelopeText(other)), { policy, ...pinned });
    expect(v.checks.at(-1)).toMatchObject({ name: "signature", ok: false });
  });

  test("a false count signed with the operator's key still fails: the log says otherwise", async () => {
    const db = fresh();
    const { policy, statement } = await exported(db);
    const forged = structuredClone(statement);
    forged.predicate.by_decision.deny = 0;
    const v = verifyAuditReport(db, reparse(envelopeText(signAuditStatement(forged, signer))), {
      policy,
      ...pinned,
    });
    expect(v.checks.at(-1)).toMatchObject({ name: "counts", ok: false });
    expect(v.checks.at(-1)?.detail).toMatch(/by_decision/);
  });

  test("a cut tail fails: the report's head is beyond the chain", async () => {
    const db = fresh();
    const { policy, statement } = await exported(db);
    const beyond = structuredClone(statement);
    beyond.predicate.log.head.size += 5;
    const v = verifyAuditReport(db, reparse(envelopeText(signAuditStatement(beyond, signer))), {
      policy,
      ...pinned,
    });
    expect(v.checks.at(-1)).toMatchObject({ name: "head", ok: false });
  });
});

describe("the statement", () => {
  test("states the window's counts by decision, operation and rule, the head, the checkpoint and the oracle", async () => {
    const db = fresh();
    const { statement } = await exported(db);
    expect(statement._type).toBe(STATEMENT_TYPE);
    expect(statement.predicateType).toBe(AUDIT_PREDICATE_TYPE);
    const p = statement.predicate;
    expect(statement.subject).toEqual([
      { name: `engram.log/${p.log.id}`, digest: { sha256: p.log.head.hash } },
    ]);
    expect(p.window).toEqual({ from: FROM, to: TO });
    expect(p.events).toEqual({ counted: 5, first_seq: 1, last_seq: 5, unchained: 0 });
    expect(p.by_decision).toEqual({ allow: 3, deny: 2 });
    expect(p.by_op).toEqual({ read: { allow: 1 }, write: { allow: 2, deny: 2 } });
    // testPolicy's own ids are not on the fixed list, so they count as other.
    expect(p.by_rule).toEqual({
      "engram/write/membership": { deny: 1 },
      other: { allow: 3, deny: 1 },
    });
    expect(p.log.checkpoint).toMatchObject({ n: 0, size: p.log.head.size, signed: true });
    expect(p.log.checkpoint?.key).toBe(signer.key);
    expect(p.log.head_signed).toBe(true);
    expect(p.reach).toEqual({ whole_log: true });
    // dana read the team's item through a membership the oracle was not told
    // of: the log records none, so an undeclared reader is judged by its own
    // scope alone, and the read is counted (the note says so).
    expect(p.oracle).toEqual({ declared: 0, violations: { read: 1, grant_change: 0, total: 1 } });
    expect(p.notes.join(" ")).toMatch(/not declared/);
    expect(p.schema_version).toBe(1);
    expect(p.policy_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  test("with dana declared to the oracle, her read through the team is no violation, and verify needs the same declaration", async () => {
    const db = fresh();
    const { policy } = await fixtureLog(db);
    const s = auditStatement(db, {
      from: FROM,
      to: TO,
      at: ISSUED,
      policy,
      declared: [dana],
      ...pinned,
    });
    expect(s.predicate.oracle).toEqual({
      declared: 1,
      violations: { read: 0, grant_change: 0, total: 0 },
    });
    const text = envelopeText(signAuditStatement(s, signer));
    expect(
      verifyAuditReport(db, reparse(text), { policy, declared: [dana], ...pinned }).verdict,
    ).toBe("OK");
    const undeclared = verifyAuditReport(db, reparse(text), { policy, ...pinned });
    expect(undeclared.checks.at(-1)?.detail).toMatch(/oracle/);
  });

  test("the oracle's count is the dogfood report's over a window that holds the whole log", async () => {
    const db = fresh();
    const { policy } = await fixtureLog(db);
    // A read returning an item it may not: an injected violation the oracle names.
    const s = auditStatement(db, {
      from: "2026-01-01T00:00:00Z",
      to: "2027-01-01T00:00:00Z",
      at: ISSUED,
      policy,
    });
    const rows = db
      .prepare("SELECT seq, body FROM events ORDER BY seq")
      .all()
      .map((r) => ({ seq: r.seq, body: r.body }));
    const whole = dogfoodReport(parseEventRows(rows).events, policy, []).report;
    expect(s.predicate.oracle?.violations).toEqual(whole.violations);
    expect(s.predicate.events.counted).toBe(whole.events);
  });

  test("the same log, clock and key give the same bytes; another clock gives others", async () => {
    const [a, b] = [fresh(), fresh()];
    const first = (await exported(a)).text;
    const second = (await exported(b)).text;
    expect(second).toBe(first);
    const c = fresh();
    const { policy } = await fixtureLog(c);
    const later = envelopeText(
      signAuditStatement(
        auditStatement(c, { from: FROM, to: TO, at: "2026-11-04T08:00:00Z", policy, ...pinned }),
        signer,
      ),
    );
    expect(later).not.toBe(first);
  });

  test("holds no content, item id, actor, scope or reason (rule 12)", async () => {
    const db = fresh();
    const { text, envelope } = await exported(db);
    const payload = payloadBytes(envelope).toString("utf8");
    const events = parseEventRows(
      db
        .prepare("SELECT seq, body FROM events")
        .all()
        .map((r) => ({ seq: r.seq, body: r.body })),
    ).events;
    const forbidden = new Set<string>([CANARY, "person:dana", "person:omar", "team:platform"]);
    for (const e of events) {
      forbidden.add(e.id);
      if (e.item_id) forbidden.add(e.item_id);
      forbidden.add(e.reason);
      if (e.item) forbidden.add(e.item.content as string);
    }
    for (const f of forbidden) {
      expect(payload, f).not.toContain(f);
      expect(text, f).not.toContain(f);
    }
  });

  test("a later write leaves an earlier report verifying: only the events to its head are read", async () => {
    const db = fresh();
    const { plane, policy, text } = await exported(db);
    await plane.write(
      dana,
      item(7, { scope: "person:dana", owner: "person:dana" }),
      "2026-11-01T15:00:00Z",
    );
    const v = verifyAuditReport(db, reparse(text), { policy, ...pinned });
    expect(v.verdict).toBe("OK");
  });

  test("an export over a log that does not verify is refused", async () => {
    const db = fresh();
    const { policy } = await fixtureLog(db);
    db.prepare("DELETE FROM events WHERE seq = 2").run();
    expect(() => auditStatement(db, { from: FROM, to: TO, at: ISSUED, policy, ...pinned })).toThrow(
      /does not verify/,
    );
  });

  test("an empty or malformed window is refused", async () => {
    const db = fresh();
    const { policy } = await fixtureLog(db);
    expect(() => auditStatement(db, { from: TO, to: FROM, at: ISSUED, policy })).toThrow(/empty/);
    expect(() => auditStatement(db, { from: "yesterday", to: TO, at: ISSUED, policy })).toThrow(
      /not a UTC timestamp/,
    );
  });
});

describe("reach (RD1: never more than the reader may see)", () => {
  test("a viewer's report counts only the events it may see, names it by shape, and has no oracle", async () => {
    const db = fresh();
    const { statement, policy, text } = await exported(db, teamViewer);
    const p = statement.predicate;
    expect(p.reach).toEqual({
      whole_log: false,
      level: "team",
      memberships_by_level: { org: 0, person: 0, role: 0, team: 1 },
    });
    // Only the team write: dana's person scope, the read and omar's attempt are not the team's.
    expect(p.events.counted).toBe(1);
    expect(p.by_decision).toEqual({ allow: 1 });
    expect(p.oracle).toBeNull();
    expect(
      verifyAuditReport(db, reparse(text), { policy, viewer: teamViewer, ...pinned }).verdict,
    ).toBe("OK");
    // Checked as the operator's whole log, the same report differs in what it counts.
    const whole = verifyAuditReport(db, reparse(text), { policy, ...pinned });
    expect(whole.checks.at(-1)).toMatchObject({ name: "counts", ok: false });
    expect(whole.checks.at(-1)?.detail).toMatch(/reach/);
  });
});

describe("verification's other answers", () => {
  test("no pinned key: UNSIGNED, the signature unchecked", async () => {
    const db = fresh();
    const { policy, text } = await exported(db);
    const v = verifyAuditReport(db, reparse(text), { policy, verify: ed25519Check });
    expect(v.verdict).toBe("UNSIGNED");
    expect(v.checks.map((c) => c.name)).not.toContain("signature");
    expect(v.notes.join(" ")).toMatch(/UNSIGNED/);
  });

  test("another policy given to verify fails at counts, naming the policy's hash", async () => {
    const db = fresh();
    const { policy, text } = await exported(db);
    const other = { ...policy, id: "another" };
    const v = verifyAuditReport(db, reparse(text), { policy: other, ...pinned });
    expect(v.checks.at(-1)).toMatchObject({ name: "counts", ok: false });
    expect(v.checks.at(-1)?.detail).toMatch(/policy_sha256/);
  });

  test("not an envelope, or an envelope of another type, fails at envelope", () => {
    const db = fresh();
    migrate(db);
    const policy = testPolicy();
    expect(verifyAuditReport(db, [], { policy }).checks[0]).toMatchObject({
      name: "envelope",
      ok: false,
    });
    const other = { payload: "aGVsbG8=", payloadType: "text/plain", signatures: [{ sig: "AA==" }] };
    expect(verifyAuditReport(db, other, { policy }).checks[0]?.detail).toMatch(/payloadType/);
  });

  test("a payload not in the plane's canonical form fails at statement, even signed", async () => {
    const db = fresh();
    const { policy, statement } = await exported(db);
    const pretty = Buffer.from(JSON.stringify(statement, null, 1), "utf8");
    const env = {
      payload: pretty.toString("base64"),
      payloadType: IN_TOTO_PAYLOAD_TYPE,
      signatures: [{ keyid: signer.key, sig: signer.sign(pae(IN_TOTO_PAYLOAD_TYPE, pretty)) }],
    };
    const v = verifyAuditReport(db, env, { policy, ...pinned });
    expect(v.checks.at(-1)).toMatchObject({ name: "statement", ok: false });
  });
});

describe("DSSE (dsse-lf/dsse at 75a79b6ed61c, protocol.md's test vector)", () => {
  const body = Buffer.from("hello world", "utf8");
  const type = "http://example.com/HelloWorld";

  test("PAE", () => {
    expect(Buffer.from(pae(type, body)).toString("utf8")).toBe(
      "DSSEv1 29 http://example.com/HelloWorld 11 hello world",
    );
    // Lengths are of bytes, not characters.
    expect(Buffer.from(pae("t", Buffer.from("é", "utf8"))).toString("utf8")).toBe("DSSEv1 1 t 2 é");
  });

  test("the vector's ECDSA P-256 envelope verifies over PAE, and not over another body", () => {
    const toB64url = (dec: string) => {
      const hex = BigInt(dec).toString(16).padStart(64, "0");
      return Buffer.from(hex, "hex").toString("base64url");
    };
    const key = createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: toB64url(
          "46950820868899156662930047687818585632848591499744589407958293238635476079160",
        ),
        y: toB64url("5640078356564379163099075877009565129882514886557779369047442380624545832820"),
      },
      format: "jwk",
    });
    const envelope = parseEnvelope({
      payload: "aGVsbG8gd29ybGQ=",
      payloadType: type,
      signatures: [
        {
          sig: "A3JqsQGtVsJ2O2xqrI5IcnXip5GToJ3F+FnZ+O88SjtR6rDAajabZKciJTfUiHqJPcIAriEGAHTVeCUjW2JIZA==",
        },
      ],
    });
    if (typeof envelope === "string") throw new Error(envelope);
    const check = (message: Uint8Array, sig: string) =>
      cryptoVerify(
        "sha256",
        message,
        { key, dsaEncoding: "ieee-p1363" },
        Buffer.from(sig, "base64"),
      );
    expect(envelopeSignedBy(envelope, "vector", check)).toBe(true);
    expect(envelopeSignedBy({ ...envelope, payload: "aGVsbG8gd29ybGQh" }, "vector", check)).toBe(
      false,
    );
    expect(
      envelopeSignedBy({ ...envelope, payloadType: "http://example.com/Other" }, "vector", check),
    ).toBe(false);
  });

  test("URL-safe base64 is accepted, a non-canonical encoding is not", () => {
    const sig = { keyid: "k", sig: "AA" };
    expect(parseEnvelope({ payload: "aGk_", payloadType: "t", signatures: [sig] })).not.toBeTypeOf(
      "string",
    );
    expect(parseEnvelope({ payload: "aGk*", payloadType: "t", signatures: [sig] })).toBeTypeOf(
      "string",
    );
    expect(
      parseEnvelope({ payload: "aGVsbG8gd29ybGR=", payloadType: "t", signatures: [sig] }),
    ).toBeTypeOf("string");
  });
});

// The proof of concept (research/scripts/audit_report.py into
// research/results/h1-audit-report.json): every case above at once on the
// fixture log, each with the verdict and the check it fails at, written to
// ENGRAM_AUDIT_OUT/records.json when that folder is named.
type Exported = Awaited<ReturnType<typeof exported>>;
interface Case {
  name: string;
  expect: { verdict: string; failed: string | null };
  /** Changes the report or the log after the export; the envelope to verify and the options. */
  make: (
    db: Db,
    e: Exported,
  ) => Promise<{ envelope: unknown; options: Parameters<typeof verifyAuditReport>[2] }>;
}

const edit = (db: Db) => {
  setBodyAt(db, 3, { ...bodyAt(db, 3), decision: "allow" });
  db.prepare("UPDATE events SET decision = 'allow' WHERE seq = 3").run();
};
const resigned = (s: AuditStatement, change: (s: AuditStatement) => void, by = signer) => {
  const copy = structuredClone(s);
  change(copy);
  return reparse(envelopeText(signAuditStatement(copy, by)));
};
const asIs = (e: Exported) => ({
  envelope: reparse(e.text),
  options: { policy: e.policy, ...pinned },
});

const CASES: Case[] = [
  {
    name: "the fixture log, as exported",
    expect: { verdict: "OK", failed: null },
    make: async (_db, e) => asIs(e),
  },
  {
    name: "a later write after the export",
    expect: { verdict: "OK", failed: null },
    make: async (_db, e) => {
      await e.plane.write(
        dana,
        item(7, { scope: "person:dana", owner: "person:dana" }),
        "2026-11-01T15:00:00Z",
      );
      return asIs(e);
    },
  },
  {
    name: "a count in the statement changed, not re-signed",
    expect: { verdict: "FAILED", failed: "signature" },
    make: async (_db, e) => {
      const s = JSON.parse(payloadBytes(e.envelope).toString("utf8")) as AuditStatement;
      s.predicate.by_decision.allow = (s.predicate.by_decision.allow ?? 0) + 1;
      return {
        envelope: { ...e.envelope, payload: statementBytes(s).toString("base64") },
        options: { policy: e.policy, ...pinned },
      };
    },
  },
  {
    name: "the statement re-signed under another key",
    expect: { verdict: "FAILED", failed: "signature" },
    make: async (_db, e) => ({
      envelope: resigned(e.statement, () => {}, fixedSigner("someone else")),
      options: { policy: e.policy, ...pinned },
    }),
  },
  {
    name: "a false count signed with the operator's key",
    expect: { verdict: "FAILED", failed: "counts" },
    make: async (_db, e) => ({
      envelope: resigned(e.statement, (s) => {
        s.predicate.by_decision.deny = 0;
      }),
      options: { policy: e.policy, ...pinned },
    }),
  },
  {
    name: "a head beyond the chain, signed with the operator's key",
    expect: { verdict: "FAILED", failed: "head" },
    make: async (_db, e) => ({
      envelope: resigned(e.statement, (s) => {
        s.predicate.log.head.size += 5;
      }),
      options: { policy: e.policy, ...pinned },
    }),
  },
  {
    name: "an event edited in the log",
    expect: { verdict: "FAILED", failed: "chain" },
    make: async (db, e) => {
      edit(db);
      return asIs(e);
    },
  },
  {
    name: "an event edited and the chain rehashed",
    expect: { verdict: "FAILED", failed: "chain" },
    make: async (db, e) => {
      edit(db);
      rehash(db, 1);
      return asIs(e);
    },
  },
  {
    name: "an event edited, the chain rehashed and the checkpoints deleted",
    expect: { verdict: "FAILED", failed: "head" },
    make: async (db, e) => {
      edit(db);
      rehash(db, 1);
      db.prepare("DELETE FROM chain_checkpoints").run();
      return asIs(e);
    },
  },
  {
    name: "another policy given to verify",
    expect: { verdict: "FAILED", failed: "counts" },
    make: async (_db, e) => ({
      envelope: reparse(e.text),
      options: { policy: { ...e.policy, id: "another" }, ...pinned },
    }),
  },
  {
    name: "no public key pinned",
    expect: { verdict: "UNSIGNED", failed: null },
    make: async (_db, e) => ({
      envelope: reparse(e.text),
      options: { policy: e.policy, verify: ed25519Check },
    }),
  },
];

describe("the proof of concept", () => {
  test("every case gives its verdict and fails at its check, recorded when ENGRAM_AUDIT_OUT is set", async () => {
    const rows: Record<string, unknown>[] = [];
    let first: Exported | undefined;
    for (const c of CASES) {
      const db = fresh();
      const e = await exported(db);
      first ??= e;
      const { envelope, options } = await c.make(db, e);
      const v = verifyAuditReport(db, envelope, options);
      const failed = v.checks.find((k) => !k.ok)?.name ?? null;
      expect({ verdict: v.verdict, failed }, c.name).toEqual(c.expect);
      rows.push({
        case: c.name,
        expected: c.expect,
        verdict: v.verdict,
        failed_at: failed,
        checks_passed: v.checks.filter((k) => k.ok).length,
      });
    }
    const out = process.env.ENGRAM_AUDIT_OUT;
    if (out === undefined || out === "" || first === undefined) return;
    mkdirSync(out, { recursive: true });
    const p = first.statement.predicate;
    const record = {
      envelope_sha256: createHash("sha256").update(first.text).digest("hex"),
      envelope_bytes: Buffer.byteLength(first.text, "utf8"),
      statement: {
        events_counted: p.events.counted,
        by_decision: p.by_decision,
        by_rule: p.by_rule,
        head_size: p.log.head.size,
        head_signed: p.log.head_signed,
        oracle: p.oracle,
      },
      cases: rows,
    };
    writeFileSync(join(out, "records.json"), `${JSON.stringify(record, null, 2)}\n`);
  });
});
