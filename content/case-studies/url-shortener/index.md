---
slug: url-shortener
title: URL shortener
track: A
order: 1
difficulty: beginner
summary: Turn long links into short codes and redirect billions of clicks a month in milliseconds, without collisions, lost links or a single point of failure.
concepts: [base62-encoding, distributed-id-generation, caching, cache-aside, key-value-store, hash-partitioning, replication, availability]
prerequisites: []
estimatedMinutes: 13
status: complete
exercises: [url-shortener-quiz, url-shortener-estimation]
diagram: url-shortener-hld
---

## Problem statement

Design a service like bit.ly: people paste a long URL and get a short one, such as `sho.rt/a8Kx2Qm`. Anyone who opens the short link is redirected to the original page.

It's the classic first system design problem because it's small enough to finish in an interview, yet it touches unique ID generation, read-heavy caching, key-value storage, partitioning and availability.

:::primer
A short link is a **key** (the code `a8Kx2Qm`) that points to a **value** (the long URL). Creating a link stores a new key–value pair. Following a link looks up the key and answers with an HTTP redirect, which tells the browser to go to the long URL instead.
:::

Questions to ask before designing:

- How many links are created, and how many redirects happen, per month?
- Can users choose a custom alias? Can links expire or be deleted?
- Do we need click analytics, and how fresh must they be?
- How short must codes be, and is it a problem if codes are guessable?
- Do links ever change destination once created?

## Requirements

**Functional**

- Create a short link for a long URL, optionally with a custom alias and an expiry date.
- Redirect a short link to its long URL.
- Count clicks per link (shown to the owner, may be a few minutes behind).
- Out of scope: user accounts management, link editing, a full analytics dashboard.

**Non-functional**

- **Scale:** 100 million new links a month; about 100 redirects per link created.
- **Latency:** redirects respond in under 50 ms at p99 from our servers; creation can take a few hundred milliseconds.
- **Availability:** 99.99% for redirects, because a broken redirect breaks every page that embeds the link. Creation can tolerate slightly lower availability.
- **Durability:** a created link is never lost and never points somewhere else.
- **Codes:** as short as practical, and not trivially enumerable.

## Back-of-envelope estimates

Every input below is an assumption to confirm with the interviewer.

| Quantity | Calculation | Result |
| --- | --- | --- |
| Links created | 100M per month ÷ 2.6M seconds | ~40 per second, ~120 at peak |
| Redirects | 100 × 100M = 10B per month ÷ 2.6M seconds | ~4,000 per second, ~12,000 at peak |
| Links stored after 5 years | 100M × 12 × 5 | 6 billion |
| Storage | 6B × 500 bytes per record | 3 TB, ~9 TB with 3 copies |
| Redirect bandwidth | 12,000 per second × ~500 bytes | ~6 MB/s at peak |
| Hot cache | 10M most-used links × 500 bytes | ~5 GB |

**Code length:** with :term[base62 encoding]{id="base62-encoding"} (0–9, a–z, A–Z), 6 characters give 62⁶ ≈ 57 billion codes and 7 give 62⁷ ≈ 3.5 trillion. Six would technically fit 6 billion links, but with random codes the space would be over 10% full and collisions frequent. Seven characters keep it under 0.2% full.

**What the numbers say:** the write rate is tiny; the read rate is moderate but 100 times higher, so this is a **read-heavy** system where caching does most of the work. 3 TB is small for a distributed store but awkward for one machine with growth and replicas, so plan for a partitioned key-value store. Bandwidth is negligible.

## API design and data model

```http
POST /api/v1/links
Content-Type: application/json

{ "long_url": "https://example.com/very/long/path?q=1", "alias": "launch", "expires_at": "2027-01-01T00:00:00Z" }

201 Created
{ "code": "launch", "short_url": "https://sho.rt/launch" }
```

```http
GET /a8Kx2Qm

302 Found
Location: https://example.com/very/long/path?q=1
```

