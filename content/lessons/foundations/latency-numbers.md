---
slug: latency-numbers
title: Latency numbers every engineer should know
phase: foundations
order: 6
summary: The rough cost of memory, disks and networks, why averages hide the pain, and how to budget time across a request.
estimatedMinutes: 12
concepts: [latency, throughput, bandwidth, percentile, tail-latency, latency-budget, hedged-request, round-trip-time]
exercises: [latency-budget]
---

If reading from memory took one second, reading from an SSD would take about a quarter of an hour and a round trip across an ocean would take more than two weeks. Computers hide these gaps so well that it's easy to forget them, until a design that "just reads from the database for each item" takes four seconds.

:::primer
- **Latency** is how long one thing takes: a request, a disk read, a network hop.
- **Throughput** is how many things finish per second.
- Units you'll meet: **ns** (nanosecond, a billionth of a second), **µs** (microsecond, a millionth), **ms** (millisecond, a thousandth).

You don't need exact numbers. You need the **order of magnitude**: is it nanoseconds, microseconds or milliseconds? That alone decides most designs.
:::

## The ladder

::figure{id="latency-scale" caption="Approximate latencies on a log scale. Each dashed line is 1,000 times slower than the one before."}

| Operation | Rough latency | Feels like, if memory took 1 s |
| --- | --- | --- |
| Read from CPU L1 cache | ~1 ns | a hundredth of a second |
| Read from main memory | ~100 ns | 1 second |
| Read 4 KB at random from an SSD | ~100 µs | about 17 minutes |
| Round trip inside one data centre | ~0.5 ms | about an hour and a half |
| Disk seek on a spinning hard drive | ~10 ms | about a day |
| Round trip across a continent or ocean | ~100–150 ms | about two weeks |

These are rounded, and hardware keeps improving, but the **ratios** have stayed roughly stable for years: memory is about a thousand times faster than an SSD, and a data-centre network hop costs about as much as several SSD reads. Long-distance round trips are bounded by the speed of light, so no hardware upgrade removes them.

**What this tells you:**

- Keep hot data **in memory** (that's what caches are for).
- Avoid **many sequential round trips**; batch or parallelize them.
- Serve users from **nearby** locations; you can't make the planet smaller.

## Latency and throughput are different

A highway can carry 2,000 cars per hour (throughput) while each car takes 30 minutes to drive it (latency). Adding lanes raises throughput but doesn't make any single trip shorter. Systems work the same way: more servers handle more requests per second, but they don't make a slow database call faster.

:term[Bandwidth]{id="bandwidth"} is a related limit: how much data a link can move per second. Sending a 10 MB file over a 100 Mbit/s link takes at least 0.8 seconds however short the round trip is.

## Averages lie: use percentiles

Suppose 99 requests take 20 ms and one takes 2 seconds. The average is about 40 ms, which looks fine, yet one user in a hundred waits two seconds. That's why we measure :term[percentiles]{id="percentile"}:

- **p50** (median): half the requests are faster than this.
- **p99:** 99% are faster; 1% are slower.
- **p99.9:** one in a thousand is slower.

The slow end is :term[tail latency]{id="tail-latency"}, and at scale it matters more than you'd think.

### Fan-out makes the tail everyone's problem

A search page asks 100 servers in parallel and waits for all of them. Each server is slow only 1% of the time. The chance that *at least one* is slow is:

1 − 0.99¹⁰⁰ ≈ 1 − 0.366 ≈ **63%**

Most page loads now hit someone's p99. The more servers a request touches, the more your *system's* median is set by your *components'* tail.

## Budgeting latency

A :term[latency budget]{id="latency-budget"} splits the total time you can afford across the steps of a request. Say checkout must answer within 300 ms:

| Step | Budget |
| --- | --- |
| Gateway and authentication | 30 ms |
| Inventory and pricing, called **in parallel** | 100 ms |
| Database write | 50 ms |
| Network and margin | 120 ms |

Two rules make budgets work:

1. **Sequential steps add; parallel steps take the maximum.** Calling inventory (80 ms) and pricing (50 ms) one after another costs 130 ms; in parallel it costs 80 ms.
2. **Budget against percentiles, not averages.** If every step meets its budget at p50, the whole request will blow it at p99.

:::tip
Every downstream call should have a **timeout** shorter than its budget. A call with no timeout can hold a request (and a thread) for minutes.
:::

:::deeper[Taming the tail: hedged requests and friends]
Google engineers described a family of tail-tolerant techniques in the paper "The Tail at Scale" (Dean and Barroso, 2013). The best known is the :term[hedged request]{id="hedged-request"}: send the request to one replica, and if no answer arrives within, say, the p95 latency, send a second copy to another replica and use whichever answers first. Because only about 5% of requests trigger a hedge, the extra load is small, but the p99.9 drops sharply.

Related ideas:

- **Tied requests:** send to two replicas at once, and let the first one to *start* the work tell the other to cancel.
- **Micro-partitioning:** split work into many small pieces so a slow machine can shed pieces to others quickly.
- **Good enough results:** for search, return results from the servers that answered in time instead of waiting for the last one.

Hedging only works for requests that are safe to send twice: reads, or writes protected by idempotency.
:::

:::interview
Quote orders of magnitude, not exact figures: "A memory read is ~100 ns, an SSD read ~100 µs, a cross-region round trip ~100 ms, so the cache saves three orders of magnitude." When you propose fan-out to many servers, mention tail latency and how you'd contain it: timeouts, hedging, or partial results.
:::

## Key takeaways

- Memory is nanoseconds, SSDs are microseconds, networks are milliseconds; long distances cost ~100 ms.
- Latency (time per request) and throughput (requests per second) are different levers.
- Measure percentiles; averages hide the slow requests users notice.
- Fan-out turns rare slowness into common slowness.
- Budget latency per step: sequential steps add, parallel steps take the maximum.

::drill{id="latency-budget"}
