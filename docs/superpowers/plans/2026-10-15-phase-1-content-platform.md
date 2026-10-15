# System Design Lab — Phase 1 (Content Platform + Quizzes and Drills) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static, prerendered Angular site that is fun to learn from (black-on-white text, parrot-green buttons and menus, the Polly mascot, XP and streaks) and useful from beginner to expert (layered depth). On it, a learner can follow the learning path, read lessons, playbooks, examples and all 50 case studies (6 complete, 44 outlines), take quizzes and estimation drills, and keep their progress in the browser. The build fails on any invalid content.

**Architecture:** A Node build step (`scripts/`, pure TypeScript, run with `tsx`) loads `content/`, validates it with Zod and cross-reference rules, compiles Markdown to typed JSON "content blocks" with build-time Shiki highlighting, sanitizes custom SVG assets, builds a MiniSearch index, and writes everything to `src/generated/`. Content is lazily imported as JSON chunks, with no HTTP calls, so it works the same during prerender and in the browser. The Angular 22 app (standalone components, signals, OnPush, zoneless) renders the blocks and is prerendered with `@angular/ssr` (`outputMode: "static"`). Learner state lives in a versioned localStorage store that is safe to use during SSR.

**Tech Stack:** Angular 22.2 + @angular/ssr + @angular/cdk, TypeScript 6.0, Tailwind CSS 4.3, unified/remark/rehype + remark-directive + Shiki 4, Zod 4, MiniSearch 7, Vitest 5 (via `ng test` and directly for `scripts/`), Playwright 1.64 + axe-core, Lighthouse CI, ESLint 10 + angular-eslint 22 + Prettier 3, GitHub Actions → GitHub Pages.

**Spec:** `PROJECT_BRIEF.md` (repo root). Executors read the brief and this plan together.

---

## Decisions to approve before execution

These are the calls that are expensive to undo or that the brief leaves open. Each one shows the default I recommend.

| # | Decision | Recommendation and why |
|---|---|---|
| D1 | TypeScript version | **6.0.3, not 7.0.2 (the latest).** `@angular/compiler-cli@22.2.2` declares `typescript: ">=6.0 <6.1"`, and typescript-eslint 8.71 also caps at `<6.1.0`. |
| D2 | Phase 1 read-only diagram viewer | **A custom SVG component (pure-TS geometry, prerendered, no canvas library).** It prerenders to static HTML, adds 0 KB of library code to content pages (helps Lighthouse ≥ 90), and is fully accessible. The canvas library is chosen in a 1-day spike at the start of Phase 2. I currently lean towards **Foblex Flow** (19.3.0, released 2026‑09‑27; frequent releases; no d3 dependencies; template-based custom nodes and connectors) over **ngx-vflow** (2.7.0, released 2026‑09‑03; signals-first API; depends on d3-zoom/drag). Both are maintained, so the spike decides between them against the Phase 2 criteria (custom nodes, ports, keyboard delete, read-only mode, SSR safety). |
| D3 | Search | **MiniSearch** with an index built at build time and lazily imported on the first search. It also works under `ng serve`. Pagefind scales further, but it only indexes post-build HTML, so search would not work in dev. |
| D4 | How content reaches the app | **Generated JSON chunks behind `import()` loaders** in `src/generated/`, instead of HttpClient fetches. This needs no absolute URLs during prerender and no TransferState, and each item becomes its own lazy chunk. |
| D5 | Content layout additions to brief §6 | Add `content/path.json` (phase order and placement of items), `content/diagrams/<id>.json` (diagrams not owned by a case study), `content/figures/<id>.svg` (custom illustrations) and `content/icons/<name>.svg` (custom icon set). In Phase 1 the exercise catalog **is** the set of quizzes and drills, each carrying its own `title/topics/difficulty`. `content/exercises/` stays reserved for the canvas and simulation types of Phase 2+, so every quiz doesn't need a duplicate wrapper file. |
| D6 | Hosting path and name | GitHub Pages project site `https://peaceful-developer.github.io/master-system-design/` (base href `/master-system-design/`). Netlify/Vercel build with base `/`. The name "System Design Lab" lives in one constant (`src/app/site.ts`). **You must set Settings → Pages → Source = "GitHub Actions" once.** |
| D7 | Visual assets (per your instruction) | **Everything is made in-repo:** a custom 24×24 stroke icon set (36 component icons + ~22 UI icons), category node shapes for diagrams, a logo and favicon, and ~13 **animated SVG explainers** (CSS keyframes, theme-aware, static under `prefers-reduced-motion`). In the app these replace GIFs, which are heavy, can't follow light/dark, and can't be paused. The one real GIF is a README demo, recorded by a script (Playwright frames + `gifenc`). Note: `gifenc` 1.0.3 has had no release since 2022. It is tiny, has no dependencies and is used only in a dev script, so I propose using it. The alternative is `ffmpeg` on the CI runner. |
| D8 | Lessons per phase (brief: 4–8 per phase) | Phase 0 covers 6 topics → **6 lessons**. Phase 1 lists 11 topics, so they merge into **8 lessons** (list in Task 21). Lesson titles and slugs for **all 6 phases**, including the planned Phases 2–5, are fixed in `docs/curriculum.md`. That file is the source of truth for contributors. |
| D9 | `/playground` in Phase 1 | It is a placeholder page that shows the full component library (icon, shape, defaults) read-only. The "Open in Playground" button stays hidden behind `FEATURES.playground = false` until Phase 2. |
| D10 | Progress semantics | Quiz-type exercises auto-complete at a score of **≥ 70 %**. Drill-type exercises auto-complete when **all** answers are within tolerance. Lessons, case studies, playbooks and examples are marked complete by hand. Import **replaces** the current progress after a confirmation dialog. |
| D11 | Visual identity (your direction: **black text on white; parrot green for buttons and menus**) | **All text is black `#000000` on a white `#FFFFFF` background** (21:1), including headings, body, metadata, links and labels. Secondary information is set apart by size and weight, not by gray text. **Parrot green `#2BB24C` is used for buttons and menus:** the top navigation bar, sidebar menus, the active menu item, primary buttons, toggles and chips. Labels on parrot are **black** (7.58:1, AAA). Hover/pressed parrot is `#23963F` (black label 5.51:1). Parrot measures only 2.77:1 against white, below the 3:1 non-text minimum, so **buttons and chips get a 1 px parrot-deep `#1E8A39` border** (4.4:1 against white). The fill stays flat, with no gradients and no heavy shadows. **The overall look is neat, clean and professional (your direction):** generous whitespace on an 8 px spacing grid, one corner radius (8 px controls, 12 px cards), hairline `#E5E5E5` dividers, at most one parrot element per region beyond the menu, crisp line icons, and no decorative clutter. Links are black and underlined with a 2 px parrot underline. Focus is a 2 px black outline with a 2 px offset. Parrot also fills progress rings, diagram node outlines and illustrations. Soft tints are used only as backgrounds behind black text: parrot-soft `#E6F7EA` (correct), scarlet-soft `#FDE8E8` (incorrect), sun-soft `#FFF4D6` (XP/highlight), sky-soft `#E8F0FC` (info), each paired with an icon and a text label. Code blocks keep standard syntax colors (Shiki `github-light`) on a `#F7F7F7` panel. Type: **IBM Plex Sans** for headings (semibold) and body, **JetBrains Mono** for code (self-hosted, OFL). The type scale is 14/16/18/22/28/36 px, and body line-height is 1.7. See D15 for dark mode. |
| D12 | Drill "same order of magnitude" tolerance | Defined as \|log10(answer/expected)\| ≤ 0.5, meaning within about 3.16× either way. It is symmetric and has no boundary artifacts like "999 vs 1000". Per-question tolerance defaults to `{ kind: "relative", value: 0.25 }`. |
| D13 | Make it fun while staying professional (your direction) | The fun comes from interaction and feedback, not decoration. Visual chrome stays clean (D11). **A parrot mascot, "Polly" (working name), drawn by us as minimal flat line-art SVG in the icon style. It appears small (48–96 px) and only at feedback moments, empty states and the 404 page. It comes in 6 poses:** idle, thinking (hints), cheering (correct), puzzled (wrong), sleeping (empty states), flying (404: "This page flew the coop"). It reacts in quizzes and drills with short, encouraging, **specific** lines, never sarcasm. **A light game layer, all local and derived from progress:** XP, 8 parrot-themed levels (Egg → Hatchling → Fledgling → Flyer → Navigator → Flock Leader → Architect → Principal Parrot), a daily learning streak, 12 achievements, and a feather-burst celebration on a perfect quiz. **A "Calm mode" toggle** hides the mascot reactions, celebrations and XP toasts for learners who want a quiet, documentation-like experience. Under `prefers-reduced-motion`, everything stays static. |
| D15 | Dark mode vs "black on white" (**needs your answer**) | The brief asks for light and dark themes that follow `prefers-color-scheme`, but your direction is black text on white. **Recommendation:** black-on-white is the default for everyone, including visitors whose OS is set to dark. Dark mode exists only as an opt-in choice in the theme toggle (Light / Dark). It uses white text on `#0B0F0C`, with the same parrot-green buttons and menus and their black labels. The alternative is to drop dark mode entirely. |
| D14 | Value from beginner to expert (your direction) | **Layered depth in every lesson and case study:** `:::primer` boxes ("New to this?", plain-language basics), the main text pitched at a working engineer, `:::deeper` collapsibles ("Go deeper": internals, math, edge cases, papers) and `:::interview` tips ("What a senior answer adds"). **Quiz questions carry a `level`** (beginner/intermediate/advanced), and each quiz mixes levels, labeled per question. **A "Where should I start?" picker** on home and `/path` (New to this · I know the basics · Preparing for senior/ML/LLM design) highlights a recommended starting point and "fast-track" items, without hiding anything. Experts get dense deep dives, trade-off tables and 45-minute interview talk tracks. |

## Global Constraints

- Angular **22.2.x**: standalone components only, signals, `@if/@for/@switch/@defer`, OnPush (the CLI 22 default), zoneless (the CLI 22 default), strict TypeScript and strict templates.
- TypeScript **~6.0.3** (see D1). Node **22 LTS** (`"engines": { "node": ">=22.12" }`, `.nvmrc` = `22`).
- Pinned versions, verified 2026‑10‑15: `@angular/*` 22.2.x (core 22.2.3, cli/build/ssr 22.2.2, cdk 22.2.3) · `typescript` 6.0.3 · `tailwindcss` + `@tailwindcss/postcss` 4.3.3 · `@tailwindcss/typography` 0.5.20 · `vitest` 5.0.4 · `jsdom` 30.1.2 · `@playwright/test` 1.64.1 · `@axe-core/playwright` 4.13.0 · `@lhci/cli` 0.15.1 · `eslint` 10.12.0 · `angular-eslint` 22.6.0 · `typescript-eslint` 8.71.2 · `prettier` 3.9.10 · `zod` 4.6.7 · `unified` 11.0.5 · `remark-parse` 11.0.0 · `remark-gfm` 4.0.1 · `remark-frontmatter` 5.0.0 · `remark-directive` 4.0.0 · `remark-rehype` 11.1.2 · `rehype-slug` 6.0.0 · `rehype-parse` 9.0.1 · `rehype-stringify` 10.0.1 · `hast-util-to-html` 9.0.5 · `unist-util-visit` 5.1.0 · `shiki` + `@shikijs/rehype` 4.5.0 · `yaml` 2.9.1 · `minisearch` 7.2.0 · `chokidar` 5.0.0 · `tsx` 4.23.15 · `concurrently` 10.0.6 · `gifenc` 1.0.3 · `@fontsource-variable/{ibm-plex-sans,jetbrains-mono}` 5.3.x.
- No backend, no database, no accounts, no runtime server: `outputMode: "static"`.
- The page must not make requests to third-party origins at runtime (fonts self-hosted, no CDNs, no analytics).
- Licenses: **MIT** for code, **CC BY 4.0** for `content/`, stated in `LICENSE`, `LICENSE-CONTENT` and the README.
- Never invent facts. For an unverifiable reference, write exactly `TODO: add verified reference`.
- Every simulation default is labeled exactly "Illustrative teaching values, not vendor benchmarks."
- All icons, shapes, figures, the mascot, logo and GIFs are original and made in this repo. No third-party icon packs or stock images.
- Theme: **text is black `#000000` on white `#FFFFFF`. Parrot green `#2BB24C` is for buttons and menus, with black labels. The look is neat, clean and professional.** Use the D11 tokens exactly. Parrot is never used as a text color. Every text/background pair is ≥ 4.5:1. Every parrot control on white has a 1 px `#1E8A39` border. There are no gradients, no heavy shadows (at most `0 1px 2px rgb(0 0 0 / 0.06)` on cards), one radius scale and one spacing grid.
- Fun never blocks learning. Mascot, celebrations and XP are hidden by Calm mode, static under reduced motion, never shown in prerendered HTML before hydration, and never required to reach content.
- Respect `prefers-reduced-motion`. Handle `prefers-color-scheme` as decided in D15. Every interactive element must be keyboard-operable, contrast AA, with no meaning carried by color alone.
- Lighthouse ≥ 90 in Performance, Accessibility, Best Practices and SEO on content pages. No console errors on any route.
- One responsibility per file. Logic (compiler, validators, scoring, tolerance, geometry, filters, progress migration) is pure TypeScript with no Angular imports.
- Storage keys: `sdl.progress` and `sdl.theme`.

