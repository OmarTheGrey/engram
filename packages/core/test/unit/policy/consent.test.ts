// Card E9.12 of the second absorb plan: consent at the write gate. The
// loader takes the `consent` block card E2.14 put in the schema (its refusal
// lifted) and reports an opt-out that could never cover a write; topics match
// whole words of the content; the write gate denies a covered write under
// engram/write/consent with a reason naming the opt-out and never the
// content; a retire, a same-content rewrite and another scope pass; the
// promotion gate judges windows at its own time; the Cedar export refuses a
// declared opt-out and exports an empty block as an absent one; the
// simulator takes a candidate with consent; and the twin profile's
// commented example, uncommented, loads and refuses what it says.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { itemById } from "../../../src/items.ts";
import { exportCedar } from "../../../src/policy/cedar.ts";
import {
  CONSENT_ID,
  consentProblems,
  coveringOptOut,
  namesTopic,
  optOutText,
  words,
} from "../../../src/policy/consent.ts";
import { evaluateWrite } from "../../../src/policy/evaluate.ts";
import {
  loadPreset,
  PolicyError,
  type PolicyProblem,
  parsePolicy,
} from "../../../src/policy/load.ts";
import { evaluatePromotion } from "../../../src/policy/promotion.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";
import { consentForbids, phraseOf } from "../../property/oracle.ts";
import { AT, fresh, item, testPolicy } from "../plane/helpers.ts";

const VALID = `id: test-policy
version: 1
write:
  - { scope: person, allowed_sources: [user, model], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
  - { scope: role, allowed_sources: [user], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
  - { scope: team, allowed_sources: [user], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
  - { scope: org, allowed_sources: [user], confidence_floor: 0.5, forbidden_classes: [], requires_review: false }
read:
  matrix:
    - { reader: person, may_read: [person, org] }
    - { reader: role, may_read: [role, org] }
    - { reader: team, may_read: [team, org] }
    - { reader: org, may_read: [org] }
  honour_grants: true
retention:
  - { scope: person, class: episodic, ttl: 86400, budget: null, eviction: recency }
promotion:
  episodic_to_semantic: { confirmations: 3, or_review: true }
  procedural: { replay_k: 4, replay_n: 5 }
lints:
  enabled: [expired-validity]
  thresholds: {}
schema_version: 1
`;
const withConsent = (yaml: string) =>
  VALID.replace("schema_version: 1\n", `consent:\n  opt_outs:\n${yaml}schema_version: 1\n`);

function problemsOf(text: string): PolicyProblem[] {
  try {
    parsePolicy(text, "test.yaml");
  } catch (e) {
    expect(e).toBeInstanceOf(PolicyError);
    return (e as PolicyError).problems;
  }
  throw new Error("expected the policy to be rejected");
}

type OptOut = NonNullable<Policy["consent"]>["opt_outs"][number];
const omar = (o: Omit<OptOut, "scope">): OptOut => ({ scope: "person:omar", ...o });
const withOptOuts = (opt_outs: OptOut[]): Policy => testPolicy({ consent: { opt_outs } });

const OMAR = {
  id: "person:omar",
  level: "person" as const,
  memberships: ["person:omar", "team:platform"],
  source: "user" as const,
};
const mine = (n: number, over: Partial<MemoryItem> = {}) =>
  item(n, { scope: "person:omar", ...over });

