---
slug: content-moderation
title: Spam and content moderation
track: B
order: 22
difficulty: intermediate
summary: Screen 500 million posts a day with hash matching and fast classifiers before publishing and deeper models after, sending uncertain cases to human reviewers whose decisions retrain the models.
concepts: [perceptual-hash, embedding, class-imbalance, precision-and-recall, message-queue, human-in-the-loop, active-learning, offline-evaluation, shadow-deployment, data-drift]
prerequisites: [fraud-detection]
estimatedMinutes: 4
status: outline
exercises: []
diagram: content-moderation-hld
---

## Problem statement

Design spam and content moderation for a large social platform in the style of Facebook or YouTube. Every new post, comment, image and video is checked against the platform's policies (spam, scams, nudity, hate speech, violence), and violating content is removed, shown to fewer people, labeled, or sent to a person to decide.

What makes it hard is scale, adversaries and ambiguity together. There are dozens of policies, each with its own severity and tolerance for mistakes. Spammers change wording and images to slip past filters, so models decay within weeks. Many cases depend on context and language that models misread, so humans stay in the loop, but they can review only a tiny fraction of posts.

Questions to ask:

- Which content types (text, images, video, live streams) and how many languages?
- Which actions exist: remove, reduce distribution, warning label, restrict the account?
- Must content be checked before anyone sees it, or is removal shortly after posting acceptable?
- How many human reviewers are there, and which cases must a person always see?
- How do appeals work, and are there legal deadlines for acting on reports?

## Requirements

**Functional**

- Check every new post, comment, image and video against each policy, and remove, limit, label or send it to review.
- Block re-uploads of media already confirmed as violating.
- Accept user reports and appeals and route both to human review.
- Keep an audit trail of every decision, with model versions and reviewer.

**Non-functional**

- **Scale:** 500 million posts and comments per day (about 5,800 per second on average, 15,000 at peak), 100 million with images and 5 million videos; 200,000 human reviews per day.
- **Latency:** inline checks add under 150 ms p99 to posting text and images; videos are scanned within 10 minutes, with limited distribution until then.
- **Quality:** automatic removals at least 95% precise per policy, measured on audited samples; violating content under 0.05% of all views, estimated by sampling.
- **Freshness:** a new spam wave confirmed by reviewers is blocked by hash or rule within an hour; models retrain weekly.
- **Availability:** if inline checks fail, publish with limited distribution and scan later, rather than block posting.

## Key concepts

- :term[Perceptual hashing]{id="perceptual-hash"}: re-uploads of known violating images and videos match the hash list in milliseconds, even after cropping or recompression.
- :term[Embeddings]{id="embedding"}: shared text and image embeddings feed the policy classifiers, and a nearest-neighbor search lets one confirmed spam post find thousands of near-copies.
- :term[Class imbalance]{id="class-imbalance"}: violations are under 1% of posts and some policies are far rarer, so training oversamples positives from reviews and reports, and thresholds are chosen on data with the real mix.
- :term[Precision and recall]{id="precision-and-recall"}: each policy has its own thresholds, one for automatic action and a lower one for review, set from the cost of a wrong removal versus a missed violation.
- :term[Message queue]{id="message-queue"}: deeper checks run from a queue after publishing, so posting stays fast and spam waves are absorbed.
- :term[Human-in-the-loop review]{id="human-in-the-loop"}: the review queue is ordered by predicted severity × expected views, so a harmful post going viral is reviewed before a borderline one nobody sees.
- :term[Active learning]{id="active-learning"}: part of review capacity goes to posts the model is least sure about, and part to random samples that measure what it misses.
- :term[Offline evaluation]{id="offline-evaluation"} and :term[shadow deployment]{id="shadow-deployment"}: a new model must beat the old one on a held-out audited set, then runs in shadow while a sample of its would-be actions is reviewed.
- :term[Data drift]{id="data-drift"}: score distributions, report rates and how often reviewers overturn the model are tracked per policy and language, because a sudden shift usually means spammers have adapted.

## High-level design

::diagram{id="content-moderation-hld"}

1. The post service sends each new post to the fast checks: a perceptual-hash lookup, small text and image classifiers on CPU, and account signals such as account age and posting rate, which catch most spam. Clear violations are blocked before publishing.
2. Posts that pass are published and queued for scanning. Larger multimodal models on GPU score them for every policy; videos are scanned frame by frame, with their audio.
3. Confident violations are enforced automatically through the post service. Uncertain cases, user reports and appeals go to human review, ordered by severity and expected views.
4. Reviewer decisions become labels with the policy and reason, and confirmed media hashes join the hash list. A weekly job retrains each policy model on new labels and active-learning samples, then ships it through shadow mode.

The full version of this case study will cover the estimates, setting thresholds per policy and language, prioritizing the review queue, measuring prevalence by sampling, and catching coordinated spam with account and graph signals.
