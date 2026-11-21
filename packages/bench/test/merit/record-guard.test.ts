// `run-merit.ts --record` refuses before it touches anything (finding B7-1):
// without ENGRAM_UPDATE_FIXTURES=1, or into a folder outside fixtures/, it
// exits 2 and the folder keeps what it held. The checkout it is given is a
// folder git cannot read, so a guard that let the run through would fail
// with exit 1 at the checkout instead, and never reach the network.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fixtureRecordingRefusal } from "../../src/merit/config.ts";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const SCRIPT = join(REPO, "packages/bench/scripts/run-merit.ts");
const FIXTURE = JSON.parse(
  readFileSync(join(REPO, "research/configs/b7-merit-fixture.json"), "utf8"),
) as Record<string, unknown>;

/** A config whose cassettes are `cassettes` (absolute), a sentinel file inside, and a checkout git cannot read. */
function setup(cassettes: string) {
  const dir = mkdtempSync(join(tmpdir(), "engram-b7-guard-"));
  mkdirSync(cassettes, { recursive: true });
  const sentinel = join(cassettes, "kept.json");
  writeFileSync(sentinel, "{}\n");
  const config = join(dir, "config.json");
  writeFileSync(config, JSON.stringify({ ...FIXTURE, cassettes }));
  const checkout = join(dir, "not-a-checkout");
  mkdirSync(join(checkout, "merit"), { recursive: true });
  writeFileSync(join(checkout, "merit", "runner.py"), "");
  return { config, sentinel, checkout, out: join(dir, "out") };
}

function record(s: ReturnType<typeof setup>, extra: NodeJS.ProcessEnv) {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  delete env.ENGRAM_OFFLINE;
  if (extra.ENGRAM_UPDATE_FIXTURES === undefined) delete env.ENGRAM_UPDATE_FIXTURES;
  return spawnSync(
    process.execPath,
    [SCRIPT, "--config", s.config, "--out", s.out, "--record", "--upstream", s.checkout],
    { cwd: REPO, env, encoding: "utf8", timeout: 60_000 },
  );
}

describe("run-merit.ts --record", () => {
  it("exits 2 without ENGRAM_UPDATE_FIXTURES=1 and leaves the cassette folder as it was", () => {
    const s = setup(join(REPO, "fixtures", "cassettes", `b7-guard-${process.pid}`));
    try {
      const r = record(s, {});
      expect(r.status).toBe(2);
      expect(r.stderr).toMatch(/ENGRAM_UPDATE_FIXTURES=1/);
      expect(readFileSync(s.sentinel, "utf8")).toBe("{}\n");
      expect(existsSync(s.out)).toBe(false);
    } finally {
      // the folder this test made under fixtures/, nothing else
      rmSync(join(s.sentinel, ".."), { recursive: true, force: true });
    }
  });

  it("exits 2 for a cassette folder outside fixtures/ and leaves it as it was", () => {
    const s = setup(mkdtempSync(join(tmpdir(), "engram-b7-cassettes-")));
    const r = record(s, { ENGRAM_UPDATE_FIXTURES: "1" });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/records into .*fixtures only/);
    expect(readFileSync(s.sentinel, "utf8")).toBe("{}\n");
    expect(existsSync(s.out)).toBe(false);
  });

  it("allows a folder inside fixtures/ under ENGRAM_UPDATE_FIXTURES=1 only, and never offline", () => {
    const inside = join(REPO, "fixtures", "cassettes", "b7-merit-fixture");
    expect(fixtureRecordingRefusal(inside, REPO, { ENGRAM_UPDATE_FIXTURES: "1" })).toBeUndefined();
    expect(fixtureRecordingRefusal(inside, REPO, {})).toMatch(/ENGRAM_UPDATE_FIXTURES/);
    expect(
      fixtureRecordingRefusal(inside, REPO, { ENGRAM_UPDATE_FIXTURES: "1", ENGRAM_OFFLINE: "1" }),
    ).toMatch(/ENGRAM_OFFLINE/);
    expect(
      fixtureRecordingRefusal(join(REPO, "fixtures"), REPO, { ENGRAM_UPDATE_FIXTURES: "1" }),
    ).toMatch(/fixtures only/);
  });
});
