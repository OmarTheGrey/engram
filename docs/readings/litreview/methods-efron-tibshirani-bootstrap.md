---
id: methods-efron-tibshirani-bootstrap
title: "An Introduction to the Bootstrap"
authors: Bradley Efron, Robert J. Tibshirani
venue: Chapman and Hall/CRC, Monographs on Statistics and Applied Probability 57, 1993, ISBN 0-412-04231-2
year: 1993
tier: research
topics: [methods, evaluation]
engram: [H1, H2, H3, H4, H5]
code: none (implementation sketch below; scipy.stats.bootstrap with paired=True and method BCa is a reference implementation)
sources_read: [https://en.wikipedia.org/wiki/Bootstrapping_(statistics), https://mason.gmu.edu/~csutton/ch14789bs.html, https://metricgate.com/calculator/bootstrap-bias-correction, https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bootstrap.html, https://arxiv.org/pdf/1411.5279]
---

## Claim
The sampling distribution of almost any statistic can be approximated by recomputing the statistic on resamples drawn with replacement from the data, and confidence intervals read from that distribution are accurate to first order (percentile) or second order (BCa, bootstrap-t) without a formula for the standard error.

## Method
The book itself was not available online; this note is assembled from secondary sources that cite its chapter 14 equations. Paired bootstrap for a difference between conditions: the unit is the task, each task carries its outcome under condition A and condition B, and a resample draws n task indices with replacement and applies the same indices to both columns, so the pairing survives (scipy paired=True). The statistic is the mean paired difference d. Repeat B times to get d*_1 ... d*_B. Percentile interval: the alpha / 2 and 1 - alpha / 2 quantiles of the d* (E&T eq. 13.5 region, cited by Wikipedia at p. 171). BCa interval (E&T eq. 14.9 and 14.10, p. 185; Sutton notes): compute z0 = Phi^-1(fraction of d* below the observed d) (eq. 14.14); compute the acceleration from jackknife leave-one-out values d_(i) with mean d_(.): a = sum (d_(.) - d_(i))^3 / (6 [sum (d_(.) - d_(i))^2]^(3/2)) (eq. 14.15, p. 186); then alpha1 = Phi(z0 + (z0 + z_(alpha/2)) / (1 - a (z0 + z_(alpha/2)))) and alpha2 = Phi(z0 + (z0 + z_(1-alpha/2)) / (1 - a (z0 + z_(1-alpha/2)))), and the interval is the alpha1 and alpha2 quantiles of the d* (metricgate, standard form). With z0 = 0 and a = 0 BCa reduces to the percentile interval. Both are transformation respecting; bootstrap-t is not (Sutton notes).

## Key numbers
- E&T recommend about B = 1,000 for confidence intervals; Hesterberg argues for 10,000 routinely and at least 15,000 to keep Monte Carlo error near 10 percent for percentile and bootstrap-t intervals (arXiv 1411.5279, Sec. 3.6).
- Wikipedia: a nominal 90 percent percentile interval for a variance with n = 20 covered the truth 78 percent of the time; percentile intervals are too narrow in small samples.
- Sutton notes: an E&T example where positive z0 and a move a 90 percent interval to the 11th and 98.5th percentiles (eq. 14.12, 14.13); BCa coverage 0.9324 against percentile 0.9244 for an exponential mean at n = 36; 0.8712 against 0.8000 for a normal variance at n = 16.
- scipy defaults: n_resamples 9,999, method BCa; BCa returns NaN on a degenerate bootstrap distribution.
- arXiv 2601.17103 (Sec. 3.1.5): 9,999 resamples, an odd count so quantiles fall on actual resamples; percentile is the most robust method across settings, BCa slightly better for means, and BCa fails for the median.

## What Engram borrows
ADR 0016's "paired bootstrap intervals on condition differences per benchmark" is this, made exact: unit = benchmark task, pairs = the same task under two conditions with the same model and seed, statistic = mean difference, B = 10,000 pre-registered, seed fixed, BCa as the primary interval with percentile reported beside it, and the z0 and a values logged so a reviewer can see when BCa moved the endpoints. It lands in research/stats with a test that plants a known effect in synthetic data and checks coverage over repeated draws (S0.12, R1). Three models and three seeds are strata: the resample draws tasks, not models, and per-provider intervals are secondary.

## What Engram does differently
Nothing in the method. Two decisions worth recording: a bootstrap p-value for Holm is defined as the smallest alpha at which the BCa interval excludes zero on the same resamples, and the degenerate case (every paired difference zero, which can happen on a small benchmark where two conditions agree) is reported as such, not as a NaN interval.

## Risk to our claims
Our paired differences are means of 0/1 outcomes on a few hundred tasks with three seeds; the bootstrap distribution will be discrete and may be skewed near a 0 or 1 success rate, which is where percentile intervals are known to be too narrow (Wikipedia) and BCa's acceleration matters. If a and z0 are large, the interval depends on the jackknife over tasks, and a handful of tasks can dominate. Mitigation: report both intervals, log a and z0, and run the planted-effect coverage test at the benchmark's actual n before any real result is read.

## Open question
With three seeds, is the right unit the task (mean over seeds first) or the task-seed pair? The task-seed pair triples n but ignores the within-task correlation; the task is conservative. Decide in S0.12 and keep one.

## Notes
The E&T equation and page numbers (14.9, 14.10, 14.14, 14.15, pp. 185 to 187) come from Sutton's course notes on the book and should be checked against a physical copy before the thesis cites them. The BCa formulas come from a calculator page in standard notation; they match the form in Efron 1987 as cited there. Hesterberg's recommendation against the reverse percentile interval ("almost the worst of everything") is noted; Engram does not use it.
