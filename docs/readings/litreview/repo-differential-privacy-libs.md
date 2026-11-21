---
id: repo-differential-privacy-libs
title: OpenDP and Google differential-privacy libraries
authors: OpenDP team; Google
venue: open-source repositories
year: 2026
tier: new
topics: [twin, methods, evaluation]
engram: [twin, plane]
code: https://github.com/opendp/opendp
sources_read: ["gh api opendp/opendp: MIT, 448 stars, pushed 2026-11-21, latest release v0.16.0 on 2026-10-06", "gh api google/differential-privacy: Apache-2.0, 3378 stars, pushed 2026-11-20", web search on the discrete Laplace mechanism]
---

## Claim
Vetted libraries exist for floating-point-safe noise addition; for integer counts the discrete Laplace (geometric) mechanism is the standard choice.

## Method
Not a paper. OpenDP is Rust with Python and R bindings; Google's repository has C++, Go, Java and Python libraries. No TypeScript or WASM package was found for either.

## Key numbers
none stated in the sources read.

## What Engram borrows
Design and test vectors: a small discrete-Laplace count mechanism in TypeScript for the dogfood report, cross-checked against OpenDP in Python under research/ (rule 9). Do not claim a production DP library; floating-point side channels are why libraries exist.

## What Engram does differently
The dogfood report holds a handful of counts per member, so a per-report epsilon is large relative to the counts.

## Risk to our claims
A hand-rolled sampler that uses Math.random is not DP. Use a seeded generator for tests and a CSPRNG from node:crypto for real releases, and state the guarantee as conditional on that.

## Open question
Is a single member's report worth noising at all, or only the cross-member aggregates?

## Notes
Rule 12 already permits aggregate counts; DP adds protection against differencing across repeated releases.
