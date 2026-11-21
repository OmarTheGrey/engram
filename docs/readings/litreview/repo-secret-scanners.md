---
id: repo-secret-scanners
title: "Secret scanners: gitleaks, detect-secrets, secretlint (and trufflehog)"
authors: gitleaks authors; Yelp; secretlint authors
venue: open-source repositories
year: 2026
tier: new
topics: [secrets, regex, redaction, write-gate]
engram: [govern, plane, twin, H3]
code: https://github.com/gitleaks/gitleaks ; https://github.com/Yelp/detect-secrets ; https://github.com/secretlint/secretlint
sources_read: [gh api repository metadata and file listings, 2026-11-21; config/gitleaks.toml header and rule count]
---

## Claim
Secret detection is mature, mostly regex with a keyword prefilter and an entropy check, and the rule sets are data that can be ported.

## Method
Checked with gh api and npm view on 2026-11-21. Rule texts were not read beyond the file header.

## Key numbers
- gitleaks: MIT, 31,230 stars, last push 2026-10-28, Go. `config/gitleaks.toml` is 97,731 bytes with 222 `[[rules]]` and 221 `keywords` lines; entropy thresholds in the file include 3.8 and 4.
- detect-secrets: Apache-2.0, 4,682 stars, last push 2026-04-02, Python. Plugins: artifactory, aws, azure_storage_key, basic_auth, cloudant, discord, github_token, gitlab_token, high_entropy_strings, ibm_cloud_iam, ibm_cos_hmac, ip_public, jwt, keyword, mailchimp, npm, openai, private_key, pypi_token, sendgrid, slack, softlayer, square_oauth, stripe, telegram_token, twilio.
- secretlint: MIT, 1,503 stars, last push 2026-11-21, TypeScript; npm `secretlint` 14.0.1 and `@secretlint/secretlint-rule-preset-recommend` 13.1.0, both MIT.
- trufflehog: AGPL-3.0, 29,559 stars. Not absorbable; ideas only.

## What Engram borrows
A generated TypeScript rule table from gitleaks.toml (id, regex, keywords, entropy, allowlist) with a script and a pinned upstream commit, MIT notice kept. The gate denies a write whose content matches a rule at or above a configured severity, or masks it.

## What Engram does differently
Scanners run on files and commits. Engram scans memory content at the write gate and on adoption, and records the rule id in the event reason with the secret itself masked.

## Risk to our claims
Go regex features (named groups, inline flags) may not translate to JavaScript RegExp; some rules will not port. Count and publish the ported fraction.

## Open question
Is a secret in a user-sourced person-scope write denied, or stored and masked? Twin consent needs the answer in policy, not code.

## Notes
secretlint is a ready TypeScript dependency, but it is a CLI and plugin framework; a ported table is lighter.
