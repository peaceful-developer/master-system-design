# Project brief: System Design Lab

> Paste this whole file into Claude Code at the start of a new, empty repository (or save it as `PROJECT_BRIEF.md` and ask Claude Code to read it). "System Design Lab" is a working name; rename it freely.

---

## 1. Your role and how to work

You are building an open-source, frontend-only learning web app that teaches system design from scratch up to advanced AI/ML/LLM system design. It combines teachings, worked examples, playbooks, 50 case studies, and hands-on exercises (quizzes, estimation drills, a drag-and-drop architecture canvas with checklist grading, and a traffic simulator).

Work this way:

1. **Plan first.** Before writing code, read this brief end to end, then produce a written implementation plan for Phase 1 only. Show it to me and wait for approval.
2. **Build in phases** (section 9). Finish, test, and demo each phase before starting the next. Check in with me at the end of each phase.
3. **Verify versions.** Use the current stable Angular release and current stable versions of every library. Check them; do not rely on memory. If a library named here is unmaintained or a poor fit, propose an alternative before using it.
4. **Small, focused files.** One clear responsibility per file. Pure TypeScript for logic (grader, simulator, content loading) so it can be unit tested without Angular.
5. **Commit often** with clear messages, one logical change per commit.
6. **Never invent facts in content.** For "real-world reference" links in case studies, only cite sources you are confident exist (well-known engineering blogs, papers, books). If unsure, write `TODO: add verified reference` instead of guessing a URL.
7. **Ask** when a requirement is ambiguous instead of guessing on anything expensive to undo.

---

## 2. Product goals

- **Audience:** anyone, from beginners who have never designed a system to engineers preparing for senior ML/LLM system design work and interviews.
- **Open source:** MIT license. Content is contributed via GitHub pull requests.
- **No backend, no database, no accounts.** The whole app is a static site. Learner progress and saved designs live in the browser (localStorage / IndexedDB) with JSON export and import.
- **Free hosting:** deploy to GitHub Pages (Netlify/Vercel must also work).
- **Success looks like:** a learner can follow the path from Foundations to LLM Systems, read any of the 50 case studies, and practice each concept hands-on in the browser, with no sign-up.

---

## 3. Tech stack and constraints

- **Angular** (latest stable), standalone components only, signals for state, new control flow (`@if`, `@for`), strict TypeScript, OnPush change detection.
- **Prerendering / SSG** with `@angular/ssr` so every lesson, case study, playbook and exercise route is a static HTML page (fast first load, SEO). The app must still work as an SPA after hydration.
- **Styling:** Tailwind CSS plus Angular CDK for accessible primitives (dialogs, overlays, drag-drop where useful). Light and dark themes. Mobile responsive.
- **Markdown pipeline:** Markdown with YAML frontmatter, compiled at build time to JSON + HTML (e.g. unified/remark/rehype). Code blocks syntax-highlighted at build time (e.g. Shiki). Support callout blocks (note, tip, warning) and embedded components via a simple shortcode syntax, for example `::diagram{id="url-shortener-hld"}`, `::quiz{id="caching-basics"}`, `::drill{id="qps-estimation-1"}`.
- **Content validation:** a Node build script validates every content file against schemas (e.g. Zod) and fails the build on any error: missing fields, broken internal links, unknown component types in diagrams, quiz with no correct answer, exercise rules referencing missing nodes, duplicate slugs.
- **Canvas:** an Angular-native node/flow library (evaluate Foblex Flow and ngx-vflow; pick one and justify). Must support custom node templates, ports, edges, pan/zoom, selection, keyboard delete, and read-only mode.
- **Simulator:** pure TypeScript engine, run in a Web Worker, deterministic (seeded) so results are reproducible and testable.
- **Testing:** unit tests with the Angular CLI's default test runner; Playwright for end-to-end tests.
- **Quality:** ESLint + Prettier, accessibility (keyboard navigation, ARIA labels, contrast), Lighthouse score ≥ 90 on content pages.
- **CI:** GitHub Actions: install → lint → content validation → unit tests → build/prerender → e2e smoke tests → deploy to GitHub Pages on `main`.

---

## 4. Information architecture (routes)

