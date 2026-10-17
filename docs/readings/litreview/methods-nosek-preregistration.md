---
id: methods-nosek-preregistration
title: "The Preregistration Revolution"
authors: Brian A. Nosek, Charles R. Ebersole, Alexander C. DeHaven, David T. Mellor
venue: PNAS 2018, doi 10.1073/pnas.1708274114 (volume and pages not visible in the sources read)
year: 2018
tier: research
topics: [methods, evaluation]
engram: [plane, H1, H2, H3, H4, H5]
code: none (not a software paper)
sources_read: [https://errorstatistics.com/wp-content/uploads/2017/07/nosek-et-al-preregistration-revolution.pdf, https://www.citedrive.com/en/discovery/the-preregistration-revolution/]
---

## Claim
Science generates hypotheses from existing observations (postdiction) and tests them with new ones (prediction). Mixing the two makes exploratory findings look confirmatory, and hindsight bias makes the mixing hard to notice. Committing the questions and the analysis plan to a registry before the outcomes are seen keeps the two apart and makes bad practice detectable.

## Method
A position paper, not an experiment. It defines a preregistration as the study design and analysis plan, posted to an independent registry before the data are observed: research questions, analytic steps, exclusions, transformations and covariates, with contingency rules written as decision trees or standard operating procedures. It explains why p-values are only interpretable for predictions: with many analytic forks, the nominal error rate of a postdiction is unknown. It then works through nine challenges and answers each: changes during data collection (document them), violated assumptions (staged registration, blinded data, decision trees), pre-existing data (register anyway and say what was known), longitudinal and large datasets (register before new variables are observed), many experiments (templates, or treat early ones as exploratory then replicate), a programme of research (register everything, report all outcomes, correct for multiplicity), few a priori expectations (alternate exploration and registered tests, or a sealed holdout), competing predictions (a strength of the method), and narrative inference (report all outcomes and let readers judge).

## Key numbers
- More than 7,000 registrations on the Open Science Framework at the time of writing (text).
- Franco, Malhotra and Simonovits, cited: 40 percent of published papers in a preregistered sample omitted one or more manipulations and 70 percent omitted one or more outcome variables; 96 percent of consistently significant findings were published against 65 percent of null effects (text).
- Open data badges were followed by more than a 10-fold rise in data sharing in an initial test (text).
- The Preregistration Challenge offered one thousand awards of 1,000 dollars (text).
- The manuscript read gives no volume or page numbers; the DOI is the citation anchor.

## What Engram borrows
ADR 0023 is this paper applied: docs/research/preregistration.md is versioned, tagged prereg-vN, and the version preceding the first real run is deposited externally so the date is attested (S0.12, Gate A). The five hypotheses, seven conditions, six benchmarks, metric, test, seeds, models and stopping rule per hypothesis are the "analysis plan" the paper asks for (ADR 0016). The sealed-holdout answer to challenge 7 is why the analysis code is tested on synthetic data with planted effects before it sees real results, and why dogfood exploration on the team's own sessions is reported as exploratory, never as a test of H1 to H5. Changes after the tag are amendments with reasons, never edits.

## What Engram does differently
Nothing in substance. Two practical choices: the registry is the git tag plus an external deposit rather than a registry form, and the preregistration is executable, since research/tests/test_prereg.py checks completeness and the runner refuses a benchmark or test that is not in the file (AGENTS.md "What not to do").

## Risk to our claims
The paper's own point is the risk: without the tag before the first run, every H1 to H5 result is a postdiction and the Holm-corrected p-values mean nothing. A second risk is challenge 1, changes during the run. Benchmark pins, model deprecations and judge updates will force changes mid-experiment. Mitigation: rule 8 forbids pin changes mid-run, and any forced change is an amendment entry with the diff in results explained.

## Open question
Challenge 6 asks for correction across a whole programme of research, not one paper. Engram corrects across five hypotheses with Holm. Should secondary analyses (per-provider H5, strong-to-weak transfer) be registered as exploratory with no correction, or counted in the family? Decide in S0.12 and write it down.

## Notes
Read from the accepted-manuscript PDF hosted at errorstatistics.com; the PNAS and PMC pages did not load. Key sentence worth keeping: "Preregistration does not eliminate the possibility of poor statistical practices, but it does make them detectable." The authors prefer OSF over AsPredicted unless the completed form is posted to a registry. Funding: Laura and John Arnold Foundation and the National Institute on Aging.
