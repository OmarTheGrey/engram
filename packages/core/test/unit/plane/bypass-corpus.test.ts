// Card D1 refactored the bypass redactor so the session recorder's scrub can
// share its table (`redactSecrets`, `isSecretName`, verification finding V-9). A
// bypass event's reason must not change: this corpus pins `bypassAttempt`'s
// output, byte for byte, to what the bypass.ts of main before card D1
// (commit e4ea83e) gives for each input. The expected column was computed by
// running that file's `bypassAttempt`, not the current one.
import { expect, test } from "vitest";
import { bypassAttempt } from "../../../src/plane/bypass.ts";

/** [input, the reason's attempt before card D1]. */
const EXPECTED: [string, string][] = [
  ["OPENAI_API_KEY=sk-abc123def456ghi mem0 add x", "OPENAI_API_KEY=<redacted> mem0 add x"],
  ["MEM0_TOKEN='s3cr3t value' mem0 add x", "MEM0_TOKEN=<redacted> mem0 add x"],
  ["mem0 add x --api-key sk-abcdefghijklmnop", "mem0 add x --api-key <redacted>"],
  ["mem0 add x --token=abc", "mem0 add x --token=<redacted>"],
  ["mem0 --password hunter2 list", "mem0 --password <redacted> list"],
  ["mem0 --pass hunter2 list", "mem0 --pass <redacted> list"],
  ["PASS=hunter2 mem0 list", "PASS=hunter2 mem0 list"],
  ["DB_PASS=hunter2 mem0 list", "DB_PASS=hunter2 mem0 list"],
  ["PASSPHRASE=hunter2 gpg -d f", "PASSPHRASE=hunter2 gpg -d f"],
  [
    "curl -H 'Authorization: Bearer abc.def.ghi' https://api.mem0.ai",
    "curl -H 'Authorization: Bearer <redacted>' https://api.mem0.ai",
  ],
  ["curl -H 'X-Api-Key: abcd1234short' https://x", "curl -H 'X-Api-Key: abcd1234short' https://x"],
  [
    "curl -H 'Authorization: Basic dXNlcjpwYXNz' https://x",
    "curl -H 'Authorization: Basic dXNlcjpwYXNz' https://x",
  ],
  ["curl -H 'Cookie: session=abc' https://x", "curl -H 'Cookie: session=abc' https://x"],
  ['echo {"token": "abc", "password": "x"}', 'echo {"token": "abc", "password": "x"}'],
  [
    'echo {"password": "correct horse battery staple"}',
    'echo {"password": "correct horse battery staple"}',
  ],
  ["mysql -u root -p hunter2 db", "mysql -u root -p hunter2 db"],
  ["mysql -u root -phunter2 db", "mysql -u root -phunter2 db"],
  ["git log -1 | grep 'Author: Jane Doe <j@x>'", "git log -1 | grep 'Author: Jane Doe <j@x>'"],
  ["letta --url https://me:pw@host/x list", "letta --url https://<redacted>@host/x list"],
  ["mem0 add sk-proj-0123456789abcdefABCDEF", "mem0 add <redacted>"],
  ["mem0 add 0123456789abcdef0123456789abcdef01", "mem0 add <redacted>"],
  ["git -C /store show 3f2a9c1e0b7d4a6f8e5c2b1a0d9e8f7c6b5a4d3e", "git -C /store show <redacted>"],
  ["session 990b7a49-4239-43c0-905d-13ed49582414", "session <redacted>"],
  ["mcp__a_very_long_server_name__and_a_long_tool_name", "<redacted>"],
  ["mcp__x__sk-synthetic0planted0for0d1test", "<redacted>"],
  ["mem0 add x\nmem0 list", "mem0 add x mem0 list"],
  ["mem0 add x\r\n  mem0 list", "mem0 add x mem0 list"],
  [
    "mem0 add word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word ",
    "mem0 add word word word word word word word word word word word word word word word word word word word word word word word word word word word word word wor...",
  ],
  [
    "TOKEN=x --token y Bearer z https://u:p@h sk-aaaaaaaaaa qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
    "TOKEN=<redacted> --token <redacted> Bearer <redacted> https://<redacted>@h <redacted> <redacted>",
  ],
  ["API_KEY='a b' PASSWORD=\"c d\"", "API_KEY=<redacted> PASSWORD=<redacted>"],
  ["https://a@b@c", "https://<redacted>@b@c"],
  [
    "max_tokens=100 keyword=x MONKEY=y",
    "max_tokens=<redacted> keyword=<redacted> MONKEY=<redacted>",
  ],
  ["", ""],
  ["   ", ""],
];

test.each(EXPECTED)("bypassAttempt(%j) is what it was before card D1", (input, kept) => {
  expect(bypassAttempt(input)).toBe(kept);
});

test("the corpus covers the shapes the scrub added rules for", () => {
  expect(EXPECTED.length).toBeGreaterThanOrEqual(30);
});
