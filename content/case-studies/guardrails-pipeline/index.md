---
slug: guardrails-pipeline
title: Guardrails and safety pipeline
track: C
order: 40
difficulty: intermediate
summary: Screen 5,000 LLM requests per second for harmful content, prompt injection and data leaks in under 100 ms, using a cascade of rules, small classifiers and an LLM judge on input and streamed output.
concepts: [guardrails, prompt-injection, jailbreak, pii-redaction, red-teaming, latency-budget, server-sent-events, hallucination, rate-limiting, offline-evaluation, shadow-deployment]
prerequisites: [enterprise-rag, llm-eval-platform]
estimatedMinutes: 4
status: outline
exercises: []
diagram: guardrails-pipeline-hld
---

## Problem statement

Design the :term[guardrails]{id="guardrails"} that wrap every LLM call in a company's products, in the style of the moderation layer behind a consumer chat assistant. They check what goes into the model and what comes out: they block harmful requests, catch attempts to override the model's instructions, remove personal data, and stop answers that leak secrets or break policy.

What makes it hard is that every check adds latency before the first token, and answers stream, so the output can't be checked as a whole before the user starts reading. Attackers adapt to whatever you block. False positives annoy honest users; misses cause incidents.

Questions to ask:

- Which harms matter most: violence, self-harm, illegal activity, personal data, brand risk? Do policies differ per product or tenant?
- How much latency may checks add before the first token?
- Must answers stream, and how far may the displayed text lag behind the model?
- What happens on a block: refuse, rewrite, or escalate to a person?
- Which languages, and what traffic volume?

## Requirements

**Functional**

- Input checks: harm categories, prompt injection and jailbreak detection, PII detection and redaction, per-tenant rules such as blocked topics.
- Output checks on streamed text: harm categories, leaked secrets and PII, and grounding of RAG answers in their sources.
- Policy per product and tenant: thresholds and an action for each category (allow, redact, refuse, flag for review).
- Log every decision with its scores; send borderline cases and user appeals to human review.

**Non-functional**

- **Scale:** 5,000 LLM requests per second at peak, averaging 400 output tokens each: 2 million output tokens per second to check.
- **Latency:** input checks add under 100 ms at p95; streamed text stays at most one sentence behind the model.
- **Accuracy:** block at least 95% of a held-out red-team test set while wrongly blocking under 1% of benign traffic, measured per category.
- **Availability:** 99.95%. If the safety service fails, high-risk products fail closed (refuse) and low-risk ones fail open with logging.
- **Agility:** a policy change reaches every region within 5 minutes.

## Key concepts

- :term[Prompt injection]{id="prompt-injection"}: retrieved documents and tool results can carry hidden instructions, so the input guard scans them as well as the user's message.
- :term[Jailbreaks]{id="jailbreak"}: attackers rephrase, role-play or spread a request over many turns, so classifiers read the recent conversation, not only the last message.
- :term[PII redaction]{id="pii-redaction"}: masks card numbers, emails and ID numbers before prompts reach a third-party model or the logs, and catches them in outputs.
- :term[Latency budget]{id="latency-budget"}: rules take about 1 ms and small classifiers about 20 ms in parallel; only the uncertain 5% of requests pay for a slower LLM judge.
- :term[Server-sent events]{id="server-sent-events"}: answers stream to the user token by token, so the output guard checks chunks as they are produced and holds back about a sentence.
- :term[Hallucination]{id="hallucination"} checks: for RAG answers, a grounding check confirms that claims and citations come from the retrieved passages.
- :term[Rate limiting]{id="rate-limiting"}: users who keep triggering blocks get throttled, which makes probing for weak spots slow.
- :term[Red-teaming]{id="red-teaming"}: in-house and automated attacks produce fresh examples for both the training data and the test sets.
- :term[Offline evaluation]{id="offline-evaluation"}: each classifier version is scored per category on labeled data, then runs in :term[shadow mode]{id="shadow-deployment"} on live traffic before it enforces.

## High-level design

::diagram{id="guardrails-pipeline-hld"}

1. The chat service sends each prompt, with the recent conversation and any retrieved documents, to the input guard. Cheap rules run first: block lists and patterns for secrets and card numbers. Small classifiers for harm, prompt injection and jailbreaks then run in parallel on GPUs; uncertain scores go to an LLM judge.
2. The input guard turns scores into an action using the policy for that product and tenant: allow, redact PII, refuse with a safe message, or allow with a stricter system prompt.
3. Allowed prompts go to the LLM. Its output streams through the output guard, which holds back about one sentence and checks each chunk for harmful content, leaked secrets or PII, and unsupported claims in RAG answers. If a chunk fails, the stream stops and a refusal replaces it; the held-back text never reaches the user.
4. Every decision, score and policy version goes to the audit log. Borderline cases and appeals go to human reviewers. Their labels, plus new red-team attacks, retrain the safety models, and each new version is shadow-tested before it enforces.

The full version of this case study will cover the classifier cascade and its thresholds, checking streamed output without hurting latency, defenses against prompt injection in agents that call tools, fail-open versus fail-closed policies, and measuring false positives per category.
