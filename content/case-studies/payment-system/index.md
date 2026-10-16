---
slug: payment-system
title: Payment system
track: A
order: 13
difficulty: advanced
summary: Process 50 million card payments a day without charging anyone twice, using idempotency keys, a double-entry ledger fed by a transactional outbox, and daily reconciliation.
concepts: [card-tokenization, idempotency-key, acid, transactional-outbox, at-least-once, retry-with-backoff, dead-letter-queue, double-entry-ledger, reconciliation]
prerequisites: [notification-system]
estimatedMinutes: 4
status: outline
exercises: []
diagram: payment-system-hld
---

## Problem statement

Design the payment backend of a large online marketplace, in the style of the checkout behind Amazon or Etsy: it charges a buyer's card through external payment service providers (PSPs), records where every cent goes, and later pays sellers what they are owed.

Payments put correctness before speed. A call to a provider can time out after the money has moved, so the system often doesn't know whether a charge happened. It must still never charge twice, never lose a payment, and show auditors that its books match the providers' reports.

Questions to ask:

- Do we move money ourselves, or through external PSPs? (Through PSPs.)
- Do we also pay out sellers, and how often?
- How many payments per day, and how spiky are sales events?
- What happens when a provider times out: retry, wait, or ask the buyer?
- Are refunds and chargebacks in scope? (Refunds yes; chargebacks later.)

## Requirements

**Functional**

- Charge a buyer for an order: authorize at checkout, capture when the order ships.
- Refund all or part of a payment.
- Record every money movement in a ledger, and pay each seller their balance once a day.
- Show payment status to buyers, sellers and support staff.

**Non-functional**

- **Scale:** 50 million payments per day, about 600 per second on average and 5,000 per second during sales events.
- **Correctness:** no double charges and no lost payments; the ledger balances to the cent and matches every provider's report each day.
- **Latency:** p99 under 3 seconds for a checkout payment, mostly waiting on the PSP; under 200 ms in our own services.
- **Availability:** 99.99% for taking payments; if one PSP fails, new payments go to another.
- **Security and audit:** card numbers never reach our services; financial records are append-only and kept for 7 years.

## Key concepts

- :term[Card tokenization]{id="card-tokenization"}: the buyer's browser sends card details straight to the PSP and gets back a token, which keeps card numbers out of our systems and shrinks our PCI DSS audit scope.
- :term[Idempotency keys]{id="idempotency-key"}: each payment attempt carries a unique key that we store and pass on to the PSP, so a retry from the app or our own workers returns the first result instead of charging again.
- :term[ACID transactions]{id="acid"}: a payment's state change and the event describing it commit in one relational database transaction, so they can't disagree after a crash.
- :term[Transactional outbox]{id="transactional-outbox"}: that event goes into an outbox table and a relay publishes it later, so the ledger hears about every captured payment even if the service crashes right after committing.
- :term[At-least-once delivery]{id="at-least-once"}: the relay may publish an event twice, so the ledger writer skips any event id it has already recorded.
- :term[Retry with backoff]{id="retry-with-backoff"}: a PSP timeout leaves the outcome unknown; a worker asks the PSP for the status and retries with the same key at growing intervals instead of hammering a struggling provider.
- :term[Dead-letter queue]{id="dead-letter-queue"}: payments still unresolved after the last retry go to a queue that people review, not dropped or retried forever.
- :term[Double-entry ledger]{id="double-entry-ledger"}: a $100 sale with a 10% fee is a $100 debit to funds held at the PSP, balanced by credits of $90 to the seller and $10 to platform revenue, so every transaction sums to zero and any error shows as an imbalance.
- :term[Reconciliation]{id="reconciliation"}: a daily line-by-line match of the ledger against each PSP's settlement report; a mismatch points to a bug, a missed provider callback, or a timed-out charge that actually succeeded.

## High-level design

::diagram{id="payment-system-hld"}

1. At checkout, the browser exchanges the card details for a PSP token, then calls our payment API with the order id, amount, currency, token and an idempotency key.
2. The payment service inserts a payment row in the "created" state, unique on the idempotency key, so a repeated request just returns the stored result. It calls the PSP to authorize with the same key, then records "authorized" or "declined" and an outbox event in one transaction. Capture and refunds follow the same pattern.
3. If the PSP call times out, the payment is marked "unknown". A retry worker asks the PSP for the status and retries with backoff; after the last attempt the payment goes to a dead-letter queue for review.
4. A relay publishes outbox rows to an event stream. The ledger writer turns each capture or refund into balanced double-entry rows, skipping events it has already recorded, and a daily payout job pays each seller their ledger balance.
5. Each night, the reconciliation job matches every PSP's settlement file against the ledger and flags payments found on only one side or with different amounts.

The full version of this case study will cover the estimates, the payment state machine, resolving unknown outcomes after timeouts, the ledger schema and balance queries, and routing between PSPs during an outage.
