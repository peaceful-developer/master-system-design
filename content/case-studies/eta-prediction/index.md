---
slug: eta-prediction
title: ETA prediction
track: B
order: 23
difficulty: intermediate
summary: Predict arrival times for 40,000 requests per second in under 50 ms by routing on live traffic built from GPS pings, then correcting the route time with a model trained on completed trips.
concepts: [map-matching, stream-processing, contraction-hierarchies, gradient-boosted-trees, feature-store, latency-budget, offline-evaluation, data-drift, ab-test, switchback-experiment]
prerequisites: [ride-matching]
estimatedMinutes: 4
status: outline
exercises: []
diagram: eta-prediction-hld
---

## Problem statement

Design ETA prediction for a ride-hailing app in the style of Uber or Lyft: how long until a driver reaches the rider, and how long the trip will take. Riders see ETAs before they book, matching uses them to pick the driver who will arrive soonest, and pricing uses trip time.

What makes it hard is that travel time depends on live traffic that changes minute by minute, and on things no map shows, such as the walk to an airport pickup zone. It must also be fast, because one matching request asks for ETAs from dozens of drivers. And errors are not symmetric: a driver arriving later than promised hurts more than one arriving early.

Questions to ask:

- Which ETAs: driver to pickup, trip duration, or both?
- Who calls the service (rider app, matching, pricing), and how many requests per second?
- What latency per request, and can one request ask for many drivers at once?
- How is accuracy measured, and is arriving late worse than arriving early?

## Requirements

**Functional**

- Given an origin, a destination and a departure time, return a predicted travel time and the route.
- Answer batch requests from matching: up to 50 candidate drivers to one pickup.
- Use live traffic computed from driver GPS pings.
- Log every prediction so it can be compared with the actual arrival.

**Non-functional**

- **Scale:** 1 billion ETAs per day (about 12,000 per second on average, 40,000 at peak) across 500 cities; 1 million drivers online at peak, each sending a GPS ping every 4 seconds (250,000 pings per second).
- **Latency:** 50 ms p99 per request, including a batch of 50 drivers.
- **Freshness:** road speeds reflect pings from the last 2 minutes.
- **Accuracy:** median absolute error under 10% of the actual travel time, and average error within 2% in every city, so ETAs are not systematically early or late.
- **Availability:** 99.99%; if the model fails, return the routing engine's estimate unchanged.

## Key concepts

- :term[Map matching]{id="map-matching"}: GPS points can be off by tens of meters between tall buildings, so each trace is snapped to the road segments it most likely followed before speeds are computed.
- :term[Stream processing]{id="stream-processing"}: 250,000 pings per second become per-segment speeds over 2-minute windows, so a new jam shows up in ETAs within minutes.
- :term[Contraction hierarchies]{id="contraction-hierarchies"}: precomputed shortcuts let the routing engine find the fastest route across a city in a few milliseconds; a customizable variant re-applies live speeds every minute without recomputing the hierarchy.
- :term[Gradient-boosted trees]{id="gradient-boosted-trees"}: the first model predicts the gap between route time and actual time from features the graph lacks (time of day, weather, pickup type, city), so the routing estimate stays a safe fallback.
- :term[Feature store]{id="feature-store"}: serves live features such as speeds along the route and local demand, plus historical speeds for this hour and weekday, and logs them for training.
- :term[Latency budget]{id="latency-budget"}: a matching request for 50 drivers makes one batched route query to the pickup and one batched model call, not 50 separate requests, to stay under 50 ms.
- :term[Offline evaluation]{id="offline-evaluation"}: errors are measured on the latest held-out weeks by city, trip length and hour, weighting late errors more than early ones.
- :term[Data drift]{id="data-drift"}: road works, events, holidays and weather shift travel times, so error is tracked per city and the model retrains daily on recent trips.
- :term[A/B tests]{id="ab-test"} as :term[switchback experiments]{id="switchback-experiment"}: riders and drivers share one market per city, so models alternate by time window rather than by user, measuring accuracy, cancellations and bookings.

## High-level design

::diagram{id="eta-prediction-hld"}

1. Driver apps send a GPS ping every 4 seconds to the ping stream. Map matching snaps traces to road segments, and a streaming job writes each segment's 2-minute speed to the live traffic store.
2. Rider apps, matching and pricing call the ETA service with one or more origins (such as candidate drivers), a destination and a time. The routing engine finds the fastest route with contraction hierarchies and live speeds, and returns the route and its summed segment times as the base ETA.
3. The ETA model predicts a correction from route, traffic, time, weather and place features, scoring a batch request in one call; the service returns base ETA plus correction.
4. Each prediction is logged with its features, and the trip's actual pickup or drop-off time becomes its label. A daily job retrains on recent weeks, evaluates by city and trip length, and deploys versions that lower error behind a switchback test.

The full version of this case study will cover the estimates, scaling map matching and segment speeds per city, a neural model to replace the trees, ranges instead of single times, and sparse traffic data at night.
