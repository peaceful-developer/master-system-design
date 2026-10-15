---
slug: url-shortener
title: URL shortener
track: A
order: 1
difficulty: beginner
summary: Turn long links into short ones and redirect quickly at scale.
concepts: [caching, latency]
prerequisites: []
estimatedMinutes: 6
status: complete
exercises: [url-shortener-quiz, qps-drill]
diagram: url-shortener-hld
---

## Problem statement

Design a service that turns long URLs into short codes.

:::primer
A short link is just a key that points to a long URL.
:::

## Requirements

Create links and redirect fast.

## Back-of-envelope estimates

100 million redirects per day is about 1,160 per second on average.

## API design and data model

`POST /links` and `GET /{code}`.

## High-level design

::diagram{id="url-shortener-hld"}

## Deep dives

Code generation and caching.

:::deeper[Base62 codes]
Seven base62 characters give about 3.5 trillion codes.
:::

## Trade-offs

Random codes avoid coordination but need a uniqueness check.

## Failure modes, scaling and monitoring

Watch the cache hit rate.

## Real-world references

TODO: add verified reference

## 45-minute interview version

Clarify, estimate, design, deep dive.

:::interview
Mention the read-heavy ratio early.
:::

## Practice

::quiz{id="url-shortener-quiz"}
