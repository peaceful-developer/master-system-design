---
slug: vector-search
title: Vector database and semantic search
track: C
order: 35
difficulty: advanced
summary: Search 1 billion embeddings at 20,000 queries per second with p99 under 50 ms and 95% recall, using sharded HNSW indexes over compressed vectors and fresh in-memory segments.
concepts: [embedding, approximate-nearest-neighbor, hnsw, product-quantization, recall-at-k, vector-database, sharding, replication, lsm-tree, hybrid-search]
prerequisites: [key-value-store, enterprise-rag]
estimatedMinutes: 4
status: outline
exercises: []
diagram: vector-search-hld
---

## Problem statement

Design a managed vector database in the style of Pinecone or Milvus: applications store embeddings of documents, products or images with some metadata, then ask for the items closest in meaning to a query, for RAG, recommendations and semantic search.

Exact search compares the query with every vector, which is far too slow at a billion items. Approximate indexes are fast but **memory-hungry**, **miss some true neighbors**, and are awkward to **update** and **filter**. The design is a set of trade-offs between recall, latency, memory cost and freshness.

Questions to ask:

- How many vectors, of how many dimensions, and how fast does the collection grow?
- Queries and writes per second, and how soon must a new vector be searchable?
- What recall is good enough, and what latency target applies?
- Which metadata filters are needed (tenant, permissions, dates), and how selective are they?
- One large index, or many tenants of very different sizes?

## Requirements

**Functional**

- Upsert and delete vectors with an id and metadata; query for the top k (up to 100) by cosine or dot-product similarity.
- Filter queries by metadata, such as tenant, permission group or date range.
- Optional hybrid queries that combine vector and keyword matches.
- Separate namespaces per tenant, with their own quotas.

**Non-functional**

- **Scale:** 1 billion vectors of 768 dimensions (about 3 TB as 4-byte floats) across 10,000 tenants, from a few thousand to 200 million vectors each.
- **Throughput:** 20,000 queries and 5,000 upserts per second at peak.
- **Latency:** p99 under 50 ms for top 10 with a filter.
- **Quality:** recall@10 of at least 0.95 compared with exact search.
- **Freshness:** a new or deleted vector is reflected in results within 2 seconds.
- **Availability:** 99.95% for queries; no acknowledged write is lost.

## Key concepts

- :term[Embeddings]{id="embedding"}: stored vectors and queries must come from the same model version, so changing the embedding model means re-embedding everything and building a new index.
- :term[Approximate nearest neighbor search]{id="approximate-nearest-neighbor"}: instead of a billion comparisons per query, the index examines a few thousand candidates.
- :term[HNSW]{id="hnsw"}: the graph index gives high recall at low latency, but its links cost memory and it handles deletes poorly, which shapes the storage design.
- :term[Product quantization]{id="product-quantization"}: shrinking each 3,072-byte vector to 96 bytes keeps compressed copies of a billion vectors in about 100 GB of memory; full vectors stay on SSD to rescore the final candidates.
- :term[Recall@k]{id="recall-at-k"}: the service measures recall against exact search on sampled queries and tunes how widely each index searches to hold 0.95.
- :term[Vector database]{id="vector-database"} filters: filtering after the search can leave fewer than k results, so filters are applied during the graph walk, with exact search when a filter matches only a few thousand vectors.
- :term[Sharding]{id="sharding"} and :term[replication]{id="replication"}: small tenants share shards; large tenants are split by vector id across many shards, each with replicas for query throughput.
- :term[LSM-style segments]{id="lsm-tree"}: new vectors go to a small in-memory buffer searched exhaustively, which is later sealed into an immutable indexed segment, so writes never wait for graph updates.
- :term[Hybrid search]{id="hybrid-search"}: a keyword index catches exact identifiers that embeddings blur, and the two result lists are merged by rank.

## High-level design

::diagram{id="vector-search-hld"}

1. Applications send queries and upserts to the API. Text is embedded by the model version the namespace was built with.
2. The query router finds the shards that hold the tenant's data and sends the query vector and filter to one replica of each. For hybrid queries it also queries the keyword index.
3. Each shard searches its buffer and segments: it walks the HNSW graph using compressed vectors and the filter, rescores the top 50 candidates with full vectors and returns its top k. The router merges the shard lists, fuses keyword results by rank, and returns the top 10.
4. Upserts and deletes are appended to a durable write log and acknowledged. Shards apply them within 2 seconds: new vectors go to the in-memory buffer, and deletes are marked so queries skip them. An index builder seals full buffers into indexed segments, merges small segments, drops deleted vectors, and snapshots segments to object storage so a new replica loads quickly.
5. A recall monitor reruns sampled queries with exact search and reports recall@10 per namespace. Tenants track relevance with labeled queries and clicks, and an embedding model upgrade builds a new index alongside the old one and switches after evaluation.

The full version of this case study will cover memory and shard sizing, HNSW versus IVF and disk-based indexes, filtered search, segment compaction and deletes, and migrating to a new embedding model without downtime.
