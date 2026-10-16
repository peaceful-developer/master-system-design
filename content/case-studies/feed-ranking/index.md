---
slug: feed-ranking
title: Feed ranking
track: B
order: 20
difficulty: intermediate
summary: Rank 1,500 candidate posts per feed open for 200 million daily users in under 150 ms, with a light ranker, a multi-task heavy ranker and a value score that weighs likes against hides.
concepts: [candidate-generation, fan-out-on-write, embedding, ranking-model, multi-task-learning, position-bias, feature-store, training-serving-skew, offline-evaluation, ab-test]
prerequisites: [news-feed, video-recommendations]
estimatedMinutes: 3
status: outline
exercises: []
diagram: feed-ranking-hld
---

## Problem statement

Design the ranked home feed of a social app in the style of Instagram or Facebook. The [news feed case study](/case-studies/news-feed) builds a chronological feed with fan-out. Here, that machinery becomes candidate generation, and a ranking stage decides which posts are most worth this person's time, including some from accounts they don't follow.

What makes it hard is the objective. Likes are easy to predict; "worth seeing" is not. There are many kinds of engagement with different value, negative signals such as hides are rare but important, and brand-new posts have no engagement yet. All of it must run for about 70,000 feed opens per second at peak.

Questions to ask:

- What's the goal: time spent, meaningful interactions such as comments, or long-term retention?
- Which negative signals count: hide, unfollow, report, quickly scrolling past?
- Do we show posts from accounts the user doesn't follow, and how many?
- How quickly should a post that friends are engaging with rise in the feed?
- Which integrity rules apply, such as demoting borderline content or limiting repeats per author?

## Requirements

**Functional**

- Return 20 ranked posts per page, mixing followed accounts with recommended posts in up to a quarter of the slots.
- Reflect engagement within minutes: a post that friends are commenting on should rise on the next load.
- Respect hides, mutes, unfollows, blocks and integrity demotions.

**Non-functional**

- **Scale:** 200 million daily users with 10 feed opens each, about 70,000 ranking requests per second at peak; about 1,500 candidates per request.
- **Latency:** 150 ms p99 for candidate fetch and ranking, inside a 300 ms feed load.
- **Freshness:** engagement-count features lag by under 2 minutes; ranking models retrain daily.
- **Availability:** 99.95%; if the rankers fail, return the candidates in time order.
- **Quality:** raise comments, shares and 7-day retention without raising hide or report rates.

## Key concepts

- :term[Candidate generation]{id="candidate-generation"} with :term[fan-out on write]{id="fan-out-on-write"}: the news feed's precomputed timelines, plus celebrity posts merged at read time, supply about 1,000 recent posts from followed accounts in a few cache reads.
- :term[Embeddings]{id="embedding"}: a second retriever finds about 500 posts from unfollowed accounts whose embeddings are closest to the user's, which also gives new posts a way in before they have engagement.
- :term[Ranking model]{id="ranking-model"} in two stages: a small CPU model scores all 1,500 candidates in about 10 ms and keeps 300, so the heavy GPU model's cost scales with 300 posts, not 1,500.
- :term[Multi-task learning]{id="multi-task-learning"}: the heavy model predicts the probability of like, comment, share and hide, plus expected dwell time, from shared layers, and a weighted sum of these becomes the post's value score.
- :term[Position bias]{id="position-bias"}: posts near the top get engagement because they are near the top, so position is a training feature that is fixed to one value at serving time.
- :term[Feature store]{id="feature-store"}: serves fast-changing features, such as likes in the last 10 minutes and how often this viewer interacts with this author, next to daily batch features.
- :term[Training–serving skew]{id="training-serving-skew"}: the feed service logs the feature values it ranked with, and training joins those logs to outcomes, instead of recomputing features later.
- :term[Offline evaluation]{id="offline-evaluation"}: each head is checked for AUC and calibration on the next day's data, because a miscalibrated head distorts the weighted value score.
- :term[A/B tests]{id="ab-test"}: launches run for one to two weeks with guardrails on hides and reports, and a small long-term holdout catches slow effects on retention and on creators.

## High-level design

::diagram{id="feed-ranking-hld"}

1. The feed service reads about 1,000 in-network candidates from the timeline cache (fan-out on write, plus celebrity posts merged at read time) and about 500 out-of-network candidates from the post index. It filters out posts already seen, hidden or blocked.
2. The light ranker scores all 1,500 with a few dozen cached features and keeps the top 300.
3. The heavy ranker reads full user, post and author features from the feature store, predicts each engagement head for the 300 posts, and combines them into a value score.
4. The feed service re-ranks for author diversity and integrity demotions, returns 20 posts, and keeps the rest of the ranked list for the next pages.
5. Impressions (with position, model version and features) and engagements flow to daily training, which warm-starts from the last model. The registry deploys versions that pass offline checks, behind an A/B test.

The full version of this case study will cover the estimates, choosing and tuning the value-score weights, ranking brand-new posts, exploration to avoid feedback loops, and experiments that account for effects on creators.
