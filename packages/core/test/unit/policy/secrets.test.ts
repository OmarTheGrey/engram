// Card E2.9 (ADR 0039): the secret and personal-data guard at the write gate.
// The detector (policy/secrets.ts) over a write's content, the stage it adds
// to evaluateWrite, and the Plane's events around it. Every secret here is
// synthetic and assembled at run time from parts, so no file of the
// repository holds a string a secret scanner would take for a real key
// (docs/conventions/absorption.md: fixtures are synthetic; rule 12).
import { describe, expect, test } from "vitest";
import { admission } from "../../../scripts/admission.ts";
import { type GateFixture, gateFixtures, gateFixtureText } from "../../../scripts/faults.ts";
import { GITLEAKS_COMMIT, readToml, translate } from "../../../scripts/gitleaks-rules.ts";
import { adversarialInputs, FILLERS } from "../../../src/policy/backtracking.ts";
import { evaluateWrite } from "../../../src/policy/evaluate.ts";
import {
  CONTENT_SIZE_ID,
  contentBytes,
  contentGuard,
  contentText,
  describeFindings,
  type Finding,
  GUARD_FAILURE_ID,
  GUARD_RULES,
  type GuardRule,
  ibanMod97,
  luhn,
  PII_ID,
  REDACTIONS,
  readsAsWords,
  SCAN_LIMIT,
  SECRET_ID,
  SECRET_TABLE,
  scan,
  shannonEntropy,
  wordy,
} from "../../../src/policy/secrets.ts";
import type { ContentGuards, MemoryItem, Policy } from "../../../src/schema.ts";
import { GITLEAKS_LEFT_OUT, GITLEAKS_RULES } from "../../../src/vendor/gitleaks-rules.ts";
import { AT, fresh, item, testPolicy } from "../plane/helpers.ts";

// ---------------------------------------------------------------------------
// Synthetic values, built from parts and a seeded generator.

/** A small linear congruential generator: deterministic, seeded, never Math.random. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const UPPER_DIGIT = "ABCDEFGHJKLMNPQRSTUVWXYZ234567";
const HEX = "0123456789abcdef";
function draw(rand: () => number, alphabet: string, n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += alphabet[Math.floor(rand() * alphabet.length)];
  return out;
}
const j = (...parts: string[]) => parts.join("");

/** A card number of `n` digits passing Luhn, from a fixed prefix and a seed. */
function cardNumber(prefix: string, n: number, rand: () => number): string {
  let digits = prefix + draw(rand, "0123456789", n - prefix.length - 1);
  for (let c = 0; c < 10; c++)
    if (luhn(digits + String(c))) {
      digits += String(c);
      break;
    }
  return digits;
}

/** An IBAN with valid check digits for a country and a body. */
function iban(country: string, body: string): string {
  for (let c = 2; c < 99; c++) {
    const candidate = `${country}${String(c).padStart(2, "0")}${body}`;
    if (ibanMod97(candidate)) return candidate;
  }
  throw new Error("no check digits");
}

const rand = lcg(20261121);
const S = {
  aws: j("AK", "IA", draw(rand, UPPER_DIGIT, 16)),
  github: j("gh", "p_", draw(rand, ALNUM, 36)),
  stripe: j("sk", "_li", "ve_", draw(rand, ALNUM, 28)),
  slack: j("xo", "xb-", draw(rand, "0123456789", 12), "-", draw(rand, ALNUM, 24)),
  anthropic: j("sk", "-ant-", "api03-", draw(rand, ALNUM, 40)),
  google: j("AI", "za", draw(rand, ALNUM, 35)),
  jwt: j(
    "ey",
    "J",
    draw(rand, ALNUM, 20),
    ".ey",
    "J",
    draw(rand, ALNUM, 30),
    ".",
    draw(rand, ALNUM, 30),
  ),
  password: j("Hq", draw(rand, ALNUM, 4)),
  card: cardNumber("4", 16, rand),
  iban: iban("DE", "8937040044053201300"),
  hex: draw(rand, HEX, 64),
  blob: draw(rand, ALNUM, 40),
};

const pem = j(
  "-----BEGIN ",
  "RSA PRIVATE KEY-----\n",
  draw(rand, ALNUM, 64),
  "\n-----END RSA PRIVATE KEY-----",
);

const guarded = (content_guards: ContentGuards, over: Partial<Policy> = {}): Policy =>
  testPolicy({ content_guards, ...over });
const writer = {
  id: "person:omar",
  level: "person" as const,
  memberships: ["person:omar", "team:platform"],
  source: "user" as const,
};
const withContent = (content: MemoryItem["content"], over: Partial<MemoryItem> = {}) =>
  item(1, { content, ...over } as Partial<MemoryItem>);
const decide = (policy: Policy, content: MemoryItem["content"], over: Partial<MemoryItem> = {}) =>
  evaluateWrite(policy, writer, withContent(content, over), undefined, new Map());

/** Every substring of `value` of `n` characters. */
const pieces = (value: string, n = 4) =>
  Array.from({ length: value.length - n + 1 }, (_, i) => value.slice(i, i + n));
const holdsPiece = (text: string, value: string) => pieces(value).some((p) => text.includes(p));

const kinds = (findings: Finding[]) => findings.map((f) => f.kind);
const both = new Set(["secrets", "pii"] as const);

// ---------------------------------------------------------------------------

