---
slug: caching-and-cdns
title: Caching and CDNs
phase: building-blocks
order: 2
summary: Where caches live, the main caching patterns, how to pick what to evict, why invalidation is hard, and how CDNs bring content close to users.
estimatedMinutes: 14
concepts: [caching, cache-hit-rate, cache-aside, read-through, write-through, write-back, ttl, lru, lfu, cache-invalidation, cache-stampede, cdn]
exercises: [caching-quiz]
---

A popular product page is viewed 50,000 times a minute, and it changes maybe twice a day. Asking the database to build the same answer 50,000 times is wasteful. A cache remembers the answer and hands it out in a millisecond. Caching is the most powerful performance tool you have, and the source of some of the most confusing bugs.

:::primer
A **cache** is a small, fast store that keeps copies of data you'll probably need again.

- A **hit** means the cache had the answer: fast.
- A **miss** means it didn't, so you go to the slow source and usually save the result for next time.
- The **hit rate** is the share of requests that hit. It's the number that decides whether a cache helps.
:::

## Caches are everywhere

From the user outwards:

1. **Browser cache:** the browser keeps images and scripts, guided by `Cache-Control` headers.
2. **CDN:** servers near users keep copies of content (more below).
3. **Application cache:** an in-memory store like Redis or Memcached shared by your app servers.
4. **Database cache:** the database keeps hot pages of data and indexes in memory.

Each layer you hit early saves every layer behind it.

## Why hit rate is everything

If a cache answers in 1 ms and the database in 20 ms, the average read time is:

> average = hit rate × 1 ms + (1 − hit rate) × 20 ms

| :term[Hit rate]{id="cache-hit-rate"} | Average read | Database load (of 10,000 reads/s) |
| --- | --- | --- |
| 50% | 10.5 ms | 5,000/s |
| 90% | 2.9 ms | 1,000/s |
| 99% | 1.2 ms | 100/s |

Going from 90% to 99% cuts database load by another 10×. That's why teams obsess over a few percentage points of hit rate.

## Caching patterns

::figure{id="cache-aside" caption="Cache-aside: read the cache first; on a miss read the database and fill the cache."}

**:term[Cache-aside]{id="cache-aside"} (lazy loading)** is the most common pattern. The application owns the logic:

```python
def get_product(product_id):
    product = cache.get(f"product:{product_id}")
    if product is None:                       # miss
        product = db.load_product(product_id)
        cache.set(f"product:{product_id}", product, ttl_seconds=300)
    return product
```

Only data that's actually requested gets cached, and if the cache dies, the app still works (slowly).

Other patterns:

- **:term[Read-through]{id="read-through"}:** the cache itself loads misses from the database. Same idea, less code in the app.
- **:term[Write-through]{id="write-through"}:** every write goes to the cache and the database together. The cache is always fresh, but writes are slower and you cache data nobody may read.
- **:term[Write-back]{id="write-back"} (write-behind):** writes go to the cache and are flushed to the database later. Very fast writes, but a cache crash can lose data. Use only when that's acceptable (view counters, for example).
- **Write-around:** writes go only to the database; the cache fills on the next read. Avoids caching write-once data.

## What to throw away: eviction

Caches are smaller than the data behind them, so something must go when they're full.

- **:term[LRU]{id="lru"} (least recently used):** evict what hasn't been touched for longest. A strong default.
- **:term[LFU]{id="lfu"} (least frequently used):** evict what's used least often. Better when some items are steadily popular.
- **:term[TTL]{id="ttl"} (time to live):** every entry expires after a set time, whatever else happens. This also bounds how stale data can get.

## The hard part: invalidation

When the source data changes, cached copies become wrong. :term[Cache invalidation]{id="cache-invalidation"} strategies, from simplest to most precise:

1. **Short TTLs:** accept up to N seconds of staleness. Simple and robust. Often good enough.
2. **Delete on write:** after updating the database, delete the cache key so the next read refills it.
3. **Versioned keys:** include a version in the key (`product:42:v7`); bump the version on change, and old entries simply age out.

:::warning[A classic race]
With delete-on-write, this sequence returns stale data for a full TTL: a reader misses and reads the *old* value from the database, a writer updates the database and deletes the key, then the slow reader writes the old value into the cache. Short TTLs limit the damage; versioned keys or "delete again shortly after the write" close the gap. Whatever you choose, say how stale the data can get.
:::

## What (not) to cache

Cache data that is **read often, changes rarely, and is expensive to compute**: product pages, user profiles, rendered fragments, results of slow queries. Be careful with data that must be exact right now (account balances, stock levels at checkout): read those from the source, or cache them for only a second or two.

## CDNs: caches near the user

A :term[CDN]{id="cdn"} (content delivery network) runs cache servers in many cities. A user in Mumbai fetches your images from a server in Mumbai instead of from your origin in Virginia, turning a ~200 ms round trip into a ~10 ms one.

- **Pull CDN:** on a miss, the edge server fetches from your origin and caches it. Easy; the first user in each region pays the miss.
- **Push CDN:** you upload content to the CDN ahead of time. More control; good for large files like video.

CDNs obey your `Cache-Control` headers. A common trick for static files: put a hash of the content in the file name (`app.3f9a1c.js`), cache it "forever", and publish a new name when it changes. No invalidation needed.

CDNs aren't only for static files. They can cache API responses that are the same for many users, terminate TLS close to users, and absorb traffic spikes and attacks before they reach you.

:::deeper[Stopping a cache stampede]
A hot key expires, and 5,000 requests miss at the same moment. All of them hit the database to rebuild the same value. That's a :term[cache stampede]{id="cache-stampede"}, and it can take a database down right when traffic peaks.

Defences:

- **Request coalescing (single flight):** the first request that misses takes a short lock and rebuilds; the rest wait for its result or briefly serve the stale value.
- **Early, probabilistic refresh:** each reader that sees an entry close to expiry has a small, growing chance of refreshing it early, so one request usually refreshes before the expiry cliff. A well-known formulation of this idea appeared in research on optimal probabilistic stampede prevention (Vattani and others, 2015).
- **Stale-while-revalidate:** keep serving the old value for a short grace period while one background job refreshes it.
- **Jittered TTLs:** add a random few seconds to each TTL so keys loaded together don't expire together.
:::

:::interview
When you add a cache, state four things: **what** you cache and its key, the **pattern** (usually cache-aside), the **expected hit rate** and how much load it removes, and the **staleness** you accept with your invalidation plan. Then mention stampede protection for hot keys. That covers what interviewers look for.
:::

## Key takeaways

- Caches live in browsers, CDNs, app tiers and databases; each layer saves the ones behind it.
- Hit rate decides the benefit; going from 90% to 99% cuts backend load by 10×.
- Cache-aside is the default pattern; write-through and write-back trade freshness, speed and safety.
- Evict with LRU, LFU or TTLs; invalidation is the hard part, so be explicit about staleness.
- CDNs move content close to users and absorb spikes; hashed file names avoid invalidation.

::quiz{id="caching-quiz"}
