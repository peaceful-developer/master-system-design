---
slug: ml-training-platform
title: ML training platform
track: B
order: 27
difficulty: advanced
summary: Run 5,000 training jobs a day for 300 engineers on a shared 2,000-GPU cluster, with quota-aware gang scheduling, checkpoints, tracked runs and an evaluation gate before the model registry.
concepts: [gang-scheduling, data-parallelism, all-reduce, tensor-parallelism, checkpointing, model-registry, offline-evaluation, feature-store, data-drift]
prerequisites: [video-recommendations, feature-store]
estimatedMinutes: 3
status: outline
exercises: []
diagram: ml-training-platform-hld
---

## Problem statement

Design an internal ML training platform in the style of Uber's Michelangelo or Meta's FBLearner Flow. Engineers submit training code and a config; the platform finds GPUs, runs the job, records everything about the run, and turns the result into an evaluated, versioned model that serving can deploy.

The hard part is sharing a scarce, expensive cluster. Distributed jobs need many GPUs at once, teams compete for capacity, and multi-day jobs must survive hardware failures. Yet every production model must trace back to the exact code, data and settings behind it.

Questions to ask:

- How many users and jobs per day, and how large are the biggest jobs?
- Which model types: gradient-boosted trees on CPU, deep rankers on GPU, LLM fine-tuning?
- How are GPUs shared between teams, and may one job preempt another?
- What must be reproducible, and for how long?
- Does this platform deploy models, or hand off to a separate serving platform?

## Requirements

**Functional**

- Submit a job as a container image, config, data snapshot and resource request; run single-GPU and multi-node jobs.
- Run hyperparameter sweeps that stop poor trials early.
- Track every run: code commit, data snapshot, config, metrics and artifacts.
- Scheduled retraining pipelines: validate data, train, evaluate against production, register.

**Non-functional**

- **Scale:** 2,000 GPUs (250 nodes of 8); 300 users; 5,000 jobs per day, most on 1 to 8 GPUs, the largest on 256 GPUs for up to 3 days.
- **Utilization:** over 80% of GPUs allocated at busy times; idle jobs are detected and stopped.
- **Fairness:** each team has a guaranteed quota; idle quota can be borrowed and is reclaimed within 10 minutes.
- **Reliability:** a failure or preemption loses at most 30 minutes of work.
- **Reproducibility:** any registered model can be retrained from its recorded inputs for 2 years, to within run-to-run noise.

## Key concepts

- :term[Gang scheduling]{id="gang-scheduling"}: a 64-GPU job is placed all at once or not at all, ideally in one fast network domain; starting 60 of 64 workers only holds GPUs idle.
- :term[Data parallelism]{id="data-parallelism"}: most ranking and vision jobs scale by giving each GPU a copy of the model and a slice of every batch.
- :term[All-reduce]{id="all-reduce"}: workers average gradients after every step. Each sends and receives about twice the gradient size, so large models need fast links and careful placement.
- :term[Tensor parallelism]{id="tensor-parallelism"}: a model too large for one GPU has its weight matrices split across the GPUs of one node, using the fast links inside the node.
- :term[Checkpointing]{id="checkpointing"}: weights and optimizer state go to object storage every 30 minutes, so a failed or preempted job resumes instead of restarting. At 256 GPUs for 3 days, a failure is likely enough to plan for.
- :term[Feature store]{id="feature-store"}: jobs read versioned, point-in-time-correct snapshots built from the same definitions serving uses.
- :term[Data drift]{id="data-drift"}: retraining pipelines check row counts and feature distributions first, and stop when an input looks broken or shifted.
- :term[Offline evaluation]{id="offline-evaluation"}: each candidate is scored against the production model on the same time-based holdout and key slices; worse models never reach the registry.
- :term[Model registry]{id="model-registry"}: stores each version with its lineage and stage, so serving deploys a known artifact and can roll back.

## High-level design

::diagram{id="ml-training-platform-hld"}

1. An engineer, or a nightly retraining pipeline, submits a job: image, config, data snapshot and resources such as 64 GPUs. The training API records the run.
2. The scheduler queues the job under its team's quota and places all of its workers at once on nodes that share a fast network domain. When a team reclaims lent quota, borrowing jobs checkpoint and are preempted.
3. Workers read the snapshot from the feature store, train with data parallelism (adding tensor parallelism when needed), stream metrics to run tracking, and checkpoint every 30 minutes. If a node fails, the gang restarts from the last checkpoint on healthy nodes.
4. When training ends, the evaluation service scores the final model on the holdout and slices, next to the production model.
5. Models that pass are registered with full lineage. The serving platform deploys from the registry, and production metrics and drift alerts trigger the next retraining run.

The full version of this case study will cover scheduler design (quotas, priorities, preemption and topology-aware placement), distributed training strategies and their network cost, checkpoint size and recovery time, hyperparameter sweeps, and reproducibility.
