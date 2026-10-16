---
slug: ai-search-engine
title: AI search engine
track: C
order: 49
difficulty: advanced
summary: Answer 20 million web searches a day with cited answers that start streaming within 2 seconds, using query rewriting, hybrid retrieval over a web index, reranked passages and an LLM.
concepts: [query-rewriting, inverted-index, hybrid-search, chunking, reranking, rag, hallucination, time-to-first-token, prompt-injection, llm-as-judge, ab-test]
prerequisites: [web-crawler, enterprise-rag]
estimatedMinutes: 4
status: outline
exercises: []
diagram: ai-search-engine-hld
---

## Problem statement

Design an answer engine in the style of Perplexity or the AI answers on top of web search results. A user asks "Is the new Pixel's battery better than last year's?" and gets a short answer with numbered citations to the pages it came from, within a couple of seconds.

This is retrieval-augmented generation at web scale, and three things make it hard. The **latency budget** is tight: rewriting, searching billions of pages, reranking and prompt processing must fit in about 2 seconds. The **sources are adversarial**: SEO spam, outdated pages and hidden instructions aimed at the model. And **cost per query** must stay near a cent, because the volume is that of a search engine, not a chatbot.

Questions to ask:

- Do we run our own crawler and index, or buy results from a search API?
- How fresh must answers be: news within minutes, or is a daily index enough?
- Which queries deserve an LLM answer, and which are better served by plain links?
- What is the cost target per query?

## Requirements

**Functional**

- Ask a question and get a streamed answer with inline citations and a list of sources.
- Ask follow-up questions that use the conversation.
- Find news within minutes of publication.
- Show plain ranked links when no good answer can be written.

**Non-functional**

- **Scale:** 20 million queries per day, about 230 per second on average and 700 at peak; a keyword index of 5 billion pages and passage vectors for the 1 billion most useful ones.
- **Latency:** sources shown within 1 second and the first answer token within 2 seconds at p95.
- **Cost:** under $0.01 of model cost per query on average.
- **Quality:** at least 95% of cited sentences supported by the cited page in audits.
- **Availability:** 99.9%; if the LLM is unavailable, return ranked links.

## Key concepts

- :term[Query rewriting]{id="query-rewriting"}: turns a follow-up such as "what about charging speed?" into standalone search queries such as "Pixel 10 charging speed review", because the index can't see the conversation.
- :term[Inverted index]{id="inverted-index"}: maps each term to the pages that contain it, so keyword retrieval over 5 billion pages takes tens of milliseconds across hundreds of shards.
- :term[Hybrid search]{id="hybrid-search"}: product names, error messages and quotes need exact keyword matches, while plain-language questions need vector matches by meaning.
- :term[Chunking]{id="chunking"}: pages are split into passages when indexed, so the system retrieves the paragraph that answers, not a whole 5,000-word article.
- :term[Reranking]{id="reranking"}: a cross-encoder reads the question together with each of about 200 retrieved passages, which is far more accurate than retrieval scores, and keeps the best 10.
- :term[Retrieval-augmented generation]{id="rag"}: the LLM writes only from those 10 passages, about 5,000 tokens, and marks each claim with the id of its source.
- :term[Time to first token]{id="time-to-first-token"}: rewriting, retrieval, reranking and prompt processing share one 2-second budget, so stages run in parallel where possible and sources stream before the answer.
- :term[Hallucination]{id="hallucination"}: a fast check confirms each cited sentence is supported by its passage, and unsupported sentences are dropped.
- :term[Prompt injection]{id="prompt-injection"}: pages may hide instructions aimed at the model, so retrieved text is quoted as data, spam domains are demoted, and the answer model has no tools that act.
- :term[LLM as a judge]{id="llm-as-judge"} and :term[A/B tests]{id="ab-test"}: graded samples measure faithfulness offline, and citation clicks, ratings and reformulated queries measure each change online.

## High-level design

::diagram{id="ai-search-engine-hld"}

1. **Rewrite:** the answer service sends the question and recent turns to a small, fast LLM that writes 1 to 3 search queries and flags whether freshness matters. Navigational queries, such as a site's name, skip the LLM and return links.
2. **Retrieve:** keyword search over the inverted index and vector search over passage embeddings run in parallel, and a fresh tier is included when recency matters. The merged result is about 200 passages.
3. **Rerank:** the reranker scores each passage against the question, adds page quality and freshness, and keeps the best 10 from different sites. The source list streams to the user at once.
4. **Generate:** the answer LLM receives about 5,000 tokens of passages with ids and streams an answer with citation markers, while a citation check verifies each sentence as it streams.
5. **Index and learn:** the indexer turns newly crawled pages into passages, embeddings and index entries, with news in minutes. Logged queries, citation clicks, ratings and judge scores on sampled answers feed the eval suite and reranker training; changes ship behind A/B tests.

The full version of this case study will cover the latency budget stage by stage, cost per query and when to use a smaller model, freshness and the news tier, citation verification, and defenses against SEO spam and prompt injection.
