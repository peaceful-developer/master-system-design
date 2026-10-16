---
slug: news-feed
title: News feed
track: A
order: 6
difficulty: intermediate
summary: Show 200 million people the latest posts from everyone they follow in under 200 ms, using fan-out on write for most accounts and fan-out on read for celebrities.
concepts: [fan-out-on-write, fan-out-on-read, hot-spot, message-queue, caching, sharding, eventual-consistency, pagination, distributed-id-generation]
prerequisites: [url-shortener]
estimatedMinutes: 16
status: complete
exercises: [news-feed-quiz, news-feed-estimation]
diagram: news-feed-hld
---

## Problem statement

Design the home feed of a social app such as Twitter/X or Instagram: when you open the app, you see recent posts from the accounts you follow, newest first, and you can scroll further back.

The challenge is the shape of the data. Every reader follows hundreds of accounts, every author has followers ranging from zero to tens of millions, and feeds are opened far more often than posts are written. Where you do the work of assembling each feed decides whether the system is cheap or impossibly expensive.

:::primer
A **feed** is a merged, time-ordered list of posts from the people you follow. Two ways to build it:

- **On read:** when you open the app, fetch recent posts from everyone you follow and merge them.
- **On write:** when someone posts, copy a pointer to the post into each follower's prepared feed, so opening the app just reads that list.

The [fan-out on write example](/examples/fan-out-on-write) shows the second approach in detail.
:::

Questions to ask:

