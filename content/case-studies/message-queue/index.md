---
slug: message-queue
title: Distributed message queue
track: A
order: 14
difficulty: advanced
summary: Move 500,000 messages per second to many consumer groups with per-key ordering and no loss of acknowledged writes, using partitioned, replicated append-only logs.
concepts: [append-only-log, hash-partitioning, leader-follower, in-sync-replicas, raft, consumer-group, pub-sub, at-least-once, exactly-once, object-storage]
prerequisites: [key-value-store, notification-system]
estimatedMinutes: 4
status: outline
exercises: []
diagram: message-queue-hld
---

## Problem statement

Design a distributed message queue in the style of Apache Kafka: producers publish messages to named topics, and any number of independent consumer applications read them, each at its own pace, with messages kept for days so a consumer can replay them.

The hard part is doing three things at once: very high throughput, no loss of acknowledged messages when a server dies, and a useful ordering guarantee. One machine can't carry the load, but spreading messages across machines breaks global ordering, and every copy made for safety adds latency to each write.

Questions to ask:

- Classic queue (each message processed once, then deleted) or a log that many consumer groups read and replay? (A log.)
- How many messages per second, and how large are they?
- Do consumers need one global order, or only an order per key, such as per user or per order?
- Which delivery guarantee: at most once, at least once, or exactly once?
- How long must messages be kept?

## Requirements

**Functional**

- Create topics split into a chosen number of partitions.
- Publish messages with an optional key; messages with the same key keep their order.
- Read through consumer groups: every group sees every message, and the members of a group share the work.
- Commit progress, and replay from an earlier offset or timestamp.
- Delete messages after a retention period.

**Non-functional**

- **Scale:** 500,000 messages per second at peak and 250,000 on average, 1 KB each (500 MB/s in at peak); each message is read by 3 consumer groups (1.5 GB/s out at peak).
- **Retention:** 7 days, about 150 TB per copy at the average rate and 450 TB with three replicas.
- **Latency:** p99 under 20 ms to acknowledge a fully replicated write, and under 100 ms from publish to delivery.
- **Durability:** an acknowledged message survives the loss of any one broker.
- **Availability:** when a broker fails, its partitions get new leaders within a few seconds.

## Key concepts

- :term[Append-only log]{id="append-only-log"}: each partition is a series of segment files that only grow at the end, so writes are sequential disk I/O and reads are cheap lookups by offset, often straight from the page cache.
- :term[Hash partitioning]{id="hash-partitioning"}: the producer picks a partition by hashing the message key, so all messages for one key land in one partition, in order, while the load spreads across brokers.
- :term[Leader-follower replication]{id="leader-follower"}: each partition has a leader that takes all writes and two followers on other brokers that copy its log in the same order.
- :term[In-sync replicas]{id="in-sync-replicas"}: a write is acknowledged only when every caught-up replica has it, and the partition refuses writes if fewer than 2 are caught up, so losing one broker never loses an acknowledged message.
- :term[Raft]{id="raft"}: a small controller quorum stores the cluster metadata and decides which broker leads each partition, so failover doesn't depend on any single controller.
- :term[Consumer groups]{id="consumer-group"}: each partition is read by one member of a group at a time, so the partition count caps a group's parallelism, and the group's committed offsets record how far it has processed.
- :term[Pub/sub]{id="pub-sub"}: separate groups read the same log independently, so a new consuming application costs no extra writes.
- :term[At-least-once delivery]{id="at-least-once"}: a consumer that crashes after processing but before committing its offset sees those messages again, so handlers must tolerate duplicates.
- :term[Exactly-once processing]{id="exactly-once"}: idempotent producers, plus transactions that commit output messages and input offsets together, give exactly-once results for pipelines that read from and write back to the queue.
- :term[Object storage]{id="object-storage"}: older segments move to object storage, so brokers keep only recent data on local disk and retention can grow cheaply.

## High-level design

::diagram{id="message-queue-hld"}

1. A producer hashes each key to a partition, groups messages into batches of up to a few hundred KB, and sends each batch to the partition's leader, which it finds from cluster metadata.
2. The leader appends the batch to its active segment. Followers fetch new data from the leader and append it in the same order. Once every in-sync replica has the batch, it is committed: the leader acknowledges the producer, and consumers can read it.
3. Each consumer in a group is assigned some partitions. It fetches from its last committed offset, processes the messages and commits the new offset back to the cluster.
4. The controller quorum watches broker heartbeats. When a leader stops responding, it promotes an in-sync follower within seconds, and clients refresh their metadata and carry on.
5. Segments older than 7 days are deleted, or tiered to object storage when longer retention is needed.

The full version of this case study will cover the estimates, choosing partition counts, leader election and the in-sync replica set, consumer group rebalancing, and exactly-once pipelines with idempotent producers and transactions.
