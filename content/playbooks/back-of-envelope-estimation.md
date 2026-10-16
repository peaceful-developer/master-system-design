---
slug: back-of-envelope-estimation
title: Back-of-envelope estimation playbook
order: 2
summary: A step-by-step routine and a one-page cheat sheet for sizing any system in under five minutes, with worked bandwidth and cache-size estimates.
estimatedMinutes: 14
concepts: [back-of-envelope-estimation, qps, daily-active-users, peak-factor, bandwidth, cache-hit-rate]
exercises: [bandwidth-estimation-1]
---

The [estimation lesson](/learn/building-blocks/back-of-envelope-estimation) explains why rough numbers matter and how the arithmetic works. This playbook is the routine to run every time, plus a cheat sheet to keep beside you while practising. Use it until the steps feel automatic.

:::primer
Estimation turns "lots of users" into numbers you can design with: requests per second, gigabytes per day, megabytes per second. Round aggressively, write down every assumption, and finish each number with what it means for the design.
:::

## The routine

### 1. Write down the assumptions

Two or three lines, out loud:

- :term[Daily active users]{id="daily-active-users"} (DAU).
- What each user does per day, split into **reads** and **writes**.
- Object sizes: how big is a post, a photo, a message, a response?

If the interviewer gives numbers, use them. If not, pick round ones and say so: "Let's assume 10 million DAU; tell me if you have a different number in mind."

### 2. Traffic

> requests per second = DAU × actions per user per day ÷ 100,000

(100,000 stands in for 86,400 seconds; answers come out about 14% low, which is fine.)

Do reads and writes separately, then multiply by a :term[peak factor]{id="peak-factor"} of 2–3×.

### 3. Storage

> storage per day = new items per day × size per item

Then multiply by the retention period and by the number of copies (usually 3). Add a margin for indexes and metadata.

### 4. Bandwidth

> :term[bandwidth]{id="bandwidth"} = requests per second × bytes per response

Do it for ingress (uploads) and egress (downloads) separately. Egress is usually far bigger, and it's what a CDN takes off your hands.

### 5. Memory for caching

A useful rule of thumb: a small share of items gets most of the traffic. Cache the hot set:

> cache size ≈ daily read volume in bytes × share of items that are hot

Then sanity-check: does it fit in the memory of a few machines?

### 6. Say what it means

Each number should end in a decision:

- "18,000 reads per second at peak: one database can't take that, so cache aggressively."
- "500 GB per day of photos: object storage, not the database."
- "4 Gbit/s of image egress: serve images through a CDN."

## Cheat sheet

| Quantity | Value to remember |
| --- | --- |
| Seconds in a day | 86,400 ≈ 100,000 |
| 1 million per day | ≈ 12 per second |
| 1 billion per day | ≈ 12,000 per second |
| Seconds in a year | ≈ 30 million |
| 1 KB, 1 MB, 1 GB, 1 TB, 1 PB | 10³, 10⁶, 10⁹, 10¹², 10¹⁵ bytes |
| A short text record with metadata | ~1 KB |
| A compressed photo | 200 KB to 2 MB |
| One minute of HD video at 5 Mbit/s | ~40 MB |
| 1 Gbit/s | 125 MB/s |
| Typical peak factor | 2–3× average |
| Replication factor | 3 copies |

## Worked example: images for a social app

**Assumptions:** 20 million DAU. Each user views 30 images a day and uploads 0.2. Viewed images are 200 KB on average after resizing; originals are 2 MB.

- **Views:** 20M × 30 = 600 million per day ≈ **6,000 per second** (7,000 using 86,400), so about **20,000 per second** at peak.
- **Egress:** 7,000 per second × 200 KB ≈ **1.4 GB/s**, about 11 Gbit/s on average. That rules out serving images from the app servers: a CDN is required.
- **Uploads:** 20M × 0.2 = 4 million per day × 2 MB = **8 TB per day** of originals, about **3 PB per year** before replication.
- **Cache:** if the hottest 10% of a day's viewed bytes are cached: 600M × 200 KB = 120 TB viewed a day, so ~12 TB of hot data. That belongs in a CDN, not an in-memory cache.

Each line pointed at a design choice: CDN, object storage, and where the cache really lives.

## Checklist

- [ ] Assumptions stated: DAU, actions per user, object sizes
- [ ] Reads and writes estimated separately, with a peak factor
- [ ] Storage includes retention and replication
- [ ] Egress bandwidth estimated, and CDN considered
- [ ] Cache size compared with what fits in memory
- [ ] Every number ends with a decision

## Common mistakes

- **Mixing bits and bytes.** Network speeds are in bits per second; 1 Gbit/s is 125 MB/s.
- **Forgetting replication and indexes.** Raw data × 3 copies × 1.5 for indexes is a common real-world multiplier.
- **False precision.** "11,574.07 requests per second" wastes time; "about 12,000" is better.
- **Estimating without concluding.** A number that doesn't change the design is a number you didn't need.
- **Sizing for the average.** Systems fall over at the peak, so design for it.

::drill{id="bandwidth-estimation-1"}
