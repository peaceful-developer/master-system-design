---
slug: ride-matching
title: Ride matching
track: A
order: 12
difficulty: intermediate
summary: Match riders with nearby drivers within 2 seconds while 5 million drivers report locations every 4 seconds, using a city-sharded in-memory geo index and conditional driver reservations.
concepts: [geospatial-index, sharding, hot-spot, ttl, websocket, optimistic-concurrency-control, idempotency-key]
prerequisites: [key-value-store, chat-app]
estimatedMinutes: 3
status: outline
exercises: []
diagram: ride-matching-hld
---

## Problem statement

Design the dispatch system of a ride-hailing app in the style of Uber or Lyft: drivers stream their location while online, a rider asks for a ride from a pickup point, and the system offers the trip to a good nearby driver, who accepts or declines.

Two things make it hard. Location data is huge and short-lived: over a million updates per second, each stale seconds later, which ordinary database indexes can't keep up with. And matching is contended: riders in a busy area compete for the same few drivers, yet a driver must never be offered two trips at once.

Questions to ask:

- How many drivers are online at peak, and how often do they report their location?
- How fast must a rider get a match, and how long does a driver have to accept?
- Is "nearby" measured in straight-line distance or in driving time?
- Is pricing in scope? (No; surge pricing is the dynamic pricing case study in the ML track.)

## Requirements

**Functional**

- Drivers go online and offline, and send their location while online.
- A rider requests a ride from a pickup to a drop-off point and watches the matched driver approach in real time.
- Each request is offered to one driver at a time; the driver accepts or declines within 15 seconds, and a decline or timeout moves the offer to the next candidate.
- Riders and drivers can cancel; every trip moves through clear states from requested to completed or cancelled.

**Non-functional**

- **Scale:** 5 million drivers online at peak, each reporting every 4 seconds, about 1.25 million location updates per second; 20 million trips per day, about 1,000 requests per second at peak.
- **Latency:** a nearby-driver search under 50 ms at p99; the first offer reaches a driver within 2 seconds of the request.
- **Freshness:** matching uses positions at most a few seconds old; a driver silent for 30 seconds drops out of search.
- **Correctness:** a driver is never assigned two trips at once, and a retried request never creates two trips.
- **Availability:** 99.99% for requesting rides; losing one server affects part of one city, for seconds.

## Key concepts

- :term[Geospatial index]{id="geospatial-index"}: the map is divided into cells a few hundred meters across, so "available drivers near this pickup" becomes a read of the pickup cell and the rings of cells around it.
- :term[Sharding]{id="sharding"}: locations and matching are sharded by city or region, because a rider is only ever matched with drivers nearby, so one request touches one shard.
- :term[Hot spots]{id="hot-spot"}: an airport or a stadium after a game can pack thousands of drivers and requests into a few cells, so busy cells are split into smaller ones or spread over several servers.
- :term[TTL]{id="ttl"}: each stored position expires 30 seconds after its last update, so drivers who lose signal or close the app leave the index without a cleanup job.
- :term[WebSockets]{id="websocket"}: driver and rider apps each keep one open connection, so an offer reaches a driver in milliseconds and the rider sees the car move.
- :term[Optimistic concurrency control]{id="optimistic-concurrency-control"}: reserving a driver is a conditional write from "available" to "offered"; when two requests pick the same driver, only one write succeeds and the other moves on to its next candidate.
- :term[Idempotency keys]{id="idempotency-key"}: the rider app sends one key per request, so tapping twice or retrying on a bad network creates one trip, not two.

## High-level design

::diagram{id="ride-matching-hld"}

1. Driver apps send a GPS point every 4 seconds over their open connection. The location service writes each driver's latest position and status into the city's in-memory geo index, keyed by cell, and appends the point to a location log for trip history and ETA models.
2. A rider's request reaches the matcher, which asks the trip service to create the trip once per idempotency key. It then reads the pickup cell and its neighbors, keeps the available drivers, and ranks them by estimated pickup time on the road network rather than straight-line distance.
3. The matcher reserves the best candidate with a conditional write, and the gateway pushes the offer to that driver. If the driver declines or 15 seconds pass, the reservation is released and the next candidate gets the offer.
4. When the driver accepts, the trip service records the assignment in the trips database and moves the trip through its states. Until pickup, the gateway streams the driver's position to the rider's app.

The full version of this case study will cover the estimates, choosing a cell system (geohash, quadtree or hexagons), greedy versus batched matching, splitting hot cells, and failing over a city's shard without losing trips in progress.
