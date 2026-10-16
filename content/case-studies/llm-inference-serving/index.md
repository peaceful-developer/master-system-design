---
slug: llm-inference-serving
title: LLM inference serving at scale
track: C
order: 32
difficulty: advanced
summary: Serve a 70B model at 200 requests per second with fast first tokens, sizing GPUs from memory and KV cache, and cutting cost with batching, caching and quantization.
concepts: [prefill-and-decode, kv-cache, continuous-batching, time-to-first-token, tensor-parallelism, quantization, speculative-decoding, token, littles-law]
prerequisites: [rate-limiter]
estimatedMinutes: 19
status: complete
exercises: [llm-inference-serving-quiz, llm-serving-estimation]
diagram: llm-inference-serving-hld
---

## Problem statement

Design the system that serves a large language model (an open-weights model with 70 billion parameters) behind a chat product and an API. At peak it must handle 200 requests per second, start streaming each answer quickly, keep the words flowing at a readable pace, and do it at a cost per request the business can afford.

LLM serving breaks intuitions from ordinary web services. A request isn't a millisecond of CPU; it's seconds of GPU time producing hundreds of tokens one by one, and the hardware is limited by **memory**, both its size and its bandwidth, more than by compute. Good designs follow from that.

:::primer
A language model writes one **token** (a word or part of a word) at a time. Each new token requires reading all of the model's weights from GPU memory. Serving many users at once means:

- **Batching:** generating the next token for many requests in the same pass, so one read of the weights serves many users.
- **KV cache:** remembering intermediate results for every token already processed, so each step doesn't start over. It takes a lot of GPU memory.
:::

Questions to ask:

- Which model, at what precision? Must outputs match a reference exactly, or is quantization acceptable?
- Prompt and output lengths: averages and maximums (context window)?
- Latency targets: time to first token, and tokens per second while streaming?
- Traffic shape: peak versus average, burstiness, priority tiers (paid versus free)?
- Hardware: which GPUs, how many per machine, cloud or own data center?

## Requirements

**Functional**

- Accept chat and completion requests, stream tokens back, and report token usage.
- Support up to 8,000 tokens of context per request.
- Enforce per-tenant quotas and priority (interactive traffic before batch jobs).
- Roll out new model versions and configurations without downtime.

**Non-functional**

- **Throughput:** 200 requests per second at peak; average 1,000 prompt tokens and 300 output tokens.
- **Latency:** :term[time to first token]{id="time-to-first-token"} under 1 second at p95 for interactive traffic; at least 20 output tokens per second per stream (≤ 50 ms per token).
- **Availability:** 99.9%; overload degrades with clear 429s and queueing, not timeouts.
- **Cost:** report and minimize cost per 1,000 requests and per million output tokens.

## Back-of-envelope estimates

Every input is an assumption, typical of 2024–2026 hardware and 70B-class models; benchmark your own.

**Memory per replica**

| Quantity | Calculation | Result |
| --- | --- | --- |
| Weights | 70B parameters × 2 bytes (BF16) | 140 GB: more than one 80 GB GPU |
| Replica size | 4 GPUs × 80 GB, :term[tensor parallel]{id="tensor-parallelism"} | 320 GB total |
| Room for KV cache | 320 − 140 − ~30 GB working memory | ~150 GB |
| KV cache per token | 2 (K and V) × 80 layers × 8 KV heads × 128 dims × 2 bytes | ~0.33 MB |
| KV per request | 1,300 tokens × 0.33 MB | ~430 MB |

**Traffic and fleet size**

