// AGENTS.md rule 4: packages/core and packages/adapters never import pi.
// Biome's noRestrictedImports enforces it (biome.json overrides); this test
// proves the rule fires on the paths it must cover and nowhere else. Probe
// files are written beside real sources (git-ignored) and removed afterwards.
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const SPAWN_TIMEOUT = 30_000;

/** Lints each source as its own probe file in one Biome run. */
function lint(pkg: string, sources: readonly string[]) {
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
      { encoding: "utf8", shell: process.platform === "win32" },
    );
    return { status: run.status, output: run.stdout + run.stderr };
  } finally {
    for (const file of files) rmSync(file, { force: true });
  }
}

const PI_IMPORTS = [
  'import { getModel } from "@earendil-works/pi-ai";\nexport const m = getModel;\n',
  'import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";\nexport type A = ExtensionAPI;\n',
  'import { Harness } from "@earendil-works/pi-durable";\nexport const h = Harness;\n',
];

test.each(["core", "adapters"])(
  "rejects every pi import in packages/%s",
  (pkg) => {
    const run = lint(pkg, PI_IMPORTS);
    expect(run.output.match(/lint\/style\/noRestrictedImports/g) ?? []).toHaveLength(3);
    expect(run.status, run.output).not.toBe(0);
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
