---
slug: code-assistant
title: Code assistant
track: C
order: 34
difficulty: intermediate
summary: Suggest code inline for 1 million developers within 500 ms at 15,000 requests per second, using a small fill-in-the-middle model with cached prefixes, plus repository-aware chat.
concepts: [fill-in-the-middle, latency-budget, debouncing, prefix-caching, speculative-decoding, rag, embedding, tool-calling, pass-at-k, ab-test]
prerequisites: [llm-inference-serving, enterprise-rag]
estimatedMinutes: 4
status: outline
exercises: []
diagram: code-assistant-hld
---

## Problem statement

Design a code assistant in the style of GitHub Copilot: an editor plugin that suggests the next lines as gray text while a developer types, plus a chat panel that answers questions and proposes edits across the repository.

The two features pull in opposite directions. Inline completion is a **latency** problem: a suggestion that arrives after the developer has typed on is wasted, so a small model must answer in a few hundred milliseconds. Chat and edits are a **context** problem: the right answer depends on code spread across a repository far larger than any prompt.

Questions to ask:

- How many developers, and how often does the editor ask for a completion?
- What latency makes a suggestion useful rather than distracting?
- Which languages and editors, and how large are the repositories?
- May code leave the customer's network, and is it retained or used for training?
- Should the assistant edit files and run commands, or only suggest?

## Requirements

**Functional**

- Inline completions: when the developer pauses, suggest the rest of the line or a block; accept it with one key.
- Chat about the repository and proposed edits shown as a diff the developer reviews.
- Respect exclusions: files or repositories an organization excludes are never sent.
- Record whether each suggestion was shown, accepted or edited away.

**Non-functional**

- **Scale:** 1 million daily developers, each sending about 500 completion requests a day: ~6,000 per second on average and 15,000 at peak; 20 chat requests per developer per day.
- **Prompt size:** about 2,000 tokens of code context per completion, and about 30 output tokens.
- **Latency:** completion p95 under 500 ms from request to suggestion; chat first token under 2 seconds.
- **Privacy:** code is processed in memory and not retained or used for training unless the organization opts in.
- **Availability:** 99.9%; when the service is slow, the editor shows no suggestion rather than blocking typing.

## Key concepts

- :term[Fill-in-the-middle]{id="fill-in-the-middle"}: the prompt holds the code before and after the cursor, so a suggestion fits the code that follows instead of duplicating it.
- :term[Latency budget]{id="latency-budget"}: 500 ms must cover the network round trip, queueing, processing 2,000 prompt tokens and generating about 30 tokens, which rules out large models for inline completion.
- :term[Debouncing]{id="debouncing"}: the plugin waits for a short pause and cancels stale requests as typing continues, and the server stops generating for canceled requests to free GPU time.
- :term[Prefix caching]{id="prefix-caching"}: consecutive requests from one file share a long common start, so routing a developer to the same replica reuses the cached prefix; at 30 million prompt tokens per second at peak, this is the biggest cost lever.
- :term[Speculative decoding]{id="speculative-decoding"}: code is repetitive, so cheap drafts, from a smaller model or from matching text already in the file, are often accepted and speed up generation.
- :term[Retrieval-augmented generation]{id="rag"}: chat retrieves the relevant files and symbols, because a large repository doesn't fit in one prompt.
- :term[Embeddings]{id="embedding"}: code chunks split along functions and classes are embedded for search by meaning, next to a symbol index for exact names.
- :term[Tool calling]{id="tool-calling"}: in edit mode, the model reads files, searches code and runs tests through tools in a sandbox before proposing a diff.
- :term[pass@k]{id="pass-at-k"}: offline evaluation runs generated code against unit tests, a far stronger check than text similarity to a reference.

## High-level design

::diagram{id="code-assistant-hld"}

1. After a short pause in typing, the plugin gathers context: code before and after the cursor, plus snippets from open tabs and imported files ranked by similarity, trimmed to about 2,000 tokens. It sends this to the nearest region and cancels the request if the developer keeps typing.
2. The completion service builds a fill-in-the-middle prompt and sends it to a small code model, routed by developer and file to reuse cached prefixes. Generation stops at the end of the line or block, and the service drops suggestions that don't parse or that contain secrets.
3. Chat and edit requests go to an agent that searches a code index, kept current by a background indexer, then calls a larger model that can read files and run tests in a sandbox. The developer gets an answer or a diff to review.
4. The plugin reports shown, accepted and edited-away suggestions. These feed online metrics, such as acceptance rate and the share of accepted code still present after 10 minutes, and A/B tests of new models. Offline, every candidate model must match or beat the current one on pass@1 over held-out repositories.

The full version of this case study will cover ranking context snippets within the token budget, cancellation and its effect on GPU load, repository indexing at scale, sandboxing agent-run code, and measuring quality with pass@k and retained-code metrics.
