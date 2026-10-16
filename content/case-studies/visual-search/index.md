---
slug: visual-search
title: Visual search
track: B
order: 25
difficulty: intermediate
summary: Find matching products for a phone photo among 200 million catalog images in under 400 ms, with object detection, contrastive image embeddings, a compressed ANN index and re-ranking.
concepts: [embedding, contrastive-learning, object-detection, approximate-nearest-neighbor, product-quantization, vector-database, reranking, cold-start, recall-at-k]
prerequisites: [video-recommendations]
estimatedMinutes: 3
status: outline
exercises: []
diagram: visual-search-hld
---

## Problem statement

Design visual product search in the style of Pinterest Lens or Google Lens shopping. A shopper photographs a lamp in a friend's living room, or taps a jacket in a photo, and gets products that look like it, ranked so the exact or closest item comes first.

The hard part is that "looks like" must survive a big gap between query and catalog: blurry phone photos with clutter and odd lighting on one side, clean studio shots on the other. The search must cover hundreds of millions of images in milliseconds, and the model and the index must stay in step whenever the model changes.

Questions to ask:

- What is in the catalog, how many images, and how fast does it change?
- Is the goal the exact product, or similar-looking products in stock?
- Can one photo contain several items, and does the shopper pick one?
- Which filters apply: category, price, region, in stock?
- What labeled data exists: clicks, purchases, human-rated pairs?

## Requirements

**Functional**

- Accept a photo, detect the items in it, and let the shopper pick one (default: the most prominent).
- Return 50 products ranked by visual match, filtered by region and availability.
- New products become searchable within an hour; sold-out products disappear within 5 minutes.

**Non-functional**

- **Scale:** 200 million product images; 20 million searches per day (about 230 per second, 700 at peak); 2 million new or changed images per day.
- **Latency:** under 400 ms at p99 from photo received to results.
- **Quality:** the exact product appears in the top 20 for most labeled query photos, measured per category.
- **Availability:** 99.9%; if detection fails, search the whole photo.

## Key concepts

- :term[Object detection]{id="object-detection"}: finds each item in a cluttered photo, so the search embeds the jacket alone rather than the jacket plus the street behind it.
- :term[Embeddings]{id="embedding"}: one image encoder maps query crops and catalog images into the same 256-dimension space, where nearby vectors look alike.
- :term[Contrastive learning]{id="contrastive-learning"}: trains the encoder on pairs that should match (a shopper photo and the product they bought, two shots of one product) against hard negatives that look similar but differ.
- :term[Approximate nearest neighbor search]{id="approximate-nearest-neighbor"}: comparing a query with 200 million vectors exactly is about 51 billion multiply-adds; a graph or cluster index checks only a small fraction of them.
- :term[Product quantization]{id="product-quantization"}: shrinks each 1 KB vector to 64 bytes, cutting the stored vectors from about 200 GB to 13 GB, small enough for memory on one machine; the shortlist is re-scored with full vectors from SSD.
- :term[Vector database]{id="vector-database"}: the index is replicated for throughput and supports filters on category, region and stock.
- :term[Reranking]{id="reranking"}: a second model reorders the top 1,000 using exact similarity, category match, price, quality and past clicks, and collapses near-duplicate listings.
- :term[Cold start]{id="cold-start"}: a new product is searchable as soon as its images are embedded, before it has any clicks.
- :term[Recall@k]{id="recall-at-k"}: the main offline metric, measured on labeled query photos per category, alongside the ANN index's recall against exact search.

## High-level design

::diagram{id="visual-search-hld"}

1. The app uploads a resized photo. The search API runs the crop detector on GPU and picks the chosen item's box.
2. The image encoder embeds the crop (about 20 ms on GPU), and the vector index returns the 1,000 nearest products that pass the filters.
3. The re-ranker scores those 1,000 with exact similarity and product features, collapses duplicates, and returns 50. Stock changes are applied as filters, not by rebuilding the index.
4. New and changed product images go from object storage to the batch embedder, which embeds them and upserts the vectors into the index within the hour.
5. Impressions, clicks and purchases are logged and turned into training pairs. Training jobs retrain the encoder monthly and gate it on recall@20. A new encoder means re-embedding the whole catalog (about 28 GPU-hours at an assumed 2,000 images per second per GPU) into a new index version; the query encoder switches to the same version at the same moment.

The full version of this case study will cover training data and hard negatives, index choice and sizing, versioned re-embedding with a clean cutover, re-ranking features, and online metrics such as click-through and purchases per search.
