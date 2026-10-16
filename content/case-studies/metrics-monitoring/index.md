---
slug: metrics-monitoring
title: Metrics and monitoring system
track: A
order: 15
difficulty: intermediate
summary: Ingest 10 million samples per second from 100,000 hosts, chart them in under a second and alert within a minute, using a compressed time-series store with rollups for old data.
concepts: [time-series-database, cardinality, append-only-log, hash-partitioning, replication, downsampling, object-storage, percentile, slo]
prerequisites: [message-queue]
estimatedMinutes: 3
status: outline
exercises: []
diagram: metrics-monitoring-hld
---

## Problem statement

Design a metrics and monitoring system in the style of Prometheus or Datadog: every host and service reports numbers such as CPU use, request rate and error count; engineers chart them on dashboards; and alert rules page someone when something goes wrong.

The workload is extreme on writes and unusual in shape. Millions of tiny data points arrive every second and are never updated, while reads are range queries that aggregate thousands of series at once. And the system must stay up exactly when everything else is failing, because that is when people need it most.

Questions to ask:

- How many hosts and services, how many metrics each, and how often are they collected?
- Do agents push data to us, or do we pull (scrape) it from them?
- How long do we keep data, and at what resolution?
- Can teams add labels with many values, such as user ids?
- How fast must an alert fire, and where do notifications go?
- Are logs and traces in scope? (No, metrics only.)

## Requirements

**Functional**

- Collect counters, gauges and histograms with labels (service, host, region, status code) from every host.
- Query any metric over a time range with filters and aggregations, for dashboards and ad hoc debugging.
- Evaluate alert rules continuously and send deduplicated notifications to pager, chat or email.
- Keep 10-second data for 15 days, 1-minute rollups for 90 days and 1-hour rollups for 2 years.

**Non-functional**

- **Scale:** 100,000 hosts with 1,000 active series each: 100 million series and 10 million samples per second.
- **Storage:** compressed to about 1.5 bytes per sample, raw data is about 1.3 TB per day and 20 TB for 15 days, before replication.
- **Query latency:** p99 under 1 second for a dashboard panel over the last 6 hours, and under 5 seconds over a year.
- **Alerting:** an alert fires within 1 minute of its condition becoming true.
- **Availability:** 99.99% for ingestion and alerting, 99.9% for dashboards; monitoring runs on infrastructure separate from the systems it watches.

## Key concepts

- :term[Time-series database]{id="time-series-database"}: points for one series arrive in time order and are never edited, so the store keeps recent points in memory, compresses each against its neighbor, and writes immutable 2-hour blocks.
- :term[Cardinality]{id="cardinality"}: every unique combination of label values is a separate series, so one careless label such as a user id can turn 1,000 series into millions; collectors enforce per-team limits.
- :term[Append-only log]{id="append-only-log"}: a durable, partitioned ingest log between collectors and storage absorbs bursts and lets a restarted storage node replay what it missed.
- :term[Hash partitioning]{id="hash-partitioning"}: series are spread across log partitions and storage nodes by a hash of their name and labels, so each node owns a stable slice of the 100 million series.
- :term[Replication]{id="replication"}: two storage nodes consume each partition, so losing one node loses no recent data and queries keep working.
- :term[Downsampling]{id="downsampling"}: a 1-hour rollup replaces 360 ten-second points, so a one-year chart reads about 8,760 points per series instead of over 3 million.
- :term[Object storage]{id="object-storage"}: older blocks and rollups live in cheap, durable object storage, so storage nodes need fast local disks only for recent data.
- :term[Percentiles]{id="percentile"}: latency is collected as histograms with fixed buckets, because p99s from different hosts can't be averaged, but bucket counts can be summed and a p99 computed from the total.
- :term[SLOs]{id="slo"}: alerting on how fast a service burns its error budget, rather than on every spike, pages people for problems users actually feel.

## High-level design

::diagram{id="metrics-monitoring-hld"}

1. An agent on each host scrapes local services every 10 seconds and sends batches to the collectors, which validate them, enforce cardinality limits and append them to the ingest log, partitioned by series hash.
2. Two storage nodes consume each partition. They keep the newest 2 hours of every series in memory, compressed, and every 2 hours write an immutable block to object storage.
3. A downsampler merges blocks and writes 1-minute and 1-hour rollups that keep the min, max, sum and count of each interval.
4. The query service sends each query to the storage nodes that own the matching series, which read older ranges from object storage. It merges the results and picks the coarsest resolution that still fills the chart.
5. The rule engine evaluates every alert rule every 30 seconds. Firing alerts go to the alert manager, which groups and deduplicates them, honors silences, and pages the on-call engineer.

The full version of this case study will cover the estimates, time-series compression, pull versus push collection, controlling label cardinality, and keeping alerting alive when the monitoring system itself is degraded.
