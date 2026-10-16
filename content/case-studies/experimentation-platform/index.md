---
slug: experimentation-platform
title: Experimentation (A/B testing) platform
track: B
order: 30
difficulty: intermediate
summary: Run 1,000 concurrent A/B tests on 200 million daily users, with hash-based assignment in the SDK, a metric pipeline over 10 billion events a day, and statistics that stay valid when teams peek.
concepts: [ab-test, hash-partitioning, minimum-detectable-effect, cuped, sample-ratio-mismatch, sequential-testing, confidence-interval, stream-processing, switchback-experiment]
prerequisites: [video-recommendations]
estimatedMinutes: 3
status: outline
exercises: []
diagram: experimentation-platform-hld
---

## Problem statement

Design an experimentation platform like the ones large consumer apps build in house. Any team can test a change, whether a new button, a ranking model or a price, on a random share of users, and get a trustworthy answer: did it move the metrics that matter, by how much, and is that more than noise?

The hard part is trust at scale. Assignment must be consistent and instant on every request, with no network call. Metrics must be computed for every experiment over billions of events. And the statistics must survive real habits: checking daily, scanning hundreds of metrics, and launching on the one that looks good.

Questions to ask:

- How many users, concurrent experiments and metrics?
- What is the unit of randomization: user, device, session, or market?
- How fast do teams need results, and will they look before the end?
- Which guardrail metrics can block a launch?
- Can one user be in many experiments at once?

## Requirements

**Functional**

- Define an experiment: variants, traffic share, targeting, primary and guardrail metrics, planned duration.
- Assign users consistently on every platform; log an exposure when a variant is actually shown.
- Compute per-variant results with confidence intervals daily, and guardrails hourly.
- Flag sample ratio mismatch and guardrail regressions; a kill switch returns everyone to control within minutes.
- Keep a searchable record of every experiment, result and decision.

**Non-functional**

- **Scale:** 200 million daily users; 1,000 concurrent experiments; 10 billion events per day (about 115,000 per second); 500 metric definitions.
- **Latency:** assignment runs inside the SDK in under 1 ms, with no network call per request.
- **Freshness:** guardrails within 1 hour; full scorecards daily.
- **Correctness:** the false-positive rate stays at the stated 5% even with daily looks; every result is reproducible from logged data.
- **Availability:** if the config cannot load, the SDK serves control.

## Key concepts

- :term[A/B tests]{id="ab-test"}: the primary metric, guardrails and duration are fixed before launch, so a team cannot pick whichever of 500 metrics happened to move.
- :term[Hashing into buckets]{id="hash-partitioning"}: hashing the user id with an experiment salt into 1,000 buckets gives a stable assignment with nothing stored per user; different salts keep experiments independent.
- :term[Minimum detectable effect]{id="minimum-detectable-effect"}: sets the sample size up front. Detecting a 1% relative change in a 10% conversion rate needs about 1.4 million users per variant at 80% power.
- :term[CUPED]{id="cuped"}: adjusting each user's metric by their pre-experiment value removes variance unrelated to the change, so stable metrics reach significance with fewer users.
- :term[Sample ratio mismatch]{id="sample-ratio-mismatch"}: a planned 50/50 split that logs 1,010,000 versus 990,000 users is far beyond chance; results are hidden until the assignment or logging bug is found.
- :term[Sequential testing]{id="sequential-testing"}: stopping at the first p-value under 0.05 across weeks of daily looks pushes false positives toward 20%; sequential tests keep them at 5%.
- :term[Confidence intervals]{id="confidence-interval"}: scorecards show each effect with its interval, so a flat result shows whether a meaningful harm was ruled out.
- :term[Stream processing]{id="stream-processing"}: guardrails are computed from the event stream hourly, so a broken variant is stopped within an hour, not a day.
- :term[Switchback experiments]{id="switchback-experiment"}: when users affect each other, as in marketplaces, the platform randomizes by region and time window instead of by user.

## High-level design

::diagram{id="experimentation-platform-hld"}

1. An owner defines the experiment, and the experiment API sizes it from the minimum detectable effect. Experiments that could interact share a layer, where each user gets at most one; experiments in different layers overlap freely.
2. SDKs fetch the config every minute and assign locally by bucket. When a user actually sees a variant, the SDK logs an exposure.
3. Exposures and product events flow through the collector to the event stream and the warehouse. Hourly jobs on the stream check guardrails and sample ratios; a failing guardrail can trigger the kill switch.
4. Each day the stats engine joins exposures with events per user, computes every metric per variant, applies CUPED with pre-experiment data, runs sequential tests, and writes scorecards.
5. Owners ramp, ship or stop. For ML teams this closes the training loop: a new model is a variant, and it ships only on an online win.

The full version of this case study will cover assignment and layering, the metric pipeline at 10 billion events per day, variance reduction and sequential tests, diagnosing sample ratio mismatch, and experiments where users interact.