describe("the stage in evaluateWrite: the policy decides the outcome", () => {
  const content = `the deploy key is ${S.aws} for staging`;

  test("a policy without content_guards behaves as before", () => {
    expect(decide(testPolicy(), content)).toMatchObject({ decision: "allow", check: "admit" });
  });

  test.each([
    ["an empty block", {}],
    ["every guard off", { secrets: "off", pii: "off" }],
  ] as const)("%s does nothing", (_name, block) => {
    expect(decide(guarded(block), content)).toMatchObject({ decision: "allow", check: "admit" });
  });

  test("block denies a recognised secret, naming its kind and length, under engram/write/secret", () => {
    const d = decide(guarded({ secrets: "block" }), content);
    expect(d).toEqual({
      decision: "deny",
      status: null,
      check: "content-guard",
      reason:
        "the content holds secret/aws-access-key (20 characters); the policy's secrets guard blocks it",
      policy_id: SECRET_ID,
    });
  });

  test("review holds it as a candidate, as requires_review does", () => {
    const d = decide(guarded({ secrets: "review" }), content);
    expect(d).toEqual({
      decision: "allow",
      status: "candidate",
      check: "review",
      reason:
        "the content holds secret/aws-access-key (20 characters); the policy's secrets guard is review; stored as a candidate until a reviewer promotes it",
      policy_id: SECRET_ID,
    });
  });

  test("under block a REVIEW-tier match is held, not denied", () => {
    const d = decide(guarded({ secrets: "block" }), `our signing key: ${S.hex}`);
    expect(d).toMatchObject({ decision: "allow", status: "candidate", check: "review" });
    expect(d.reason).toContain("secret/hex-near-keyword (64 characters)");
    expect(d.reason).toContain("a review-tier match is held");
  });

  test("personal data is the pii guard's, under engram/write/pii", () => {
    const text = `card ${S.card} on file`;
    expect(decide(guarded({ pii: "block" }), text)).toMatchObject({
      decision: "deny",
      policy_id: PII_ID,
      reason:
        "the content holds pii/payment-card (16 characters); the policy's pii guard blocks it",
    });
    expect(decide(guarded({ secrets: "block" }), text)).toMatchObject({ check: "admit" });
    expect(decide(guarded({ pii: "review" }), text)).toMatchObject({
      status: "candidate",
      policy_id: PII_ID,
    });
  });

  test("the deciding match is the first that blocks, whichever guard it belongs to", () => {
    const d = decide(guarded({ secrets: "review", pii: "block" }), `${S.aws} and ${S.iban}`);
    expect(d).toMatchObject({ decision: "deny", policy_id: PII_ID });
    expect(d.reason).toBe(
      "the content holds 2 matches: secret/aws-access-key (20 characters), pii/iban (23 characters); the policy's pii guard blocks it",
    );
  });

  test("a reason lists three matches and counts the rest, when no match decides early", () => {
    // pii blocks and nothing is personal data: every secret is held, so the
    // scan runs to the end.
    const d = decide(
      guarded({ secrets: "review", pii: "block" }),
      [S.aws, S.github, S.stripe, S.google, S.slack].join(" "),
    );
    expect(d.reason).toMatch(/^the content holds 5 matches: .+ and 2 more; /);
  });

  test("the scan stops at the first match that decides (E2.9-1)", () => {
    const text = [S.aws, S.github, S.stripe].join(" ");
    expect(decide(guarded({ secrets: "block" }), text).reason).toBe(
      "the content holds secret/aws-access-key (20 characters); the policy's secrets guard blocks it",
    );
    // With no guard in block, the first match of any kind decides the hold.
    expect(decide(guarded({ secrets: "review" }), text).reason).toMatch(
      /^the content holds secret\/aws-access-key \(20 characters\); /,
    );
    // A deciding match is never displaced by an overlapping one that does not decide.
    const overlapping: GuardRule[] = [
      { kind: "secret/wide", guard: "secrets", tier: "block", pattern: /abcdef/dg },
      { kind: "pii/narrow", guard: "pii", tier: "block", pattern: /cd/dg },
    ];
    const kept = scan("abcdef", both, overlapping, (f) => f.guard === "pii");
    expect(kept.map((f) => f.kind)).toEqual(["pii/narrow"]);
    expect(scan("abcdef", both, overlapping).map((f) => f.kind)).toEqual(["secret/wide"]);
  });

  test("a candidate write stays a candidate", () => {
    expect(decide(guarded({ secrets: "review" }), content, { status: "candidate" })).toMatchObject({
      status: "candidate",
      check: "review",
    });
  });

  test("a new item written retired is judged (E2.9-4)", () => {
    expect(decide(guarded({ secrets: "block" }), content, { status: "retired" })).toMatchObject({
      decision: "deny",
      check: "content-guard",
      policy_id: SECRET_ID,
    });
    expect(decide(guarded({ secrets: "review" }), content, { status: "retired" })).toMatchObject({
      decision: "allow",
      status: "retired",
      check: "review",
    });
  });

  test("retiring a held candidate unchanged is not judged: that is how it is rejected", () => {
    const held = withContent(content, { status: "candidate" });
    const rejected = withContent(content, { status: "retired", version: 2 });
    expect(
      evaluateWrite(guarded({ secrets: "block" }), writer, rejected, held, new Map()),
    ).toMatchObject({ decision: "allow", check: "admit" });
    // Retiring it with new content is judged.
    expect(
      evaluateWrite(
        guarded({ secrets: "block" }),
        writer,
        withContent(`${content}.`, { status: "retired", version: 2 }),
        held,
        new Map(),
      ),
    ).toMatchObject({ check: "content-guard" });
  });

  test("a rewrite of an active item keeping its content is not judged again", () => {
    const policy = guarded({ secrets: "block" });
    const existing = withContent(content);
    const rewrite = withContent(content, { version: 2, confidence: 0.8 });
    expect(evaluateWrite(policy, writer, rewrite, existing, new Map())).toMatchObject({
      check: "admit",
    });
    // A held candidate's content is judged on every write that keeps it a candidate.
    const held = withContent(content, { status: "candidate" });
    expect(evaluateWrite(policy, writer, rewrite, held, new Map())).toMatchObject({
      check: "content-guard",
    });
    // And new content is judged.
    expect(
      evaluateWrite(
        policy,
        writer,
        withContent(`${content}!`, { version: 2 }),
        existing,
        new Map(),
      ),
    ).toMatchObject({ check: "content-guard" });
  });

  test("an unchanged rewrite that moves the item or changes its class is judged (E2.9-3)", () => {
    const policy = guarded({ secrets: "block" });
    const existing = withContent(content, { scope: "person:omar" });
    const moved = withContent(content, { scope: "team:platform", version: 2 });
    expect(evaluateWrite(policy, writer, moved, existing, new Map())).toMatchObject({
      check: "content-guard",
      policy_id: SECRET_ID,
    });
    const reclassed = withContent(content, { scope: "person:omar", class: "episodic", version: 2 });
    const anyClass = {
      ...policy,
      write: policy.write.map((w) => ({ ...w, forbidden_classes: [] })),
    };
    expect(evaluateWrite(anyClass, writer, reclassed, existing, new Map())).toMatchObject({
      check: "content-guard",
    });
  });

  test("the guard runs after every access check: a non-member learns nothing of the content", () => {
    const d = evaluateWrite(
      guarded({ secrets: "block" }),
      { ...writer, memberships: ["person:omar"] },
      withContent(content),
      undefined,
      new Map(),
    );
    expect(d).toMatchObject({ check: "not-member" });
  });

  test("the guard runs before review: its reason replaces the scope's", () => {
    const d = evaluateWrite(
      guarded({ secrets: "review" }),
      { ...writer, memberships: [...writer.memberships, "org"] },
      withContent(content, { scope: "org" }),
      undefined,
      new Map(),
    );
    expect(d).toMatchObject({ check: "review", policy_id: SECRET_ID });
    expect(d.reason).not.toContain("org scope requires review");
  });

  test("structured content is scanned through its keys, string values and numbers", () => {
    expect(decide(guarded({ secrets: "block" }), { deploy: { key: S.aws } })).toMatchObject({
      check: "content-guard",
    });
    expect(decide(guarded({ secrets: "block" }), { [S.github]: ["x", 3, null] })).toMatchObject({
      check: "content-guard",
    });
    expect(contentText({ a: ["b", { c: "d" }], e: 1, f: true })).toBe("a\nb\nc\nd\ne\n1\nf\n");
    expect(contentText(12n)).toBe("12");
  });

  test("a card number stored as a number is scanned (E2.9-2)", () => {
    expect(decide(guarded({ pii: "block" }), { card: Number(S.card) })).toMatchObject({
      decision: "deny",
      policy_id: PII_ID,
    });
  });
});

