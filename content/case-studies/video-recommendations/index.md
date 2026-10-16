---
slug: video-recommendations
title: Video recommendations
track: B
order: 16
difficulty: intermediate
summary: Recommend videos to 100 million daily viewers from a catalog of 10 million in under 200 ms, with two-tower retrieval, a multi-task ranking model, and a training loop that keeps both fresh.
concepts: [two-tower-model, candidate-generation, ranking-model, embedding, approximate-nearest-neighbor, feature-store, cold-start, offline-evaluation, ab-test, training-serving-skew]
prerequisites: [news-feed]
estimatedMinutes: 17
status: complete
exercises: [video-recommendations-quiz, video-recommendations-estimation]
diagram: video-recommendations-hld
---

## Problem statement

Design the home-screen recommendations for a video platform. When a viewer opens the app, show a personalized row of videos they're likely to enjoy, chosen from a catalog of 10 million, fast enough that the page doesn't wait.

This is the canonical ML system design problem. It combines a hard serving constraint (millions of items, a latency budget measured in milliseconds) with the classic ML questions: what to optimize, where labels come from, how to evaluate, and how to keep the model from drifting.

:::primer
A **recommender** predicts which items a person will like and shows the best ones first. Large recommenders work in stages, like a funnel: a fast **retrieval** stage narrows millions of videos to a few hundred plausible ones, and a slower, smarter **ranking** stage puts those few hundred in order. The [ML system design framework](/playbooks/ml-system-design-framework) explains the general method.
:::

Questions to ask:

- What's the business goal: watch time, satisfaction, retention, creator diversity?
- How many viewers and videos, and how often is the home screen loaded?
- What signals do we log: impressions, clicks, watch time, likes, "not interested"?
- How fresh must recommendations be: should a video uploaded an hour ago be recommendable?
- Are there policies to respect: age ratings, regional licensing, limits on repetition?

## Requirements

**Functional**

- Return 20 ranked videos for a viewer's home screen, excluding videos they've watched or dismissed and videos not licensed in their region.
- Use recent behaviour: what someone watched a few minutes ago should influence the next load.
- New videos become recommendable within an hour of upload.

**Non-functional**

- **Scale:** 100 million daily viewers, 5 home-screen loads each per day; 10 million videos.
- **Latency:** 200 ms p99 for the whole request, of which about 100 ms is available for retrieval and ranking.
- **Availability:** 99.9%; if the models fail, fall back to popular videos rather than an empty screen.
- **Quality:** improve long-term watch time and satisfaction, without collapsing into a narrow loop of the same content.

## Back-of-envelope estimates

Every input here is an assumption to confirm.

| Quantity | Calculation | Result |
| --- | --- | --- |
| Requests | 100M × 5 = 500M per day ÷ 86,400 | ~5,800 per second, ~17,000 at peak |
| Candidates scored | 17,000 per second × 500 candidates | ~8.7M per second at peak |
| Ranking GPUs | 8.7M ÷ 200,000 candidates per GPU per second × 1.5 headroom | ~64 GPUs |
| Ranking cost | 64 GPUs × $2 per GPU-hour ÷ 20.8M requests per hour (average) | ~$0.006 per 1,000 requests |
| Video embeddings | 10M × 128 dimensions × 4 bytes | ~5 GB, fits in memory per index replica |
| Video features | 10M × 1 KB | ~10 GB, cached in ranking servers |
| Training logs | 500M requests × 20 impressions × 200 bytes | ~2 TB per day |

This isn't a language model, so the throughput unit is **candidates scored per second** rather than tokens per second. The GPU throughput (200,000 candidates per second) and the $2 per GPU-hour price are illustrative assumptions; measure your own model.

**What the numbers say:** scoring every video per request is impossible (10M × 17,000 per second), so retrieval must cut the catalog to hundreds. The embedding index is small enough to replicate many times for throughput. Ranking is the main serving cost, but at well under a cent per thousand requests it's affordable.

## API design and data model

```http
GET /v1/recommendations?surface=home&count=20
Authorization: Bearer <token>

200 OK
{ "request_id": "r_7f3", "items": [ { "video_id": "v_918", "reason": "Because you watched …" }, … ] }
```

The `request_id` is logged with every impression and later interaction, so training data can join what was shown with what happened.

