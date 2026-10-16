---
# Template: case study outline (structure and key ideas; someone expands it later).
# Copy to content/case-studies/<slug>/index.md, add a diagram.json next to it (see diagram.jsonc),
# replace every {{…}}, delete these comment lines, add the slug to content/path.json,
# then run `npm run validate-content`.

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
# 6–11 glossary ids (content/glossary.json); add missing terms to the glossary first.
concepts: [{{concept-id}}]
# Slugs of earlier case studies (lower order) worth reading first. Use [] for none.
prerequisites: []
# Reading time of this outline in minutes: about words ÷ 220, at least 3.
estimatedMinutes: {{minutes}}
# Keep "outline" until all twelve sections of case-study-complete.md are written.
status: outline
# Outlines may have none; use quiz or drill ids once they exist.
exercises: []
# Always <slug>-hld; it must match the id inside diagram.json.
diagram: {{diagram-id}}
---

## Problem statement

{{What is being built, in the style of a well-known product, and what makes it hard.}}

Questions to ask:

- {{A clarifying question about scale.}}
- {{A clarifying question about consistency or latency.}}

## Requirements

**Functional**

- {{What users can do.}}

**Non-functional**

- **Scale:** {{Concrete numbers, labeled as assumptions.}}
- **Latency:** {{A target, such as p99 under 200 ms.}}

## Key concepts

- :term[{{term as written}}]{id="{{concept-id}}"}: {{why this concept matters in this system.}}

## High-level design

::diagram{id="{{diagram-id}}"}

1. {{Walk through the diagram, one numbered step per hop.}}
2. {{Next step.}}

{{The full version of this case study will cover … (name 3–5 deep dives).}}