## Review Focus

1. **Subpath hosting (`/master-system-design/`).** Compiled Markdown links (`/glossary#x`), in-page TOC anchors (`#section`), deep-link reloads and 404s must all stay under the base path. *Pinned by:* Task 10 internal-links tests and Task 18 e2e running under the base path.
2. **Hydration with stored progress.** A prerendered page is reloaded while `localStorage` has completed items. Progress-dependent UI must not cause hydration mismatches or console errors, and must show the correct state after hydration. *Pinned by:* Task 8 `ready` signal tests and Task 18 e2e "reload with seeded progress → no console errors".
3. **Broken storage.** localStorage may be missing (private mode or blocked), throwing, over quota, holding corrupted JSON, holding a newer schema version, or being changed by another tab. The app must never crash, and it must never overwrite newer-version data. *Pinned by:* Task 8 tests and Task 18 e2e with throwing storage.
4. **Progress import with bad files.** Malformed JSON, a file from another app, a future version, a file over 1 MB, or entries of the wrong type must all be rejected with a readable message, with state unchanged. *Pinned by:* Task 8 `parseImport` tests and Task 16 progress-page test.
5. **Human-typed drill numbers.** Inputs like `1.2M`, `1,200,000`, `1.2e6`, ` 3k `, `""`, `abc`, `1.2.3`, negative values, and an expected value of 0 must either parse or show a clear inline error. They must never be counted as silently wrong. *Pinned by:* Task 13 tests.

---

## Repository layout after Phase 1

```
PROJECT_BRIEF.md  README.md  CONTRIBUTING.md  CODE_OF_CONDUCT.md  LICENSE  LICENSE-CONTENT
content/
  _templates/                      lesson.md, case-study-complete.md, case-study-outline.md,
                                   playbook.md, example.md, quiz.json, drill.json, diagram.json, figure.svg
  lessons/<phase>/<slug>.md
  examples/<slug>.md   playbooks/<slug>.md
  case-studies/<slug>/index.md + diagram.json
  diagrams/<id>.json   figures/<id>.svg   icons/<name>.svg
  quizzes/<id>.json    drills/<id>.json   exercises/   (reserved, Phase 2+)
  glossary.json  components.json  path.json
scripts/
  build-content.ts  schemas.ts  content-types.ts  search-options.ts
  lib/ load.ts  markdown.ts  directives.ts  svg-assets.ts  validate-refs.ts
       validate-structure.ts  emit.ts  search-index.ts  routes.ts
  serve-static.ts  postbuild.ts  render-figures.ts  capture-demo.ts
  test/fixtures/{valid,invalid-*}/   *.spec.ts beside sources
src/generated/                     (git-ignored; written by build-content)
src/app/
  site.ts  app.ts  app.config.ts  app.config.server.ts  app.routes.ts  app.routes.server.ts
  core/{content,progress,storage,search,seo,theme}/
  layout/{shell,top-nav,footer,doc-layout,toc}/
  canvas/  diagram-geometry.ts  node-shapes.ts  diagram-viewer/
  shared/{content-blocks,quiz,drill,icon,badge,progress-ring,complete-toggle,search-dialog,…}/
  features/{home,path,lesson,case-study,case-studies,playbook(s),example(s),exercise(s),
            glossary,progress,contribute,playground,not-found}/
e2e/   .github/{workflows/ci.yml,ISSUE_TEMPLATE/,pull_request_template.md}
netlify.toml  vercel.json  lighthouserc.json  playwright.config.ts  vitest.scripts.config.ts
```

(`grader/` and `simulator/` are created in Phases 2 and 3.)

## npm scripts (fixed names, used by CI and docs)

| Script | Command |
|---|---|
| `content:build` | `tsx scripts/build-content.ts` |
| `validate-content` | `tsx scripts/build-content.ts --check` |
| `content:watch` | `tsx scripts/build-content.ts --watch` |
| `start` | `npm run content:build && concurrently -k -n content,ng "npm:content:watch" "ng serve"` |
| `build` | `npm run content:build && ng build` (extra args reach `ng build`, e.g. `npm run build -- --base-href /master-system-design/`) |
| `postbuild` | `tsx scripts/postbuild.ts` |
| `test` | `npm run content:build && ng test --no-watch && vitest run --config vitest.scripts.config.ts` |
| `lint` | `eslint . && prettier --check .` |
| `e2e` | `playwright test` |
| `lighthouse` | `lhci autorun` |
| `figures:render` | `tsx scripts/render-figures.ts` |
| `demo:capture` | `tsx scripts/capture-demo.ts` |

---

## Milestone A — Foundation

### Task 1: Scaffold the app, tooling and visual foundation

**Files:**
- Create: `package.json`, `angular.json`, `tsconfig*.json`, `.postcssrc.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.nvmrc`, `.editorconfig`, `vitest.scripts.config.ts`
- Create: `src/index.html`, `src/styles.css`, `src/main.ts`, `src/main.server.ts`, `src/app/{app.ts,app.config.ts,app.config.server.ts,app.routes.ts,app.routes.server.ts,site.ts}`
- Create: `public/favicon.svg`, `public/logo.svg` (made by us)
- Test: `src/app/app.spec.ts`
- Already present: `PROJECT_BRIEF.md`

**Interfaces:**
- Produces: `src/app/site.ts` exports `SITE_NAME = 'System Design Lab'`, `REPO_URL = 'https://github.com/peaceful-developer/master-system-design'`, `SITE_URL` (read from `import.meta`-free constant `'https://peaceful-developer.github.io/master-system-design/'`), `FEATURES = { playground: false } as const`.
- Produces: tsconfig path alias `@content/types` → `scripts/content-types.ts` and `@generated/*` → `src/generated/*`.
- Produces: design tokens as CSS custom properties on `:root` (light) and `.dark` (opt-in, D15):
  - `--color-bg` `#FFFFFF`/`#0B0F0C`
  - `--color-surface` `#FFFFFF`/`#121814`; cards are set apart by a black 1 px border, not by tinted backgrounds
  - `--color-fg` `#000000`/`#FFFFFF`; this one value is used for **all** text
  - `--color-border` `#000000`/`#FFFFFF`
  - `--color-rule` `#E5E5E5`/`#2A322D`, for hairline dividers only
  - `--color-parrot` `#2BB24C` and `--color-parrot-hover` `#23963F`, for buttons, menus, active items, rings and node outlines; `--color-parrot-deep` `#1E8A39`, for control borders only
  - `--radius-control` 8 px, `--radius-card` 12 px, `--shadow-card` `0 1px 2px rgb(0 0 0 / 0.06)`, spacing on the Tailwind 4 default 4 px base (layouts use multiples of 8)
  - `--color-on-parrot` `#000000`
  - soft tints `--color-ok-soft #E6F7EA`, `--color-bad-soft #FDE8E8`, `--color-xp-soft #FFF4D6`, `--color-info-soft #E8F0FC` (dark: 15 % alpha of the same hues), used only as backgrounds behind `--color-fg`
  - figure tokens `--fig-stroke (= fg)`, `--fig-fill (= bg)`, `--fig-accent (= parrot)`, `--fig-flow #FFC93C`, `--fig-muted (= rule)`

  Tailwind 4 `@theme` maps the tokens to utilities (`bg-parrot`, `text-on-parrot`, …). Dark mode uses `@custom-variant dark (&:where(.dark, .dark *))`. A unit test (`tokens.spec.ts`) parses `styles.css` and asserts: every text/background pair is ≥ 4.5:1 in both themes; `--color-parrot` and `--color-parrot-hover` are never used as a text `color` anywhere in `src/**/*.css`; and button styles declare a border.

- [ ] **Step 1:** Generate with `npx @angular/cli@22.2.2 new system-design-lab --directory . --ssr --style css --routing --skip-git --package-manager npm` (keep the existing README for now). Set `typescript` to `~6.0.3`. Set `angular.json` `outputMode: "static"` and remove the generated Express `server.ts`. Install the pinned dependencies from Global Constraints that later tasks need for tooling (Tailwind, ESLint stack, Prettier, tsx, Vitest for scripts, concurrently, fonts).
- [ ] **Step 2:** Configure Tailwind 4 (`.postcssrc.json` with `@tailwindcss/postcss`; `styles.css` with `@import "tailwindcss"`, `@plugin "@tailwindcss/typography"` with prose colors overridden to `--color-fg`, font imports, the tokens above, and the `.btn`, `.btn-secondary`, `.chip` and `.menu-item` component classes. Primary: flat parrot fill, black label, 1 px parrot-deep border, hover `--color-parrot-hover`. Secondary: white fill, black label, 1 px black border. No offset shadows or transforms). Add the no-flash theme script inline in `index.html`: it reads `sdl.theme` inside try/catch and applies `.dark` plus `color-scheme` before first paint, only when the stored value is `dark` (D15).
- [ ] **Step 3:** Set up ESLint flat config (angular-eslint 22 + typescript-eslint, with `@angular-eslint/prefer-on-push-component-change-detection: error` and `@typescript-eslint/no-explicit-any: error`) and Prettier. Make `.gitignore` include `src/generated/`, `dist/`, `.lighthouseci/`, `test-results/`, `playwright-report/`.
- [ ] **Step 4:** Draw `public/logo.svg` (a parrot-green mark: a stylized parrot head whose eye and crest form three connected nodes, so it reads as both a parrot and a system diagram) and `public/favicon.svg` (the same mark on white, with a dark-mode `@media` style). Add `src/app/core/theme/tokens.spec.ts` (the contrast assertion described above).
- [ ] **Step 5: Write the failing test** `app.spec.ts`: rendering `App` produces a header containing `SITE_NAME` and a `<main id="main">`.
- [ ] **Step 6:** Implement the minimal `App` shell. Run `npm run lint && ng test --no-watch && ng build`. Expected: all green, and `dist/system-design-lab/browser/index.html` exists.
- [ ] **Step 7: Commit** `chore: scaffold Angular 22 app with SSG, Tailwind, lint and tests`.

### Task 2: Static server, CI pipeline, deploy configs, e2e smoke

**Files:**
- Create: `scripts/serve-static.ts`, `scripts/postbuild.ts`, `playwright.config.ts`, `e2e/smoke.spec.ts`, `.github/workflows/ci.yml`, `netlify.toml`, `vercel.json`
- Test: `scripts/serve-static.spec.ts`, `scripts/postbuild.spec.ts`