describe("the loader takes consent (its E2.14 refusal lifted)", () => {
  test.each([
    ["an empty list", "  []\n"],
    ["a topic", "    - { scope: person:omar, topic: health }\n"],
    [
      "a source with a carve-out",
      "    - { scope: person:omar, source: tool, except_topics: [calendar] }\n",
    ],
    [
      "a window (Incognito)",
      '    - { scope: person:omar, since: "2026-12-01T00:00:00Z", until: "2026-12-02T00:00:00Z" }\n',
    ],
    ["everything", "    - { scope: person:omar }\n"],
  ])("%s loads as written", (_what, yaml) => {
    const text =
      yaml === "  []\n"
        ? VALID.replace("schema_version: 1\n", "consent:\n  opt_outs: []\nschema_version: 1\n")
        : withConsent(yaml);
    const policy = parsePolicy(text, "test.yaml");
    expect(policy.consent).toBeDefined();
    expect(consentProblems(policy)).toEqual([]);
  });

  test.each([
    [
      "a topic with no word",
      "    - { scope: person:omar, topic: '!!' }\n",
      "consent.opt_outs.0.topic",
      "has no word",
    ],
    [
      "a carve-out with no word",
      "    - { scope: person:omar, topic: health, except_topics: ['--'] }\n",
      "consent.opt_outs.0.except_topics.0",
      "has no word",
    ],
    [
      "a carve-out that is the topic",
      "    - { scope: person:omar, topic: Health, except_topics: [health] }\n",
      "consent.opt_outs.0.except_topics.0",
      "own topic",
    ],
    [
      "a window that ends before it starts",
      '    - { scope: person:omar, since: "2026-12-02T00:00:00Z", until: "2026-12-01T00:00:00Z" }\n',
      "consent.opt_outs.0.until",
      "holds no instant",
    ],
    [
      "a window that ends where it starts",
      '    - { scope: person:omar, since: "2026-12-02T00:00:00Z", until: "2026-12-02T00:00:00.000Z" }\n',
      "consent.opt_outs.0.until",
      "holds no instant",
    ],
  ])("%s is reported at its path", (_what, yaml, path, message) => {
    const [p, ...rest] = problemsOf(withConsent(yaml));
    expect(rest).toEqual([]);
    expect(p?.path.join(".")).toBe(path);
    expect(p?.message).toContain(message);
    expect(p?.line).toBeGreaterThan(0);
  });

  test("consentProblems is empty for every registered preset", () => {
    for (const name of ["strict", "medium", "permissive"] as const)
      expect(consentProblems(loadPreset(name))).toEqual([]);
  });
});

describe("a topic matches whole words of the content", () => {
  test.each([
    ["my health is fine", "health", true],
    ["Health insurance", "health", true],
    ["HEALTH.", "health", true],
    ["healthy lunches", "health", false],
    ["healthcare", "health", false],
    ["h‍ealth form", "health", true],
    ["my bank account", "bank account", true],
    ["my bank, account", "bank account", true],
    ["bank of the account", "bank account", false],
    ["Ｈealth (fullwidth H)", "health", true],
    ["anything", "!!", false],
  ] as const)("%j names %j: %s", (content, topic, expected) => {
    expect(namesTopic(content, topic)).toBe(expected);
    expect(phraseOf(content, topic)).toBe(expected);
  });

  test("a record matches within one key or value, never across two", () => {
    expect(namesTopic({ account: "bank" }, "bank account")).toBe(false);
    expect(namesTopic({ note: "my bank account" }, "bank account")).toBe(true);
    expect(namesTopic({ health: 1 }, "health")).toBe(true);
    expect(namesTopic({ body: "call the dentist", tools: ["health-api"] }, "health")).toBe(true);
    expect(phraseOf({ account: "bank" }, "bank account")).toBe(false);
    expect(phraseOf({ health: 1 }, "health")).toBe(true);
  });

  test("words are folded and cut on anything but letters, marks and digits", () => {
    expect(words("Héllo, wörld-2!")).toEqual(["héllo", "wörld", "2"]);
  });
});

