# Contributing to System Design Lab

Thank you for helping. The most valuable contributions are usually content: fixing a mistake, expanding a case-study outline into a complete write-up, or writing one of the planned lessons. Code contributions are welcome too.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Content you contribute is licensed under [CC BY 4.0](LICENSE-CONTENT) and code under [MIT](LICENSE).

## Where to start

- **Small fixes** (a typo, a wrong number, a broken link): open a pull request directly, or use the "Content error" issue form.
- **Expand a case study outline:** pages marked "Outline: contributions welcome" have the structure and key ideas but not the full write-up. Open a "Case study proposal" issue first so two people don't write the same one.
- **Write a planned lesson:** [docs/curriculum.md](docs/curriculum.md) lists every lesson in the curriculum; the ones marked **Planned** are open for contributions. Open an issue to claim one.

## Set up

You need Node.js 24 (see `.nvmrc`).

```bash
npm ci
npm start                  # http://localhost:4200, reloads when content/ changes
npm run validate-content   # check all content without building
```

Before opening a pull request, run `npm run lint`, `npm test` and `npm run validate-content`. CI runs the same checks plus a production build and the end-to-end tests.

## Adding content

Every content type has a template in [`content/_templates/`](content/_templates). Copy it to the place shown at the top of the template, replace every `{{…}}`, delete the comment lines, and run `npm run validate-content`. A test checks that each template still validates, so they stay in step with the schemas.

| Content | Template | Goes in |
| --- | --- | --- |
| Lesson | `lesson.md` | `content/lessons/<phase>/<slug>.md`, and listed in `content/path.json` |
| Case study (complete) | `case-study-complete.md` | `content/case-studies/<slug>/index.md`, and listed in `content/path.json` |
| Case study (outline) | `case-study-outline.md` | `content/case-studies/<slug>/index.md`, and listed in `content/path.json` |
| Diagram | `diagram.jsonc` | `content/case-studies/<slug>/diagram.json`, or `content/diagrams/<id>.json` for an example |
| Playbook | `playbook.md` | `content/playbooks/<slug>.md` |
| Worked example | `example.md` | `content/examples/<slug>.md` |
| Quiz | `quiz.jsonc` | `content/quizzes/<id>.json` |
| Estimation drill | `drill.jsonc` | `content/drills/<id>.json` |
| Figure | `figure.svg` | `content/figures/<id>.svg` |
| Glossary term | — | an entry in `content/glossary.json`: `id`, `term`, a 1–2 sentence `definition`, optional `aliases` and `related` |

### Markdown you can use

Content is CommonMark with a few directives:

| Write | You get |
| --- | --- |
| `:term[visible text]{id="glossary-id"}` | A link to the term's glossary entry. Link a term the first time it appears. |
| `:::primer` … `:::` | A "New to this?" box for beginners. |
| `:::deeper[Title]` … `:::` | A collapsed "Go deeper" section for experts. |
| `:::interview` … `:::` | An "Interview tip" box. |
| `:::note`, `:::tip`, `:::warning` … `:::` | Other callouts. |
| `::diagram{id="…"}` | An interactive architecture diagram. |
| `::figure{id="…" caption="…"}` | An SVG figure from `content/figures/`. |
| `::quiz{id="…"}`, `::drill{id="…"}` | An exercise. |

Raw HTML, images and reference-style links are not allowed: draw an SVG figure instead of an image, and write links inline as `[text](url)`. Code blocks may name one of these languages for highlighting: `ts`, `js`, `json`, `yaml`, `sql`, `bash`, `python`, `http`, `lua` or `text` (the default). Internal links use site paths such as `/learn/building-blocks/caching-and-cdns` or `/case-studies/url-shortener`, and are checked. A colon directly followed by letters or digits starts a directive, so in prose write `\:` for a literal colon there, or rephrase ("100 to 1", "noon").

### What `validate-content` checks

Every file is checked against its schema (required fields, lengths, allowed values), and the error names the file and the field. Then these cross-reference rules run:

