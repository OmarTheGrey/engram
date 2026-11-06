# Cassettes

Recorded model responses: the cache of `packages/model/src/cached.ts` (ADR 0032) stored as files (ADR 0017). Each file is one call, named by its cache key and holding the key, the call context (benchmark item, condition, preset, store), the request and the response with its usage.

The key is the sha256 of the canonical JSON of `{item, condition, preset, store, model, seed, prompt}`, where `prompt` is the hash of the whole request. A rerun with the same config therefore makes zero new calls, and each seed is its own sample.

- Record: run with network access and a `fileCache` pointed at a directory under this folder.
- Replay: CI sets `ENGRAM_OFFLINE=1`; any call without a cassette throws `OfflineMissError` naming the key and context. No test reaches the network.
- Cassettes are fixtures: commit them on their own with the reason (`make fixtures` rules), and never edit one by hand.

pi-ai has no sampling-seed option, so the seed separates cache entries rather than steering the provider.
