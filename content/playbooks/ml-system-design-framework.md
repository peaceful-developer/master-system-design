---
slug: ml-system-design-framework
title: The ML system design framework
order: 3
summary: A step-by-step plan for designing ML-powered products and for ML design interviews, from framing the problem and choosing metrics to serving, launch and monitoring.
estimatedMinutes: 18
concepts: [offline-evaluation, ab-test, feature-store, training-serving-skew, data-drift, candidate-generation, ranking-model, cold-start, embedding]
exercises: [ml-framework-quiz]
---

"Design a video recommendation system." "Design a fraud detector." ML design problems look like regular system design, but most of the risk lives somewhere else: in framing the problem, choosing the right metric, getting trustworthy labels, and keeping the model healthy after launch. The model architecture is often the least important decision. This framework keeps you from spending 30 minutes on neural network layers and 30 seconds on everything that actually decides success.

:::primer
An **ML system** learns patterns from past data and uses them to make predictions about new cases: which video you'll watch, whether a payment is fraud, which answer is most helpful.

Around the model sits a lot of ordinary engineering: pipelines that collect data, a service that answers predictions quickly, and monitoring that notices when predictions get worse.
:::

## The plan at a glance

| Step | Question it answers | Time (45 min) |
| --- | --- | --- |
| 1. Frame the problem | What business goal, and what exactly do we predict? | 5 min |
| 2. Metrics | How do we know it works, offline and online? | 5 min |
| 3. Data and labels | What do we learn from, and how trustworthy is it? | 5 min |
| 4. Features | What signals describe users, items and context? | 5 min |
| 5. Model | Baseline first, then what, and in how many stages? | 7 min |
| 6. Training and serving | How is it built, deployed and kept fast? | 8 min |
| 7. Evaluation and launch | How do we prove it before everyone sees it? | 5 min |
| 8. Monitoring and iteration | How do we notice and fix decay? | 5 min |

## Step 1: Frame the problem

Start from the **business goal**, then translate it into a prediction task.

- Goal: "people find videos they enjoy, so they come back."
- Task: "for a user and a candidate video, predict the probability they'll watch more than half of it," then **rank** candidates by that score.

Decide the task type: classification (fraud or not), regression (delivery time), or ranking (which items, in what order). Say what the input and output are, and when predictions are needed: on every request (online), or once a day for everyone (batch).

Ask whether ML is needed at all. A sensible rule ("most popular in your region") is the baseline every model must beat.

## Step 2: Choose the metrics

Pick metrics at three levels and say how they connect:

- **Business or online metrics** measure what you actually care about: watch time, retention, revenue, fraud losses. Only an experiment with real users measures these.
- **:term[Offline metrics]{id="offline-evaluation"}** are computed on historical data before launch: precision and recall, AUC, log loss for classifiers; precision@k, recall@k or NDCG for rankings.
- **Guardrail metrics** must not get worse: latency, error rate, diversity, complaints, fairness across groups.

:::warning[Accuracy can lie]
If 0.1% of payments are fraud, a model that always says "not fraud" is 99.9% accurate and useless. For rare events, use precision and recall (or the area under the precision–recall curve), and choose the decision threshold from the cost of each kind of mistake.
:::

## Step 3: Data and labels

Where do training examples come from, and what is the **label**?

- **Explicit labels:** ratings, "report spam" clicks, chargebacks. Clear, but rare, and some arrive weeks later.
- **Implicit labels:** clicks, watch time, purchases. Plentiful but noisy: a click isn't always satisfaction.

Then the traps:

- **Leakage:** a feature that wouldn't be known at prediction time (for example, "was refunded" when predicting fraud at checkout). Split train and test **by time**, not randomly, so the test set looks like the future.
- **Bias from the current system:** users can only click what you showed them, so logged data reflects the old model's choices.
- **Imbalance:** rare positives may need down-sampling of negatives, with weights to correct the probabilities.

## Step 4: Features

Group features to cover the ground quickly:

- **User:** history, preferences, :term[embeddings]{id="embedding"} learned from past behaviour.
- **Item:** category, age, popularity, content embeddings.
- **Context:** time, device, location, what's on screen now.
- **Interactions:** has this user engaged with this creator before?

