---
slug: system-design-interview-framework
title: The system design interview framework
order: 1
summary: A repeatable seven-step plan for a 45-minute design interview, with timings, what to say at each step, a checklist and the mistakes that cost offers.
estimatedMinutes: 15
concepts: [functional-requirements, non-functional-requirements, back-of-envelope-estimation, availability, slo, single-point-of-failure]
exercises: [interview-framework-quiz]
---

A system design interview isn't a quiz with one right answer. The interviewer wants to see how you think: whether you ask the right questions, size the problem, build something that works, and then reason about where it breaks. A clear structure keeps you from rambling or freezing, and it lets the interviewer follow along.

:::primer
In a design interview you're given a vague prompt, such as "design a URL shortener," and about 45 minutes. You talk through a design while drawing boxes and arrows.

There is no perfect answer. You're judged on **process** (structured, collaborative), **judgement** (sensible trade-offs, justified with numbers) and **depth** (knowing how the parts really work).
:::

## The plan at a glance

| Step | What you do | Time (45 min) |
| --- | --- | --- |
| 1. Clarify | Pin down features, users and quality targets | 5 min |
| 2. Estimate | Traffic, storage and bandwidth in rounded numbers | 3–5 min |
| 3. Interface | The main API calls and the core data | 3–5 min |
| 4. High-level design | Boxes and arrows that satisfy every feature | 8–10 min |
| 5. Deep dives | Two or three components in detail | 12–15 min |
| 6. Trade-offs and failures | Bottlenecks, failure modes, alternatives | 5 min |
| 7. Wrap up | Summarize and name what you'd do next | 2 min |

Adjust the timings to the interviewer: if they steer you into a deep dive early, go with them.

## Step 1: Clarify the requirements

Never start drawing straight away. Spend the first minutes turning the vague prompt into a concrete problem.

**:term[Functional requirements]{id="functional-requirements"}:** what must it do? List three to five core features and agree which are in scope. For a URL shortener: create a short link, redirect, optionally custom aliases and expiry. Say explicitly what you'll leave out ("analytics dashboards are out of scope").

**:term[Non-functional requirements]{id="non-functional-requirements"}:** how well must it do it?

- **Scale:** how many users, how many actions per day?
- **Latency:** what feels fast for this product? Redirects should take tens of milliseconds.
- **:term[Availability]{id="availability"}:** what does downtime cost? A redirect service that's down breaks every link on the internet that uses it.
- **Consistency:** is a few seconds of staleness acceptable anywhere?
- **Durability:** can we ever lose data? A short link must never point somewhere else.

Write the answers down where the interviewer can see them. You'll refer back to them in every later step.

## Step 2: Estimate

Turn the numbers from step 1 into requests per second, storage and bandwidth, using the method from the estimation lesson. Then **say what the numbers mean**: "about 4,000 redirects per second at peak, with about 100 reads for every write, so this is a read-heavy system where caching matters most."

Keep it short. The point is to drive decisions, not to show arithmetic.

## Step 3: Define the interface and data

Sketch the main API calls and the core entities. This catches misunderstandings early and gives the design something concrete to serve.

```http
POST /links            { "url": "https://…", "alias": "optional" }  → 201 { "code": "a8Kx2" }
GET  /{code}           → 301 Location: https://…
```

Then the data: a `links` table keyed by `code`, holding the long URL, the owner and the creation time. Note the access pattern: almost every read is a lookup by `code`.

## Step 4: Draw the high-level design

Draw the simplest design that meets **every** functional requirement: clients, load balancer, stateless app servers, the database, and a cache in front of it. Walk through one request end to end for each main feature.

:::tip
Narrate as you draw: "A redirect hits the load balancer, any app server checks the cache by code, and on a miss reads the database and fills the cache." Interviewers can only credit reasoning they hear.
:::

## Step 5: Deep dives

Pick the two or three parts that are hardest **for this problem**, or ask the interviewer which they'd like to explore. For a URL shortener, that might be:

- **Generating short codes:** random codes with a collision check, or a counter encoded in base 62? What happens with many app servers?
- **Scaling reads:** cache hit rate, cache size, CDN for redirects.
- **Storage growth:** when does one database stop being enough, and what would you shard by?

For each, compare at least two options and choose one with a reason tied to your requirements.

## Step 6: Trade-offs, bottlenecks and failures

Now stress your own design:

- Where's the **bottleneck** at 10× the traffic?
- What's each **:term[single point of failure]{id="single-point-of-failure"}**, and what happens when it dies?
- What would you **monitor**, and what :term[SLOs]{id="slo"} would you set? ("99.9% of redirects under 50 ms")
- What did you **trade away**, and when would you choose differently?

Raising problems with your own design isn't weakness. It's the most senior thing you can do in the interview.

## Step 7: Wrap up

In a minute or two, summarize: the requirements, the key numbers, the design, and the main trade-offs. Then name what you'd do with more time (analytics pipeline, abuse protection, multi-region). Ending clearly leaves a strong last impression.

:::deeper[How expectations change with seniority]
The same framework works at every level, but the weight shifts:

- **Junior and mid-level:** a working, coherent design and correct basics matter most. Interviewers expect to guide you more.
- **Senior:** you drive. You choose sensible deep dives yourself, quantify trade-offs, and discuss operations: deployment, monitoring, failure handling, data migration.
- **Staff and above:** you frame the problem in business terms, question requirements, compare whole architectures, and talk about how the system evolves over years and across teams.

For ML and LLM design interviews, steps 1 and 5 change the most: you'll frame the business goal as an ML task and define metrics. The ML system design framework playbook covers that variant.
:::

## Checklist

- [ ] Listed the core features and what's out of scope
- [ ] Agreed on scale, latency, availability and consistency targets
- [ ] Estimated peak traffic and storage, and said what they imply
- [ ] Defined the main API calls and data entities
- [ ] Drew a design that covers every feature, and walked a request through it
- [ ] Went deep on two or three components, comparing options
- [ ] Named the bottlenecks, failure modes and monitoring
- [ ] Summarized and suggested next steps

## Common mistakes

- **Jumping to the solution:** drawing Kafka and Kubernetes before knowing what the system does.
- **Designing for the wrong scale:** sharding a system that fits on one machine, or ignoring that it doesn't.
- **Silent thinking:** long pauses without narration. Think out loud, even when unsure.
- **Buzzword architecture:** naming technologies without saying why. "A queue, because the email step is slow and can fail independently" beats "Kafka."
- **Ignoring the interviewer:** they often hint at what they want to explore. Ask, listen, and adapt.
- **Never revisiting requirements:** check your design against the list from step 1 before wrapping up.

::quiz{id="interview-framework-quiz"}
