---
slug: key-value-store
title: Distributed key-value store
track: A
order: 3
difficulty: advanced
summary: Store billions of keys across hundreds of nodes with single-digit-millisecond reads and writes, staying available when nodes fail by replicating with tunable quorums.
concepts: [key-value-store, consistent-hashing, virtual-nodes, replication, quorum, leaderless, vector-clock, gossip-protocol, hinted-handoff, merkle-tree, lsm-tree]
prerequisites: [url-shortener]
estimatedMinutes: 4
status: outline
exercises: []
diagram: key-value-store-hld
---

## Problem statement

Design a distributed key-value store in the style of Amazon's Dynamo or Apache Cassandra: clients `put` and `get` small values by key, and the store spreads the data over many machines so it can grow without limit and keep serving when some of them fail.

The hard part is not storing bytes. It's deciding **which nodes own each key**, keeping **copies in sync** without a single leader, and choosing what a read returns when replicas disagree.

Questions to ask:

- How big are keys and values, and how many keys in total?
- What's the read-to-write ratio, and what latency is expected?
- Is it acceptable for a read to briefly return an older value, or must every read see the latest write?
- Must the store keep accepting writes during a network partition?
- Do we need range scans, or only single-key lookups?

## Requirements

**Functional**

- `put(key, value)` and `get(key)` for keys up to 256 bytes and values up to 1 MB.
- `delete(key)`.
- Per-request consistency level: read or write from one replica, a quorum, or all.

**Non-functional**

- **Scale:** 10 billion keys, about 100 TB before replication; 1 million operations per second at peak.
- **Latency:** p99 under 10 ms for reads and writes within one region.
- **Availability:** writes keep succeeding when any one node, or one rack, is down.
- **Durability:** three replicas of every key, placed on different racks.
- **Elasticity:** add or remove nodes without downtime, moving only a small share of the data.

## Key concepts

- :term[Consistent hashing]{id="consistent-hashing"} with :term[virtual nodes]{id="virtual-nodes"}: maps each key to a position on a ring, so adding a node moves only about 1/N of the keys, and spreads load evenly across machines of different sizes.
- :term[Leaderless replication]{id="leaderless"}: each key is copied to the next three nodes on the ring, and any of them can accept writes.
- :term[Quorums]{id="quorum"}: with N = 3 copies, writing to W = 2 and reading from R = 2 makes every read overlap the latest write, because R + W > N.
- :term[Vector clocks]{id="vector-clock"}: detect when two replicas accepted conflicting writes, so the conflict can be resolved instead of silently lost.
- :term[Hinted handoff]{id="hinted-handoff"}: when a replica is down, a neighbor holds its writes and delivers them later, keeping writes available.
- :term[Merkle trees]{id="merkle-tree"}: let two replicas find the few keys that differ by comparing hashes, instead of comparing every key.
- :term[Gossip]{id="gossip-protocol"}: nodes share membership and health with a few random peers each second, so the cluster agrees on who is alive without a central coordinator.
- :term[LSM trees]{id="lsm-tree"}: each node stores data in an append-friendly structure that turns random writes into sequential disk writes.

## High-level design

::diagram{id="key-value-store-hld"}

1. A client sends a request to any node, or to a thin routing layer that knows the ring. That node becomes the **coordinator** for the request.
2. The coordinator hashes the key to find its three replicas and sends the operation to all of them, replying once W (for writes) or R (for reads) have answered.
3. Each storage node writes to a commit log, then to an in-memory table that is flushed to sorted files on disk and compacted in the background.
4. Gossip spreads cluster membership; hinted handoff and periodic Merkle-tree repair bring lagging replicas back in sync.

The full version of this case study will cover the estimates, the API, conflict resolution with vector clocks versus last-write-wins, read repair, and a 45-minute interview talk track.
