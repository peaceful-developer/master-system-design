---
slug: llm-eval-platform
title: LLM evaluation platform
track: C
order: 39
difficulty: intermediate
summary: Score every model, prompt and retrieval change against up to 20,000 test cases within an hour, using versioned datasets, calibrated LLM judges and release gates in CI.
concepts: [offline-evaluation, golden-dataset, llm-as-judge, confidence-interval, hallucination, ab-test, data-drift, rate-limiting, message-queue, caching]
prerequisites: [enterprise-rag]
estimatedMinutes: 4
status: outline
exercises: []
diagram: llm-eval-platform-hld
---

## Problem statement

Design an internal evaluation platform in the style of OpenAI Evals. Dozens of teams ship LLM features, and any change to a model version, prompt, retrieval setting or decoding parameter can quietly make answers worse. The platform runs evaluation suites on demand and in CI, compares the scores with a baseline, and blocks releases that regress.

The hard part is that outputs are open-ended text, so there is rarely one right answer. Human grading is accurate but slow. LLM judges are fast but biased: they favor longer answers, the first answer shown, and their own model family. Scores are noisy because generation is sampled, and test sets go stale as real traffic changes.

Questions to ask:

- Who runs evals: model teams, product teams editing prompts, or both? How many runs per day?
- What is evaluated: single answers, RAG pipelines, or multi-turn agents with tool calls?
- Which kinds of scoring exist today: exact checks, rubrics, human ratings, side-by-side preferences?
- Must results block deployment, or only inform it?
- May test data and production samples be sent to a hosted judge model?
- How much production traffic may be sampled for online scoring, under what privacy rules?

## Requirements

**Functional**

- Register versioned datasets (inputs, reference answers, rubrics) and evaluators (code checks, LLM judges, human review queues).
- Run a suite against a candidate configuration and a baseline; report each metric with its uncertainty, per-slice results and per-example diffs.
- Gate releases from CI with pass or fail thresholds per metric.
- Score a sample of production traffic continuously and route low scores to human reviewers.

**Non-functional**

- **Scale:** 500 runs per day; a typical suite has 2,000 cases, the largest 20,000; each case needs one generation and up to two judge calls, about 3 million LLM calls per day.
- **Latency:** a 2,000-case CI suite finishes in under 15 minutes; a 20,000-case release suite in under 1 hour.
- **Reproducibility:** every result records dataset, model, prompt, decoding and judge versions; rerunning a stored run gives the same scores within its noise band.
- **Trust:** an LLM judge may gate releases only after agreeing with human labels on at least 85% of a calibration set.
- **Isolation:** eval traffic never takes LLM capacity needed by production.

## Key concepts

- :term[Offline evaluation]{id="offline-evaluation"}: the release gate; every change is scored on the same cases before any user sees it.
- :term[Golden datasets]{id="golden-dataset"}: versioned, owned test sets with slices (languages, topics, hard cases), so a score always means the same thing.
- :term[LLM-as-a-judge]{id="llm-as-judge"}: grades thousands of open-ended answers per minute with a rubric; showing pairs in random order and checking against human labels controls its biases.
- :term[Confidence intervals]{id="confidence-interval"}: bootstrapped over cases, they tell a team whether a 1-point drop on 2,000 cases is a regression or noise.
- :term[Hallucination]{id="hallucination"} checks: for RAG answers, a faithfulness metric verifies that each claim is supported by the retrieved passages.
- :term[Rate limiting]{id="rate-limiting"}: runs draw from per-team token quotas at lower priority than production, so a large suite cannot starve live traffic.
- :term[Message queue]{id="message-queue"}: each case is an independent task, so workers scale out and a failed call retries alone.
- :term[Caching]{id="caching"}: outputs keyed by a hash of model, prompt, input and settings let a rerun skip unchanged cases, and a new judge can regrade without regenerating.
- :term[A/B tests]{id="ab-test"} and :term[data drift]{id="data-drift"}: offline wins are confirmed online, and production samples reveal topics the golden set no longer covers.

## High-level design

::diagram{id="llm-eval-platform-hld"}

1. A team, or CI on a pull request, submits a run: the candidate configuration, a suite and a baseline. The eval API resolves every part to an immutable version and stores a run manifest.
2. The run scheduler loads the dataset version, skips cases whose outputs are already cached, and puts the rest on a queue as case tasks, throttled to the team's token quota.
3. Eval workers call the candidate model, sampling several outputs per case where answers vary. They score each output with code checks (exact match, JSON schema, unit tests) and an LLM judge that compares candidate and baseline in random order.
4. Scores land in the results warehouse. The report shows per-metric deltas with confidence intervals, per-slice breakdowns and the worst regressions. CI passes only if no gated metric drops beyond its threshold.
5. A consented, PII-scrubbed sample of production traffic flows through the same workers. Low scores and judge-human disagreements go to a review queue; confirmed failures become new golden cases.

The full version of this case study will cover judge calibration and bias controls, statistics for small test sets, quota-aware scheduling of large runs, evaluating multi-turn agents with tool calls, and keeping test sets out of training data.
