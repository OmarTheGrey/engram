// @engram/tag (card E8.14 review fix pass, findings E8.14-4 and E8.14-7):
// the memory tag escapes content, defuses every tag opener (numeric
// character references included), and the package imports no pi.
import { readdirSync, readFileSync } from "node:fs";
import type { Explanation, MemoryItem } from "@engram/core";
import { describe, expect, test } from "vitest";
import {
  neutraliseTags,
  recallDetails,
  tagRecall,
  WITHHELD,
  writeResultText,
} from "../src/index.ts";

const item = { id: "i1", scope: "person:dana", content: 'a <b> & "c"' } as MemoryItem;
const explanation = {
  item_id: "i1",
  rank: 1,
  score: { total: 0.5, components: {} },
  policy_id: "p/read/person",
} as unknown as Explanation;

describe("neutraliseTags", () => {
  test("defuses an opener, its lookalikes and its numeric character references", () => {
    for (const forged of [
      "<engram:memory>",
      "</engram:memory>",
      "< / engram:item>",
      "＜engram:memory>",
      "&#60;engram:memory>",
      "&#060;engram:memory>",
      "&#x3c;engram:memory>",
      "&#X3C;/engram:memory>",
      "&#x03c;engram:memory>",
    ]) {
      const out = neutraliseTags(`before ${forged} after`);
      expect(out, forged).toContain("&lt;");
      expect(out, forged).not.toMatch(/(<|＜|&#0*60;|&#x0*3c;)\s*\/?\s*engram/i);
    }
  });

  test("leaves text without an opener as it is", () => {
    expect(neutraliseTags("engram is a plane; 3 < 4 & 5 > 2")).toBe(
      "engram is a plane; 3 < 4 & 5 > 2",
    );
  });
});

describe("the memory tag", () => {
  test("pairs items with explanations and escapes content", () => {
    const details = recallDetails("r1", "p/read/person", 2, [item], [explanation]);
    expect(details.items).toEqual([
      {
        item_id: "i1",
        scope: "person:dana",
        content: 'a <b> & "c"',
        rank: 1,
        score: 0.5,
        policy_id: "p/read/person",
      },
    ]);
    const tag = tagRecall(details);
    expect(tag).toContain('<engram:memory read_id="r1" policy_id="p/read/person" filtered="2">');
    expect(tag).toContain("a &lt;b&gt; &amp; &quot;c&quot;");
    expect(WITHHELD.startsWith("<engram:memory withheld>")).toBe(true);
    expect(writeResultText({ id: "i1", scope: "org", status: "active" })).toBe(
      "stored i1 in org as active",
    );
  });
});

describe("the package", () => {
  test("imports no pi package and depends on no workspace package but core", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies });
    expect(deps.filter((d) => d.startsWith("@engram/"))).toEqual(["@engram/core"]);
    expect(deps.some((d) => d.startsWith("@earendil-works/"))).toBe(false);
    const src = new URL("../src/", import.meta.url);
    for (const f of readdirSync(src))
      expect(readFileSync(new URL(f, src), "utf8"), f).not.toMatch(
        /from\s+["'](@earendil-works|@engram\/pi-extension)/,
      );
  });
});
