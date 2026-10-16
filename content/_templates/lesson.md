---
# Template: lesson. Copy to content/lessons/<phase>/<slug>.md, replace every {{…}},
# delete these comment lines, then run `npm run validate-content`.
# The lesson must also be listed in content/path.json (rule R9).

# URL name: lowercase words joined by dashes. Must match the file name.
slug: {{slug}}
# Page title, in sentence case.
title: {{title}}
# One of: foundations, building-blocks, data-systems, ml-systems, llm-systems, frontier-infrastructure.
phase: {{phase}}
# Position inside the phase (1 = first).
order: {{order}}
# One sentence, at most 200 characters, shown on cards and in search.
summary: {{summary}}
# Reading time in minutes (3 to 30): about words ÷ 220, plus 2 per exercise.
estimatedMinutes: {{minutes}}
# Glossary ids (content/glossary.json) this lesson teaches; shown as chips.
concepts: [{{concept-id}}]
# Quiz or drill ids (content/quizzes, content/drills); at least one.
exercises: [{{quiz-id}}]
---

## {{First section heading}}

:::primer
{{Two or three sentences for a complete beginner: what this is, in everyday words.}}
:::

{{Explain the idea. Link each glossary term the first time it appears, like this:}} :term[{{term as written}}]{id="{{concept-id}}"}.

::figure{id="{{figure-id}}" caption="{{One sentence that says what the figure shows.}}"}

## {{Second section heading}}

{{Show the idea at work: a worked number, a short code sample or a comparison table.}}

:::deeper[{{Title of the optional deep dive}}]
{{The detail an expert would add. Readers can skip it.}}
:::

:::interview
{{How this comes up in a system design interview, and what a strong answer says.}}
:::

::quiz{id="{{quiz-id}}"}
