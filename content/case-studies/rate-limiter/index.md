---
slug: rate-limiter
title: Rate limiter
track: A
order: 2
difficulty: intermediate
summary: Enforce per-key request limits across 50 gateway servers at 500,000 requests per second, adding about a millisecond, and keep the API up even when the limiter's own storage fails.
concepts: [rate-limiting, token-bucket, sliding-window, fixed-window, key-value-store, hot-spot, latency-budget, availability]
prerequisites: [url-shortener]
estimatedMinutes: 14
status: complete
exercises: [rate-limiter-quiz, rate-limiter-estimation]
diagram: rate-limiter-hld
---

## Problem statement

Design the rate limiter for a public API. Every customer has an API key and a plan, such as "100 requests per second, 1 million per day." Requests over the limit must be rejected quickly and clearly, so one customer's runaway script can't degrade the API for everyone else.

The interesting part isn't the counting algorithm: it's counting **correctly across many servers**, adding almost no latency, and deciding what happens when the counting system itself fails.

:::primer
A **rate limiter** counts each client's requests and rejects the ones over its allowance, usually with HTTP **429 Too Many Requests**. The [rate limiting lesson](/learn/building-blocks/rate-limiting-and-idempotency) covers the algorithms; this case study builds the distributed system around them.
:::

Questions to ask:

- What identifies a client: API key, user, IP address? All three?
- What do limits look like: per second, per minute, per day? Different per endpoint or plan?
- Is a small overshoot acceptable (say 5% over the limit for a moment), or must limits be exact?
- Where does it run: in each service, or in front of all of them?
- What should happen if the limiter's storage is unavailable?

## Requirements

**Functional**

- Enforce one or more rules per request, such as a per-second burst limit and a daily quota per API key, and stricter limits on sensitive endpoints like login.
- Reject with 429, a `Retry-After` header and headers showing the limit and remaining quota.
- Change rules and plans without deploying code.

**Non-functional**

- **Scale:** 500,000 requests per second at peak, through 50 gateway servers, from 10 million active API keys.
- **Latency:** the check adds at most 2 ms at p99.
- **Accuracy:** small, brief overshoot is fine; sustained overshoot is not.
- **Availability:** the limiter must never take the API down. If it fails, the API keeps serving (with a fallback limit).

## Back-of-envelope estimates

Inputs are assumptions to agree on.

| Quantity | Calculation | Result |
| --- | --- | --- |
| Limit checks | 500,000 requests per second × 2 rules | 1M counter operations per second |
| Counter store shards | 1M ÷ ~100,000 operations per shard, × 2 headroom | ~20 shards |
| Counter memory | 10M keys × 2 rules × ~100 bytes | ~2 GB (plus replicas) |
| Network | 1M operations × ~200 bytes | ~200 MB/s across the cluster |

**What the numbers say:** memory is tiny; throughput is what needs a cluster. A single in-memory store node handles roughly 100,000 simple operations per second, so the counters must be spread over a few dozen shards, and each request should need **one** round trip, not one per rule.

## API design and data model

**Rules** (stored in a config database, cached in every gateway):

```json
{
  "id": "search-burst",
  "match": { "endpoint": "/v1/search", "plan": "standard" },
  "key": "api_key",
  "algorithm": "token_bucket",
  "capacity": 100,
  "refill_per_second": 100
}
```

