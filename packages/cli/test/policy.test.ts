// `engram policy` (card E8.15a, docs/design/tui.md 3.6): GET /policy, the
// policy the workspace decides with and its label, printed as YAML that
// loads back to the same policy, or the route's answer with --json. No
// actor and no log: nothing is opened under the home folder.
import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadPreset, parsePolicy } from "@engram/core";
import { type Listening, listen, openWorkspace } from "@engram/server";
import { afterAll, describe, expect, it } from "vitest";
import type { Fetch } from "../src/connect.ts";
import { cli, HOME, NOW, tempDir, testId } from "./helpers.ts";

describe("engram policy", () => {
  it("prints the policy in force as YAML a policy file may hold, under a comment naming it", async () => {
    const r = await cli(["policy"]);
    expect(r.err).toBe("");
    expect(r.code).toBe(0);
    const [first, ...rest] = r.out.split("\n");
    const medium = loadPreset("medium");
    expect(first).toBe(`# ${medium.id} v${medium.version}: the policy the workspace decides with`);
    expect(parsePolicy(rest.join("\n"), "engram policy")).toEqual(medium);
    // And the printed file is a policy the CLI loads: the same label again.
    const dir = await tempDir();
    await writeFile(join(dir, "p.yaml"), r.out);
    const again = await cli(["policy", "--policy", "p.yaml"], { cwd: dir });
    expect(again.out).toBe(r.out);
  });

  it("round-trips every preset, and gives the route's answer with --json", async () => {
    for (const name of ["strict", "medium", "permissive"] as const) {
      const preset = loadPreset(name);
      const r = await cli(["policy", "--policy", name]);
      expect(r.code, name).toBe(0);
      const body = r.out.slice(r.out.indexOf("\n") + 1);
      expect(parsePolicy(body, name), name).toEqual(preset);
      const j = await cli(["policy", "--policy", name, "--json"]);
      expect(JSON.parse(j.out), name).toEqual({
        policy: preset,
        label: `${preset.id} v${preset.version}`,
      });
    }
  });

  it("quotes every string, so one that reads as a boolean, a number, a comment or a map loads back as itself", async () => {
    const dir = await tempDir();
    for (const id of ["true", "1.0", "#x", "a: b", "null", "- x"]) {
      const policy = { ...loadPreset("medium"), id };
      await writeFile(join(dir, "p.yaml"), JSON.stringify(policy));
      const r = await cli(["policy", "--policy", "p.yaml"], { cwd: dir });
      expect(r.code, id).toBe(0);
      const body = r.out.slice(r.out.indexOf("\n") + 1);
      expect(parsePolicy(body, id), id).toEqual(policy);
    }
  });

  it("is exactly one request, opens no log, and takes no actor", async () => {
    const home = await tempDir();
    const paths: string[] = [];
    const transport =
      (next: Fetch): Fetch =>
      async (request) => {
        paths.push(`${request.method} ${new URL(request.url).pathname}`);
        return next(request);
      };
    const r = await cli(["policy"], { home, transport });
    expect(r.code).toBe(0);
    expect(paths).toEqual(["GET /api/v1/policy"]);
    expect(await readdir(home)).toEqual([]);
    const actor = await cli(["policy", "--as", "person:dana"]);
    expect(actor.code).toBe(2);
    expect(actor.err).toContain("Unknown option '--as'");
  });

  describe("with --server", () => {
    let server: Listening | undefined;
    afterAll(async () => server?.close());
    it("shows the server's own policy, and refuses --policy beside it", async () => {
      const root = await tempDir();
      const workspace = openWorkspace({
        policy: "strict",
        db: ":memory:",
        cwd: root,
        home: HOME,
        env: {},
        newId: () => testId(700_001),
      });
      workspace.open();
      server = await listen(workspace, {
        port: 0,
        now: () => NOW,
        auth: { insecureLoopback: true },
      });
      const strict = loadPreset("strict");
      const r = await cli(["policy", "--server", server.url, "--json"]);
      expect(r.code).toBe(0);
      expect(JSON.parse(r.out).label).toBe(`${strict.id} v${strict.version}`);
      const both = await cli(["policy", "--server", server.url, "--policy", "medium"]);
      expect(both.code).toBe(2);
      expect(both.err).toContain("--policy name the workspace");
    });
  });
});
