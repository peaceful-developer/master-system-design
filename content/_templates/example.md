---
# Template: worked example (one pattern, one diagram). Copy to content/examples/<slug>.md,
# replace every {{…}}, delete these comment lines, then run `npm run validate-content`.

# URL name: lowercase words joined by dashes. Must match the file name.
slug: {{slug}}
# Page title, usually the pattern's name.
title: {{title}}
# One sentence, at most 200 characters, shown on cards and in search.
summary: {{summary}}
# Glossary ids (content/glossary.json) this example illustrates.
concepts: [{{concept-id}}]
# Free-form tags for filtering, lowercase.
tags: [{{tag}}]
# Optional: the id of a diagram in content/diagrams/ (see diagram.jsonc). Delete the line if unused.
diagram: {{diagram-id}}
---

## {{The pattern}}

{{What the pattern does, in two or three sentences, linking terms such as}} :term[{{term as written}}]{id="{{concept-id}}"}.

::diagram{id="{{diagram-id}}"}

## {{How it works}}

1. {{Step one of the flow shown in the diagram.}}
2. {{Step two.}}

## {{When to use it, and when not to}}

{{The trade-off in a few sentences.}}
