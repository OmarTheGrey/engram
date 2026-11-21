// Card E2.9 review (E2.9-6): the test vectors of the sources the guard's
// tables were copied from, ported at the commits docs/absorbed.md records,
// so the copy is checked against the source's own cases.
//
// - claude-mem (https://github.com/thedotmack/claude-mem),
//   tests/utils/redaction.test.ts at f1bb834527637231e23575e2a70c57375efdac04,
//   Copyright 2026 Alex Newman, Apache License 2.0: AFTER_NEWLINE_KEYS (one
//   key per vendor pattern) and the "leaves %s alone" tables.
// - walrus-memory (https://github.com/MystenLabs/walrus-memory),
//   services/server/scripts/mcp/__tests__/secret-redaction.test.ts at
//   856fb01793fdb4301cc1b1a9c8673c4c55595f08, Apache License 2.0: the
//   vendor, PEM, JWT, labelled-key, seed-phrase and blob cases, and the
//   sentences that must pass untouched.
// - graphCTX (https://github.com/coder-company/graphCTX),
//   test/security/secrets.test.ts at c74644cd1808aef35fb8aa0e4368d0dba76f086d,
//   Copyright (c) 2026 coder-company, MIT License: the containsSecret cases.
//
// Modified: the sources redact, so "redacted" becomes "found" (a match of the
// secrets guard) and "left alone" becomes "not found". Where this guard
// decides otherwise on purpose, the vector is in DIVERGENT with the reason.
// Every ported vector is the source's own text; walrus' em dash is written
// as an escape, since prose here takes none.
// Literals are split as the sources split them, so push protection does not
// take these fakes for keys.
import { describe, expect, test } from "vitest";
import { GUARD_RULES, scan } from "../../../src/policy/secrets.ts";

const secrets = new Set(["secrets"] as const);
const both = new Set(["secrets", "pii"] as const);
const found = (text: string) => scan(text, secrets).length > 0;
const clean = (text: string) => scan(text, both).length === 0;

/** The vendor rules copied from claude-mem: neither gitleaks' nor the heuristic ones. */
const HEURISTIC = new Set([
  "secret/generic-password",
  "secret/generic-token",
  "secret/bearer-token",
  "secret/env-credential",
  "secret/hex-near-keyword",
  "secret/labelled-key-material",
  "secret/high-entropy",
]);
const VENDOR = GUARD_RULES.filter(
  (r) => r.guard === "secrets" && !r.kind.startsWith("secret/gitleaks/") && !HEURISTIC.has(r.kind),
);
const vendorFinds = (text: string) => scan(text, secrets, VENDOR).length > 0;

