// The provider key names `engram doctor` checks are pi-ai's own, and the
// committed provider-keys.json is what the installed pi-ai gives today.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type ProviderKeys, providerKeys } from "../../src/model/provider-keys.ts";

const committed = JSON.parse(
  readFileSync(new URL("../../src/model/provider-keys.json", import.meta.url), "utf8"),
) as ProviderKeys;

describe("provider key names", () => {
  it("are read from pi-ai: anthropic and openai name their usual variables", () => {
    const { providers } = providerKeys();
    expect(providers.anthropic).toContain("ANTHROPIC_API_KEY");
    expect(providers.openai).toEqual(["OPENAI_API_KEY"]);
    expect(providers["amazon-bedrock"]).toEqual([]);
  });

  it("the committed file matches the installed pi-ai; run make api if not", () => {
    expect(committed).toEqual(providerKeys());
  });
});
