---
slug: notification-system
title: Notification system
track: A
order: 5
difficulty: intermediate
summary: Send 1 billion push, email and SMS notifications a day, with urgent ones out in under 2 seconds, using per-priority queues, user settings and deduplicated retries so nothing is lost or sent twice.
concepts: [message-queue, head-of-line-blocking, device-token, at-least-once, idempotency-key, retry-with-backoff, dead-letter-queue, rate-limiting, backpressure]
prerequisites: [rate-limiter]
estimatedMinutes: 3
status: outline
exercises: []
diagram: notification-system-hld
---

## Problem statement

Design the notification platform behind a large consumer app, in the style of Uber or Facebook. Any internal service can ask to notify a user, and the platform delivers the message as a mobile push, an email or an SMS through outside providers: Apple Push Notification service (APNs), Firebase Cloud Messaging (FCM), an email service and an SMS gateway.

The last step is out of our control. Providers slow down, throttle us and fail, yet a one-time passcode must still arrive in seconds while a marketing campaign to 100 million users is going out. The platform must also respect each user's settings, avoid spamming anyone, and not send the same message twice when it retries.

Questions to ask:

- Which channels, and which kinds of notification: transactional (receipts, passcodes) or marketing?
- How many notifications a day, and how large is the biggest campaign?
- How fast must an urgent notification arrive?
- Can users opt out per channel and type, or set quiet hours?
- Do senders need delivery and open status?
- Is a rare duplicate acceptable, or must delivery be exactly once?

## Requirements

**Functional**

- An internal API: `send(user_id, type, template_id, params, priority, idempotency_key)`. The platform picks channels from the user's settings.
- Push to iOS and Android, email and SMS, rendered from templates in the user's language.
- User settings: opt out per channel and notification type; quiet hours.
- Scheduled campaigns to a segment of users.
- Delivery status per notification (queued, sent, failed, opened) for senders and support staff.

**Non-functional**

- **Scale:** 500 million users with 800 million registered devices; 1 billion notifications a day, about 12,000 per second on average and 60,000 per second at campaign peaks.
- **Latency:** high-priority notifications reach the provider within 2 seconds at p99, even during a campaign; marketing within 30 minutes.
- **Reliability:** an accepted notification is never silently lost; fewer than 1 in 10,000 reach a user twice.
- **Availability:** 99.99% for the send API; an outage at one provider delays only that channel.
- **Limits:** at most 3 marketing notifications per user per day, and never more than each provider's rate limit.

## Key concepts

- :term[Message queues]{id="message-queue"}: separate queues per channel and priority let the API accept a request in milliseconds and avoid :term[head-of-line blocking]{id="head-of-line-blocking"}, so a passcode never waits behind a campaign.
- :term[Device tokens]{id="device-token"}: push providers address an app install, not a person, so the platform stores every token a user has, sends to each, and deletes tokens the provider reports as invalid.
- :term[At-least-once delivery]{id="at-least-once"}: a worker acknowledges a queue message only after the provider accepts it, so a crashed worker causes a resend, never a loss.
- :term[Idempotency keys]{id="idempotency-key"}: the sender's key is kept in a deduplication store for 24 hours, so a retried request creates no second notification; workers also check whether a notification was already sent before calling the provider, which keeps resends rare.
- :term[Retries with backoff]{id="retry-with-backoff"}: timeouts and throttling replies are retried after growing, jittered delays, so a struggling provider is not pushed further over.
- :term[Dead-letter queue]{id="dead-letter-queue"}: a message that still fails after 5 attempts moves aside, so it stops blocking its queue and can be inspected or replayed.
- :term[Rate limiting]{id="rate-limiting"}: per-user frequency caps protect users from spam, and per-provider limits keep each channel under its quota.
- :term[Backpressure]{id="backpressure"}: when a provider slows down, its workers pull less often and the queue absorbs the backlog, instead of piling up thousands of open requests.

## High-level design

::diagram{id="notification-system-hld"}

1. A service calls the notify API with an idempotency key. The API checks the key in the deduplication store, loads the user's settings and device tokens, drops channels the user opted out of, applies frequency caps and quiet hours, and records the notification as queued.
2. The API writes one message per channel to the queue for that channel and priority, then returns. Campaigns use the same path: a scheduler expands a segment into batches of user ids and submits them at a controlled rate with low priority.
3. Channel workers pull messages, render the template and call the provider. High-priority queues have their own workers, so they keep flowing during a campaign.
4. On success, the worker logs "sent" and acknowledges the message. On a timeout or throttling reply, it re-queues the message with backoff; after 5 attempts the message goes to the dead-letter queue. Invalid device tokens are removed.
5. Provider receipts and open events update the delivery log, which senders and support query by notification id.

The full version of this case study will cover throughput estimates per channel, the deduplication store, campaign throttling and fairness between senders, failover between providers, and tracking delivery and open rates.
