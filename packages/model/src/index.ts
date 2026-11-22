// The model-call layer shared by the benchmarks and the runner (ADR 0017, ADR 0033):
// the cache every model call in a run goes through, and the scripted model tests
// use. It imports core and pi-ai only, never @engram/bench or @engram/runner, so
// both can import it without forming a cycle. The cassette proxy (card B10, ADR 0036)
// serves an outside harness's OpenAI calls through the same cache.
export * from "./cached.ts";
export * from "./nli.ts";
export * from "./proxy.ts";
export { type RecordingPlace, recordingRefusal } from "./recording.ts";
export {
  asScripted,
  isScripted,
  isScriptedChatCall,
  type ScriptedChatReply,
  type ScriptedPiModel,
  type ScriptStep,
  scriptedChatCall,
  scriptedModelCall,
  scriptedPiModel,
} from "./scripted.ts";