describe("max_content_bytes", () => {
  test("content larger than the limit is denied under engram/write/content-size", () => {
    const policy = guarded({ max_content_bytes: 10 });
    expect(decide(policy, "0123456789")).toMatchObject({ check: "admit" });
    expect(decide(policy, "0123456789a")).toEqual({
      decision: "deny",
      status: null,
      check: "content-guard",
      reason: "the content is 11 bytes, above the policy's max_content_bytes of 10",
      policy_id: CONTENT_SIZE_ID,
    });
  });

  test("bytes are UTF-8, and structured content is measured as canonical JSON", () => {
    expect(contentBytes("é")).toBe(2);
    expect(contentBytes({ b: 1, a: "x" })).toBe('{"a":"x","b":1}'.length);
    expect(decide(guarded({ max_content_bytes: 9 }), "ééééé")).toMatchObject({
      policy_id: CONTENT_SIZE_ID,
    });
  });

  test("it applies with the secret and pii guards off, and before them", () => {
    const d = decide(guarded({ max_content_bytes: 5, secrets: "block" }), S.aws);
    expect(d).toMatchObject({ policy_id: CONTENT_SIZE_ID });
  });
});

describe("a rule that fails, fails closed (decision 6)", () => {
  const thrower: GuardRule = {
    kind: "secret/broken",
    guard: "secrets",
    tier: "block",
    pattern: /x/dg,
    validate: () => {
      throw new Error(`a message holding ${S.aws}`);
    },
  };

  test("a rule that throws holds the write, naming the rule and nothing it was given", () => {
    const d = contentGuard(guarded({ secrets: "block" }), withContent("x marks it"), undefined, [
      thrower,
    ]);
    expect(d).toEqual({
      decision: "allow",
      status: "candidate",
      check: "review",
      reason:
        "the content guard rule secret/broken failed, so it fails closed; stored as a candidate until a reviewer promotes it",
      policy_id: GUARD_FAILURE_ID,
    });
  });

  test("a rule of a guard that is off is not run", () => {
    expect(
      contentGuard(guarded({ pii: "block" }), withContent("x"), undefined, [thrower]),
    ).toBeNull();
  });

  test("content beyond the scan bound is held, not scanned", () => {
    const d = decide(guarded({ pii: "review" }), "a".repeat(SCAN_LIMIT + 1));
    expect(d).toMatchObject({ status: "candidate", policy_id: GUARD_FAILURE_ID });
    expect(d.reason).toContain(`beyond the ${SCAN_LIMIT} a content guard scans`);
    expect(decide(guarded({ max_content_bytes: 10 }), "a".repeat(10))).toMatchObject({
      check: "admit",
    });
  });
});

describe("the value never leaks", () => {
  // Secrets of several lengths, each with the guard that recognises it.
  const planted: [string, string, keyof ContentGuards][] = [
    ["a 6-character password in a URL", S.password, "secrets"],
    ["a 20-character AWS key id", S.aws, "secrets"],
    ["a 40-character GitHub token", S.github, "secrets"],
    ["a JWT", S.jwt, "secrets"],
    ["a 16-digit card number", S.card, "pii"],
    ["a 23-character IBAN", S.iban, "pii"],
  ];
  const sentence = (value: string) =>
    value === S.password
      ? `the db is postgres://app:${value}@db.internal:5432/prod`
      : `remember ${value} for the deploy`;

  test.each(planted)(
    "%s: no event field and no reason holds 4 of its characters",
    async (_n, value, guard) => {
      for (const mode of ["block", "review"] as const) {
        const { plane } = fresh(guarded({ [guard]: mode }));
        const it = withContent(sentence(value));
        const checked = await plane.checkWrite(writer, it, AT);
        expect(checked.decision).toBe(mode === "block" ? "deny" : "allow");
        expect(holdsPiece(JSON.stringify(checked), value)).toBe(false);
        const { event } = await plane.write(writer, it, AT);
        expect(event.policy_id).toBe(guard === "secrets" ? SECRET_ID : PII_ID);
        const read = await plane.read(writer, { text: "deploy", at: AT });
        expect(read.items).toEqual([]);
        const explained = await plane.explain(writer, read.event.id);
        expect(holdsPiece(JSON.stringify(explained), value)).toBe(false);
        for (const e of plane.events()) {
          // A held candidate is stored as written, by design (ADR 0039, decision
          // 3): its item is the one field that holds the content.
          const { item: stored, ...rest } = e;
          expect(holdsPiece(JSON.stringify(rest), value)).toBe(false);
          if (e.op !== "write") continue;
          if (mode === "block") expect(stored).toBeUndefined();
          else expect(stored?.status).toBe("candidate");
        }
      }
    },
  );

  test("a PEM block's body never reaches the reason", () => {
    const d = decide(guarded({ secrets: "block" }), pem);
    expect(d.reason).toContain("private-key");
    expect(holdsPiece(d.reason, pem.split("\n")[1] as string)).toBe(false);
  });

  test("describeFindings says kinds and lengths only", () => {
    expect(
      describeFindings([{ kind: "secret/x", guard: "secrets", tier: "block", start: 3, end: 11 }]),
    ).toBe("the content holds secret/x (8 characters)");
  });
});

describe("the limits research/configs/secret-guard.json states (E2.9-5)", () => {
  // Each is an evasion the review confirmed. When a change closes one, this
  // test fails, and the limit leaves the config with it.
  const key = S.aws;
  test.each([
    ["a zero-width space inside a key", `key ${key.slice(0, 8)}​${key.slice(8)}`],
    [
      "a key split across a line break",
      `key ${key.slice(0, 10)}
${key.slice(10)}`,
    ],
    ["a key in base64", `key ${Buffer.from(key).toString("base64")}`],
    [
      "a key in full-width characters",
      `key ${[...key.slice(0, 4)].map((c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)).join("")}${key.slice(4)}`,
    ],
    ["a bare 9-digit SSN", "my number is 123456789"],
    ["hexadecimal after sha256:", `api key sha256:${S.hex}`],
  ])("%s is not found as its kind", (_what, text) => {
    // At most the entropy rule holds a long encoded run at REVIEW.
    expect(kinds(scan(text, both)).filter((k) => k !== "secret/high-entropy")).toEqual([]);
  });

  test("a key split between a JSON key and its value is not found", () => {
    expect(
      decide(guarded({ secrets: "block" }), { [key.slice(0, 10)]: key.slice(10) }),
    ).toMatchObject({
      check: "admit",
    });
  });
});