| Route | Purpose |
|---|---|
| `/` | Home: what this is, the learning ladder, "start here", featured case studies |
| `/path` | Learning path: 6 phases, each with its lessons, case studies, and exercises in order, with progress indicators |
| `/learn/:phase/:lesson` | A teaching (lesson) page |
| `/examples` and `/examples/:slug` | Worked examples and reusable patterns (e.g. cache-aside, fan-out on write, two-tower retrieval, RAG pipeline) |
| `/playbooks` and `/playbooks/:slug` | Step-by-step playbooks (how to approach a design, estimation, ML design framework, RAG design, LLM serving) |
| `/case-studies` | Catalog of all 50 with filters (track, difficulty, concepts, status) and search |
| `/case-studies/:slug` | A case study page |
| `/exercises` | All exercises, filterable by type and topic |
| `/exercises/:slug` | One exercise (quiz, drill, canvas challenge, or simulation challenge) |
| `/playground` | Free-form canvas with the full component library and simulator, no grading |
| `/glossary` | Terms with short definitions, linked from content |
| `/progress` | Learner's progress, completed items, saved designs, export/import |
| `/contribute` | How to contribute, linking to CONTRIBUTING.md |

Global features: top nav, client-side full-text search across all content (build a search index at build time, e.g. MiniSearch or Pagefind), theme toggle, "mark as complete" on every lesson/case study/exercise.

---

## 5. Curriculum

### 5.1 Learning phases (teachings)

Each phase has 4–8 short lessons (10–15 min read each), each ending with a quiz or drill.

0. **Foundations:** how the web works (DNS, HTTP, TCP), APIs (REST, gRPC, WebSockets), processes/threads/concurrency, SQL vs NoSQL, indexing, latency numbers every engineer should know
1. **Distributed systems building blocks:** scaling vertical vs horizontal, load balancing, caching strategies and eviction, CDNs, database replication, sharding and consistent hashing, message queues and pub/sub, consistency models and CAP/PACELC, rate limiting, idempotency, back-of-envelope estimation
2. **Data systems:** batch vs stream processing, event logs (Kafka-style), change data capture, data lakes and warehouses, search indexes, feature stores
3. **ML systems:** ML system lifecycle, problem framing and metrics, data and labeling pipelines, feature engineering and leakage, training pipelines, offline vs online inference, candidate generation + ranking funnels, model serving, monitoring and drift, A/B testing
4. **LLM systems:** how LLM inference works (prefill/decode, tokens), KV cache, continuous batching, quantization, model routing, embeddings and vector search, RAG (chunking, retrieval, reranking), agents and tool use, evaluation, guardrails and safety, cost and latency optimization, caching for LLMs
5. **Frontier infrastructure:** distributed training (data, tensor, pipeline parallelism), GPU cluster scheduling, checkpointing and fault tolerance, multi-tenant serving, fine-tuning platforms (LoRA), capacity and cost modeling

### 5.2 Playbooks (initial set)

1. The system design interview framework (requirements → estimates → API → high-level design → deep dives → trade-offs)
2. Back-of-envelope estimation
3. Choosing a database
4. Designing for reliability and failure
5. ML system design framework
6. Recommendation and ranking systems playbook
7. RAG system design playbook
8. LLM inference serving playbook
9. LLM application evaluation playbook
10. Cost optimization for AI systems

### 5.3 The 50 case studies

Ordered so each builds on earlier concepts. Slugs in brackets.

**Track A: Classic systems (15)**
1. URL shortener [`url-shortener`]
2. Rate limiter [`rate-limiter`]
3. Distributed key-value store [`key-value-store`]
4. Distributed cache [`distributed-cache`]
5. Notification system [`notification-system`]
6. News feed [`news-feed`]
7. Chat application [`chat-app`]
8. Web crawler [`web-crawler`]
9. Search autocomplete [`search-autocomplete`]
10. Video streaming platform [`video-streaming`]
11. File sync and storage [`file-sync`]
12. Ride matching [`ride-matching`]
13. Payment system [`payment-system`]
14. Distributed message queue [`message-queue`]
15. Metrics and monitoring system [`metrics-monitoring`]