describe("claude-mem: one key per vendor pattern (AFTER_NEWLINE_KEYS)", () => {
  const A36 = "aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789";
  const HEX64 = "0123456789abcdef".repeat(4);
  const KEYS: [string, string][] = [
    ["github-token", `gh${"p_"}${A36}`],
    ["openai-key", `s${"k-ABCDEFGHIJ1234567890abcdef"}`],
    ["anthropic-key", `s${"k-ant-api03-abcdef1234567890ABCDEF"}`],
    ["slack-token", `xox${"b-1234567890-0987654321-abcdefghijklmnop"}`],
    ["jwt", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.AbCdEf0123456789"],
    ["stripe-key", `sk${"_live_abcdefghijklmnopqrstuvwx"}`],
    ["google-api-key", `AI${"zaSyA-0123456789abcdefghijklmnopqrstu"}`],
    ["google-oauth-token", `ya${"29."}${A36}`],
    ["gitlab-token", `gl${"pat-"}aBcDeFgHiJkLmNoPqRsT`],
    ["huggingface-token", `h${"f_"}aBcDeFgHiJkLmNoPqRsTuVwXyZ01234567`],
    ["npm-token", `np${"m_"}${A36}`],
    ["docker-pat", `dckr${"_pat_"}aBcDeFgHiJkLmNoPqRsTuVwXyZ0`],
    ["linear-key", `lin_${"api_"}${A36}abcd`],
    ["notion-token", `nt${"n_"}1234567890${A36}`],
    ["sendgrid-key", `S${"G."}aBcDeFgHiJkLmNoPqRsTuV.${A36}aBcDeFg`],
    ["digitalocean-token", `do${"p_v1_"}${HEX64}`],
    ["shopify-token", `shp${"at_"}${HEX64.slice(0, 32)}`],
    ["pypi-token", `py${"pi-AgE"}${A36}${A36}`],
    ["databricks-token", `da${"pi"}${HEX64.slice(0, 32)}`],
    ["vault-token", `hv${"s."}${A36.repeat(3)}`],
    ["nvidia-nim-key", `nv${"api-"}${A36}`],
    ["groq-key", `gs${"k_"}${A36}aBcDeFgHiJkLmNoP`],
    ["xai-key", `xa${"i-"}${A36}${A36}aBcDeFgH`],
    ["perplexity-key", `ppl${"x-"}${A36}AbCdEfGhIjKl`],
    ["supabase-token", `sb${"p_"}${HEX64.slice(0, 40)}`],
    ["sentry-token", `sntr${"yu_"}${HEX64}`],
  ];
  test.each(KEYS)("%s", (kind, key) => {
    for (const text of [key, `x\n${key}`, `token: ${key} tail`])
      expect(scan(text, secrets).map((f) => f.kind)).toContain(`secret/${kind}`);
  });

  test("a key-shaped run inside a longer word is left alone", () => {
    expect(vendorFinds(`xgh${"p_"}${A36}`)).toBe(false);
  });

  test.each([
    "pplx-embed-v1-4b",
    "pplx-decider-v1.2",
    "the pplx- prefix",
    "dapi" + "short",
    "the dapi" + "deadbeef helper",
    "hv" + "s." + "short",
    "lin_api_short",
    "ntn_short",
    "secret_sauce",
    "the secret_key_base setting",
    "gsk_short",
    "xai-short",
    "the xai-sdk package",
    "sbp_short",
    "sntryu_short",
    "the sntrys_ prefix",
    "glsa_short",
    "glc_short",
    "the glc_ prefix",
    "PMAK-short",
    "pul-short",
    "dp.pt.short",
    "HRKU-short",
    "ATATT3short",
    "gldt-short",
    "hf_short",
    "npm_short",
    "dckr_pat_short",
    "the hf_transformers module",
    "npm_config_cache=/tmp/x",
    "pypi-AgEshort",
    "pypi-simple index",
    "ya29.short",
    "the ya29. prefix",
    "SG.short.key",
    "dop_v1_short",
    "shpat_short",
    "the shpat_ prefix",
    "https://hooks.slack.com/services/T01ABCDEF/B02GHIJKL/short",
    "https://discord.com/api/webhooks/123456789012345678/short",
    `https://example.com/${"hooks.slack"}.com/services/T01ABCDEF/B02GHIJKL/aBcDeFgHiJkLmNoPqRsTuVwX`,
    "https://example.com:8080/path",
    "https://user@example.com/repo.git",
    "http://localhost:3000/@scope/pkg",
    `postgres://app:${"$"}{DB_PASS}@db/prod`,
    "postgres://app:<password>@db/prod",
  ])("the vendor rules leave %s alone", (input) => {
    expect(vendorFinds(input)).toBe(false);
  });
});

describe("walrus-memory: found", () => {
  const SEED = "4f3c2b1a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b";
  const WORDS =
    "abandon ability able about above absent absorb abstract absurd abuse access accident";
  test.each([
    "I prefer dark mode, and the staging db is postgres://admin:hunter2@db.internal:5432/app",
    "My deploy notes: the CI runner uses sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789 for pushes",
    "My deploy notes: the CI runner uses sk-abcdefghijklmnopqrstuvwxyz0123 for pushes",
    "My deploy notes: the CI runner uses ghp_abcdefghijklmnopqrstuvwxyz0123456789 for pushes",
    `My deploy notes: the CI runner uses ${"xox"}b-1234567890-abcdefghij for pushes`,
    "My deploy notes: the CI runner uses glpat-abcdefghij0123456789 for pushes",
    "Deploy key for the box:\n-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAx7Vk9mJ0ZwQ3\n-----END RSA PRIVATE KEY-----",
    "Deploy key for the box:\n-----BEGIN OPENSSH PRIVATE KEY-----\nMIIEowIBAAKCAQEAx7Vk9mJ0ZwQ3\n",
    "Our session tokens look like eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk and expire hourly",
    "To call the API: Authorization: Bearer abc123xyz789 \u2014 then GET /v1/me",
    `My wallet recovery phrase is ${WORDS} and the wallet is on Sui mainnet`,
    `Notes from setup: delegatePrivateKey ${SEED} was written on this laptop`,
    `Notes from setup: "delegatePrivateKey": "${SEED}" is in the file`,
    `Notes from setup: my delegate private key is ${SEED} on this laptop`,
    `Notes from setup: ${SEED} is my private key for this laptop`,
    `Notes from setup: secret_key = ${SEED} on this laptop`,
    `Notes from setup: the signing key 0x${SEED} lives on this laptop`,
    `Wallet notes: my recovery phrase is ${WORDS} for the mainnet wallet`,
    `Wallet notes: seed_phrase: ${WORDS} for the mainnet wallet`,
    `Wallet notes: "mnemonic": "${WORDS}" for the mainnet wallet`,
    "The signing material is QWxhZGRpbjpvcGVuIHNlc2FtZQBcdefGHIjklMNOpqrSTUvwxYZ0123456789abcDEF0123 which I keep in the vault",
    "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "DB_PASSWORD=hunter2SuperSecret",
    "SESSION_SECRET=abcd1234efgh5678",
    "my_api_key=abcd1234efgh5678",
    'Save my config: {"username": "alice", "password": "hunter2-prod-9xQ"} for staging',
    "My AWS secret access key is wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY for prod",
    "AWS creds for staging: AKIAIOSFODNN7EXAMPLE and the secret key is wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "X_AUTH_TOKEN: abcd1234",
    "staging is postgres://admin:hunter2@db.internal:5432/app",
  ])("%s", (text) => {
    expect(found(text)).toBe(true);
  });
});

describe("walrus-memory: left alone", () => {
  const HEX = "4f3c2b1a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b";
  const WORDS =
    "abandon ability able about above absent absorb abstract absurd abuse access accident";
  test.each([
    `The release digest is ${HEX} and I verified it`,
    `Pin the deployment to 0x${HEX}`,
    "My creds live in ~/.memwal/credentials.json and the fix landed in 4f2b8c1e9d7a3f5b6c0e2d4a8b1f3c5e7d9a0b2c",
    `My delegatePublicKeyHex is ${HEX}`,
    `I wrote down ${WORDS} yesterday`,
    "I always use pnpm, and TypeScript strict mode on every project.",
    "Tui luôn dùng pnpm và order cafe là matcha oat latte.",
    "Deploy to staging on Thursdays, never on Friday afternoons.",
    "My password manager is 1Password and I rotate keys every quarter.",
    "The API key for that service is stored in Vault, not in the repo.",
    "My account id is 0x7f3a9c2e5b8d1f4a6c9e2b5d8f1a4c7e0b3d6f9a2c5e8b1d4f7a0c3e6b9d2f5a",
    "The blob landed as blob_id=Xj9vKq2mP7nR4tW8yB1cE5gH0dF3sA6uZ2xN8qL4kM7",
    "Pin the build to commit 4f2b8c1e9d7a3f5b6c0e2d4a8b1f3c5e7d9a0b2c",
    "The sha256 of the release tarball is e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "My Sui package id is 0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437",
    "The migration artifact hashes to 9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b",
    "We renamed the secret_store module to vault_client last sprint.",
    "Token bucket rate limiting is what the relayer uses.",
    "Our dashboard is at https://app.example.com:8443?owner=alice@corp.com and we deploy Fridays",
  ])("%s", (text) => {
    expect(scan(text, secrets)).toEqual([]);
  });
});

describe("graphCTX: containsSecret", () => {
  test.each([
    "export OPENAI_KEY=sk-abcdefghijklmnopqrstuvwx",
    "GOOGLE_API_KEY=AIzaSyB1c2D3e4F5g6H7i8J9k0L1m2N3o4P5q6R7",
    "api_key: 'A1b2C3d4E5f6G7h8'",
    "DATABASE_URL=postgres://admin:FAKEpass123@db.example/app",
    "-----BEGIN ENCRYPTED PRIVATE KEY-----",
    "-----BEGIN DSA PRIVATE KEY-----",
    "-----BEGIN PGP PRIVATE KEY BLOCK-----",
    "Authorization: Bearer plainlowentropytoken123",
    "token gh" + "p_" + "abcdefghijklmnopqrstuvwxyz0123456789",
    "token sk-FAKEFAKEFAKEFAKEFAKE0123abcd",
    "auth eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgN3P4JvMNHl0w5N",
  ])("finds %s", (text) => {
    expect(found(text)).toBe(true);
  });

  test.each([
    "npm run test",
    "this repo uses pnpm",
    "npm_package_version=1.2.3",
    "DATABASE_URL=postgres://localhost/app",
  ])("leaves %s alone", (text) => {
    expect(clean(text)).toBe(true);
  });
});

/**
 * Where this guard decides otherwise than its source, on purpose: each with
 * what the source does, what the guard does, and why.
 */
const DIVERGENT: [source: string, text: string, foundHere: boolean, why: string][] = [
  [
    "graphCTX: found",
    "https://hooks.slack.com/services/T00000000/B00000000/FAKEfakeFAKEfake",
    false,
    "claude-mem's webhook rule wants a secret path of 20 characters or more; this one has 16",
  ],
  [
    "walrus: found",
    "POSTGRES_PASSWORD=hunter2",
    false,
    "claude-mem's generic value wants eight characters and a letter; a seven-character value stays",
  ],
  [
    "graphCTX: found",
    "Cookie: session_id=plainlowentropycookie123",
    false,
    "no cookie rule: a cookie header names preferences as often as sessions",
  ],
  [
    "walrus: left alone (held here, REVIEW tier)",
    "The build id is 20260918T0930Z-linux-arm64-release-candidate",
    true,
    "a 47-character mixed-case run with digits; caura's reads-as-words gate takes no single capital for a word",
  ],
  [
    "walrus: found",
    'My local override file has token = "t0ps3cr3t-value" and I never commit it',
    false,
    "claude-mem counts a bare `token` only in config-shaped positions; `token = ` mid-sentence is prose as often as config",
  ],
  [
    "graphCTX, walrus: found",
    "AKIAIOSFODNN7EXAMPLE",
    false,
    "AWS's documented example key is allowlisted, as gitleaks allowlists it (E2.9-8)",
  ],
  [
    "graphCTX: found",
    "AWS_SECRET_ACCESS_KEY=aaaaaaaaaaaaaaaaaaaa",
    false,
    "twenty of one letter is a placeholder: claude-mem's rule wants 40 characters and caura's an entropy floor",
  ],
  [
    "walrus: found",
    "github_pat_11ABCDEFG0abcdefghijklmnop",
    false,
    "a fine-grained token has 82 characters after the prefix (claude-mem, gitleaks); this one is spelt in words",
  ],
  [
    "graphCTX, walrus: found",
    "The dashboard needs Cookie: session=9f8e7d6c5b4a3 to load my profile",
    false,
    "no cookie rule: a cookie header names preferences as often as sessions",
  ],
  [
    "walrus: found",
    "My local override file has password=hunter2 and I never commit it",
    false,
    "claude-mem's generic value wants eight characters and a letter; a seven-character value stays",
  ],
];

describe("divergences from the sources, each on purpose", () => {
  test.each(DIVERGENT)("%s: %s", (_source, text, foundHere) => {
    expect(found(text)).toBe(foundHere);
  });
});
