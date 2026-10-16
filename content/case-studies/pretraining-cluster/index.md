---
slug: pretraining-cluster
title: Distributed pretraining cluster
track: C
order: 42
difficulty: advanced
summary: Train a 70B-parameter model on 15 trillion tokens with 8,192 GPUs in under four weeks, combining three kinds of parallelism with fast checkpoints and automatic recovery from failures.
concepts: [data-parallelism, tensor-parallelism, pipeline-parallelism, all-reduce, model-flops-utilization, checkpointing, gang-scheduling, tail-latency, offline-evaluation]
prerequisites: [llm-inference-serving, fine-tuning-platform]
estimatedMinutes: 4
status: outline
exercises: []
diagram: pretraining-cluster-hld
---

## Problem statement

Design the system that trains a foundation model from scratch, in the style of the clusters behind open-weights families such as Llama: a 70B-parameter dense transformer trained on 15 trillion tokens, one run occupying thousands of GPUs for weeks.

The arithmetic is enormous: about 6 × 70 billion × 15 trillion = 6.3 × 10²⁴ floating-point operations. At this scale hardware fails every few hours, and training is synchronous, so one dead or slow GPU stalls all of them. Communication must hide behind computation, about 1 TB of training state must be saved often without stopping, and a loss spike can waste days of compute if nobody notices.

Questions to ask:

- What model size, architecture and token count? Is the compute budget fixed?
- Which GPUs and network, and for how long are they available?
- What is the data mix (web, code, books, other languages), and how is it filtered?
- How much lost work after a failure is acceptable?

## Requirements

**Functional**

- Train a 70B-parameter dense transformer on 15 trillion tokens of a defined data mix.
- Prepare data: deduplicate, filter for quality, remove PII, tokenize and shuffle, in a fixed order so a restart resumes at exactly the right token.
- Checkpoint and resume automatically after failures.
- Track loss, gradient norm and throughput per step; evaluate checkpoints on held-out benchmarks.
- Let researchers roll back, or change the data mix or learning rate, from any checkpoint.

**Non-functional**

- **Compute:** 8,192 GPUs (1,024 servers of 8), each with about 1,000 TFLOP/s of BF16 peak.
- **Efficiency:** at least 40% model FLOPs utilization, which puts pure training time at about 22 days.
- **Goodput:** at least 90% of wall-clock time goes to training that is kept, so the run finishes in under 4 weeks.
- **Failures:** plan for an interruption about every 6 hours; resume from the last checkpoint within 10 minutes.
- **Network:** NVLink inside each server; a dedicated RDMA fabric with 400 Gb/s per GPU between servers.
- **Storage:** about 60 TB of tokenized data (4 bytes per token); a checkpoint of weights plus optimizer state is about 1 TB.

## Key concepts

- :term[Tensor parallelism]{id="tensor-parallelism"}: splits each layer 8 ways across the GPUs of one server, where NVLink can carry its heavy per-layer traffic.
- :term[Pipeline parallelism]{id="pipeline-parallelism"}: splits the 80 layers into 4 stages on different servers; micro-batches keep every stage busy except for a small idle bubble each step.
- :term[Data parallelism]{id="data-parallelism"}: 256 copies of the model, 32 GPUs each, process different slices of every 16-million-token batch.
- :term[All-reduce]{id="all-reduce"}: averages gradients across the 256 copies every step, starting during the backward pass so communication overlaps compute.
- :term[Model FLOPs utilization]{id="model-flops-utilization"}: the headline efficiency number; each extra point saves about half a day of the whole cluster.
- :term[Checkpointing]{id="checkpointing"}: saving state every 30 minutes means a failure costs about 15 minutes of work on average, plus the restart.
- :term[Gang scheduling]{id="gang-scheduling"}: the job needs all 1,024 servers at once, so hot spares replace a failed server in minutes.
- :term[Tail latency]{id="tail-latency"}: every step waits for the slowest GPU, so one overheating or degraded GPU slows all 8,192; per-rank step times expose it.
- :term[Offline evaluation]{id="offline-evaluation"}: benchmark scores on each checkpoint, read with the loss curve, show early whether a data or hyperparameter change hurt the model.

## High-level design

::diagram{id="pretraining-cluster-hld"}

1. Data prep workers deduplicate, filter, strip PII from, tokenize and shuffle web, code and book sources into token shards in object storage. Training reads them at only about 32 MB/s.
2. Researchers launch a run. The scheduler gang-allocates 1,024 servers placed close together in the network, plus hot spares.
3. Each step processes 16 million tokens in about 2 seconds: tensor parallel 8 within a server, pipeline parallel 4 across servers, data parallel 256 across the rest, with gradients averaged by all-reduce.
4. Every 30 minutes, trainers copy weights and optimizer state to host memory in seconds, then write the 1 TB checkpoint to object storage in the background while training continues.
5. Health checks watch heartbeats, GPU error counters and per-rank step times. When a server fails or straggles, the scheduler swaps in a spare and the job restarts from the last checkpoint.
6. Eval workers score each checkpoint on held-out benchmarks. Loss, gradient norms and scores go to the run dashboard, so researchers catch loss spikes and roll back early.

The full version of this case study will cover choosing the parallelism layout from memory and network limits, asynchronous checkpointing and goodput, detecting silent data corruption and stragglers, loss spikes and their recovery, and the data pipeline and mixture.
