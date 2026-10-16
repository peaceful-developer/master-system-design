---
# Template: playbook (a repeatable method). Copy to content/playbooks/<slug>.md,
# replace every {{…}}, delete these comment lines, then run `npm run validate-content`.

# URL name: lowercase words joined by dashes. Must match the file name.
slug: {{slug}}
# Page title, in sentence case.
title: {{title}}
# Position in the playbook list (1 = first).
order: {{order}}
# One sentence, at most 200 characters, shown on cards and in search.
summary: {{summary}}
# Reading time in minutes (3 to 60): about words ÷ 220, plus 2 per exercise.
estimatedMinutes: {{minutes}}
# Glossary ids (content/glossary.json) the playbook relies on.
concepts: [{{concept-id}}]
# Quiz or drill ids; at least one, so readers practice the method.
exercises: [{{drill-id}}]
---

## {{When to use this playbook}}

{{One paragraph: the situation, and what the reader has at the end.}}

## {{The steps}}

1. {{Step one, as an instruction.}}
2. {{Step two.}}
3. {{Step three.}}

## {{A worked example}}

{{Walk through the steps once with real numbers, and link terms such as}} :term[{{term as written}}]{id="{{concept-id}}"}.

::drill{id="{{drill-id}}"}
