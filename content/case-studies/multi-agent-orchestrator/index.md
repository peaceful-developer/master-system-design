---
slug: multi-agent-orchestrator
title: Multi-agent workflow orchestrator
track: C
order: 37
difficulty: advanced
summary: Run 200,000 multi-step agent workflows a day, up to 4,000 at once, that survive crashes without repeating LLM or tool calls, using durable step history, queues and budgets.
concepts: [ai-agent, durable-execution, idempotency-key, tool-calling, message-queue, backpressure, human-in-the-loop, prompt-injection, llm-as-judge, context-window]
prerequisites: [support-agent, message-queue]
estimatedMinutes: 4
status: outline
exercises: []
diagram: multi-agent-orchestrator-hld
---

## Problem statement

Design a platform that runs workflows in which several LLM agents and tools work together on long tasks, in the style of agent platforms built on workflow engines such as Temporal. A typical run: a planner splits "research these 20 companies and draft a report" into sub-tasks, researcher agents work in parallel with web and database tools, and a writer drafts the report for a person to approve.

A run can take minutes to days and make hundreds of model and tool calls. Workers crash and deploys happen mid-run, but completed LLM calls are expensive and **not repeatable** (the model may answer differently), and tool calls have **side effects** such as sending email. Agents can also loop, overspend or be steered by text they read.

Questions to ask:

- Are workflows fixed graphs, or can agents create steps at run time?
- How long do runs last, and how many run at once?
- Which tools have side effects, and which steps need human approval?
- What budget limits apply per run (tokens, dollars, steps, time)?
- How will teams debug a run that went wrong?

## Requirements

**Functional**

- Define versioned workflows of agent steps (model, instructions, allowed tools), tool steps, parallel branches and approval gates; let a planner add sub-tasks at run time, within limits.
- Start runs by API or schedule; stream progress; pause, resume and cancel.
- Record every step's inputs, outputs, tokens and cost, and replay any run.
- Enforce per-run budgets for tokens, dollars, steps and wall-clock time.

**Non-functional**

- **Scale:** 200,000 runs per day averaging 10 minutes, 40 model calls and 30 tool calls each: about 1,400 runs active on average and 4,000 at peak, and up to 300 model calls per second.
- **Durability:** runs survive worker crashes and deploys; no completed step runs twice.
- **Overhead:** under 100 ms of scheduling per step.
- **Isolation:** tenants' data, tool credentials and code-running sandboxes are separated.

## Key concepts

- :term[AI agents]{id="ai-agent"}: each agent step is a loop of model and tool calls with narrow instructions and tools, which is easier to test than one agent that does everything.
- :term[Durable execution]{id="durable-execution"}: the orchestrator records each step's result before scheduling the next, so after a crash it rebuilds the run from history and reuses recorded model outputs instead of calling the model again.
- :term[Idempotency keys]{id="idempotency-key"}: side-effecting tools receive a key built from run and step ids, so a retry after a timeout doesn't send the email twice.
- :term[Tool calling]{id="tool-calling"}: a tool gateway holds per-tenant credentials and checks each call against the agent's allowed tools, so the model never sees secrets.
- :term[Message queues]{id="message-queue"}: ready steps wait in per-tenant queues, so workers scale on their own and one tenant's burst can't starve the rest.
- :term[Backpressure]{id="backpressure"}: when model providers return rate-limit errors, the scheduler slows dispatch for that model rather than failing runs.
- :term[Human in the loop]{id="human-in-the-loop"}: an approval gate parks the run with no worker attached and resumes it when a reviewer approves.
- :term[Prompt injection]{id="prompt-injection"}: a web page read by one agent can try to steer the next, so each agent gets only the tools its task needs, and risky actions sit behind approval gates.
- :term[LLM as a judge]{id="llm-as-judge"}: graders score final outputs and key steps on a suite of recorded tasks before a workflow version is promoted.

## High-level design

::diagram{id="multi-agent-orchestrator-hld"}

1. A client starts a run of a workflow version with inputs and a budget. The orchestrator appends a "run started" event to the run history and schedules the first steps.
2. Ready steps go onto per-tenant queues. Stateless agent workers take a step with a lease, load its inputs, run the agent loop through the LLM gateway and the tool gateway, and report the result. Large outputs go to artifact storage; later steps get summaries and references, not whole transcripts.
3. The orchestrator appends each result to the history, charges its tokens and cost to the budget, and decides what comes next: the following steps, parallel branches from a planner (at most 20), or a retry. If a worker dies, its lease expires and the step is retried.
4. Approval gates and budget limits pause or stop runs. A reviewer's decision arrives through the API and resumes the run from history.
5. Recorded runs feed the evaluation service: an LLM judge scores outputs and steps on a regression suite, and a new workflow or prompt version ships only if it matches the current one on quality, cost and step count.

The full version of this case study will cover event-sourced run state and replay, step leases and retry policies, budgets and loop detection, isolating tenants' tools and credentials, and evaluating multi-step runs.
