---
slug: llm-personalization
title: LLM-powered personalization
track: C
order: 46
difficulty: intermediate
summary: Personalize a shopping home page for 50 million daily users in under 200 ms by running LLMs in batch for profiles, item understanding and copy, and keeping a classic ranker online.
concepts: [candidate-generation, ranking-model, embedding, cold-start, batch-inference, feature-store, hallucination, offline-evaluation, ab-test]
prerequisites: [video-recommendations]
estimatedMinutes: 4
status: outline
exercises: []
diagram: llm-personalization-hld
---

## Problem statement

Design LLM-powered personalization for the home page of a large shopping app. LLMs help in three places: understanding shoppers from their history and their own words, understanding products from their listings and reviews, and writing personal copy such as a row titled "For your trail-running trip" with a one-line reason under each item.

An LLM call per page view doesn't work: scoring 1,000 candidates with an LLM takes seconds, and 250 million page views a day would cost far too much. The real question is where the LLM runs: mostly in batch, producing features, profiles and copy that the fast online path only looks up. Generated text must also be true to the product, and profiles must not record sensitive inferences.

Questions to ask:

- What should the LLM add: better understanding of users and items, generated copy, conversational refinement, or all three?
- How fresh must the page be? Should a purchase five minutes ago change it?
- Which user data may be used, and which inferences (health, finances) are off-limits?
- How is success measured: clicks, purchases, or long-term retention?

## Requirements

**Functional**

- A personalized home page of ranked rows; each row has a generated title and each top item a short reason based on real product facts.
- A readable "your interests" profile that shoppers can edit or turn off.
- New shoppers get relevant rows after one onboarding answer ("What are you shopping for?") or a few clicks.
- New products can be recommended within an hour of being listed.

**Non-functional**

- **Scale:** 50 million daily users and 20 million products; 5 home-page loads per user per day, about 3,000 per second on average and 10,000 at peak.
- **Latency:** home page in under 200 ms at p99, with no LLM call on the request path.
- **Freshness:** a profile updates within 15 minutes of a meaningful session, such as a purchase or a burst of searches.
- **Cost:** under $10,000 a day of LLM inference, which rules out per-request generation.
- **Trust:** no sensitive categories in profiles; zero generated claims that contradict product data in weekly audits.

## Key concepts

- :term[Candidate generation]{id="candidate-generation"}: two-tower retrieval still narrows 20 million products to about 1,000 in milliseconds; LLMs improve its inputs rather than replace it.
- :term[Embeddings]{id="embedding"}: text embeddings of product listings and written profiles place new products and new users in the same space as well-known ones.
- :term[Cold start]{id="cold-start"}: a product with no clicks gets attributes and an embedding from its listing on day one, and a new shopper's onboarding answer becomes a usable profile.
- :term[Batch inference]{id="batch-inference"}: profiles, product attributes and row copy are generated offline at batch prices and stored, so the request path only does lookups.
- :term[Feature store]{id="feature-store"}: LLM-derived interest tags and profile embeddings sit next to click counts and are served with the same values in training and production.
- :term[Ranking model]{id="ranking-model"}: a conventional model scores the 1,000 candidates with behavioral and LLM-derived features in about 30 ms, which an LLM cannot do.
- :term[Hallucination]{id="hallucination"}: a reason such as "waterproof, good for your hikes" must come from the product's fact sheet, so generation is grounded in that sheet and checked against it.
- :term[Offline evaluation]{id="offline-evaluation"}: replaying logged sessions measures whether LLM features raise retrieval recall and ranking quality before any user sees them.
- :term[A/B tests]{id="ab-test"}: each LLM component is tested separately against the plain recommender, because catchy copy can lift clicks while lowering purchases.

## High-level design

::diagram{id="llm-personalization-hld"}

1. **Item understanding (batch):** LLM batch jobs read each product's listing and reviews, extract structured attributes, and write a text embedding to the item index. New listings are processed within an hour.
2. **User profiles (nearline):** the event stream triggers a refresh after meaningful sessions. A small LLM summarizes recent activity into a short, readable profile with interest tags, dropping sensitive categories, and the profile and its embedding go to the feature store.
3. **Serving:** the home service reads the profile, retrieves about 1,000 candidates from the item index with the user embedding plus behavioral retrievers, and the ranking model scores them within the 200 ms budget.
4. **Copy:** row titles and reasons come from the copy cache, generated in batch per interest tag and product, and kept only if a fact checker confirms every claim. On a miss, a template such as "Because you viewed …" is used.
5. **Learning:** impressions, clicks and purchases flow back through the event stream to retrain the ranker; each LLM component ships only after offline replay and an A/B test.

The full version of this case study will cover the cost of batch versus online generation, profile design and privacy, grounding generated copy in product facts, evaluating LLM-derived features, and conversational refinement of recommendations.
