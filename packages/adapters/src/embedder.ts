// The embedding model a vector-backed adapter indexes with, injected at the
// boundary like a ModelCall (AGENTS.md rule 4): adapters never construct a
// model client themselves. Tests pass the hashing fake in src/fake/embedder.ts.
export interface Embedder {
  /** Length of every vector this embedder returns. */
  readonly dimension: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