Note which features need to be **fresh** (computed from the last few minutes of activity, via streaming) and which can be batch-computed daily. A :term[feature store]{id="feature-store"} serves the same feature values to training and to serving, which prevents :term[training–serving skew]{id="training-serving-skew"}.

## Step 5: Model

1. **Baseline:** popularity, a heuristic, or logistic regression. It sets the bar and gives a fallback.
2. **Stronger model:** gradient-boosted trees for tabular data; neural networks when you have embeddings, text or images.
3. **Stages for large catalogs:** you can't score millions of items per request with a heavy model. Use **:term[candidate generation]{id="candidate-generation"}** (cheap, such as a two-tower retrieval model, to find a few hundred items), then a **:term[ranking model]{id="ranking-model"}** (rich features, scores those few hundred), then **re-ranking** for business rules, freshness and diversity.

Mention the :term[cold-start]{id="cold-start"} problem and how you'd handle it: content features and popularity for new items, onboarding questions or context for new users.

## Step 6: Training and serving

**Training pipeline:** scheduled retraining (daily or weekly), data validation checks before training, versioned models in a registry, and reproducible runs.

**Serving:**

- **Online inference** when predictions depend on the request: a model server behind the app, with a latency budget (say 50 ms for ranking), caching of item embeddings and features, and a fallback (the baseline) if the model times out.
- **Batch inference** when predictions can be precomputed: score everyone nightly and store results for fast lookup.

State the scale: requests per second and candidates scored per request determine how many CPU or GPU servers you need.

## Step 7: Evaluation and launch

1. **Offline evaluation** on a time-based held-out set: beat the baseline on the offline metric.
2. **Shadow mode:** run the new model on live traffic without showing its results, to check latency, errors and prediction distributions.
3. **:term[A/B test]{id="ab-test"}:** show it to a random slice of users and compare the online metric and guardrails against control. Decide sample size and duration up front.
4. **Gradual rollout:** 1%, 10%, 50%, 100%, with a fast rollback.

## Step 8: Monitoring and iteration

Models decay quietly. Monitor:

- **Inputs:** :term[data drift]{id="data-drift"} in feature distributions, missing or broken features.
- **Outputs:** prediction distribution shifts, score calibration.
- **Outcomes:** the online metric over time and across user segments, once labels arrive.
- **System health:** latency, error rate, fallback rate.

Watch for **feedback loops**: a recommender trained on what it showed learns its own preferences, so add some exploration (for example, a small share of diverse or new items).

:::deeper[Why two stages beat one big model]
Suppose a ranking model takes 20 microseconds of compute per item. Scoring a 10-million-item catalog for one request costs 200 seconds of compute: impossible at any meaningful traffic. A two-tower retrieval model instead precomputes item embeddings, and an approximate nearest neighbor index finds the top 500 for a user embedding in a few milliseconds. The heavy ranking model then scores only those 500 items: 500 × 20 µs = 10 ms, which fits easily in a latency budget, even with rich cross features that the retrieval model can't use. The general pattern is a funnel: each stage is more expensive per item and sees fewer items.
:::

:::interview
Spend the first ten minutes on framing, metrics and labels before touching models; interviewers often decide at that point. When you reach the model, say "baseline first," then justify each added piece of complexity with a metric it should move. Close with launch and monitoring: many candidates forget them, and they're what keeps a model useful after launch.
:::

## Checklist

- [ ] Business goal stated and translated into a prediction task
- [ ] Online, offline and guardrail metrics chosen, and linked
- [ ] Label source named, with delay, noise and leakage addressed
- [ ] Features grouped (user, item, context, interaction), with freshness noted
- [ ] Baseline first; stages justified for large catalogs
- [ ] Training cadence, serving mode and latency budget stated
- [ ] Offline evaluation, shadow, A/B test and gradual rollout planned
- [ ] Monitoring for drift, skew, outcomes and feedback loops

## Common mistakes

- **Starting with the model architecture** instead of the problem, metric and data.
- **Optimizing a proxy blindly:** clicks are easy to raise with clickbait while satisfaction falls.
- **Random train/test splits** on time-dependent data, which leaks the future.
- **Ignoring latency and cost** until the end; they often rule models out.
- **No fallback** when the model or feature service fails.
- **Launch and forget:** without monitoring, quality decays for months before anyone notices.

::quiz{id="ml-framework-quiz"}