| Quantity | Calculation | Result |
| --- | --- | --- |
| Token rates at peak | 200 × 1,000 in, 200 × 300 out | 200,000 input and 60,000 output tokens per second |
| Request duration | ~0.5 s to first token + 300 tokens × 40 ms | ~12.5 s |
| Requests in flight | :term[Little's law]{id="littles-law"}: 200 per second × 12.5 s | ~2,500 sequences |
| Replicas | 60,000 output tokens per second ÷ ~2,500 per replica, × 1.3 headroom | ~32 replicas = 128 GPUs |
| Sequences per replica | 2,500 ÷ 32 | ~78, needing ~34 GB of KV cache, well under 150 GB |
| Prefill load per replica | 200,000 ÷ 32 = 6,250 tokens per second × 2 × 70B FLOPs | ~0.9 PFLOP/s, a large share of its compute |

**Cost** (assuming $2.50 per GPU-hour)

| Quantity | Calculation | Result |
| --- | --- | --- |
| Fleet | 128 GPUs × $2.50 | $320 per hour |
| Per 1,000 requests at peak | $320 ÷ 720 (thousand requests per hour) | ~$0.44 |
| Per 1,000 requests, averaged | if average load is 40% of peak and the fleet stays up | ~$1.11 |
| Per million output tokens at peak | $320 ÷ 216M output tokens per hour | ~$1.48 |

**What the numbers say:** the weights decide the replica size (4 GPUs), the output token rate decides the number of replicas, and KV cache memory decides how many requests each replica can batch. Idle capacity at night more than doubles cost per request, so autoscaling and quantization are the biggest cost levers.

## API design and data model

```http
POST /v1/chat/completions
Authorization: Bearer <tenant key>
{ "model": "chat-70b", "messages": [ … ], "max_tokens": 500, "stream": true, "priority": "interactive" }

200 OK (text/event-stream)
data: {"delta": "Sure"}
data: {"delta": ", here's"}
…
data: {"usage": {"prompt_tokens": 1012, "completion_tokens": 288}}
```

Overload returns `429` with `Retry-After`; requests exceeding the context window return `400` before any GPU work.

**Data:** a model registry entry per deployable version (weights location, precision, parallelism, engine settings, approved eval results); a request log with tenant, token counts, queue time, time to first token, total time and replica, which feeds billing, capacity planning and debugging.

## High-level design

::diagram{id="llm-inference-serving-hld"}

1. The **API gateway** authenticates, applies per-tenant quotas, and rejects oversized requests. Exact repeats of recent prompts (rare for chat, common for some API uses) can be answered from a response cache.
2. The **router** keeps a queue per priority, applies admission control, and sends each request to a replica, preferring one that already holds the same prompt prefix (such as a shared system prompt) in its cache.
3. Each **model replica** is 4 GPUs running an inference engine with continuous batching and paged KV cache memory. It streams tokens back through the router.
4. The **autoscaler** watches queue depth and time to first token, adding replicas (which take minutes to load weights) or draining them gracefully.
5. New versions are approved by **quality evals** in the registry, then rolled out replica by replica.

## Deep dives

### Prefill, decode and continuous batching

::figure{id="prefill-decode" caption="Prefill processes the whole prompt at once; decode then produces one token per step for every sequence in the batch."}

Generation has two :term[phases]{id="prefill-and-decode"}:

- **Prefill** runs the whole prompt through the model in parallel. It's compute-bound and determines time to first token.
- **Decode** produces one token per step. Each step must read every weight from memory, so a single sequence wastes most of the GPU's compute.

Batching fixes decode: one read of the weights produces the next token for every sequence in the batch. Old-style static batching waited for a whole batch to finish, leaving GPUs idle as short answers completed. :term[Continuous batching]{id="continuous-batching"} adds and removes sequences at every step, keeping the batch full.

Prefill can still hurt: a 6,000-token prompt joining the batch stalls every other stream for that step. Engines split long prompts into chunks processed alongside decode steps (chunked prefill); very large deployments run prefill and decode on separate GPU pools so each can be tuned for its own bottleneck.

### KV cache memory

The :term[KV cache]{id="kv-cache"} grows with every token of every sequence, and it's what limits batch size. Allocating each request's maximum context up front (8,000 tokens × 0.33 MB = 2.6 GB) would fit only ~57 requests in 150 GB, mostly wasted. **Paged** KV memory allocates small fixed-size blocks as sequences grow, like virtual memory, so ~78 average requests use ~34 GB and the rest stays free for bursts and long prompts.

Two more savings:

- **Prefix caching:** requests sharing a system prompt reuse its KV blocks instead of recomputing them. Routing requests with the same prefix to the same replica makes hits likely.
- **Eviction and preemption:** when memory runs out, pause the lowest-priority sequences and recompute their cache later, rather than failing requests.

### Parallelism and precision

- **Tensor parallelism** splits each layer across the 4 GPUs of a replica; it needs fast GPU-to-GPU links (within one machine) because it communicates on every layer.
- More replicas, not bigger ones, scale throughput; each replica is independent.
- :term[Quantization]{id="quantization"} to 8-bit weights halves weight memory (70 GB): a replica fits on 2 GPUs with more room for KV cache, and decode steps read half as many bytes. It roughly halves cost per token. 4-bit goes further but needs careful quality checks. Every precision change must pass the eval suite before release.

### Scheduling, autoscaling and overload

- **Admission control:** if queues would push time to first token past the SLO, reject early with 429 rather than accept work that will time out.
- **Priorities:** interactive requests preempt batch jobs; batch work fills idle capacity at night, raising utilization.
- **Fairness:** per-tenant quotas in tokens per minute, not requests, because requests vary 100× in cost.
- **Autoscaling:** scale on queue depth and time to first token; keep a warm pool because loading 140 GB of weights takes minutes. Pre-scale for known daily peaks.

:::deeper[Why decode is memory-bound, in numbers]
Each decode step reads all weights: 140 GB spread over 4 GPUs is 35 GB per GPU. At about 3 TB/s of memory bandwidth per GPU, that takes roughly 12 ms, plus reading each sequence's KV cache (34 GB per replica, ~3 ms per GPU) and communication overhead: about 20 ms per step. In that step, the replica produces one token for **each** of its ~78 sequences: ~3,900 tokens per second, while each user still sees ~50 tokens per second. Without batching, the same 20 ms would produce one token. The arithmetic per step is tiny compared to the data moved, which is why batch size (limited by KV memory), quantization (fewer bytes per weight) and :term[speculative decoding]{id="speculative-decoding"} (verifying several draft tokens per weight read) are the main throughput levers, and why our 2,500 tokens per second per replica estimate is conservative.
:::

## ML/LLM design

- **Model choice:** a 70B model meets the quality bar on the product's eval suite; a smaller model is evaluated for simpler traffic (classification, short answers), routed by request type.
- **Precision:** BF16 baseline; FP8 weights after confirming no measurable drop on task evals and human preference tests.
- **Decoding:** temperature and top-p per product surface; speculative decoding with a small draft model where it speeds up decode without changing outputs.
- **Data and evaluation sources:** curated prompts per use case, sampled anonymized production prompts (with consent), and safety test sets.
- **Training:** none in this system; it serves versions produced by training pipelines, each registered with eval results.
- **Serving:** inference engine with continuous batching, paged KV cache, prefix caching and streaming; 4-way tensor parallelism per replica.
- **Offline metrics:** task quality and safety on the eval suites (per version and precision); latency benchmarks of time to first token and time per output token at target load; throughput at SLO ("goodput").
- **Online metrics:** p50/p95 time to first token and tokens per second per stream; error, timeout and 429 rates; GPU utilization and KV memory usage; cost per 1,000 requests and per million tokens; user ratings by model version.

## Trade-offs

| Decision | Alternative | Why this choice |
| --- | --- | --- |
| 4-GPU tensor-parallel replicas | One large replica across many machines | Fits the weights with KV headroom; scale out with more replicas |
| Continuous batching | Static batches | Keeps GPUs busy; finished sequences don't hold up the batch |
| Paged KV cache | Reserve max context per request | Several times more concurrent sequences per replica |
| FP8 weights after eval | Always BF16 | About half the cost per token when quality holds |
| Reject early under overload | Queue everything | Fast, honest failures instead of timeouts that waste GPU time |
| Warm pool plus scheduled scaling | Purely reactive autoscaling | Model load takes minutes; reactive scaling arrives too late |

## Failure modes, scaling and monitoring

- **GPU or machine failure:** the whole 4-GPU replica fails; the router stops sending to it, in-flight streams error and clients retry. Keep spare capacity (the 1.3× headroom).
- **Long-prompt storms:** many huge prompts at once spike prefill and stall streams. Chunked prefill, per-tenant token quotas and separate queues for long requests contain it.
- **KV memory exhaustion:** preempt low-priority sequences; alert when preemption rate rises.
- **Bad model version:** quality regressions slip past benchmarks. Roll out to a small share first and compare ratings and error rates before continuing.
- **Capacity shortage:** GPUs can't be added instantly. Shed batch traffic first, then lower `max_tokens` for free tiers, then return 429s.

**Monitor:** queue depth and wait per priority; time to first token and time per output token (p50/p95); tokens per second per replica; batch size; KV memory use and preemptions; GPU utilization and errors; cost per 1,000 requests. SLOs: 95% of interactive requests get their first token within 1 second; 99% of streams stay above 20 tokens per second.

## Real-world references

- Kwon et al., *Efficient Memory Management for Large Language Model Serving with PagedAttention* (SOSP 2023, arXiv 2309.06180): paged KV cache memory, the basis of vLLM.
- Yu et al., *Orca: A Distributed Serving System for Transformer-Based Generative Models* (OSDI 2022): iteration-level scheduling, known today as continuous batching.
- Leviathan, Kalman and Matias, *Fast Inference from Transformers via Speculative Decoding* (ICML 2023, arXiv 2211.17192).
- Pope et al., *Efficiently Scaling Transformer Inference* (MLSys 2023, arXiv 2211.05102): partitioning and the memory-bandwidth analysis of decoding.
- Dao et al., *FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness* (NeurIPS 2022, arXiv 2205.14135).

## 45-minute interview version

1. **Requirements (5 min):** 70B model, 200 requests per second, 1,000 in and 300 out tokens, TTFT under 1 s, 20+ tokens per second per stream, cost per request matters.
2. **Estimates (8 min):** 140 GB of weights so 4-GPU replicas; 0.33 MB of KV per token; 2,500 sequences in flight by Little's law; ~32 replicas, 128 GPUs; ~$0.44–1.11 per 1,000 requests.
3. **Design (7 min):** gateway with quotas, router with priority queues and prefix-aware routing, replicas with continuous batching, autoscaler, registry and evals.
4. **Deep dives (17 min):** prefill versus decode and continuous batching; paged KV cache and prefix caching; tensor parallelism and quantization; admission control and autoscaling.
5. **Failures and metrics (6 min):** replica loss, long-prompt storms, KV exhaustion, rollout safety; TTFT, TPOT and cost dashboards.
6. **Wrap-up (2 min):** next steps such as disaggregated prefill/decode, speculative decoding, or routing easy requests to a smaller model.

:::interview
The strongest signal here is reasoning from hardware: size replicas from weight memory, batch size from KV cache memory, and throughput from memory bandwidth. Use Little's law to get concurrency, and give cost per request with your assumptions stated. Then show operational judgement: admission control, priorities, warm pools, and evaluating quantization before shipping it.
:::

## Practice

::quiz{id="llm-inference-serving-quiz"}

::drill{id="llm-serving-estimation"}
