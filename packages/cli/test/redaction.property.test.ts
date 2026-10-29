// Review P3-20 (card E0.4): no secret in a Postgres URL reaches the output,
// whatever characters it holds. Generated URLs carry a secret, raw or
// percent-encoded, in the userinfo or a query value; the secret mixes
// letters that occur in no label or driver error with `?`, `#`, `@`, `/`,
// `%`, `:` and spaces. Neither the secret nor any 4-character piece of it
// holding a letter may appear in the label, the usage error, or openDb's
// error, and a URL that parses keeps its host visible.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { dbTarget, openDb, UsageError } from "../src/setup.ts";

/** FNV-1a of the test name: the seed, as packages/core/test/generators.ts does. */
function seedFor(name: string): number {
  let h = 2166136261;
  for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

const NAME = "no secret of a Postgres URL reaches the label or openDb's error";
/** Letters absent from every label (lowercase) and driver error (ECONNREFUSED, ENOTFOUND). */
const LETTERS = ["Q", "X", "Z", "J", "K", "W", "V", "Y"];
const SPECIAL = ["?", "#", "@", "/", "%", ":", " "];
const HOST = "127.0.0.1:1";
const where = { cwd: "/work", home: "/home/dana", env: {} };

/** Every piece of the secret that must not be printed: itself, and each 4-character window holding a letter. */
const pieces = (secret: string) => {
  const out = new Set([secret]);
  for (let i = 0; i + 4 <= secret.length; i++) {
    const w = secret.slice(i, i + 4);
    if (LETTERS.some((l) => w.includes(l))) out.add(w);
  }
  return [...out];
};

/** What the CLI would print for `url`: the label and openDb's error, or the usage error. */
function printed(url: string): { text: string; parsed: boolean } {
  let target: ReturnType<typeof dbTarget>;
  try {
    target = dbTarget(url, where);
  } catch (e) {
    expect(e).toBeInstanceOf(UsageError);
    return { text: (e as Error).message, parsed: false };
  }
  let error = "";
  try {
    openDb(target).close();
  } catch (e) {
    error = (e as Error).message;
  }
  return { text: `${target.label}\n${error}`, parsed: true };
}

function assertNoLeak(secret: string, url: string) {
  const { text, parsed } = printed(url);
  for (const piece of pieces(secret)) expect(text, `${url} printed ${piece}`).not.toContain(piece);
  const encoded = encodeURIComponent(secret);
  if (encoded !== secret) expect(text).not.toContain(encoded);
  if (parsed) expect(text, url).toContain(HOST);
}

const secretArb = fc
  .array(fc.constantFrom(...LETTERS, ...SPECIAL), { minLength: 1, maxLength: 14 })
  .map((cs) => cs.join(""))
  .filter((s) => LETTERS.some((l) => s.includes(l)));

const urlArb = fc.record({
  secret: secretArb,
  encoded: fc.boolean(),
  place: fc.constantFrom("userinfo", "password", "sslpassword", "apikey", "custom"),
  sslmode: fc.boolean(),
});

const build = (r: { secret: string; encoded: boolean; place: string; sslmode: boolean }) => {
  const s = r.encoded ? encodeURIComponent(r.secret) : r.secret;
  const extra = r.sslmode ? "sslmode=disable" : "";
  if (r.place === "userinfo")
    return `postgres://engram:${s}@${HOST}/dbname${extra ? `?${extra}` : ""}`;
  const q = `${r.place}=${s}`;
  return `postgres://${HOST}/dbname?${extra ? `${extra}&` : ""}${q}`;
};

describe("Postgres URL redaction (P3-20)", () => {
  it("the reviewer's URLs show no part of the password", () => {
    for (const [url, secret] of [
      ["postgres://u:pa?QMPWSECRET@127.0.0.1:1/db", "QMPWSECRET"],
      ["postgres://u:pa#HASHPWSECRET@127.0.0.1:1/db", "HASHPWSECRET"],
    ] as const) {
      const { text } = printed(url);
      expect(text).not.toContain(secret);
      expect(text).not.toContain("u:pa");
      expect(text).toContain("postgres://<hidden: unparseable>");
    }
  });

  it(NAME, { timeout: 120_000 }, () => {
    fc.assert(
      fc.property(urlArb, (r) => {
        assertNoLeak(r.secret, build(r));
      }),
      { numRuns: 60, seed: seedFor(NAME) },
    );
  });
});