**Interfaces:**
- Produces: `createStaticServer(opts: { dir: string; basePath: string }): http.Server`. The CLI is `tsx scripts/serve-static.ts --dir dist/system-design-lab/browser --port 4300`. The base path is read from `<base href>` in `index.html` when `--base` is omitted.
- Produces: `postbuild(distDir: string, opts: { siteUrl: string; routes: string[] }): Promise<void>`. It writes `404.html` (a copy of `index.csr.html`, or of `index.html` if absent), `.nojekyll`, `robots.txt` and `sitemap.xml`. `routes` comes from `src/generated/routes.json`; if that file is absent (before Task 7), the sitemap lists only `/`.

- [ ] **Step 1: Write failing tests** for `createStaticServer`: `GET {base}` returns `index.html` (200); `GET {base}learn/x/y/` and `{base}learn/x/y` serve `learn/x/y/index.html`; an unknown path returns `404.html` with status 404; `GET {base}../package.json` and percent-encoded `%2e%2e` traversal return 404 and never read outside `dir`; a request outside the base path returns 404; content types are correct for `.js .css .json .svg .woff2`.
- [ ] **Step 2: Write failing tests** for `postbuild` on a temp dist dir: the four files are created, sitemap URLs are `siteUrl` + route with a trailing slash, and the function is idempotent.
- [ ] **Step 3:** Implement both. Run `vitest run --config vitest.scripts.config.ts`. Expected: PASS.
- [ ] **Step 4:** Set up `playwright.config.ts`. `webServer` runs `serve-static` on port 4300. `baseURL` comes from `http://localhost:4300` plus the base href read from dist. Projects: chromium desktop, plus chromium at 360×740 for the mobile specs. Locally, launch with `executablePath: '/opt/pw-browsers/chromium'` when `PLAYWRIGHT_BROWSERS_PATH` is set. `e2e/smoke.spec.ts`: the home page returns 200 under the base path, the title contains `SITE_NAME`, and there are zero console errors.
- [ ] **Step 5:** Write `ci.yml`. It triggers on `push` to `main` and on `pull_request`. Job `verify` (ubuntu-latest, Node 22, npm cache) runs `npm ci` → `npm run lint` → `npm run validate-content` (a no-op until Task 7, which wires the real script) → `npm test` → `npm run build -- --base-href /master-system-design/` → `npx playwright install --with-deps chromium` → `npm run e2e` → upload the Playwright report on failure → `actions/upload-pages-artifact` from `dist/system-design-lab/browser`. Job `deploy` (only on `main` push; `needs: verify`; `permissions: pages: write, id-token: write`; `environment: github-pages`; concurrency group `pages`) runs `actions/deploy-pages`. Use the current major version of every action, verified when this task is implemented.
- [ ] **Step 6:** Write `netlify.toml` (`command = "npm run build"`, `publish = "dist/system-design-lab/browser"`, a 404 rule) and `vercel.json` (same output directory, `cleanUrls`, `trailingSlash: true`).
- [ ] **Step 7:** Run `npm run build -- --base-href /master-system-design/ && npm run e2e`. Expected: the smoke test passes.
- [ ] **Step 8: Commit** `ci: add static server, e2e smoke, GitHub Pages deploy`.

---

## Milestone B — Content pipeline (pure TypeScript)

### Task 3: Content schemas and compiled types

**Files:**
- Create: `scripts/schemas.ts`, `scripts/content-types.ts`
- Create: `scripts/test/fixtures/valid/**`: a minimal content tree with 1 phase-0 lesson, 1 playbook, 1 example, 1 complete and 1 outline case study, 1 quiz, 1 drill, 2 diagrams, 1 figure, the icons those need, `glossary.json`, `components.json` (3 components) and `path.json`
- Test: `scripts/schemas.spec.ts`

**Interfaces (produces):**
- Constants: `PHASE_IDS = ['foundations','building-blocks','data-systems','ml-systems','llm-systems','frontier-infrastructure'] as const`, `TRACKS = ['A','B','C']`, `DIFFICULTIES = ['beginner','intermediate','advanced']`, `CASE_STUDY_STATUSES = ['complete','outline']`, `COMPONENT_CATEGORIES = ['clients-edge','compute','data','messaging','ml','llm']`, `SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/`.
- Zod schemas, each with an exported `z.infer` type of the same name minus `Schema`:
  - `LessonFrontmatterSchema`: `slug, title, phase (PHASE_IDS), order (int ≥1), summary (≤ 200 chars), estimatedMinutes (int 3–30), concepts: string[], exercises: string[] (≥1)`
  - `PlaybookFrontmatterSchema`: `slug, title, order, summary, estimatedMinutes, concepts, exercises`
  - `ExampleFrontmatterSchema`: `slug, title, summary, concepts, tags: string[], diagram?: string`
  - `CaseStudyFrontmatterSchema`: the brief's §5.4 fields exactly (`slug, title, track, order 1–50, difficulty, concepts, prerequisites, estimatedMinutes, status, exercises, diagram`) plus `summary`
  - `DiagramSchema`: brief §6 shape plus optional `title`, `description`. `superRefine` checks unique node ids, edge endpoints exist, `from !== to`, and `ratio` is in `(0, 1000]`.
  - `ComponentSchema`/`ComponentCatalogSchema`: `type, label, category, icon, description, sim: { capacityRps >0, instances int ≥1, baseLatencyMs ≥0, costPerHourPerInstance ≥0 } & Record<string, number>`. The catalog is `{ note: string, components: Component[] }`.
  - `QuizSchema`: `id, title, topics, difficulty, questions[≥1]: { id, prompt, kind: 'single'|'multi', level: Difficulty, options[≥2]: {id,text}, correct: string[], explanation, hint? }`. Refinements: option ids are unique; `correct ⊆ option ids`; `single` has exactly 1 correct; `multi` has ≥1. A quiz with ≥ 4 questions must contain ≥ 2 distinct `level`s (D14).
  - `DrillSchema`: `id, title, topics, difficulty, scenario (markdown), givens: {label, value: number|string, unit?}[], questions[≥1]: { id, prompt, unit, answer: number, tolerance?: Tolerance }, solution (markdown)`. `Tolerance = {kind:'relative', value: (0,10]} | {kind:'absolute', value ≥0} | {kind:'orderOfMagnitude'}`, default `{kind:'relative', value:0.25}`.
  - `GlossarySchema`: `{ terms: { id (slug), term, definition (≤ 400 chars), aliases?: string[], related?: string[] }[] }`
  - `LearningPathSchema`: `{ phases: { id: PhaseId, number: 0–5, title, summary, items: { kind: 'lesson'|'case-study'|'playbook'|'example', ref: string }[] }[] }`
- `scripts/content-types.ts` (plain TS, no zod; the app imports it as `@content/types`):
  `ContentBlock = {kind:'html'; html:string} | {kind:'diagram'; id:string} | {kind:'quiz'; id:string} | {kind:'drill'; id:string}`; `Heading = {id; text; depth: 2|3}`; `CompiledDoc = {blocks: ContentBlock[]; headings: Heading[]}`; `CompiledLesson = LessonMeta & CompiledDoc`; likewise `CompiledPlaybook`, `CompiledExample`, `CompiledCaseStudy`; `CompiledQuiz = Quiz`; `CompiledDrill = Omit<Drill,'scenario'|'solution'> & { scenarioHtml; solutionHtml }`; `ExerciseMeta = { id; kind:'quiz'|'drill'; title; topics; difficulty; url }`; `SearchDoc = { id: url; kind; title; summary; headings; text; url }`. It re-exports the inferred meta and enum types.

- [ ] **Step 1: Write failing tests:** every valid fixture parses. Each of the following fails with a message naming the field: a quiz with `correct: []`; a single-choice question with 2 correct; `correct` naming an unknown option; a drill with `tolerance.value = 0`; a case study with `track: 'D'`; `slug: 'Bad Slug'`; a diagram edge to a missing node; a self-loop edge; a duplicate node id; a component with `instances: 0`.
- [ ] **Step 2:** Run `vitest run --config vitest.scripts.config.ts scripts/schemas.spec.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `schemas.ts` and `content-types.ts`.
- [ ] **Step 4:** Run the tests again. Expected: PASS.
- [ ] **Step 5: Commit** `feat(content): zod schemas and compiled content types`.

### Task 4: SVG asset pipeline for custom icons and figures

**Files:**
- Create: `scripts/lib/svg-assets.ts`
- Test: `scripts/lib/svg-assets.spec.ts`

**Interfaces (produces):**
- `sanitizeIcon(name: string, source: string): { body: string; errors: string[] }`. `body` is the inner markup of a `viewBox="0 0 24 24"` icon.
- `sanitizeFigure(id: string, source: string): { svg: string; title: string; animated: boolean; errors: string[]; warnings: string[] }`.

Rules (parse with `rehype-parse` `{ fragment: true }`, walk the hast tree, serialize with `hast-util-to-html`):
- **Icons:** root `<svg viewBox="0 0 24 24">`. Allowed elements: `g path circle rect line polyline polygon ellipse`. No `style` or `class`. `stroke` and `fill` may only be `currentColor` or `none`. The output strips root attributes; the Angular icon component sets `stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke="currentColor"`.
- **Figures:** the root needs a `viewBox`. The first child must be `<title>`, and `<desc>` is recommended (warning if missing). The icon element set is allowed, plus `text tspan defs marker linearGradient stop clipPath use style title desc`. Rejected: `script`, `foreignObject`, `image`, `animate*`/`set` (SMIL can't be stopped by reduced motion, so animation is CSS-only), any `on*` attribute, any `href`/`xlink:href` not starting with `#`, and CSS containing `@import`, `url(` not followed by `#`, or `expression(`. If the CSS has `@keyframes`, it **must** also contain `@media (prefers-reduced-motion: reduce)` (error otherwise). Hex or rgb colors outside `var(--fig-*, fallback)` produce a warning. Every `id` is rewritten to `fig-<figureId>-<id>`, and so are all `#id`, `url(#id)` and CSS `#id` references. This prevents marker and gradient clashes when several figures appear on one page.

- [ ] **Step 1: Write failing tests:** a valid icon passes and loses its root attributes; an icon with `fill="#f00"`, `<text>` or a 16×16 viewBox fails; a valid animated figure passes with `animated: true`; a figure with `<script>`, `onload=`, `href="https://…"`, `<animate>` or `@import` fails, one error per issue; keyframes without the reduced-motion media query fail; a missing `<title>` fails; ids and `url(#arrow)` and `href="#arrow"` are rewritten consistently; two figures with the same internal id produce distinct ids.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(content): sanitize and validate custom SVG icons and figures`.

### Task 5: Markdown compiler with shortcodes, callouts and highlighting

**Files:**
- Create: `scripts/lib/markdown.ts`, `scripts/lib/directives.ts`
- Test: `scripts/lib/markdown.spec.ts`

**Interfaces:**
- Consumes: `ContentBlock`, `CompiledDoc`, `Heading` (Task 3); the figure output of `sanitizeFigure` (Task 4).
- Produces: `createCompiler(): Promise<MarkdownCompiler>`, which creates the Shiki highlighter once with languages `ts js json yaml sql bash python http text` and themes `github-light`/`github-dark`, `defaultColor: false`. `MarkdownCompiler.compile(source: string, ctx: { file: string; figures: ReadonlyMap<string, {svg: string; title: string}> }): Promise<CompileResult>`, where `CompileResult = { frontmatter: unknown; doc: CompiledDoc; text: string; refs: ContentRefs; errors: ContentError[] }`, `ContentRefs = { diagrams; quizzes; drills; figures; terms; links: string[] }`, and `ContentError = { file: string; message: string; severity: 'error'|'warning' }` (exported from `scripts/lib/errors.ts`).

Pipeline: `remark-parse` → `remark-frontmatter` (YAML parsed with `yaml`) → `remark-gfm` → `remark-directive` → `remarkShortcodes` (directives.ts) → `remark-rehype` (no raw HTML) → `rehype-slug` → heading collector → `@shikijs/rehype` → internal-link rewriter → block splitter → `hast-util-to-html` per HTML chunk.

Directive contract (in `directives.ts`):
- Leaf `::diagram{id}`, `::quiz{id}`, `::drill{id}` each become a standalone non-HTML block at that position.
- Leaf `::figure{id caption}` becomes `<figure class="figure" data-figure="id">{svg}<figcaption>{caption}</figcaption></figure>`. `caption` is required.
- Container `:::note`, `:::tip`, `:::warning`, `:::primer` (default label "New to this?") and `:::interview` (default label "Interview tip"), each with an optional `[Label]`, becomes `<aside class="callout callout-{type}" role="note" aria-label="{Label|default}"><p class="callout-title">…</p>…</aside>`.
- Container `:::deeper[Title]` becomes `<details class="deeper"><summary>Go deeper: {Title}</summary>…</details>`. It is collapsed by default, and its text is still indexed for search.
- Text `:term[label]{id}` becomes `<a class="term" href="glossary#{id}" data-internal="/glossary#{id}" data-term="{id}">label</a>`.
- Any other directive name, a missing `id`, a raw HTML node, or an unknown code language is an error carrying the line number.
- Links: href `/x` becomes `href="x"` (relative to base) plus `data-internal="/x"`. `#frag` becomes `data-anchor="frag"`. `http(s)` links get `rel="noopener"` and the class `external`. Other schemes are an error.
- Headings: h2 and h3 are collected with their slug ids. Duplicate slugs get `-1`, `-2` suffixes from rehype-slug. `text` is the plain text used for search (code blocks excluded).

