---
slug: back-of-envelope-estimation
title: Back-of-envelope estimation
phase: building-blocks
order: 8
summary: Turning users and actions into requests per second, storage and bandwidth with rounded numbers, and using the results to make design decisions.
estimatedMinutes: 18
concepts: [back-of-envelope-estimation, qps, daily-active-users, peak-factor, littles-law, throughput]
exercises: [qps-estimation-1, storage-estimation-1]
---

Does this fit on one database, or do we need sharding? Do we need a CDN? How much cache? You can't answer those by feel. A two-minute calculation with rounded numbers usually can, and it often changes the design: a feature that sounded huge turns out to need one machine, or a "small" log turns out to be petabytes. This lesson teaches the arithmetic and the habits that make it quick.

:::primer
A **back-of-envelope estimate** is a quick calculation with rounded numbers, the kind you could do on the back of an envelope.

- The goal is the right **order of magnitude**: is it 100 requests per second or 100,000?
- Being off by 20% doesn't matter. Being off by 100× does.
- Always say your assumptions out loud, so others can check them.
:::

## Numbers worth remembering

### Time

There are **86,400 seconds in a day**. For quick math, call it 100,000. Your answers come out about 14% low, which is fine for an estimate, and the division becomes trivial.

| Per day | Average per second |
| --- | --- |
| 1 million | ~12 |
| 10 million | ~120 |
| 100 million | ~1,200 |
| 1 billion | ~12,000 |

A month is about 2.6 million seconds and a year about 31.5 million (say 30 million).

### Data sizes

We use powers of ten: 1 KB = 1,000 bytes, 1 MB = a million, 1 GB = a billion, 1 TB = a trillion, 1 PB = a thousand TB. (The powers-of-two versions differ by a few percent, which doesn't matter here.)

| Thing | Rough size |
| --- | --- |
| A number, id or timestamp | 8 bytes |
| A short text post with its metadata | ~1 KB |
| A compressed photo | 200 KB to 2 MB |
| One minute of HD video at 5 Mbit/s | ~40 MB |

### What one machine can do

These are **rough orders of magnitude** for planning; real numbers depend heavily on the work per request, so measure your own.

- An application server: hundreds to a few thousand requests per second.
- A relational database: thousands to tens of thousands of simple queries per second.
- An in-memory cache node: around 100,000 simple operations per second.
- One server: hundreds of GB of memory, tens of TB of disk, 10 Gbit/s or more of network.

## The method

Go through the same steps every time.

1. **Assumptions.** :term[Daily active users]{id="daily-active-users"} (DAU) and what each does per day. Write them down.
2. **Traffic.** Requests per day, then average requests per second (:term[QPS]{id="qps"}), then peak.
3. **Storage.** Size per item × items per day × days kept × number of copies.
4. **Bandwidth.** Requests per second × bytes per request.
5. **Decide.** What do the numbers mean for the design?

### Peaks

Traffic isn't flat. Evenings are busier than nights, and launches or sales create spikes. Multiply the average by a :term[peak factor]{id="peak-factor"}, typically **2–3×** for daily cycles, more for spiky events. Size the system for the peak, not the average.

## A worked example: a photo-sharing app

**Assumptions:** 10 million DAU. Each user views 50 photos a day and uploads one photo every 10 days. A stored photo is 500 KB; views mostly load a 100 KB resized version. Peak is 3× average. Photos are kept forever with 3 copies.

**Traffic:**

- Views: 10 million × 50 = 500 million per day. 500 million ÷ 86,400 ≈ **5,800 per second** on average, about **17,000 per second** at peak.
- Uploads: 10 million × 0.1 = 1 million per day ≈ **12 per second**.
- Reads outnumber writes by 500 to 1. Caching and read replicas will matter far more than write throughput.

**Storage:**

- 1 million photos × 500 KB = **500 GB per day**.
- × 365 ≈ **180 TB per year**, × 3 copies ≈ **550 TB per year**.
- That's far beyond one machine, so photos go in an object store, with only metadata in the database: 1 million rows a day of ~1 KB is just 1 GB a day.

**Bandwidth:**

- 5,800 views per second × 100 KB ≈ **580 MB/s** on average, about 4.6 Gbit/s, and roughly three times that at peak.
- That's a strong case for a CDN, which serves most of those bytes from close to users.

**Servers:** if one app server handles about 1,000 view requests per second at your latency target, the 17,000 per second peak needs 17 servers. Run them at 50–70% utilization to leave headroom and survive losing a zone, and you're at roughly 25–35.

Notice how each number pointed at a decision: object storage, a CDN, read-optimized caching, a modest fleet of app servers.

:::tip
Carry units through every step, as in "requests/day ÷ seconds/day = requests/second". If the units at the end don't match what you wanted, the calculation is wrong somewhere.
:::

## Little's law: how many are in flight?

:term[Little's law]{id="littles-law"} connects rate, time and concurrency for any stable system:

> requests in progress = arrival rate × time each request spends inside

If requests arrive at 2,000 per second and each takes 50 ms, then on average 2,000 × 0.05 = **100 requests** are in progress at once. That tells you how many threads, connections or database sessions you need.

It works for anything that flows: 10 support tickets per hour that take 3 hours each means about 30 open tickets at any time.

:::deeper[Why systems slow down long before 100% busy]
Little's law describes the average; queueing theory explains what happens as a server gets busy. In the simplest model (requests arriving at random and a single server; the M/M/1 queue), the average time a request spends in the system is:

> time in system = service time ÷ (1 − utilization)

With a 10 ms service time:

| Utilization | Average time in system |
| --- | --- |
| 50% | 20 ms |
| 80% | 50 ms |
| 90% | 100 ms |
| 95% | 200 ms |

Going from 50% to 95% busy multiplies the average time by 10, and tail latency grows even faster. Real systems aren't exactly M/M/1, but the shape holds: latency explodes as you approach full utilization. That's why capacity plans aim for well under 100%, and why a small traffic increase can suddenly make a busy system very slow.
:::

## Habits that keep estimates honest

- **Round hard.** 86,400 becomes 100,000; 365 becomes 400 if it helps. Keep one or two significant digits.
- **Sanity-check against things you know.** If your answer says a photo app needs less storage than a laptop, something is off.
- **Separate reads and writes.** They usually differ by 10–1,000×, and they drive different parts of the design.
- **Remember replication and overhead.** Indexes, copies and metadata can double or triple raw storage.

:::interview
Spend two or three minutes on :term[estimation]{id="back-of-envelope-estimation"} early, then refer back to it. Say the assumptions, compute traffic, storage and bandwidth, and finish each with a decision: "17,000 reads per second at peak, so we cache aggressively and serve images through a CDN." Interviewers care less about the exact numbers than about whether you use them.
:::

## Key takeaways

- Aim for the right order of magnitude, with assumptions stated out loud.
- 86,400 seconds a day: 1 million per day is about 12 per second.
- Follow the same steps: assumptions, traffic and peak, storage with copies, bandwidth, decisions.
- Little's law gives concurrency: rate × time in system.
- Latency climbs steeply as utilization approaches 100%, so plan for headroom.

Try two estimates yourself.

::drill{id="qps-estimation-1"}

::drill{id="storage-estimation-1"}
