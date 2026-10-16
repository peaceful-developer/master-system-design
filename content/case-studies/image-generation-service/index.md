---
slug: image-generation-service
title: Image generation service
track: C
order: 50
difficulty: intermediate
summary: Turn 2 million prompts a day into 8 million images, with priority job queues feeding a fleet of about 700 GPUs, safety checks on prompts and images, and provenance marks on every output.
concepts: [diffusion-model, message-queue, backpressure, dynamic-batching, quantization, guardrails, content-provenance, object-storage, cdn, idempotency-key, offline-evaluation]
prerequisites: [llm-inference-serving]
estimatedMinutes: 4
status: outline
exercises: []
diagram: image-generation-service-hld
---

## Problem statement

Design a text-to-image service in the style of Midjourney or an image generation API. A user types "a lighthouse at dusk in watercolor", and within about 15 seconds sees 4 candidate images, then picks one to upscale or vary.

Each image costs seconds of GPU time, so the system is mostly about scheduling scarce GPUs: keeping them busy, serving paid users first, and absorbing sudden spikes. Safety is a hard requirement too. Some prompts must never be run, some outputs must never be shown even when the prompt looked harmless, and every image should be marked as AI-generated.

Questions to ask:

- What resolution, and how many images per prompt? Are edits in scope?
- What wait is acceptable for each tier: seconds for paid users, minutes for free ones?
- Which content policy applies, and what happens to blocked requests?
- Do we serve one model or several, and how often do new versions ship?

## Requirements

**Functional**

- Submit a prompt with options (aspect ratio, style, optional reference image) and receive 4 images; upscale or vary any of them.
- See progress and a low-resolution preview while generating; keep results in a personal gallery.
- Block unsafe prompts and unsafe images; mark every output as AI-generated.
- Priority tiers ("fast" for paid, "relaxed" for free) and per-user rate limits.
- An asynchronous API: submit a job, then poll or receive a webhook.

**Non-functional**

- **Scale:** 2 million prompts per day at 4 images each, 8 million images per day; about 280 images per second at peak.
- **Latency:** fast-tier jobs finish within 15 seconds at p95, queueing included; relaxed jobs within 2 minutes at peak.
- **Capacity:** about 2 GPU-seconds per 1024 × 1024 image (an assumption to benchmark), so peak needs about 560 busy GPUs and a fleet of about 700 with headroom.
- **Availability:** 99.9% for job submission; accepted jobs are never lost.
- **Safety:** zero known policy-violating images delivered; every output carries a watermark and signed provenance.

## Key concepts

- :term[Diffusion model]{id="diffusion-model"}: an image is made by 20 to 50 denoising steps of a large network, so GPU time, cost and latency all grow with step count and resolution.
- :term[Message queue]{id="message-queue"}: jobs wait in per-tier, per-model queues, so GPUs pull work at their own pace and paid jobs go first.
- :term[Backpressure]{id="backpressure"}: when the estimated wait for a tier passes its limit, the API slows free users or returns a retry time instead of accepting work it can't finish.
- :term[Dynamic batching]{id="dynamic-batching"}: workers group queued jobs that share a model and resolution into one batch, trading a little latency for more images per GPU-second.
- :term[Quantization]{id="quantization"}: 8-bit weights, together with distilled models that need only 4 to 8 steps, cut GPU time several times over, if each change passes quality checks.
- :term[Guardrails]{id="guardrails"}: a prompt classifier blocks requests before they reach a GPU, and an image classifier checks every output, since harmless prompts can still yield unsafe images.
- :term[Content provenance]{id="content-provenance"}: an invisible watermark plus signed metadata let platforms and users identify images as AI-generated later.
- :term[Object storage]{id="object-storage"} and a :term[CDN]{id="cdn"}: finished images are stored once and served from the edge, because gallery and share views far outnumber generations.
- :term[Idempotency keys]{id="idempotency-key"}: a client that retries a submit after a timeout must not start a duplicate job, which would double GPU cost and the user's charge.
- :term[Offline evaluation]{id="offline-evaluation"}: each new model or sampler is scored on a fixed prompt set for prompt adherence, image quality and human preference before release.

## High-level design

::diagram{id="image-generation-service-hld"}

1. The image API authenticates the user, applies rate limits and the idempotency key, and runs the prompt filter. Accepted jobs get an id in the job store and the API returns at once; clients follow progress over a WebSocket or by polling, and API users can get a webhook.
2. Jobs go to queues by tier and model. GPU workers, each with its model already loaded, pull jobs, batch compatible ones, run the denoising steps, and post a preview halfway through. The autoscaler adds workers based on queue depth and estimated wait.
3. Each finished image passes the image filter. Blocked images are discarded; safe ones get a watermark and provenance metadata, are written to object storage, and are served through the CDN.
4. Which of the 4 images users upscale, download or regenerate is logged as preference data. New models and samplers reach the workers only after passing offline evals, then roll out behind an A/B test.

The full version of this case study will cover GPU fleet sizing and cost per image, batching and scheduling across tiers, step distillation and quantization, the safety pipeline for prompts and images, and measuring quality with automatic metrics and human preference.
