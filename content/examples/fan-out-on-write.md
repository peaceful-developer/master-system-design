---
slug: fan-out-on-write
title: Fan-out on write for news feeds
summary: Precompute every user's feed by pushing each new post into followers' timelines when it's published, so reading a feed is a single cache lookup; and how to handle celebrities.
concepts: [fan-out-on-write, fan-out-on-read, message-queue, caching, hot-spot]
tags: [feeds, social, write-amplification]
diagram: fan-out-on-write
---

## The problem

A social app has 200 million daily users who open their home feed about ten times a day: roughly 23,000 feed reads per second on average, and several times that at peak. A feed shows recent posts from everyone you follow, in time order.

The simplest approach, building the feed when it's opened, means querying the recent posts of every account the reader follows (often hundreds), merging them and sorting. Doing that 70,000 times a second at peak, under a latency target of about 200 ms, is very expensive.

## The pattern

:term[Fan-out on write]{id="fan-out-on-write"} moves the work from read time to write time. Posting is rare compared with reading, so pay the cost once per post:

1. The author publishes; the post service saves the post and emits a "post created" event to a :term[queue]{id="message-queue"}.
2. Fan-out workers look up the author's followers.
3. For each follower, they prepend the post id to that follower's **timeline**: a short, capped list (say the latest 800 ids) kept in a cache.
4. Opening a feed reads the timeline ids from the cache and loads the posts, usually also cached, in one batch.

::diagram{id="fan-out-on-write"}

::figure{id="fan-out-on-write" caption="One post is copied into each follower's timeline when it's published, so each read is a simple lookup."}

## The numbers

Suppose users post 500 million times a day and have 200 followers on average. Fan-out performs 500M × 200 = **100 billion timeline inserts per day**, about 1.2 million per second. That sounds like a lot, but each insert is a tiny, cheap append to an in-memory list, they happen asynchronously off the queue, and workers scale horizontally. In exchange, every one of the ~70,000 peak feed reads per second becomes a single key lookup.

## The celebrity problem

Averages hide the :term[hot spot]{id="hot-spot"}. An account with 50 million followers turns one post into 50 million inserts, which takes minutes and floods the workers.

The usual fix is a **hybrid**:

- Accounts with up to, say, 100,000 followers: fan out on write as above.
- Celebrity accounts: **don't** fan out. At read time, merge the reader's precomputed timeline with recent posts from the few celebrities they follow (:term[fan-out on read]{id="fan-out-on-read"} for just those accounts).

Readers follow only a handful of celebrities, so the read-time merge stays small.

## When to use it

- Read-heavy feeds where reads vastly outnumber posts.
- When feeds must load fast, and a few seconds of delay before a post appears everywhere is acceptable.
- When most accounts have modest follower counts.

## When not to use it

- **Few readers per post, or feeds rarely read:** precomputing timelines nobody opens wastes work. Fan out on read instead.
- **Strict real-time ordering across everything:** asynchronous fan-out means followers see a post at slightly different times.
- **Heavily ranked feeds:** if every feed is re-ranked by a model per request, the precomputed timeline becomes a candidate list rather than the final feed; that works, but plan for it.

## Pitfalls and fixes

- **Inactive users:** skip fan-out for accounts that haven't logged in for weeks, and rebuild their timeline on demand when they return.
- **Deletes and edits:** store post ids, not post content, in timelines, so a deleted post can be filtered when posts are loaded.
- **Unfollows:** filter at read time, and let old entries age out of the capped list.
- **Backlog during spikes:** watch the queue depth; fan-out lag is the number users notice ("my post took a minute to show up").

## Related

- Lesson: [Queues and pub/sub](/learn/building-blocks/queues-and-pub-sub) explains the asynchronous fan-out machinery.
- Lesson: [Caching and CDNs](/learn/building-blocks/caching-and-cdns) covers where timelines live.
