---
slug: scaling-and-load-balancing
title: Scaling and load balancing
phase: building-blocks
order: 1
summary: Bigger machine or more machines? How stateless services and load balancers let a system grow, and how to keep the balancer from becoming the weak spot.
estimatedMinutes: 12
concepts: [vertical-scaling, horizontal-scaling, stateless-service, load-balancer, l4-load-balancing, l7-load-balancing, round-robin, least-connections, health-check, single-point-of-failure, power-of-two-choices]
exercises: [scaling-quiz]
---

Your app runs on one server and traffic just doubled. You have two ways to grow: buy a **bigger server**, or add **more servers** and share the work. Nearly every large system ends up doing the second, and a small, unglamorous component makes that possible: the load balancer.

:::primer
- **Scaling up (vertical):** replace the server with a more powerful one. More CPU, more memory.
- **Scaling out (horizontal):** add more servers that do the same job.
- **Load balancer:** a traffic officer that stands in front of the servers and sends each request to one of them.
:::

## Vertical scaling: simple until it isn't

:term[Vertical scaling]{id="vertical-scaling"} needs no code changes: move to a machine with more cores and memory. It's often the right first step, and modern servers are huge.

Its limits:

- **There's a ceiling.** Eventually there's no bigger machine, and the biggest ones cost far more per unit of power.
- **It's a single point of failure.** One machine means one crash, one bad deploy, or one maintenance window takes everything down.
- **Upgrades usually mean downtime.**

## Horizontal scaling: more of the same

:term[Horizontal scaling]{id="horizontal-scaling"} adds identical servers. Ten modest servers can be cheaper than one giant, and if one dies the other nine carry on.

The catch is that **any request must be able to go to any server.** That only works if the servers are :term[stateless]{id="stateless-service"}: they keep nothing about a user between requests in their own memory.

Imagine a shopping cart stored in server A's memory. The next request lands on server B, which has never heard of the cart. Fixes:

- Store session data in a **shared store** (a cache or database) that every server can read.
- Or put it in a **signed token** the client sends with each request.

Once the app servers are stateless, scaling out is mostly a matter of adding instances. The hard part moves to the stateful pieces (databases and caches), which later lessons cover.

## Load balancers

A :term[load balancer]{id="load-balancer"} receives every request and forwards it to a healthy server.

::figure{id="load-balancing" caption="A load balancer sends requests to servers in turn (round robin)."}

### Where they look: layer 4 vs layer 7

- :term[Layer 4]{id="l4-load-balancing"} balancers route by IP address and port. They don't read the request, so they're extremely fast and can carry any protocol.
- :term[Layer 7]{id="l7-load-balancing"} balancers read the HTTP request. They can route `/api/*` to one pool and `/images/*` to another, terminate TLS, add headers, and retry failed requests. More flexible, slightly more work per request.

### How they choose a server

| Algorithm | How it works | Good when |
| --- | --- | --- |
| :term[Round robin]{id="round-robin"} | Each server in turn | Requests are similar and servers are identical |
| Weighted round robin | Bigger servers get more turns | Servers have different capacity |
| :term[Least connections]{id="least-connections"} | Server with the fewest requests in flight | Request durations vary a lot |
| Hash of a key (user, session) | Same key always goes to the same server | You want cache affinity per user |

### Health checks

Every few seconds the balancer probes each server, for example `GET /healthz`. A server that fails a few :term[health checks]{id="health-check"} in a row is taken out of rotation, and put back once it recovers. This is what turns "a server crashed" into "nobody noticed".

:::warning[Health checks can lie]
A health check that always answers 200 tells you the process is running, not that it can do its job. A better check verifies the things a request needs, such as reaching the database. But be careful: if the database is down, *every* server fails the check and the balancer removes all of them. Keep deep checks lightweight, and alert on them rather than letting them empty the pool.
:::

## Don't let the balancer become the weak spot

If every request goes through one load balancer, that box is now your :term[single point of failure]{id="single-point-of-failure"}. Common fixes:

- Run **two balancers** in an active–passive pair sharing a floating IP address; if the active one dies, the passive takes over within seconds.
- Use a **managed cloud load balancer**, which is itself built from many machines.
- At the very top, use **DNS** to spread users across several balancers or regions.

## Autoscaling

Once servers are stateless and behind a balancer, you can add and remove them automatically: scale out when CPU stays above 60% or the request queue grows, and scale in when traffic falls. Two practical notes:

- New servers take time to start and warm up, so scale on **leading signals** (queue depth, request rate) and keep some headroom.
- Scale in slowly; scaling out and in repeatedly (flapping) wastes money and causes errors.

:::deeper[The power of two choices]
"Send to the least loaded server" sounds ideal, but at scale every balancer would need perfect, instantly updated load information for every server, and many balancers would all pile onto the same "least loaded" server at once.

A famous result from randomized algorithms offers a cheap alternative: pick **two** servers at random and send the request to the less loaded of the two. Compared with picking one server at random, this dramatically shrinks the load on the busiest server (the expected maximum drops from roughly log n / log log n to log log n for n balls in n bins). The intuition: you only need to avoid the worst choices, not find the best one.

That's why the :term[power of two choices]{id="power-of-two-choices"} shows up in real load balancers and schedulers: it needs almost no coordination and gets most of the benefit of perfect information.
:::

:::interview
Start designs with stateless app servers behind a load balancer, and say so explicitly: "App servers are stateless (sessions in a shared cache), so we scale them horizontally behind an L7 balancer with health checks; the balancer runs as a redundant pair." Then spend your time on the stateful parts, which is where the real design work is.
:::

## Key takeaways

- Vertical scaling is simple but capped and fragile; horizontal scaling grows further and survives failures.
- Horizontal scaling needs stateless servers; move session state to a shared store or a token.
- Load balancers route by connection (L4) or by request content (L7), and use health checks to skip broken servers.
- Make the balancer itself redundant, and autoscale on leading signals with headroom.

::quiz{id="scaling-quiz"}
