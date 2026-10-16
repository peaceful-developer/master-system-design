---
slug: enterprise-rag
title: Enterprise RAG Q&A
track: C
order: 33
difficulty: intermediate
summary: Answer employees' questions from 50,000 internal documents with cited, permission-aware answers, using hybrid retrieval, reranking and an LLM, at about a cent per question.
concepts: [rag, chunking, embedding, vector-database, hybrid-search, reranking, hallucination, context-window, token]
prerequisites: []
estimatedMinutes: 17
status: complete
exercises: [enterprise-rag-quiz, enterprise-rag-estimation]
diagram: enterprise-rag-hld
---

## Problem statement

A company with 20,000 employees has 50,000 internal documents: policies, runbooks, product specifications, meeting notes. People waste hours searching for answers that exist somewhere. Design an assistant that answers questions in plain language, **cites its sources**, and never reveals a document to someone who isn't allowed to read it.

A general-purpose LLM can't do this alone: it has never seen these documents, and asked anyway, it will :term[hallucinate]{id="hallucination"} plausible answers. :term[Retrieval-augmented generation]{id="rag"} fixes that by finding the relevant passages first and asking the model to answer only from them.

:::primer
RAG has two halves:

- **Ingestion (offline):** split documents into passages, turn each into an embedding, and index them.
- **Answering (online):** find the passages most relevant to the question, put them in the prompt, and let the model write an answer that cites them.

The [RAG pipeline example](/examples/rag-pipeline) shows the basic pattern; this case study adds permissions, evaluation, cost and operations.
:::

Questions to ask:

- What sources (wiki, shared drives, ticketing, chat)? How often do they change?
- Who may see what? Are permissions per document, per folder, per group?
- What does a good answer look like: short, cited, with a link to the source?
- Is a hosted LLM API acceptable for confidential data, or must models run in our own cloud?
- What latency is acceptable? (A first word within about 2 seconds, streamed.)

## Requirements

**Functional**

- Ask a question (with follow-ups in a conversation) and get a streamed answer with citations linking to the source passages.
- Answer only from documents the asking employee may read.
- Say "I couldn't find this in the documents" rather than guess.
- Reflect document changes within an hour; remove deleted documents within minutes.
- Collect thumbs up and down feedback on answers.

**Non-functional**

- **Scale:** 20,000 employees, about 10 questions each per working day.
- **Latency:** first token within 2 seconds at p95; full answer within 10 seconds.
- **Security:** no cross-permission leaks, ever; data stays in the company's cloud account (or under a no-retention agreement).
- **Quality:** at least 90% of answers judged correct and grounded on a curated test set; citations point to passages that support the claim.

## Back-of-envelope estimates

Each input is an assumption to confirm. Token prices are illustrative; check current pricing.

| Quantity | Calculation | Result |
| --- | --- | --- |
| Questions | 20,000 × 10 = 200,000 per working day | ~7 per second over 8 hours, ~20 at peak |
| Corpus | 50,000 documents × 2,000 tokens | 100M tokens |
| Chunks | 100M tokens ÷ 350 new tokens per chunk (400 with 50 overlap) | ~290,000 chunks |
| Vector index | 290,000 × 1,024 dimensions × 4 bytes | ~1.2 GB |
| Prompt size | 5 passages × 400 tokens + 500 for instructions and history | ~2,500 input tokens |
| Answer size | assumption | ~300 output tokens |
| Peak token rate | 20 per second × 2,500 in, and × 300 out | ~50,000 input and ~6,000 output tokens per second |
| Cost per question (hosted API) | 2,500 × $3 per 1M in + 300 × $15 per 1M out | ~$0.012, so ~$12 per 1,000 questions |
| Daily cost | 200,000 × $0.012 | ~$2,400 per working day |

**Self-hosting check:** if one GPU running a mid-size open model sustains about 2,000 output tokens per second with batching (an assumption to benchmark), 6,000 output tokens per second at peak needs 3 GPUs, about 6 with headroom for prefill and failover. At $2 per GPU-hour that's $12 per hour, about $0.17 per 1,000 questions at peak utilization and roughly $0.50 averaged over a working day. It's cheaper at this volume, but you take on model quality, operations and capacity planning.

**What the numbers say:** retrieval infrastructure is tiny (one vector index node, replicated); the cost and latency live in the LLM call. Prompt size drives cost, so retrieving 5 good passages beats stuffing 30 mediocre ones into the :term[context window]{id="context-window"}.

## API design and data model

```http
POST /v1/ask
{ "conversation_id": "c_12", "question": "How many days of parental leave do contractors get?" }

200 OK  (text/event-stream)
data: {"type":"token","text":"Contractors "}
…
data: {"type":"citations","items":[{"doc_id":"hr-policy-7","title":"Leave policy","section":"4.2","url":"…"}]}
```

