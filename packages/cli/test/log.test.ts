// `engram log verify` and `engram log checkpoint` (card E1.6) on a fixture
// log: the synthetic Claude Code memory folder read through the plane by its
// owner, so the CLI's handle keeps the chain from the first event. Unsigned,
// it verifies UNSIGNED (exit 3); with a checkpoint signed by an operator key
// and the public key pinned, OK (exit 0); an edited event body, FAILED
// (exit 1) with the first broken link named; a history rebuilt over an edited
// event fails against the checkpoint the operator kept.
import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import { copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openSqlite } from "@engram/core";
import { describe, expect, it } from "vitest";
import { cli, fixtureCopy, readArgs, tempDir } from "./helpers.ts";

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

async function fixtureLog() {
  const dir = await tempDir();
  const db = join(dir, "engram.db");
  const r = await cli(readArgs(db, await fixtureCopy()));
  expect(r.code, r.err).toBe(0);
  return { dir, db };
}

describe("engram log verify", () => {
  it("verifies a fixture log UNSIGNED with no checkpoint, exit 3", async () => {
    const { db } = await fixtureLog();
    const r = await cli(["log", "verify", "--db", db]);
    expect(r.code, r.err).toBe(3);
    expect(r.out).toMatch(/^engram log verify: UNSIGNED\n/);
    expect(r.out).toMatch(/ok {4}links/);
    expect(r.out).toMatch(/0 unchained/);
    expect(r.out).toMatch(/note: no checkpoint/);
    const json = JSON.parse((await cli(["log", "verify", "--db", db, "--json"])).out);
    expect(json.verdict).toBe("UNSIGNED");
    expect(json.counts.events).toBeGreaterThan(4);
  });

  it("verifies OK against a signed checkpoint and the pinned key, exit 0", async () => {
    const { dir, db } = await fixtureLog();
    const { priv, pub } = keys(dir, "operator");
    const out = join(dir, "checkpoint.json");
    const c = await cli(["log", "checkpoint", "--db", db, "--key", priv, "--out", out]);
    expect(c.code, c.err).toBe(0);
    expect(c.out).toMatch(/checkpoint 0 of .* signed, kept in/);
    const r = await cli(["log", "verify", "--db", db, "--key", pub, "--checkpoint", out]);
    expect(r.code, r.out + r.err).toBe(0);
    expect(r.out).toMatch(/^engram log verify: OK\n/);
    // Another key pinned: refused.
    const other = keys(dir, "someone-else");
    const wrong = await cli(["log", "verify", "--db", db, "--key", other.pub]);
    expect(wrong.code).toBe(1);
    expect(wrong.out).toMatch(/other than the pinned one/);
  });

  it("names the first broken link of an edited event, exit 1", async () => {
    const { db } = await fixtureLog();
    const log = openSqlite(db);
    log
      .prepare(
        'UPDATE events SET body = replace(body, \'"decision":"allow"\', \'"decision":"deny"\') WHERE seq = 1',
      )
      .run();
    log.close();
    const r = await cli(["log", "verify", "--db", db]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/^engram log verify: FAILED\n/);
    expect(r.out).toMatch(/first broken link: links, chain position 2, event seq 1/);
  });

  it("detects a rebuilt history against the checkpoint the operator kept", async () => {
    const { dir, db } = await fixtureLog();
    const out = join(dir, "checkpoint.json");
    expect((await cli(["log", "checkpoint", "--db", db, "--out", out])).code).toBe(0);
    // Another log in its place: the same commands, the chain rebuilt from nothing.
    const other = join(dir, "other.db");
    expect((await cli([...readArgs(other, await fixtureCopy()), "query that differs"])).code).toBe(
      0,
    );
    copyFileSync(other, db);
    const r = await cli(["log", "verify", "--db", db, "--checkpoint", out]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/fail {2}held: .* is of log [0-9a-f]+, not this log/);
  });

  it("refuses a missing log, bad flags and an unknown subcommand", async () => {
    const dir = await tempDir();
    expect((await cli(["log", "verify", "--db", join(dir, "none.db")])).err).toMatch(
      /no event log/,
    );
    expect((await cli(["log", "frobnicate"])).code).toBe(2);
    const { db } = await fixtureLog();
    const bad = join(dir, "not-a-key.pem");
    writeFileSync(bad, "not a key");
    expect((await cli(["log", "checkpoint", "--db", db, "--key", bad])).code).toBe(2);
    expect((await cli(["log", "verify", "--db", db, "--checkpoint", bad])).code).toBe(2);
  });
});
