---
slug: processes-threads-concurrency
title: Processes, threads and concurrency
phase: foundations
order: 3
summary: How one server juggles thousands of requests at once, why shared memory causes subtle bugs, and the two main ways servers are built.
estimatedMinutes: 12
concepts: [process, thread, context-switch, race-condition, lock, deadlock, event-loop, async-io, thread-pool]
exercises: [concurrency-quiz]
---

A busy web server might hold 10,000 conversations at the same moment. Most of those requests spend their time *waiting*: for the database, for a disk, for another service. The art of concurrency is keeping the CPU busy with useful work while everything else waits, without the requests tripping over each other.

:::primer
Picture a restaurant kitchen.

- A **process** is a whole kitchen: its own space, equipment and ingredients. Two kitchens can't touch each other's food.
- A **thread** is a cook inside a kitchen. Cooks share the same counters and fridge, so they're fast to coordinate but can collide.
- **Concurrency** means many orders are *in progress* at once. **Parallelism** means several cooks are *literally cooking* at the same instant. One cook juggling five pans is concurrent but not parallel.
:::

## Processes and threads

A :term[process]{id="process"} is a running program with its own memory. The operating system keeps processes apart, so a crash in one doesn't corrupt another. Starting a process is relatively expensive, and processes talk to each other through pipes, sockets or files.

A :term[thread]{id="thread"} runs inside a process and shares its memory. Threads are cheaper to start and can pass data simply by reading the same variables. That shared memory is both their power and their danger.

The CPU can run only as many threads at once as it has cores. When there are more runnable threads than cores, the operating system switches between them. Each :term[context switch]{id="context-switch"} saves one thread's state and loads another's. It costs microseconds and also cools the CPU caches, so thousands of busy threads can spend a surprising share of time just switching.

## The classic bug: race conditions

Two threads both run this code to count page views:

```python
views = views + 1
```

That one line is really three steps: read `views`, add one, write it back. If two threads interleave like this:

| Time | Thread A | Thread B | `views` in memory |
| --- | --- | --- | --- |
| 1 | reads 5 | | 5 |
| 2 | | reads 5 | 5 |
| 3 | writes 6 | | 6 |
| 4 | | writes 6 | 6 |

…two page views were counted as one. This is a :term[race condition]{id="race-condition"}: the result depends on timing. It might happen once in a million runs, which makes it maddening to find.

### Fixing it with locks

A :term[lock]{id="lock"} (or mutex) lets only one thread at a time run a critical section:

```python
with views_lock:
    views = views + 1
```

Locks bring their own problems:

- **Contention:** if every request needs the same lock, threads wait in line and you lose the benefit of concurrency.
- **:term[Deadlock]{id="deadlock"}:** thread A holds lock 1 and waits for lock 2; thread B holds lock 2 and waits for lock 1. Neither moves, forever. The standard cure is to always take locks in the same global order.

Often the best fix is to avoid sharing at all: give each thread its own data, use atomic operations provided by the language or database (`UPDATE pages SET views = views + 1` is atomic in SQL), or pass messages instead of sharing memory.

## How servers handle many requests

There are two main designs. Most real servers use one or a mix of both.

### Thread per request (with a pool)

Each incoming request gets a thread that runs it from start to finish, blocking while it waits for the database. The code reads top to bottom and is easy to follow.

Creating a thread per request is wasteful, so servers keep a :term[thread pool]{id="thread-pool"}: a fixed number of threads (say, 200) that take requests from a queue. The pool size is also a safety valve: it caps how much work runs at once, so a traffic spike queues up instead of exhausting memory.

**The catch:** a blocked thread still holds its memory (often hundreds of kilobytes to a megabyte of stack). If every request waits 200 ms for a slow downstream service, 200 threads can only finish 1,000 requests per second, no matter how idle the CPU is.

### Event loop with asynchronous I/O

An :term[event loop]{id="event-loop"} uses one thread (or one per core) that never blocks. It starts a database query, registers "call me back when the answer arrives", and moves on to the next request. When the answer arrives, it runs the callback. This is :term[asynchronous I/O]{id="async-io"}.

```ts
async function handle(req: Request): Promise<Response> {
  const user = await db.getUser(req.userId); // the thread serves others meanwhile
  const orders = await db.getOrders(user.id);
  return render(user, orders);
}
```

A single event loop can hold tens of thousands of idle connections cheaply, which is why it suits chat servers, proxies and gateways.

**The catch:** if any handler does heavy CPU work (resizing an image, parsing a huge file), it blocks the loop and *every* other request waits. CPU-heavy work must go to worker threads or separate services.

| | Thread per request (pooled) | Event loop |
| --- | --- | --- |
| Code style | Simple, top to bottom | `async`/`await` or callbacks |
| Many idle connections | Costly (memory per thread) | Cheap |
| CPU-heavy work | Fine (other threads keep going) | Dangerous (blocks everyone) |
| Typical uses | Business APIs, database-heavy services | Proxies, gateways, chat, streaming |

:::tip
Whichever model you pick, the real limit is often *downstream*: a database that handles 500 queries at a time doesn't get faster because your server can hold 50,000 connections. Concurrency limits and queues protect the slowest component.
:::

:::deeper[Why event loops scale: readiness notification]
How does one thread watch 10,000 sockets? The operating system offers readiness APIs (`epoll` on Linux, `kqueue` on BSD and macOS, I/O completion ports on Windows). The program registers interest in many file descriptors, then makes a single call that sleeps until *some* of them are ready, and returns just those. Cost grows with the number of *active* sockets, not the total.

That was the answer to the famous "C10K problem" of handling ten thousand concurrent connections on one machine. Modern runtimes go further: languages with lightweight threads or coroutines (Go's goroutines, Java's virtual threads, Kotlin coroutines) let you write simple blocking-style code while the runtime multiplexes millions of cheap tasks onto a few OS threads using the same readiness APIs underneath.
:::

:::interview
When asked how a service handles load, connect concurrency to resources: "Each request mostly waits on the database, so I'd use async I/O or a large pool of lightweight threads, but cap concurrency at what the database can take, around N connections, and queue the rest." Mentioning *where* the bottleneck is matters more than the threading model.
:::

## Key takeaways

- Processes isolate memory; threads share it, which is fast but invites race conditions.
- Locks fix races but bring contention and deadlocks; prefer atomic operations or no sharing.
- Thread pools are simple and cap work, but blocked threads hold memory.
- Event loops handle huge numbers of idle connections cheaply, but CPU-heavy work blocks them.
- The real ceiling is usually a downstream resource, so protect it with limits and queues.

::quiz{id="concurrency-quiz"}
