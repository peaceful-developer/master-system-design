---
slug: sharding-and-consistent-hashing
title: Sharding and consistent hashing
phase: building-blocks
order: 4
summary: Splitting data across machines when one database can't hold it all, choosing a shard key, avoiding hot spots, and adding machines without moving everything.
estimatedMinutes: 14
concepts: [sharding, range-partitioning, hash-partitioning, hot-spot, resharding, consistent-hashing, virtual-nodes]
exercises: [sharding-quiz]
---

Replication gives you more copies of the same data. But what if the data itself is too big for one machine, or there are more writes than one leader can take? Then you split the data into pieces and put each piece on a different machine. Every large database you've heard of does this, and the choices you make here are some of the hardest to undo.

:::primer
**Sharding** (also called partitioning) means splitting one big dataset into smaller pieces called **shards**, each stored on a different machine.

- Each record lives on exactly one shard (plus that shard's replicas).
- A **shard key**, such as a user id, decides which shard a record belongs to.
- More shards means more total storage and more total write capacity.

Replication and sharding work together: each shard is usually replicated too.
:::

## Why shard?

A single database server eventually runs out of something:

- **Storage:** the data no longer fits on its disks.
- **Write throughput:** one leader can only apply so many writes per second, and adding followers doesn't help writes.
- **Memory:** the working set no longer fits in RAM, so queries slow down.

Before sharding, try the cheaper fixes: a bigger machine, read replicas, caching, archiving old data. :term[Sharding]{id="sharding"} works, but it makes queries, transactions and operations harder for the rest of the system's life.

## Two ways to split: ranges or hashes

### Range partitioning

With :term[range partitioning]{id="range-partitioning"}, each shard owns a continuous range of keys, like volumes of an encyclopedia: A–F on shard 1, G–M on shard 2, and so on.

- **Good:** range queries are efficient. "All orders from March" touches one or two shards.
- **Bad:** sequential keys pile up in one place. If the key is a timestamp, every new write lands on the shard that owns "now", while the others sit idle.

### Hash partitioning

With :term[hash partitioning]{id="hash-partitioning"}, you hash the key and use the hash to pick a shard. A good hash scatters similar keys randomly, so load spreads evenly.

- **Good:** even distribution, even for sequential keys.
- **Bad:** range queries must ask every shard (a **scatter-gather** query) because neighbouring keys are now far apart.

| | Range | Hash |
| --- | --- | --- |
| Spreads load evenly | Only if keys are spread evenly | Yes |
| Range queries | Efficient | Ask every shard |
| Typical use | Time series, ordered scans | Lookups by id |

## Choosing a shard key

The shard key is the most important decision. A good one:

1. **Has many distinct values,** so data can spread over many shards. Sharding by country gives you about 200 shards at most, very unevenly sized.
2. **Spreads traffic evenly,** not only data.
3. **Matches your most common queries,** so they hit a single shard.

For a chat app, sharding messages by conversation id keeps each conversation on one shard, so loading a conversation is a single-shard query. Sharding by message id would spread a conversation across every shard.

:::warning[Cross-shard work is expensive]
Joins, transactions and unique constraints that span shards need extra coordination, or the application has to do them itself. Design so that the common path stays inside one shard, and accept that the rare path is slower.
:::

## Hot spots

Even with a good key, one value can be far more popular than the rest. A celebrity with 50 million followers, or a product on sale, creates a :term[hot spot]{id="hot-spot"}: one shard gets hammered while the others idle.

Common fixes:

- **Split the hot key:** append a small random number (0–9) to the key, so its writes spread over ten shards. Reads must then gather from all ten, so do this only for keys you know are hot.
- **Cache it:** hot keys are usually hot for reads, and a cache in front absorbs them.
- **Give it a dedicated shard** when one tenant is much bigger than the rest.

## The resharding problem

The obvious way to pick a shard is `shard = hash(key) mod N`, where N is the number of shards. It spreads keys well, until you add a shard.

When N changes, almost every key's answer changes. Going from 4 shards to 5, a key stays put only if `hash mod 4` equals `hash mod 5`, which happens for just 20% of keys. The other **80% must move**, all at once, while serving traffic. That's the :term[resharding]{id="resharding"} problem.

Two common solutions:

1. **Many fixed partitions.** Create far more partitions than machines, say 1,000 partitions on 10 machines, 100 each. The key-to-partition mapping never changes. To add a machine, move a few whole partitions to it. Many databases work this way; the catch is that you must pick the partition count up front.
2. **Consistent hashing,** below.

## Consistent hashing

:term[Consistent hashing]{id="consistent-hashing"} places both keys and nodes on the same circle (a "ring") of hash values. To find a key's node, start at the key's position and walk clockwise to the first node.

::figure{id="consistent-hash-ring" caption="A key belongs to the next node clockwise. When node E joins, only the keys in one arc move."}

When a node joins, it takes over only the keys between itself and its counter-clockwise neighbour. Everything else stays where it was. With N nodes growing to N + 1, only about **1/(N + 1)** of the keys move, the share the new node should own anyway. Going from 4 to 5 nodes moves about 20% of keys instead of 80%.

### Virtual nodes

With only a few points on the ring, the arcs between them are uneven by chance, so some nodes own far more keys than others. And when a node leaves, its whole arc lands on a single neighbour.

The fix is :term[virtual nodes]{id="virtual-nodes"}: each physical machine appears at many points on the ring, often 100 or more. With many points per machine:

- load evens out, because each machine owns many small arcs;
- when a machine leaves, its arcs scatter across many machines instead of one;
- a bigger machine can simply have more virtual nodes and take a bigger share.

```python
import bisect, hashlib

def h(value: str) -> int:
    return int(hashlib.md5(value.encode()).hexdigest(), 16)

class Ring:
    def __init__(self, nodes, vnodes=100):
        self.points = sorted(
            (h(f"{node}#{i}"), node) for node in nodes for i in range(vnodes)
        )
        self.hashes = [point for point, _ in self.points]

    def node_for(self, key: str) -> str:
        i = bisect.bisect(self.hashes, h(key)) % len(self.points)  # wrap around
        return self.points[i][1]
```

:::deeper[Rendezvous and jump hashing]
Consistent hashing isn't the only way to move few keys when nodes change.

- **Rendezvous hashing** (highest random weight, 1996): for each key, score every node with `hash(key, node)` and pick the highest score. When a node leaves, only its keys move, and each goes to its own second choice, so load spreads naturally. There's no ring to store, but a lookup costs one hash per node, which is fine for tens of nodes.
- **Jump consistent hash** (Lamping and Veach, Google, 2014): a few lines of arithmetic map a key to a bucket numbered 0 to N − 1, with no memory at all and a perfectly even spread. Its limit is that buckets can only be added or removed at the end, so it suits numbered shards behind a stable list, not machines that fail at random.

Whatever the scheme, the goal is the same: when membership changes, move about 1/N of the data, and no more.
:::

:::interview
Say when you'd shard, and justify it with numbers: "10 TB growing 2 TB a year won't fit one machine for long." Then name the shard key and why: "Shard by user id, so a user's data lives on one shard and the main queries are single-shard." Mention one weakness of your key, usually hot spots, and how you'd handle it. If the cluster will grow, say how: "Consistent hashing with virtual nodes, so adding a node moves only its fair share."
:::

## Key takeaways

- Shard when one machine can't hold the data or absorb the writes; try cheaper fixes first.
- Range partitioning keeps range queries fast but risks hot spots; hashing spreads load but scatters ranges.
- Choose a shard key with many values that keeps common queries on one shard.
- `hash mod N` moves most keys when N changes; fixed partitions or consistent hashing move only a fair share.
- Virtual nodes even out load and spread a departing node's data across the cluster.

::quiz{id="sharding-quiz"}
