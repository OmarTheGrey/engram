// Card D1's scrub (AGENTS.md rule 12): the bypass redactor's secret table
// runs over every episode before anything is stored; free text is redacted,
// and an episode whose identifiers still match is held. Every secret here is
// synthetic and planted.
import { describe, expect, test } from "vitest";
import type { Episode, Step } from "../../../src/distill/episode.ts";
import { scrubEpisode, scrubText } from "../../../src/distill/scrub.ts";
import { REDACTED_SECRET } from "../../../src/plane/bypass.ts";

/** A planted key: the shape of one, and nobody's. */
const PLANTED = "sk-synthetic0planted0for0d1test";

const fn = (over: Partial<Extract<Step, { kind: "function" }>> = {}): Step => ({
  entry_id: "a0000003",
  kind: "function",
  caller: "model",
  tool: "bash",
  arguments: { command: "ls" },
  result: "ok",
  is_error: false,
  result_entry_id: "a0000004",
  ...over,
});

const episode = (over: Partial<Episode> = {}): Episode => ({
  format: "engram.episode/1",
  session_id: "0193a000-0000-4000-8000-000000000001",
  task_id: "synthetic/rename-1",
  started_at: "2026-11-01T09:00:00.000Z",
  ended_at: "2026-11-01T09:00:09.000Z",
  model: "scripted/scripted-1",
  steps: [
    { entry_id: "a0000001", kind: "user", text: "Rename foo" },
    {
      entry_id: "a0000002",
      kind: "generation",
      text: "Looking.",
      model: "scripted/scripted-1",
      stop_reason: "toolUse",
      tool_calls: 1,
    },
    fn(),
  ],
  outcome: { verdict: "success", reward: 1, stop_reason: "stop", leaf_id: "a0000004" },
  abandoned: [],
  omitted: [],
  summarised: false,
  skipped_lines: 0,
  ...over,
});

