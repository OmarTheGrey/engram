// `engram audit export` and `engram audit verify` (card E9.15) on a fixture
// log: the synthetic Claude Code memory folder read through the plane by its
// owner, checkpointed with an operator key. The export is signed and
// verifies OK under the pinned public key (exit 0); the same log, clock and
// key give the same bytes; a tampered report and an edited log both fail
// (exit 1) with the check named; no key pinned is UNSIGNED (exit 3); the
// report holds no content or name (rule 12).
import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openSqlite } from "@engram/core";
import { describe, expect, it } from "vitest";
import { cli, fixtureCopy, NOW, readArgs, tempDir } from "./helpers.ts";

/** An Ed25519 key pair in PEM files, from a fixed seed (no randomness in the test). */
function keys(dir: string, seed: string) {
  const raw = createHash("sha256").update(seed).digest();
  const der = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), raw]);
  const privateKey = createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  const priv = join(dir, `${seed}.key.pem`);
  const pub = join(dir, `${seed}.pub.pem`);
  writeFileSync(priv, privateKey.export({ type: "pkcs8", format: "pem" }));
  writeFileSync(pub, createPublicKey(privateKey).export({ type: "spki", format: "pem" }));
  return { priv, pub };
}

const WINDOW = ["--from", "2026-10-25T00:00:00Z", "--to", "2026-10-26T00:00:00Z"];

async function exported() {
  const dir = await tempDir();
  const db = join(dir, "engram.db");
  const folder = await fixtureCopy();
  const r = await cli(readArgs(db, folder));
  expect(r.code, r.err).toBe(0);
  const { priv, pub } = keys(dir, "operator");
  expect((await cli(["log", "checkpoint", "--db", db, "--key", priv])).code).toBe(0);
  const out = join(dir, "report.json");
  const e = await cli(["audit", "export", "--db", db, ...WINDOW, "--key", priv, "--out", out]);
  expect(e.code, e.err).toBe(0);
  return { dir, db, folder, priv, pub, out, exportOut: e.out };
}

