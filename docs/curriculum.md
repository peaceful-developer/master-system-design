# Curriculum

The learning path has **6 phases**. Each phase has 4–8 short lessons (10–15 min read), and every lesson ends with a quiz or an estimation drill. Every lesson is layered for all levels (see the plan's D14):

- a **"New to this?"** primer for beginners,
- the main text, aimed at a working engineer,
- at least one **"Go deeper"** section for experts,
- at least one **"Interview tip"**.

Lesson URLs are `/learn/<phase>/<lesson-slug>`.

| Status | Meaning |
|---|---|
| **Phase 1 build** | Written in build Phase 1 |
| **Planned** | Lesson titles fixed; written in build Phase 4. Open for contributions |

Case studies are listed under the phase where they sit on the path. ★ = fully written in build Phase 1; the rest start as outlines.

---

## Phase 0 — Foundations (`foundations`) · Phase 1 build

*Goal: understand what happens between a click and a response, and the basic building materials of every backend.*

| # | Lesson (slug) | Covers | Go deeper (expert) | Practice |
|---|---|---|---|---|
| 1 | How the web works (`how-the-web-works`) | DNS resolution, TCP handshake, TLS, HTTP/1.1 vs HTTP/2 vs HTTP/3, keep-alive | QUIC and head-of-line blocking | Quiz |
| 2 | APIs: REST, gRPC and WebSockets (`apis-rest-grpc-websockets`) | Resources and status codes, pagination, gRPC and Protocol Buffers, streaming, WebSockets vs SSE vs long polling | API versioning and backward compatibility | Quiz |
| 3 | Processes, threads and concurrency (`processes-threads-concurrency`) | Processes vs threads, context switches, locks and race conditions, thread pools, async I/O and event loops | Event-driven I/O at high connection counts (epoll, the C10K problem) | Quiz |
| 4 | SQL vs NoSQL (`sql-vs-nosql`) | Relational model, transactions and ACID, isolation levels, key-value, document, wide-column and graph stores, how to choose | Isolation anomalies (lost update, write skew) | Quiz |
| 5 | Indexing (`indexing`) | B-trees, LSM trees, composite and covering indexes, write amplification, when indexes hurt | LSM compaction strategies | Quiz |
| 6 | Latency numbers every engineer should know (`latency-numbers`) | Memory vs SSD vs network costs, latency budgets, percentiles (p50/p95/p99), tail latency | Tail latency at scale and hedged requests | Drill: latency budget |

---

## Phase 1 — Distributed systems building blocks (`building-blocks`) · Phase 1 build

*Goal: know the standard parts of a scalable system, what each one costs, and when to use it.*

| # | Lesson (slug) | Covers | Go deeper (expert) | Practice |
|---|---|---|---|---|
| 1 | Scaling and load balancing (`scaling-and-load-balancing`) | Vertical vs horizontal scaling, stateless services, L4 vs L7 load balancers, round robin, least connections, health checks | "Power of two choices" load balancing | Quiz |
| 2 | Caching and CDNs (`caching-and-cdns`) | Cache-aside, read-through, write-through, write-back; LRU/LFU/TTL eviction; invalidation; CDN push vs pull | Cache stampedes: request coalescing and early expiration | Quiz |
| 3 | Replication (`replication`) | Leader-follower, multi-leader, leaderless; sync vs async; replication lag; read-your-writes; failover | Quorums (R + W > N) and sloppy quorums | Quiz |
| 4 | Sharding and consistent hashing (`sharding-and-consistent-hashing`) | Range vs hash sharding, hot spots, resharding, consistent hashing with virtual nodes | Rendezvous hashing and jump consistent hashing | Quiz |
| 5 | Queues and pub/sub (`queues-and-pub-sub`) | Queues vs topics, acknowledgements, at-least-once delivery, dead-letter queues, ordering, backpressure | "Exactly-once" vs effectively-once processing | Quiz |
| 6 | Consistency, CAP and PACELC (`consistency-cap-pacelc`) | Strong, eventual, causal and read-your-writes consistency; linearizability; CAP; PACELC | Consensus intuition (Raft: leaders, terms, logs) | Quiz |
| 7 | Rate limiting and idempotency (`rate-limiting-and-idempotency`) | Token bucket, leaky bucket, fixed and sliding windows; local vs global limits; idempotency keys; retries with backoff and jitter | Approximate distributed counting for global limits | Quiz |
| 8 | Back-of-envelope estimation (`back-of-envelope-estimation`) | Powers of ten, QPS from daily active users, peak factors, storage growth, bandwidth, sanity checks | Little's Law and queueing intuition | Drills: QPS, storage |

**Playbooks on this stretch:** System design interview framework · Back-of-envelope estimation

**Case studies:** ★url-shortener · ★rate-limiter · ★news-feed · key-value-store · distributed-cache · notification-system · chat-app · file-sync · ride-matching · payment-system

---

## Phase 2 — Data systems (`data-systems`) · Planned

*Goal: move, store and query large volumes of data reliably, and keep derived systems in sync.*

| # | Lesson (slug) | Covers | Go deeper (expert) | Practice |
|---|---|---|---|---|
| 1 | Batch vs stream processing (`batch-vs-stream-processing`) | Latency vs completeness, windows (tumbling, sliding, session), event time vs processing time, late data, Lambda vs Kappa | Watermarks and how they trade latency for correctness | Quiz |
| 2 | Event logs (`event-logs`) | Kafka-style logs: partitions, offsets, consumer groups, retention and compaction, ordering guarantees | Transactional producers and what "exactly-once" really covers | Quiz + drill: partition count for a target throughput |
| 3 | Change data capture (`change-data-capture`) | The dual-write problem, the outbox pattern, log-based CDC from the database's write-ahead log, keeping caches and search indexes in sync | Schema evolution in a CDC pipeline | Quiz |
| 4 | Data lakes and warehouses (`data-lakes-and-warehouses`) | Lakes vs warehouses vs lakehouses, columnar formats, partitioning, open table formats, ETL vs ELT | Small-file problems and compaction | Quiz + drill: storage estimate |
| 5 | Search indexes (`search-indexes`) | Inverted indexes, tokenization, relevance scoring (TF-IDF, BM25), near-real-time refresh, shards and replicas for search | Index segment merging and its cost | Quiz |
| 6 | Feature stores (`feature-stores`) | Offline vs online stores, materialization, point-in-time correct joins, training-serving skew | Streaming feature freshness vs cost | Quiz |

**Case studies:** web-crawler · search-autocomplete · video-streaming · message-queue · metrics-monitoring

---

## Phase 3 — ML systems (`ml-systems`) · Planned

*Goal: design ML-powered products end to end, from framing the problem to running experiments in production.*

The brief lists 10 topics. "Lifecycle" merges into problem framing, and "offline vs online inference" merges with "model serving".

| # | Lesson (slug) | Covers | Go deeper (expert) | Practice |
|---|---|---|---|---|
| 1 | From problem to ML system (`ml-lifecycle-and-framing`) | The ML system lifecycle, business goal → ML task, label definition, offline metrics (precision/recall, AUC, NDCG, calibration) vs online metrics | Hidden technical debt in ML systems | Quiz |
| 2 | Data and labeling pipelines (`data-and-labeling`) | Data sources, human labels vs implicit feedback, weak supervision, sampling and class imbalance, data validation | Label noise and how to measure it | Quiz |
| 3 | Features and leakage (`features-and-leakage`) | Categorical and numeric features, embeddings, aggregates and crosses; target, temporal and train/test leakage | Detecting leakage with time-based backtests | Quiz |
| 4 | Training pipelines (`training-pipelines`) | Reproducibility, time-based splits, hyperparameter tuning, model registry, retraining cadence | Warm-start vs full retraining | Quiz |
| 5 | Inference and model serving (`inference-and-serving`) | Batch (offline) vs online inference, latency budgets, request batching, CPU vs GPU serving, shadow and canary rollouts | Model compression for serving (distillation, quantization) | Quiz + drill: serving fleet size |
| 6 | Retrieval and ranking funnels (`retrieval-and-ranking`) | Candidate generation, two-tower models, approximate nearest neighbour search, multi-stage ranking, re-ranking for diversity and business rules | Position bias and counterfactual evaluation | Quiz |
| 7 | Monitoring and drift (`monitoring-and-drift`) | Data drift vs concept drift, training-serving skew, feature and prediction monitoring, alerting, feedback loops | Delayed labels and proxy metrics | Quiz |
| 8 | A/B testing (`ab-testing`) | Randomization unit, metrics and guardrails, statistical power and sample size, novelty effects, interference | Variance reduction (CUPED) and sequential testing | Drill: sample size |

**Playbooks on this stretch:** ML system design framework · Recommendation and ranking systems (planned)

**Case studies:** ★video-recommendations · ads-ctr-prediction · search-ranking · fraud-detection · feed-ranking · people-you-may-know · content-moderation · eta-prediction · dynamic-pricing · visual-search · feature-store · ml-training-platform · model-serving-platform · anomaly-detection · experimentation-platform

---

## Phase 4 — LLM systems (`llm-systems`) · Planned

*Goal: build reliable, fast and affordable products on top of large language models.*

The brief lists 12 topics. The KV cache joins inference basics, continuous batching joins quantization, and routing, cost/latency and caching become one lesson.

| # | Lesson (slug) | Covers | Go deeper (expert) | Practice |
|---|---|---|---|---|
| 1 | How LLM inference works (`how-llm-inference-works`) | Tokens, prefill vs decode, time to first token vs time per output token, the KV cache and its memory cost, why decode is memory-bandwidth bound | KV-cache size math for a given model and context length | Quiz + drill: KV-cache memory |
| 2 | Making inference fast (`inference-optimization`) | Static vs continuous batching, paged KV-cache memory, quantization (INT8, FP8, INT4) and its quality trade-offs | Speculative decoding | Quiz |
| 3 | Embeddings and vector search (`embeddings-and-vector-search`) | What embeddings are, similarity measures, ANN indexes (HNSW, IVF, product quantization), hybrid keyword + vector search | Recall vs latency tuning of ANN indexes | Quiz |
| 4 | Retrieval-augmented generation (`rag`) | Chunking strategies, retrieval, reranking, context assembly, citations, keeping the index fresh | Query rewriting and multi-hop retrieval | Quiz |
| 5 | Agents and tool use (`agents-and-tool-use`) | Function and tool calling, plan-act-observe loops, memory, sandboxing, common failure modes | Multi-agent coordination and when it isn't worth it | Quiz |
| 6 | Evaluating LLM systems (`llm-evaluation`) | Golden datasets, task-specific metrics, LLM-as-judge and its pitfalls, human review, online metrics, regression testing | Judge bias and how to calibrate judges | Quiz |
| 7 | Guardrails and safety (`guardrails-and-safety`) | Input and output filters, prompt injection, jailbreaks, PII handling, policy enforcement, human-in-the-loop | Defending tool-using agents against indirect prompt injection | Quiz |
| 8 | Cost, latency, routing and caching (`cost-latency-routing-caching`) | Token cost modeling, model routing and cascades, prompt caching, exact and semantic caching, streaming, token budgets | Cache hit-rate vs answer-quality trade-offs in semantic caching | Drill: cost per 1K requests |

**Playbooks on this stretch (planned):** RAG system design · LLM inference serving · LLM application evaluation · Cost optimization for AI systems

**Case studies:** ★enterprise-rag · ★llm-inference-serving · chat-assistant · code-assistant · vector-search · support-agent · multi-agent-orchestrator · llm-gateway · llm-eval-platform · guardrails-pipeline · document-understanding · voice-assistant · text-to-sql · llm-personalization · semantic-cache · assistant-memory · ai-search-engine · image-generation-service

---

## Phase 5 — Frontier infrastructure (`frontier-infrastructure`) · Planned

*Goal: reason about the infrastructure that trains and serves large models: parallelism, clusters, failures and cost.*

| # | Lesson (slug) | Covers | Go deeper (expert) | Practice |
|---|---|---|---|---|
| 1 | Distributed training and parallelism (`distributed-training`) | Data, tensor and pipeline parallelism; all-reduce and interconnect bandwidth; pipeline bubbles | Sharded optimizer states (ZeRO / FSDP) | Quiz |
| 2 | GPU cluster scheduling (`gpu-cluster-scheduling`) | Gang scheduling, queues and quotas, bin packing, preemption, topology-aware placement | Fair sharing across teams | Quiz |
| 3 | Checkpointing and fault tolerance (`checkpointing-and-fault-tolerance`) | Failure rates at scale, checkpoint frequency trade-offs, asynchronous checkpointing, elastic training | Choosing a checkpoint interval (Young/Daly approximation) | Quiz + drill: checkpoint interval |
| 4 | Multi-tenant model serving (`multi-tenant-serving`) | Sharing GPUs across models and tenants, isolation and fairness, autoscaling, cold starts, serving many LoRA adapters | Adapter batching on a shared base model | Quiz |
| 5 | Fine-tuning platforms (`fine-tuning-platforms`) | Full fine-tuning vs LoRA/QLoRA, data pipelines, job orchestration, evaluation gates, model registry | Preference tuning pipelines | Quiz |
| 6 | Capacity and cost modeling (`capacity-and-cost-modeling`) | Training compute estimates (≈ 6 × parameters × tokens FLOPs), model FLOPs utilization, inference throughput → GPU count, cost per million tokens | Sensitivity analysis: which assumption moves the cost most | Drill: GPU count and cost |

**Case studies:** fine-tuning-platform · pretraining-cluster

---

## Later additions

- **How the simulator works.** This lesson arrives in build Phase 3 with the simulator. Its placement is decided then, so that no phase exceeds 8 lessons.
- **Changing this list.** Propose new lessons with the "New content proposal" issue template. Keep each phase at 4–8 lessons.