describe("scrubEpisode", () => {
  test("leaves an episode with nothing secret as it is", () => {
    const e = episode();
    expect(scrubEpisode(e)).toEqual({ episode: e, redacted: 0, held: [] });
  });

  test("redacts a planted key in a tool result, and the key is nowhere in what is kept", () => {
    const e = episode({ steps: [fn({ result: `export OPENAI_KEY=${PLANTED}\nok` })] });
    const out = scrubEpisode(e);
    expect(out.held).toEqual([]);
    expect(out.redacted).toBe(1);
    expect(JSON.stringify(out.episode)).not.toContain(PLANTED);
    expect(out.episode.steps[0]).toMatchObject({
      result: `export OPENAI_KEY=${REDACTED_SECRET}\nok`,
    });
  });

  test("redacts a key in user text, a generation, a summary and an abandoned branch", () => {
    const e = episode({
      steps: [
        { entry_id: "a0000001", kind: "user", text: `use ${PLANTED}` },
        {
          entry_id: "a0000002",
          kind: "summary",
          source: "compaction",
          text: `Bearer ${PLANTED}`,
          from_id: null,
        },
      ],
      abandoned: [
        {
          left_at: "a0000001",
          left_from: null,
          leaf_id: "b0000001",
          summary: `tried ${PLANTED}`,
          outcome: { verdict: null, reward: null, stop_reason: null, leaf_id: "b0000001" },
          steps: [{ entry_id: "b0000001", kind: "custom", custom_type: "x", text: PLANTED }],
        },
      ],
    });
    const out = scrubEpisode(e);
    expect(out.held).toEqual([]);
    expect(out.redacted).toBe(4);
    expect(JSON.stringify(out.episode)).not.toContain(PLANTED);
  });

  test("redacts a tool argument whose name says it holds a secret, whatever its value", () => {
    const e = episode({
      steps: [
        fn({
          arguments: { url: "https://x.test", api_key: "plain-short", nested: [{ token: 42 }] },
        }),
      ],
    });
    const out = scrubEpisode(e);
    expect(out.held).toEqual([]);
    expect(out.redacted).toBe(2);
    expect(out.episode.steps[0]).toMatchObject({
      arguments: {
        url: "https://x.test",
        api_key: REDACTED_SECRET,
        nested: [{ token: REDACTED_SECRET }],
      },
    });
  });

  test("redacts a key in a string argument by the table", () => {
    const e = episode({
      steps: [fn({ arguments: { command: `curl -H 'Authorization: Bearer ${PLANTED}'` } })],
    });
    const out = scrubEpisode(e);
    expect(JSON.stringify(out.episode)).not.toContain(PLANTED);
    expect(out.held).toEqual([]);
  });

  test("holds an episode whose task id still matches, naming the field and not the value", () => {
    const out = scrubEpisode(episode({ task_id: `task-${PLANTED}` }));
    expect(out.held).toEqual(["task_id"]);
  });

  test("holds an episode whose tool name, entry id or argument name matches", () => {
    const long = "x".repeat(40);
    const out = scrubEpisode(
      episode({
        steps: [
          fn({ tool: PLANTED }),
          fn({ entry_id: long }),
          fn({ arguments: { [`sk-${long}`]: "v" } }),
        ],
      }),
    );
    expect(out.held).toEqual(["steps[0].tool", "steps[1].entry_id", "steps[2].arguments"]);
    expect(JSON.stringify(out.held)).not.toContain(PLANTED);
  });

  test("does not hold pi's own id shapes, a UUID session id and 8-hex entry ids", () => {
    // A UUID is 36 characters of the table's 32-character key rule; pi's
    // default session id is one, and an entry id may fall back to one.
    const uuid = "0193a000-0000-4000-8000-0000000000ff";
    const out = scrubEpisode(
      episode({ session_id: uuid, steps: [fn({ entry_id: uuid, result_entry_id: "deadbeef" })] }),
    );
    expect(out.held).toEqual([]);
  });

  test("holds a session id that is not one of pi's shapes and matches", () => {
    expect(scrubEpisode(episode({ session_id: `s-${"y".repeat(40)}` })).held).toEqual([
      "session_id",
    ]);
  });

  test("is idempotent: a scrubbed episode scrubs to itself", () => {
    const once = scrubEpisode(
      episode({ steps: [fn({ result: `KEY=${PLANTED}`, arguments: { secret: "s" } })] }),
    );
    const twice = scrubEpisode(once.episode);
    expect(twice.episode).toEqual(once.episode);
    expect(twice.redacted).toBe(0);
  });

  test("does not change its input", () => {
    const e = episode({ steps: [fn({ result: PLANTED })] });
    const copy = structuredClone(e);
    scrubEpisode(e);
    expect(e).toEqual(copy);
  });
});

