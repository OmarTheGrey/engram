// `engram who-can-read` (card E2.13): one client call, the plane's answer
// printed. The owner sees every reader and grant; a grantee sees its own
// grant only; anyone else is refused in the words an unknown id gets.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Fetch } from "../src/connect.ts";
import { cli, logEvents, NOW, tempDir } from "./helpers.ts";

const ITEM = "01920000-0000-7000-8000-00000000e213";
const UNKNOWN = "01920000-0000-7000-8000-00000000e299";

/** A log holding one item of dana's, granted to sam. */
async function granted() {
  const dir = await tempDir();
  const db = join(dir, "engram.db");
  const file = join(dir, "item.json");
  await writeFile(
    file,
    JSON.stringify({
      grants: [
        { to: "person:sam", class: "semantic", mode: "read", expires: "2026-12-31T00:00:00.000Z" },
      ],
    }),
  );
  const written = await cli([
    "write",
    ...["--root", await tempDir(), "--owner", "dana", "--db", db],
    ...["--id", ITEM, "--content", "Dana prefers written standups.", "--file", file],
  ]);
  expect(written.code).toBe(0);
  return db;
}

describe("engram who-can-read", () => {
  it("shows the owner every reader with its rule, the grantee its own grant, and refuses anyone else as for an unknown id", async () => {
    const db = await granted();
    const owner = await cli(["who-can-read", ITEM, "--owner", "dana", "--db", db]);
    expect(owner.code).toBe(0);
    expect(owner.out).toContain(`who can read ${ITEM} at ${NOW} as person:dana: answered`);
    expect(owner.out).toContain(
      "every member of person:dana reading as person (preset.medium/read/person)",
    );
    expect(owner.out).toContain(
      "person:sam by grants[0]:person:sam, until 2026-12-31T00:00:00.000Z (preset.medium/read/grants)",
    );

    const sam = await cli(["who-can-read", ITEM, "--as", "person:sam", "--db", db, "--json"]);
    expect(sam.code).toBe(0);
    const answer = JSON.parse(sam.out);
    expect(answer).toMatchObject({ answered: true, grants_shown: "yours", dormant: [] });
    // Medium lets person and role levels read a person scope: two members
    // entries, then sam's own grant and no other.
    expect(
      answer.readers.map((r: { kind: string; level?: string; to?: string }) => r.level ?? r.to),
    ).toEqual(["person", "role", "person:sam"]);

    const eve = await cli(["who-can-read", ITEM, "--as", "person:eve", "--db", db]);
    const none = await cli(["who-can-read", UNKNOWN, "--as", "person:eve", "--db", db]);
    expect(eve.code).toBe(1);
    expect(eve.out).toContain("refused");
    expect(eve.out).not.toContain("person:dana");
    expect(eve.out).not.toContain("person:sam");
    expect(eve.out).toBe(none.out.replaceAll(UNKNOWN, ITEM));
  });

  it("answers a scope by the read matrix for a member, and refuses a non-member", async () => {
    const db = await granted();
    const member = await cli([
      "who-can-read",
      "--scope",
      "person:dana",
      "--owner",
      "dana",
      "--db",
      db,
    ]);
    expect(member.code).toBe(0);
    expect(member.out).toContain("every member of person:dana reading as person");
    expect(member.out).not.toContain("person:sam");
    const other = await cli([
      "who-can-read",
      "--scope",
      "person:dana",
      "--as",
      "person:eve",
      "--db",
      db,
    ]);
    expect(other.code).toBe(1);
  });

  it("is exactly one request, and appends no event", async () => {
    const db = await granted();
    const paths: string[] = [];
    const transport =
      (next: Fetch): Fetch =>
      async (request) => {
        paths.push(`${request.method} ${new URL(request.url).pathname}`);
        return next(request);
      };
    const before = logEvents(db).length;
    await cli(["who-can-read", ITEM, "--owner", "dana", "--db", db], { transport });
    await cli(["who-can-read", "--scope", "org", "--owner", "dana", "--db", db], { transport });
    expect(paths).toEqual(["POST /api/v1/who-can-read/item", "POST /api/v1/who-can-read/scope"]);
    expect(logEvents(db).length).toBe(before);
  });

  it("needs exactly one item id or one scope", async () => {
    for (const args of [[], [ITEM, "--scope", "org"], ["not-an-id"], ["--scope", "nowhere"]]) {
      const r = await cli(["who-can-read", ...args, "--owner", "dana"]);
      expect(r.code, args.join(" ")).toBe(2);
    }
  });
});