**301 or 302?** A 301 (permanent) redirect is cached by browsers, so repeat clicks may never reach us: less load, but click counts become unreliable and an expired link keeps working from browser caches. A 302 (temporary) sends every click to us. Because we count clicks and support expiry, use 302.

**Data model:** one record per link, looked up only by its code.

| Field | Type | Notes |
| --- | --- | --- |
| `code` | string, 7 chars (key) | Primary key; every redirect looks it up |
| `long_url` | string, up to 2 KB | Validated and normalized at creation |
| `owner_id` | string | For deletion and click stats |
| `created_at`, `expires_at` | timestamps | Expired links answer 404 |

Clicks are counted separately (see below), so the link record never changes after creation. Immutable records make caching and replication easy.

## High-level design

::diagram{id="url-shortener-hld"}

**Creating a link:** the client calls `POST /api/v1/links` through the load balancer. A stateless link service validates the URL, generates a code (or checks that the custom alias is free), and writes the record to the key-value store with a "create only if absent" condition. It also writes the record into the cache so the first redirect is fast.

**Following a link:** the browser requests `GET /a8Kx2Qm`. Very hot links may be answered by the CDN edge for a short time. Otherwise the link service checks the cache, falling back to the store on a miss (:term[cache-aside]{id="cache-aside"}), and answers with a 302. It publishes a "redirected" event to a queue without waiting, and a worker aggregates click counts per link per minute.

The link service is stateless, so it scales by adding instances behind the load balancer; a handful handles the peak with headroom.

## Deep dives

### Generating short codes

Three common approaches:

1. **Hash the long URL** (for example, the first 7 base62 characters of a SHA-256). The same URL always gets the same code, which deduplicates for free. But different URLs can collide on the first 7 characters, so you still need a collision check, and two users shortening the same URL share one link and its stats.
2. **Counter plus base62.** A global counter gives every link a unique number, encoded in base62: no collisions at all. But a single counter is a bottleneck and single point of failure, and sequential codes let anyone enumerate every link. Fixes: give each server a **range** of 10,000 numbers at a time from a small coordination service (only one round trip per 10,000 links), and scramble the number with a reversible permutation before encoding.
3. **Random code with a conditional insert.** Generate 7 random base62 characters and insert with "only if absent." On the rare collision, try again. With 6 billion of 3.5 trillion codes used, a collision happens about once in 590 attempts.

**Choice:** random codes. They need no coordination, are unguessable, and at ~120 creations per second the occasional retry is free. Counter ranges are a good alternative if codes must be as short as possible, because a counter fills the space densely.

:::deeper[How Snowflake-style IDs compare]
Twitter's Snowflake design builds a 64-bit ID from a timestamp, a machine number and a per-machine sequence. Every server generates unique IDs with no coordination at all, and IDs sort by creation time. That's ideal for database keys, but 64 bits need 11 base62 characters, too long for a short link. :term[Distributed ID generation]{id="distributed-id-generation"} always trades length, coordination and ordering against each other; for short links, length wins.
:::

### Making redirects fast

Redirect traffic is extremely skewed: a few links (new posts, viral campaigns) get most clicks. That makes caching very effective:

- **Cache-aside** in an in-memory store, keyed by code. Records never change, so there's no invalidation problem: cache entries expire with the link or by LRU eviction.
- **Negative caching:** cache "not found" for unknown codes for a minute, so bots probing random codes don't hammer the store.
- **Edge caching** for the hottest links: the CDN can answer redirects with a short TTL (say 60 seconds), and its logs feed click counts.

With a 95% hit rate, the store sees about 600 reads per second at peak, an easy load.

### Storing billions of links

The access pattern is a single-key lookup, so a :term[key-value store]{id="key-value-store"} fits perfectly:

- **Partition** by a hash of the code (:term[hash partitioning]{id="hash-partitioning"}), so load spreads evenly and adding nodes moves only a fair share of keys.
- **Replicate** each partition 3 times (:term[replication]{id="replication"}) across availability zones; a node failure loses nothing and reads continue from replicas.
- **Consistency:** records are immutable, so replica lag only matters in the first moments after creation. Writing the new link into the cache at creation covers the common "create, then click immediately" case.

