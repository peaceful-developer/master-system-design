---
slug: rag-pipeline
title: Retrieval-augmented generation (RAG)
summary: Ground a language model's answers in your own documents by retrieving the most relevant passages and putting them in the prompt; how ingestion, retrieval, reranking and generation fit together.
concepts: [rag, chunking, embedding, vector-database, reranking, hallucination, context-window, token]
tags: [llm, retrieval, search]
diagram: rag-pipeline
---

## The problem

A company wants an assistant that answers employees' questions from 50,000 internal documents: policies, runbooks, product specs. A general language model has never seen these documents, and fine-tuning it on them is slow, costly, and still leaves it guessing about details. Asked anyway, it may :term[hallucinate]{id="hallucination"}: answer fluently and wrongly.

The documents also don't fit in one prompt. At roughly 2,000 :term[tokens]{id="token"} each, they total about 100 million tokens, while a model's :term[context window]{id="context-window"} holds tens or hundreds of thousands.

## The pattern

:term[Retrieval-augmented generation]{id="rag"} finds the few passages relevant to each question and gives only those to the model.

**Ingestion (offline, whenever documents change):**

1. Split each document into :term[chunks]{id="chunking"} of a few hundred tokens, with some overlap so sentences aren't cut off from their context.
2. Compute an :term[embedding]{id="embedding"} for each chunk.
3. Store the chunks, their embeddings and metadata (source, section, permissions) in a :term[vector database]{id="vector-database"}.

**Query (online, per question):**

1. Embed the question with the same embedding model.
2. Retrieve the ~20 nearest chunks, often combined with keyword search for exact terms like product codes.
3. :term[Rerank]{id="reranking"} those 20 with a more accurate model and keep the best 5.
4. Build the prompt: instructions, the 5 passages with their sources, and the question. Ask the model to answer only from the passages and cite them.

::diagram{id="rag-pipeline"}

::figure{id="rag-pipeline" caption="Ingestion keeps the index up to date; each question retrieves, reranks and then generates with the retrieved passages."}

## The numbers

50,000 documents × 2,000 tokens = 100 million tokens. With 400-token chunks overlapping by 50, that's roughly **290,000 chunks**. With 1,024-dimensional embeddings in 4-byte floats, each vector is 4 KB, so about **1.2 GB** of vectors: comfortably one vector database node. Each question sends about 5 × 400 = 2,000 tokens of passages plus instructions, a small, predictable prompt.

## When to use it

- Answers must come from a specific, changing body of knowledge: documentation, policies, product data, support tickets.
- You need **citations**, so people can check the source.
- Documents update often: re-embed changed chunks without retraining any model.
- Access control matters: filter retrieved chunks by the user's permissions before they reach the prompt.

## When not to use it

- **The task needs reasoning over everything at once**, such as "summarize trends across all 50,000 documents." Retrieval only surfaces a few passages; use batch processing or analytics instead.
- **The knowledge is small and stable:** if it fits in the prompt, just include it.
- **You need a new skill or style**, not new facts: that's a job for prompting or fine-tuning, not retrieval.

## Pitfalls and fixes

- **Bad chunking:** chunks that split tables or separate a heading from its content retrieve poorly. Chunk along document structure (sections, paragraphs) and keep titles with their text.
- **Retrieval misses:** pure vector search can miss exact identifiers. Use hybrid search (vectors plus keywords) and evaluate retrieval separately from generation.
- **Ungrounded answers:** instruct the model to say "I don't know" when the passages don't contain the answer, and check answers for citations.
- **Stale index:** re-ingest changed documents promptly and delete chunks from removed ones; answers are only as current as the index.
- **Permission leaks:** apply access filters in retrieval, never by asking the model to hide things.

## Related

- Example: [Two-tower retrieval](/examples/two-tower-retrieval) uses the same nearest-neighbor search to recommend items.
