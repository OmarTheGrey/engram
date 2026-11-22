// The chain invariant (card E1.6, ADR 0038; the ninth, beside the lead's
// invariants file, which this file does not touch). Over random operations
// on the real Plane, on SQLite and on embedded Postgres, with an offboarding
// among them (writes by Dana and Lee in Dana's person scope, their shared
// role and a team, items citing each other by provenance ref, rewrites,
// reads, lints, an offboarding of Dana handing the role to Lee, and writes
// after it), the log verifies, an erasure included (UNSIGNED, then OK under
// a signed checkpoint and the pinned key), and then each tamper in TAMPERS,
// injected one at a time and rolled back, is caught by the check it names
// (review fix pass, E1.6-5): edits, deletions, reorders and truncations of
// the log; rewritten reasons, owners, content and lint evidence; forged
// redactions, manifests, salts, commitments recomputed from the stored salt,
// columns edited alone; and forged genesis, head and checkpoint rows. Each
// tamper works with database access and the code but not the operator's key.
//
// Guards require the runs to reach an erasure that redacted an item event
// and a lint event about an item the offboarding did not erase, and every
// tamper, so the property cannot pass vacuously. A failure prints the seed
// and the case.
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { Actor } from "../../src/actor.ts";
import type { Db } from "../../src/db/db.ts";
import { migrate } from "../../src/db/migrate.ts";
import { allEvents, appendEvent, ERASURE_ID } from "../../src/events.ts";
import {
  CHAIN_SEED,
  chainCanonical,
  chainLink,
  commitments,
  type Genesis,
  keepChain,
  leafHash,
  readHead,
} from "../../src/log/chain.ts";
import { REDACTED, redacted, redactedLintReason } from "../../src/log/redact.ts";
import {
  type ChainReport,
  checkpointNote,
  parseNote,
  verifyChain,
  writeCheckpoint,
} from "../../src/log/verify.ts";
import { createPlane, offboard } from "../../src/plane.ts";
import type { MemoryEvent, MemoryItem } from "../../src/schema.ts";
import { forEachBackend } from "../db/backends.ts";
import { seedFor } from "../generators.ts";
import {
  ed25519Check,
  fixedSigner,
  forgeAppend,
  rehash,
  seededKeeper,
  setBodyAt,
} from "../helpers/chain.ts";
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
  // Every run holds the case the card names: a lint event about an item the
  // offboarding does not erase, whose evidence names one it does. Lee's team
  // note cites Dana's person note, which she then changes, so the
  // source-changed lint flags Lee's note naming hers.
  const source = item(900, { scope: "person:dana", owner: DANA.id, content: "a source" });
  await plane.write(DANA, source, AT);
  await plane.write(
    LEE,
    item(901, {
      scope: "team:core",
      owner: LEE.id,
      content: "cites the source",
      provenance: {
        kind: "user",
        ref: source.id,
        hash: `sha256:${"cd".repeat(32)}`,
        actor: LEE.id,
      },
    }),
    AT,
  );
  await plane.write(
    DANA,
    { ...source, content: "the source, changed", version: 2 } as MemoryItem,
    AT,
  );
  await plane.lint(DANA, AT, "team:core");
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
  for (const [name, expected, tamper] of tampers) {
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
    // The check that catches it, not only that something did (review fix pass, E1.6-5).
    expect(expected, `${name}: ${JSON.stringify(outcome.first_break)}`).toContain(
      outcome.first_break?.check,
    );
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

/** Removes the explanation rows of the events `where` selects, as a tamperer must before deleting or renaming a read event. */
const unexplain = (db: Db, where: string, ...params: number[]) =>
  db
    .prepare(`DELETE FROM explanations WHERE read_id IN (SELECT id FROM events WHERE ${where})`)
    .run(...params);

type Tamper = [name: string, caughtBy: string[], fn: () => void];

/**
 * Each tamper, with the checks that may catch it first, as a function that
 * changes the log in place; a missing candidate throws Skip.
 */
function tamperings(db: Db, c: Case, held: { size: number }): Tamper[] {
  const events = allEvents(db);
  const salted = new Set(
    db
      .prepare("SELECT seq FROM chain_salts")
      .all()
      .map((r) => Number(r.seq)),
  );
  const pick = <T>(xs: T[], k: number): T => {
    if (xs.length === 0) throw new Skip();
    return xs[Math.floor((c.pick[k % c.pick.length] ?? 0) * xs.length)] as T;
  };
  const withItem = events.filter((e) => e.item && salted.has(e.seq));
  const lints = events.filter((e) => e.op === "lint" && salted.has(e.seq));
  const plain = events.filter((e) => e.op !== "lint");
  const erases = events.filter(
    (e) => e.op === "retire" && e.decision === "allow" && e.policy_id === ERASURE_ID,
  );
  const erasedItemEvents = events.filter(
    (e) => e.item && !salted.has(e.seq) && e.item.content === REDACTED,
  );
  const erasedLints = events.filter(
    (e) => e.op === "lint" && !salted.has(e.seq) && redactedLintReason(e.reason) === e.reason,
  );
  const notErase = events.filter((e) => !erases.includes(e));
  const genesis = JSON.parse(
    String(db.prepare("SELECT data FROM chain WHERE pos = 0").get()?.data),
  ) as Genesis;
  const head = readHead(db) as { size: number; hash: string; seq: number };
  const out: Tamper[] = [
    [
      "an edited body",
      ["links"],
      () => {
        const e = pick(events, 0);
        setBodyAt(db, e.seq, { ...e, policy_id: `${e.policy_id}/edited` });
      },
    ],
    [
      "a deleted event",
      ["links"],
      () => {
        const seq = pick(events, 1).seq;
        unexplain(db, "seq = ?", seq);
        db.prepare("DELETE FROM events WHERE seq = ?").run(seq);
      },
    ],
    [
      "two events reordered",
      ["links"],
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
      // Events, their links and salts gone, the head left: the anchor, or a
      // position gap when a manifest followed them.
      "a truncated tail",
      ["anchor", "links"],
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
      // Cut back before the checkpoint the operator holds, head and stored
      // checkpoints rewritten: the held checkpoint, or the commitments when
      // the cut took the manifest of an erasure it kept.
      "tail truncated, head rewritten",
      ["held", "commitments"],
      () => {
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
      ["links"],
      () => {
        const e = pick(plain, 3);
        setBodyAt(db, e.seq, { ...e, reason: `${e.reason} (rewritten)` });
      },
    ],
    [
      "an edited lint evidence",
      ["commitments"],
      () => {
        const e = pick(lints, 4);
        setBodyAt(db, e.seq, { ...e, reason: `${e.reason} and more` });
      },
    ],
    [
      "an edited owner",
      ["links"],
      () => {
        const e = pick(
          events.filter((x) => x.item),
          5,
        );
        setBodyAt(db, e.seq, {
          ...e,
          item: { ...(e.item as MemoryItem), owner: "person:mallory" },
        });
      },
    ],
    [
      "edited content",
      ["commitments"],
      () => {
        const e = pick(withItem, 6);
        setBodyAt(db, e.seq, {
          ...e,
          item: { ...(e.item as MemoryItem), content: "forged" } as MemoryItem,
        });
      },
    ],
    [
      "a forged redaction",
      ["commitments"],
      () => {
        const e = pick([...withItem, ...lints], 7);
        setBodyAt(
          db,
          e.seq,
          e.op === "lint"
            ? { ...e, reason: redactedLintReason(e.reason) }
            : { ...e, item: redacted(e.item as MemoryItem) },
        );
        db.prepare("DELETE FROM chain_salts WHERE seq = ?").run(e.seq);
      },
    ],
    [
      "a commitment recomputed from the stored salt",
      ["links"],
      () => {
        const e = pick(withItem, 0);
        const forged = {
          ...e,
          item: { ...(e.item as MemoryItem), content: "forged" },
        } as MemoryEvent;
        setBodyAt(db, e.seq, forged);
        const salt = String(
          db.prepare("SELECT salt FROM chain_salts WHERE seq = ?").get(e.seq)?.salt,
        );
        db.prepare("UPDATE chain SET data = ? WHERE seq = ?").run(
          chainCanonical(commitments(forged, Buffer.from(salt, "hex"))),
          e.seq,
        );
      },
    ],
    [
      "every salt deleted",
      ["commitments"],
      () => {
        if (salted.size === 0) throw new Skip();
        db.prepare("DELETE FROM chain_salts").run();
      },
    ],
    [
      "a column-only edit",
      ["links"],
      () => {
        const e = pick(events, 1);
        db.prepare("UPDATE events SET actor = 'person:mallory' WHERE seq = ?").run(e.seq);
      },
    ],
    [
      "an erased event rewritten after its erasure",
      ["commitments"],
      () => {
        const e = pick(erasedItemEvents, 2);
        setBodyAt(db, e.seq, {
          ...e,
          item: { ...(e.item as MemoryItem), content: "planted" } as MemoryItem,
        });
      },
    ],
    [
      "an erased lint event rewritten after its erasure",
      ["commitments"],
      () => {
        const e = pick(erasedLints, 1);
        setBodyAt(db, e.seq, {
          ...e,
          reason: `${e.reason.replace(REDACTED, "")}the evidence, back`,
        });
      },
    ],
    [
      "a salt kept for an erased event",
      ["commitments"],
      () => {
        const e = pick(erasedItemEvents, 3);
        db.prepare("INSERT INTO chain_salts (seq, salt) VALUES (?, ?)").run(e.seq, "00".repeat(32));
      },
    ],
    [
      "a stray salt",
      ["commitments"],
      () =>
        db
          .prepare("INSERT INTO chain_salts (seq, salt) VALUES (?, ?)")
          .run(head.seq + 1000, "00".repeat(32)),
    ],
    [
      "a forged manifest",
      ["links"],
      () => {
        const e = pick(withItem, 4);
        setBodyAt(db, e.seq, { ...e, item: redacted(e.item as MemoryItem) });
        db.prepare("DELETE FROM chain_salts WHERE seq = ?").run(e.seq);
        // With an erase event of another item when there is one, else none.
        const erase = erases.length > 0 ? [pick(erases, 5).seq] : [];
        const m = chainCanonical({ kind: "manifest", redacted: [e.seq], erase });
        forgeAppend(db, "manifest", null, m, m);
      },
    ],
    [
      "a manifest naming as an erase event what is not one",
      ["links"],
      () => {
        const m = chainCanonical({
          kind: "manifest",
          redacted: [],
          erase: [pick(notErase, 6).seq],
        });
        forgeAppend(db, "manifest", null, m, m);
      },
    ],
    [
      "a manifest placed before the event it names",
      ["commitments"],
      () => {
        const erase = pick(erases, 7);
        const m = chainCanonical({
          kind: "manifest",
          redacted: [head.seq + 1],
          erase: [erase.seq],
        });
        forgeAppend(db, "manifest", null, m, m);
        const it = item(9, {
          id: erase.item_id as string,
          scope: "person:dana",
          owner: "person:dana",
        });
        const later = appendEvent(db, {
          id: id(990_001),
          ts: LATER,
          op: "write",
          item_id: it.id,
          actor: "person:dana",
          scope_from: null,
          scope_to: "person:dana",
          decision: "allow",
          reason: "after the manifest",
          policy_id: "p/write",
          item: it,
          schema_version: 1,
        });
        setBodyAt(db, later.seq, { ...later, item: redacted(it) });
        db.prepare("DELETE FROM chain_salts WHERE seq = ?").run(later.seq);
      },
    ],
    [
      "head and genesis rewritten together",
      ["checkpoints"],
      () => {
        const g = chainCanonical({ ...genesis, log: "cd".repeat(32) });
        db.prepare("UPDATE chain SET data = ?, hash = ? WHERE pos = 0").run(
          g,
          chainLink(CHAIN_SEED, leafHash(g)),
        );
        rehash(db, 1);
      },
    ],
    [
      "a head whose last seq moved",
      ["anchor"],
      () => db.prepare("UPDATE chain_head SET seq = seq + 1 WHERE id = 0").run(),
    ],
    [
      "a genesis respelled",
      ["genesis"],
      () =>
        db
          .prepare("UPDATE chain SET data = ? WHERE pos = 0")
          .run(` ${String(db.prepare("SELECT data FROM chain WHERE pos = 0").get()?.data)}`),
    ],
    [
      "a checkpoint's columns edited away from its note",
      ["checkpoints"],
      () => db.prepare("UPDATE chain_checkpoints SET at = ?").run("2026-10-27T00:00:00Z"),
    ],
    [
      "a stored checkpoint with a forged root",
      ["checkpoints"],
      () => insertCheckpoint(db, genesis.log, head.size, "ee".repeat(32), head.hash),
    ],
    [
      "a stored checkpoint with a forged head",
      ["checkpoints"],
      () => {
        const real = String(
          db.prepare("SELECT root FROM chain_checkpoints ORDER BY n DESC LIMIT 1").get()?.root,
        );
        insertCheckpoint(db, genesis.log, head.size, real, "ee".repeat(32));
      },
    ],
  ];
  return out.map(([name, caught, fn]) => [
    name,
    caught,
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

/** An unsigned checkpoint row whose columns agree with its note, as a forger writes it. */
function insertCheckpoint(db: Db, log: string, size: number, root: string, headHash: string) {
  const at = "2026-10-27T00:00:00Z";
  db.prepare(
    "INSERT INTO chain_checkpoints (n, size, root, head, at, note, key, signature) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)",
  ).run(99, size, root, headHash, at, checkpointNote(log, size, root, headHash, at));
}

class Skip extends Error {}
class SkipTamper extends Rollback {}

/** Every tamper the property must meet and catch. */
const TAMPERS = [
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
  "a commitment recomputed from the stored salt",
  "every salt deleted",
  "a column-only edit",
  "an erased event rewritten after its erasure",
  "an erased lint event rewritten after its erasure",
  "a salt kept for an erased event",
  "a stray salt",
  "a forged manifest",
  "a manifest naming as an erase event what is not one",
  "a manifest placed before the event it names",
  "head and genesis rewritten together",
  "a head whose last seq moved",
  "a genesis respelled",
  "a checkpoint's columns edited away from its note",
  "a stored checkpoint with a forged root",
  "a stored checkpoint with a forged head",
];

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
    // items they did not erase, and every tamper was met and caught.
    expect(seen.erasedItemEvents).toBeGreaterThan(0);
    expect(seen.otherLintRedactions).toBeGreaterThan(0);
    for (const t of TAMPERS) expect(seen.detected[t] ?? 0, t).toBeGreaterThan(0);
  }, 240_000);
});

describe("the redaction marker", () => {
  test("is what offboarding writes", () => {
    expect(REDACTED).toBe("[erased]");
    expect(parseNote("not a note")).toBeNull();
  });
});