```http
POST /v1/feedback   { "answer_id": "a_88", "rating": "down", "comment": "Outdated policy" }
```

**Data:**

- **Chunks:** `chunk_id`, `doc_id`, `text`, `embedding`, `title_path` (document and section headings), `acl_groups` (who may read it), `updated_at`. Stored in both the vector index and a keyword index.
- **Documents:** `doc_id`, source, URL, owner, `acl_groups`, `content_hash` (to skip unchanged documents), `deleted_at`.
- **Answers:** question, retrieved chunk ids, prompt version, model version, answer, latency, feedback; this is the data that drives evaluation and debugging.

## High-level design

::diagram{id="enterprise-rag-hld"}

**Ingestion:** connectors watch each source for changes. For a changed document, the ingestion workers fetch it, extract text with its structure, split it into :term[chunks]{id="chunking"} along headings and paragraphs, compute :term[embeddings]{id="embedding"}, and upsert the chunks, with their permission groups, into both the :term[vector database]{id="vector-database"} and the keyword index. Deleted documents have their chunks removed immediately.

**Answering:**

1. Guardrails check the question (prompt injection attempts, secrets pasted by mistake).
2. The Q&A service rewrites a follow-up question into a standalone one using the conversation ("And contractors?" becomes "How much parental leave do contractors get?").
3. **Hybrid retrieval:** a vector search and a keyword search run in parallel, **both filtered to the user's permission groups**, returning 20 results each.
4. A :term[reranker]{id="reranking"} scores the ~40 merged candidates against the question and keeps the best 5.
5. The prompt contains instructions, the 5 passages with their titles and ids, and the question; the LLM streams an answer with citation markers.
6. Output guardrails check that citations refer to retrieved passages and scan for sensitive data before the final chunk is sent.

## Deep dives

### Chunking and ingestion

Retrieval quality is decided at ingestion. Rules that work well:

- **Chunk along structure:** split at headings and paragraphs, aiming for 300–500 tokens, with a small overlap. Never split a table row from its header.
- **Carry context:** prefix each chunk with its document title and section path ("Leave policy › Contractors › Parental leave"). The chunk then makes sense on its own, for both the embedding and the reader of the citation.
- **Incremental updates:** hash documents and re-embed only those that changed. With 2% of documents changing per day, that's about 6,000 chunks per day, trivial work.
- **Deletes first:** removals and permission changes are processed before new content, because a leak is worse than a stale answer.

### Hybrid retrieval and reranking

::figure{id="rag-pipeline" caption="Question embedding, retrieval, reranking and generation, with ingestion keeping the index current."}

Vector search finds passages that mean the same thing in different words ("time off for new parents"). Keyword search (BM25) finds exact terms the embedding may blur: product codes, error messages, policy numbers. :term[Hybrid search]{id="hybrid-search"} runs both and merges the lists.

The merged ~40 candidates then go through a **cross-encoder reranker**, which reads the question and each passage together. It's far more accurate than comparing embeddings, but too slow to run over the whole corpus, hence the two stages. Keeping only the top 5 keeps prompts short, cheap and focused.

:::deeper[Merging result lists with reciprocal rank fusion]
Vector scores and keyword scores aren't on comparable scales, so you can't simply add them. **Reciprocal rank fusion** ignores the scores and uses only positions: each document gets Σ 1 / (k + rank) over the lists it appears in, with k = 60 as a common default. A document ranked 1st by keywords and 4th by vectors scores 1/61 + 1/64 ≈ 0.032, beating one that is 2nd in only one list (1/62 ≈ 0.016). It needs no tuning, is robust to score scale, and is a strong baseline before trying learned fusion.
:::

### Permissions

The one unacceptable failure is showing a passage to someone who can't read its document. So:

- Permission groups are stored **on every chunk** and enforced **inside the retrieval query** as a filter, so unauthorized chunks are never retrieved, never reranked, and never reach the prompt.
- Never rely on the model to "not mention" something; anything in the prompt can appear in the answer.
- Group membership is resolved per request from the identity provider (cached for a few minutes), and permission changes on documents are re-indexed with priority.

### Grounded answers

- The prompt instructs the model to answer only from the passages, cite each claim with a passage id, and say it doesn't know when the passages don't cover the question.
- A post-check verifies each citation refers to a retrieved passage; answers without valid citations are flagged or replaced with the "couldn't find" response.
- Showing citations in the UI lets people verify quickly and builds the right level of trust.

## ML/LLM design

