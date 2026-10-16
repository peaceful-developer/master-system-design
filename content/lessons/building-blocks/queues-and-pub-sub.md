---
slug: queues-and-pub-sub
title: Queues and pub/sub
phase: building-blocks
order: 5
summary: Decoupling services with message queues and publish/subscribe, delivery guarantees, retries and dead letters, ordering, and handling a growing backlog.
estimatedMinutes: 14
concepts: [message-queue, pub-sub, acknowledgement, at-least-once, at-most-once, exactly-once, dead-letter-queue, backpressure]
exercises: [queues-quiz]
---

A user uploads a video. Transcoding it takes four minutes. You can't keep the upload request open that long, and if the transcoder is busy you don't want uploads to fail. So you write a note, "transcode video 812", drop it in a queue, and tell the user "processing". A worker picks the note up when it's free. That small idea, put work in a queue and let someone else do it later, shapes most large systems.

:::primer
A **message queue** is a buffer between services.

- A **producer** puts messages in.
- A **consumer** takes them out and does the work.
- The queue holds messages until a consumer is ready, even if that's minutes later.

The producer doesn't wait for the work to finish, and doesn't even need to know who does it.
:::

## Why put a queue in the middle?

::figure{id="queue-producer-consumer" caption="Producers add work in bursts; the consumer drains the queue at its own pace."}

A :term[message queue]{id="message-queue"} gives you:

- **Fast responses:** the request only has to enqueue the work, not do it.
- **Absorbed spikes:** a burst of 10,000 orders queues up instead of overloading the workers. They catch up when the burst passes.
- **Independent failure:** if the email service is down for ten minutes, messages wait in the queue. Nothing is lost and the checkout keeps working.
- **Independent scaling:** add consumers when the queue grows; producers don't change.

The cost is that the work is **asynchronous**. The user sees "processing" rather than a result, and you need a way to report completion: polling, a notification, or a webhook.

## Queues and pub/sub

There are two delivery styles, and they answer different questions.

**Work queue (point to point):** each message goes to **one** of the consumers. Several workers compete for messages, which spreads the work. Use it for tasks: "resize this image", "send this email".

**:term[Publish/subscribe]{id="pub-sub"}:** each message goes to **every** subscriber. The producer announces an event ("order 1234 was placed") and any number of services react: billing charges the card, the warehouse packs the box, analytics counts the sale. Adding a new subscriber needs no change to the producer.

| | Work queue | Pub/sub |
| --- | --- | --- |
| Who gets a message | One consumer | Every subscriber |
| Message means | "Do this task" | "This happened" |
| Example | Image resizing jobs | Order placed event |

Many systems combine both: each subscribing service gets its own copy of the event, and inside that service several workers share the copies like a work queue.

:::deeper[Logs versus queues]
Classic brokers (RabbitMQ, Amazon SQS) delete a message once a consumer acknowledges it. **Log-based** systems such as Apache Kafka work differently: messages are appended to a log and **kept** for a retention period, days or forever. Each consumer group tracks its own position (offset) in the log.

That changes what you can do:

- A new service can read the log from the beginning and rebuild its own view of history.
- After a bug, you can rewind a consumer and reprocess.
- Order is guaranteed **within a partition** of the log. Messages with the same key (say, the same order id) go to the same partition, so they stay in order.

The trade-off: parallelism is limited by the number of partitions, since each partition is read by one consumer in a group at a time.
:::

## Acknowledgements and delivery guarantees

How does the queue know a message was handled? The consumer sends an :term[acknowledgement]{id="acknowledgement"} (ack). If no ack arrives in time, for example because the worker crashed, the queue delivers the message again.

When the consumer acks decides the guarantee:

- **:term[At most once]{id="at-most-once"}:** ack first, then process. If the worker crashes mid-task, the message is gone. Acceptable for things like metrics samples.
- **:term[At least once]{id="at-least-once"}:** process first, then ack. If the worker crashes after processing but before acking, the message is delivered again and processed twice. Nothing is lost, but duplicates happen. **This is the usual default.**
- **:term[Exactly once]{id="exactly-once"}:** each message affects the result exactly once. Networks can't guarantee a message is *delivered* only once, so in practice this means at-least-once delivery plus processing that ignores duplicates.

:::tip
Make consumers **idempotent**: processing the same message twice should have the same effect as once. Record the ids of handled messages, or design the write so a repeat changes nothing ("set status to shipped" rather than "add 1 to shipped count"). Then at-least-once delivery behaves like exactly-once.
:::

## When messages fail

Some messages fail every time: malformed data, a bug, a deleted record. Retrying forever blocks the queue and burns resources. The standard pattern:

1. Retry a few times, with growing delays between attempts.
2. After the limit (say 5 attempts), move the message to a :term[dead-letter queue]{id="dead-letter-queue"} (DLQ).
3. Alert someone. Fix the cause, then replay the messages from the DLQ.

A DLQ that nobody watches is a slow data-loss bug, so always alert on it.

## Ordering

A single queue with a single consumer processes messages in order. Add a second consumer and order is gone: message 2 can finish before message 1.

Most systems don't need global order, only order **per entity**: all events for order 1234 in sequence. Route messages by key (order id) to a partition or a FIFO group, so each entity's messages are handled one at a time, while different entities run in parallel.

## When the queue keeps growing

A queue absorbs bursts, but it can't fix a consumer that is permanently slower than the producer. If messages arrive at 1,000 per second and consumers handle 800, the backlog grows by 200 every second, forever.

Watch the **queue depth** and the **age of the oldest message**. When they climb:

- **Scale consumers** if the work can run in parallel.
- Apply :term[backpressure]{id="backpressure"}: slow producers down, or reject new work with a clear error, so the system degrades predictably instead of falling over.
- **Shed low-value work:** drop or defer what can wait.

:::warning[The dual-write trap]
A service saves an order to its database and then publishes "order placed". If it crashes between the two, the order exists but nobody hears about it. Publishing first has the opposite problem. The fix is the **transactional outbox**: write the event into an outbox table in the same database transaction as the order, and let a separate process publish rows from the outbox. The event is published at least once, so consumers must be idempotent.
:::

:::interview
When a step is slow, bursty or can fail independently, say "this goes through a queue" and explain why. Then cover three things: the **delivery guarantee** ("at-least-once, so the consumer is idempotent using the order id"), **failure handling** ("retries with backoff, then a dead-letter queue with an alert"), and **ordering** if it matters ("partitioned by order id"). Mention the queue depth metric you'd scale on.
:::

## Key takeaways

- Queues decouple services, absorb spikes and let parts fail independently.
- Work queues give each message to one consumer; pub/sub gives every subscriber a copy.
- At-least-once delivery is the norm; idempotent consumers make duplicates harmless.
- Retry with limits, then park failures in a dead-letter queue and alert on it.
- Order is usually needed per entity; route by key. Watch queue depth and apply backpressure.

::quiz{id="queues-quiz"}
