---
slug: people-you-may-know
title: People you may know
track: B
order: 21
difficulty: intermediate
summary: Suggest connections for 300 million members from a 30-billion-edge graph, with nightly friends-of-friends candidates and an online ranker that predicts both the invite and the accept.
concepts: [graph-database, triadic-closure, graph-embedding, approximate-nearest-neighbor, candidate-generation, key-value-store, ranking-model, cold-start, offline-evaluation, ab-test]
prerequisites: [video-recommendations]
estimatedMinutes: 4
status: outline
exercises: []
diagram: people-you-may-know-hld
---

## Problem statement

Design "People you may know" (PYMK) for a professional or social network in the style of LinkedIn: a ranked list of people a member might want to connect with, shown on the home page and the network tab.

What makes it hard is that the best signal, mutual connections, needs graph traversal that is expensive at this scale: a member with 200 connections has 40,000 or more friend-of-friend paths. A good suggestion also needs two people to act, one to send an invite and one to accept, so optimizing invites alone produces spam. Some suggestions reveal sensitive relationships, and new members have no connections at all.

Questions to ask:

- Are connections mutual, or is it a one-way follow graph?
- What's the goal: invites sent, invites accepted, or engagement after connecting?
- Which signals may we use (uploaded contacts, shared employer or school, profile views), and which are off limits?
- How quickly should suggestions change after someone makes a new connection?
- What do we show a brand-new member?

## Requirements

**Functional**

- Return up to 20 suggestions per page, each with a reason such as "12 mutual connections".
- Exclude existing connections, pending invites, blocked members, members who opted out, and recently dismissed suggestions.
- Reflect a new connection in the member's suggestions within 10 minutes.
- Give new members suggestions from contacts they choose to import and from their school and employer.

**Non-functional**

- **Scale:** 300 million members, 100 million daily active; 200 connections on average, so 30 billion connections (about 500 GB of adjacency lists as 8-byte ids, before replication); 200 million PYMK loads per day (about 2,300 per second on average, 7,000 at peak).
- **Latency:** 100 ms p99 per PYMK request.
- **Freshness:** candidate lists rebuilt nightly, with incremental updates for new connections.
- **Availability:** 99.9%; if the ranker is down, serve the stored candidate list in its stored order.
- **Quality:** raise accepted invites per member per week without raising the share of invites that are ignored or reported.

## Key concepts

- :term[Graph database]{id="graph-database"}: the connection graph is sharded by member id and kept in memory, so "connections of X" returns in about a millisecond for serving-time filters and incremental updates; the nightly job reads a snapshot instead.
- :term[Triadic closure]{id="triadic-closure"}: friends of friends are the strongest source of suggestions, and capping both hops at the 100 strongest connections keeps each member's walk under 10,000 paths.
- :term[Graph embeddings]{id="graph-embedding"} with :term[approximate nearest neighbor]{id="approximate-nearest-neighbor"} search: find members in the same communities two or three hops away, without walking every path.
- :term[Candidate generation]{id="candidate-generation"}: friends of friends, embedding neighbors, shared employer or school, and imported contacts are merged into about 1,000 candidates per member.
- :term[Key-value store]{id="key-value-store"}: holds each member's nightly candidate list under their id, so serving needs one read instead of a graph walk.
- :term[Ranking model]{id="ranking-model"}: predicts the probability that the viewer sends an invite and that the candidate accepts, and ranks by their product, using features such as mutual connections, shared employer and how many invites the candidate already receives.
- :term[Cold start]{id="cold-start"}: new members get suggestions from imported contacts and their stated school and employer, because the first few connections strongly predict whether they stay.
- :term[Offline evaluation]{id="offline-evaluation"}: recall@20 of the connections members actually made in the following week, measured on a time-based split.
- :term[A/B tests]{id="ab-test"}: one member's suggestions change the invites others receive, so experiments randomize by clusters of connected members and track accepted invites, not only invites sent.

## High-level design

::diagram{id="people-you-may-know-hld"}

1. Each night, the candidate job walks a snapshot of the social graph for members active in the last 30 days: friends of friends with mutual counts, nearest neighbors in the graph-embedding index, and shared school or employer. It writes the top 1,000 per member to the candidate store. A new connection triggers an update of just that member's list.
2. On a request, the PYMK API reads the member's list and removes existing connections, pending invites, blocked members and recent dismissals.
3. The ranker reads fresh features for the remaining candidates from the feature store, scores P(invite) × P(accept), and the API returns the top 20 with their reasons.
4. Impressions, invites, accepts and dismissals flow to an event stream. Accepts can take days, so the weekly training job waits for them before labeling, then checks recall@20 and pushes versions that pass to the registry for an A/B test.

The full version of this case study will cover the estimates, distributing friends-of-friends counting across graph shards, training graph embeddings, privacy rules for sensitive signals, and two-sided metrics for invite senders and receivers.
