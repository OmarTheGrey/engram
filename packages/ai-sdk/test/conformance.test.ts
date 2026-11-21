// Card E8.14's acceptance: @engram/ai-sdk passes the kit's adapter
// conformance suite (@engram/kit/conformance). Writes are the remember tool
// as the AI SDK runs it (the model's tool-call input, whatever it holds,
// given to execute); reads are the middleware's recall, and what the suite
// checks is what the middleware adds to the prompt the model is sent.
import { fileURLToPath } from "node:url";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { type KitAdapterSubject, kitConformance } from "@engram/kit/conformance";
import { describe, test } from "vitest";
import { engramMemory } from "../src/index.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const aiSdk: KitAdapterSubject = {
  name: "@engram/ai-sdk",
  root: ROOT,
  create(options) {
    const memory = engramMemory({ ...options, namespace: ["person", "dana"] });
    let calls = 0;
    return {
      write: (input) =>
        memory.tools.remember.execute(input as never, { toolCallId: `call-${++calls}` }),
      async read(input) {
        const params = await memory.middleware.transformParams?.({
          type: "generate",
          params: {
            prompt: [{ role: "user", content: [{ type: "text", text: String(input.query) }] }],
          },
          model: {} as LanguageModelV4,
        });
        // What the middleware added: the system messages (the prompt had none).
        return (params?.prompt ?? [])
          .filter((m) => m.role === "system")
          .map((m) => String(m.content))
          .join(" ");
      },
    };
  },
};

describe("the AI SDK adapter on the kit", () => {
  for (const c of kitConformance(aiSdk)) test(c.name, c.run);
});
