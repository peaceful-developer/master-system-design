---
slug: distributed-cache
title: Distributed cache
track: A
order: 4
difficulty: intermediate
summary: Serve 2 million reads per second from 10 TB of in-memory data in under a millisecond, sharding keys with consistent hashing and shielding the database from stampedes and hot keys.
concepts: [cache-aside, consistent-hashing, ttl, lru, cache-invalidation, change-data-capture, cache-stampede, request-coalescing, hot-spot, replication, cache-hit-rate]
prerequisites: [key-value-store]
estimatedMinutes: 3
status: outline
exercises: []
diagram: distributed-cache-hld
---

## Problem statement

Design a distributed in-memory cache in the style of Memcached or Redis Cluster, run as a shared service in front of a company's databases. App servers `get` and `set` small values by key, and the cache spreads them over many memory-heavy nodes so most reads never touch the database.

Keeping bytes in RAM is easy. The hard parts are **routing each key to the right node** as the fleet changes, **keeping copies from going stale** after database writes, and **protecting the database** when a node dies, a popular key expires, or one key outgrows a single node.

Questions to ask:

- What is cached (query results, rendered objects, sessions), and how big are the values?
- How stale may a cached value be: seconds, minutes, or never?
- What hit rate keeps the database within its capacity?
- Is the cache only an accelerator, or does anything treat it as the only copy?
- One region, or must invalidations reach caches in other regions?

## Requirements

**Functional**

- `get(key)`, `multi_get(keys)`, `set(key, value, ttl)` and `delete(key)` for keys up to 250 bytes and values up to 1 MB.
- Every entry expires after its TTL; when a node's memory is full, the least recently used entries are evicted.
- Writes to the database invalidate the matching cache keys.

**Non-functional**

- **Scale:** 10 TB of cached data on 100 shards of about 100 GB each, plus one replica per shard; 2 million reads and 200,000 writes per second at peak.
- **Latency:** p99 under 1 ms for a `get` inside one data center.
- **Hit rate:** at least 95%, so the database sees at most 100,000 reads per second.
- **Availability:** losing any one node must not overload the database.
- **Staleness:** a cached value usually lags the database by under a few seconds after a write; the TTL bounds the worst case.
- **Elasticity:** adding a shard moves only about 1% of keys, so the hit rate dips briefly instead of collapsing.

## Key concepts

- :term[Cache-aside]{id="cache-aside"}: the app, not the cache, reads the database on a miss and fills the cache, so cache nodes stay simple servers that know nothing about the database.
- :term[Consistent hashing]{id="consistent-hashing"}: adding a shard to the ring remaps about 1% of keys, while `hash(key) mod N` would remap almost every key and flood the database with misses.
- :term[TTL]{id="ttl"} and :term[LRU eviction]{id="lru"}: the TTL caps how stale an entry can get, and LRU drops the coldest entries when memory is full.
- :term[Cache invalidation]{id="cache-invalidation"}: writers delete the key after committing, and a :term[change data capture]{id="change-data-capture"} consumer deletes it again, so a crashed writer cannot leave a stale value until the TTL ends.
- :term[Cache stampede]{id="cache-stampede"}: when a key read 50,000 times a second expires, every request misses at once; :term[request coalescing]{id="request-coalescing"} lets one request refill it while the rest wait, and random jitter on TTLs stops keys expiring together.
- :term[Hot spots]{id="hot-spot"}: one viral key can exceed what a node serves; copy it to several shards under suffixed keys, or hold it for a second in each app server's local memory.
- :term[Replication]{id="replication"}: each shard streams writes to a replica, so a failed node is replaced by a warm copy, not an empty one.
- :term[Cache hit rate]{id="cache-hit-rate"}: it sizes the database; at 2 million reads per second, falling from 95% to 90% doubles database reads to 200,000 per second.

## High-level design

::diagram{id="distributed-cache-hld"}

1. App servers call a cache router, either a client library or a local proxy. It hashes the key onto the ring, using a shard map from a small config store, and sends the request to the owning shard. A `multi_get` becomes one batch per shard.
2. On a miss, the app reads the database and writes the value back with a TTL of, say, 10 minutes plus jitter. Concurrent misses for one key are coalesced, so only one request reaches the database.
3. On a write, the app updates the database and then deletes the cache key instead of setting the new value. This avoids a race where two writers fill the cache in the opposite order from their commits.
4. An invalidator tails the database's change log and deletes affected keys again, catching writes from other services and deletes lost in a crash.
5. When health checks mark a node dead, a controller promotes its replica and publishes a new shard map, which every router picks up within seconds.

The full version of this case study will cover memory and node-count estimates, leases versus locks for stampede protection, the remaining race between a slow cache fill and an invalidation, hot-key detection, and cross-region invalidation.
