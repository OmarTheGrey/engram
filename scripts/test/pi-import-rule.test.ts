// AGENTS.md rule 4: packages/core and packages/adapters never import pi.
// Biome's noRestrictedImports enforces it (biome.json overrides); this test
// proves the rule fires on the paths it must cover and nowhere else. Probe
// files are written beside real sources (git-ignored) and removed afterwards.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, isAbsolute, join } from "node:path";
import { expect, test } from "vitest";

// The test timeout and the child's own timeout. spawnSync blocks the worker,
// so vitest cannot stop a test while Biome runs; the spawn timeout is what
// ends a hung Biome, and the error it leaves fails the test rather than
// passing as a non-zero lint status.
const SPAWN_TIMEOUT = 30_000;

// The native Biome binary, spawned without a shell or wrapper so that the
// spawn timeout kills Biome itself. `pnpm exec biome` on Windows needs a
// shell, and @biomejs/biome's bin/biome is a Node script that spawns this
// binary in turn; a timeout would kill only the shell or the script. The
// binary is the platform package bin/biome resolves (Biome 2.5.15): pnpm
// installs only the one for this platform, glibc or musl on Linux.
const fromBiome = createRequire(
  createRequire(import.meta.url).resolve("@biomejs/biome/package.json"),
);
const BIOME = ((): string => {
  const exe = process.platform === "win32" ? "biome.exe" : "biome";
  const base = `@biomejs/cli-${process.platform}-${process.arch}`;
  const found = [base, `${base}-musl`].flatMap((pkg) => {
    try {
      return [fromBiome.resolve(`${pkg}/${exe}`)];
    } catch {
      return [];
    }
  });
  if (found[0] === undefined)
    throw new Error(`no Biome binary installed for ${process.platform}-${process.arch}`);
  return found[0];
})();

/** Lints each source as its own probe file in one Biome run. */
function lint(pkg: string, sources: readonly string[], timeout = SPAWN_TIMEOUT) {
  const dir = join("packages", pkg, "src");
  mkdirSync(dir, { recursive: true });
  const files = sources.map((source, i) => {
    const file = join(dir, `.lint-probe-${process.pid}-${i}.ts`);
    writeFileSync(file, source);
    return file;
  });
  try {
    const run = spawnSync(BIOME, ["lint", "--vcs-use-ignore-file=false", ...files], {
      encoding: "utf8",
      timeout,
    });
    if (run.error) throw run.error;
    return { status: run.status, output: run.stdout + run.stderr };
  } finally {
    for (const file of files) rmSync(file, { force: true });
  }
}

const PI_IMPORTS = [
  'import { getModel } from "@earendil-works/pi-ai";\nexport const m = getModel;\n',
  'import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";\nexport type A = ExtensionAPI;\n',
  'import { Harness } from "@earendil-works/pi-durable";\nexport const h = Harness;\n',
  'import { getModels } from "@earendil-works/pi-ai/compat";\nexport const c = getModels;\n',
];

test.each(["core", "adapters"])(
  "rejects every pi import in packages/%s",
  (pkg) => {
    const run = lint(pkg, PI_IMPORTS);
    expect(run.output.match(/lint\/style\/noRestrictedImports/g) ?? []).toHaveLength(
      PI_IMPORTS.length,
    );
    expect(run.status, run.output).not.toBe(0);
  },
  SPAWN_TIMEOUT,
);

test("spawns the native Biome binary itself, so the timeout kills Biome and not a wrapper", () => {
  expect(basename(BIOME)).toMatch(/^biome(\.exe)?$/);
  expect(isAbsolute(BIOME)).toBe(true);
  expect(existsSync(BIOME)).toBe(true);
});

test(
  "a Biome run that outlives its spawn timeout fails the test instead of passing as a lint failure",
  () => {
    let error: unknown;
    try {
      lint("core", PI_IMPORTS, 1);
    } catch (e) {
      error = e;
    }
    // The process the timeout killed is Biome itself, run without a shell.
    expect(error).toMatchObject({ code: "ETIMEDOUT", path: BIOME });
  },
  SPAWN_TIMEOUT,
);

test(
  "allows pi imports in packages/runner",
  () => {
    const run = lint("runner", PI_IMPORTS);
    expect(run.status, run.output).toBe(0);
  },
  SPAWN_TIMEOUT,
);
