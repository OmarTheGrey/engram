// Card E9.12 on the surfaces the write answer reaches: a write an opt-out of
// the person scope covers is refused with the gate's reason and rule
// (engram/write/consent) by `engram write` and `engram check` in process,
// and by `engram write --server` through the HTTP API, and the refusal never
// repeats the content. The policy is card E9.12's fixture candidate, the
// twin profile with three opt-outs of person:dana.
import { join } from "node:path";
import { type Listening, listen, openWorkspace } from "@engram/server";
import { afterAll, describe, expect, it } from "vitest";
import { cli, HOME, NOW, REPO, tempDir, testId } from "./helpers.ts";

const POLICY = join(REPO, "fixtures/workloads/e9-12-consent-twin.yaml");
const CONTENT = "Blood test on Monday: my health is fine, ref 5521.";
const REASON =
  'consent.opt_outs[0] of policy fixture.twin-consent (topic "health") covers this write to person:dana';

describe("a consent refusal on every surface the write answer reaches", () => {
  it("engram write and engram check, in process", async () => {
    const root = await tempDir();
    const db = join(await tempDir(), "engram.db");
    const flags = ["--root", root, "--owner", "dana", "--db", db, "--policy", POLICY];
    const checked = await cli(["check", ...flags, "--content", CONTENT]);
    const written = await cli(["write", ...flags, "--content", CONTENT]);
    for (const r of [checked, written]) {
      expect(r.out).toContain(`deny: ${REASON}`);
      expect(r.out).toContain("policy engram/write/consent");
      expect(r.out).not.toContain("5521");
    }
    expect(written.code).toBe(1);
    const allowed = await cli(["write", ...flags, "--content", "Lunch on Monday."]);
    expect(allowed.code).toBe(0);
    expect(allowed.out).toContain("policy fixture.twin-consent/write/person");
  });

  let server: Listening | undefined;
  afterAll(async () => server?.close());

  it("engram write --server, through the HTTP API", async () => {
    const root = await tempDir();
    let n = 0;
    const workspace = openWorkspace({
      root,
      owner: "dana",
      db: ":memory:",
      policy: POLICY,
      cwd: root,
      home: HOME,
      env: {},
      newId: () => testId(810_000 + ++n),
    });
    workspace.open();
    server = await listen(workspace, { port: 0, now: () => NOW, auth: { insecureLoopback: true } });
    const w = await cli(["write", "--server", server.url, "--owner", "dana", "--content", CONTENT]);
    expect(w.out).toContain(`deny: ${REASON}`);
    expect(w.out).toContain("policy engram/write/consent");
    expect(w.out).not.toContain("5521");
    expect(w.code).toBe(1);
  });
});
