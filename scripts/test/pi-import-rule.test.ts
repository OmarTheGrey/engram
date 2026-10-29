// AGENTS.md rule 4: packages/core and packages/adapters never import pi.
// Biome's noRestrictedImports enforces it (biome.json overrides); this test
// proves the rule fires on the paths it must cover and nowhere else. Probe
// files are written beside real sources (git-ignored) and removed afterwards.
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

// The test timeout and the child's own timeout. spawnSync blocks the worker,
// so vitest cannot stop a test while Biome runs; the spawn timeout is what
// ends a hung Biome, and the error it leaves fails the test rather than
// passing as a non-zero lint status.
const SPAWN_TIMEOUT = 30_000;

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
    const run = spawnSync(
      "pnpm",
      ["exec", "biome", "lint", "--vcs-use-ignore-file=false", ...files],
      { encoding: "utf8", shell: process.platform === "win32", timeout },
    );
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

test(
  "a Biome run that outlives its spawn timeout fails the test instead of passing as a lint failure",
  () => {
    expect(() => lint("core", PI_IMPORTS, 1)).toThrow(/ETIMEDOUT/);
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
