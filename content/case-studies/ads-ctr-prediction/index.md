---
slug: ads-ctr-prediction
title: Ads click-through rate prediction
track: B
order: 17
difficulty: advanced
summary: Score 30 million candidate ads per second in under 30 ms with a calibrated click model on hashed sparse features, updated every 30 minutes so new ads and trends are learned fast.
concepts: [candidate-generation, feature-hashing, embedding, ranking-model, calibration, class-imbalance, online-learning, delayed-labels, feature-store, training-serving-skew, ab-test]
prerequisites: [video-recommendations]
estimatedMinutes: 4
status: outline
exercises: []
diagram: ads-ctr-prediction-hld
---

## Problem statement

Design the click-through rate (CTR) prediction service behind an ad platform in the style of Google Ads or Meta Ads. For every ad request, it estimates the probability that this user clicks each eligible ad. The auction ranks ads by bid × predicted CTR, so the prediction decides which ad wins and what it pays.

The hard part is that the probability itself is the product, not just the order: a model that predicts 2% when the true rate is 1% wins that ad slots it should lose and sets wrong prices. Clicks are rare (about 1 per 100 impressions), the inputs are billions of sparse ids, and ads and interests change by the hour.

Questions to ask:

- How does the auction use the prediction, and are advertisers charged per click or per impression?
- How many ad requests per day, and how many eligible ads per request?
- How quickly must a new ad get good predictions?
- Do we also predict conversions after the click, or only clicks?

## Requirements

**Functional**

- For each request, return a calibrated click probability for every candidate ad, given the user, the ad and the context (page, slot, device, time).
- New ads get a usable prediction from their first impression.
- Every impression is logged with the exact feature values used to score it.

**Non-functional**

- **Scale:** 3 billion ad requests per day (about 35,000 per second on average, 100,000 at peak); about 300 candidate ads per request, so 30 million predictions per second at peak; 10 million active ads.
- **Latency:** 30 ms p99 to score all candidates of one request, inside a 100 ms ad-serving budget.
- **Freshness:** a new model version every 30 minutes; a click influences predictions within an hour.
- **Quality:** average predicted CTR within 3% of observed CTR, overall and for each major segment (ad format, country, device).
- **Availability:** 99.99%; if the model times out, fall back to each ad's historical CTR rather than show no ads.

## Key concepts

- :term[Candidate generation]{id="candidate-generation"}: targeting rules, budgets and a light model cut 10 million ads to about 300 eligible ones, so the expensive model only scores those.
- :term[Feature hashing]{id="feature-hashing"} with :term[embeddings]{id="embedding"}: ids for users, ads, query words and their crosses run into billions, and hashing them into fixed-size embedding tables bounds the model at the cost of rare collisions.
- :term[Ranking model]{id="ranking-model"}: a deep network learns interactions between sparse features, such as user × advertiser or query × ad text, and predicts P(click) per candidate.
- :term[Calibration]{id="calibration"}: a final layer maps raw scores to probabilities that match observed click rates per segment, because an ad overestimated by 10% looks 10% more valuable in every auction.
- :term[Class imbalance]{id="class-imbalance"}: training keeps every click and about 10% of non-clicks, then corrects predictions for that sampling rate so they stay true probabilities.
- :term[Online learning]{id="online-learning"}: the trainer continues from the latest checkpoint every 30 minutes, so new ads and trends are learned within the hour.
- :term[Delayed labels]{id="delayed-labels"}: a click can arrive minutes after the impression, so the label joiner waits 15 minutes before recording a non-click.
- :term[Feature store]{id="feature-store"} and :term[training–serving skew]{id="training-serving-skew"}: the ad server logs the feature values it used and training reads those logs, so the model never learns from values it would not have at request time.
- :term[A/B tests]{id="ab-test"}: launches are judged on revenue per thousand requests, advertiser return and guardrails such as ad hide rate, not on offline log loss alone.

## High-level design

::diagram{id="ads-ctr-prediction-hld"}

1. The ad server receives a request with the user, page and slot. It retrieves about 300 eligible ads from the ad index (targeting, budget pacing, policy) and reads user, ad and context features from the feature store.
2. The CTR model scores all candidates in one batch: hashed ids become embeddings, a network models their interactions, and a calibration layer outputs probabilities.
3. The auction ranks candidates by bid × predicted CTR, picks winners and sets prices. Each impression is logged with its request id, model version and features.
4. Impressions and clicks flow through an event stream to the label joiner, which matches them within 15 minutes, downsamples non-clicks and writes training examples.
5. Every 30 minutes the trainer updates the model and evaluates it on the newest data it has not yet trained on (log loss and calibration per segment). The registry pushes versions that pass and rolls back on online alerts; new features or architectures go through an A/B test.

The full version of this case study will cover the estimates, sizing and sharding terabyte-scale embedding tables, the probability correction for downsampled negatives, cold start for new ads, and position bias in click data.
