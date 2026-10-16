---
slug: assistant-memory
title: Long-term memory for assistants
track: C
order: 48
difficulty: intermediate
summary: Give a chat assistant with 100 million users memory across conversations, extracting facts after each turn and recalling the relevant few in under 100 ms, with user control and deletion.
concepts: [memory-extraction, memory-consolidation, embedding, vector-database, rag, context-window, prompt-injection, read-your-writes, offline-evaluation]
prerequisites: [chat-assistant, enterprise-rag]
estimatedMinutes: 4
status: outline
exercises: []
diagram: assistant-memory-hld
---

## Problem statement

Design long-term memory for a chat assistant, in the style of the memory in ChatGPT or Claude. When a user mentions that they are vegetarian or run Postgres 16 at work, the assistant should remember it in later conversations, use it when relevant, and let the user see, edit and delete what it knows.

Storing every message is easy; useful memory is not. Most of what people say isn't worth keeping, facts change ("I just moved to Berlin"), and recall must find the 5 relevant memories among a user's hundreds without adding noticeable delay. Memory also raises the stakes on privacy: deletion must be complete, sensitive details need care, and a web page the assistant reads must not plant false memories.

Questions to ask:

- Should the assistant remember only on request ("remember that …"), or also infer facts on its own?
- Do memories span all chats, or are they scoped to projects or workspaces?
- Which categories are sensitive, and how fast must deletion take effect?
- How much can recall add to time to first token?

## Requirements

**Functional**

- Save memories when asked and automatically from conversations, telling the user when something is saved.
- Recall relevant memories for each new message and use them in the answer.
- Replace a memory when the fact changes, instead of keeping both.
- List, edit and delete memories; turn memory off; temporary chats that neither read nor write memory.

**Non-functional**

- **Scale:** 100 million users with memory on, 20 million active per day; about 100 memories per user, so 10 billion memories and about 20 TB with vectors; 15,000 turns per second at peak.
- **Latency:** recall adds under 100 ms at p99; automatic extraction finishes within a minute of the turn.
- **Quality:** at least 90% of recalled memories judged relevant; under 2% outdated by a newer fact.
- **Privacy:** per-user isolation; a deleted memory stops being recalled within one minute and is purged from backups within 30 days.

## Key concepts

- :term[Memory extraction]{id="memory-extraction"}: after each turn, a small LLM decides whether anything durable was said and writes it as a short standalone fact, because raw transcripts make recall noisy and prompts long.
- :term[Memory consolidation]{id="memory-consolidation"}: each new fact is compared with similar stored ones, then added, merged, used to update an old one, or dropped, so "lives in Boston" doesn't outlive "just moved to Berlin".
- :term[Embeddings]{id="embedding"}: memories and incoming messages are embedded so recall works by meaning, connecting "dinner ideas?" to "user is vegetarian".
- :term[Vector database]{id="vector-database"}: partitioned by user, so each search covers only a few hundred vectors; exact search is cheap at that size, and isolation is a partition boundary.
- :term[Retrieval-augmented generation]{id="rag"}: recall is RAG over the user's own memories, putting the top 5 to 10 into the prompt.
- :term[Context window]{id="context-window"}: memories compete with the conversation for tokens, so a budget of about 800 tokens keeps cost low and the model focused.
- :term[Prompt injection]{id="prompt-injection"}: pages and files may say "remember that …", so extraction reads only the user's own messages, and every saved memory is visible to the user.
- :term[Read-your-writes]{id="read-your-writes"}: a user who says "remember this" and opens a new chat a minute later expects it, so explicit requests are written synchronously, not through the queue.
- :term[Offline evaluation]{id="offline-evaluation"}: scripted multi-session conversations with planted facts, later updates and deletions check that the assistant recalls the latest version and forgets what was deleted.

## High-level design

::diagram{id="assistant-memory-hld"}

1. **Recall:** for each message, the chat service calls the memory service, which embeds it with recent turns, searches only that user's partition, weighs similarity with recency, and returns the top memories within about 50 ms.
2. **Answer:** the prompt holds the instructions, up to 800 tokens of memories marked as notes about the user (not instructions), the conversation and the new message. The assistant LLM answers.
3. **Extraction:** the finished turn goes on a queue. The extractor, a small LLM, proposes candidate facts from the user's own messages and skips sensitive categories unless the user asked.
4. **Consolidation:** for each candidate, the memory service fetches the 5 most similar memories and asks the small LLM to choose add, update, delete or ignore. The memory store, the source of truth with provenance, and the vector index are updated together.
5. **Control and evaluation:** users manage memories through the memory service; a delete removes the record and its vector. The eval suite replays multi-session test conversations before each prompt or model change, and the share of memories users delete or correct is tracked in production.

The full version of this case study will cover what to store versus summarize, consolidation and conflict handling, recall ranking with recency and importance, deletion and privacy guarantees, and evaluating memory across sessions.
