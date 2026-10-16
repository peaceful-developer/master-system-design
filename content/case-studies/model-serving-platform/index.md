---
slug: model-serving-platform
title: Model serving platform
track: B
order: 28
difficulty: advanced
summary: Serve 500 models from 40 teams at 300,000 requests per second with under 5 ms of platform overhead, using CPU and GPU pools, dynamic batching, and shadow and canary rollouts.
concepts: [model-registry, dynamic-batching, quantization, shadow-deployment, canary-release, horizontal-scaling, tail-latency, training-serving-skew, data-drift]
prerequisites: [video-recommendations, ml-training-platform]
estimatedMinutes: 3
status: outline
exercises: []
diagram: model-serving-platform-hld
---

## Problem statement

Design a shared model serving platform in the style of Uber's Michelangelo serving, KServe or SageMaker endpoints. A team picks a model version from the registry, and the platform turns it into a fast, monitored prediction endpoint that product services can call, with safe rollouts and one-step rollback.

The hard part is variety under one set of guarantees. Models range from small tree ensembles on CPU to deep rankers that need GPUs. Each has its own latency budget and traffic shape. One team's bad deploy or traffic spike must not hurt anyone else, and expensive GPUs must stay busy.

Questions to ask:

- How many models, in which frameworks, and how large?
- What are peak request rates and latency budgets per model?
- Online only, or batch scoring too?
- Does the platform fetch features, or do callers send them?
- Who decides when a rollout proceeds: the owning team or automated checks?

## Requirements

**Functional**

- Deploy any registered model version as an endpoint by changing a config; roll back in one step.
- Online predictions over gRPC, with up to 500 items scored per request.
- Traffic splits: shadow copies, canary percentages and A/B tests.
- Optional feature lookup by entity keys.
- Log inputs, outputs and model version, sampled for the busiest models.

**Non-functional**

- **Scale:** 500 models from 40 teams; 300,000 requests per second at peak across all models.
- **Latency:** platform overhead under 5 ms at p99; model budgets from 10 to 50 ms at p99.
- **Availability:** 99.99% per endpoint; one model's failure or spike cannot affect another.
- **Efficiency:** GPU utilization above 60%; small models share machines.
- **Safety:** automatic rollback within 5 minutes of a canary regression.

## Key concepts

- :term[Model registry]{id="model-registry"}: an endpoint config names a registry version, so what runs is always traceable to its code, data and metrics.
- :term[Dynamic batching]{id="dynamic-batching"}: GPU servers hold requests for up to 2 to 5 ms and run them as one batch, often multiplying throughput; the wait is tuned per model against its budget.
- :term[Quantization]{id="quantization"}: 8-bit weights cut memory and latency for large models, shipped only after an offline check shows quality holds.
- :term[Shadow deployment]{id="shadow-deployment"}: a new version gets a copy of live traffic and its outputs are logged but not used, proving latency and sane predictions without user impact.
- :term[Canary releases]{id="canary-release"}: the version then serves 1% of traffic, and automated checks compare it with the current version before it gets more.
- :term[Horizontal scaling]{id="horizontal-scaling"}: replicas scale per model with load. GPU replicas take minutes to start, so pools keep headroom and also scale on forecasts.
- :term[Tail latency]{id="tail-latency"}: a caller that fans out to several models waits for the slowest, so each call has a timeout and a fallback score.
- :term[Training–serving skew]{id="training-serving-skew"}: logged inputs are compared with training data, so preprocessing mismatches and :term[data drift]{id="data-drift"} show up as distribution gaps.

## High-level design

::diagram{id="model-serving-platform-hld"}

1. A team registers a model version and edits its endpoint config, for example "ranker v42 at 1%". The deployer packages it with the matching runtime, starts replicas in the CPU or GPU pool, waits for health checks, and can run it in shadow first.
2. A caller sends a predict request with entity keys and candidates. The inference API authenticates it, fetches features, picks a version by the traffic split, and enforces the model's timeout.
3. Model servers batch requests dynamically and run them. Small tree models share CPU machines; large networks get GPUs, quantized where offline checks allow.
4. The API logs inputs, outputs and versions. The drift monitor compares the canary with the current version on errors, latency and prediction distribution, and compares inputs with training data.
5. If the canary regresses, the deployer rolls it back automatically; otherwise it widens to 10%, 50% and 100%. Logged predictions, joined later with outcomes, become training data for the next version.

The full version of this case study will cover packaging and runtimes per framework, autoscaling GPU pools with slow cold starts, tuning batch size against latency, multi-tenant isolation and cost attribution, and automated canary analysis.