**Track B: ML systems (15)**
16. Video/movie recommendations [`video-recommendations`]
17. Ads click-through rate prediction [`ads-ctr-prediction`]
18. Search ranking [`search-ranking`]
19. Fraud detection [`fraud-detection`]
20. Feed ranking [`feed-ranking`]
21. People you may know [`people-you-may-know`]
22. Spam and content moderation [`content-moderation`]
23. ETA prediction [`eta-prediction`]
24. Dynamic pricing [`dynamic-pricing`]
25. Visual search [`visual-search`]
26. Feature store [`feature-store`]
27. ML training platform [`ml-training-platform`]
28. Model serving platform [`model-serving-platform`]
29. Real-time anomaly detection [`anomaly-detection`]
30. Experimentation (A/B testing) platform [`experimentation-platform`]

**Track C: LLM and GenAI systems (20)**
31. Chat assistant service (ChatGPT-style) [`chat-assistant`]
32. LLM inference serving at scale [`llm-inference-serving`]
33. Enterprise RAG Q&A [`enterprise-rag`]
34. Code assistant [`code-assistant`]
35. Vector database / semantic search [`vector-search`]
36. AI customer support agent [`support-agent`]
37. Multi-agent workflow orchestrator [`multi-agent-orchestrator`]
38. LLM gateway and model router [`llm-gateway`]
39. LLM evaluation platform [`llm-eval-platform`]
40. Guardrails and safety pipeline [`guardrails-pipeline`]
41. Multi-tenant fine-tuning platform [`fine-tuning-platform`]
42. Distributed pretraining cluster [`pretraining-cluster`]
43. Document understanding pipeline [`document-understanding`]
44. Real-time voice assistant [`voice-assistant`]
45. Text-to-SQL analytics assistant [`text-to-sql`]
46. LLM-powered personalization [`llm-personalization`]
47. Semantic / prompt cache [`semantic-cache`]
48. Long-term memory for assistants [`assistant-memory`]
49. AI search engine [`ai-search-engine`]
50. Image generation service [`image-generation-service`]

### 5.4 Case study template (every case study follows it)

1. **Problem statement** and clarifying questions to ask
2. **Requirements:** functional and non-functional
3. **Back-of-envelope estimates:** QPS, storage, bandwidth; for ML/LLM also tokens/sec, GPU count, cost per 1K requests (show the math step by step)
4. **API design and data model**
5. **High-level design:** an interactive read-only diagram (`::diagram`) that the learner can open in the playground with one click ("Open in Playground")
6. **Deep dives:** the 2–3 hardest components
7. **ML/LLM section** (Tracks B and C): data sources, features, model choice, training, serving, offline metrics, online metrics
8. **Trade-offs:** what was chosen and what was given up
9. **Failure modes, scaling and monitoring**
10. **Real-world references** (verified only)
11. **45-minute interview version:** a compressed talk track
12. **Practice:** linked exercises (at least one quiz; canvas or simulation challenge where it fits)

Frontmatter fields: `slug`, `title`, `track` (A/B/C), `order`, `difficulty` (beginner/intermediate/advanced), `concepts` (glossary term ids), `prerequisites` (slugs), `estimatedMinutes`, `status` (`complete` or `outline`), `exercises` (ids), `diagram` (diagram id).

---

## 6. Content model and repository layout

```
content/
  lessons/<phase>/<lesson-slug>.md
  examples/<slug>.md
  playbooks/<slug>.md
  case-studies/<slug>/index.md
  case-studies/<slug>/diagram.json
  exercises/<slug>.json
  quizzes/<id>.json
  drills/<id>.json
  glossary.json
  components.json        # the canvas component catalog (section 7.1)
scripts/
  build-content.ts       # validate + compile content to src/assets/content or a generated TS module
  schemas.ts             # Zod schemas for every content type
src/app/
  core/                  # content service, progress store, storage, search
  features/              # home, path, lesson, case-study, playbook, example, exercises, playground, progress, glossary
  canvas/                # canvas editor, node templates, read-only viewer
  grader/                # pure TS checklist grader
  simulator/             # pure TS simulation engine + web worker wrapper
  shared/                # UI components (callout, tabs, badge, quiz, drill, markdown renderer)
```

- **Diagram JSON:** `{ id, nodes: [{ id, type, label, position: {x,y}, config: {...} }], edges: [{ id, from, to, label?, config?: { ratio? } }] }`. `type` must exist in `components.json`.
- **Progress store** (localStorage, versioned schema with migration): completed item ids, quiz scores, exercise attempts, saved designs. Export and import as a single JSON file. Handle storage being unavailable without crashing.
- Content compilation must be deterministic and fast; changing one Markdown file during `ng serve` should rebuild content (watch mode).

