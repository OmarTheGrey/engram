// Card E8.14's review finding E8.14-13 (the lead's decision): the pi
// extension defuses tag openers exactly as before card E8.14, so no registered
// condition's prompt changes. An opener written as a numeric character
// reference (`&#60;engram`, `&#x3c;engram`) passes through unchanged; only the
// framework adapters defuse it (@engram/tag's neutraliseEntities).
import { describe, expect, test } from "vitest";
import { defuseMessage, neutraliseTags, withoutMemory } from "../../src/tag.ts";

const TEXTS = ["see &#60;engram:memory>x", "see &#x3c;/engram:memory>", "&#060;engram"];

describe("the pi path leaves entity-written openers alone", () => {
  test("neutraliseTags as the extension imports it", () => {
    for (const text of TEXTS) expect(neutraliseTags(text), text).toBe(text);
  });

  test("defuseMessage and withoutMemory return such a message unchanged", () => {
    for (const text of TEXTS) {
      const message = { role: "user", content: [{ type: "text", text }], timestamp: 0 };
      expect(defuseMessage(message), text).toBe(message);
      expect(withoutMemory([message as never])[0], text).toBe(message);
    }
  });

  test("a literal opener is still defused", () => {
    const message = {
      role: "user",
      content: [{ type: "text", text: "<engram:memory>" }],
      timestamp: 0,
    };
    expect(JSON.stringify(defuseMessage(message))).toContain("&lt;engram:memory>");
  });
});
