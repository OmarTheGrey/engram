// The chain invariant (card E1.6, ADR 0038; the ninth, beside the lead's
// invariants file, which this file does not touch). Over random operations
// on the real Plane, on SQLite and on embedded Postgres, with an offboarding
// among them (writes by Dana and Lee in Dana's person scope, their shared
// role and a team, items citing each other by provenance ref, rewrites,
// reads, lints, an offboarding of Dana handing the role to Lee, and writes
// after it), the log verifies, an erasure included, and then each of these,
// injected one at a time and rolled back, is detected:
//
//   an edit of an event's body, a deleted event, two events reordered (their
//   bodies swapped, each rewritten to its new seq and columns), a truncated
//   tail (events, links and salts gone, the head left), the same with the
//   head rewritten to match, against a signed checkpoint the operator holds,
//   a rewritten reason, an edited lint evidence, an edited item field (the
//   owner), edited content, and a forged redaction (a part blanked and its
//   salt deleted, with no manifest naming it).
//
// Guards require the runs to reach an erasure that redacted an item event
// and a lint event about an item the offboarding did not erase, so the
// property cannot pass vacuously. A failure prints the seed and the case.
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { Actor } from "../../src/actor.ts";
import type { Db } from "../../src/db/db.ts";
import { migrate } from "../../src/db/migrate.ts";
import { allEvents } from "../../src/events.ts";
import { keepChain } from "../../src/log/chain.ts";
import { REDACTED, redacted, redactedLintReason } from "../../src/log/redact.ts";
import { type ChainReport, parseNote, verifyChain, writeCheckpoint } from "../../src/log/verify.ts";
import { createPlane, offboard } from "../../src/plane.ts";
import type { MemoryEvent, MemoryItem } from "../../src/schema.ts";
import { forEachBackend } from "../db/backends.ts";
import { seedFor } from "../generators.ts";
import { ed25519Check, fixedSigner, seededKeeper } from "../helpers/chain.ts";
import { AT, id, item, testPolicy } from "../unit/plane/helpers.ts";

const LATER = "2026-10-26T12:00:00Z";
const DANA: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana", "role:lead", "team:core"],
  source: "user",
};
const LEE: Actor = {
  id: "person:lee",
  level: "person",
  memberships: ["person:lee", "role:lead", "team:core"],
  source: "user",
};
const SCOPES = ["person:dana", "role:lead", "team:core", "person:lee"] as const;
const POOL = ["alpha note", "beta note", "gamma note", "delta note"] as const;
const LINTS = ["source-changed", "missing-provenance", "orphan", "duplicate"];
const LEAVE = { person: "person:dana", roles: [{ scope: "role:lead", successor: "person:lee" }] };

const arbOp = fc.oneof(
  {
    weight: 5,
    arbitrary: fc.record({
      op: fc.constant("write" as const),
      lee: fc.boolean(),
      scope: fc.constantFrom(...SCOPES),
      content: fc.constantFrom(...POOL),
      /** An earlier written item this one cites by provenance ref. */
      cites: fc.option(fc.nat(), { nil: undefined }),
      /** Rewrite an earlier item (a new version) instead of writing a new one. */
      rewrites: fc.option(fc.nat(), { nil: undefined }),
    }),
  },
  { weight: 1, arbitrary: fc.record({ op: fc.constant("read" as const), lee: fc.boolean() }) },
  {
    weight: 2,
    arbitrary: fc.record({ op: fc.constant("lint" as const), scope: fc.constantFrom(...SCOPES) }),
  },
);
type Op = typeof arbOp extends fc.Arbitrary<infer T> ? T : never;

const arbCase = fc.record({
  before: fc.array(arbOp, { minLength: 4, maxLength: 14 }),
  after: fc.array(arbOp, { maxLength: 4 }),
  /** Which tamper targets to pick, as fractions of the candidates. */
  pick: fc.array(fc.double({ min: 0, max: 0.999, noNaN: true }), { minLength: 8, maxLength: 8 }),
  tail: fc.integer({ min: 1, max: 3 }),
  salt: fc.nat(),
});
type Case = typeof arbCase extends fc.Arbitrary<infer T> ? T : never;

