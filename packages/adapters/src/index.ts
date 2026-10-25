// One adapter per store, each implementing the Adapter contract.
export * from "./contract.ts";
export type { Embedder } from "./embedder.ts";
export { createHashingEmbedder } from "./fake/embedder.ts";
export { createFakeAdapter, type FakeAdapterOptions } from "./fake/index.ts";
export {
  createFilesAdapter,
  type FilesAdapterOptions,
  importedItemId,
  ReadOnlyItemError,
  UnsafeKeyError,
} from "./files/index.ts";
export { createMem0Adapter, type Mem0AdapterOptions } from "./mem0/index.ts";