---

## 7. Exercises

### 7.1 Component library (`components.json`)

Each component has: `type`, `label`, `category`, `icon`, `description`, and default simulation properties.

Categories and components (minimum):
- **Clients and edge:** client/users, DNS, CDN, API gateway, load balancer
- **Compute:** app server, serverless function, worker, cron/scheduler
- **Data:** SQL database (primary/replica), NoSQL store, cache, object storage, search index, data warehouse
- **Messaging:** message queue, event stream, pub/sub
- **ML:** feature store, training pipeline, model registry, model server (CPU), model server (GPU), batch inference job, monitoring/drift detector
- **LLM:** LLM endpoint (hosted API), self-hosted LLM (GPU), embedding model, vector database, reranker, prompt/semantic cache, guardrail/moderation filter, agent orchestrator, tool/function, evaluation service

Default simulation properties per component: `capacityRps` per instance, `instances`, `baseLatencyMs`, `costPerHourPerInstance`, plus type-specific fields (e.g. cache `hitRate`, LLM `tokensPerSecond`, `avgOutputTokens`, `maxBatchSize`, queue `maxDepth`, replica `readShare`). Mark all defaults as illustrative teaching values, not vendor benchmarks.

### 7.2 Exercise types

1. **Quiz:** multiple choice (single and multi-select), with an explanation per question and an optional hint.
2. **Estimation drill:** a scenario with given inputs; learner enters numeric answers; accept answers within a tolerance (e.g. ±25% or within the same order of magnitude, configurable per question); show the step-by-step solution afterwards.
3. **Spot the bottleneck:** a read-only diagram with simulated metrics; learner clicks the component they think is the bottleneck.
4. **Canvas challenge (checklist grading):** learner builds a design on the canvas from a starting diagram (possibly empty); the grader evaluates rules and shows which passed and failed, with hints; reference solution can be revealed after one attempt.
5. **Simulation challenge:** like a canvas challenge, but rules include performance and cost goals evaluated by the simulator at given load.

### 7.3 Grader rules (pure TypeScript, declarative JSON)

Rule types (minimum):
- `hasComponent` (type, optional `minCount`)
- `notHasComponent`
- `connected` (from type → to type, direct edge)
- `pathExists` (from type → to type, optional `through` types, optional `avoid` types)
- `noSinglePointOfFailure` (for a given type: `instances ≥ 2` or a redundant node)
- `metric` (simulator metric, operator, value, at a given load), e.g. `p99LatencyMs < 200 at 50,000 rps`
- `maxCostPerHour`
- `maxErrorRate`

Each rule has `id`, `description` (shown to the learner), `hint`, and `weight`. Result: per-rule pass/fail with message, overall score, and pass/fail. Unit-test every rule type, including edge cases (cycles, disconnected nodes, empty canvas).

### 7.4 Simulator (pure TypeScript, Web Worker)

Purpose: teach intuition about throughput, latency, bottlenecks and cost; not to be a precise benchmark. Keep the model simple and documented in `/learn` as a lesson ("How the simulator works").

Model:
- The learner sets incoming load (requests/sec) at client nodes, plus optional read/write mix and traffic spike.
- Traffic flows along edges. Each edge can carry a `ratio` (fan-out or share, e.g. 0.8 of reads go to replicas).
- A cache forwards only `(1 − hitRate)` of its traffic downstream.
- Each node's utilization ρ = arrivalRate / (capacityRps × instances).
- If ρ < 1: latency ≈ baseLatency / (1 − ρ) (queueing approximation); estimate p50/p95/p99 from the mean with fixed multipliers documented in code.
- If ρ ≥ 1: the node is overloaded; excess requests are dropped (or queued up to `maxDepth` for queues), contributing to error rate; highlight the node red.
- End-to-end latency = sum along the request path (take the slowest path for fan-in).
- LLM nodes: capacity derived from `tokensPerSecond`, `avgOutputTokens` and `maxBatchSize`; expose time-to-first-token and tokens/sec metrics.
- Cost = Σ instances × costPerHour.
- Output: per-node metrics (arrival rate, utilization, latency, drops) and system metrics (throughput, p50/p95/p99, error rate, cost/hour). Optional time-step mode showing a load ramp on a chart.
- Deterministic with a seed; unit tests for every formula and several reference topologies.

