---
slug: text-to-sql
title: Text-to-SQL analytics assistant
track: C
order: 45
difficulty: intermediate
summary: Let 5,000 employees query a 2,000-table warehouse in plain English, with schema retrieval, governed metric definitions, and read-only SQL that is validated before it runs.
concepts: [schema-linking, semantic-layer, rag, hybrid-search, hallucination, context-window, execution-accuracy, golden-dataset, llm-as-judge]
prerequisites: [enterprise-rag]
estimatedMinutes: 4
status: outline
exercises: []
diagram: text-to-sql-hld
---

## Problem statement

Design an "ask your data" assistant in the style of the natural-language features in BI tools. A sales manager types "What was net revenue by region last quarter, excluding refunds?" and gets a table, a chart, the SQL that produced it, and a one-line explanation of what was counted.

Writing SQL is the easy part for a modern LLM. The hard parts are picking the right 5 tables out of 2,000 with cryptic column names, knowing what the company means by "net revenue" or "active customer" when the schema doesn't say, and catching queries that run fine but return a wrong number, the worst failure because nobody notices it.

Questions to ask:

- Which warehouse and SQL dialect? How many tables, and how well are they documented?
- Who are the users: analysts who can read SQL, or managers who can't?
- Are there agreed metric definitions, or only raw tables?
- What may each user see? Are there row- and column-level permissions?
- Are there limits on query cost and runtime?

## Requirements

**Functional**

- Ask a question in plain English and get the result table, a suggested chart, the generated SQL and a plain-language explanation.
- Ask follow-ups that refine the last query ("now only for Europe").
- Ask a clarifying question when the request is ambiguous, instead of guessing.
- Run only read-only queries, with the asking user's own warehouse permissions.
- Rate answers, and let analysts mark a question and its SQL as verified.

**Non-functional**

- **Scale:** 5,000 users; 2,000 tables with 60,000 columns; 20,000 questions per working day, about 3 per second at peak.
- **Latency:** SQL ready within 5 seconds at p95; the full answer, including the query run, within 30 seconds.
- **Accuracy:** at least 85% execution accuracy on a 500-question test set, and over 95% on questions that verified metrics cover.
- **Safety:** no writes or schema changes, ever; queries that would scan more than 500 GB need confirmation.
- **Cost:** under $0.05 of model tokens per question, including repair attempts.

## Key concepts

- :term[Schema linking]{id="schema-linking"}: the full schema is about 2 million tokens, so the first step is choosing the 10 to 20 tables and columns a question needs, and most wrong answers start with a wrong choice here.
- :term[Retrieval-augmented generation]{id="rag"}: table descriptions, metric definitions and verified example queries are retrieved per question, like document Q&A but over metadata.
- :term[Hybrid search]{id="hybrid-search"}: a column named `cust_ltv_usd` and the phrase "lifetime value" need keyword and vector matching together.
- :term[Semantic layer]{id="semantic-layer"}: governed definitions such as "net revenue = gross sales − refunds − tax" let the model reuse approved formulas instead of inventing them, the single biggest accuracy lever.
- :term[Context window]{id="context-window"}: a budget of about 6,000 tokens for schema, definitions and examples keeps cost down and keeps near-miss tables from distracting the model.
- :term[Hallucination]{id="hallucination"}: here it means invented columns or wrong join keys, so every query is compiled against the real catalog and errors go back to the model for repair.
- :term[Execution accuracy]{id="execution-accuracy"}: many different queries are correct, so evaluation runs the generated and reference SQL and compares their results, not their text.
- :term[Golden dataset]{id="golden-dataset"}: 500 real questions with analyst-written SQL gate every change to prompts, models or retrieval, and an :term[LLM judge]{id="llm-as-judge"} grades the explanations.

## High-level design

::diagram{id="text-to-sql-hld"}

1. The SQL assistant receives the question with the user's identity and rewrites a follow-up into a standalone question.
2. **Schema linking:** hybrid search over the schema index returns candidate tables and columns, matching metric definitions, and the 5 most similar verified queries. A short LLM call prunes the candidates.
3. **Generation:** the LLM writes SQL for the warehouse's dialect from that trimmed context, or asks a clarifying question when two readings are plausible.
4. **Validation:** the validator parses the SQL, rejects anything but a single `SELECT`, checks that every table and column exists and that the user may read it, adds a row limit, and runs `EXPLAIN` to estimate the scan size. Errors go back to the LLM for up to 2 repair attempts.
5. **Execution:** the query runs in a separate, low-priority warehouse pool under the user's own credentials, with a 60-second timeout. The result returns with the SQL, a chart and an explanation.
6. **Feedback:** catalog sync re-indexes schema and metric changes nightly. Verified queries become retrieval examples, down-rated questions join the test set, and the eval suite reruns the benchmark before each release.

The full version of this case study will cover schema linking at 60,000 columns, building and governing the semantic layer, the validate-and-repair loop, measuring execution accuracy on a changing warehouse, and permission and cost controls for generated queries.
