---
slug: consistency-cap-pacelc
title: Consistency, CAP and PACELC
phase: building-blocks
order: 6
summary: What "consistent" means when data has copies, the CAP and PACELC trade-offs explained plainly, and how majority-based consensus keeps replicas in agreement.
estimatedMinutes: 14
concepts: [strong-consistency, eventual-consistency, causal-consistency, linearizability, network-partition, cap-theorem, pacelc, consensus, raft]
exercises: [consistency-quiz]
---

You transfer money to a friend. Your app shows the new balance, but your friend's app, reading from another replica, still shows nothing. Is the system broken? Not necessarily. It depends on which promise the system makes about its copies. This lesson gives you the words for those promises and the trade-offs behind them, so you can choose deliberately instead of by accident.

:::primer
Once data has copies (replicas), they can briefly disagree. A **consistency model** is the promise a system makes about what readers can see while that happens.

- **Strong** promise: every read sees the latest write, as if there were only one copy.
- **Weak** promise: reads might be a little behind, but copies catch up.

Stronger promises are easier to program against but cost speed and availability.
:::

## A spectrum of promises

**:term[Strong consistency]{id="strong-consistency"}.** Once a write completes, every later read, from any client, sees it. The precise version is called :term[linearizability]{id="linearizability"}: the system behaves as if there were a single copy and every operation happened at one instant. It's what most people intuitively expect, and the most expensive to provide.

**:term[Causal consistency]{id="causal-consistency"}.** Operations that depend on each other are seen in order by everyone. If Bea replies to Ali's comment, nobody sees the reply without the comment. Unrelated operations may appear in different orders to different people.

**:term[Eventual consistency]{id="eventual-consistency"}.** If writes stop, all copies eventually agree. Until then, a read may return an older value. It's cheap, fast and highly available, and it's fine for a surprising amount of data.

In between sit the session guarantees from the replication lesson, like reading your own writes and never seeing time go backwards. They fix the anomalies users notice most, without paying for full strong consistency.

| Model | Promise | Good fit |
| --- | --- | --- |
| Strong (linearizable) | Every read sees the latest write | Account balances, unique usernames, locks |
| Causal | Cause is seen before effect | Comments and replies, chat |
| Eventual | Copies converge if writes stop | Like counts, view counts, feeds |

## Network partitions

Machines talk over networks, and networks fail. A :term[network partition]{id="network-partition"} is when some nodes can't reach others, even though all of them are still running. A cable is cut, a switch misbehaves, a cloud zone loses connectivity. From inside, a partition looks just like the other nodes being dead or slow; you can't tell which.

Partitions are rare but certain. Any system spread over a network will eventually face one, so the real question is what it does when that happens.

## The CAP theorem

::figure{id="cap-tradeoffs" caption="During a partition, a system either refuses some requests (consistency) or answers them all and lets data diverge (availability)."}

The :term[CAP theorem]{id="cap-theorem"} says that when a network partition happens, a replicated system must choose one of:

- **Consistency (C):** every read sees the latest write. To guarantee that, nodes that can't confirm they're up to date must refuse requests, so some users get errors.
- **Availability (A):** every request to a running node gets an answer. Nodes on both sides keep working, so their data can diverge and must be reconciled later.

You can't have both during a partition. Note what CAP does *not* say: it is not "pick two of three". Partitions aren't optional, so it's a choice between C and A **while a partition lasts**. When the network is healthy, you can have both.

- A **CP** system (for example, etcd or ZooKeeper) prefers correct answers, and some requests fail during a partition.
- An **AP** system (for example, Cassandra in its usual configuration) keeps answering, and data may be temporarily inconsistent.

## PACELC: the everyday trade-off

Partitions are rare. What about the other 99.9% of the time? :term[PACELC]{id="pacelc"} extends CAP to cover it:

> If there's a **P**artition, choose **A**vailability or **C**onsistency; **E**lse, choose **L**atency or **C**onsistency.

Even with a perfect network, keeping copies strongly consistent means waiting for other replicas, often in other zones or regions, before answering. That costs latency on every request. Skipping the wait is faster but may return stale data.

So databases fall into combinations like:

- **PC/EC:** consistent always, paying in availability during partitions and latency otherwise. Typical of systems built on consensus, like Google Spanner.
- **PA/EL:** available and fast, accepting stale reads. Typical defaults of Dynamo-style stores such as Cassandra.

Many databases let you choose per request, for example a quorum read for a balance and a single-replica read for a profile picture.

:::tip
Choose consistency **per piece of data**, not per system. In one e-commerce app, the stock count at checkout needs strong consistency, while product reviews and "people also bought" can be eventually consistent.
:::

## Consensus: how replicas agree

How do strongly consistent systems actually keep copies in agreement, even when machines fail? With :term[consensus]{id="consensus"}: a group of nodes agrees on a value, or on an ordered log of writes, as long as a **majority** of them are working and can talk.

The majority rule is what makes it safe. Two different majorities of the same group always share at least one node, so two sides of a partition can never both make decisions. The minority side stops accepting writes; that's the CP choice in action.

| Cluster size | Majority | Failures tolerated |
| --- | --- | --- |
| 3 | 2 | 1 |
| 4 | 3 | 1 |
| 5 | 3 | 2 |

A cluster of 4 tolerates no more failures than a cluster of 3, which is why consensus clusters usually have an odd number of nodes.

:::deeper[Raft in five steps]
:term[Raft]{id="raft"} (Ongaro and Ousterhout, 2014) was designed to be an understandable consensus algorithm. It powers etcd and Consul, among others.

1. **Terms:** time is divided into numbered terms. Each term has at most one leader.
2. **Election:** a follower that hears nothing from a leader for a randomized timeout becomes a candidate, increments the term, and asks for votes. A node votes for at most one candidate per term, and only for one whose log is at least as up to date as its own. A majority of votes wins.
3. **Replication:** the leader appends each write to its log and sends it to followers.
4. **Commit:** once a majority have stored an entry, it's committed and can be applied and acknowledged to the client. A committed entry survives any later election, because every possible winner must hold it.
5. **Stepping down:** a leader that sees a higher term, for example after a partition heals, immediately becomes a follower. Any of its entries that never reached a majority may be overwritten by the new leader's log.

Randomized timeouts make split votes rare, and the majority rule prevents two leaders from both committing in the same term. You rarely implement Raft yourself; you use a system built on it for the small, critical data that must be agreed: leader election, configuration, locks.
:::

:::interview
Avoid "we'll use an AP database because of CAP" as a slogan. Instead, go through the data: "Usernames must be unique, so registration uses a strongly consistent store. The feed tolerates a few seconds of staleness, so it's eventually consistent and served from replicas close to users." If asked about failures, say what users see during a partition: an error, or possibly stale data.
:::

## Key takeaways

- Consistency models describe what readers can see while replicas disagree: strong, causal, eventual and session guarantees.
- Network partitions are inevitable; CAP says that during one you choose consistency or availability.
- PACELC adds the everyday trade-off: without partitions you still choose latency or consistency.
- Pick the model per piece of data based on what a wrong or stale answer would cost.
- Consensus protocols like Raft use majorities to agree safely; use odd-sized clusters.

::quiz{id="consistency-quiz"}