- **Data sources:** documents and their structure from connectors; permission groups from the identity provider; question logs, retrieved chunk ids and user feedback for evaluation.
- **Models:** an embedding model for chunks and questions (a strong general-purpose model; fine-tune only if evaluation shows domain terms are missed); BM25 for keywords; a cross-encoder reranker; an LLM for generation, chosen on the quality/latency/cost trade-off for this task. A smaller, cheaper model often suffices because retrieval supplies the knowledge.
- **Training:** none required to start. Later options: fine-tune the embedding model or reranker on logged question–passage pairs with positive feedback.
- **Serving:** streaming generation; caching of embeddings for repeated questions; timeouts with a fallback to "here are the most relevant documents" if the LLM is slow.
- **Offline metrics:** on a curated set of ~300 questions with known source passages: retrieval recall@5 and @20; answer correctness and faithfulness (every claim supported by a cited passage), graded by humans and by an LLM judge calibrated against them; citation precision; refusal rate on unanswerable questions.
- **Online metrics:** thumbs-up rate, citation click-through, share of "couldn't find" answers, repeat questions (a sign of failure), and support tickets deflected; latency (time to first token) and cost per question as guardrails.
- **Evaluation gate:** every change to chunking, models or prompts reruns the offline set before release.

## Trade-offs

| Decision | Alternative | Why this choice |
| --- | --- | --- |
| RAG | Fine-tune an LLM on the documents | Fresh within an hour, cites sources, respects permissions; fine-tuning does none of these |
| Hybrid retrieval | Vector search only | Exact identifiers and codes are common in company documents |
| Rerank 40, keep 5 | Put 20 passages in the prompt | Better precision, shorter prompts, lower cost and latency |
| Permission filter in retrieval | Filter after generation | Data the model sees can leak; filter before it's retrieved |
| Hosted LLM API to start | Self-hosted model | Fastest to launch; revisit self-hosting as volume grows |

## Failure modes, scaling and monitoring

- **Stale or missing content:** a connector silently stops syncing. Monitor freshness per source (age of newest indexed change) and alert.
- **Retrieval misses:** questions with no good passages produce weak answers. Track "couldn't find" rate and low reranker scores; review them weekly to find gaps in documentation or chunking.
- **Prompt injection in documents:** a document containing "ignore previous instructions" ends up in a prompt. Treat retrieved text as data in the prompt structure, keep tool access minimal, and check outputs.
- **LLM provider outage or slowness:** time out, fall back to returning the top documents, and optionally fail over to a second model.
- **Cost growth:** watch tokens per question; long conversations grow prompts. Summarize history beyond a few turns.

**Monitor:** time to first token and total latency, tokens and cost per question, retrieval and reranker latency, feedback rates, refusal rate, freshness per source, and permission-filter errors (which should page someone). SLOs: 95% of questions start answering within 2 seconds; zero permission violations.

## Real-world references

- Lewis et al., *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks* (NeurIPS 2020): the paper that introduced RAG.
- Liu et al., *Lost in the Middle: How Language Models Use Long Contexts* (2023): models use information at the start and end of long prompts better than the middle, one reason to keep prompts short.
- Robertson and Zaragoza, *The Probabilistic Relevance Framework: BM25 and Beyond* (2009): the keyword ranking function used in hybrid search.
- Cormack, Clarke and Büttcher, *Reciprocal Rank Fusion Outperforms Condorcet and Individual Rank Learning Methods* (SIGIR 2009): the fusion method described above.

## 45-minute interview version

1. **Frame (5 min):** cited answers from 50,000 documents for 20,000 employees; permissions are absolute; "don't know" beats guessing.
2. **Estimates (5 min):** ~20 questions per second at peak; 2,500 input and 300 output tokens each; ~$12 per 1,000 questions on a hosted API; a small vector index.
3. **Design (8 min):** ingestion with connectors, chunking and dual indexes; answering with query rewrite, hybrid retrieval, rerank, generation and guardrails.
4. **Deep dives (15 min):** chunking and incremental ingestion; hybrid retrieval, fusion and reranking; permission filtering inside retrieval; grounding and citation checks.
5. **Evaluation (7 min):** curated test set, retrieval recall, faithfulness and citation precision, LLM judge calibrated by humans, online feedback.
6. **Operations (3 min):** freshness monitoring, provider fallback, cost per question.
7. **Wrap-up (2 min):** next steps such as fine-tuning the reranker on feedback or self-hosting at higher volume.

:::interview
Interviewers probe three things: permissions (filter in retrieval, never trust the model to keep secrets), evaluation (how you know answers are right, beyond "it looks good"), and cost (tokens per question times volume). Having concrete answers to all three, with numbers, puts you ahead of most candidates who only describe embeddings and a vector database.
:::

## Practice

::quiz{id="enterprise-rag-quiz"}

::drill{id="enterprise-rag-estimation"}
