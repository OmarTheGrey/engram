// The model-call layer shared by the benchmarks and the runner (ADR 0017, ADR 0033):
// the cache every model call in a run goes through, and the scripted model tests
// use. It imports core and pi-ai only, never @engram/bench or @engram/runner, so
// both can import it without forming a cycle.
export * from "./cached.ts";
export {
  type ScriptedPiModel,
  type ScriptStep,
  scriptedModelCall,
  scriptedPiModel,
} from "./scripted.ts";