**Logged events** (to a stream, then the warehouse): `impression(request_id, user_id, video_id, position, model_version)`, `play`, `watch_progress(seconds)`, `like`, `dismiss`.

**Features** (in a feature store, read online and logged for training):

- User: watch history embedding, topic preferences, language, device, recent activity counts.
- Video: topic, creator, age, length, popularity over the last hour and day, content embedding.
- Context: time of day, network type, surface.
- User–video: has the user watched this creator before? How recently?

## High-level design

::diagram{id="video-recommendations-hld"}

**Serving (per request):**

1. The recommendation API reads the viewer's features from the :term[feature store]{id="feature-store"}.
2. The **user tower** turns them into an embedding (a few milliseconds on CPU).
3. An :term[approximate nearest neighbor]{id="approximate-nearest-neighbor"} index returns the ~500 videos whose embeddings are closest. Other retrievers run in parallel (recent uploads from subscribed creators, trending in the region) and add candidates.
4. Filters remove watched, dismissed and unlicensed videos.
5. The **ranking model** on GPU scores the remaining candidates with rich features.
6. A re-ranking step applies business rules (diversity, no more than two videos per creator) and returns 20.

**Learning (continuous):** impressions and watches flow through an event stream into the warehouse; training pipelines rebuild models on a schedule; a model registry versions them; deployments roll new ranking models out gradually, and the video tower re-embeds the catalog to refresh the index.

## Deep dives

### Retrieval with two towers

::figure{id="two-tower-retrieval" caption="User and video towers map into one space; the nearest videos to the user become ranking candidates."}

The :term[two-tower model]{id="two-tower-model"} learns a user embedding and a video embedding such that videos a user watched score high. Because the towers are independent, all 10 million video :term[embeddings]{id="embedding"} are computed offline; online, only the user side runs. The [two-tower retrieval example](/examples/two-tower-retrieval) walks through this pattern.

Training details that matter in practice:

- **Negatives:** use other videos in the same training batch as negatives (in-batch negatives), and correct for popularity, otherwise popular videos are unfairly pushed away from everyone.
- **Freshness:** new uploads are embedded by the video tower from their content and metadata, so they can be retrieved within the hour, before they have any watches (:term[cold start]{id="cold-start"}).
- **Evaluation:** recall@500 on held-out watches, meaning how often the video a user actually watched next appears in the 500 retrieved.

### Ranking: what to predict

A single "click probability" target rewards clickbait. Instead, the :term[ranking model]{id="ranking-model"} is **multi-task**: one network with several heads predicting probability of play, expected watch time, probability of like, and probability of dismiss. The final score combines them, for example:

> score = P(play) × E[watch minutes | play] + 0.5 × P(like) − 2 × P(dismiss)

The weights are a product decision, tuned with A/B tests. The model uses the cross features retrieval can't: whether this user watched this creator before, and how recently.

### Feedback loops and exploration

The system learns from what it showed. Videos it never shows never get watched, so the model never learns they're good, and recommendations narrow over time. Counter it with:

- **Exploration:** reserve a small share of slots (say 5%) for candidates outside the top scores, and log their scores so training can correct for how items were chosen.
- **Position bias:** items shown first get more clicks regardless of quality; include position as a training feature and set it to a fixed value at serving time.
- **Diversity in re-ranking:** limit repeats per creator and topic.

