---
slug: two-tower-retrieval
title: Two-tower retrieval for recommendations
summary: Find a few hundred good candidates out of millions in milliseconds by embedding users and items separately and searching an approximate nearest neighbor index, then let a ranking model order them.
concepts: [two-tower-model, embedding, approximate-nearest-neighbor, vector-database, candidate-generation, ranking-model, cold-start]
tags: [ml, recommendations, retrieval]
diagram: two-tower-retrieval
---

## The problem

A video app has 10 million videos. When someone opens the home screen, it should show the 20 they're most likely to enjoy, within about 200 ms. A good ranking model uses rich features about the user, the video and their interaction, and costs roughly 20 microseconds per video. Scoring all 10 million videos for one request would take **200 seconds** of compute. We need a way to find a few hundred promising videos first.

## The pattern

A :term[two-tower model]{id="two-tower-model"} learns two separate networks:

- The **user tower** turns a user's features (history, preferences, context) into an :term[embedding]{id="embedding"}: a vector of, say, 128 numbers.
- The **item tower** turns a video's features (topic, creator, text, popularity) into an embedding of the same size.

Training pushes the embeddings of users and the videos they engaged with close together (a high dot product), and pushes them away from videos they skipped.

The towers never need to see each other at serving time, which is the trick:

1. **Offline:** run the item tower over every video in batch and load the embeddings into an :term[approximate nearest neighbor]{id="approximate-nearest-neighbor"} index in a :term[vector database]{id="vector-database"}.
2. **Online, per request:** compute the user's embedding (one small model call, a few milliseconds).
3. Ask the index for the ~500 nearest item embeddings (a few milliseconds even across millions).
4. Send those 500 candidates to the :term[ranking model]{id="ranking-model"}: 500 × 20 µs = 10 ms.
5. Apply business rules (remove watched videos, ensure diversity) and return the top 20.

::diagram{id="two-tower-retrieval"}

::figure{id="two-tower-retrieval" caption="Users and items are embedded separately; nearest neighbors in the shared space become candidates for ranking."}

This retrieval stage is called :term[candidate generation]{id="candidate-generation"}. Large systems often run several retrievers side by side (two-tower, "more from creators you follow," trending in your region) and merge their candidates before ranking.

## When to use it

- Catalogs too large to score every item per request: thousands to billions of items.
- When you have plenty of interaction data (clicks, watches, purchases) to train on.
- When fresh items must become recommendable quickly: embed a new item with the item tower and add it to the index, with no retraining.

## When not to use it

- **Small catalogs** (a few thousand items): just score everything with the ranking model.
- **When the decision depends on user–item interaction features**, such as "has this user watched this creator before." Two towers can't use features that need both sides at once; that's the ranking model's job.
- **Little training data:** start with simpler retrieval (popularity, co-occurrence, "people who watched this also watched") and add two towers later.

## Pitfalls and fixes

- **:term[Cold start]{id="cold-start"}:** new users have no history. Lean on context (location, device, time) and onboarding choices; new items have no engagement, so the item tower must use content features, not only ids.
- **Popularity bias:** training on logged clicks favours already-popular items. Correct for how often items were shown, and mix in exploration.
- **Stale embeddings:** if the item tower is retrained, every item embedding must be recomputed and the index rebuilt together with the new user tower; mixing versions puts users and items in different spaces.
- **ANN recall:** approximate search misses some true neighbours. Measure recall against exact search offline and tune the index (more probes, larger graphs) until it's good enough.

## Related

- Playbook: [The ML system design framework](/playbooks/ml-system-design-framework) puts retrieval in the context of metrics, serving and launch.