- [ ] **Step 1: Write failing tests:** frontmatter is extracted; `::quiz{id="q1"}` between two paragraphs yields `[html, quiz, html]` blocks; `:::warning` yields the callout markup; `:::primer` gets the default label "New to this?"; `:::deeper[Consistent hashing math]` yields a closed `<details>` whose text appears in `text`; `:term[CAP]{id="cap-theorem"}` yields the link and records `refs.terms`; `::bogus` and `<script>` each produce an error with a line number; a fenced ` ```ts ` block has Shiki classes and CSS-variable styles; ` ```cobol ` errors; `[x](/glossary)` is rewritten; `[x](javascript:…)` errors; headings are collected in order with depth; `text` excludes code; two compiles of the same input are byte-identical.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(content): markdown compiler with shortcodes, callouts and Shiki`.

### Task 6: Loader, cross-reference rules and structure rules

**Files:**
- Create: `scripts/lib/load.ts`, `scripts/lib/validate-refs.ts`, `scripts/lib/validate-structure.ts`, `scripts/lib/routes.ts`, `scripts/lib/errors.ts`
- Create: `scripts/test/fixtures/invalid-*/`, one small fixture per rule below (each a copy of `valid/` with one defect)
- Test: `scripts/lib/load.spec.ts`, `scripts/lib/validate-refs.spec.ts`, `scripts/lib/validate-structure.spec.ts`

**Interfaces:**
- Consumes: the schemas (Task 3), `sanitizeIcon`/`sanitizeFigure` (Task 4), `MarkdownCompiler` (Task 5).
- Produces: `loadContent(root: string, compiler: MarkdownCompiler): Promise<{ content: LoadedContent; errors: ContentError[] }>`. `LoadedContent` holds the typed, compiled lessons, playbooks, examples, case studies, quizzes, drills (scenario/solution compiled), diagrams (from `case-studies/*/diagram.json` and `diagrams/*.json`), figures, icons, glossary, components and path, each with `file` and `refs`. Files are read in sorted order. `_templates/` and `exercises/` are skipped.
- Produces: `routeFor(item): string` and `allRoutes(content): string[]` in `routes.ts`. They return app paths with a leading slash and no trailing slash: `/`, `/path`, `/learn/:phase/:lesson`, `/examples[/:slug]`, `/playbooks[/:slug]`, `/case-studies[/:slug]`, `/exercises[/:id]`, `/playground`, `/glossary`, `/progress`, `/contribute`.
- Produces: `validateReferences(c: LoadedContent): ContentError[]` with these rules (the error message names the rule id):
  - **R1** Duplicate slugs or ids within a type. Quiz and drill ids share one namespace (they are the exercise ids).
  - **R2** A lesson's file path `<phase>/<slug>.md` must match its frontmatter `phase`/`slug`. The case-study folder must equal `slug`. A case-study `diagram.json` `id` must equal frontmatter `diagram`.
  - **R3** Every diagram node `type` exists in `components.json`. Every component `icon` exists in `content/icons/`.
  - **R4** Every `concepts` id, `:term` id and glossary `related` id exists in the glossary.
  - **R5** `prerequisites` reference existing case studies and contain no cycle (the cycle is reported as `a → b → a`).
  - **R6** `exercises` and the `::quiz`/`::drill` refs exist. Every lesson and playbook has ≥1 exercise. Every complete case study lists ≥1 quiz.
  - **R7** `::diagram` and `::figure` refs exist. An example's `diagram` exists.
  - **R8** Internal links resolve to a route in `allRoutes`. A `#fragment` on a content page must match a heading id of the target. `glossary#id` must match a term.
  - **R9** `path.json` has exactly the 6 phases in `PHASE_IDS` order with `number` 0–5. Every lesson and case study appears exactly once. Lessons sit in their own phase. All refs exist.
  - **R10** Case-study `order` is unique, and track A/B/C orders are 1–15, 16–30 and 31–50 respectively.
  - **R11** Every lesson and every complete case study contains ≥1 `:::primer`, ≥1 `:::deeper` and ≥1 `:::interview` (D14).
- Produces: `validateCaseStudyStructure(cs): ContentError[]`. It compares exact H2 heading text, in order:
  - complete: `Problem statement`, `Requirements`, `Back-of-envelope estimates`, `API design and data model`, `High-level design`, `Deep dives`, `ML/LLM design` (tracks B/C only; it must be absent for A), `Trade-offs`, `Failure modes, scaling and monitoring`, `Real-world references`, `45-minute interview version`, `Practice`.
  - outline: `Problem statement`, `Requirements`, `Key concepts`, `High-level design`.
  - Both require `::diagram{id=<frontmatter.diagram>}` inside `High-level design`.
  - Warning when `estimatedMinutes` differs by more than 40 % from words/220 + 2 per quiz/drill.

- [ ] **Step 1: Write failing tests:** the `valid` fixture produces zero errors; each `invalid-*` fixture produces exactly its rule's error with the right file path; a fixture with three defects reports all three (no fail-fast); a prerequisite cycle shows the cycle path; a complete track-A case study containing `ML/LLM design` errors; an outline missing `Key concepts` errors.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(content): loader with cross-reference and structure validation`.

### Task 7: Build orchestrator, deterministic emit, search index, watch mode

**Files:**
- Create: `scripts/build-content.ts`, `scripts/lib/emit.ts`, `scripts/lib/search-index.ts`, `scripts/search-options.ts`
- Test: `scripts/build-content.spec.ts`, `scripts/lib/search-index.spec.ts`

**Interfaces:**
- Consumes: `loadContent`, `validateReferences`, `validateCaseStudyStructure`, `allRoutes` (Task 6).
- Produces the CLI: `build-content.ts [--check] [--watch] [--content <dir>=content] [--out <dir>=src/generated]`. It prints `path: [rule] message` lines and a summary like `✖ 3 errors, 1 warning`. Exit code is 1 on any error, 0 otherwise. `--check` never writes. On errors the output dir is left untouched.
- Produces `runBuild(opts): Promise<{ errors: ContentError[]; written: number }>` for tests.
- Produces `src/generated/`:
  - `manifest.ts`: `PHASES`, `LESSONS`, `PLAYBOOKS`, `EXAMPLES`, `CASE_STUDIES`, `EXERCISES: ExerciseMeta[]`, `GLOSSARY`, `COMPONENTS`, `PATH`. These are metadata only, typed via `@content/types`.
  - `loaders.ts`: `LOADERS: { lesson; playbook; example; caseStudy; quiz; drill; diagram }`, each `Record<string, () => Promise<T>>` built from `() => import('./items/<kind>/<key>.json').then(m => m.default as T)`. The lesson key is `<phase>/<slug>`.
  - `items/**.json`: one file per item.
  - `icons.ts`: `ICONS: Record<string, string>`.
  - `mascot.ts`: `MASCOT: Record<'idle'|'thinking'|'cheer'|'puzzled'|'sleep'|'fly', string>`, built from the sanitized `content/figures/mascot-*.svg`. Those figures are exempt from the "unreferenced" check, but all 6 must exist.
  - `search-index.json`: `MiniSearch#toJSON()`.
  - `routes.json`: `{ all: string[]; params: { lessons: {phase, lesson}[]; caseStudies, playbooks, examples: {slug}[]; exercises: {id}[] } }`.
- Produces `SEARCH_OPTIONS` in `search-options.ts`, shared by the build and the app: `fields ['title','summary','headings','text']`, `storeFields ['kind','title','url','summary']`, `idField 'url'`, `searchOptions { boost: { title: 3, headings: 2 }, prefix: true, fuzzy: 0.2 }`. The index covers lessons, case studies, playbooks, examples, exercises and glossary terms (url `/glossary#id`).
- Emit rules: JSON with 2-space indent and a trailing newline. Arrays keep a stable order (by `order`, then slug). A file is written only when its bytes changed. Stale files are deleted.
- Watch: chokidar on `content/`, 100 ms debounce, full rebuild, errors printed without exiting.

- [ ] **Step 1: Write failing tests:** `runBuild` on `valid` writes the expected file list; a second run reports `written: 0` and byte-identical files; `--check` on `valid` writes nothing; `invalid-*` gives a non-zero errors count and leaves an existing out dir unchanged; deleting a source item and rebuilding removes its JSON; the search index loaded with `SEARCH_OPTIONS` finds the fixture lesson for `"cach"` (prefix) and `"cachng"` (fuzzy).
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Wire `validate-content` and `content:build` in `package.json`, make `npm test` and `npm start` use them (see the scripts table), and add `src/generated/` to the ESLint and Prettier ignores.
- [ ] **Step 4:** Run the tests. Expected: PASS. Run `npm run validate-content`. Expected: exit 0 on the (still empty) `content/`. Bootstrap `content/` with empty-but-valid `glossary.json`, `components.json` and `path.json` (6 phases, no items).
- [ ] **Step 5: Commit** `feat(content): deterministic build, search index, watch mode`.

---

## Milestone C — App core

### Task 8: Safe storage and progress store

**Files:**
- Create: `src/app/core/storage/safe-storage.ts`, `src/app/core/progress/{progress-model.ts,progress-migrate.ts,progress-io.ts,progress.store.ts}`
- Test: a `*.spec.ts` beside each

**Interfaces (produces):**
- `interface KeyValueStorage { get(key: string): string | null; set(key: string, value: string): boolean; remove(key: string): void }`. `createSafeStorage(backing: () => Storage | undefined): KeyValueStorage` uses the backing storage while it works and switches permanently to an in-memory map on the first throw or when no backing storage exists. `set` returns `false` on a quota error, and the value is still kept in memory. `SAFE_STORAGE` is an `InjectionToken<KeyValueStorage>` that uses `localStorage` in the browser and memory on the server.
- `type ItemKey = \`${'lesson'|'case-study'|'playbook'|'example'|'exercise'}:${string}\``. `interface ProgressState { version: 1; completed: Record<ItemKey, string /* ISO */>; quizScores: Record<string, { best: number; total: number; lastAttemptAt: string }>; drillAttempts: Record<string, { bestCorrect: number; total: number; lastAttemptAt: string }>; activityDays: string[] /* local YYYY-MM-DD, sorted, unique, last 400 kept */; seenAchievements: string[]; prefs: { learnerLevel: 'new' | 'some' | 'expert' | null; calmMode: boolean }; savedDesigns: Record<string, never> /* reserved for Phase 2 */ }`. Also `PROGRESS_VERSION = 1`, `PROGRESS_KEY = 'sdl.progress'`, and `emptyProgress(): ProgressState`. XP, level and achievements are **derived** (Task 13a), never stored, so they can't drift.
- `migrateProgress(raw: unknown): { state: ProgressState; status: 'ok' | 'reset' | 'future' }`. `null`, garbage or wrong shapes give `reset` with an empty state. v1 gives `ok`, with malformed entries dropped one by one. `version > 1` gives `future` with an empty state. A migration table `MIGRATIONS: Record<number, (s) => unknown>` is in place for v2+.
- `serializeExport(state, now: Date): string` produces `{ app: 'system-design-lab', exportedAt, progress }`. `parseImport(text: string): { ok: true; state: ProgressState } | { ok: false; error: string }` rejects text over 1 MB, non-JSON, a wrong `app`, a future version and invalid shapes, each with its own message.
- `ProgressStore` (`providedIn: 'root'`):
  - signals: `ready: Signal<boolean>` (true only after `afterNextRender` in the browser), `completed`, `quizScores`, `drillAttempts`.
  - methods: `isComplete(key: ItemKey): boolean`, `setComplete(key, done: boolean)`, `recordQuiz(id, score, total)`, `recordDrill(id, correct, total)`, `setPrefs(p: Partial<Prefs>)`, `markAchievementsSeen(ids: string[])`, `replaceAll(state)`, `reset()`, `exportJson(): string`. Any completion or attempt adds today's local date to `activityDays`, using a clock injected through the `CLOCK` token (`() => Date`) so tests can control it.
  - `recordQuiz` keeps the best score and auto-completes `exercise:<id>` when `score/total ≥ 0.7`. `recordDrill` keeps the best result and auto-completes when `correct === total`.
  - It loads in the browser after first render. It persists with an `effect`, except when the migration status is `future`, in which case it never writes. It reloads on the window `storage` event for `sdl.progress`.

- [ ] **Step 1: Write failing tests:** two completions on the same day add one `activityDays` entry; `setPrefs({calmMode: true})` persists; a backing store that throws on `getItem` falls back to memory and works; a quota error on `setItem` returns false and the value stays readable; `migrateProgress` handles `null`, `"x"`, `[]`, `{version: 1, completed: {"lesson:a": 5}}` (bad entry dropped) and `{version: 9}` (→ `future`); a store whose stored data is `future` never calls `set`; `recordQuiz(…, 7, 10)` completes the exercise but `(…, 6, 10)` doesn't; best score is kept across attempts; `parseImport` handles the five rejection cases plus a successful round trip equal to the original; a `storage` event updates the signals; `ready()` is false before `afterNextRender`.
- [ ] **Step 2:** Run `ng test --no-watch --include src/app/core`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(progress): safe storage and versioned progress store with import/export`.