describe("the review-held candidate goes the promotion path", () => {
  test("its owner rejects it by retiring it unchanged, under block as under review (E2.9-4)", async () => {
    for (const mode of ["review", "block"] as const) {
      const { plane, deps } = fresh(guarded({ secrets: "review" }));
      const it = withContent(`the deploy key is ${S.aws}`);
      const held = await plane.write(writer, it, AT);
      expect(held.item?.status).toBe("candidate");
      deps.policy.content_guards = { secrets: mode };
      const rejected = await plane.write(
        writer,
        { ...(held.item as MemoryItem), status: "retired", version: 2, store_ref: null },
        AT,
      );
      expect(rejected.event.decision).toBe("allow");
      expect(rejected.item?.status).toBe("retired");
    }
  });

  test("the promotion's reasons name the content guard, not the scope (E2.9-7)", async () => {
    const { plane } = fresh(guarded({ secrets: "review" }));
    const it = withContent(`the deploy key is ${S.aws}`);
    await plane.write(writer, it, AT);
    const reviewer = {
      ...writer,
      id: "person:dana",
      memberships: ["person:dana", "team:platform"],
    };
    const asked = await plane.promote(writer, it.id, "team:platform", AT);
    expect(asked.event.reason).toContain(`the content guard holds it (${SECRET_ID})`);
    expect(asked.event.reason).not.toContain("team:platform requires review");
    const promoted = await plane.promote(reviewer, it.id, "team:platform", AT, { review: true });
    expect(promoted.event.reason).toContain(
      `the content guard held it (${SECRET_ID}), which person:dana gave`,
    );
    expect(promoted.event.reason).not.toContain("scope requires review");
  });

  test("no read returns it; a reviewer may promote it, after which reads do", async () => {
    const { plane } = fresh(guarded({ secrets: "review" }));
    const it = withContent(`the deploy key is ${S.aws}`);
    const { event } = await plane.write(writer, it, AT);
    expect(event).toMatchObject({ decision: "allow", policy_id: SECRET_ID });
    const reviewer = {
      ...writer,
      id: "person:dana",
      memberships: ["person:dana", "team:platform"],
    };
    const asked = await plane.promote(writer, it.id, "team:platform", AT);
    expect(asked.decision).toBe("ask");
    const promoted = await plane.promote(reviewer, it.id, "team:platform", AT, { review: true });
    expect(promoted.decision).toBe("allow");
    const read = await plane.read(writer, { text: "deploy", at: AT });
    expect(read.items.map((i) => i.id)).toEqual([it.id]);
  });

  test("under block a candidate holding a secret is not promoted", async () => {
    const { plane, deps } = fresh(guarded({ secrets: "review" }));
    const it = withContent(`the deploy key is ${S.aws}`);
    await plane.write(writer, it, AT);
    deps.policy.content_guards = { secrets: "block" };
    const reviewer = {
      ...writer,
      id: "person:dana",
      memberships: ["person:dana", "team:platform"],
    };
    const r = await plane.promote(reviewer, it.id, "team:platform", AT, { review: true });
    expect(r.event).toMatchObject({ decision: "deny", policy_id: SECRET_ID });
  });
});

describe("validators", () => {
  test("Luhn: valid numbers, a wrong check digit, too few digits, one repeated digit", () => {
    expect(luhn(S.card)).toBe(true);
    expect(luhn("4111 1111 1111 1111")).toBe(true);
    expect(luhn("4111 1111 1111 1112")).toBe(false);
    expect(luhn("4111111111")).toBe(false);
    expect(luhn("0000000000000000")).toBe(false);
  });

  test("mod-97: valid IBANs, a wrong check, a bad length, a character outside the alphabet", () => {
    expect(ibanMod97("GB82 WEST 1234 5698 7654 32")).toBe(true);
    expect(ibanMod97(S.iban)).toBe(true);
    expect(ibanMod97("GB83 WEST 1234 5698 7654 32")).toBe(false);
    expect(ibanMod97("GB82WEST")).toBe(false);
    expect(ibanMod97("GB82-WEST-1234-5698-7654-32")).toBe(false);
  });

  test("Shannon entropy", () => {
    expect(shannonEntropy("aaaa")).toBe(0);
    expect(shannonEntropy("abcd")).toBe(2);
  });

  test("a card-shaped number failing Luhn, and an IBAN failing mod-97, are not personal data", () => {
    expect(scan("order 4111 1111 1111 1112 shipped", both)).toEqual([]);
    expect(scan("account GB83WEST12345698765432", both)).toEqual([]);
  });
});

describe("false positives: identifiers that are never a secret", () => {
  const r = lcg(7);
  const sha = () => draw(r, HEX, 40);
  const uuid4 = () =>
    `${draw(r, HEX, 8)}-${draw(r, HEX, 4)}-4${draw(r, HEX, 3)}-a${draw(r, HEX, 3)}-${draw(r, HEX, 12)}`;
  const uuid7 = () =>
    `0195${draw(r, HEX, 4)}-${draw(r, HEX, 4)}-7${draw(r, HEX, 3)}-8${draw(r, HEX, 3)}-${draw(r, HEX, 12)}`;
  const hash = () => `sha256:${draw(r, HEX, 64)}`;
  const IAM = [
    "s3:GetObject",
    "s3:PutObjectAcl",
    "iam:PassRole",
    "sts:AssumeRoleWithWebIdentity",
    "kms:GenerateDataKeyWithoutPlaintext",
    "secretsmanager:GetSecretValue",
    "ssm:GetParametersByPath",
    "ec2:DescribeInstances",
    "dynamodb:BatchWriteItem",
    "lambda:InvokeFunction",
    "ecr:GetAuthorizationToken",
    "logs:CreateLogStream",
  ];
  const samples: [string, () => string][] = [
    ["a git SHA", () => `commit ${sha()} fixed the build`],
    ["a short git SHA", () => `see ${sha().slice(0, 7)} and ${sha().slice(0, 12)}`],
    ["a UUID", () => `request ${uuid4()} failed`],
    ["a uuidv7 id", () => `item ${uuid7()} was retired`],
    ["an Engram content hash", () => `provenance hash ${hash()}`],
    [
      "a cloud IAM action",
      () => `the role needs ${IAM[Math.floor(r() * IAM.length)]} on the bucket`,
    ],
  ];
  test.each(samples)("%s is not flagged by either guard", (_name, make) => {
    for (let n = 0; n < 50; n++) expect(scan(make(), both)).toEqual([]);
  });

  test("IAM actions beside a credential word, and repository paths, are not key material", () => {
    expect(
      scan("the role needs secretsmanager:GetSecretValue and ecr:GetAuthorizationToken", both),
    ).toEqual([]);
    expect(
      scan(
        "the secret scanners: secretlint/secretlint-rule-preset-recommend and 9thLevelSoftware/Daem0n-MCP",
        both,
      ),
    ).toEqual([]);
    expect(
      scan(
        "make run CONFIG=research/configs/b1-gatemem-reference MODEL=openrouter/openai/gpt-5",
        both,
      ),
    ).toEqual([]);
    expect(readsAsWords("GetAuthorizationToken")).toBe(true);
    expect(readsAsWords("Hynix-Memory-Roadmap-2026-Plan")).toBe(true);
    expect(readsAsWords("Zq8kLmW2pR")).toBe(false);
    expect(readsAsWords("--")).toBe(false);
    expect(wordy("owner/repo-name")).toBe(true);
    expect(wordy("a/b")).toBe(false);
    expect(wordy(S.blob)).toBe(false);
  });

  test("a documentation placeholder in a URL is no password", () => {
    for (const pw of ["password", "pw", "changeme", "xxxx", "****", "test"])
      expect(scan(`postgres://user:${pw}@host:5432/db`, both), pw).toEqual([]);
  });

  test("every IAM action at once, in a policy document", () => {
    expect(scan(JSON.stringify({ Action: IAM, Effect: "Allow" }), both)).toEqual([]);
  });

  test("a hex run is key material only beside a credential word (walrus, both sides)", () => {
    expect(kinds(scan(`the commit is ${S.hex}`, both))).toEqual([]);
    expect(kinds(scan(`api key ${S.hex}`, both))).toEqual(["secret/hex-near-keyword"]);
    expect(kinds(scan(`${S.hex} is my private key`, both))).toEqual(["secret/hex-near-keyword"]);
  });
});

