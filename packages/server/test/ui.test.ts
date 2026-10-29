// The inspector's static files (card E8.5; plan docs/tasks/gate-b-plan.md,
// PR 4): the built UI is served at / beside /api/v1, an unknown page falls
// back to index.html (the UI routes itself), and nothing outside the UI's
// directory is ever served, however the path is spelled. Every page carries
// a Content-Security-Policy that keeps it to its own origin, so it fetches
// nothing but the API and its own files.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { builtUi, UI_CSP } from "../src/static.ts";
import { BASE, NOW, PORT, testWorkspace } from "./helpers.ts";

const base = mkdtempSync(join(tmpdir(), "engram-ui-"));
afterAll(() => rmSync(base, { recursive: true, force: true }));
const dist = join(base, "dist");
mkdirSync(join(dist, "assets"), { recursive: true });
writeFileSync(join(dist, "index.html"), "<!doctype html><title>Inspector</title>");
writeFileSync(join(dist, "assets", "app.js"), "console.log(1)");
writeFileSync(join(dist, "assets", "app.css"), "body{}");
writeFileSync(join(base, "secret.txt"), "SECRET");
let linked = true;
try {
  symlinkSync(join(base, "secret.txt"), join(dist, "assets", "link.txt"));
} catch {
  linked = false; // Windows without the symlink privilege
}

function app(ui: string | null | undefined = dist) {
  const { workspace } = testWorkspace();
  return createApp(workspace, { port: PORT, now: () => NOW, ui });
}

const get = (path: string, ui?: string | null, init: RequestInit = {}) =>
  app(ui).fetch(new Request(`${BASE}${path}`, init));

describe("the inspector's files", () => {
  it("serves index.html at / with the policy that keeps the page to its own origin", async () => {
    const r = await get("/");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/^text\/html/);
    expect(await r.text()).toContain("<title>Inspector</title>");
    expect(r.headers.get("content-security-policy")).toBe(UI_CSP);
    expect(UI_CSP).toMatch(/default-src 'self'/);
    expect(UI_CSP).toMatch(/connect-src 'self'/);
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("serves an asset with its media type", async () => {
    const js = await get("/assets/app.js");
    expect(js.status).toBe(200);
    expect(js.headers.get("content-type")).toMatch(/^text\/javascript/);
    expect(await js.text()).toBe("console.log(1)");
    expect((await get("/assets/app.css")).headers.get("content-type")).toMatch(/^text\/css/);
  });

  it("falls back to index.html for a page path, never for a missing file", async () => {
    const page = await get("/explain/some-read");
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("<title>Inspector</title>");
    expect((await get("/assets/missing.js")).status).toBe(404);
  });

  it("serves nothing outside its directory, however the path is spelled", async () => {
    const spellings = [
      "/../secret.txt",
      "/%2e%2e/secret.txt",
      "/assets/..%2f..%2fsecret.txt",
      "/assets/%2e%2e%2f%2e%2e%2fsecret.txt",
      "/..%5csecret.txt",
      "/assets/..%5c..%5csecret.txt",
      "/%2fsecret.txt",
      `/${encodeURIComponent(join(base, "secret.txt"))}`,
      "/assets/app.js%00.html",
      "/%",
    ];
    for (const path of spellings) {
      const r = await get(path);
      expect(await r.text(), path).not.toContain("SECRET");
    }
  });

  it.skipIf(!linked)("does not follow a link out of its directory", async () => {
    const r = await get("/assets/link.txt");
    expect(r.status).toBe(404);
    expect(await r.text()).not.toContain("SECRET");
  });

  it("keeps /api/v1 for the API: an unknown route is the API's 404, not the page", async () => {
    const r = await get("/api/v1/nothing");
    expect(r.status).toBe(404);
    expect(((await r.json()) as { error: { code: string } }).error.code).toBe("not_found");
  });

  it("serves files to GET only; the API's guards still run first", async () => {
    const post = await get("/", dist, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(post.status).toBe(404);
    const rebound = await app().fetch(
      new Request(`http://evil.example:${PORT}/`, { headers: { host: `evil.example:${PORT}` } }),
    );
    expect(rebound.status).toBe(403);
  });

  it("answers / with a 404 naming make ui when no inspector is built", async () => {
    const r = await get("/", null);
    expect(r.status).toBe(404);
    expect(((await r.json()) as { error: { message: string } }).error.message).toMatch(/make ui/);
  });

  it("finds the built inspector only when its index.html exists", () => {
    expect(builtUi(dist)).toBe(dist);
    expect(builtUi(join(base, "nowhere"))).toBeNull();
  });
});
