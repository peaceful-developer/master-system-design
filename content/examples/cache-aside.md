---
slug: cache-aside
title: Cache-aside
summary: Read from the cache first, fall back to the database on a miss and fill the cache, so hot data is served from memory and the database only sees the misses.
concepts: [cache-aside, caching, cache-hit-rate, ttl, cache-invalidation, cache-stampede]
tags: [caching, read-heavy, latency]
diagram: cache-aside
---

## The problem

A product catalog serves 20,000 reads per second at peak. Each product page needs a database query that takes 10–20 ms and a share of the database's limited capacity. The same few thousand popular products are requested over and over, and they change a few times a day at most. Querying the database for every view wastes most of its work recomputing answers it just gave.

## The pattern

:term[Cache-aside]{id="cache-aside"} (also called lazy loading) puts a fast in-memory store beside the database. The **application** decides what goes into it:

1. On a read, look the key up in the cache.
2. **Hit:** return the cached value.
3. **Miss:** read from the database, return the result, and store it in the cache with a :term[TTL]{id="ttl"}.
4. On a write, update the database, then **delete** the cache key so the next read reloads fresh data.

::diagram{id="cache-aside"}

::figure{id="cache-aside" caption="A miss goes to the database and fills the cache; the next read for the same key is a hit."}

```python
def get_product(product_id: str) -> dict:
    key = f"product:{product_id}"
    cached = cache.get(key)
    if cached is not None:
        return cached                                  # hit
    product = db.fetch_product(product_id)             # miss
    cache.set(key, product, ttl_seconds=300)
    return product

def update_product(product_id: str, changes: dict) -> None:
    db.update_product(product_id, changes)
    cache.delete(f"product:{product_id}")              # next read reloads
```

## Why it works

With a 95% :term[hit rate]{id="cache-hit-rate"}, only 1,000 of those 20,000 reads per second reach the database, and the average read takes about 1.7 ms (0.95 × 1 ms + 0.05 × 15 ms) instead of 15 ms. Only data that is actually requested gets cached, so memory goes to what's popular. And the cache is an optimization, not a dependency: if it fails, the application still works, just slower.

## When to use it

- Read-heavy data that changes much less often than it is read: product pages, profiles, configuration, rendered fragments.
- Expensive reads: slow queries, aggregations, calls to other services.
- When a little staleness (bounded by the TTL) is acceptable.

## When not to use it

- **Data that must be exactly current**, such as the stock count that decides whether a purchase succeeds, or an account balance. Read those from the source of truth.
- **Write-heavy data** that changes on nearly every read: the cache is invalidated before it can help.
- **Data read once.** Caching a one-off report just evicts something useful.
- **When every read must be fast, even the first one**, consider preloading (warming) the cache or write-through instead, so misses never reach users.

## Pitfalls and fixes

- **Stale data from a race:** a slow reader can write an old value back after a writer deleted the key. Keep TTLs short, use versioned keys, or delete again shortly after the write.
- **:term[Cache stampede]{id="cache-stampede"}:** when a hot key expires, thousands of requests miss at once. Let one request rebuild the value while others wait or receive the stale value (request coalescing), and add jitter to TTLs.
- **Caching misses:** a key that doesn't exist misses every time. Cache a short-lived "not found" marker to protect the database from repeated lookups.
- **Unbounded keys:** caching per user and per query can explode memory. Choose keys deliberately and rely on LRU eviction.

## Related

- Lesson: [Caching and CDNs](/learn/building-blocks/caching-and-cdns) covers the other caching patterns and eviction policies.
- Glossary: :term[cache invalidation]{id="cache-invalidation"}.