describe("each hand-written rule finds what it names", () => {
  const r = lcg(11);
  const cases: [string, string][] = [
    ["secret/aws-access-key", `id ${S.aws}`],
    ["secret/aws-secret-key", `aws_secret_access_key = ${draw(r, ALNUM, 40)}`],
    ["secret/aws-session-token", `aws_session_token=${draw(r, ALNUM, 120)}`],
    ["secret/github-token", S.github],
    ["secret/openai-key", j("sk", "-proj-", draw(r, ALNUM, 40))],
    ["secret/anthropic-key", S.anthropic],
    ["secret/slack-token", S.slack],
    ["secret/jwt", S.jwt],
    ["secret/private-key", pem],
    ["secret/stripe-key", S.stripe],
    ["secret/google-api-key", S.google],
    ["secret/google-oauth-token", j("ya", "29.", draw(r, ALNUM, 40))],
    ["secret/gitlab-token", j("gl", "pat-", draw(r, ALNUM, 20))],
    ["secret/huggingface-token", j("hf", "_", draw(r, ALNUM, 34))],
    ["secret/npm-token", j("np", "m_", draw(r, ALNUM, 36))],
    ["secret/url-credentials", "postgres://app:hunter2x@db.internal/prod"],
    [
      "secret/seed-phrase",
      "my seed phrase is apple river stone cloud tiger maple ocean violet ember canyon frost lunar",
    ],
    ["secret/generic-password", "DB_PASSWORD=Zx9kQ2mL7pR4"],
    ["secret/generic-token", `--auth-token ${draw(r, ALNUM, 24)}`],
    ["secret/bearer-token", `Authorization: Bearer ${draw(r, ALNUM, 30)}`],
    ["secret/labelled-key-material", `the signing key is ${draw(r, ALNUM, 30)}`],
    ["secret/high-entropy", `value ${S.blob}`],
    ["pii/email", "write to dana.k@example.org today"],
    ["pii/phone", "call +44 20 7946 0958"],
    ["pii/phone", "call (212) 555-0198"],
    ["pii/phone", "office 020 7946 0958"],
    ["pii/phone", "mobile 07700900123"],
    ["pii/phone", "phone: 02079460958"],
    ["pii/payment-card", `card ${S.card}`],
    ["pii/iban", S.iban],
    ["pii/us-ssn", "ssn 123-45-6789"],
    ["pii/us-ssn", "SSN: 123456789"],
    ["pii/uk-nino", "NI AB 12 34 56 C"],
    ["pii/us-itin", "itin 912-78-1234"],
    ["pii/us-itin", "ITIN 912781234"],
    ["pii/es-dni", "dni 12345678Z"],
    ["pii/es-dni", "NIF 12345678 Z"],
    ["secret/docker-pat", j("dckr", "_pat_", draw(r, ALNUM, 27))],
    ["secret/linear-key", j("lin", "_api_", draw(r, ALNUM, 40))],
    ["secret/notion-token", j("nt", "n_", draw(r, ALNUM, 46))],
    ["secret/sendgrid-key", j("S", "G.", draw(r, ALNUM, 22), ".", draw(r, ALNUM, 43))],
    ["secret/digitalocean-token", j("do", "p_v1_", draw(r, HEX, 64))],
    ["secret/shopify-token", j("shp", "at_", draw(r, HEX, 32))],
    ["secret/pypi-token", j("py", "pi-AgE", draw(r, ALNUM, 60))],
    ["secret/databricks-token", j("da", "pi", draw(r, HEX, 32))],
    ["secret/vault-token", j("hv", "s.", draw(r, ALNUM, 100))],
    ["secret/nvidia-nim-key", j("nva", "pi-", draw(r, ALNUM, 40))],
    ["secret/groq-key", j("gs", "k_", draw(r, ALNUM, 52))],
    ["secret/xai-key", j("xa", "i-", draw(r, ALNUM, 80))],
    ["secret/perplexity-key", j("ppl", "x-", draw(r, ALNUM, 48))],
    ["secret/supabase-token", j("sb", "p_", draw(r, HEX, 40))],
    ["secret/sentry-token", j("sntr", "yu_", draw(r, HEX, 64))],
    ["secret/grafana-token", j("gl", "sa_", draw(r, ALNUM, 32), "_", draw(r, HEX, 8))],
    ["secret/postman-key", j("PM", "AK-", draw(r, HEX, 24), "-", draw(r, HEX, 34))],
    ["secret/pulumi-token", j("pu", "l-", draw(r, HEX, 40))],
    ["secret/doppler-token", j("dp", ".pt.", draw(r, ALNUM, 43))],
    ["secret/heroku-key", j("HR", "KU-AA", draw(r, ALNUM, 58))],
    ["secret/atlassian-token", j("ATA", "TT3", draw(r, ALNUM, 186))],
    [
      "secret/slack-webhook",
      j("https://hooks.", "slack.com/services/T01ABCDEF/B02GHIJKL/", draw(r, ALNUM, 24)),
    ],
    [
      "secret/discord-webhook",
      j("https://discord.com/api/", "webhooks/123456789012345678/", draw(r, ALNUM, 68)),
    ],
    ["secret/env-credential", j("STORAGE_ACCESS_KEY=", draw(r, ALNUM, 24))],
    ["secret/hex-near-keyword", `api key ${S.hex}`],
    ["secret/labelled-distant", `the API token for prod is ${S.hex}`],
  ];

  test("every hand-written rule's kind has a positive case (E2.9-6)", () => {
    const kinds = new Set(
      GUARD_RULES.filter((g) => !g.kind.startsWith("secret/gitleaks/")).map((g) => g.kind),
    );
    expect([...kinds].filter((k) => !cases.some(([c]) => c === k))).toEqual([]);
  });
  test.each(cases)("%s", (kind, text) => {
    expect(kinds(scan(text, both))).toContain(kind);
  });

  test("near misses: a placeholder password, a public URL, a wrong DNI letter, a PWD", () => {
    expect(scan(`postgres://app:${"$"}{DB_PASS}@db/prod`, both)).toEqual([]);
    expect(scan("https://github.com/gitleaks/gitleaks", both)).toEqual([]);
    expect(scan("dni 12345678A", both)).toEqual([]);
    expect(scan("PWD=/home/dana/projects", both)).toEqual([]);
    expect(scan("phone: 020794609", both)).toEqual([]);
  });

  test("an upper-case environment variable naming an access key (caura)", () => {
    expect(kinds(scan(`STORAGE_ACCESS_KEY=${draw(r, ALNUM, 24)}`, both))).toEqual([
      "secret/env-credential",
    ]);
    expect(scan("STORAGE_ACCESS_KEY=aaaaaaaaaaaaaaaaaaaa", both)).toEqual([]);
  });

  test("gitleaks' generic rule wants a digit in its secret", () => {
    const secrets = new Set(["secrets"] as const);
    const generic = GUARD_RULES.filter((g) => g.kind === "secret/gitleaks/generic-api-key");
    expect(kinds(scan('api_key = "Qw3rTy8UiOp2AsDf5GhJ"', secrets, generic))).toEqual([
      "secret/gitleaks/generic-api-key",
    ]);
    expect(scan('api_key = "QwErTyUiOpAsDfGhJkLz"', secrets, generic)).toEqual([]);
  });

  test("a match inside a content hash is no match, and neither is an empty one or an absent group", () => {
    expect(scan(`the secret content hash is sha256:${S.hex}`, both)).toEqual([]);
    expect(
      kinds(scan(`a UUID ${"0".repeat(8)}-0000-7000-8000-${"0".repeat(12)} and ${S.aws}`, both)),
    ).toEqual(["secret/aws-access-key"]);
    expect(
      kinds(scan(`${S.aws} before a UUID ${"0".repeat(8)}-0000-7000-8000-${"0".repeat(12)}`, both)),
    ).toEqual(["secret/aws-access-key"]);
    const odd: GuardRule[] = [
      { kind: "secret/empty", guard: "secrets", tier: "block", pattern: /y?/dg },
      { kind: "secret/absent", guard: "secrets", tier: "block", pattern: /x(z)?/dg, group: 1 },
    ];
    expect(scan("x marks it", new Set(["secrets"]), odd)).toEqual([]);
    // A gitleaks rule's secret is its first non-empty group, else the match.
    const first: GuardRule[] = [
      {
        kind: "secret/first",
        guard: "secrets",
        tier: "block",
        pattern: /q(z)?()(b+)/dg,
        group: "first",
      },
      { kind: "secret/whole", guard: "secrets", tier: "block", pattern: /w()v/dg, group: "first" },
    ];
    expect(scan("qbb wv", new Set(["secrets"]), first)).toEqual([
      { kind: "secret/first", guard: "secrets", tier: "block", start: 1, end: 3 },
      { kind: "secret/whole", guard: "secrets", tier: "block", start: 4, end: 6 },
    ]);
  });

  test("a key beside CJK text is found (Hindsight's ASCII lookarounds)", () => {
    expect(kinds(scan(`凭证为${S.aws}请保管`, both))).toEqual(["secret/aws-access-key"]);
    expect(kinds(scan(`prefix${S.aws}`, both))).not.toContain("secret/aws-access-key");
  });

  test("overlapping matches resolve to one: the BLOCK tier, then the earlier rule", () => {
    const found = scan(`token ${S.github}`, both);
    expect(found).toHaveLength(1);
    expect(found[0]?.tier).toBe("block");
  });

  test("a gitleaks rule finds what the hand table does not", () => {
    const text = j(
      "my age key AGE-SECRET-KEY-1",
      "QPZRY9X8GF2TVDW0S3JN54KHCE6MUA7L".repeat(2).slice(0, 58),
    );
    expect(kinds(scan(text, both))).toContain("secret/gitleaks/age-secret-key");
    // Its line runs to the next line break, which ends it.
    expect(
      kinds(
        scan(
          `${text}
the next line`,
          both,
        ),
      ),
    ).toContain("secret/gitleaks/age-secret-key");
  });

  test("a gitleaks rule's allowlist and stopwords hold", () => {
    // aws-access-token allows keys ending EXAMPLE; the global allowlist takes `${VAR}` values.
    expect(kinds(scan(j("AK", "IAIOSFODNN7EXAMPLE"), new Set(["secrets"])))).not.toContain(
      "secret/gitleaks/aws-access-token",
    );
  });
});

