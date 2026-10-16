---
slug: rate-limiting-and-idempotency
title: Rate limiting and idempotency
phase: building-blocks
order: 7
summary: Protecting services from too much traffic with rate limiters, and making retries safe with idempotency keys, backoff and jitter.
estimatedMinutes: 14
concepts: [rate-limiting, token-bucket, leaky-bucket, fixed-window, sliding-window, idempotency, idempotency-key, retry-with-backoff, jitter]
exercises: [rate-limiting-quiz]
---

Two things go wrong at scale all the time. Clients send too much: a buggy script loops, a scraper hammers your search, a partner's batch job fires everything at once. And requests fail halfway: the payment went through but the response was lost, so the client tries again. Rate limiting handles the first. Idempotency makes the second safe. Together they keep a system calm when the world around it isn't.

:::primer
- **Rate limiting** caps how many requests a client can make in a period, for example 100 per minute. Extra requests are rejected with an error that says "slow down".
- An operation is **idempotent** if doing it twice has the same effect as doing it once. "Set the light to on" is idempotent; "toggle the light" isn't.

Clients retry when things fail, so every operation that can be retried should be idempotent.
:::

## Why limit rates?

:term[Rate limiting]{id="rate-limiting"} protects you from:

- **Overload:** one client's spike shouldn't take down the service for everyone.
- **Abuse:** password guessing, scraping, spam.
- **Unfairness:** a heavy user shouldn't use up capacity paid for by everyone.
- **Runaway cost:** each request to a paid downstream API or a large model costs money.

Limits are usually set per API key, per user, or per IP address, and often per endpoint: login gets a much stricter limit than reading a product page.

## Four algorithms

### Token bucket

::figure{id="token-bucket" caption="The bucket refills at a steady rate; each request spends a token; an empty bucket means rejection."}

A :term[token bucket]{id="token-bucket"} holds up to **B** tokens and refills at **r** tokens per second. Each request spends one token; if the bucket is empty, the request is rejected.

It allows **bursts** of up to B requests, while the long-run average stays at r per second. That matches how real clients behave (a page load fires 10 requests at once, then nothing), which is why it's the most common choice.

```python
import time

class TokenBucket:
    def __init__(self, capacity: float, refill_per_second: float):
        self.capacity = capacity
        self.rate = refill_per_second
        self.tokens = capacity
        self.updated = time.monotonic()

    def allow(self) -> bool:
        now = time.monotonic()
        # Add the tokens earned since the last request, up to the capacity.
        self.tokens = min(self.capacity, self.tokens + (now - self.updated) * self.rate)
        self.updated = now
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False
```

Notice there's no background timer: the bucket computes its refill lazily when a request arrives, so storing it takes just two numbers.

### Leaky bucket

A :term[leaky bucket]{id="leaky-bucket"} puts requests in a queue that drains at a fixed rate. Output is perfectly smooth, which protects a downstream system that can't take bursts, but bursts wait in line instead of being served quickly.

### Fixed window

A :term[fixed window]{id="fixed-window"} counter counts requests per calendar window, say per minute, and rejects once the count passes the limit. It's the simplest to build: one counter per client per window.

Its flaw is the boundary. With a limit of 100 per minute, a client can send 100 requests in the last second of one minute and 100 more in the first second of the next: 200 requests in two seconds, all allowed.

### Sliding window

A :term[sliding window]{id="sliding-window"} fixes the boundary problem by always looking at the last 60 seconds, not the current calendar minute.

- **Sliding log:** store the timestamp of every request and count those in the last minute. Exact, but memory grows with the limit.
- **Sliding counter:** keep the counts for the current and previous windows and weight the previous one by how much of it still overlaps. 15 seconds into a minute, with 30 requests so far and 80 in the previous minute: estimate = 30 + 80 × 45/60 = **90**. Close enough, and only two counters.

| Algorithm | Allows bursts | Memory per client | Notes |
| --- | --- | --- | --- |
| Token bucket | Yes, up to B | 2 numbers | Common default |
| Leaky bucket | No, smooths them | A queue | Protects fragile downstreams |
| Fixed window | Up to 2× at boundaries | 1 counter | Simplest |
| Sliding counter | Limited | 2 counters | Good accuracy, cheap |

## Rate limiting in a real system

