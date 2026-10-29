// The environment variable names pi-ai reads a provider's API key from, per
// built-in provider. `engram doctor` reports which are set, but the CLI may
// not import pi-ai (AGENTS.md: pi is reached only from pi-extension, runner
// and bench), so the names reach it as data: `make api` writes them to
// provider-keys.json beside this file, and test/model/provider-keys.test.ts
// fails when the committed file no longer matches the installed pi-ai.
//
// The names come from pi-ai itself: `findEnvKeys(provider, env)` returns the
// API key variables set in `env`, so an `env` that answers every name yields
// the provider's whole list. No value is read; the probe env holds none. A
// provider with ambient or OAuth credentials only (AWS profiles, Google ADC,
// a subscription login) has an empty list: findEnvKeys excludes those by
// design, and the doctor does not check them.
//
// Dependency on pi-ai's `compat` entry point: findEnvKeys is exported only
// from `@earendil-works/pi-ai/compat`, which pi-ai 1.3.0 marks as temporary
// and to be deleted with the coding-agent ModelManager migration. When a pi
// pin bump removes it, `make api` fails loudly here (no silent drift). The
// replacement is to read each provider's names from `builtinProviders()`
// (`@earendil-works/pi-ai/providers/all`) if pi exposes them there, or to
// probe each provider's `auth.apiKey.resolve` with a recording AuthContext.
// Recorded in the ADR 0019 amendment of card E0.4.
import { readFileSync } from "node:fs";
import { findEnvKeys } from "@earendil-works/pi-ai/compat";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";

export interface ProviderKeys {
  /** The pi-ai version the names were taken from; a pin move regenerates them. */
  pi_ai: string;
  /** Provider id to its API key variable names, in pi-ai's order of preference. */
  providers: Record<string, string[]>;
}

/** An environment in which every variable is set, so findEnvKeys lists them all. */
const EVERY_NAME_SET = new Proxy({} as Record<string, string>, {
  get: (_target, name) => (typeof name === "string" ? "set" : undefined),
});

export function providerKeys(): ProviderKeys {
  // The runner's exact pin; pi-ai does not export its package.json.
  const runner = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { dependencies: Record<string, string> };
  const version = runner.dependencies["@earendil-works/pi-ai"] ?? "unpinned";
  const ids = builtinProviders()
    .map((p) => p.id)
    .sort();
  const providers: Record<string, string[]> = {};
  for (const id of ids) providers[id] = findEnvKeys(id, EVERY_NAME_SET) ?? [];
  return { pi_ai: version, providers };
}