describe("one table with the redactor in plane/bypass.ts", () => {
  test("the redactor's entries are the first of the table, in their order, and are no guard rules", () => {
    const entries = SECRET_TABLE.filter((e) => e.redact !== undefined);
    expect(entries.map((e) => e.kind)).toEqual([
      "secret/named-assignment",
      "secret/flag-value",
      "secret/bearer",
      "secret/url-userinfo",
      "secret/sk-key",
      "secret/long-token",
    ]);
    expect(SECRET_TABLE.slice(0, 6)).toEqual(entries);
    expect(entries.every((e) => e.rule === undefined)).toBe(true);
    expect(REDACTIONS.map(([p]) => p)).toEqual(entries.map((e) => e.pattern));
    expect(GUARD_RULES).toHaveLength(SECRET_TABLE.length - 6);
  });

  test("every guard rule's pattern is global with indices, and every kind is named for its guard", () => {
    for (const rule of GUARD_RULES) {
      expect(rule.pattern.flags).toContain("g");
      expect(rule.pattern.flags).toContain("d");
      expect(rule.kind.startsWith(rule.guard === "secrets" ? "secret/" : "pii/")).toBe(true);
    }
  });
});

describe("backtracking: every rule is timed before it is admitted", () => {
  test("the inputs: every filler alone, then each of two keywords with each filler", () => {
    expect(adversarialInputs()).toHaveLength(FILLERS.length);
    const inputs = adversarialInputs(["abc", "de", "unused"], 64);
    expect(inputs).toHaveLength(FILLERS.length * 5);
    expect(inputs.every((s) => s.length === 64)).toBe(true);
    expect(inputs[FILLERS.length]?.startsWith("abcaabca")).toBe(true);
    expect(adversarialInputs(["x".repeat(10)], 4).at(-1)).toBe("xxxxxxxxxx");
  });

  // Admission (scripts/admission.ts): growth from n to 4n under 6 times, and
  // cost under 20 times gitleaks' keyword prefix, both machine-independent
  // ratios. The hand rules are judged here; gitleaks' rules by the generator,
  // whose verdicts the generated table records.
  const HAND = GUARD_RULES.filter((r) => !r.kind.startsWith("secret/gitleaks/"));
  test.each(HAND.map((r, i) => [i, r.kind, r] as const))(
    "hand rule %i, %s, is admitted",
    (_i, _kind, rule) => {
      expect(
        admission(rule.pattern.source, rule.pattern.flags.replace("d", ""), rule.keywords ?? []),
      ).toEqual({ admitted: true });
    },
  );

  test("admission refuses a quadratic rule and a slow linear one", () => {
    // A long local part with no `@`: every start rescans the run (the email
    // rule before its anchor).
    expect(admission("\\b[A-Za-z0-9._%+-]+@[a-z]+\\.[a-z]{2,}", "", [], 1024)).toMatchObject({
      admitted: false,
      why: expect.stringContaining("grows faster than linearly"),
    });
    // A doubled lazy prefix: linear, and dozens of times slower.
    expect(
      admission(
        "[\\w.-]{0,50}?(?:[\\w.-]{0,50}?(?:key)(?:[ \\t\\w.-]{0,20}))=",
        "i",
        ["key"],
        1024,
      ),
    ).toMatchObject({ admitted: false, why: expect.stringContaining("costs over") });
  });

  test("the generator left out what admission refused, and says why", () => {
    const left = new Map(GITLEAKS_LEFT_OUT);
    expect(GITLEAKS_RULES.some((r) => left.has(r.id))).toBe(false);
    expect(left.get("curl-auth-user")).toContain("grows faster than linearly");
    expect(left.get("okta-access-token")).toContain("costs over");
  });

  test("a full guard on SCAN_LIMIT characters finishes in under a second (E2.9-1)", () => {
    const fill = (unit: string) =>
      unit.repeat(Math.ceil(SCAN_LIMIT / unit.length)).slice(0, SCAN_LIMIT);
    for (const unit of ["a@b.co ", "aZ0-"])
      for (const content_guards of [
        { pii: "review" },
        { secrets: "block", pii: "block" },
        { secrets: "review", pii: "block" },
      ] as ContentGuards[]) {
        const start = performance.now();
        contentGuard(guarded(content_guards), withContent(fill(unit)), undefined);
        expect(performance.now() - start, `${unit} ${JSON.stringify(content_guards)}`).toBeLessThan(
          1000,
        );
      }
  });
});