interface Seen {
  runs: number;
  erasedItemEvents: number;
  otherLintRedactions: number;
  detected: Record<string, number>;
}

async function run(db: Db, c: Case, seen: Seen) {
  migrate(db);
  keepChain(db, seededKeeper(c.salt));
  let n = 0;
  const deps = {
    db,
    adapter: createFakeAdapter(),
    policy: testPolicy({ lints: { enabled: LINTS, thresholds: {} } }),
    newId: () => id(800_000 + ++n),
  };
  const plane = createPlane(deps);
  const written: MemoryItem[] = [];
  let next = 1;
  const apply = async (op: Op, at: string, gone: Set<string>) => {
    const live = written.filter((w) => !gone.has(w.scope));
    if (op.op === "write") {
      const actor = op.lee ? LEE : DANA;
      const scope = op.scope === "person:dana" && op.lee ? "person:lee" : op.scope;
      const target = op.scope === "person:lee" && !op.lee ? "person:dana" : scope;
      if (gone.has(target)) return;
      const base =
        op.rewrites !== undefined && live.length > 0 ? live[op.rewrites % live.length] : undefined;
      const cited =
        op.cites !== undefined && written.length > 0
          ? written[op.cites % written.length]
          : undefined;
      const it =
        base && base.owner === actor.id
          ? ({
              ...base,
              content: op.content,
              version: base.version + 1,
              store_ref: null,
            } as MemoryItem)
          : item(next++, {
              scope: target,
              owner: actor.id,
              content: op.content,
              provenance: {
                kind: "user",
                ref: cited ? cited.id : "doc/1",
                hash: `sha256:${"ab".repeat(32)}`,
                actor: actor.id,
                ...(next % 3 === 0 ? { session_entry_id: `entry-${next}` } : {}),
              },
            });
      const result = await plane.write(actor, it, at);
      if (result.event.decision === "allow" && result.event.item) {
        const i = written.findIndex((w) => w.id === it.id);
        if (i >= 0) written[i] = result.event.item;
        else written.push(result.event.item);
      }
    } else if (op.op === "read") {
      await plane.read(op.lee ? LEE : DANA, { at });
    } else {
      await plane.lint(op.scope === "person:lee" ? LEE : DANA, at, op.scope);
    }
  };
  for (const op of c.before) await apply(op, AT, new Set());
  const before = allEvents(db);
  const report = await offboard(deps, DANA, LEAVE, LATER);
  expect(report.decision).toBe("allow");
  for (const op of c.after) await apply(op, LATER, new Set(["person:dana"]));
  // Every surviving scope linted once more, so each run holds salted lint events.
  for (const scope of SCOPES.filter((sc) => sc !== "person:dana"))
    await apply({ op: "lint", scope }, LATER, new Set(["person:dana"]));

  // What the offboarding redacted, for the guards.
  const erasedIds = new Set(report.erased.items);
  const now = new Map(allEvents(db).map((e) => [e.seq, e]));
  for (const e of before) {
    const after = now.get(e.seq) as MemoryEvent;
    if (JSON.stringify(after) === JSON.stringify(e)) continue;
    if (e.item) seen.erasedItemEvents++;
    if (e.op === "lint" && (e.item_id === null || !erasedIds.has(e.item_id)))
      seen.otherLintRedactions++;
  }

  const clean = verifyChain(db);
  expect(clean.first_break, JSON.stringify(clean.first_break)).toBeNull();
  expect(clean.verdict).toBe("UNSIGNED");
  const signer = fixedSigner();
  const held = writeCheckpoint(db, LATER, signer);
  const signed = verifyChain(db, { verify: ed25519Check, pin: signer.publicKey });
  expect(signed.verdict, JSON.stringify(signed.checks)).toBe("OK");
  seen.runs++;

  const tampers = tamperings(db, c, held);
  for (const [name, tamper] of tampers) {
    const outcome = attempt(db, () => {
      tamper();
      return verifyChain(db, {
        verify: ed25519Check,
        pin: signer.publicKey,
        held: name === "tail truncated, head rewritten" ? [held] : [],
      });
    });
    if (outcome === null) continue; // no candidate in this log
    expect(outcome.verdict, `${name}: ${JSON.stringify(outcome.checks)}`).toBe("FAILED");
    expect(outcome.first_break, name).not.toBeNull();
    seen.detected[name] = (seen.detected[name] ?? 0) + 1;
    // Rolled back: the log verifies again.
    expect(
      verifyChain(db, { verify: ed25519Check, pin: signer.publicKey }).verdict,
      `${name} rolled back`,
    ).toBe("OK");
  }
}