Where does the limiter live? Usually in the **API gateway** or load balancer, before requests reach your services. With many gateway servers, they need a shared count, typically kept in a fast store like Redis, updated with atomic operations so two servers can't both spend the last token.

When you reject, be helpful:

- Return HTTP **429 Too Many Requests**.
- Add a `Retry-After` header saying when to try again.
- Consider headers that tell clients their limit and remaining quota, so well-behaved clients can pace themselves.

:::warning[Fail open or fail closed?]
If the shared Redis that holds the counters goes down, should every request be rejected (fail closed) or allowed (fail open)? For most APIs, failing open with a generous local limit on each server is safer than turning a limiter outage into a full outage. For login or payment endpoints under attack, failing closed may be right. Decide deliberately.
:::

## Idempotency: making retries safe

Networks lose responses. A client sends "charge $50", the server charges the card, and the response times out on the way back. The client can't tell whether the charge happened. If it retries, the customer may be charged twice. If it doesn't, the order may never be paid.

:term[Idempotency]{id="idempotency"} removes the dilemma. In HTTP, `GET`, `PUT` and `DELETE` are defined as idempotent: repeating them leaves the same result. `POST`, which usually creates something, is not. To make a `POST` safe to retry, use an :term[idempotency key]{id="idempotency-key"}:

1. The client generates a unique key (a random UUID) for each logical operation and sends it with the request, for example in an `Idempotency-Key` header. Retries reuse the **same** key.
2. The server stores the key with the result of the first successful attempt.
3. If the same key arrives again, the server returns the stored result instead of doing the work again.

```http
POST /v1/payments
Idempotency-Key: 5f2b7c1e-8d4a-4b9e-a1f3-2c6d9e0b7a41
Content-Type: application/json

{ "amount": 5000, "currency": "usd", "order": "1234" }
```

Keep keys for a sensible period, such as 24 hours, and handle two requests with the same key arriving at the same moment: let one proceed and make the other wait or receive a "still in progress" error. A unique constraint on the key in the database does this reliably.

## Retrying well: backoff and jitter

Retries fix brief glitches, but naive retries make outages worse. If a service is overloaded and every client immediately retries three times, the load quadruples.

Good retry behaviour:

- **Retry only what can succeed:** timeouts, 503 and 429 are worth retrying; a 400 Bad Request will fail the same way again.
- **:term[Back off exponentially]{id="retry-with-backoff"}:** wait 100 ms, then 200, 400, 800, up to a cap.
- **Add :term[jitter]{id="jitter"}:** randomize each wait. Without it, thousands of clients that failed together retry together, in synchronized waves. A common approach picks a random wait between zero and the current backoff.
- **Cap the attempts,** and honour `Retry-After` when the server sends it.

:::deeper[Retry storms across layers]
Retries multiply across layers. Suppose a request passes through three services and each one makes up to 4 attempts (1 try plus 3 retries) when the next layer fails. If the bottom service is struggling, one user request can turn into 4 × 4 × 4 = **64** requests against it, exactly when it can least handle them.

Defences:

- **Retry at one layer only,** usually the outermost, and let inner layers fail fast.
- **Retry budgets:** allow retries to add at most, say, 10% extra traffic over a recent window; beyond that, fail instead of retrying.
- **Circuit breakers:** after many failures, stop calling a dependency for a while and fail immediately, then let a few trial requests through to see whether it has recovered.

Combined with rate limits and idempotency keys, these turn a cascading failure into a partial, recoverable one.
:::

:::interview
Rate limiting comes up in almost every API design, and "design a rate limiter" is a classic question on its own. Name the algorithm and why ("token bucket, so short bursts are fine"), the key ("per API key"), where it runs ("at the gateway, counters in Redis"), and what clients see ("429 with Retry-After"). For any write that touches money or inventory, say: "Clients send an idempotency key, and retries use exponential backoff with jitter."
:::

## Key takeaways

- Rate limits protect against overload, abuse and runaway cost; set them per client and per endpoint.
- Token bucket allows bursts with a steady average; sliding windows avoid the fixed window's boundary spikes.
- Return 429 with Retry-After, and decide whether the limiter fails open or closed.
- Idempotency keys make retried writes safe: same key, same result, no duplicate effect.
- Retry with exponential backoff, jitter and limits, and avoid retrying at every layer.

::quiz{id="rate-limiting-quiz"}
