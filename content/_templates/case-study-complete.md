---
# Template: complete case study, the 12 sections of PROJECT_BRIEF.md §5.4.
# Copy to content/case-studies/<slug>/index.md, add a diagram.json next to it (see diagram.jsonc),
# replace every {{…}}, delete these comment lines, add the slug to content/path.json,
# then run `npm run validate-content`. Track A case studies delete "## ML/LLM design".

# URL name: lowercase words joined by dashes. Must match the folder name.
slug: {{slug}}
# Title from PROJECT_BRIEF.md §5.3, in sentence case.
title: {{title}}
# A = classic systems (order 1–15), B = ML systems (16–30), C = LLM and GenAI systems (31–50).
track: {{track}}
# The case study's number in PROJECT_BRIEF.md §5.3; must fall in its track's range.
order: {{order}}
# beginner, intermediate or advanced.
difficulty: {{difficulty}}
# One sentence, at most 200 characters, with the scale and the core design move.
summary: {{summary}}
# Glossary ids (content/glossary.json) used in the write-up; shown as chips.
concepts: [{{concept-id}}]
# Slugs of earlier case studies (lower order) worth reading first. Use [] for none.
prerequisites: []
# Reading time in minutes: words ÷ 220, plus 2 per quiz or drill. The validator warns when it is off by more than 40%.
estimatedMinutes: {{minutes}}
# "complete" requires all sections below, an :::interview and a :::deeper block, and a quiz.
status: complete
# At least one quiz id; drills are welcome too. Each must appear under ## Practice.
exercises: [{{quiz-id}}, {{drill-id}}]
# Always <slug>-hld; it must match the id inside diagram.json.
diagram: {{diagram-id}}
---

## Problem statement

{{What is being built and what makes it hard.}}

:::primer
{{Two or three sentences for a complete beginner.}}
:::

Questions to ask:

- {{A clarifying question.}}

## Requirements

**Functional**

- {{What users can do.}}

**Non-functional**

- **Scale:** {{Concrete numbers, labeled as assumptions.}}

## Back-of-envelope estimates

| Quantity | Calculation | Result |
| --- | --- | --- |
| {{Requests per second}} | {{Show the arithmetic}} | {{Result with units}} |

**What the numbers say:** {{The design consequence of the estimates.}}

## API design and data model

{{Endpoints or messages, then the main tables or keys and how they are partitioned.}}

## High-level design

::diagram{id="{{diagram-id}}"}

{{Walk through the diagram, linking terms such as}} :term[{{term as written}}]{id="{{concept-id}}"}.

## Deep dives

### {{The hardest component}}

{{Options, numbers and the choice.}}

:::deeper[{{Title of an optional expert detail}}]
{{The detail an expert would add.}}
:::

## ML/LLM design

{{Tracks B and C only: data sources, features or retrieval, model choice, training, serving, offline and online metrics.}}

## Trade-offs

| Decision | Alternative | Why this choice |
| --- | --- | --- |
| {{What was chosen}} | {{What was given up}} | {{Why}} |

## Failure modes, scaling and monitoring

- **{{Failure}}:** {{What happens and how the design copes.}}

## Real-world references

- {{Author or company, title, year: one line on why it is relevant. Verified sources only.}}

## 45-minute interview version

1. **Requirements (5 min):** {{What to cover.}}
2. **High-level design (10 min):** {{What to cover.}}

:::interview
{{What the interviewer is looking for, and how a strong answer stands out.}}
:::

## Practice

::quiz{id="{{quiz-id}}"}

::drill{id="{{drill-id}}"}