### Task 9: Theme, shell, layout, icon component, UI icon set

**Files:**
- Create: `src/app/core/theme/theme.service.ts`, `src/app/layout/{shell,top-nav,footer,doc-layout,toc}/*`, `src/app/shared/icon/icon.component.ts`
- Create (made by us): `content/icons/` UI icons: `search sun moon menu x check check-circle circle chevron-left chevron-right arrow-right external-link github book-open route layers flask-conical list download upload trash lightbulb alert-triangle info feather flame trophy star sparkles lock`
- Test: `theme.service.spec.ts`, `top-nav.component.spec.ts`, `toc.component.spec.ts`, `icon.component.spec.ts`

**Interfaces (produces):**
- `type ThemePreference = 'light' | 'dark'` (default `'light'`, per D15; if you choose to follow the OS instead, add `'system'` back). `ThemeService`: `preference: Signal<ThemePreference>`, `toggle()`, persisted to `sdl.theme` through `SAFE_STORAGE`. It applies the `.dark` class and the `color-scheme` style on `<html>`.
- `<app-icon name="search" [label]?>` renders `ICONS[name]`. It is `aria-hidden` unless a `label` is given, and then it has `role="img"` and `aria-label`.
- `<app-doc-layout>` has three slots, `[sidebar]`, main content and `[toc]`. The sidebar collapses into a disclosure on screens under 1024 px. The TOC shows only at ≥ 1280 px. Content is capped at `max-w-[75ch]`.
- `<app-toc [headings]="Heading[]">` uses `IntersectionObserver` scroll-spy in the browser only, sets `aria-current="location"` on the active item, and scrolls on click via `scrollIntoView` (instant under reduced motion) without changing the base path.
- Top nav is a **parrot-green bar with black labels**; the active item is a white pill with a black border and black text. Items in order: Path, Case studies, Playbooks, Examples, Exercises, Glossary, Progress, then the search button (Task 17 wires it), the XP/level/streak chip (Task 13a), the theme toggle (`aria-label="Theme: {preference}"`) and a GitHub link. Sidebar menus use the same parrot treatment for the active item. On mobile these sit behind a menu button with `aria-expanded`. A "Skip to content" link targets `#main`. The footer shows the license line "Code MIT · Content CC BY 4.0" and links to Contribute and GitHub.

- [ ] **Step 1:** Draw the UI icons as 24×24 stroke SVGs, consistent with D11 (1.75 stroke, round caps).
- [ ] **Step 2: Write failing tests:** the default is `light` even when a mocked matchMedia reports dark; toggle and persistence; the nav renders the 7 links with the right `routerLink`s; the skip link exists; the TOC marks the observed heading active (with a mocked IntersectionObserver); an icon with `label` gets `role="img"`.
- [ ] **Step 3:** Run the tests. Expected: FAIL.
- [ ] **Step 4:** Implement it all, including D11 typography, spacing and radius scale, and the focus-visible styles.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6: Commit** `feat(ui): theme service, app shell, doc layout, TOC and icon set`.

### Task 10: Content blocks renderer, internal links, shared UI pieces

**Files:**
- Create: `src/app/shared/content-blocks/content-blocks.component.ts`, `src/app/shared/trusted-html.pipe.ts`, `src/app/shared/internal-links.directive.ts`, `src/app/shared/complete-toggle/complete-toggle.component.ts`, `src/app/shared/badge/badge.component.ts`, `src/app/shared/progress-ring/progress-ring.component.ts`, `src/styles/content.css` (prose, callout, figure and Shiki dual-theme CSS)
- Test: a spec beside each component, directive and pipe

**Interfaces:**
- Consumes: `ContentBlock` (Task 3), `ProgressStore` (Task 8). Embeds `app-diagram-embed` (Task 11), `app-quiz-embed` (Task 12) and `app-drill-embed` (Task 13). Until those exist, use stub components with the same selectors.
- Produces:
  - `<app-content-blocks [blocks]>`. HTML blocks render through `trustedHtml`, which uses `DomSanitizer.bypassSecurityTrustHtml`. It is used **only** here, because the HTML was compiled and sanitized at build time from repo content. Diagrams render directly, since they are SSR-friendly. Quizzes and drills render inside `@defer (on viewport; prefetch on idle)` with a fixed-height placeholder showing the title, so there is no layout shift.
  - `appInternalLinks` directive, on the HTML container. A plain left click on `a[data-internal]` calls `router.navigateByUrl(dataset.internal)`. A click on `a[data-anchor]` scrolls to the id. Modifier-key and middle clicks are left to the browser.
  - `<app-complete-toggle [itemKey]>`: a button with `aria-pressed`, with the text "Mark as complete" or "Completed ✓" (icon plus text). It renders only when `store.ready()`, keeping its size reserved to avoid layout shift.
  - `<app-badge [kind]="'difficulty'|'status'|'track'" [value]>` is text-first, with color as reinforcement only.
  - `<app-progress-ring [done] [total] [label]>`: an SVG ring plus visible text "3 / 8" and `aria-label="{label}: 3 of 8 complete"`.

- [ ] **Step 1: Write failing tests:** `[html, quiz, html]` renders 2 HTML containers and 1 quiz placeholder; clicking `a[data-internal="/glossary#cap-theorem"]` calls `navigateByUrl('/glossary#cap-theorem')` and prevents default; a ctrl+click does not; an anchor click scrolls to the element; the toggle is absent before `ready` and flips `aria-pressed` and the store after a click; the ring's `aria-label` text is correct for 0/0, 3/8 and 8/8.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): content block renderer, internal links, completion and badges`.

### Task 11: Read-only diagram viewer with custom node shapes

**Files:**
- Create: `src/app/canvas/diagram-geometry.ts`, `src/app/canvas/node-shapes.ts`, `src/app/canvas/diagram-viewer/diagram-viewer.component.ts`, `src/app/shared/diagram-embed/diagram-embed.component.ts`
- Test: `diagram-geometry.spec.ts`, `node-shapes.spec.ts`, `diagram-viewer.component.spec.ts`

**Interfaces:**
- Consumes: `Diagram` and `Component` types, `COMPONENTS`, `LOADERS.diagram`, `ICONS`.
- Produces:
  - `NODE_W = 168`, `NODE_H = 72`, `PAD = 32`. `layoutDiagram(d: Diagram, catalog: ReadonlyMap<string, Component>): DiagramLayout`, where `DiagramLayout = { viewBox: {x;y;width;height}; nodes: {id; label; type; category; icon; x; y; w; h; shape: string}[]; edges: {id; d: string; from; to; label?; labelAt?: {x;y}}[] }`. `position` is a node's top-left corner. An edge is the center-to-center segment clipped to both node rectangles. When both A→B and B→A exist, the two paths are offset ±8 px perpendicular. An empty diagram returns viewBox `0 0 400 200`.
  - `shapePath(category: ComponentCategory, w: number, h: number): string` returns a closed path for each category: clients-edge is a pill; compute is a rect with r=8; data is a cylinder; messaging is a "tag" (queue) with a notched right side; ml is a rect with one cut corner; llm is a rounded hexagon. Category is also conveyed by an icon and by the legend text, never by color alone.
  - `<app-diagram-viewer [diagram] [catalog]>` renders `<svg role="img" aria-labelledby="{title} {desc}">` with an arrow `<marker>` (ids prefixed with the diagram id), node shapes, icons, labels (truncated with an ellipsis, full text in a `<title>`), a legend of the categories used, a scroll container (`tabindex="0"`, `role="region"`, `aria-label="Diagram, scroll to pan"`) and `<details><summary>Text description</summary>`. The details list the components as "Label (type, ×instances)" and the connections as "From → To (label)".
  - `<app-diagram-embed [id]>` loads the diagram through `ContentService.getDiagram` (Task 14) and adds a caption. The "Open in Playground" button appears only when `FEATURES.playground` is set.

- [ ] **Step 1: Write failing tests:** the viewBox contains every node rect plus `PAD`; each edge's start and end lie on the boundary of its node rect (within 0.5 px); a bidirectional pair gets two different `d` values; the empty diagram yields the default viewBox and the viewer shows "No components yet"; `shapePath` returns 6 distinct strings, each ending in `Z`; the text description lists every node and edge; marker ids are unique when two viewers render on the same page.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(canvas): read-only SVG diagram viewer with category node shapes`.

### Task 12: Quiz

**Files:**
- Create: `src/app/shared/quiz/quiz-scoring.ts`, `src/app/shared/quiz/quiz.component.ts`, `src/app/shared/quiz/quiz-embed.component.ts`
- Test: `quiz-scoring.spec.ts`, `quiz.component.spec.ts`