:::deeper[Correcting for how training data was collected]
Logged data only contains reactions to videos the old model chose to show, so a naive model learns to imitate the old model. **Inverse propensity weighting** corrects for this: if the logging policy showed an item with probability *p*, weight that example by 1/*p*, so rarely shown items count for more. Exploration slots make *p* known and non-zero for a broad set of items, which is why they're logged with their selection probability. Large weights increase variance, so they're usually capped (clipped). The same idea lets you estimate a new policy's performance from old logs (off-policy evaluation) before running an A/B test.
:::

## ML/LLM design

- **Data sources:** impression and interaction logs (joined by `request_id`), video metadata and content embeddings, user settings, and explicit feedback such as dismissals and surveys.
- **Labels:** play (clicked), watch time (capped and normalized by video length), like, dismiss. Labels arrive late (a watch completes minutes later), so training joins logs with a delay window.
- **Features:** user, video, context and user–video cross features as above; recent-activity features are computed from the stream within minutes, while slower features are batch-computed daily. Both are served from the feature store to avoid :term[training–serving skew]{id="training-serving-skew"}.
- **Models:** two-tower retrieval (retrained weekly, video embeddings refreshed hourly); multi-task deep ranking model (retrained daily on the last few weeks of data, warm-started from the previous version). Baseline: popularity by region and recent topic affinity.
- **Training:** daily pipeline with data validation (row counts, feature distributions), training, offline evaluation against the current model, and registration. Time-based splits only.
- **Serving:** user tower on CPU, ANN index replicated for throughput, ranking on GPU with dynamic batching; total model latency budget ~80 ms; fallback to cached popular lists on timeout.
- **Offline metrics:** retrieval recall@500; ranking AUC and log loss per head, and NDCG@20 of watch time on held-out sessions.
- **Online metrics:** watch time per viewer per day and 7-day retention (primary); click-through rate, dismiss rate, diversity of creators watched, and latency (guardrails). Launch decisions use :term[A/B tests]{id="ab-test"} of at least a week, because short tests overrate novelty.

## Trade-offs

| Decision | Alternative | Why this choice |
| --- | --- | --- |
| Two-stage retrieval then ranking | One model scoring everything | Scoring 10M videos per request is impossible within budget |
| Multi-task ranking with a blended score | Optimize click-through rate | Clicks alone reward clickbait; watch time and dismissals reflect satisfaction |
| Content-based video tower | Id-only embeddings | New videos can be retrieved before they have any watches |
| GPU ranking | CPU ranking | Throughput per dollar for a deep model at 8.7M candidates per second |
| Small exploration share | Pure exploitation | Prevents feedback loops; costs a little short-term watch time |

## Failure modes, scaling and monitoring

- **Model or feature service timeout:** return a cached popularity list for the region; log the fallback rate.
- **Bad model deployed:** offline checks catch most; gradual rollout with automatic rollback on guardrail drops (watch time, errors, latency) catches the rest.
- **Index drift:** a video tower retrained without re-embedding the catalog puts users and videos in different spaces. Deploy towers and index as one versioned unit.
- **Data pipeline breaks:** a missing feature silently becomes zero. Monitor feature null rates and distributions, and block training on validation failures.
- **Viral or breaking content:** popularity features over the last hour let ranking react; a "trending" retriever adds fresh candidates.

**Monitor:** request latency per stage, fallback rate, recall of the ANN index versus exact search (sampled), feature freshness and null rates, prediction distributions per model version, online metrics by country and device. SLOs: 99.9% of requests return recommendations within 200 ms; fallback rate under 0.5%.

## Real-world references

- Covington, Adams and Sargin, *Deep Neural Networks for YouTube Recommendations* (RecSys 2016): two-stage candidate generation and ranking, and predicting watch time rather than clicks.
- Yi et al., *Sampling-Bias-Corrected Neural Modeling for Large Corpus Item Recommendations* (RecSys 2019): two-tower retrieval with in-batch negatives and popularity correction.
- Malkov and Yashunin, *Efficient and Robust Approximate Nearest Neighbor Search Using Hierarchical Navigable Small World Graphs* (arXiv 2016; IEEE TPAMI 2018): the HNSW index used by many vector search systems.

## 45-minute interview version

1. **Frame (5 min):** goal is long-term satisfaction and watch time; task is ranking videos per viewer; 100M viewers, 10M videos, 200 ms.
2. **Metrics (4 min):** online watch time and retention; guardrails for dismissals, diversity and latency; offline recall@500, AUC and NDCG.
3. **Data and features (6 min):** impressions joined to watches by request id; delayed labels; user, video, context and cross features; feature store.
4. **Design (8 min):** retrievers, filters, ranking, re-ranking; training loop and registry.
5. **Deep dives (14 min):** two-tower training and freshness; multi-task ranking and the blended score; feedback loops, exploration and position bias.
6. **Estimates and serving (5 min):** 8.7M candidates per second, ~64 GPUs, ~$0.006 per 1,000 requests; fallbacks.
7. **Launch and monitoring (3 min):** A/B test for a week or more, gradual rollout, drift and feature monitoring.

:::interview
Lead with the objective and metrics before any model: "clicks are the wrong target" is the first signal interviewers listen for. Explain why the funnel exists with numbers, not just that it exists. Strong candidates also bring up feedback loops and position bias unprompted, and know how to launch safely.
:::

## Practice

::quiz{id="video-recommendations-quiz"}

::drill{id="video-recommendations-estimation"}