class Rollback extends Error {}

/** Runs `fn` in a transaction that is always rolled back; null when `fn` returns null. */
function attempt(db: Db, fn: () => ChainReport | null): ChainReport | null {
  let out: ChainReport | null = null;
  try {
    db.transaction(() => {
      out = fn();
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  return out;
}

const setBody = (db: Db, seq: number, event: MemoryEvent) =>
  db.prepare("UPDATE events SET body = ? WHERE seq = ?").run(JSON.stringify(event), seq);

/** Removes the explanation rows of the events `where` selects, as a tamperer must before deleting or renaming a read event. */
const unexplain = (db: Db, where: string, ...params: number[]) =>
  db
    .prepare(`DELETE FROM explanations WHERE read_id IN (SELECT id FROM events WHERE ${where})`)
    .run(...params);

/** Each tamper, as a function that changes the log in place; a missing candidate throws Skip. */
function tamperings(db: Db, c: Case, held: { size: number }): [string, () => void][] {
  const events = allEvents(db);
  const salted = new Set(
    db
      .prepare("SELECT seq FROM chain_salts")
      .all()
      .map((r) => Number(r.seq)),
  );
  const pick = <T>(xs: T[], k: number): T => {
    if (xs.length === 0) throw new Skip();
    return xs[Math.floor((c.pick[k] ?? 0) * xs.length)] as T;
  };
  const withItem = events.filter((e) => e.item && salted.has(e.seq));
  const lints = events.filter((e) => e.op === "lint" && salted.has(e.seq));
  const plain = events.filter((e) => e.op !== "lint");
  const out: [string, () => void][] = [
    [
      "an edited body",
      () => {
        const e = pick(events, 0);
        setBody(db, e.seq, { ...e, policy_id: `${e.policy_id}/edited` });
      },
    ],
    [
      "a deleted event",
      () => {
        const seq = pick(events, 1).seq;
        unexplain(db, "seq = ?", seq);
        db.prepare("DELETE FROM events WHERE seq = ?").run(seq);
      },
    ],
    [
      "two events reordered",
      () => {
        const a = pick(events.slice(0, -1), 2);
        const b = events[a.seq + 1] as MemoryEvent;
        const move = (e: MemoryEvent, seq: number) =>
          db
            .prepare(
              "UPDATE events SET id = ?, op = ?, item_id = ?, actor = ?, scope_from = ?, scope_to = ?, decision = ?, body = ? WHERE seq = ?",
            )
            .run(
              e.id,
              e.op,
              e.item_id,
              e.actor,
              e.scope_from,
              e.scope_to,
              e.decision,
              JSON.stringify({ ...e, seq }),
              seq,
            );
        // ids are unique: park both first.
        unexplain(db, "seq IN (?, ?)", a.seq, b.seq);
        db.prepare("UPDATE events SET id = ? WHERE seq = ?").run(`${a.id}-parked`, a.seq);
        db.prepare("UPDATE events SET id = ? WHERE seq = ?").run(`${b.id}-parked`, b.seq);
        move(b, a.seq);
        move(a, b.seq);
      },
    ],
    [
      "a truncated tail",
      () => {
        const last = (events.at(-1) as MemoryEvent).seq;
        const from = last - c.tail + 1;
        unexplain(db, "seq >= ?", from);
        db.prepare("DELETE FROM events WHERE seq >= ?").run(from);
        db.prepare("DELETE FROM chain_salts WHERE seq >= ?").run(from);
        db.prepare("DELETE FROM chain WHERE seq >= ?").run(from);
      },
    ],
    [
      "tail truncated, head rewritten",
      () => {
        // Back to an entry before the checkpoint the operator holds, head and all.
        const keep = Math.max(1, held.size - c.tail);
        const row = db.prepare("SELECT hash, seq FROM chain WHERE pos = ?").get(keep - 1);
        const lastSeq = db.prepare("SELECT max(seq) AS s FROM chain WHERE pos < ?").get(keep)?.s;
        const s = lastSeq === null || lastSeq === undefined ? -1 : Number(lastSeq);
        db.prepare("DELETE FROM chain WHERE pos >= ?").run(keep);
        unexplain(db, "seq > ?", s);
        db.prepare("DELETE FROM events WHERE seq > ?").run(s);
        db.prepare("DELETE FROM chain_salts WHERE seq > ?").run(s);
        db.prepare("DELETE FROM chain_checkpoints").run();
        db.prepare("UPDATE chain_head SET size = ?, hash = ?, seq = ? WHERE id = 0").run(
          keep,
          String(row?.hash),
          s,
        );
      },
    ],
    [
      "a rewritten reason",
      () => {
        const e = pick(plain, 3);
        setBody(db, e.seq, { ...e, reason: `${e.reason} (rewritten)` });
      },
    ],
    [
      "an edited lint evidence",
      () => {
        const e = pick(lints, 4);
        setBody(db, e.seq, { ...e, reason: `${e.reason} and more` });
      },
    ],
    [
      "an edited owner",
      () => {
        const e = pick(
          events.filter((x) => x.item),
          5,
        );
        setBody(db, e.seq, { ...e, item: { ...(e.item as MemoryItem), owner: "person:mallory" } });
      },
    ],
    [
      "edited content",
      () => {
        const e = pick(withItem, 6);
        setBody(db, e.seq, {
          ...e,
          item: { ...(e.item as MemoryItem), content: "forged" } as MemoryItem,
        });
      },
    ],
    [
      "a forged redaction",
      () => {
        const e = pick([...withItem, ...lints], 7);
        setBody(
          db,
          e.seq,
          e.op === "lint"
            ? { ...e, reason: redactedLintReason(e.reason) }
            : { ...e, item: redacted(e.item as MemoryItem) },
        );
        db.prepare("DELETE FROM chain_salts WHERE seq = ?").run(e.seq);
      },
    ],
  ];
  return out.map(([name, fn]) => [
    name,
    () => {
      try {
        fn();
      } catch (e) {
        if (e instanceof Skip) throw new SkipTamper();
        throw e;
      }
    },
  ]);
}

class Skip extends Error {}
class SkipTamper extends Rollback {}

forEachBackend((backend) => {
  const name = "every injected tamper is detected, and an offboarding's erasure still verifies";
  test(name, async () => {
    const seen: Seen = { runs: 0, erasedItemEvents: 0, otherLintRedactions: 0, detected: {} };
    await fc.assert(
      fc.asyncProperty(arbCase, async (c) => {
        const db = backend.open();
        try {
          await run(db, c, seen);
        } finally {
          db.close();
        }
      }),
      { numRuns: backend.runs(40), seed: seedFor(`${backend.name} ${name}`) },
    );
    // Not vacuous: erasures redacted item events and lint events about
    // items they did not erase, and every tamper was met and detected.
    expect(seen.erasedItemEvents).toBeGreaterThan(0);
    expect(seen.otherLintRedactions).toBeGreaterThan(0);
    for (const t of [
      "an edited body",
      "a deleted event",
      "two events reordered",
      "a truncated tail",
      "tail truncated, head rewritten",
      "a rewritten reason",
      "an edited lint evidence",
      "an edited owner",
      "edited content",
      "a forged redaction",
    ])
      expect(seen.detected[t] ?? 0, t).toBeGreaterThan(0);
  }, 240_000);
});

describe("the redaction marker", () => {
  test("is what offboarding writes", () => {
    expect(REDACTED).toBe("[erased]");
    expect(parseNote("not a note")).toBeNull();
  });
});