describe("scrubEpisode: the review fix pass (findings D1-2, D1-3)", () => {
  test("under a secret-named argument the whole value goes, an array or an object too", () => {
    const e = episode({
      steps: [
        fn({
          arguments: {
            tokens: ["shorttok1"],
            auth: { basic: "dXNlcjpwYXNz" },
            pass: "hunter2",
            api_key: null,
            secret: true,
          },
        }),
      ],
    });
    const out = scrubEpisode(e);
    expect(out.episode.steps[0]).toMatchObject({
      arguments: {
        tokens: REDACTED_SECRET,
        auth: REDACTED_SECRET,
        pass: REDACTED_SECRET,
        api_key: null,
        secret: true,
      },
    });
    expect(out.redacted).toBe(3);
    expect(JSON.stringify(out.episode)).not.toMatch(/shorttok1|dXNlcjpwYXNz|hunter2/);
  });

  test.each([
    ["curl -H 'X-Api-Key: abcd1234short' https://x", "curl -H 'X-Api-Key: <redacted>' https://x"],
    [
      "curl -H 'Authorization: Basic dXNlcjpwYXNz' https://x",
      "curl -H 'Authorization: Basic <redacted>' https://x",
    ],
    ['{"token": "abc", "password": "x"}', '{"token": "<redacted>", "password": "<redacted>"}'],
    ["password: hunter2", "password: <redacted>"],
    ["DB_PASS=hunter2 psql", "DB_PASS=<redacted> psql"],
  ])("the named-value rule redacts %s", (input, kept) => {
    expect(scrubText(input)).toBe(kept);
  });

  test.each([
    "max_tokens: 100",
    "tokens: 5",
    "token_count: 7",
    "bypass: on",
    "passage: two",
    "the keyboard: fine",
  ])("the named-value rule keeps %s", (input) => {
    expect(scrubText(input)).toBe(input);
  });

  test("the named-value rule is idempotent and fast on a long line", () => {
    const once = scrubText("Authorization: Bearer abc X-Api-Key: def");
    expect(scrubText(once)).toBe(once);
    const long = `${"a".repeat(200_000)} token`;
    const started = performance.now();
    scrubText(long);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  test("a key split across two fields is kept: the scrub's known limit", () => {
    const e = episode({
      steps: [
        { entry_id: "a0000001", kind: "user", text: "the first half is abcd" },
        { entry_id: "a0000002", kind: "user", text: "and the second half is efgh" },
      ],
    });
    expect(scrubEpisode(e).redacted).toBe(0);
  });

  test("long tool names and model ids are not held, but a key in one is", () => {
    const longTool = "mcp__a_very_long_server_name__and_a_long_tool_name";
    const longModel = "provider/an-unusually-long-model-identifier-2026-11-01";
    const ok = scrubEpisode(episode({ model: longModel, steps: [fn({ tool: longTool })] }));
    expect(ok.held).toEqual([]);
    // A key after a hyphen is held, and so is one glued on by underscores,
    // which a name check reads as word boundaries (finding V-8).
    const bad = scrubEpisode(episode({ steps: [fn({ tool: `mcp-x-${PLANTED}` })] }));
    expect(bad.held).toEqual(["steps[0].tool"]);
    const glued = scrubEpisode(episode({ steps: [fn({ tool: `mcp__x__${PLANTED}` })] }));
    expect(glued.held).toEqual(["steps[0].tool"]);
  });

  test("what replaced an edited entry is scrubbed, and omitted entry ids are checked", () => {
    const e = episode({
      steps: [
        {
          entry_id: "a0000001",
          kind: "user",
          text: "x",
          context: "replaced",
          replacement: PLANTED,
        },
      ],
      omitted: [{ entry_ids: ["a0000002", "y".repeat(40)], stop_reason: "length" }],
    });
    const out = scrubEpisode(e);
    expect(JSON.stringify(out.episode)).not.toContain(PLANTED);
    expect(out.episode.steps[0]).toMatchObject({
      context: "replaced",
      replacement: REDACTED_SECRET,
    });
    expect(out.held).toEqual(["omitted[0].entry_ids[1]"]);
  });
});

describe("scrubEpisode: the verification pass (findings V-1, V-3, V-4, V-5)", () => {
  const S = "hunter2xyz";

  test.each([
    ['{"password": "correct horse battery staple"}', '{"password": "<redacted>"}'],
    ['password: "correct horse battery staple"', 'password: "<redacted>"'],
    ["password: 'correct horse battery staple'", "password: '<redacted>'"],
    ["token: 'unclosed value", "token: '<redacted> value"],
  ])("a quoted value goes whole: %s", (input, kept) => {
    expect(scrubText(input)).toBe(kept);
    expect(scrubText(kept)).toBe(kept);
  });

  test("a time that still matches is held: ended_at", () => {
    const out = scrubEpisode(episode({ ended_at: `token=${PLANTED}` }));
    expect(out.held).toEqual(["ended_at"]);
    expect(scrubEpisode(episode({ started_at: `token=${PLANTED}` })).held).toEqual(["started_at"]);
  });

  test.each([
    ["argv --password", { command: "mysql", args: ["--password", S] }],
    ["argv -p beside mysql", { command: "mysql", args: ["-p", S] }],
    ["argv -p in a mysql array", { argv: ["mysqldump", "-p", S, "db"] }],
    ["env pair", { env: [{ name: "DB_PASSWORD", value: S }] }],
    ["passphrase", { config: { passphrase: S } }],
    ["pw", { login: { user: "a", pw: S } }],
    ["cookie header object", { request: { headers: { Cookie: `session=${S}` } } }],
    ["cookie header text", { command: `curl -H 'Cookie: session=${S}' https://x` }],
    ["PASSPHRASE= in a command", { command: `PASSPHRASE=${S} gpg -d f` }],
    ["mysql -p in a command", { command: `mysql -u root -p ${S} db` }],
    ["mysql -pvalue in a command", { command: `mysql -u root -p${S} db` }],
  ])("redacts %s", (_name, args) => {
    const out = scrubEpisode(episode({ steps: [fn({ arguments: args })] }));
    expect(out.held).toEqual([]);
    expect(JSON.stringify(out.episode)).not.toContain(S);
  });

  test.each([
    ["-p beside another tool, a port", { command: "ssh", args: ["-p", "2222", "host"] }],
    ["mkdir -p", { command: "mkdir -p src/deep" }],
    ["docker -p", { command: "docker run -p 8080:80 img" }],
    ["mysql -p then a flag", { command: "mysql -p --host db" }],
    ["a name pair that is not a secret", { env: [{ name: "PATH", value: "/usr/bin" }] }],
  ])("keeps %s", (_name, args) => {
    const out = scrubEpisode(episode({ steps: [fn({ arguments: args })] }));
    expect(out.episode.steps[0]).toMatchObject({ arguments: args });
    expect(out.redacted).toBe(0);
  });

  test.each([
    "Author: Jane Doe <j@x>",
    "commit 1a2b3c4d\nAuthor: Jane Doe <jane@example.test>\nDate:   Mon",
    "authored: yes",
  ])("keeps a git author line: %s", (line) => {
    expect(scrubText(line)).toBe(line);
  });

  test.each([
    ["Authorization: Bearer abc", "Authorization: Bearer <redacted>"],
    ["X-Auth-Token: abc", "X-Auth-Token: <redacted>"],
    ["auth: abc", "auth: <redacted>"],
    ["oauth_token=abc", "oauth_token=<redacted>"],
  ])("still redacts the auth names: %s", (input, kept) => {
    expect(scrubText(input)).toBe(kept);
  });

  test("the MySQL rule is fast on a long line", () => {
    const long = `mysql ${"a ".repeat(100_000)}`;
    const started = performance.now();
    scrubText(long);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("scrubEpisode: the second verification pass (findings W-1 to W-6)", () => {
  const S = "hunter2xyz";

  test.each([
    "mcp__firebase-auth__list_users",
    "mcp__vault-pass__unlock",
    "set-password_policy",
    "mcp__x__refresh-token_now",
    "mcp__my-key__x",
  ])("a tool name with a secret word in it is not held: %s", (tool) => {
    expect(scrubEpisode(episode({ steps: [fn({ tool })] })).held).toEqual([]);
  });

  test("a URL credential in a name read with underscores as spaces is held", () => {
    const out = scrubEpisode(episode({ steps: [fn({ tool: "mcp__fetch__https://u:p@h" })] }));
    expect(out.held).toEqual(["steps[0].tool"]);
  });

  test.each([
    [`SECRET_KEY = '${S}'`, "SECRET_KEY = '<redacted>'"],
    [`aws_secret_access_key = ${S}`, "aws_secret_access_key = <redacted>"],
    [`{"secret_key": "${S}"}`, '{"secret_key": "<redacted>"}'],
    [`{"secretKey":"${S}"}`, '{"secretKey":"<redacted>"}'],
    [`{"private_key": "${S}"}`, '{"private_key": "<redacted>"}'],
    [`DB_PWD: ${S}`, "DB_PWD: <redacted>"],
    [`{"pwd": "${S}"}`, '{"pwd": "<redacted>"}'],
  ])("a name the table treats as a secret's loses its value in text: %s", (input, kept) => {
    expect(scrubText(input)).toBe(kept);
  });

  test.each([
    "const token = await getToken();",
    "if (password === undefined) throw new Error('missing')",
    "if (token !== null) return",
    "def check(password: str, token: str) -> bool:",
    "interface Opts { token: string; password?: string }",
    "password: null",
    '{"secret": false, "pass": true}',
    "token: {",
    "password = [",
    "token_count: 7",
    "password_hash = bcrypt(pw)",
    '"max_tokens": 1024',
    "author: Jane Doe",
  ])("code, a literal, a type or an opening structure is kept: %s", (line) => {
    expect(scrubText(line)).toBe(line);
  });

  test("a value never runs past a newline", () => {
    expect(scrubText('password: "\nnext line" stays')).toBe('password: "\nnext line" stays');
    expect(scrubText("token:\nnext")).toBe("token:\nnext");
    expect(scrubText("password: abc\nnext")).toBe("password: <redacted>\nnext");
  });

  test.each([
    ["argv -pvalue in a mysql array", { argv: ["mysql", "-u", "root", `-p${S}`] }],
    ["argv -pvalue beside a mysql command", { command: "mysql", args: [`-p${S}`] }],
    ["a secret flag then an object", { argv: ["--password", { v: S }] }],
    ["a secret flag then an array", { argv: ["--token", [S]] }],
    ["curl -u in a command", { command: `curl -u admin:${S} https://x` }],
    ["curl --user in a command", { command: `curl --user admin:${S} https://x` }],
  ])("redacts %s", (_name, args) => {
    const out = scrubEpisode(episode({ steps: [fn({ arguments: args })] }));
    expect(out.held).toEqual([]);
    expect(JSON.stringify(out.episode)).not.toContain(S);
  });

  test("a PEM private key loses its body, terminated or cut off, and keeps its frame", () => {
    const body = `b3BlbnNzaC1rZXktdjE${S}\nQyNTUxOQAAACD`;
    const pem = `-----BEGIN OPENSSH PRIVATE KEY-----\n${body}\n-----END OPENSSH PRIVATE KEY-----`;
    const out = scrubText(`cat > id <<EOF\n${pem}\nEOF`);
    expect(out).toBe(
      "cat > id <<EOF\n-----BEGIN OPENSSH PRIVATE KEY-----\n<redacted>\n-----END OPENSSH PRIVATE KEY-----\nEOF",
    );
    expect(scrubText(out)).toBe(out);
    expect(scrubText(`-----BEGIN RSA PRIVATE KEY-----\n${body}`)).toBe(
      "-----BEGIN RSA PRIVATE KEY-----\n<redacted>\n",
    );
    const cert = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----";
    expect(scrubText(cert)).toBe(cert);
  });

  test("the command rules are linear: 30,000 repetitions finish under a second", () => {
    const json = JSON.stringify(
      Array.from({ length: 30_000 }, (_, i) => ({ Image: "mysql:8", Names: `db-${i}` })),
    );
    const words = "mysql -h db curl -s x ".repeat(30_000);
    for (const line of [json, words]) {
      const started = performance.now();
      scrubText(line);
      expect(performance.now() - started).toBeLessThan(1000);
    }
  });
});

describe("scrubEpisode: stated limits, kept (E2.9's content guard is the covering control)", () => {
  const S = "hunter2xyz";
  test.each([
    ["escaped JSON", `{\\"password\\": \\"${S}\\"}`],
    ["a header pair array", JSON.stringify([["X-Api-Key", S]])],
    ["an escaped quote inside a value", `password: "ab\\"${S}"`],
    [
      "a ParameterKey and ParameterValue pair",
      JSON.stringify({ ParameterKey: "DBPassword", ParameterValue: S }),
    ],
    ["os.environ assignment", `os.environ["API_KEY"] = "${S}"`],
    ["XML", `<password>${S}</password>`],
    ["Go's :=", `password := "${S}"`],
    ["an arrow", `password => "${S}"`],
  ])("%s keeps the secret", (_name, text) => {
    expect(scrubText(text)).toContain(S);
  });
});
