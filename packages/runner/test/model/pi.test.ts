// The pi-ai backed ModelCall, driven by pi-ai's faux provider: no network.
import { createModels } from "@earendil-works/pi-ai";
import { expect, test } from "vitest";
import { piModelCall } from "../../src/model/pi.ts";
import { scriptedPiModel } from "../../src/model/scripted.ts";

test("sends the request through pi-ai and returns text and usage", async () => {
  const scripted = scriptedPiModel([{ text: "Tuesday" }]);
  const models = createModels();
  models.setProvider(scripted.provider);
  const call = piModelCall(models, () => scripted.model);

  const response = await call({
    model: "scripted/scripted-1",
    system: "Answer in one word.",
    messages: [{ role: "user", content: "When do deploys happen?" }],
    seed: 1,
    temperature: 0,
  });

  expect(response.text).toBe("Tuesday");
  expect(response.usage.input_tokens).toBeGreaterThan(0);
  expect(scripted.seen[0]?.messages.at(-1)).toMatchObject({ content: "When do deploys happen?" });
});

test("throws when pi-ai reports an error", async () => {
  const scripted = scriptedPiModel([]);
  const models = createModels();
  models.setProvider(scripted.provider);
  const call = piModelCall(models, () => scripted.model);
  await expect(
    call({ model: "scripted/scripted-1", messages: [{ role: "user", content: "x" }], seed: 1 }),
  ).rejects.toThrow();
});