| Rule | Checks |
| --- | --- |
| R1 | Ids are unique within a content type; quizzes and drills share one namespace. |
| R2 | File and folder names match the ids inside them; each case study has its `diagram.json`. |
| R3 | Diagrams use components from `content/components.json`, and each component has an icon. |
| R4 | Every concept and `:term` id exists in the glossary, as do glossary `related` ids. |
| R5 | Case-study prerequisites exist and have no cycles. |
| R6 | Listed exercises exist; complete case studies list at least one quiz. |
| R7 | Diagrams and figures used in content exist. |
| R8 | Internal links, including `#fragments`, point to real pages and headings. |
| R9 | `content/path.json` has the six phases in order, and every lesson and case study is placed exactly once. |
| R10 | Case-study `order` is unique and inside its track's range: A 1–15, B 16–30, C 31–50. |
| R11 | Every lesson and complete case study has a `:::primer`, a `:::deeper` and an `:::interview`. |

### Case study structure

Complete case studies use exactly these sections, in this order (Track A has no "ML/LLM design"):

1. Problem statement
2. Requirements
3. Back-of-envelope estimates
4. API design and data model
5. High-level design (with the `::diagram`)
6. Deep dives
7. ML/LLM design
8. Trade-offs
9. Failure modes, scaling and monitoring
10. Real-world references
11. 45-minute interview version
12. Practice

Outlines use Problem statement, Requirements, Key concepts and High-level design. When you complete an outline, change `status` to `complete` and add a quiz.

## Style guide

- **Tone:** plain, precise English and short sentences. Explain to a smart colleague from another team. US spelling, no hype, no emoji, no exclamation marks.
- **Layering:** every lesson and complete case study serves beginners to experts: a primer for newcomers, the main text for working engineers, a "Go deeper" for experts and an interview tip.
- **Numbers:** show the arithmetic, write thousands with separators (10,000), use × for multiplication, and label inputs as assumptions. Scale figures are for the exercise, not claims about a real company.
- **Lengths:** summaries are one sentence of at most 200 characters. Lessons are 10–15 minutes of reading. `estimatedMinutes` is words ÷ 220 plus 2 per exercise; the validator warns when it is more than 40% off.
- **References:** cite only sources you have checked: papers, official engineering blogs, documentation or recorded talks, with author or company, title and year. If you can't verify one yet, write `TODO: add verified reference` rather than guessing.
- **Exercises:** every lesson and complete case study ends with at least one quiz or drill. Quiz explanations say why each wrong option is wrong.

### Diagrams

- Use components from `content/components.json`; ask in an issue if you need a new one.
- Place nodes on a grid (x = 0, 250, 500, 760; y = 0, 170, 340, 510) so the diagram fits the page without sideways scrolling, and let the flow run left to right.
- Keep node labels to about 14 characters and edge labels to 1–3 words; longer labels spill out of their node or into neighbors.
- Draw edges between neighboring nodes; an edge should never pass through another node.
- Case studies use 5–12 nodes. Check the result in the browser in both light and dark themes.

### Figures

- `<title>` is the first element (it becomes the accessible name), followed by a `<desc>`.
- Colors come from theme tokens with a fallback, such as `var(--fig-accent, #2bb24c)`, plus `currentColor` for text and lines, so figures follow light and dark mode. The tokens are `--fig-fill`, `--fig-stroke` and `--fig-accent`.
- Animate with CSS only (SMIL `<animate>` and scripts are rejected), and add a `@media (prefers-reduced-motion: reduce)` rule that stops on a frame that still makes sense.
- `npm run figures:render` saves light, dark and reduced-motion PNGs of every figure so you can check them.

## Code contributions

The app is Angular with standalone components, signals and OnPush change detection; content is compiled to typed JSON by the scripts in `scripts/`. Please:

- Write a failing test first, then the change (Vitest for units, Playwright for flows).
- Keep pages accessible: keyboard reachable, labeled, and readable in both themes.
- Keep the initial bundle under its budget; load heavy features lazily.

## Pull requests and releases

- Keep pull requests focused: one lesson, case study or fix per PR is ideal. Fill in the checklist in the template.
- CI must be green. A maintainer reviews content for accuracy as well as style.
- Every merge to `main` is built and deployed to GitHub Pages automatically, so `main` is always the live site. There are no separate release branches.
