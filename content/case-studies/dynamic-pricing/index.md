---
slug: dynamic-pricing
title: Dynamic pricing
track: B
order: 24
difficulty: intermediate
summary: Reprice 100,000 city zones every 60 seconds from live supply and demand, using demand forecasts, a price-elasticity model, capped multipliers and switchback experiments.
concepts: [stream-processing, geospatial-index, feature-store, price-elasticity, switchback-experiment, offline-evaluation, data-drift, ttl]
prerequisites: [ride-matching]
estimatedMinutes: 3
status: outline
exercises: []
diagram: dynamic-pricing-hld
---

## Problem statement

Design surge pricing for a ride-hailing app in the style of Uber or Lyft. Each quote includes a multiplier for the pickup zone. It rises when requests outrun nearby drivers, so some riders wait, more drivers head there, and pickup times stay short.

The hard part is that price changes behavior on both sides of the market. The model's own prices shape the data it learns from, and riders in one zone compete for the same drivers, so a per-rider A/B test is biased. Prices must react within a minute yet stay stable, capped and explainable.

Questions to ask:

- What is the objective: completed trips, pickup time, driver earnings, revenue, or a mix?
- How large is a zone, and how often may its price change?
- Is a quoted price honored, and for how long?
- Are there legal caps or emergency rules, such as no surge during a disaster?
- How will we measure a new policy when riders and drivers affect each other?

## Requirements

**Functional**

- Return a fare with a surge multiplier; honor the quote for 2 minutes.
- Recompute the multiplier for every active zone every 60 seconds.
- Apply caps, smoothing and operator overrides, such as an emergency freeze.
- Log every quote with its multiplier, model version and outcome.

**Non-functional**

- **Scale:** 300 cities, 100,000 active zones; 1 million online drivers at peak sending a location every 4 seconds (250,000 events per second); 20,000 quotes per second at peak.
- **Latency:** quotes under 50 ms at p99; each 60-second pricing run finishes within 10 seconds.
- **Availability:** 99.99% for quotes. If pricing stalls, keep the last multiplier for 5 minutes, then fall back to 1.0×.
- **Stability:** a multiplier moves at most 0.2× per minute and never exceeds the city cap, such as 3.0×.
- **Fairness:** one multiplier per zone and trip type; no protected attributes as inputs.

## Key concepts

- :term[Geospatial index]{id="geospatial-index"}: maps riders and drivers to hexagonal zones of about 1 km², so supply and demand are counted on the cells that prices apply to.
- :term[Stream processing]{id="stream-processing"}: counts requests, quotes and idle drivers per zone over one- to five-minute windows, so the pricer sees the market as it is now.
- :term[Feature store]{id="feature-store"}: holds zone features (live counts, weather, nearby events, time of week) so training and the pricer use identical values.
- :term[Price elasticity]{id="price-elasticity"}: a conversion model predicts how many riders accept at each multiplier. Prices are high exactly when demand is high, so learning elasticity needs small randomized price variations, not just logged prices.
- :term[Data drift]{id="data-drift"}: holidays and storms change demand patterns; forecast error is tracked per city, and a drifting city falls back to rule-based pricing.
- :term[Offline evaluation]{id="offline-evaluation"}: checks forecast error and conversion calibration on time-based holdouts. It cannot measure a policy's market effect, because logs only contain prices that were shown.
- :term[Switchback experiments]{id="switchback-experiment"}: alternate a whole city between old and new policy in 30-minute windows, so the two arms never compete for the same drivers.
- :term[TTL]{id="ttl"}: each quote is stored with a 2-minute TTL, so the rider pays the price they saw if they request in time.

## High-level design

::diagram{id="dynamic-pricing-hld"}

1. Driver apps send locations every 4 seconds, and the quote API publishes every quote and request, to a market event stream keyed by zone.
2. Stream jobs turn those events into per-zone counts each minute and write them to the zone features, next to slower inputs such as weather.
3. Every 60 seconds the pricing model forecasts demand and supply 10 to 15 minutes ahead for each zone, estimates requests at about 20 candidate multipliers, and picks the lowest one that balances expected requests with expected drivers. Smoothing, caps and overrides apply last.
4. Multipliers go to an in-memory zone price cache. The quote API reads the rider's zone, computes the fare in a few milliseconds, and stores the quote with its TTL.
5. Quotes and outcomes land in the warehouse. Training jobs retrain forecasts daily and the conversion model weekly, and a new policy reaches all cities only after switchback experiments show more completed trips without longer pickups.

The full version of this case study will cover demand and supply forecasting, estimating elasticity with randomized price exploration, the optimization objective and its constraints, switchback experiment design, and safe behavior when the pipeline stalls.