### 7.5 Canvas UX

- Left panel: searchable component palette by category; drag onto canvas.
- Right panel: properties of the selected node/edge (editable config).
- Bottom panel: load controls, "Run simulation", results table and small charts; nodes are colored by utilization (green/amber/red) with an accessible legend that does not rely on color alone.
- Toolbar: undo/redo, auto-layout, zoom to fit, clear, save to browser, export/import JSON, export PNG/SVG, "Check my design" (in exercises).
- Desktop-first; on small screens, show the canvas read-only with a message suggesting a larger screen.

---

## 8. UI and design

- Clean, readable, documentation-style layout: left sidebar for the current phase/track, centered content column (max ~75ch), right "on this page" table of contents on wide screens.
- Each case study page: header with track, difficulty, time, concepts; sticky TOC; diagram with "Open in Playground"; practice section at the end; previous/next navigation along the path.
- Visual difficulty and status badges; progress rings on `/path`.
- Respect `prefers-color-scheme` and `prefers-reduced-motion`.
- Pick a distinctive but restrained visual identity (typography, accent color); avoid generic template look.

---

## 9. Phased delivery

### Phase 1: Content platform + quizzes and drills
- Project setup, CI, deploy to GitHub Pages
- Content pipeline with validation, search index, glossary
- All routes in section 4 except the editable playground; read-only diagram viewer
- Quizzes, estimation drills, progress store with export/import
- Content: all lessons for Phases 0 and 1; 3 playbooks (interview framework, estimation, ML design framework); **fully written** case studies: `url-shortener`, `rate-limiter`, `news-feed`, `video-recommendations`, `enterprise-rag`, `llm-inference-serving`; **outline status** for the other 44 (frontmatter, problem statement, requirements, key concepts, and a starter diagram), clearly labeled "Outline: contributions welcome"
- **Done when:** a learner can follow the path, read content, take quizzes and drills, see progress persist after reload; build fails on invalid content; Lighthouse ≥ 90 on content pages

### Phase 2: Canvas + checklist-graded exercises
- Canvas editor with the full component library, properties panel, save/load/export
- Grader engine with all non-simulation rule types
- "Open in Playground" from any case study diagram
- At least 10 canvas challenges across all three tracks
- **Done when:** a learner can complete a canvas challenge end to end with useful feedback; grader has full unit test coverage

### Phase 3: Simulator + simulation challenges
- Simulation engine in a Web Worker, metrics panel, utilization coloring, "spot the bottleneck" exercises
- Grader `metric`, `maxCostPerHour`, `maxErrorRate` rules
- Lesson explaining the simulator model and its limits
- At least 8 simulation challenges (e.g. "add caching to hit p99 < 100 ms at 20K rps", "serve an LLM at 500 rps within a GPU budget", "add a semantic cache to cut LLM cost by 30%")
- **Done when:** simulations are deterministic, run in under 200 ms for 50-node designs, and have unit tests against reference topologies

### Phase 4: Complete content (ongoing, community-driven)
- Remaining lessons and playbooks; promote outline case studies to complete; more exercises

---

## 10. Open-source essentials

- `README.md`: what it is, screenshot, live link, quick start, how content is organized
- `CONTRIBUTING.md`: how to add or improve a lesson, case study, quiz, drill or exercise; templates for each; how to run content validation locally; style guide (tone, length, diagram conventions, reference rules)
- `content/_templates/` with copy-ready templates for every content type
- Issue templates (bug, content error, new case study proposal) and a PR template with a content checklist
- `CODE_OF_CONDUCT.md`, `LICENSE` (MIT for code; CC BY 4.0 for content, stated clearly)

---

## 11. Definition of done (every phase)

- `npm run lint`, `npm run validate-content`, `npm test`, `npm run build`, and e2e smoke tests all pass locally and in CI
- No console errors on any route; all prerendered routes load directly by URL
- Keyboard navigation works on every interactive element
- README and CONTRIBUTING reflect the current state
- A short summary to me: what was built, what was deferred, known issues, and the proposed next step

Start now by reading this brief and replying with your Phase 1 implementation plan.