describe("the gitleaks generator", () => {
  test("it pins the commit the generated table names", async () => {
    const { readFile } = await import("node:fs/promises");
    const generated = await readFile(
      new URL("../../../src/vendor/gitleaks-rules.ts", import.meta.url),
      "utf8",
    );
    expect(generated).toContain(`at commit\n// ${GITLEAKS_COMMIT}`);
  });

  test.each([
    ["(?i)abc", { source: "abc", flags: "i" }],
    ["a(?i)bc", { source: "a(?i:bc)", flags: "" }],
    ["(a(?i)b|c)d", { source: "(a(?i:b)|(?i:c))d", flags: "" }],
    ["x[[:alnum:]]y", { source: "x[A-Za-z0-9]y", flags: "" }],
    ["a\\z", { source: "a$", flags: "" }],
    ["\\Aa", { source: "^a", flags: "" }],
    ["(?P<k>a)", { source: "(?<k>a)", flags: "" }],
    ["[]a]", { source: "[\\]a]", flags: "" }],
    ["[^]a]", { source: "[^\\]a]", flags: "" }],
    ["(?-i:a)(?:b)", { source: "(?-i:a)(?:b)", flags: "" }],
  ])("translates %s", (re2, js) => {
    expect(translate(re2)).toEqual(js);
  });

  test.each([
    ["\\Qa\\E", "\\Q has no JavaScript equivalent"],
    ["\\pL", "\\p has no JavaScript equivalent"],
    ["(?s)a", "an inline flag JavaScript does not have"],
    ["[[:punct:]]", "a POSIX class with no JavaScript range"],
    ["a\\", "a trailing backslash"],
    ["(a", "JavaScript refuses it"],
  ])("leaves out %s", (re2, why) => {
    const t = translate(re2);
    expect("error" in t && t.error.startsWith(why)).toBe(true);
  });

  test("reads the TOML subset gitleaks uses", () => {
    const doc = readToml(
      [
        "# a comment",
        'title = "t"',
        "[allowlist]",
        "regexes = ['''a''', 'b', \"c\\\\d\"]",
        "[[rules]]",
        'id = "r"',
        "regex = '''x[^]]y'''",
        "entropy = 3.5",
        "keywords = [",
        '  "k",',
        "]",
        "[[rules.allowlists]]",
        'stopwords = ["s"]',
      ].join("\n"),
    );
    expect(doc.allowlist).toEqual({ regexes: ["a", "b", "c\\d"] });
    expect(doc.rules).toEqual([
      {
        id: "r",
        regex: "x[^]]y",
        entropy: 3.5,
        keywords: ["k"],
        allowlists: [{ stopwords: ["s"] }],
      },
    ]);
  });
});

describe("the secret-in-content fault fixtures (fixtures/faults/gate)", () => {
  const dir = new URL("../../../../../fixtures/faults/gate/", import.meta.url);
  test("are what packages/core/scripts/faults.ts generates (make fixtures)", async () => {
    const { readFile } = await import("node:fs/promises");
    const built = await gateFixtures();
    expect(Object.keys(built).sort()).toEqual([
      "gate/secret-in-content.flag",
      "gate/secret-in-content.near-miss",
    ]);
    for (const [name, f] of Object.entries(built)) {
      const file = new URL(`${name.replace("gate/", "")}.json`, dir);
      expect((await readFile(file, "utf8")).replaceAll("\r\n", "\n"), name).toBe(
        gateFixtureText(f),
      );
    }
  });

  test.each(["flag", "near-miss"])(
    "the %s fixture replays to its declared decisions",
    async (kind) => {
      const { readFile } = await import("node:fs/promises");
      const f = JSON.parse(
        await readFile(new URL(`secret-in-content.${kind}.json`, dir), "utf8"),
      ) as GateFixture;
      const { plane } = fresh(f.policy);
      for (const w of f.writes) {
        const r = await plane.write(f.actor, w.item, w.at);
        expect([r.event.decision, r.item?.status ?? null, r.event.policy_id]).toEqual([
          w.decision,
          w.status,
          w.policy_id,
        ]);
      }
      expect(plane.events().map((e) => [e.decision, e.policy_id, e.reason])).toEqual(
        f.events.map((e) => [e.decision, e.policy_id, e.reason]),
      );
    },
  );
});