- How many daily users, and how often do they open the feed and post?
- How many accounts does a typical user follow, and how many followers do the largest accounts have?
- Chronological or ranked? (We'll design chronological; ranking is the feed-ranking problem in the ML track.)
- How quickly must a new post appear in followers' feeds?
- Do we include media? (Yes, but stored and served separately.)

## Requirements

**Functional**

- Publish a post (text plus links to uploaded media).
- Read the home feed: posts from followed accounts, newest first, 20 at a time, with scrolling to older posts.
- Follow and unfollow accounts.

**Non-functional**

- **Scale:** 200 million daily users; 10 feed opens and 0.5 posts per user per day; 200 followers on average, up to 100 million for the largest accounts.
- **Latency:** feed loads in under 200 ms at p99.
- **Freshness:** a post usually appears in followers' feeds within 5 seconds; up to a minute is acceptable under load.
- **Availability:** 99.95% for reading feeds. Feeds are :term[eventually consistent]{id="eventual-consistency"}: followers may briefly see a post at slightly different times.

## Back-of-envelope estimates

All inputs are assumptions.

| Quantity | Calculation | Result |
| --- | --- | --- |
| Feed reads | 200M × 10 = 2B per day | ~23,000 per second, ~70,000 at peak |
| New posts | 200M × 0.5 = 100M per day | ~1,200 per second, ~3,500 at peak |
| Fan-out inserts | 100M posts × 200 followers | 20B per day, ~230,000 per second |
| Timeline memory | 200M users × 800 post ids × 8 bytes | ~1.3 TB (before overhead and replicas) |
| Post storage | 100M × 1 KB | 100 GB per day, ~37 TB per year |
| Feed response traffic | 70,000 per second × 20 posts × 1 KB | ~1.4 GB/s at peak (media excluded) |

**What the numbers say:** reads outnumber posts 20 to 1, so make reads cheap. Fan-out on write turns 230,000 small, asynchronous inserts per second into 70,000 cheap feed reads, which is a good trade, except for huge accounts. Timelines fit in a memory cluster of a few dozen nodes. Media must go through object storage and a CDN.

## API design and data model

```http
POST /v1/posts          { "text": "…", "media_ids": ["m_91"] }        → 201 { "post_id": "1849…" }
GET  /v1/feed?limit=20&cursor=1849…                                     → 200 { "posts": [ … ], "next_cursor": "1848…" }
POST /v1/follows        { "followee_id": "u_42" }                       → 204
```

**Cursor pagination.** The cursor is the id of the last post returned. "Give me 20 posts older than this id" stays correct when new posts arrive at the top, unlike offset pagination, where new posts shift every page and cause duplicates.

**Data:**

- **Posts:** `post_id`, `author_id`, `text`, `media`, `created_at`. Post ids are time-sortable 64-bit numbers (timestamp first, Snowflake-style :term[distributed ID generation]{id="distributed-id-generation"}), so sorting by id sorts by time. Sharded by `post_id`.
- **Follow graph:** two indexes, `followers(author_id)` for fan-out and `following(user_id)` for reads, sharded by the first id.
- **Timelines:** in an in-memory store, one capped list per user of the newest ~800 post ids.

## High-level design

::diagram{id="news-feed-hld"}

**Publishing:** the post service stores the post, then emits a "post created" event onto a :term[queue]{id="message-queue"} and returns. Fan-out workers read the event, page through the author's followers, and prepend the post id to each follower's timeline list. The author's own timeline is updated synchronously, so they see their post immediately.

**Reading:** the feed service reads the user's timeline ids from the cache, merges in recent posts from any celebrities the user follows (see below), and loads the posts themselves with a batched lookup, mostly served from a post cache. It returns 20 posts and a cursor.

Media uploads go to object storage and are served through a CDN; posts only hold media ids.

## Deep dives

### Fan-out on write, on read, or both

::figure{id="fan-out-on-write" caption="Fan-out on write copies each new post id into every follower's timeline when it's published."}

| Approach | Reads | Writes | Problem |
| --- | --- | --- | --- |
| :term[Fan-out on read]{id="fan-out-on-read"} | Merge posts from ~200 followed accounts per open | One insert per post | 70,000 merges of 200 sources per second at peak |
| :term[Fan-out on write]{id="fan-out-on-write"} | One cache read per open | One insert per follower per post | Celebrities: one post becomes up to 100M inserts |
| **Hybrid** | One cache read, plus a small merge | One insert per follower, except for huge accounts | Slightly more complex read path |

The celebrity problem is a :term[hot spot]{id="hot-spot"} in write traffic. A post from an account with 50 million followers means 50 million inserts: at a few hundred thousand inserts per second, that's minutes of work, delaying everyone else's posts queued behind it.

**Hybrid:** accounts with more than ~100,000 followers are marked as celebrities and are **not** fanned out. Their recent posts are kept in a small per-author list in cache. At read time, the feed service asks the follow graph which celebrities this user follows (usually a handful), fetches their recent post ids, and merges them with the precomputed timeline. Because the merge involves only a few lists, it stays fast.

### Timelines in memory

- **Capped lists:** keep the newest ~800 ids per user. Scrolling beyond that falls back to fan-out on read for older posts, which is rare and allowed to be slower.
- **Ids, not posts:** timelines hold only ids, so editing or deleting a post needs no change to millions of timelines; deleted posts are filtered when posts are loaded.
- **Inactive users:** skip fan-out for users who haven't opened the app in, say, 30 days. When they return, rebuild their timeline on demand by fanning out on read once.
- **Partitioning:** shard timelines by user id; one feed read touches one shard.

### Freshness and fan-out lag

The time between posting and appearing in a follower's feed is the **fan-out lag**, and it's the number users notice. Keep it low by:

- Running enough workers to drain the queue faster than peak arrival; scaling workers on queue depth.
- Processing followers in parallel batches (for example, 1,000 followers per task), so one account with 90,000 followers doesn't serialize.
- Giving fan-out for active followers priority over inactive ones.

:::deeper[Why ranked feeds still use these pieces]
Most large apps rank feeds with a model instead of showing pure time order. The architecture above doesn't go away: precomputed timelines and celebrity merges become the **candidate generation** stage, producing a few hundred recent posts, and a ranking model then scores those candidates per request. Fan-out keeps candidate generation cheap; the ML track's feed ranking case study covers the ranking stage.
:::

## Trade-offs

| Decision | Alternative | Why this choice |
| --- | --- | --- |
| Hybrid fan-out | Pure write or pure read | Cheap reads for almost everyone, without celebrity write storms |
| Timelines of ids in memory | Store full posts per timeline | Small, cheap to update; edits and deletes stay simple |
| Asynchronous fan-out via a queue | Fan out inside the publish request | Posting stays fast; spikes are absorbed |
| Cursor pagination with time-sortable ids | Offset pagination | Stable pages while new posts arrive |
| Eventual consistency | Strongly consistent feeds | Seconds of delay are acceptable and far cheaper |

## Failure modes, scaling and monitoring

- **Fan-out backlog:** a burst of posts or a slow store grows the queue and delays posts. Autoscale workers on queue depth and age of the oldest message; shed fan-out to inactive users first.
- **Timeline cache shard lost:** its users' timelines are rebuilt from the follow graph and posts (fan-out on read). Replicate timeline shards so this is rare, and rate-limit rebuilds to protect the post store.
- **Celebrity misclassification:** an account crossing the threshold mid-post. Decide per post at publish time, and keep the merge path tolerant of duplicates.
- **Viral post:** one post read millions of times a minute is served from the post cache; replicate hot keys across cache nodes.
- **Unfollows and blocks:** filter at read time immediately; old entries age out of capped lists.

**Monitor:** feed latency (p50, p99), fan-out lag (p50, p99 from publish to delivery), queue depth, timeline cache hit rate and memory, rebuild rate, post store latency. Suggested SLOs: 99% of feeds load in under 200 ms; 99% of posts reach followers within 10 seconds.

## Real-world references

- Silberstein et al., *Feeding Frenzy: Selectively Materializing Users' Event Feeds* (SIGMOD 2010): chooses push or pull per producer–consumer pair based on their rates, the idea behind hybrid fan-out.
- Raffi Krikorian, *Timelines at Scale* (QCon talk on Twitter's timeline architecture): fan-out on write into in-memory timelines, with special handling for very large accounts.
- Twitter Engineering, *Announcing Snowflake* (2010): time-sortable 64-bit ids, used here for posts and cursors.

## 45-minute interview version

1. **Requirements (5 min):** publish, home feed newest first, follow; 200M daily users, 10 reads and 0.5 posts per user per day, 200 ms p99, posts visible within seconds.
2. **Estimates (4 min):** ~70,000 feed reads and ~3,500 posts per second at peak; 230,000 fan-out inserts per second; ~1.3 TB of timelines.
3. **API and data (4 min):** posts, follow graph both directions, cursor pagination with time-sortable ids.
4. **High-level design (8 min):** post service, queue, fan-out workers, timeline cache, feed service, object storage and CDN for media.
5. **Deep dives (16 min):** push versus pull versus hybrid with the celebrity numbers; capped timelines of ids; inactive users; fan-out lag.
6. **Failures (6 min):** backlog, cache shard loss and rebuild, viral posts; monitoring and SLOs.
7. **Wrap-up (2 min):** summarize; mention ranking as the natural next step.

:::interview
The interviewer is waiting for the celebrity problem. Introduce fan-out on write, do the arithmetic for an account with tens of millions of followers, and propose the hybrid yourself. Then show you've thought past the happy path: inactive users, deletes, and what happens when the timeline cache loses a shard.
:::

## Practice

::quiz{id="news-feed-quiz"}

::drill{id="news-feed-estimation"}