**Responses** when a request is rejected:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 2
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 2
```

(The `RateLimit-*` names follow an IETF draft; many APIs use `X-RateLimit-*` equivalents.)

**Counter state** in the in-memory store, one entry per rule and key, for example `rl:{api_key}:search-burst` holding `tokens` and `updated_at`, with a TTL so idle keys disappear on their own.

## High-level design

::diagram{id="rate-limiter-hld"}

1. Requests reach a fleet of stateless **API gateways** through the load balancer.
2. Each gateway finds the rules that match the request (from its in-memory copy of the rule config) and asks the **counter store** to check and spend in **one atomic call** covering all matching rules.
3. If every rule allows it, the request goes on to the backend; if any rule rejects it, the gateway returns 429 straight away, so the backend never sees the excess traffic.
4. Rule changes are written to the config database and broadcast on a **pub/sub** channel; gateways reload within seconds.

Doing this at the gateway, rather than in every service, means one implementation, one set of rules, and protection for backends that know nothing about limits.

## Deep dives

### Choosing the algorithm

::figure{id="token-bucket" caption="A token bucket allows bursts up to its capacity while holding the long-run rate to the refill speed."}

- **Burst limits (per second):** a :term[token bucket]{id="token-bucket"} per key. It allows short bursts, such as a page firing ten calls at once, while holding the average to the refill rate, and its state is just two numbers.
- **Daily quotas:** a :term[fixed window]{id="fixed-window"} counter per key per day. The boundary effect (a burst at midnight) doesn't matter at this granularity, because the burst limit still applies.
- **Per-minute limits where boundary bursts matter:** a :term[sliding window]{id="sliding-window"} counter, which weights the previous window's count by how much of it overlaps the last 60 seconds.

### Counting correctly across 50 gateways

A naive implementation reads the count, compares it, then writes it back. Two gateways doing this at the same moment both read "99 of 100," both allow, and both write 100: a lost update, and over many servers the limit leaks badly.

The fix is to make check-and-spend **atomic** inside the counter store. A small server-side script (for example, a Lua script in Redis) does the whole step in one indivisible operation:

```lua
-- KEYS[1] = bucket key; ARGV = capacity, refill_per_second, now_ms, cost
local capacity, rate = tonumber(ARGV[1]), tonumber(ARGV[2])
local now, cost = tonumber(ARGV[3]), tonumber(ARGV[4])
local b = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(b[1]) or capacity
local ts = tonumber(b[2]) or now
tokens = math.min(capacity, tokens + (now - ts) / 1000 * rate)
local allowed = tokens >= cost
if allowed then tokens = tokens - cost end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', KEYS[1], math.ceil(capacity / rate * 1000) + 1000)
return { allowed and 1 or 0, tokens }
```

To check several rules in one round trip, all of a key's counters must live on the **same shard**. Put the API key in a hash tag, such as `rl:{key_123}:search-burst`, so the cluster hashes only the part in braces. One call then checks every rule atomically, and a request is only charged if all rules allow it.

### Keeping latency low

One round trip to an in-memory store in the same zone takes well under a millisecond, which fits the 2 ms budget. Two refinements help at scale:

- **Local token leases:** for very busy keys, a gateway takes a small batch of tokens (say 10) at once and spends them locally, returning to the store only when they run out. That cuts store traffic for heavy users by up to 10×, at the cost of a small, bounded overshoot.
- **Hot keys:** one huge customer can make its shard a :term[hot spot]{id="hot-spot"}. Leases solve most of it; for the extreme cases, split that customer's limit into several sub-buckets on different shards and pick one at random per request.

### When the counter store fails

A limiter that rejects everything when its storage is down has turned a partial failure into a full outage. Decide per rule:

- **Fail open** (the default): if the store doesn't answer within a short timeout (say 5 ms), allow the request, but enforce a **local** limit in each gateway of roughly the rule's limit divided by the number of gateways. Limits become approximate, not absent.
- **Fail closed** for rules that exist to stop abuse, such as login attempts and password resets, where letting attackers through is worse than briefly rejecting some users.

:::deeper[Rate limits versus concurrency limits]
A rate limit caps requests per unit of time, but not how much work is in flight. One customer sending 10 requests per second to an endpoint that takes 30 seconds has 300 requests running at once, which can exhaust a backend even though the rate is modest.

A **concurrency limiter** caps requests in progress per key instead: increment a counter when a request starts, decrement it when it finishes, and reject when the count is at the limit. Because a crashed gateway never sends its decrements, store each in-flight request as an entry with an expiry (for example, a sorted set of request ids scored by start time) and drop entries older than the endpoint's timeout. Expensive endpoints such as exports and searches often need both kinds of limit.
:::

## Trade-offs

| Decision | Alternative | Why this choice |
| --- | --- | --- |
| Limit at the gateway | Limit inside each service | One implementation and rule set; backends shielded from excess load |
| Shared in-memory counter store | Local counters per gateway | Accurate across 50 servers; local counters alone would allow up to 50× the limit |
| Atomic server-side script | Read-then-write from gateways | No lost updates under concurrency |
| Token bucket for bursts | Fixed windows everywhere | Allows natural bursts without double-limit spikes at boundaries |
| Fail open with local fallback | Fail closed everywhere | A limiter outage must not become an API outage |
| Local token leases for hot keys | Every request hits the store | Big reduction in store load for a small, bounded overshoot |

## Failure modes, scaling and monitoring

- **Counter shard failure:** its replica is promoted; during the gap, affected keys fall back to local limits. Counts may reset, briefly allowing extra requests.
- **Clock skew between gateways:** refill math uses the timestamp passed in; use the store's clock (or a single time source) so skewed servers can't mint tokens.
- **Rule mistakes:** a typo that sets a limit to 1 per second can reject a whole customer. Validate rules, roll them out gradually, and alert on sudden jumps in 429s.
- **Retry storms:** rejected clients that retry immediately multiply load. `Retry-After` helps; clients should back off with jitter.
- **Growth:** add shards; keys rebalance by hash. Gateways scale horizontally.

**Monitor:** limiter latency (p99), store errors and timeouts, fallback mode activations, 429 rate by rule and by customer, top keys by traffic, and config propagation delay. Suggested SLO: the limiter adds under 2 ms at p99, and fallback mode is active less than 0.1% of the time.

## Real-world references

- RFC 6585, *Additional HTTP Status Codes* (IETF, 2012): defines 429 Too Many Requests and the use of Retry-After.
- Stripe Engineering, *Scaling your API with rate limiters* (2017): request rate limiters, concurrency limiters and load shedding in production.
- Cloudflare, *How we built rate limiting capable of scaling to millions of domains* (2017): the sliding window counter approximation and its accuracy in practice.
- IETF HTTP API working group, *RateLimit header fields for HTTP* (Internet-Draft): the `RateLimit-*` response headers.

## 45-minute interview version

1. **Requirements (5 min):** per-key rules (burst and daily), 429 with headers, configurable without deploys; 500,000 requests per second, 50 gateways, under 2 ms added, never take the API down.
2. **Estimates (3 min):** 1M counter operations per second, so about 20 shards; about 2 GB of state.
3. **API (3 min):** rule format, 429 response with `Retry-After` and quota headers.
4. **High-level design (7 min):** limiter in the gateway, shared counter store, rule config pushed by pub/sub.
5. **Deep dives (17 min):** algorithm per rule type; the lost-update race and the atomic script; one round trip with hash tags; leases and hot keys.
6. **Failures (7 min):** fail open with local fallback versus fail closed for login; clock skew; rule mistakes; monitoring.
7. **Wrap-up (2 min):** summarize; next steps could be per-region limits or concurrency limits for expensive endpoints.

:::interview
Most candidates can describe a token bucket. What separates strong answers is the distributed part: name the read-then-write race and fix it with an atomic operation, keep it to one round trip, and have a clear answer for "what happens when Redis is down?" Saying "fail open, with a local fallback, but fail closed for login" shows production judgement.
:::

## Practice

::quiz{id="rate-limiter-quiz"}

::drill{id="rate-limiter-estimation"}
