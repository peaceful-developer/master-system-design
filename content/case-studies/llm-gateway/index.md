---
slug: llm-gateway
title: LLM gateway and model router
track: C
order: 38
difficulty: intermediate
summary: Put 300 internal apps behind one LLM API at 2,000 requests per second, with token budgets, failover across providers and a router that sends easy requests to cheaper models.
concepts: [model-routing, token-bucket, circuit-breaker, retry-with-backoff, hedged-request, semantic-cache, server-sent-events, guardrails, llm-as-judge]
prerequisites: [rate-limiter, llm-inference-serving]
estimatedMinutes: 4
status: outline
exercises: []
diagram: llm-gateway-hld
---

## Problem statement

Design the gateway that a company's applications use to reach language models, in the style of open-source LLM proxies: one API in front of several hosted model providers and a self-hosted model pool, with keys, budgets, routing, failover and logging in one place.

A gateway sounds like a thin proxy, but LLM traffic is unusual. Requests vary a hundredfold in cost and can't be priced until they finish, responses are long **streams**, providers fail and rate-limit often, and the cheapest model that is good enough differs per request. The router's choices change both the bill and the quality users see.

Questions to ask:

- How many applications and teams, and what peak request rate?
- Which providers and models, and which data may go to which provider?
- How are budgets set and enforced: per team, per app, in tokens or dollars?
- What happens when a provider is down: fail over, degrade, or fail?
- Which teams are willing to let the gateway pick the model for them?

## Requirements

**Functional**

- One API for chat and embeddings across three hosted providers and a self-hosted pool; apps ask for a model alias, such as `chat-default`, not a provider.
- Per-team keys, token rate limits and monthly dollar budgets.
- Routing by alias and policy: cost, latency, data restrictions and fallback order.
- Optional response caching per app.
- Usage records for billing and debugging, with personal data redacted.

**Non-functional**

- **Scale:** 300 applications from 40 teams; 2,000 requests per second at peak, most of them streamed.
- **Overhead:** the gateway adds under 20 ms at p99, excluding model time.
- **Availability:** 99.99% for the gateway, higher than any single provider; traffic leaves a failing provider within 30 seconds.
- **Cost:** cut model spend by 30% through routing and caching, with no drop in eval scores.

## Key concepts

- :term[Model routing]{id="model-routing"}: a small classifier uses the app, task type and prompt length to send easy requests to a small model, and every route is checked on evals before it takes traffic.
- :term[Token buckets]{id="token-bucket"}: limits count tokens per minute, and because output length is unknown up front, the gateway reserves `max_tokens` and refunds the unused part when the stream ends.
- :term[Circuit breakers]{id="circuit-breaker"}: one per provider and model, so when errors or latency spike, traffic shifts to an equivalent deployment instead of waiting for timeouts.
- :term[Retry with backoff]{id="retry-with-backoff"}: rate-limit and server errors before the first token are retried on another deployment; after tokens have streamed, a retry would duplicate text, so the error goes to the app.
- :term[Hedged requests]{id="hedged-request"}: for latency-critical apps, if no first token arrives within 2 seconds, a copy goes to another deployment and the slower one is canceled, at the cost of paying twice for some requests.
- :term[Semantic cache]{id="semantic-cache"}: reusing answers for similar prompts saves money for FAQ-style apps, but "cancel my order" is not "cancel my subscription", so it is opt-in per app with a strict threshold.
- :term[Server-sent events]{id="server-sent-events"}: streams pass through without buffering, and the gateway counts tokens as they pass for billing.
- :term[Guardrails]{id="guardrails"}: personal data is redacted centrally, and prompts marked sensitive are routed only to approved deployments.
- :term[LLM as a judge]{id="llm-as-judge"}: sampled requests are replayed on the cheaper tier and graded against the large model's answers, which sets the router's thresholds.

## High-level design

::diagram{id="llm-gateway-hld"}

1. An app calls the gateway with its team key and a model alias. The gateway authenticates, reserves tokens against the team's budget in a shared counter store, and checks the response cache if the app opted in.
2. The model router classifies the request to pick a tier, then picks a deployment among the providers and the self-hosted pool by health, recent latency and price, within the app's data rules. Personal data is redacted before the prompt leaves.
3. The response streams straight back. Failures before the first token are retried elsewhere, and circuit breakers keep traffic away from a failing provider.
4. When the stream ends, actual token counts settle the budget, and a usage record with team, model, tokens, cost, latency and cache hit goes to the usage log for billing and dashboards.
5. Router evals replay sampled traffic on the alternative tier and grade it with an LLM judge. Routing thresholds are tuned so quality stays at target while cost falls, and new models enter through shadow traffic first.

The full version of this case study will cover budget accounting for streamed responses, health scoring and failover between providers, training and evaluating the router, cache safety, and the cost model behind the 30% savings target.
