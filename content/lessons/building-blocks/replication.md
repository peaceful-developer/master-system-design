---
slug: replication
title: Replication
phase: building-blocks
order: 3
summary: Keeping copies of data on several machines for safety and read capacity, and the surprises replication lag and failover bring.
estimatedMinutes: 13
concepts: [replication, leader-follower, multi-leader, leaderless, replication-lag, read-your-writes, failover, quorum, single-point-of-failure]
exercises: [replication-quiz]
---

A database that lives on one machine dies with that machine. Replication keeps copies of the same data on several machines, so you can survive failures, serve more reads, and put data closer to users. The price is that copies can disagree, at least for a moment.

:::primer
**Replication** means keeping the same data on more than one machine.

It gives you three things:

1. **Durability:** a disk dies and the data survives elsewhere.
2. **Availability:** a machine dies and another takes over.
3. **Read capacity:** many copies can answer reads in parallel.

The hard part is keeping the copies in agreement when data changes.
:::

## Leader–follower replication

The most common setup is :term[leader–follower]{id="leader-follower"} (also called primary–replica):

- One **leader** accepts all writes.
- It streams every change to **followers** (replicas), which apply them in the same order.
- Reads can go to the leader or any follower.

::figure{id="leader-follower-replication" caption="Writes go to the leader; followers receive the changes a moment later."}

This suits read-heavy systems well. If 90% of traffic is reads, adding followers adds read capacity, while the leader handles the writes.

## Synchronous or asynchronous?

When the leader receives a write, when does it tell the client "done"?

- **Synchronous:** after at least one follower confirms it has the change. If the leader then dies, no acknowledged write is lost, but every write waits for a network round trip, and a slow follower slows everyone.
- **Asynchronous:** immediately, and followers catch up afterwards. Writes are fast, but if the leader dies before followers catch up, recently acknowledged writes can be lost.

Many systems compromise: one follower is synchronous (so there's always an up-to-date copy) and the rest are asynchronous.

## Replication lag and its surprises

With asynchronous followers there's always some :term[replication lag]{id="replication-lag"}, usually milliseconds, sometimes seconds or more under load. That creates odd user experiences:

**Reading your own writes.** You update your profile name, the page reloads from a follower that hasn't received the change yet, and your old name is back. Users report this as "my change didn't save". To guarantee :term[read-your-writes]{id="read-your-writes"}:

- read a user's own data from the leader for a short time after they write it, or
- remember the position of their last write and only read from followers that have reached it.

**Moving backwards in time.** Two refreshes hit two followers with different lag, and a new comment appears, then disappears. Routing each user to the same follower (for example, by hashing their user id) keeps their view monotonic.

## Failover

When the leader dies, a follower must be promoted. That's :term[failover]{id="failover"}, and it's harder than it sounds:

1. **Detecting failure:** is the leader dead, or just slow? Timeouts that are too short cause needless failovers; too long means longer outages.
2. **Choosing a new leader:** usually the most up-to-date follower. Asynchronous writes it didn't receive are lost.
3. **Redirecting writes** to the new leader, and stopping the old one if it comes back.

The nightmare case is **split brain**: the old leader wasn't dead, just cut off, and now two leaders accept conflicting writes. Systems prevent this with a majority vote (a node can only lead if most nodes agree) and by fencing off the old leader so its writes are rejected.

## Multi-leader replication

With :term[multi-leader replication]{id="multi-leader"}, several nodes accept writes, typically one leader per region so each region writes locally with low latency. Leaders exchange changes asynchronously.

The new problem is **write conflicts**: two regions edit the same record at the same moment. Resolution options include last write wins (simple, but silently drops one write), merging the changes field by field, or data types designed to merge automatically. Use multi-leader when local write latency matters enough to deal with conflicts.

## Leaderless replication

In :term[leaderless replication]{id="leaderless"}, clients write to several replicas directly and read from several replicas, then take the newest value. Dynamo-style databases such as Cassandra and Riak work this way.

The rule that makes it work is the :term[quorum]{id="quorum"}. With **N** replicas, write to **W** of them and read from **R** of them. If **R + W > N**, every read overlaps at least one replica that saw the latest write.

| N | W | R | Effect |
| --- | --- | --- | --- |
| 3 | 2 | 2 | Balanced: tolerates one slow or failed replica for both reads and writes |
| 3 | 3 | 1 | Fast reads, but a write fails if any replica is down |
| 3 | 1 | 1 | Fast and available, but reads may be stale (R + W = 2, not > 3) |

:::deeper[Sloppy quorums and repairing replicas]
Strict quorums can make writes fail during a network problem even though *some* machines are reachable. Amazon's Dynamo paper (2007) described a **sloppy quorum**: if some of a key's home replicas are unreachable, the write goes to other healthy nodes temporarily, with a note to hand it back (**hinted handoff**) when the home replicas recover. Availability goes up, but R + W > N no longer guarantees you read the newest write until the handoff completes.

Leaderless systems also need ways to bring stale replicas up to date:

- **Read repair:** when a read sees an older value on one replica, it writes the newer value back.
- **Anti-entropy:** a background process compares replicas (often using Merkle trees, so only differing ranges need transferring) and fixes differences.

Concurrent writes to the same key are detected with version vectors, and the database either keeps both versions for the application to merge or applies a rule such as last write wins.
:::

:::interview
When a database appears in your design, say how it's replicated and what that means for reads: "Leader with two async followers; reads go to followers, except a user's own profile right after an edit, which reads from the leader to keep read-your-writes." Then mention failover: "Automatic failover with a majority vote to avoid split brain; we may lose up to a second of async writes." Naming the trade-off is the point.
:::

## Key takeaways

- Replication copies data for durability, availability and read capacity.
- Leader–follower is the common default; synchronous replicas trade write speed for safety.
- Replication lag causes stale reads; fix the cases users notice, like reading your own writes.
- Failover needs careful failure detection and protection against split brain.
- Multi-leader adds write conflicts; leaderless systems use quorums with R + W > N.

::quiz{id="replication-quiz"}
