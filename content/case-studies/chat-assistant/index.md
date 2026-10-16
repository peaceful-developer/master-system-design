---
slug: chat-assistant
title: Chat assistant service
track: C
order: 31
difficulty: intermediate
summary: Stream 150 million chat replies a day with the first token in under a second, keeping long conversations within the context window and charging per-tier quotas in tokens.
concepts: [token, context-window, server-sent-events, time-to-first-token, prefix-caching, rate-limiting, token-bucket, guardrails, llm-as-judge, ab-test]
prerequisites: [chat-app, rate-limiter]
estimatedMinutes: 4
status: outline
exercises: []
diagram: chat-assistant-hld
---

## Problem statement

Design a chat assistant service in the style of ChatGPT: people hold conversations with a large language model in a web or mobile app, see each reply appear word by word, and pick up any past conversation on another device.

The model call is only part of the work. Every reply costs seconds of expensive GPU time, every turn resends a **growing conversation** to the model, a reply is a **stream** that must survive flaky mobile connections, and every message must pass **safety checks** without making the assistant feel slow.

Questions to ask:

- How many daily users, how many messages each, and how long do conversations get?
- Are there free and paid tiers with different models and limits?
- What are the latency targets for the first token and for streaming speed?
- Text only, or also file uploads, images and web search? (Text only here.)
- How long are conversations kept, and can users delete them or opt out of their use for training?
- Which content policy applies, and what happens to a flagged message?

## Requirements

**Functional**

- Send a message and receive a streamed reply; stop or regenerate a reply.
- List, rename and delete conversations; continue any conversation on another device.
- Free and paid tiers with different models and usage limits.
- Rate replies with thumbs up or down.

**Non-functional**

- **Scale:** 10 million daily users sending 15 messages each: 150 million replies per day, about 1,700 per second on average and 5,000 at peak.
- **Tokens:** an average prompt of 2,000 tokens (instructions plus history) and a 400-token reply, so 10 million input and 2 million output tokens per second at peak.
- **Latency:** first token within 1 second at p95; at least 20 tokens per second while streaming.
- **Availability:** 99.9% for sending messages; a reply the user has seen is never lost.
- **Safety:** every message and reply is checked against the content policy, adding under 100 ms before the first token.

## Key concepts

- :term[Tokens]{id="token"}: cost, latency and limits all scale with tokens rather than requests, so usage is metered and limited in tokens.
- :term[Context window]{id="context-window"}: long conversations eventually outgrow it, so the service keeps recent turns word for word and replaces older ones with a running summary.
- :term[Server-sent events]{id="server-sent-events"}: replies stream over one HTTP response, and each chunk carries a sequence number so a client that drops can reconnect and resume.
- :term[Time to first token]{id="time-to-first-token"}: this is the speed users feel, and its 1-second budget must cover authentication, safety checks, loading history, queueing and the model's prompt processing.
- :term[Prefix caching]{id="prefix-caching"}: each turn resends the whole conversation, so routing a conversation back to the replica that served its last turn skips most of the prompt processing while that cache is still in memory.
- :term[Rate limiting]{id="rate-limiting"} with :term[token buckets]{id="token-bucket"}: each tier gets a token allowance that refills over a few hours, which protects shared GPUs from heavy users and scripts.
- :term[Guardrails]{id="guardrails"}: a fast classifier checks each message before generation and the reply in chunks while it streams, so a violation stops the stream early.
- :term[LLM as a judge]{id="llm-as-judge"}: rubric-based grading of sampled conversations compares model and prompt versions faster than human raters can, with humans auditing a subset.
- :term[A/B tests]{id="ab-test"}: a new model or system prompt reaches a small share of users first and is compared on ratings, regenerations and return visits.

## High-level design

::diagram{id="chat-assistant-hld"}

1. The app sends the new message to the API gateway, which authenticates the user, checks the tier's token balance in a shared counter store, and opens a streaming response.
2. The chat service loads the conversation from the conversation store: the system prompt, a summary of older turns and the most recent turns, trimmed to a token budget. Input guardrails check the new message in parallel.
3. The chat service sends the prompt to the model pool, keyed by conversation id so the previous turn's cached prefix is reused. Tokens stream back to the app while output guardrails check each chunk.
4. When the reply ends, or the user stops it, the service saves it with token counts, model version and prompt version, and charges the actual tokens to the quota. Background workers write a title and refresh the summary when the history outgrows its budget.
5. Usage events, ratings and regenerations flow into a log. The evaluation service grades sampled conversations from users who allow it, with personal data removed, and new versions ship behind A/B tests.

The full version of this case study will cover token and GPU estimates, context management with summaries, resumable streams, tiered quotas and degradation during GPU shortages, and judging model updates with LLM graders and A/B tests.