A relational database with the code as primary key would also work at this size; the key-value store wins on simple horizontal scaling and has no need for joins.

### Counting clicks

Writing a counter row on every redirect would turn a cheap read into a write. Instead, the redirect path emits an event to a queue and returns immediately. A worker aggregates events into per-link, per-minute counts and writes those. If the queue is backed up, redirects are unaffected; counts are just a little late.

## Trade-offs

| Decision | Alternative | Why this choice |
| --- | --- | --- |
| Random 7-character codes | Counter ranges | No coordination, unguessable; retries are rare at this write rate |
| 302 redirects | 301 redirects | Accurate click counts and working expiry, at the cost of more traffic |
| Key-value store partitioned by code | Single relational database | Scales out simply; the only query is lookup by key |
| Cache-aside plus edge caching | No cache | Read-heavy, skewed traffic; turns 12,000 lookups per second into ~600 |
| Asynchronous click counting | Counter update per redirect | Keeps redirects fast and available; counts are minutes behind |

## Failure modes, scaling and monitoring

- **Cache cluster lost:** every redirect falls through to the store, roughly 20 times its usual load. Size the store for a cache outage, use request coalescing for hot keys, and warm a new cache from recent links.
- **A store partition loses its leader:** a replica takes over; redirects for that partition may see errors for seconds. Retries with backoff in the link service hide most of it.
- **Abuse:** short links hide phishing and malware. Check new URLs against a malicious-URL list at creation, rate limit creation per user and IP, and allow takedowns that delete the link and purge caches.
- **Viral link:** a single code gets 100,000 clicks per second. It's served from cache and the CDN edge, so the store never notices.
- **Growth:** add store nodes and rebalance partitions; add link service instances; the design has no component that must scale vertically.

**Monitor:** redirect latency (p50, p99), error and 404 rates, cache hit rate, store read latency and replication lag, creation rate, click-event queue depth. Suggested SLOs: 99.99% of redirects succeed; 99% complete within 50 ms at our edge.

## Real-world references

- RFC 9110, *HTTP Semantics* (IETF, 2022): defines 301 Moved Permanently, 302 Found and how clients and caches treat them.
- Twitter Engineering, *Announcing Snowflake* (2010): the timestamp-plus-machine-plus-sequence ID scheme discussed above.
- Flickr Engineering, *Ticket Servers: Distributed Unique Primary Keys on the Cheap* (2010): handing out unique IDs from small, replicated counter servers.

## 45-minute interview version

1. **Requirements (5 min):** create, redirect, custom alias, expiry, click counts; 100M links a month, 100 to 1 reads to writes, 99.99% redirect availability.
2. **Estimates (3 min):** ~40 writes and ~4,000 reads per second (12,000 peak); 3 TB over five years; 7 base62 characters.
3. **API (3 min):** `POST /api/v1/links`, `GET /{code}` with 302 and why not 301.
4. **High-level design (8 min):** load balancer, stateless link service, cache, partitioned key-value store, click events through a queue. Walk through create and redirect.
5. **Deep dives (15 min):** code generation (hash vs counter ranges vs random, collision math); caching and hot links; partitioning and replication.
6. **Failures (6 min):** cache outage, partition failover, abuse and takedowns, monitoring and SLOs.
7. **Wrap-up (2 min):** summarize, then mention multi-region redirects and a fuller analytics pipeline as next steps.

:::interview
Interviewers use this problem to see whether you size things before designing them. Say early that it's read-heavy and why, do the code-length arithmetic out loud, and compare at least two code-generation schemes. Bonus points for spotting the 301-versus-302 trade-off and the abuse problem without being prompted.
:::

## Practice

::quiz{id="url-shortener-quiz"}

::drill{id="url-shortener-estimation"}