describe("the write gate", () => {
  const policy = withOptOuts([
    omar({ topic: "health" }),
    omar({ source: "model", except_topics: ["calendar"] }),
    omar({ since: "2026-12-01T10:00:00Z", until: "2026-12-01T11:00:00Z" }),
  ]);
  const at = "2026-12-01T09:00:00Z";
  const judge = (it: MemoryItem, existing?: MemoryItem, when: string | undefined = at) =>
    evaluateWrite(policy, OMAR, it, existing, new Map(), when);

  test("a covered write is denied under engram/write/consent, naming the opt-out, never the content", () => {
    const d = judge(mine(1, { content: "Blood test: my health is fine, ref 4411" }));
    expect(d).toMatchObject({
      decision: "deny",
      status: null,
      check: "consent",
      policy_id: CONSENT_ID,
    });
    expect(d.reason).toBe(
      'consent.opt_outs[0] of policy test (topic "health") covers this write to person:omar: the person opted out of recording it, so nothing was stored',
    );
    expect(d.reason).not.toContain("4411");
    expect(d.reason).not.toContain("Blood");
  });

  test("the first opt-out that covers decides; each names its own fields", () => {
    const model = mine(2, {
      content: "my health",
      provenance: { ...mine(2).provenance, kind: "model" },
    });
    expect(judge(model).reason).toContain("consent.opt_outs[0]");
    const other = { ...model, content: "lunch at noon" } as MemoryItem;
    expect(judge(other).reason).toContain(
      'consent.opt_outs[1] of policy test (source model, except topics "calendar")',
    );
    expect(judge(mine(3), undefined, "2026-12-01T10:30:00Z").reason).toContain(
      "consent.opt_outs[2] of policy test (window [2026-12-01T10:00:00Z, 2026-12-01T11:00:00Z))",
    );
    expect(optOutText({ scope: "person:omar" })).toBe("every write");
  });

  test("a carve-out, a window's ends, another scope and a non-member decide as without consent", () => {
    const calendar = mine(4, {
      content: "calendar: offsite on the 12th",
      provenance: { ...mine(4).provenance, kind: "model" },
    });
    expect(judge(calendar).decision).toBe("allow");
    expect(judge(mine(5), undefined, "2026-12-01T10:00:00Z").policy_id).toBe(CONSENT_ID);
    expect(judge(mine(5), undefined, "2026-12-01T11:00:00Z").decision).toBe("allow");
    expect(judge(item(6, { content: "team health check" })).decision).toBe("allow");
    const dana = { ...OMAR, id: "person:dana", memberships: ["person:dana"] };
    const d = evaluateWrite(policy, dana, mine(7, { content: "health" }), undefined, new Map(), at);
    expect(d.policy_id).toBe("engram/write/membership");
  });

  test("a retire and a rewrite keeping the content record nothing new and pass; a move into the scope is judged", () => {
    // Recorded before the opt-out: the person can always retire it.
    const held = mine(8, { content: "my health is fine" });
    expect(judge({ ...held, status: "retired", version: 2 }, held).decision).toBe("allow");
    expect(judge({ ...held, confidence: 0.95, version: 2 }, held).decision).toBe("allow");
    expect(
      judge({ ...held, content: "My  HEALTH is fine", version: 2 } as MemoryItem, held).decision,
    ).toBe("allow");
    expect(
      judge({ ...held, content: "my health is bad", version: 2 } as MemoryItem, held).policy_id,
    ).toBe(CONSENT_ID);
    const team = item(9, { content: "health check" });
    expect(judge({ ...team, scope: "person:omar", version: 2 }, team).policy_id).toBe(CONSENT_ID);
  });

  test("with no time the windows count as open; consentAt gives one", () => {
    expect(evaluateWrite(policy, OMAR, mine(10), undefined, new Map()).policy_id).toBe(CONSENT_ID);
    const d = evaluateWrite(policy, OMAR, mine(10), undefined, new Map(), undefined, {
      consentAt: at,
    });
    expect(d.decision).toBe("allow");
  });

  test("the promotion gate judges consent's window at the promotion's time", () => {
    // An episode consolidated into a semantic item of the same person scope
    // is a new version: a first write the gate judges, consent included.
    const incognito = withOptOuts([
      omar({ since: "2026-12-01T10:00:00Z", until: "2026-12-01T11:00:00Z" }),
    ]);
    const base = testPolicy();
    const policy = {
      ...incognito,
      write: base.write.map((r) => ({ ...r, forbidden_classes: [] })),
    };
    const episode = mine(11, { class: "episodic", content: "a walk by the river" });
    const confirmations = ["person:omar", "person:a", "person:b"].map((actor, i) => ({
      item_id: i === 0 ? episode.id : `01920000-0000-7000-8000-00000000009${i}`,
      actor,
      kind: "user" as const,
      status: "active" as const,
    }));
    const promote = (when: string) =>
      evaluatePromotion(
        policy,
        OMAR,
        episode,
        { scope: "person:omar", at: when },
        { confirmations, authors: ["person:omar"], review: false },
        new Map(),
      );
    expect(promote("2026-12-01T10:30:00Z")).toMatchObject({
      decision: "deny",
      policy_id: CONSENT_ID,
    });
    expect(promote("2026-12-01T12:00:00Z").decision).toBe("allow");
  });

  test("an absent block and an empty list find no opt-out", () => {
    expect(coveringOptOut(testPolicy(), mine(12), undefined, at)).toBeNull();
    expect(coveringOptOut(withOptOuts([]), mine(12), undefined, at)).toBeNull();
  });
});

