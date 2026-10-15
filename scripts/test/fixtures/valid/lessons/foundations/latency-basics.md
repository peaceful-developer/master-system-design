---
slug: latency-basics
title: Latency basics
phase: foundations
order: 1
summary: What latency is, why the slowest requests matter, and how to budget it.
estimatedMinutes: 4
concepts: [latency, throughput]
exercises: [latency-quiz]
---

## Why latency matters

:::primer
**Latency** is waiting time. If a page takes 2 seconds to load, its latency is 2 seconds.
:::

Every request pays for :term[latency]{id="latency"}, and every system has a ceiling on :term[throughput]{id="throughput"}. See the [glossary](/glossary) and the [next section](#budgets).

::figure{id="request-flow" caption="A request travelling from client to server"}

## Budgets

Split the time you can afford across each hop.

```ts
const budgetMs = 200;
```

:::deeper[Tail latency]
At scale, the slowest 1% of requests decide how users feel.
:::

:::interview
Say which percentile you are targeting, for example p99 under 200 ms.
:::

::quiz{id="latency-quiz"}
