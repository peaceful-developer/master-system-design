---
slug: indexing
title: Indexing
phase: foundations
order: 5
summary: How databases find one row among millions in a few steps, what B-trees and LSM trees trade off, and when an index makes things worse.
estimatedMinutes: 12
concepts: [index, b-tree, lsm-tree, composite-index, covering-index, write-amplification, full-table-scan]
exercises: [indexing-quiz]
---

Your `users` table has 50 million rows and someone logs in with `alice@example.com`. Without help, the database reads all 50 million rows to find one. With the right index, it reads about four pages of data. Indexes are the single biggest lever on database performance, and they're never free.

:::primer
An **index** is like the index at the back of a book. Instead of reading every page to find "consistent hashing", you look it up alphabetically and jump straight to page 212.

A database index is a separate, sorted data structure that points to rows. It makes finding rows fast, takes extra space, and must be updated every time the data changes.
:::

## The cost of not having an index

Without an index on `email`, this query does a :term[full table scan]{id="full-table-scan"}:

```sql
SELECT id, name FROM users WHERE email = 'alice@example.com';
```

Reading 50 million rows (say 10 GB) from fast storage can take seconds. If the login page runs that query 200 times per second, the database spends all its time scanning. Add an :term[index]{id="index"} and the same lookup touches a handful of pages:

```sql
CREATE UNIQUE INDEX users_email_idx ON users (email);
```

## B-trees: the default index

Most relational databases build indexes as :term[B-trees]{id="b-tree"} (strictly, B+ trees). Picture a very wide, very shallow tree of sorted keys:

- Each **node** is one disk page (often 8 or 16 KB) holding hundreds of keys.
- The **root** says which child covers which key range; each level narrows the range.
- The **leaves** hold the keys in order, with pointers to the rows (or the rows themselves).

Because each node has hundreds of children, the tree is extremely shallow. With 500 keys per node, three levels cover 125 million keys. Finding any email takes about three or four page reads, and the top levels are almost always cached in memory.

Since leaves are sorted, B-trees also answer **range queries** well: `WHERE created_at BETWEEN '2026-01-01' AND '2026-01-31'` finds the first match and walks forward.

## Composite indexes: order matters

A :term[composite index]{id="composite-index"} sorts by several columns, like a phone book sorted by last name, then first name:

```sql
CREATE INDEX orders_user_time_idx ON orders (user_id, created_at);
```

This index helps:

```sql
-- uses both columns: one user's orders in a date range
SELECT * FROM orders WHERE user_id = 42 AND created_at > '2026-09-01';
-- uses the leading column only: all orders of one user
SELECT * FROM orders WHERE user_id = 42;
```

But it can't help this one, because the data isn't sorted by `created_at` alone:

```sql
SELECT * FROM orders WHERE created_at > '2026-09-01';
```

This is the **leftmost prefix rule**: a composite index helps queries that filter on its first column, or its first and second, and so on. Put the column you always filter by with equality first, and the range or sort column after it.

### Covering indexes

If an index contains every column a query needs, the database can answer from the index alone without visiting the table. That's a :term[covering index]{id="covering-index"}:

```sql
CREATE INDEX orders_user_time_total_idx ON orders (user_id, created_at) INCLUDE (total_cents);
SELECT created_at, total_cents FROM orders WHERE user_id = 42;  -- index-only
```

## Indexes are not free

Every index:

- **Slows writes:** an insert into a table with five indexes updates six structures.
- **Uses space:** sometimes more than the table itself.
- **Must fit in memory to be fast:** an index that keeps falling out of cache turns lookups into disk reads.

So index for the queries you actually run, and remove indexes nothing uses. Most databases can show you a query plan (`EXPLAIN`) and index usage statistics.

## LSM trees: built for writes

Some databases, especially write-heavy NoSQL and time-series stores, use :term[log-structured merge trees]{id="lsm-tree"} instead:

1. Writes go to an in-memory sorted buffer (and an append-only log for durability). Very fast.
2. When the buffer fills, it's written to disk as an immutable sorted file.
3. Background **compaction** merges files, dropping overwritten and deleted values.
4. Reads check the memory buffer, then files from newest to oldest. Small probabilistic filters (Bloom filters) quickly rule out files that can't contain the key.

| | B-tree | LSM tree |
| --- | --- | --- |
| Writes | Update pages in place; random I/O | Append and merge in the background; very fast |
| Reads | Predictable: a few page reads | May check several files; filters help |
| Range scans | Excellent | Good after compaction |
| Typical homes | Most relational databases | Cassandra, RocksDB, many time-series stores |

:::deeper[Write amplification and compaction strategies]
:term[Write amplification]{id="write-amplification"} is the ratio of bytes written to disk to bytes the application wrote. B-trees rewrite whole pages for small changes and also write a log. LSM trees write data once to the log, once when flushing, then again every time compaction merges it into a bigger file.

LSM stores choose a **compaction strategy**:

- **Size-tiered:** merge files of similar size together. Lower write amplification, but more files to check per read and temporary space spikes during big merges. Suits write-heavy workloads.
- **Leveled:** keep data in levels where each level is about 10× larger and files within a level don't overlap. Reads check about one file per level and space is tighter, at the cost of more rewriting. Suits read-heavy workloads.

On SSDs, write amplification also wears out the drive faster, so it affects hardware cost, not just speed.
:::

:::interview
When you add a table to a design, name its main query and the index that serves it: "Orders are read by user and time, so the primary index is (user_id, created_at)." If the workload is very write-heavy (logs, metrics, messages), mention that an LSM-based store absorbs writes better, and say what you give up on reads.
:::

## Key takeaways

- Without an index, the database scans every row; with one, it does a few page reads.
- B-trees are shallow, sorted and great for lookups and ranges; they're the default in relational databases.
- Composite indexes follow the leftmost prefix rule; covering indexes skip the table entirely.
- Every index speeds some reads and slows all writes, so index for real queries.
- LSM trees trade some read work and background compaction for very fast writes.

::quiz{id="indexing-quiz"}
