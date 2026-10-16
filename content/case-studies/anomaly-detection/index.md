---
slug: anomaly-detection
title: Real-time anomaly detection
track: B
order: 29
difficulty: intermediate
summary: Watch 10 million metric series and alert within 5 minutes when one breaks its pattern, with per-series seasonal baselines, streaming scoring and an alert model trained on responder feedback.
concepts: [stream-processing, time-series-database, seasonality, sliding-window, precision-and-recall, alert-fatigue, data-drift, offline-evaluation, backpressure]
prerequisites: [metrics-monitoring]
estimatedMinutes: 3
status: outline
exercises: []
diagram: anomaly-detection-hld
---

## Problem statement

Design real-time anomaly detection for operational and business metrics, in the style of Datadog Watchdog. The system watches millions of time series, such as error rate per service or orders per minute per city, and alerts the owning team when one behaves unusually, without anyone setting a threshold by hand.

The hard part is that "unusual" differs for every series, each with its own daily and weekly rhythm, trend and noise. Labels are scarce, because real incidents are rare. And a detector that pages people for noise is quickly muted, so a few precise alerts beat many sensitive ones.

Questions to ask:

- What is monitored, infrastructure or business metrics, and how many series?
- How quickly must an anomaly be caught, and what does a false page cost compared with a miss?
- What labels exist: past incidents, feedback on alerts?
- Are known events such as deploys, holidays and promotions recorded anywhere?
- Should related alerts be grouped into one incident?

## Requirements

**Functional**

- Score every new point of every series against its expected range.
- Alert when a series is outside its expected range for 3 of the last 5 minutes by default; sensitivity is set per series.
- Group alerts with a shared cause (same service, region or deploy) into one incident and route it to the owner.
- Show expected and observed values; let responders mark alerts useful or noise and add known events.

**Non-functional**

- **Scale:** 10 million series at 1-minute resolution, about 170,000 points per second; 8 weeks of history kept.
- **Latency:** each point scored within 30 seconds of arrival; an alert within 5 minutes of an anomaly starting.
- **Quality:** at least 80% of alerts marked useful; 95% of labeled past incidents caught in replay.
- **Availability:** 99.9%, isolated from the systems it watches, so it stays up during their incidents.
- **Memory:** under 1 KB of model state per series, about 10 GB in total across the scorers.

## Key concepts

- :term[Stream processing]{id="stream-processing"}: points are scored as they arrive. The stream is partitioned by series id, so one worker owns each series and keeps its state in memory.
- :term[Time-series database]{id="time-series-database"}: keeps 8 weeks of history per series for nightly baseline fitting and for the context shown in alerts.
- :term[Seasonality]{id="seasonality"}: Monday noon and Sunday dawn are not comparable. The baseline predicts the expected value for this minute of the week; otherwise every daily peak would alert.
- :term[Sliding windows]{id="sliding-window"}: decisions use residuals over the last 5 minutes, so one noisy point does not alert but a sustained shift does.
- :term[Precision and recall]{id="precision-and-recall"}: the alert threshold trades the share of alerts that are real against the share of incidents caught; detection delay is the third metric.
- :term[Alert fatigue]{id="alert-fatigue"}: a noisy detector gets ignored, so alerts are grouped into incidents and sensitivity is tuned per series from feedback.
- :term[Data drift]{id="data-drift"}: a lasting level shift after a launch is the new normal. Once confirmed, the baseline is refit so the series stops alerting.
- :term[Offline evaluation]{id="offline-evaluation"}: new detectors replay months of history with labeled incidents and injected synthetic anomalies before release.
- :term[Backpressure]{id="backpressure"}: in a large outage, volume spikes; the pipeline sheds low-priority series rather than fall behind on critical ones.

## High-level design

::diagram{id="anomaly-detection-hld"}

1. Agents push metric points to a stream partitioned by series id; points are also stored in metric history.
2. Each night, baseline jobs fit a model per series from the last 8 weeks: an expected value for each minute of the week, a trend and a robust spread. This state, under 1 KB per series, is loaded into the scorers.
3. Scorers compare each point with its expected range and keep a sliding window of residuals. A series outside its range for 3 of the last 5 minutes becomes a candidate.
4. A small alert model, trained on past feedback, scores each candidate from its size, duration, the series' importance and how many related series moved at once. The alert manager groups related alerts into one incident and pages the owner with expected and observed values.
5. Responders mark alerts useful or noise. These labels and confirmed incidents retrain the alert model weekly and tune per-series sensitivity.

The full version of this case study will cover baseline models (seasonal profiles, robust statistics and forecasting), handling holidays and deploys, grouping alerts by service topology, evaluation with labeled and injected anomalies, and staying up during large incidents.
