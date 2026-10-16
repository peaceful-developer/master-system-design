---
slug: feature-store
title: Feature store
track: B
order: 26
difficulty: advanced
summary: Serve 5,000 features for 1 billion entities in under 10 ms while giving training the exact same values, by computing each definition in batch and streaming and joining history point-in-time.
concepts: [feature-store, training-serving-skew, point-in-time-join, stream-processing, key-value-store, backfill, data-drift, hot-spot]
prerequisites: [video-recommendations, key-value-store]
estimatedMinutes: 3
status: outline
exercises: []
diagram: feature-store-hld
---

## Problem statement

Design a shared feature store in the style of Uber's Michelangelo, Feast or Tecton. Teams building fraud, ranking and ETA models define features once, such as "orders by this user in the last 30 minutes". The platform computes them, serves the latest values to models in production, and builds training sets from their history.

The hard part is giving two very different consumers the same numbers. Serving needs the current value for a few hundred entities in milliseconds. Training needs the value as it was at millions of past moments. If the two paths compute a feature differently, or training sees values from after the label, models look great offline and disappoint in production.

Questions to ask:

- How many teams, models and features, and how many entities (users, items, merchants)?
- How fresh must features be: daily, minutes, or seconds?
- What read rate and latency budget do online lookups need?
- How far back must training data go, and how often are new features backfilled?
- Does the platform compute features, or only store values computed elsewhere?

## Requirements

**Functional**

- Define a feature in code once: entity key, source, transformation, time window, owner.
- Online: return features for a list of entity keys in one call.
- Offline: build a training set by joining labeled events to feature values as of each event's time.
- Backfill new features over history; browse a catalog with owners and lineage.

**Non-functional**

- **Scale:** 5,000 features used by 200 models; 1 billion entities; about 2 KB per entity, so a 2 TB online store before 3× replication; 1 million entity lookups per second at peak; 2 years of offline history.
- **Latency:** online reads under 10 ms at p99 for calls of up to 500 entities.
- **Freshness:** streaming features under 1 minute behind events; batch features daily.
- **Availability:** 99.99% for online reads; a missing value returns an explicit default and a flag, never a silent zero.
- **Correctness:** logged online values match recomputed offline values on 99.9% of sampled checks.

## Key concepts

- :term[Feature store]{id="feature-store"}: one definition drives both the batch and the streaming computation, so "orders in the last 30 minutes" cannot mean two different things.
- :term[Training–serving skew]{id="training-serving-skew"}: the main bug this platform exists to prevent; served values are logged and compared with offline values for the same keys and times.
- :term[Point-in-time joins]{id="point-in-time-join"}: each training row gets the feature values known at its label's timestamp. Joining today's values leaks the future and inflates offline metrics.
- :term[Stream processing]{id="stream-processing"}: keeps windowed aggregates per entity and writes them to the online store within seconds of the event.
- :term[Key-value store]{id="key-value-store"}: the online store is keyed by entity id, so a request reads all features of an entity in one lookup and many entities in one batched call.
- :term[Backfill]{id="backfill"}: a new feature is computed over two years of history before its first training run, so teams don't wait months for data to accumulate.
- :term[Data drift]{id="data-drift"}: per-feature null rates, freshness and distributions catch a broken upstream pipeline before models quietly get worse.
- :term[Hot spots]{id="hot-spot"}: a viral item or a large merchant is read thousands of times per second, so the feature API caches such entities for a few seconds.

## High-level design

::diagram{id="feature-store-hld"}

1. Teams register each feature definition. The platform generates a streaming job, a batch job, or both from it.
2. Stream jobs read the event stream, update windowed aggregates per entity, and write them to the online store within seconds. Each new value is also appended, with its timestamp, to the offline store.
3. Batch jobs compute daily features from source tables into the offline store, and a materialization job copies the latest values to the online store.
4. A model service asks the feature API for one user and up to 500 candidate items. The API does a batched multi-get, fills defaults for missing values, and logs what it served.
5. A training job submits labeled events (entity, timestamp, label). The offline store runs a point-in-time join and returns the training set. A drift monitor compares served and offline values and tracks freshness and distributions per feature.

The full version of this case study will cover the definition API, the online store's data model and sizing, point-in-time joins over billions of rows, backfills that match streaming logic, and how skew checks catch mismatches.