**Interfaces:**
- Consumes: `CompiledQuiz`, `ProgressStore.recordQuiz`, `ContentService.getQuiz` (Task 14), `LiveAnnouncer` (CDK).
- Produces: `scoreQuiz(quiz: CompiledQuiz, answers: Readonly<Record<string, readonly string[]>>): { score: number; total: number; perQuestion: Record<string, { correct: boolean; selected: string[]; expected: string[] }> }`. A multi-select question is correct only when the selected set equals the expected set exactly. An unanswered question counts as incorrect.
- Produces `<app-quiz [quiz]>`. Each question is a `<fieldset>` with a `<legend>` and a text level label (Beginner / Intermediate / Advanced), radios for single questions and checkboxes for multi questions (labeled "Select all that apply"). A "Show hint" button with `aria-expanded` sits beside each question that has a hint. "Check answers" stays disabled until every question has a selection, with a visible reason. After submit, each question shows Correct or Incorrect (icon plus text), the explanation, and the correct options highlighted, with "✓ correct answer" text. A summary like "4 of 5 correct" is announced politely. "Try again" resets the quiz. Each submit calls `recordQuiz`.
- Produces `<app-quiz-embed [id]>`, which loads the quiz and renders `<app-quiz>`.

- [ ] **Step 1: Write failing tests:** a single-choice question is right or wrong; multi-select with an exact match, a subset or a superset (only the exact match counts); unanswered questions count as wrong; the button is disabled until all questions are answered; explanations are hidden before submit and visible after; `recordQuiz` is called with `('q1', 4, 5)`; the hint toggle sets `aria-expanded`; "Try again" clears the selections.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(exercises): accessible quiz with scoring and explanations`.

### Task 13: Estimation drill

**Files:**
- Create: `src/app/shared/drill/parse-number.ts`, `src/app/shared/drill/tolerance.ts`, `src/app/shared/drill/format-number.ts`, `src/app/shared/drill/drill.component.ts`, `src/app/shared/drill/drill-embed.component.ts`
- Test: `parse-number.spec.ts`, `tolerance.spec.ts`, `format-number.spec.ts`, `drill.component.spec.ts`

**Interfaces:**
- Consumes: `CompiledDrill`, `Tolerance`, `ProgressStore.recordDrill`, `ContentService.getDrill`.
- Produces:
  - `parseHumanNumber(input: string): number | null`. Surrounding whitespace is trimmed. It accepts a sign, digits with `,`, `_` or thin-space group separators, a decimal point, an `e` exponent, and an optional case-insensitive suffix `k`=1e3, `m`=1e6, `b`/`g`=1e9 or `t`=1e12. Anything else returns `null`.
  - `checkAnswer(answer: number, expected: number, tol: Tolerance = DEFAULT_TOLERANCE): { correct: boolean; deltaPct: number | null }`. relative: `|a−e| ≤ v·|e|`, and when `e = 0`, `|a| ≤ 1e-9`. absolute: `|a−e| ≤ v`. orderOfMagnitude: `a > 0 && e > 0 && |log10(a/e)| ≤ 0.5` (D12). `deltaPct` is `(a−e)/|e|·100`, or null when `e = 0`.
  - `formatCompact(n: number): string` gives `1.2M`, `350K`, `4.5B`, `0.25` (`Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 })`).
  - `<app-drill [drill]>` shows the scenario HTML, a givens table, and one labeled `type="text" inputmode="decimal"` input per question with its unit in the label. A parse failure shows an inline error ("Couldn't read “1.2.3” as a number. Try 1.2M or 1200000.") linked through `aria-describedby`, and it blocks submit. After submit, each question shows correct or incorrect, the expected value as `formatCompact`, and "you were 18% high". It then reveals the step-by-step solution HTML and calls `recordDrill`.

- [ ] **Step 1: Write failing tests:**
  - `parseHumanNumber`: `"1.2M"→1.2e6`, `"1,200,000"→1.2e6`, `"1.2e6"→1.2e6`, `" 3k "→3000`, `"-5"→-5`, `"0"→0`, `""→null`, `"abc"→null`, `"1.2.3"→null`, `"1,2"→null` (malformed grouping), `"5kk"→null`.
  - `checkAnswer` with relative tolerance: expected 1000, 0.25 → 1250 ok, 1251 not; expected 0 → 0 ok, 0.1 not.
  - `checkAnswer` with order of magnitude: expected 1000 → 3162 ok, 3200 not, 317 ok, 300 not, −1000 not, 0 not.
  - `checkAnswer` with absolute tolerance 5: expected 100 → 105 ok, 106 not.
  - The component blocks submit on a parse error and shows the error text; correct submit calls `recordDrill('d1', 2, 2)`; the solution is hidden before submit and visible after.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(exercises): estimation drill with tolerant numeric answers`.

### Task 13a: Fun layer: XP, levels, streaks, achievements, mascot reactions, Calm mode

**Files:**
- Create: `src/app/core/game/{xp.ts,levels.ts,streak.ts,achievements.ts,game.store.ts}`, `src/app/shared/mascot/mascot.component.ts`, `src/app/shared/mascot/mascot-lines.ts`, `src/app/shared/celebrate/feather-burst.component.ts`, `src/app/shared/game-chip/game-chip.component.ts`, `src/app/shared/achievement-toast/achievement-toast.component.ts`
- Modify: `quiz.component.ts`, `drill.component.ts` (mascot reactions and celebration), `top-nav` (game chip and Calm-mode switch)
- Test: a spec beside each pure file, plus `mascot.component.spec.ts` and `game-chip.component.spec.ts`

**Interfaces:**
- Consumes: `ProgressState`/`ProgressStore` (Task 8), the manifest (Task 7), the mascot SVGs (Task 20; use a placeholder circle until then).
- Produces (all pure):
  - `XP_RULES = { lesson: 20, playbook: 20, example: 10, caseStudyComplete: 40, caseStudyOutline: 15, exercise: 10, perfectQuizBonus: 10 }`. `computeXp(state, manifest): number`.
  - `LEVELS = [{n:1,name:'Egg',min:0},{n:2,name:'Hatchling',min:50},{n:3,name:'Fledgling',min:150},{n:4,name:'Flyer',min:300},{n:5,name:'Navigator',min:500},{n:6,name:'Flock Leader',min:800},{n:7,name:'Architect',min:1200},{n:8,name:'Principal Parrot',min:1700}]`. `levelFor(xp): { level; next?: Level; progressToNext: number /* 0–1 */ }`.
  - `computeStreak(days: readonly string[], today: string): { current: number; longest: number }`. The streak counts consecutive local days ending today, **or yesterday** (a streak is not broken until a full day is missed). Duplicate and unsorted input is tolerated.
  - `ACHIEVEMENTS: { id; title; description; icon; earned(ctx): boolean }[]`, 12 of them: `first-flight` (first lesson), `foundations-done`, `building-blocks-done`, `first-case-study`, `track-a-explorer`, `track-b-explorer`, `track-c-explorer` (one complete case study per track), `perfect-quiz`, `five-perfect-quizzes`, `estimator` (3 drills fully correct), `streak-3`, `streak-7`. `earnedAchievements(ctx): string[]`. `newAchievements(earned, seen): string[]`.
- `GameStore` (root): computed signals `xp`, `level`, `streak`, `earned`, `unseen`. All are empty until `ProgressStore.ready()`, so nothing game-related is in prerendered HTML.
- `<app-mascot [pose]="'idle'|'thinking'|'cheer'|'puzzled'|'sleep'|'fly'" [line]?>` shows the SVG pose plus an optional one-line caption (black text on white with a hairline border). The caption is `aria-live="polite"` only when used for feedback. It renders nothing in Calm mode, except the 404 and empty-state poses, which carry information.
- `MASCOT_LINES`: a small bank of encouraging lines per situation (`correct`, `incorrect`, `hint`, `perfect`, `levelUp`, `streak`). They are deterministic per question id (hashed index), so SSR and tests stay stable.
- `<app-feather-burst>`: a subtle, CSS-only burst of ~8 small parrot-green feathers from the score badge, lasting about 0.9 s, on a perfect quiz or a level-up. It is restrained, not full-screen confetti. It is `aria-hidden`, skipped under reduced motion and in Calm mode.
- `<app-game-chip>` in the nav: "Lv 4 Flyer · 6-day streak". The streak uses a flame icon plus a text number. It links to `/progress`.
- `<app-achievement-toast>`: shown for `unseen` achievements after hydration, then calls `markAchievementsSeen`. It is suppressed in Calm mode (the achievements are still listed on `/progress`).
- The Calm-mode switch (`role="switch"`, `aria-checked`) sits in the nav overflow and on `/progress` → `setPrefs({ calmMode })`.

