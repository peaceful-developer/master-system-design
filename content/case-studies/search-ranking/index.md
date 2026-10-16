---
slug: search-ranking
title: Search ranking
track: B
order: 18
difficulty: intermediate
summary: Rank 100 million products for 15,000 searches per second in under 200 ms, with keyword and embedding retrieval feeding a two-stage learning-to-rank model trained on debiased clicks.
concepts: [inverted-index, hybrid-search, embedding, candidate-generation, ranking-model, learning-to-rank, position-bias, ndcg, feature-store, offline-evaluation, ab-test]
prerequisites: [video-recommendations]
estimatedMinutes: 3
status: outline
exercises: []
diagram: search-ranking-hld
---

## Problem statement

Design the ranking behind product search on a large online store in the style of Amazon or Etsy. A shopper types a query such as "waterproof hiking boots women", and the system returns the most useful products first, from a catalog of 100 million.

What makes it hard is that relevance has two sides. The products must match the query, including exact brand names and model numbers, and they must be the ones this shopper is likely to buy. The main training signal, clicks and purchases, is shaped by the old ranking: people click what they see at the top.

Questions to ask:

- What's the goal: purchases per search, revenue, or long-term satisfaction?
- How large is the catalog, and how quickly must new products and price or stock changes show up?
- How many searches per second, and what latency is acceptable?
- Do we personalize results, or rank the same for everyone?
- Are there sponsored results or business rules, such as hiding out-of-stock items?

## Requirements

**Functional**

- Return 48 ranked products per page for a text query, with filters (price, brand, size) and pagination.
- Handle misspellings, synonyms and queries that share no words with the product titles.
- Exclude products that are out of stock or not shippable to the shopper's region.
- New products and price or stock changes are searchable within 5 minutes.

**Non-functional**

- **Scale:** 500 million searches per day (about 5,800 per second on average, 15,000 at peak); 100 million products.
- **Latency:** 200 ms p99 end to end, with about 50 ms for retrieval and 80 ms for ranking.
- **Availability:** 99.95%; if the ranking model fails, return results ordered by the cheaper first-stage score.
- **Quality:** raise purchases per search without raising the share of searches with no click or no results.

## Key concepts

- :term[Inverted index]{id="inverted-index"}: maps each word to the products that contain it, so exact brands and model numbers are matched in milliseconds across 100 million products.
- :term[Hybrid search]{id="hybrid-search"} with :term[embeddings]{id="embedding"}: a vector index finds "trail running shoes" for the query "jogging sneakers for hills", and merging it with keyword results covers both exact and meaning-based matches.
- :term[Candidate generation]{id="candidate-generation"}: retrieval cuts 100 million products to about 2,000 per query, so ranking can afford rich features.
- :term[Ranking model]{id="ranking-model"} in two stages: gradient-boosted trees score 2,000 candidates with cheap features, then a neural ranker orders the top 200 using query–product cross features.
- :term[Learning to rank]{id="learning-to-rank"}: the models are trained on whole result lists per query with a ranking loss, because only the order matters, not the absolute score.
- :term[Position bias]{id="position-bias"}: a product in slot 1 gets several times the clicks of the same product in slot 10, so training weights each click by the inverse of the estimated chance that its slot was seen.
- :term[NDCG]{id="ndcg"}: the main offline metric, computed on held-out sessions with graded labels (purchase above add-to-cart above click) and on a set of queries rated by trained human judges.
- :term[Feature store]{id="feature-store"}: serves product features such as price, rating, stock and recent sales within minutes of a change, and the same values are logged for training.
- :term[Offline evaluation]{id="offline-evaluation"} and :term[A/B tests]{id="ab-test"}: a new ranker must beat the current one on NDCG before an A/B test measures purchases per search and the no-click rate.

## High-level design

::diagram{id="search-ranking-hld"}

1. The search API sends the query to the query parser, which corrects spelling, predicts the product category, extracts attributes such as brand and size, and computes a query embedding in under 15 ms.
2. Retrieval runs in parallel, with filters for stock and region: the text index returns its top 1,500 matches and the vector index the 500 nearest products by embedding. The API merges them into about 2,000 candidates.
3. The rankers read product, query and shopper features from the feature store. The first stage keeps 200 candidates, the second orders them, and business rules such as seller diversity shape the final 48.
4. Search logs record each impression with its position, plus clicks, add-to-carts and purchases. A daily job turns them into graded, position-weighted training lists, evaluates the new model on held-out days and the human-rated set, and registers it for gradual rollout behind an A/B test.

The full version of this case study will cover the estimates, estimating position bias with small randomized swaps, query understanding for rare queries, interleaving experiments, and keeping the indexes fresh within 5 minutes.
