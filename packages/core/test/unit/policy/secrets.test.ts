// Card E2.9 (ADR 0039): the secret and personal-data guard at the write gate.
// The detector (policy/secrets.ts) over a write's content, the stage it adds
// to evaluateWrite, and the Plane's events around it. Every secret here is
// synthetic and assembled at run time from parts, so no file of the
// repository holds a string a secret scanner would take for a real key
// (docs/conventions/absorption.md: fixtures are synthetic; rule 12).
import { describe, expect, test } from "vitest";
import {
  BACKTRACKING_BOUND_MS,
  GITLEAKS_COMMIT,
  readToml,
  translate,
} from "../../../scripts/gitleaks-rules.ts";
import {
  ADVERSARIAL_LENGTH,
  adversarialInputs,
  FILLERS,
} from "../../../src/policy/backtracking.ts";
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
  SCAN_LIMIT,
  SECRET_ID,
  SECRET_TABLE,
  scan,
  shannonEntropy,
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

  test("a reason lists three matches and counts the rest", () => {
    const d = decide(
      guarded({ secrets: "block" }),
      [S.aws, S.github, S.stripe, S.google, S.slack].join(" "),
    );
    expect(d.reason).toMatch(/^the content holds 5 matches: .+ and 2 more; /);
  });

  test("a candidate write stays a candidate", () => {
    expect(decide(guarded({ secrets: "review" }), content, { status: "candidate" })).toMatchObject({
      status: "candidate",
      check: "review",
    });
  });

  test("an item landing retired is never judged: rejecting a held candidate retires it", () => {
    expect(decide(guarded({ secrets: "block" }), content, { status: "retired" })).toMatchObject({
      decision: "allow",
      check: "admit",
    });
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

  test("structured content is scanned through its keys and string values", () => {
    expect(decide(guarded({ secrets: "block" }), { deploy: { key: S.aws } })).toMatchObject({
      check: "content-guard",
    });
    expect(decide(guarded({ secrets: "block" }), { [S.github]: ["x", 3, null] })).toMatchObject({
      check: "content-guard",
    });
    expect(contentText({ a: ["b", { c: "d" }], e: 1, f: true })).toBe("a\nb\nc\nd\ne\n\nf\n");
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

describe("the review-held candidate goes the promotion path", () => {
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
  ];
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

  test("overlapping matches resolve to one: the longer, then the BLOCK tier", () => {
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

  // Half the generator's length, under the same bound: a linear rule takes a
  // few milliseconds here; a catastrophic one takes seconds.
  const LENGTH = ADVERSARIAL_LENGTH / 2;
  test.each(GUARD_RULES.map((r, i) => [i, r.kind, r] as const))(
    "rule %i, %s, runs every adversarial input within the bound",
    (_i, _kind, rule) => {
      for (const input of adversarialInputs(rule.keywords ?? [], LENGTH)) {
        const start = performance.now();
        for (const _ of input.matchAll(rule.pattern)) {
          // every match, as the scan takes them
        }
        expect(performance.now() - start).toBeLessThan(BACKTRACKING_BOUND_MS);
      }
    },
  );

  test("a rule over the bound is left out of the table", () => {
    const left = new Set(GITLEAKS_LEFT_OUT.map(([id]) => id));
    expect(left.size).toBeGreaterThan(0);
    expect(GITLEAKS_RULES.some((r) => left.has(r.id))).toBe(false);
    expect(GITLEAKS_LEFT_OUT.some(([, why]) => why.includes("backtracking bound"))).toBe(true);
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