describe("engram audit export and verify", () => {
  it("exports a signed report that verifies OK under the pinned key, exit 0", async () => {
    const { db, pub, out, exportOut } = await exported();
    expect(exportOut).toMatch(/^engram audit export: written to .*report\.json, signed\n/);
    expect(exportOut).toMatch(/checkpoint 0 at \d+ entries, signed, at the head/);
    // No actor declared: no oracle count is signed (review of E9.15, finding 1).
    expect(exportOut).toMatch(/oracle: not counted, no actor declared/);
    const envelope = JSON.parse(readFileSync(out, "utf8"));
    expect(envelope.payloadType).toBe("application/vnd.in-toto+json");
    const statement = JSON.parse(Buffer.from(envelope.payload, "base64").toString("utf8"));
    expect(statement.predicate.issued_at).toBe(NOW);
    expect(statement.predicate.events.counted).toBeGreaterThan(0);
    const r = await cli(["audit", "verify", "--db", db, "--report", out, "--key", pub]);
    expect(r.code, r.out + r.err).toBe(0);
    expect(r.out).toMatch(/^engram audit verify: OK\n/);
    for (const check of [
      "envelope",
      "signature",
      "statement",
      "chain",
      "head",
      "checkpoint",
      "counts",
    ])
      expect(r.out).toMatch(new RegExp(`ok {4}${check}`));
    const json = JSON.parse(
      (await cli(["audit", "verify", "--db", db, "--report", out, "--key", pub, "--json"])).out,
    );
    expect(json.verdict).toBe("OK");
  });

  it("prints the same bytes for the same log, clock and key", async () => {
    const { db, priv, out } = await exported();
    const again = await cli(["audit", "export", "--db", db, ...WINDOW, "--key", priv]);
    expect(again.code, again.err).toBe(0);
    expect(again.out).toBe(readFileSync(out, "utf8"));
  });

  it("holds no memory content, path or name of the fixture (rule 12)", async () => {
    const { db, out } = await exported();
    const envelope = JSON.parse(readFileSync(out, "utf8"));
    const payload = Buffer.from(envelope.payload, "base64").toString("utf8");
    const log = openSqlite(db);
    const rows = log.prepare("SELECT body FROM events").all();
    log.close();
    for (const row of rows) {
      const e = JSON.parse(String(row.body));
      for (const value of [e.id, e.actor, e.reason, e.item_id, e.scope_to, e.item?.content])
        if (typeof value === "string" && value !== "") expect(payload, value).not.toContain(value);
    }
  });

  it("fails a tampered report at its signature, exit 1", async () => {
    const { db, pub, out } = await exported();
    const envelope = JSON.parse(readFileSync(out, "utf8"));
    const statement = JSON.parse(Buffer.from(envelope.payload, "base64").toString("utf8"));
    statement.predicate.by_decision.deny = 99;
    envelope.payload = Buffer.from(JSON.stringify(statement), "utf8").toString("base64");
    writeFileSync(out, JSON.stringify(envelope));
    const r = await cli(["audit", "verify", "--db", db, "--report", out, "--key", pub]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/^engram audit verify: FAILED\n/);
    expect(r.out).toMatch(/fail {2}signature: no signature of the envelope verifies/);
  });

  it("fails an edited log at the chain, exit 1", async () => {
    const { db, pub, out } = await exported();
    const log = openSqlite(db);
    log
      .prepare(
        'UPDATE events SET body = replace(body, \'"decision":"allow"\', \'"decision":"deny"\') WHERE seq = 1',
      )
      .run();
    log.close();
    const r = await cli(["audit", "verify", "--db", db, "--report", out, "--key", pub]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/fail {2}chain: the log does not verify/);
  });

  it("is UNSIGNED with no key pinned (exit 3), and FAILED under another key", async () => {
    const { dir, db, out } = await exported();
    const r = await cli(["audit", "verify", "--db", db, "--report", out]);
    expect(r.code).toBe(3);
    expect(r.out).toMatch(/^engram audit verify: UNSIGNED\n/);
    const other = keys(dir, "someone-else");
    const wrong = await cli(["audit", "verify", "--db", db, "--report", out, "--key", other.pub]);
    expect(wrong.code).toBe(1);
  });

  it("counts for a viewer given with --as, and verifies only as that viewer", async () => {
    const { dir, db, priv, pub } = await exported();
    const out = join(dir, "viewer.json");
    const viewer = ["--as", "team:platform", "--member", "team:platform"];
    const e = await cli([
      "audit",
      "export",
      "--db",
      db,
      ...WINDOW,
      "--key",
      priv,
      "--out",
      out,
      ...viewer,
    ]);
    expect(e.code, e.err).toBe(0);
    expect(e.out).toMatch(/reach: a team viewer/);
    expect(e.out).toMatch(/oracle: not judged for a viewer/);
    const ok = await cli(["audit", "verify", "--db", db, "--report", out, "--key", pub, ...viewer]);
    expect(ok.code, ok.out).toBe(0);
    const whole = await cli(["audit", "verify", "--db", db, "--report", out, "--key", pub]);
    expect(whole.code).toBe(1);
    expect(whole.out).toMatch(/fail {2}counts: .*reach/);
  });

  it("counts the oracle for the actors --declare names, and verify needs the same file", async () => {
    const { dir, db, priv, pub } = await exported();
    const declare = join(dir, "actors.json");
    writeFileSync(
      declare,
      JSON.stringify([{ id: "person:dana", level: "person", memberships: ["person:dana"] }]),
    );
    const out = join(dir, "declared.json");
    const e = await cli([
      "audit",
      "export",
      "--db",
      db,
      ...WINDOW,
      "--key",
      priv,
      "--out",
      out,
      "--declare",
      declare,
    ]);
    expect(e.code, e.err).toBe(0);
    expect(e.out).toMatch(
      /oracle: 0 violations \(read 0, grant change 0\), 1 actors declared, set sha256 [0-9a-f]{64}/,
    );
    const args = ["audit", "verify", "--db", db, "--report", out, "--key", pub];
    expect((await cli([...args, "--declare", declare])).code).toBe(0);
    const undeclared = await cli(args);
    expect(undeclared.code).toBe(1);
    expect(undeclared.out).toMatch(/fail {2}counts: .*oracle/);
    const bad = join(dir, "bad.json");
    writeFileSync(bad, JSON.stringify([{ id: "person:dana" }]));
    expect((await cli([...args, "--declare", bad])).code).toBe(2);
  });

  it("checks the log against a checkpoint held outside it (--checkpoint)", async () => {
    const { dir, db, priv, pub, out } = await exported();
    const held = join(dir, "held.json");
    expect((await cli(["log", "checkpoint", "--db", db, "--key", priv, "--out", held])).code).toBe(
      0,
    );
    const args = ["audit", "verify", "--db", db, "--report", out, "--key", pub];
    expect((await cli([...args, "--checkpoint", held])).code).toBe(0);
    // Another log in the report's place, its checkpoint held: the report's log does not extend it.
    const other = join(dir, "other.db");
    expect((await cli([...readArgs(other, await fixtureCopy()), "query that differs"])).code).toBe(
      0,
    );
    const theirs = join(dir, "theirs.json");
    expect(
      (await cli(["log", "checkpoint", "--db", other, "--key", priv, "--out", theirs])).code,
    ).toBe(0);
    const r = await cli([...args, "--checkpoint", theirs]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/fail {2}chain: .*held/);
  });

  it("refuses a missing log, missing flags and an unknown subcommand, exit 2", async () => {
    const dir = await tempDir();
    const { priv } = keys(dir, "operator");
    const none = await cli([
      "audit",
      "export",
      "--db",
      join(dir, "none.db"),
      ...WINDOW,
      "--key",
      priv,
    ]);
    expect(none.code).toBe(1);
    expect(none.err).toMatch(/no event log/);
    expect((await cli(["audit", "export", ...WINDOW])).code).toBe(2);
    expect((await cli(["audit", "export", "--key", priv])).code).toBe(2);
    expect((await cli(["audit", "verify"])).code).toBe(2);
    expect((await cli(["audit", "nonsense"])).code).toBe(2);
    expect(
      (await cli(["audit", "export", "--member", "team:x", ...WINDOW, "--key", priv])).code,
    ).toBe(2);
  });
});
