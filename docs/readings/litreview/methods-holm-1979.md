---
id: methods-holm-1979
title: "A Simple Sequentially Rejective Multiple Test Procedure"
authors: Sture Holm
venue: Scandinavian Journal of Statistics, 6(2), 65 to 70, 1979
year: 1979
tier: research
topics: [methods, evaluation]
engram: [H1, H2, H3, H4, H5]
code: none (the procedure is a dozen lines; see the implementation sketch below)
sources_read: [https://www.ime.usp.br/~abe/lista/pdf4R8xPVzCnX.pdf, https://en.wikipedia.org/wiki/Holm%E2%80%93Bonferroni_method]
---

## Claim
Testing n hypotheses in order of their p-values against thresholds alpha / n, alpha / (n - 1), ..., alpha / 1, and stopping at the first failure, controls the familywise error rate at alpha for any configuration of true and false nulls, with no independence assumption, and rejects at least as much as classical Bonferroni.

## Method
For each hypothesis H_k compute its obtained level R_k, the p-value. Sort them R_(1) <= ... <= R_(n) with hypotheses H_(1), ..., H_(n). At step i compare R_(i) with alpha / (n - i + 1). If R_(i) is below the threshold, reject H_(i) and continue; otherwise accept H_(i) and all remaining hypotheses and stop (Sec. 2, "sequentially rejective Bonferroni test"). Theorem 1 states the procedure has multiple level of significance alpha for free combinations. The proof is the Boole inequality: let I be the set of true hypotheses with m members; with probability at least 1 - alpha every true R_i is at least alpha / m; on that event the smallest true p-value cannot pass its threshold, because by the time the procedure reaches it at most n - m false hypotheses have been rejected and the threshold is at most alpha / m, so the procedure stops before rejecting any true hypothesis (Sec. 2). A Sidak-type variant replaces the thresholds with 1 - (1 - alpha)^(1 / (n - i + 1)) under independence (Sec. 3). Theorem 2 gives a weighted version with S_k = R_k / c_k for importance constants c_k.

Implementation sketch, equivalent adjusted p-values (Wikipedia, standard form): sort p, set adj_(i) = max over j <= i of min((n - j + 1) p_(j), 1), reject H_(i) when adj_(i) <= alpha. The running max keeps the adjusted values monotone so the decisions match the step-down rule.

## Key numbers
- Example (Sec. 4): ten independent unit-variance normal statistics, four means at 0, four at 6.0, two at 3.0, multiple level 0.05. Classical Bonferroni rejects both moderate hypotheses with probability 0.439; the sequential procedure with probability 0.565.
- Dunnett comparison (Sec. 5): nine treatments against one control, four observations each; sequential Bonferroni constants 1.70, 2.04, 2.23, 2.36, 2.46, 2.54, 2.60, 2.66, 2.71 against refined Dunnett constants 1.70, 1.99, 2.15, 2.25, 2.33, 2.40, 2.45, 2.50, 2.54; classical Dunnett uses 2.54 throughout.
- Wikipedia example: adjusted values 0.03, 0.06, 0.06, 0.02 at alpha 0.05 reject hypotheses one and four only.

## What Engram borrows
ADR 0016 names Holm as the correction across H1 to H5, so n = 5 and the thresholds are 0.01, 0.0125, 0.0167, 0.025, 0.05 in order of the sorted p-values. It lands in research/stats as a pure function over a list of (hypothesis, p) pairs returning adjusted p-values and decisions, tested against the Wikipedia example and the Sec. 4 example by simulation (S0.12 names the test; R1 runs it). Each hypothesis's p-value comes from its paired bootstrap, so the five are dependent; Holm needs no independence, which is why it is chosen over Hochberg or Hommel.

## What Engram does differently
Nothing in the procedure. One choice to record: Engram's primary claims are interval estimates from the paired bootstrap (effect size with a confidence interval), and the Holm-adjusted decision is reported beside them, not instead of them. If a bootstrap p-value is needed, it is the smallest alpha at which the two-sided percentile or BCa interval excludes zero, computed on the same resamples.

## Risk to our claims
With n = 5 the first threshold is 0.01. Three models times three seeds times a benchmark subset is not a large sample, and a true but small governance effect in H2 or H3 may fail the first step and then, by the stopping rule, nothing below it in the ordering is tested. Mitigation: the stopping rule per hypothesis in ADR 0016 fixes sample size before the run; the weighted variant (Theorem 2) is an option if the team wants H1 and H5 to carry more weight, but it must be pre-registered.

## Open question
Should the family be the five hypotheses, or the five hypotheses times three providers (n = 15)? Pooling across providers is one test; per-provider is a secondary analysis. Decide in S0.12.

## Notes
The scan read is the original paper; the proof wording is partly garbled in the OCR but the logic is as stated. The procedure is uniformly more powerful than Bonferroni (Wikipedia); Hochberg's step-up is more powerful still but needs independence or positive dependence, which bootstrap p-values on shared tasks do not satisfy. JSTOR 4615733.
