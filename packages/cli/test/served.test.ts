// The commands card E8.15a adds, over --server (card E8.12, ADR 0042): with
// a key file each runs as the actor its key names when ENGRAM_TOKEN carries
// the key, and is refused without it; on an insecure loopback server, an
// item the reader may not read answers exactly as an id the log never held.
import { join } from "node:path";
import { type Listening, listen, openCredentials, openWorkspace } from "@engram/server";
import { afterAll, describe, expect, it } from "vitest";
import { blind, cli, HOME, NOW, tempDir, testId } from "./helpers.ts";

const ITEM = "01920000-0000-7000-8000-00000000e817";
const UNKNOWN = "01920000-0000-7000-8000-00000000e898";
const EXPIRES = "2026-12-25T12:00:00.000Z";

const servers: { server: Listening; close: () => void }[] = [];
afterAll(async () => {
  for (const s of servers) {
    await s.server.close();
    s.close();
  }
});

/** A server over a fresh store of dana's, with dana's key when `keyed`. */
async function serve(keyed: boolean, base: number) {
  const root = await tempDir();
  let n = 0;
  const workspace = openWorkspace({
    root,
    owner: "dana",
    db: ":memory:",
    cwd: root,
    home: HOME,
    env: {},
    newId: () => testId(base + ++n),
  });
  workspace.open();
  let key = "";
  let auth: Parameters<typeof listen>[1]["auth"] = { insecureLoopback: true };
  if (keyed) {
    const keys = join(await tempDir(), "keys.json");
    const made = await cli([
      ...["key", "create", "--keys", keys, "--as", "person:dana", "--member", "person:dana"],
      ...["--source", "user", "--expires", EXPIRES],
    ]);
    expect(made.code).toBe(0);
    key = made.out.split("\n")[0] ?? "";
    const credentials = openCredentials({ keys }, (p) => p);
    if (credentials === undefined) throw new Error("no credentials");
    auth = { credentials };
  }
  const server = await listen(workspace, { port: 0, now: () => NOW, auth });
  servers.push({ server, close: () => workspace.close() });
  return { url: server.url, key };
}

describe("the new commands against a server with a key file", () => {
  it("run as the key's actor with ENGRAM_TOKEN, and are refused without it", async () => {
    const { url, key } = await serve(true, 860_000);
    const env = { ENGRAM_TOKEN: key };
    const as = ["--server", url, "--owner", "dana"];
    const written = await cli(["write", ...as, "--id", ITEM, "--content", "Keyed."], { env });
    expect(written.code).toBe(0);
    const grant = "person:sam,class=semantic,mode=read,expires=2026-12-01";
    const steps: [string[], number, string][] = [
      [["check", ...as, "--content", "Keyed too."], 0, "allow: "],
      [["events", ...as], 0, "events person:dana may see: "],
      [["grants", ITEM, ...as, "--add", grant], 0, "policy engram/grant/change"],
      [["scopes", ...as], 0, "  person:dana (membership)"],
      [["read", "--item", ITEM, ...as], 0, "1 item returned, 0 filtered"],
      [["policy", "--server", url], 0, "# preset.medium v"],
    ];
    for (const [args, code, text] of steps) {
      const r = await cli(args, { env });
      expect(r.err, args[0]).toBe("");
      expect(r.code, args[0]).toBe(code);
      expect(r.out, args[0]).toContain(text);
      const refused = await cli(args);
      expect(refused.code, `${args[0]} without a token`).toBe(1);
      expect(refused.out, `${args[0]} without a token`).toBe("");
      expect(refused.err, `${args[0]} without a token`).toContain(
        "this server needs a bearer credential (ADR 0042)",
      );
    }
  });
});

describe("read --item over --server", () => {
  it("answers an item the reader may not read exactly as an id the log never held", async () => {
    const { url } = await serve(false, 870_000);
    const w = await cli([
      "write",
      "--server",
      url,
      "--owner",
      "dana",
      "--id",
      ITEM,
      "--content",
      "x",
    ]);
    expect(w.code).toBe(0);
    const eve = ["--server", url, "--as", "person:eve"];
    for (const json of [[], ["--json"]]) {
      const hidden = await cli(["read", "--item", ITEM, ...eve, ...json]);
      const unknown = await cli(["read", "--item", UNKNOWN, ...eve, ...json]);
      expect(hidden.code).toBe(0);
      expect(hidden.err).toBe("");
      expect(blind(hidden.out, ITEM), json.join("")).toBe(blind(unknown.out, UNKNOWN));
    }
  });
});