describe("the verification pass (V-1 to V-9)", () => {
  const sha40 = "4e04a32b9c1d0e8f7a6b5c4d3e2f1a0b9c8d7e6f";
  const hex64 = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
  const opaque = "Zx9Qw8Er7Ty6Ui5Op4As3Df2Gh1Jk0LmNbVcXz7";

  // V-1: the three E2.9-8 fixes, each pinned by its probe.
  test.each([
    ["a cache key a sentence after seed", `run with seed 3, cache key ${hex64}`],
    ["a token count beside a commit", `the token count for commit ${sha40} was 4096`],
    ["a commit trailer's address", "Signed-off-by: Dana Kim <dana@example.org>"],
    ["a co-author trailer", "Co-Authored-By: Claude <noreply@anthropic.com>"],
  ])("%s is not held", (_what, text) => {
    expect(scan(text, both)).toEqual([]);
  });

  test("the label gate wants the word right before the value, `token` and `seed` only in an assignment", () => {
    // Inside the tight form the same values are held.
    expect(kinds(scan(`seed: ${hex64}`, both))).toEqual(["secret/hex-near-keyword"]);
    expect(kinds(scan(`the token=${hex64}`, both)).length).toBe(1);
    expect(kinds(scan(`api key ${hex64}`, both))).toEqual(["secret/hex-near-keyword"]);
  });

  test("AWS's documented example keys are allowed, a made-up key is not", () => {
    expect(scan(j("AKIA", "IOSFODNN7", "EXAMPLE"), both)).toEqual([]);
    expect(scan(j("value wJalrXUtnFEMI/K7MDENG/", "bPxRfiCYEXAMPLEKEY"), both)).toEqual([]);
    expect(kinds(scan(j("value wJalrXUtnFEMI/K7MDENG/", "bPxRfiCYEXAMPLEKEz"), both))).toEqual([
      "secret/high-entropy",
    ]);
    expect(kinds(scan(S.aws, both))).toEqual(["secret/aws-access-key"]);
  });

  // V-3(b): only the trailer's own address is exempt.
  test.each([
    [
      "an address later on an Author line",
      "Author: meeting notes. The customer is jane.doe@gmail.com",
    ],
    ["a bare address on a Reported-by line", "Reported-by: customer jane.doe@gmail.com"],
    [
      "a trailer word far back on the line",
      `Signed-off-by: ${"x".repeat(300)} <jane.doe@gmail.com>`,
    ],
    [
      "a trailer address followed by more text",
      "Signed-off-by: Dana <dana@example.org> and jane.doe@gmail.com",
    ],
  ])("%s is personal data", (_what, text) => {
    expect(kinds(scan(text, both))).toContain("pii/email");
  });

  // V-3(c): a strong credential word up to four words before a long value.
  test.each([
    `The API token for prod is ${hex64}`,
    `my github token is ${hex64}`,
    `the secret for staging is ${hex64}`,
    `The API token for prod is ${opaque}`,
  ])("%s is held at REVIEW", (text) => {
    const found = scan(text, both);
    expect(found).toHaveLength(1);
    expect(found[0]?.tier).toBe("review");
  });

  test("a git SHA-1 after a strong word is exempt, a word five words back does not count", () => {
    expect(scan(`token count for commit ${sha40}`, both)).toEqual([]);
    expect(scan(`the token we use in all of the builds is ${hex64}`, both)).toEqual([]);
    // Within four words a trace id after "session token" is held too: only
    // its meaning tells it from a credential (V-3 restores the wider reach).
    expect(kinds(scan(`session token cache miss, trace ${hex64}`, both))).toEqual([
      "secret/labelled-distant",
    ]);
  });

  // V-3(a): padding past the scan limit.
  test("content beyond SCAN_LIMIT is denied under block and held under review", () => {
    const padded = `${"x".repeat(SCAN_LIMIT)} ${S.aws}`;
    for (const content_guards of [{ secrets: "block" }, { pii: "block" }] as ContentGuards[])
      expect(decide(guarded(content_guards), padded)).toMatchObject({
        decision: "deny",
        status: null,
        policy_id: GUARD_FAILURE_ID,
        reason: expect.stringContaining(`beyond the ${SCAN_LIMIT} a content guard scans`),
      });
    expect(decide(guarded({ secrets: "review" }), padded)).toMatchObject({
      decision: "allow",
      status: "candidate",
      policy_id: GUARD_FAILURE_ID,
    });
  });

  // V-2: the other E2.9-1 fixes.
  test("the scan limit is at most 64K characters", () => {
    expect(SCAN_LIMIT).toBeLessThanOrEqual(65536);
  });

  test("content holding every gitleaks keyword over and over scans in under 5 s", () => {
    const keywords = [...new Set(GUARD_RULES.flatMap((r) => r.keywords ?? []))];
    for (const sep of ["_", "a"]) {
      const unit = `${keywords.join(sep)}${sep}`;
      const text = unit.repeat(Math.ceil(SCAN_LIMIT / unit.length)).slice(0, SCAN_LIMIT);
      const start = performance.now();
      contentGuard(guarded({ secrets: "block", pii: "block" }), withContent(text), undefined);
      expect(performance.now() - start, sep).toBeLessThan(5000);
    }
  });

  test("a hundred thousand overlapping findings resolve in under a second", () => {
    // Two rules whose matches chain into one cluster: a comparison of each
    // finding with every kept one takes minutes here.
    const chain: GuardRule[] = [
      { kind: "secret/ab", guard: "secrets", tier: "block", pattern: /ab/dg },
      { kind: "secret/ba", guard: "secrets", tier: "review", pattern: /ba/dg },
    ];
    const text = "ab".repeat(50_000);
    const start = performance.now();
    const found = scan(text, new Set(["secrets"]), chain);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(found).toHaveLength(50_000);
  });

  test("many matches on one long line look for their line within a bound", () => {
    // gitleaks' rules read the line around a match, and the email rule the
    // line before an address: on a text with no line break, an unbounded
    // search back to its start made this quadratic.
    const line = (unit: string) =>
      unit.repeat(Math.ceil(1_000_000 / unit.length)).slice(0, 1_000_000);
    const github = j("gh", "p_", draw(lcg(3), ALNUM, 36), " ");
    for (const [text, guards] of [
      [line(github), new Set(["secrets"] as const)],
      [line("a@b.co "), new Set(["pii"] as const)],
    ] as const) {
      const start = performance.now();
      expect(scan(text, guards).length).toBeGreaterThan(20_000);
      expect(performance.now() - start).toBeLessThan(5000);
    }
  });

  // V-7: a held write landing retired says so.
  test("a new item written retired and held is stored retired, and its reason says so", () => {
    const d = decide(guarded({ secrets: "review" }), `the deploy key is ${S.aws}`, {
      status: "retired",
    });
    expect(d).toMatchObject({ decision: "allow", status: "retired", check: "review" });
    expect(d.reason).toContain("stored retired, as written, which no read or promotion returns");
    expect(d.reason).not.toContain("until a reviewer promotes it");
  });

  // V-9: a rewrite that widens the grants is judged.
  test("an unchanged rewrite that adds a grant is judged, one that keeps or narrows them is not", () => {
    const policy = guarded({ secrets: "block" });
    const grant = {
      to: "person:dana",
      class: "semantic" as const,
      mode: "read" as const,
      expires: "2027-01-01T00:00:00Z",
    };
    const content = `the deploy key is ${S.aws}`;
    const existing = withContent(content, { grants: [grant] });
    const kept = withContent(content, { grants: [grant], version: 2 });
    const narrowed = withContent(content, { grants: [], version: 2 });
    const widened = withContent(content, {
      grants: [grant, { ...grant, to: "person:sara" }],
      version: 2,
    });
    expect(evaluateWrite(policy, writer, kept, existing, new Map())).toMatchObject({
      check: "admit",
    });
    expect(evaluateWrite(policy, writer, narrowed, existing, new Map())).toMatchObject({
      check: "admit",
    });
    expect(evaluateWrite(policy, writer, widened, existing, new Map())).toMatchObject({
      check: "content-guard",
      policy_id: SECRET_ID,
    });
  });
});
