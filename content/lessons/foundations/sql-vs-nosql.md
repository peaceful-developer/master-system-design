---
slug: sql-vs-nosql
title: SQL vs NoSQL
phase: foundations
order: 4
summary: What relational databases guarantee, what the NoSQL families trade away for scale, and a practical way to choose.
estimatedMinutes: 13
concepts: [relational-database, nosql, acid, transaction, isolation-level, write-skew, key-value-store, document-store, wide-column-store, graph-database, normalization, denormalization]
exercises: [sql-vs-nosql-quiz]
---

"Should we use SQL or NoSQL?" is one of the first questions in many design discussions, and one of the most misunderstood. It isn't a contest between old and new. It's a choice about **which guarantees you need** and **how your data will be read**.

:::primer
A **database** stores data so it survives restarts and can be searched.

- A **relational (SQL) database** stores data in tables of rows and columns, like a set of linked spreadsheets, and answers questions written in SQL.
- **NoSQL** is a family name for everything else: key-value stores, document stores, wide-column stores and graph databases. Each is built for a particular access pattern.

Neither is "faster" in general. Each is fast at some things and awkward at others.
:::

## The relational model

A :term[relational database]{id="relational-database"} stores each kind of thing in its own table and links tables by keys:

```sql
CREATE TABLE users  (id BIGINT PRIMARY KEY, name TEXT, email TEXT UNIQUE);
CREATE TABLE orders (id BIGINT PRIMARY KEY, user_id BIGINT REFERENCES users(id),
                     total_cents BIGINT, created_at TIMESTAMP);

SELECT u.name, SUM(o.total_cents) AS spent
FROM users u JOIN orders o ON o.user_id = u.id
WHERE o.created_at > now() - interval '30 days'
GROUP BY u.name;
```

Storing each fact exactly once is called :term[normalization]{id="normalization"}. Change a user's email in one place and every query sees it. The database's query planner works out *how* to answer a question you never planned for, which is why SQL is so good for evolving products and reporting.

## Transactions and ACID

A :term[transaction]{id="transaction"} groups several reads and writes into one all-or-nothing unit. Moving money between accounts is the classic example:

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 'alice';
UPDATE accounts SET balance = balance + 100 WHERE id = 'bob';
COMMIT;
```

Relational databases promise :term[ACID]{id="acid"}:

- **Atomicity:** all of the transaction happens, or none of it.
- **Consistency:** rules you declared (unique emails, valid foreign keys) always hold.
- **Isolation:** concurrent transactions don't see each other's half-finished work.
- **Durability:** once committed, data survives a crash.

### Isolation is a dial, not a switch

Full isolation (**serializable**: as if transactions ran one after another) is expensive, so databases offer weaker :term[isolation levels]{id="isolation-level"}. Many default to **read committed**: you never see uncommitted data, but two reads in one transaction can see different values. **Snapshot isolation** (often called repeatable read) gives each transaction a consistent snapshot, which prevents most surprises but not all of them.

## The NoSQL families

:term[NoSQL]{id="nosql"} databases usually give up joins, some transactional guarantees or a fixed schema in exchange for easy horizontal scale or a data model that fits a specific job.

| Family | Data model | Great for | Watch out for |
| --- | --- | --- | --- |
| :term[Key-value]{id="key-value-store"} | `get(key)`, `put(key, value)` | Sessions, caches, carts, feature flags | No queries except by key |
| :term[Document]{id="document-store"} | JSON-like documents | Product catalogs, user profiles, content | Joins across documents are awkward |
| :term[Wide-column]{id="wide-column-store"} | Rows of flexible columns, partitioned by key | Huge write volumes: events, metrics, messages | You must design tables around your queries |
| :term[Graph]{id="graph-database"} | Nodes and relationships | Social graphs, fraud rings, recommendations | Harder to scale writes; specialized queries |

The key mindset shift: in many NoSQL stores **you design the data for the queries**, not the other way round. If the app shows "a user's last 50 messages", you store messages partitioned by user and sorted by time, so that query is one fast read. Storing copies of data to make reads fast is :term[denormalization]{id="denormalization"}; it trades simpler reads for more work keeping copies in sync.

## How to choose

Ask these questions, in this order:

1. **Do you need multi-row transactions?** Money, inventory, bookings: start relational.
2. **Do you know your queries up front?** Unknown or evolving queries and reporting favor SQL. A few known, very high-volume access paths favor a key-value or wide-column design.
3. **How big, and how write-heavy?** A single well-tuned relational server handles more than most products ever need. When writes outgrow one machine, partitioned NoSQL stores (or distributed SQL databases) scale more naturally.
4. **What shape is the data?** Self-contained documents, time-ordered events or highly connected graphs each have a natural home.

Most real systems use several stores together: SQL for the source of truth, a cache for hot reads, a search index for text search, and an analytics warehouse. This is sometimes called *polyglot persistence*.

:::warning[Modern lines are blurry]
Many relational databases store and index JSON documents. Several NoSQL databases now support transactions. Distributed SQL databases scale writes across machines. Judge a specific product by its guarantees and access patterns, not by its category label.
:::

:::deeper[Write skew: when snapshot isolation is not enough]
Imagine a hospital rule: at least one doctor must be on call. Two doctors are on call and both feel unwell. Each starts a transaction at the same moment:

1. Count doctors on call: 2. "Fine, someone else is still on call."
2. Set my own status to off call.
3. Commit.

Under snapshot isolation both transactions read the same snapshot (2 on call), write *different* rows (no conflict is detected), and both commit. Now nobody is on call. This anomaly is :term[write skew]{id="write-skew"}: each transaction was valid alone, but together they broke a rule.

Fixes: use **serializable** isolation (modern databases implement it efficiently with techniques such as serializable snapshot isolation), explicitly lock the rows you read (`SELECT … FOR UPDATE`), or turn the rule into a constraint the database can check. When a design depends on a business rule across several rows, say which isolation level protects it.
:::

:::interview
Don't answer "SQL or NoSQL?" with a product name. Say what you need: "Orders need transactions and flexible reporting, so a relational database is the source of truth. The activity feed is append-heavy with one known query, so it goes in a wide-column store partitioned by user." Then name the trade-off you accept.
:::

## Key takeaways

- Relational databases give you joins, flexible queries and ACID transactions.
- Isolation levels trade safety for speed; know which one your rules depend on.
- NoSQL families give up some of that for easy scaling or a data model shaped to specific queries.
- Choose by guarantees and access patterns, and expect to combine several stores.

::quiz{id="sql-vs-nosql-quiz"}
