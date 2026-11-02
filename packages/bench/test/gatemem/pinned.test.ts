// What `make run ... COUNT=1` checks before it counts (plan decision 6): a
// GateMem data directory is the pinned full set, the vendored fixture subset,
// or neither, by the fixture manifest's hashes.
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  checkGateMemData,
  GATEMEM_DOMAINS,
  type GateMemManifest,
  readGateMemManifest,
} from "../../src/gatemem/pinned.ts";
import { FIXTURES } from "./fixture.ts";

const temp: string[] = [];
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), "engram-gatemem-pinned-"));
  temp.push(dir);
  return dir;
};
afterAll(() => {
  for (const d of temp) rmSync(d, { recursive: true, force: true });
});

describe("GateMem data against the pin", () => {
  test("the vendored fixture is the fixture subset at the pinned commit", () => {
    const check = checkGateMemData(FIXTURES);
    expect(check).toEqual({
      set: "fixture",
      commit: "a983828b3bb7565e16e25ac8cdc2fc1982633b0b",
      full_files_matching: 0,
    });
  });

  test("an extra domain directory beside the fixture makes it unpinned (P3-8)", () => {
    const dir = fresh();
    cpSync(FIXTURES, dir, { recursive: true });
    mkdirSync(join(dir, "extra"));
    writeFileSync(join(dir, "extra", "episodes.jsonl"), "");
    expect(checkGateMemData(dir).set).toBe("unpinned");
  });

  test("one changed line makes the fixture unpinned", () => {
    const dir = fresh();
    cpSync(FIXTURES, dir, { recursive: true });
    const path = join(dir, "office", "checkpoints.jsonl");
    writeFileSync(path, `${'{"changed": true}'}\n`, { flag: "a" });
    expect(checkGateMemData(dir).set).toBe("unpinned");
  });

  test("eight files whose bytes the manifest hashes are the full set; one missing is not", () => {
    const dir = fresh();
    const real = readGateMemManifest();
    const manifest: GateMemManifest = { ...real, upstream_sha256: { ...real.upstream_sha256 } };
    for (const d of GATEMEM_DOMAINS) {
      for (const f of ["episodes.jsonl", "checkpoints.jsonl"]) {
        mkdirSync(join(dir, d), { recursive: true });
        const body = `${d}/${f}\n`;
        writeFileSync(join(dir, d, f), body);
        manifest.upstream_sha256[`bench/data/${d}/${f}`] = createHash("sha256")
          .update(body)
          .digest("hex");
      }
    }
    expect(checkGateMemData(dir, manifest)).toMatchObject({ set: "full", full_files_matching: 8 });
    // A fifth domain directory would be loaded, run and counted with the pinned four (P3-8).
    mkdirSync(join(dir, "extra"));
    writeFileSync(join(dir, "extra", "episodes.jsonl"), "");
    expect(checkGateMemData(dir, manifest)).toMatchObject({
      set: "unpinned",
      full_files_matching: 8,
    });
    rmSync(join(dir, "extra"), { recursive: true });
    expect(checkGateMemData(dir, manifest).set).toBe("full");
    rmSync(join(dir, "office", "episodes.jsonl"));
    expect(checkGateMemData(dir, manifest)).toMatchObject({
      set: "unpinned",
      full_files_matching: 7,
    });
  });
});
