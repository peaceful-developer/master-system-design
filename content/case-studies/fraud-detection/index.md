---
slug: fraud-detection
title: Fraud detection
track: B
order: 19
difficulty: intermediate
summary: Score 2,000 card payments per second in under 100 ms with streaming velocity features and gradient-boosted trees, routing gray-zone cases to analysts and learning from chargebacks.
concepts: [class-imbalance, precision-and-recall, stream-processing, feature-store, gradient-boosted-trees, delayed-labels, human-in-the-loop, offline-evaluation, shadow-deployment, data-drift]
prerequisites: [payment-system]
estimatedMinutes: 4
status: outline
exercises: []
diagram: fraud-detection-hld
---

## Problem statement

Design real-time fraud scoring for card payments at an online payment processor, in the style of Stripe Radar. Every payment is scored before authorization, and the system approves it, asks for extra verification (such as a one-time code from the bank), sends it to manual review, or declines it.

What makes it hard is that fraud is rare (about 1 in 1,000 payments) and adversarial: fraudsters probe the system and change tactics once blocked. The true labels, chargebacks, arrive weeks later, and payments you decline never get a label at all. Both kinds of mistake cost money: missed fraud is a direct loss, and a wrongly declined customer takes the sale elsewhere.

Questions to ask:

- What does a false decline cost compared with a missed fraud, and who bears each loss?
- How many payments per second at peak, and how much latency can checkout absorb?
- Which actions are available: approve, extra verification, manual review, decline?
- Which labels exist, and how long do they take to arrive?
- How many reviews per day can the analyst team handle?

## Requirements

**Functional**

- Score each payment before authorization and return approve, verify, review or decline, with reason codes.
- Let risk analysts add rules, such as block lists and amount limits, that take effect within a minute.
- Queue gray-zone payments for analysts and record their verdicts as labels.
- Ingest chargebacks and fraud reports and join them to the original payment.

**Non-functional**

- **Scale:** 20 million payments per day (about 230 per second on average, 2,000 at peak during sales events).
- **Latency:** 100 ms p99 for a decision, including feature lookups.
- **Freshness:** velocity features include a payment within 2 seconds, so the scorer sees a card-testing burst while it is still happening.
- **Availability:** 99.99%; if scoring fails, fall back to rules only rather than block checkout.
- **Quality:** catch at least 70% of fraud by amount while declining under 0.2% of good payments; send at most 5,000 payments a day to review.

## Key concepts

- :term[Class imbalance]{id="class-imbalance"}: with 1 fraud per 1,000 payments, a model that approves everything is 99.9% accurate, so training down-samples good payments and weights them back.
- :term[Precision and recall]{id="precision-and-recall"}: thresholds on the score, set from the cost of each mistake, split payments into approve, verify, review and decline; the business signs off on the precision and recall at each one.
- :term[Stream processing]{id="stream-processing"}: counters such as payments per card in the last 10 minutes, or distinct cards per device today, are updated from the payment stream within seconds.
- :term[Feature store]{id="feature-store"}: serves those counters and slower daily features, such as account age and a merchant's past chargeback rate, with one definition for training and serving.
- :term[Gradient-boosted trees]{id="gradient-boosted-trees"}: the main model, because they are strong on a few hundred tabular features, score in about a millisecond on CPU, and can explain which features drove a score.
- :term[Delayed labels]{id="delayed-labels"}: chargebacks can arrive up to 90 days after a payment, so training uses payments old enough for most labels to have arrived, plus fresher analyst verdicts.
- :term[Human-in-the-loop review]{id="human-in-the-loop"}: analysts decide the gray zone, and their verdicts are the freshest labels. A small random sample of would-be declines also goes to review, since declined payments never get a chargeback.
- :term[Offline evaluation]{id="offline-evaluation"} and :term[shadow deployment]{id="shadow-deployment"}: a new model must catch more fraud dollars at the same false-decline rate on a time-based test set, then runs in shadow for a week before it acts.
- :term[Data drift]{id="data-drift"}: tactics shift within days, so feature and score distributions and decline rates per merchant and country are monitored, with alerts on sudden changes.

## High-level design

::diagram{id="fraud-detection-hld"}

1. At checkout, the payment API sends the payment, card fingerprint, device, IP address and merchant to the risk scorer, and publishes every payment to an event stream.
2. Stream counters consume that stream and update velocity features in the feature store within 2 seconds. The scorer reads them together with daily batch features.
3. Analyst rules run first, then the model returns a fraud probability. Thresholds turn it into a decision with reason codes, logged with the exact feature values used.
4. Gray-zone payments wait in a review queue. Analyst verdicts, chargebacks and fraud reports land in the labels store, joined to the original payment.
5. A weekly job trains on payments whose labels have matured, evaluates on the latest such weeks, and ships the model in shadow mode first; analysts can still add rules within minutes between releases.

The full version of this case study will cover the estimates, choosing thresholds from dollar costs, graph features that link cards, devices and accounts, unbiased labels for declined payments, and defending against card-testing attacks.
