---
slug: fine-tuning-platform
title: Multi-tenant fine-tuning platform
track: C
order: 41
difficulty: advanced
summary: Let 5,000 tenants fine-tune open models on private data, running 2,000 LoRA jobs a day on a shared GPU pool and serving 20,000 adapters on shared base-model replicas.
concepts: [fine-tuning, lora, quantization, gang-scheduling, data-parallelism, checkpointing, continuous-batching, offline-evaluation, token]
prerequisites: [llm-inference-serving, llm-eval-platform]
estimatedMinutes: 4
status: outline
exercises: []
diagram: fine-tuning-platform-hld
---

## Problem statement

Design a managed fine-tuning service in the style of the fine-tuning APIs offered by model providers. A customer uploads a few thousand example conversations, picks a base model, and soon calls a private tuned model through the same inference API as everyone else.

Four things make it hard. Thousands of small jobs and a few huge ones share one GPU pool, so scheduling must be fair and efficient. Tenants must never see or influence each other's data or models. A dedicated GPU replica per tuned model would be ruinously expensive. And a tuned model can be worse than the base, or less safe, without anyone noticing.

Questions to ask:

- Parameter-efficient tuning only, or full fine-tuning too? Which base model sizes?
- How many jobs per day, and how large is a typical dataset?
- How quickly must a job start and finish?
- How much traffic does a typical tuned model receive? Are most of them idle?
- What are the isolation and deletion rules for customer data?
- Who defines "better": the customer's validation set, platform evals, or both?

## Requirements

**Functional**

- Upload a dataset of chat examples; validate format, token count and content policy; show a cost estimate.
- Create a job: base model, method (LoRA by default, full fine-tuning for large customers), hyperparameters with safe defaults. Show status, loss curves and checkpoints.
- Evaluate every result before it can be deployed.
- Deploy a tuned model, callable by name through the inference API, with versions and rollback.

**Non-functional**

- **Scale:** 5,000 tenants and 2,000 jobs per day. A typical job is 10 million training tokens (5,000 examples × 1,000 tokens × 2 epochs) on an 8B model. 20,000 deployed adapters, most of them idle at any moment.
- **Turnaround:** jobs under 50 million tokens start within 10 minutes and finish within 2 hours.
- **Isolation:** each tenant's data and weights are encrypted with its own key and never used to train anything else; deletion requests complete within 30 days.
- **Serving cost:** a tuned model costs about the same per token as its base model; an idle one costs only storage.
- **Reliability:** a failed or preempted job loses at most 10 minutes of work.

## Key concepts

- :term[Fine-tuning]{id="fine-tuning"}: teaches a base model a tenant's format, tone and vocabulary from a few thousand examples, as a managed job.
- :term[LoRA]{id="lora"}: trains about 0.5% of an 8B model's parameters, so an adapter is tens of megabytes instead of 16 GB of weights, cheap to store and fast to load.
- :term[Quantization]{id="quantization"}: training adapters over a 4-bit copy of the base model fits a 70B model on far fewer GPUs.
- :term[Gang scheduling]{id="gang-scheduling"}: a full fine-tune may need 32 GPUs at once, so the scheduler reserves whole servers for it while packing single-GPU LoRA jobs into the gaps.
- :term[Data parallelism]{id="data-parallelism"}: large jobs split each batch across GPUs and average the gradients, with optimizer state sharded so full-weight training fits in memory.
- :term[Checkpointing]{id="checkpointing"}: saving adapter and optimizer state every 10 minutes lets the scheduler preempt low-priority jobs and survive node failures.
- :term[Continuous batching]{id="continuous-batching"}: one base-model replica serves requests for many different adapters in the same batch, computing the shared base layers once and each request's small adapter on top.
- :term[Offline evaluation]{id="offline-evaluation"}: a tuned model must beat its base on the tenant's validation set and still pass safety and general-skill suites, because fine-tuning can erode refusals.
- :term[Tokens]{id="token"}: jobs are priced and limited by training tokens, which also predict GPU time.

## High-level design

::diagram{id="fine-tuning-platform-hld"}

1. A tenant uploads a dataset. The API validates it, counts tokens, screens it for PII and policy violations, and stores it in object storage, encrypted with the tenant's key.
2. A new job enters the scheduler's queue with the tenant's priority and quota. A typical 10-million-token LoRA job fits on one GPU and takes under half an hour; multi-GPU jobs are gang-scheduled once all their GPUs are free.
3. Trainers stream the tenant's data, train the adapter and write checkpoints every 10 minutes. A preempted or failed job resumes from its last checkpoint.
4. The eval gate scores the finished adapter on the tenant's validation set and the platform's safety and regression suites. Only passing adapters are registered.
5. Inference replicas run the base model and load adapters on demand from the registry, keeping popular ones in GPU memory. The tenant calls the tuned model by name, and its requests share batches with other tenants' traffic.

The full version of this case study will cover fair-share scheduling with preemption, tenant isolation and verified deletion, multi-adapter serving and adapter caching, default hyperparameters and overfitting checks, and cost estimates per job.