describe("through the plane", () => {
  test("a denied write appends one deny event with no item, stores nothing, and checkWrite agrees", async () => {
    const { plane, db, adapter } = fresh(withOptOuts([omar({ topic: "health" })]));
    const it = mine(20, { content: "my health is fine 7731" });
    const checked = await plane.checkWrite(OMAR, it, AT);
    const { item: stored, event } = await plane.write(OMAR, it, AT);
    expect(stored).toBeNull();
    expect(event).toMatchObject({ op: "write", decision: "deny", policy_id: CONSENT_ID });
    expect(event.item ?? null).toBeNull();
    expect(event.reason).not.toContain("7731");
    expect(checked).toMatchObject({
      decision: "deny",
      policy_id: CONSENT_ID,
      reason: event.reason,
    });
    expect(itemById(db, it.id)).toBeUndefined();
    expect(adapter.writes).toBe(0);
    expect(plane.events()).toHaveLength(1);
  });

  test("the simulator replays a workload under a candidate with consent", async () => {
    const { plane } = fresh(testPolicy());
    const report = await plane.simulate(
      {
        id: "w",
        actors: { omar: OMAR },
        steps: [{ op: "write", as: "omar", at: AT, item: mine(21, { content: "health" }) }],
      },
      withOptOuts([omar({ topic: "health" })]),
    );
    expect(report.baseline.outcomes[0]?.decision).toBe("allow");
    expect(report.candidate.outcomes[0]).toMatchObject({ decision: "deny", policy_id: CONSENT_ID });
  });
});

describe("the oracle reads consent as core does", () => {
  test.each([
    ["covered by topic", mine(30, { content: "health" }), undefined, 0],
    ["not covered", mine(31, { content: "lunch" }), undefined, undefined],
    ["a retire", mine(32, { content: "health", status: "retired" }), undefined, undefined],
    [
      "a same-content rewrite",
      mine(33, { content: "Health", version: 2 }),
      mine(33, { content: "health" }),
      undefined,
    ],
  ] as const)("%s", (_what, it, before, expected) => {
    const policy = withOptOuts([omar({ topic: "health" })]);
    expect(consentForbids(policy, it, before, AT)).toBe(expected);
    expect(coveringOptOut(policy, it, before, AT)?.index).toBe(expected);
  });
});

describe("the Cedar export (ADR 0041)", () => {
  test("refuses a declared opt-out, with its reason", () => {
    expect(() => exportCedar(withOptOuts([omar({ topic: "health" })]))).toThrow(
      "the Cedar export does not translate consent, which matches the words of the content",
    );
  });
  test("exports an empty list as it exports no block", () => {
    const medium = loadPreset("medium");
    expect(exportCedar({ ...medium, consent: { opt_outs: [] } })).toEqual(exportCedar(medium));
  });
});

describe("the twin profile's example", () => {
  const url = new URL("../../../../pi-package/profiles/twin.yaml", import.meta.url);
  const text = readFileSync(url, "utf8");

  test("is commented out: the profile sets no consent", () => {
    expect(parsePolicy(text, url.pathname).consent).toBeUndefined();
    expect(text).toContain("# consent:\n#   opt_outs:\n");
  });

  test("uncommented, it loads and refuses what it says", () => {
    const on = text.replace(/^# ( {0,4}(?:consent:|opt_outs:|- \{ scope: person:omar))/gm, "$1");
    const policy = parsePolicy(on, url.pathname);
    expect(policy.consent?.opt_outs).toHaveLength(3);
    const health = mine(40, { content: "my health" });
    const d = evaluateWrite(policy, OMAR, health, undefined, new Map(), "2026-11-30T00:00:00Z");
    expect(d.policy_id).toBe(CONSENT_ID);
    const incognito = mine(41, { content: "a walk" });
    expect(
      evaluateWrite(policy, OMAR, incognito, undefined, new Map(), "2026-12-01T12:00:00Z")
        .policy_id,
    ).toBe(CONSENT_ID);
    expect(
      evaluateWrite(policy, OMAR, incognito, undefined, new Map(), "2026-12-02T00:00:00Z").decision,
    ).toBe("allow");
  });
});
