---
slug: search-autocomplete
title: Search autocomplete
track: A
order: 9
difficulty: intermediate
summary: Suggest the top 10 completions for each keystroke at 60,000 requests per second in under 100 ms, serving precomputed lists from an in-memory trie that is rebuilt from query logs.
concepts: [trie, debouncing, caching, cdn, range-partitioning, hot-spot, replication, stream-processing, ttl]
prerequisites: [distributed-cache]
estimatedMinutes: 3
status: outline
exercises: []
diagram: search-autocomplete-hld
---

## Problem statement

Design the suggestion list under a search box, in the style of Google Search: as the user types, show the 10 most popular queries that start with the text typed so far.

Every keystroke can trigger a request, so suggestion traffic is several times search traffic, and each answer must arrive before the user types the next letter. The ranking comes from billions of past searches that must be counted and refreshed, breaking news should appear within minutes, and offensive or dangerous suggestions must never be shown.

Questions to ask:

- Rank by global popularity, or also by location, language or the user's own history?
- How fresh must suggestions be? Should a breaking-news query appear within minutes?
- Prefix matches only, or also typo tolerance and matches in the middle of a query?
- How many suggestions, and how fast must they appear?
- Must we filter offensive suggestions and remove one quickly on request?

## Requirements

**Functional**

- Return up to 10 completions for a prefix, ranked by search count over the last 4 weeks, with recent days weighted more.
- Separate suggestions per language and region.
- Trending queries appear within 30 minutes; the full ranking refreshes daily.
- Blocked terms never appear, and removing a suggestion takes effect within minutes.

**Non-functional**

- **Scale:** 500 million searches a day; with debouncing, about 4 suggestion requests per search, so 2 billion a day, about 23,000 per second on average and 60,000 at peak.
- **Latency:** suggestions shown within 100 ms of a keystroke at p99, of which server time is under 10 ms.
- **Data:** about 100 million distinct queries, after dropping those searched fewer than 10 times a week; prefixes are cut at 20 characters.
- **Availability:** 99.99%; if suggestions fail, the search box still works without them.

## Key concepts

- :term[Trie]{id="trie"}: queries that share a prefix share a path, and storing the top 10 completions at every node turns a lookup into a walk of at most 20 steps, with no sorting at request time.
- :term[Debouncing]{id="debouncing"}: the browser waits until typing pauses for about 100 ms before asking, and keeps answers for prefixes it already fetched, so fast typists and backspaces send far fewer requests.
- :term[Caching]{id="caching"} at the :term[CDN]{id="cdn"}: short prefixes such as "w" or "how to" have the same answer for everyone in a region and language, so edges serve them with a :term[TTL]{id="ttl"} of a few minutes.
- :term[Range partitioning]{id="range-partitioning"}: the trie is split into shards by prefix range, sized by traffic rather than by letter, because a range such as "s" is a :term[hot spot]{id="hot-spot"} compared with "xq".
- :term[Replication]{id="replication"}: shards are read-only between rebuilds, so every replica simply loads the same snapshot, and more replicas add read capacity.
- :term[Stream processing]{id="stream-processing"}: a streaming job counts each query over the last hour and flags queries rising far above their usual rate, which is how news reaches suggestions within minutes instead of a day.

## High-level design

::diagram{id="search-autocomplete-hld"}

1. The browser debounces keystrokes and calls `GET /suggest?q=how+to+b&lang=en`. The browser cache and the CDN answer repeated prefixes; the rest reach the suggest API.
2. The suggest API sends the prefix to the trie shard that owns its range. The shard walks the trie and returns the stored top 10. The API removes anything on the blocklist and returns the list, all within a few milliseconds.
3. Every search is written to a query log, which two aggregator jobs read. The daily batch job adds up counts over the last 4 weeks with more weight on recent days, drops rare and blocked queries, builds a new trie with the top 10 at every node, and writes it to object storage as a snapshot.
4. Every 15 minutes, the streaming job writes a small trending update next to the snapshot, and shards merge it into their top-10 lists.
5. Trie servers load each new snapshot in the background and swap it in atomically, so requests never see a half-built trie.

The full version of this case study will cover trie memory estimates, ranking with time decay, personalization and regional tries, typo tolerance, and the removal path for harmful suggestions.
