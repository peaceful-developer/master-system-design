---
slug: semantic-cache
title: Semantic and prompt cache
track: C
order: 47
difficulty: intermediate
summary: Cut LLM cost and latency for 500 cacheable requests per second by layering exact-match, meaning-based and prompt-prefix caches, while keeping wrong cache hits under 0.5%.
concepts: [semantic-cache, embedding, approximate-nearest-neighbor, similarity-threshold, reranking, prefix-caching, cache-hit-rate, cache-invalidation, ttl, offline-evaluation, llm-as-judge]
prerequisites: [llm-gateway, llm-inference-serving]
estimatedMinutes: 4
status: outline
exercises: []
diagram: semantic-cache-hld
---

## Problem statement

Design the caching layer inside a company's LLM gateway. Support bots, help-center search and internal assistants ask the same questions again and again in slightly different words. The cache should answer those repeats without a model call, and make the remaining calls cheaper by reusing work on shared prompt prefixes.

Caching by meaning is risky. "How do I cancel my order?" and "How do I cancel my subscription?" are close in embedding space but need different answers, and a wrong hit is served with full confidence. Answers can also depend on who is asking, on documents that change, and on the prompt version, so the cache key is more than the question.

Questions to ask:

- What traffic is it: repetitive FAQ-style questions or open-ended chat?
- Do answers depend on the user's data, permissions, locale or the current time?
- Which is worse for each app: a miss (cost and latency) or a wrong hit?
- How quickly must cached answers reflect changes in source documents or prompts?
- Do our providers and engines support prefix caching?

## Requirements

**Functional**

- Exact-match cache for identical requests: same model, parameters, prompt version and normalized prompt.
- Semantic lookup that returns a stored answer for a close enough earlier question within the same scope: app, tenant, permission group and locale.
- Per-app opt-in, thresholds and TTLs; invalidation by app, by source document or by prompt version.
- Prompt layouts that maximize prefix-cache hits at the model provider.
- Dashboards of hits, savings and sampled hits for review.

**Non-functional**

- **Scale:** 2,000 LLM requests per second at peak behind the gateway, about 500 from apps that opt in; 50 million cached entries, about 300 GB with vectors.
- **Latency:** a lookup adds under 20 ms at p99; a hit returns in under 100 ms, against 2 to 10 seconds for a model call.
- **Correctness:** under 0.5% of hits judged wrong in weekly audits; zero hits across tenants.
- **Savings:** a 30% hit rate on FAQ-style apps; with prefix caching, at least 20% lower model spend overall.

## Key concepts

- :term[Semantic cache]{id="semantic-cache"}: "forgot my password" and "how do I reset my password?" share one stored answer, which pays off because much of support traffic repeats a few hundred questions.
- :term[Embeddings]{id="embedding"}: a small embedding model turns the normalized question, not the whole prompt, into a vector in about 5 ms, and must be tested on near-miss pairs from real traffic.
- :term[Approximate nearest neighbor search]{id="approximate-nearest-neighbor"}: finds the closest cached question among millions in a few milliseconds, searching only the request's scope partition.
- :term[Similarity threshold]{id="similarity-threshold"}: the main knob, tuned per app, where a lower value raises the hit rate and the wrong-hit rate together.
- :term[Reranking]{id="reranking"}: for borderline scores, a cross-encoder reads both questions together and decides whether they really ask the same thing.
- :term[Prompt (prefix) caching]{id="prefix-caching"}: even when the answer can't be reused, a stable system prompt and shared documents at the start of the prompt let the provider reuse its KV cache, cutting cost and time to first token.
- :term[Cache hit rate]{id="cache-hit-rate"}: savings grow with the hit rate, so it is reported per app next to the wrong-hit rate, never alone.
- :term[Cache invalidation]{id="cache-invalidation"} with :term[TTLs]{id="ttl"}: each entry carries tags for its source documents and prompt version, so a change purges exactly the answers built on it.
- :term[Offline evaluation]{id="offline-evaluation"}: replaying logged question pairs, labeled same or different by an :term[LLM judge]{id="llm-as-judge"} and checked by humans, sets each app's thresholds before launch.

## High-level design

::diagram{id="semantic-cache-hld"}

1. An app calls the gateway with its prompt, the cache scope and a cacheable flag. Requests that use personal data or tools, or want creative variety, skip the cache.
2. **Exact match:** a hash of model, parameters, prompt version and normalized prompt is looked up in an in-memory store; a hit returns in about 5 ms.
3. **Semantic match:** the semantic cache embeds the question and searches its scope. Above an upper threshold (for example 0.95) it's a hit; between that and a lower threshold (for example 0.88) the match checker decides; below, it's a miss.
4. **Miss:** the gateway calls the model with a prompt laid out stable-first, so the provider's prefix cache is reused. The answer streams back and is stored with its TTL and tags.
5. **Upkeep:** the invalidator purges entries by tag when documents or prompts change. An audit job samples hits for LLM-judge and human review, tracks the wrong-hit rate per app, and retunes thresholds.

The full version of this case study will cover what to embed and how to scope cache keys, threshold tuning with labeled pairs, storage and eviction for 50 million entries, the economics of provider prompt caching, and when not to cache at all.