- [ ] **Step 1: Write failing tests:**
  - `computeXp` for an empty state (0), one lesson (20), and a perfect quiz (exercise 10 + bonus 10).
  - `levelFor(0)` → Egg; `levelFor(150)` → Fledgling; `levelFor(5000)` → Principal Parrot with no `next`.
  - `computeStreak`: `['2026-10-13','2026-10-14']` with today `'2026-10-15'` → current 2 (still alive); a gap → current 0; longest across a gap; duplicates and unsorted input handled; empty → 0/0.
  - Each achievement predicate has one positive and one negative case. `newAchievements` returns only the unseen ones.
  - The mascot renders nothing in Calm mode for `cheer`, but renders `fly` on 404.
  - The game chip is absent before `ready()`.
  - After a perfect quiz submit, the mascot pose is `cheer` and the feather burst is present, unless Calm mode is on or reduced motion is mocked.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement and wire the pieces into quiz, drill, nav and progress.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(fun): XP, levels, streaks, achievements, mascot and Calm mode`.

---

## Milestone D — Pages, search, prerender

### Task 14: Content service, routing, SEO, lesson/playbook/example pages

**Files:**
- Create: `src/app/core/content/content.service.ts`, `src/app/core/content/path-nav.ts`, `src/app/core/seo/seo.service.ts`, `src/app/app.routes.ts`, `src/app/features/{lesson,playbook,playbooks,example,examples,not-found}/*.page.ts`
- Test: `content.service.spec.ts`, `path-nav.spec.ts`, `seo.service.spec.ts`, `lesson.page.spec.ts`

**Interfaces (produces):**
- `ContentService`:
  - sync metadata: `phases()`, `lessons(phase?)`, `caseStudies()`, `playbooks()`, `examples()`, `exercises()`, `glossary()`, `components(): ReadonlyMap<string, Component>`.
  - async loaders returning `Promise<T | undefined>` for unknown keys: `getLesson(phase, slug)`, `getCaseStudy(slug)`, `getPlaybook(slug)`, `getExample(slug)`, `getQuiz(id)`, `getDrill(id)`, `getDiagram(id)`.
- `PathEntry = { key: ItemKey; title: string; url: string }`. `flattenPath(path, manifest): PathEntry[]`. `pathNeighbors(entries, key): { prev?: PathEntry; next?: PathEntry }`.
- `SeoService.setPage({ title, description, path })` sets `<title>` to "{title} · System Design Lab" (just `SITE_NAME` on home), `meta[name=description]`, `link[rel=canonical]` = `SITE_URL` + path, and `og:title`/`og:description`/`og:url`.
- Routes use `withComponentInputBinding()`, `withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' })`, and resolvers built from `ResolveFn`. When an item is missing the resolver returns `RedirectCommand` to `/not-found`. Every feature is a lazy `loadComponent`.
- The lesson page uses the doc layout. Sidebar: the phase's lessons, with check marks once `ready`. Header: "Phase 0 · Foundations", the title, "12 min". Then the blocks, then a "Practice" list of its exercises, the complete toggle, prev/next along the path, and "Edit this page on GitHub" (`REPO_URL/edit/main/<file>`). Playbook and example pages follow the same pattern, without a phase sidebar.

- [ ] **Step 1: Write failing tests:** `pathNeighbors` for the first, a middle and the last entry, and an unknown key; `getLesson('foundations','nope')` resolves undefined; `SeoService` sets the canonical link and the title format; the lesson page (stubbed service) renders the h1, blocks, practice links and prev/next hrefs.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(pages): content service, routing, SEO and lesson/playbook/example pages`.

### Task 15: Case study page and catalog with filters

**Files:**
- Create: `src/app/features/case-study/case-study.page.ts`, `src/app/features/case-studies/case-studies.page.ts`, `src/app/features/case-studies/case-study-filters.ts`
- Test: `case-study-filters.spec.ts`, `case-study.page.spec.ts`, `case-studies.page.spec.ts`

**Interfaces:**
- Consumes: `ContentService`, `pathNeighbors`, the shared UI from Task 10, `<app-diagram-embed>`.
- Produces: `interface CaseStudyFilters { tracks: Track[]; difficulties: Difficulty[]; concepts: string[]; statuses: CaseStudyStatus[]; query: string }`. `filterCaseStudies(items: CaseStudyMeta[], f): CaseStudyMeta[]` is OR within a facet, AND across facets. `query` matches title, summary and concept terms, case-insensitive. Results keep their `order`. `filtersFromParams(p: Params): CaseStudyFilters` silently drops unknown values. `filtersToParams(f): Params` omits empty facets. Keys: `track`, `difficulty`, `concept`, `status`, `q` (repeatable).
- Catalog: the prerendered page lists all 50 grouped by track, each showing order, title, difficulty and status badges, minutes and a completion mark (once `ready`). The filter controls are native checkboxes in `fieldset`s plus a search input. Results are announced as "Showing 12 of 50". Filters sync to the URL after hydration.
- Case study page: header with "Track B · ML systems", difficulty, minutes and concept chips (links to the glossary); prerequisites links; for outlines, a banner "Outline: contributions welcome" linking to `/contribute` and the GitHub edit URL; the sticky TOC; the blocks; a practice section from `exercises`; the complete toggle; prev/next.

- [ ] **Step 1: Write failing tests:** filtering by track B alone; B + advanced; two concepts (OR); a query that matches a concept term; empty filters return all items in order; a params round trip; `?track=Z` is ignored; the outline banner appears only for `status: 'outline'`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(pages): case study page and filterable catalog`.

### Task 16: Home, path, exercises, glossary, progress, contribute, playground placeholder

**Files:**
- Create: `src/app/features/{home,path,exercises,exercise,glossary,progress,contribute,playground}/*`, `src/app/features/path/phase-progress.ts`, `src/app/features/exercises/exercise-filters.ts`
- Test: `phase-progress.spec.ts`, `exercise-filters.spec.ts`, `progress.page.spec.ts`, `exercise.page.spec.ts`

**Interfaces:**
- Produces: `phaseProgress(phase: PathPhase, completed: ReadonlySet<ItemKey>, exercisesByItem): { done: number; total: number }`, which counts the phase's items plus their exercises. `filterExercises(items: ExerciseMeta[], f: { kinds: ('quiz'|'drill')[]; topics: string[] }): ExerciseMeta[]`.
- `recommendedStart(level: 'new'|'some'|'expert', path, manifest): { start: PathEntry; fastTrack: ItemKey[] }`. `new` starts at the first Phase 0 lesson. `some` starts at the first `building-blocks` lesson, with fast-track = the Phase 1 lessons' quizzes plus the Track A complete case studies. `expert` starts at the ML design framework playbook, with fast-track = the complete Track B/C case studies plus playbooks.
- Home: a clean white hero with the headline, a one-line value proposition, a primary parrot button ("Start learning"), a secondary button ("Browse case studies"), and a small Polly (idle pose) beside them; the **"Where should I start?" picker** (three clean cards with a hairline border; the selected card gets a parrot border and a check icon: *New to this*, *I know the basics*, *Preparing for senior / ML / LLM design*). Choosing one saves `prefs.learnerLevel` and shows the recommended start with a "Start here" button. Then "what this is", the learning ladder (6 phases, each with a one-line summary and an "what you'll be able to do" line), featured case studies (the 6 complete ones) and the animated `request-lifecycle` figure.
- Path: the same picker in compact form at the top; recommended and fast-track items carry a "Recommended for you" chip. 6 phase sections, each with a progress ring and its ordered items (kind icon, title, minutes, difficulty, completion mark), with nested exercises. Phases with no lessons yet show Polly sleeping and "Lessons for this phase are coming. Case studies are available now."
- Exercise page: renders `<app-quiz>` or `<app-drill>` by kind, with header and back links to the parent lesson or case study (via the reverse index in the manifest).
- Glossary: an A–Z jump list; each term is an `<article id="{id}">` with its definition and related links.
- Progress page: level, XP bar and streak at the top; an achievements grid (earned ones in parrot, locked ones outlined with how to earn them); the Calm-mode switch; overall and per-phase rings, a completed list with links, quiz best scores, drill results, and actions. "Export progress" downloads `system-design-lab-progress-YYYY-MM-DD.json`. "Import" uses a file input, then `parseImport`; on success it asks for confirmation in a CDK Dialog ("Replace your current progress?") before `replaceAll`, and on failure it shows an inline error. "Reset" requires a confirmation dialog.
- Contribute page: how to contribute, with links to CONTRIBUTING.md, the templates and the issue templates.
- Playground: a placeholder message plus the read-only component library grid (icon, shape preview, label, description, sim defaults, with the "Illustrative teaching values, not vendor benchmarks." note).

- [ ] **Step 1: Write failing tests:** `recommendedStart` for each of the 3 levels returns the start and fast-track listed above; picking a level on home persists `prefs.learnerLevel` and shows the matching "Start here" link; `phaseProgress` for an empty phase (0/0), a partial phase and a full phase; the exercise filter by kind and by topic; importing an invalid file on the progress page shows the error and leaves the store unchanged; a valid file opens the dialog, cancel leaves the state alone, confirm replaces it; export produces a Blob whose text passes `parseImport`; the exercise page renders the quiz for a quiz id and the drill for a drill id.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(pages): home, path, exercises, glossary, progress, contribute, playground`.

### Task 17: Client-side search

**Files:**
- Create: `src/app/core/search/search.service.ts`, `src/app/shared/search-dialog/search-dialog.component.ts`. Modify: `src/app/layout/top-nav/*` (button and shortcuts).
- Test: `search.service.spec.ts`, `search-dialog.component.spec.ts`

**Interfaces:**
- Consumes: `SEARCH_OPTIONS` (Task 7), `@generated/search-index.json`.
- Produces: `SearchService.search(query: string): Promise<SearchHit[]>`, where `SearchHit = { url; title; kind; summary }`. The index loads on the first call via `import()` plus `MiniSearch.loadJSON(json, SEARCH_OPTIONS)`. A query that is fewer than 2 characters after trimming returns `[]`. At most 20 hits are returned.
- The dialog opens through CDK Dialog from the nav button, from `/` and from Ctrl/⌘+K (ignored while focus is in an input, textarea or contenteditable). It uses the combobox pattern: an input with `role="combobox"`, `aria-expanded` and `aria-controls`, a listbox, `aria-activedescendant`, Arrow keys, Enter to navigate, and Esc to close with focus returning to the trigger. Results show a kind label in text.

- [ ] **Step 1: Write failing tests** against an index built from the fixture docs: a prefix match, a fuzzy match, `"a"` returning `[]`, and the 20-result cap. In the dialog, ArrowDown then Enter navigates to the second hit's url, Esc closes it, and `/` typed inside an input doesn't open it.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(search): lazy MiniSearch index with accessible search dialog`.

### Task 18: Prerender every route, plus full e2e, accessibility and Lighthouse gates

**Files:**
- Modify: `src/app/app.routes.server.ts`, `scripts/postbuild.ts` (reads `src/generated/routes.json`), `.github/workflows/ci.yml` (Lighthouse step)
- Create: `lighthouserc.json`, `e2e/{routes,learning-flow,progress,a11y,search,mobile,keyboard}.spec.ts`, `e2e/helpers/console.ts`

**Interfaces:**
- Consumes: `routes.json` `params` and `all` (Task 7).
- Produces: server routes. Every static route is `RenderMode.Prerender`. Each param route is `Prerender` with `getPrerenderParams` returning the matching `params` list. `**` is `RenderMode.Client`, served through `404.html`.
- Produces: `expectNoConsoleErrors(page)`, an e2e helper that collects `console.error` and `pageerror` events.

- [ ] **Step 1: Write the e2e specs** (all under the base path, against `npm run build -- --base-href /master-system-design/`):
  - routes: every path in `routes.json.all` is loaded directly. Each returns 200, has a visible `h1`, and logs zero console errors after `networkidle`. An unknown URL shows the not-found page.
  - learning-flow: a glossary link inside lesson HTML lands on `/master-system-design/glossary#…`; a TOC click scrolls and the URL stays under the base path; next and prev work; a full reload of a deep link works.
  - progress: mark a lesson complete, reload, it is still complete, and there are no console errors (Review Focus 2). Take a quiz to 100 %, and `/progress` shows the score after a reload. Export, reset, then import the file restores state. A seeded corrupted `sdl.progress` loads cleanly. With an `addInitScript` that makes `localStorage` throw, the app still works (Review Focus 3).
  - a11y: axe on home, path, a lesson, a case study, the catalog, an exercise, progress and glossary, in light and dark, with zero `serious`/`critical` violations.
  - search: Ctrl+K, type "consistent hashing", Enter, and the lesson page opens.
  - mobile (360 px): `document.documentElement.scrollWidth ≤ 360` on a lesson and a case study, because diagrams and code scroll inside their own containers.
  - fun layer: complete a lesson, and the nav chip shows 20 XP and a 1-day streak after a reload; a perfect quiz shows the cheering mascot and the `first-flight`/`perfect-quiz` toasts once (not again after a reload); with Calm mode on, no mascot, burst or toast appears; under `reducedMotion: 'reduce'`, the feather burst is absent.
  - theme: computed `color` of body text, headings and links is `rgb(0, 0, 0)` on a `rgb(255, 255, 255)` background in the default theme, and stays so with `colorScheme: 'dark'` emulated (D15). The nav background and primary buttons are `rgb(43, 178, 76)` with black labels.
  - keyboard: complete a quiz and a drill using only the keyboard.
- [ ] **Step 2:** Run `npm run build -- --base-href /master-system-design/ && npm run e2e`. Expected: FAIL where routes or prerender are missing.
- [ ] **Step 3:** Implement the server routes and the sitemap from routes, and fix whatever the specs expose.
- [ ] **Step 4:** Add `lighthouserc.json`. It collects through `serve-static` on 5 URLs (home, `learn/foundations/how-the-web-works/`, `case-studies/url-shortener/`, `case-studies/`, `playbooks/back-of-envelope-estimation/`). Assertions: `categories:performance|accessibility|best-practices|seo` minScore 0.9. In CI, run it after e2e. Locally, set `CHROME_PATH=/opt/pw-browsers/chromium`.
- [ ] **Step 5:** Run `npm run e2e && npm run lighthouse`. Expected: PASS. (These run in full once content exists, and again in Task 28.)
- [ ] **Step 6: Commit** `feat(build): prerender all routes; e2e, axe and Lighthouse gates`.

---

## Milestone E — Content and custom visuals

**Rules for every content task:** Follow the CONTRIBUTING style guide written in Task 27 (draft it at the start of Task 19 if needed). Use plain, direct, friendly language and second person, with short paragraphs and concrete analogies before formal definitions. Keep it fun: a real-world hook in the opening, a "try it" moment, and an occasional light parrot touch, never at the expense of accuracy.

**Depth layering (D14):** every lesson and complete case study has ≥1 `:::primer`, ≥1 `:::deeper` and ≥1 `:::interview`. Every quiz with ≥4 questions mixes levels (the schema enforces this). Validator rule **R11** (Task 6) enforces the callout requirement. Define every term on first use with `:term`. Lessons run 1,600–2,600 words plus a figure plus a quiz or drill. Full case studies run 3,500–6,000 words. Outlines run 300–600 words. Every estimate shows step-by-step math with its assumptions stated. Cite only references you are confident exist; otherwise write `TODO: add verified reference`. **Verification for each content step:** `npm run validate-content` exits 0, and `npm start` renders the page with no console errors. Commit one item per commit (`content: add lesson foundations/indexing`).

### Task 19: Component catalog, custom component icons, glossary, path skeleton

**Files:** `content/components.json`, `content/icons/<type>.svg` ×36 (made by us), `content/glossary.json`, `content/path.json`

- [ ] **Step 1:** Write `components.json` with `note: "Illustrative teaching values, not vendor benchmarks."` and these 36 types:
  - clients-edge: `client dns cdn api-gateway load-balancer`
  - compute: `app-server serverless-function worker scheduler`
  - data: `sql-primary sql-replica nosql-store cache object-storage search-index data-warehouse`
  - messaging: `message-queue event-stream pub-sub`
  - ml: `feature-store training-pipeline model-registry model-server-cpu model-server-gpu batch-inference drift-monitor`
  - llm: `llm-api llm-self-hosted embedding-model vector-db reranker semantic-cache guardrail agent-orchestrator tool eval-service`
  - Type-specific sim fields: `cache`/`semantic-cache` → `hitRate`; `sql-replica` → `readShare`; `message-queue`/`event-stream`/`pub-sub` → `maxDepth`; `llm-api`/`llm-self-hosted` → `tokensPerSecond`, `avgInputTokens`, `avgOutputTokens`, `maxBatchSize`.
- [ ] **Step 2:** Draw the 36 component icons in the Task 9 icon style. Then render all icons on the playground page and check them visually through the `figures:render` screenshot (Task 20 script) in light and dark.
- [ ] **Step 3:** Write the glossary seed with every term the Phase 1 content will use (≈100–130). Definitions are 1–2 sentences in our own words, with `related` links.
- [ ] **Step 4:** Write `path.json` with the 6 phases, titles and summaries. Items are added as content lands.
- [ ] **Step 5:** Validate, then commit.

### Task 20: Custom animated SVG explainers and the Polly mascot

**Files:** `content/figures/*.svg` (13, made by us), `content/figures/mascot-{idle,thinking,cheer,puzzled,sleep,fly}.svg` (made by us), `scripts/render-figures.ts`

**Mascot:** Polly is a minimal, geometric, flat line-art parrot that matches the icon set: a black 2 px outline, a parrot-green `#2BB24C` body, a white belly, and no gradients or extra colors. It should feel like a polished product mascot, not a cartoon. There are 6 poses sharing one 120×120 viewBox. Each pose is an inline SVG with a `<title>` and a small idle CSS animation (a blink or head bob) that stops under reduced motion. Each pose stays under 4 KB. The poses run through the same `sanitizeFigure` rules (Task 4) by being placed in a validated `content/figures/mascot-*.svg` set and emitted into `src/generated/mascot.ts`.

**Interfaces:** `render-figures.ts` uses Playwright to render each figure in light, dark and reduced-motion modes to `<scratchpad>/figures/<id>-{light,dark,static}.png` for visual review.

- [ ] **Step 1:** Write `render-figures.ts`, then render the fixture figure and check that the PNGs look right.
- [ ] **Step 2:** Author the figures. Each uses CSS keyframes and `--fig-*` tokens, has `<title>` and `<desc>`, and has a meaningful static frame under reduced motion:
  - `request-lifecycle`: DNS → TCP → TLS → HTTP, a packet moving
  - `latency-scale`: log-scale bars from L1 cache to a cross-continent round trip
  - `load-balancing`: requests distributed round-robin across 3 servers
  - `cache-aside`: hit path vs miss path with a DB read and cache fill
  - `leader-follower-replication`: writes to the leader, async log to followers
  - `consistent-hash-ring`: keys and nodes on a ring, a node added, only neighbors move
  - `queue-producer-consumer`: buffer filling and draining
  - `token-bucket`: tokens refill, requests consume, overflow rejected
  - `cap-tradeoffs`: static; partition → choose C or A
  - `fan-out-on-write`: a post copied to follower timelines
  - `two-tower-retrieval`: user and item towers → ANN → ranker
  - `rag-pipeline`: chunk → embed → index; query → retrieve → rerank → generate
  - `prefill-decode`: the prompt processed in parallel, tokens generated one by one into the KV cache
- [ ] **Step 3:** Draw the 6 Polly poses as `content/figures/mascot-{pose}.svg`. Render them next to each other and check that they read as one character and stay recognizable at 48 px.
- [ ] **Step 4:** Render all of them and review the PNGs. Fix legibility at 360 px width.
- [ ] **Step 5:** Validate, then commit one commit per 3–4 figures, plus one commit for the mascot.

### Task 21: Lessons for Phases 0 and 1 (14 lessons, with quizzes and drills)

**Files:** `content/lessons/foundations/*.md`, `content/lessons/building-blocks/*.md`, `content/quizzes/*.json`, `content/drills/*.json`, `content/path.json`

- [ ] **Step 1:** Write the Phase 0 (`foundations`) lessons, each ending in the listed exercise:
  - `how-the-web-works` (DNS, TCP, TLS, HTTP; figure `request-lifecycle`), quiz
  - `apis-rest-grpc-websockets`, quiz
  - `processes-threads-concurrency`, quiz
  - `sql-vs-nosql`, quiz
  - `indexing`, quiz
  - `latency-numbers` (figure `latency-scale`), drill `latency-budget`
- [ ] **Step 2:** Write the Phase 1 (`building-blocks`) lessons:
  - `scaling-and-load-balancing` (figure `load-balancing`), quiz
  - `caching-and-cdns` (strategies, eviction, CDNs; figure `cache-aside`), quiz
  - `replication` (figure `leader-follower-replication`), quiz
  - `sharding-and-consistent-hashing` (figure `consistent-hash-ring`), quiz
  - `queues-and-pub-sub` (figure `queue-producer-consumer`), quiz
  - `consistency-cap-pacelc` (figure `cap-tradeoffs`), quiz
  - `rate-limiting-and-idempotency` (figure `token-bucket`), quiz
  - `back-of-envelope-estimation`: drills `qps-estimation-1` and `storage-estimation-1`
- [ ] **Step 3:** Place them in `path.json`. Validate, check in the browser, and commit one commit per lesson.

### Task 22: Playbooks and worked examples

**Files:** `content/playbooks/{system-design-interview-framework,back-of-envelope-estimation,ml-system-design-framework}.md`, `content/examples/{cache-aside,fan-out-on-write,two-tower-retrieval,rag-pipeline}.md`, `content/diagrams/<example>.json`, plus quizzes and drills

- [ ] **Step 1:** Write the 3 playbooks, each with numbered steps, a checklist, common mistakes and ≥1 exercise. The estimation playbook gets drill `bandwidth-estimation-1`.
- [ ] **Step 2:** Write the 4 examples, each with its problem, the pattern, a diagram, a figure, when to use it and when not to.
- [ ] **Step 3:** Place the playbooks in `path.json`: interview-framework and estimation in `building-blocks`, ml-framework in `ml-systems`. Validate and commit.

### Task 23: Full case studies, Track A (`url-shortener`, `rate-limiter`, `news-feed`)

**Files:** `content/case-studies/<slug>/{index.md,diagram.json}`, plus quizzes and drills

- [ ] **Step 1:** Write each case study as `status: complete`, following the 12-section structure in Task 6, with a detailed HLD diagram, ≥1 quiz and 1 estimation drill. `news-feed` covers fan-out on write vs read and links the example.
- [ ] **Step 2:** Place each in `path.json` (`building-blocks`). Validate, check in the browser, and commit one commit per case study.

### Task 24: Full case studies, Tracks B and C (`video-recommendations`, `enterprise-rag`, `llm-inference-serving`)

- [ ] **Step 1:** Write each with the `ML/LLM design` section. The estimates include tokens/sec, GPU count and cost per 1K requests, with every input labeled as an assumption.
- [ ] **Step 2:** Place them in `path.json`: `video-recommendations` in `ml-systems`; the other two in `llm-systems`. Validate, check in the browser, and commit one commit per case study.

### Task 25: The other 44 case studies as outlines

- [ ] **Step 1:** For every remaining slug in brief §5.3, write `index.md` (`status: outline`, the full frontmatter, Problem statement, Requirements, Key concepts linked to the glossary, High-level design) and a starter `diagram.json` with 5–12 nodes. Extend the glossary as needed.
- [ ] **Step 2:** Place them in `path.json` (Track A → `building-blocks` or `data-systems`, Track B → `ml-systems`, Track C → `llm-systems` or `frontier-infrastructure` for `pretraining-cluster` and `fine-tuning-platform`). Validate after each batch of ~8 and commit per batch.
- [ ] **Step 3:** Run `time npm run content:build`. Expected: under 10 s for the full content set. Profile it if it is slower.

---

## Milestone F — Open source and acceptance

### Task 26: Content templates kept in sync with the schemas

**Files:** `content/_templates/*`, `scripts/templates.spec.ts`

- [ ] **Step 1: Write a failing test.** For each template, copy it into a temp fixture (a copy of `valid/`), replace `{{placeholders}}` with sample values, and run the full validation. Expected: zero errors.
- [ ] **Step 2:** Write the templates: lesson, complete and outline case study, playbook, example, quiz, drill, diagram, figure. Each has inline comments explaining every field.
- [ ] **Step 3:** Run the test. Expected: PASS. Commit.

### Task 27: README, CONTRIBUTING, licenses, community files, demo GIF

**Files:** `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `LICENSE` (MIT), `LICENSE-CONTENT` (CC BY 4.0), `.github/ISSUE_TEMPLATE/{bug.yml,content-error.yml,case-study-proposal.yml,config.yml}`, `.github/pull_request_template.md`, `scripts/capture-demo.ts`, `docs/screenshot.png`, `docs/demo.gif`

- [ ] **Step 1:** `capture-demo.ts`: Playwright at 1280×800 records the flow home → path → lesson → answer the quiz → `/progress` ring. It captures ~60 frames and encodes `docs/demo.gif` with `gifenc` (a 64-color palette, under 2 MB), and saves `docs/screenshot.png`. Run it and check both.
- [ ] **Step 2:** README: what the project is, the screenshot and GIF, the live link, quick start (`npm ci && npm start`), the scripts table, how content is organized, and the licenses.
- [ ] **Step 3:** CONTRIBUTING:
  - how to add or improve each content type, linking to `_templates/`
  - a link to `docs/curriculum.md` as the list of planned lessons that are open for contributions
  - running `npm run validate-content`, the meaning of the rule ids R1–R10, and the exact case-study section list
  - the style guide (tone, lengths, diagram conventions, the reference rule, figure rules: CSS-only animation, a reduced-motion frame, `--fig-*` tokens)
  - the release flow
  - The PR template has a content checklist: validated, references verified or marked TODO, terms linked, an exercise added, and the light/dark figure render checked.
- [ ] **Step 4:** Run `npm run lint`. Commit.

### Task 28: Phase 1 acceptance

- [ ] **Step 1:** Run the full definition of done locally: `npm run lint && npm run validate-content && npm test && npm run build -- --base-href /master-system-design/ && npm run e2e && npm run lighthouse`. Expected: all green, with Lighthouse ≥ 0.9 in all 4 categories on the 5 URLs.
- [ ] **Step 2:** Break one content file on purpose (a quiz with no correct answer). Confirm that `npm run build` fails with a message naming the file and the field, then revert it.
- [ ] **Step 3:** Manual keyboard pass and screen-reader smoke test (heading and landmark structure) on home, a lesson, a case study, a quiz and progress, in both themes, with reduced motion on.
- [ ] **Step 4:** Push the branch and confirm CI is green. After a merge to `main`, confirm the Pages deploy and load 3 deep links directly on the live site.
- [ ] **Step 5:** Write the phase summary for you: what was built, what was deferred, known issues, and the proposed next step (the Phase 2 canvas-library spike).

---

## Phase 1 done-when (from brief §9)

- A learner can follow `/path`, read every Phase 0 and Phase 1 lesson, the 3 playbooks, the 4 examples and all 50 case studies, take quizzes and drills, and see their progress persist after a reload. This is covered by Tasks 14–16, 21–25 and the e2e tests in Task 18.
- The build fails on invalid content (Tasks 3–7, check in Task 28 step 2).
- Lighthouse ≥ 90 on content pages (Task 18 gate, Task 28).
