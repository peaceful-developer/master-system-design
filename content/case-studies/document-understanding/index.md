---
slug: document-understanding
title: Document understanding pipeline
track: C
order: 43
difficulty: intermediate
summary: Extract structured fields from 10 million pages a day of invoices, contracts and scans, using OCR and layout models first, a vision-language model when unsure, and human review last.
concepts: [ocr, layout-analysis, vision-language-model, hallucination, human-in-the-loop, calibration, message-queue, idempotency, offline-evaluation, data-drift]
prerequisites: [enterprise-rag]
estimatedMinutes: 4
status: outline
exercises: []
diagram: document-understanding-hld
---

## Problem statement

Design a document understanding service in the style of Amazon Textract or Google Document AI. Businesses send invoices, receipts, contracts and ID documents as PDFs, scans and phone photos. The service returns the text with its structure, plus the fields each business needs (vendor, total, line items, dates), each with where it was found and how sure the system is.

The inputs are messy: skewed scans, handwriting, multi-column layouts, tables that cross page breaks, and files that bundle several documents. Vision-language models handle new layouts well, but cost more per page and can return a confident value that is not on the page. Accounting systems act on these numbers, so uncertain ones must reach a person.

Questions to ask:

- Which document types? Fixed templates or open-ended layouts?
- How many pages per day? Batch, real time, or both?
- Which fields matter most, and what accuracy does each need?
- Can people review uncertain fields, and how fast?
- What data residency and retention rules apply to IDs and medical forms?

## Requirements

**Functional**

- Accept PDFs and images by API or bulk upload; return a job id and send a webhook when results are ready.
- Classify each document (invoice, receipt, contract, ID) and split files that contain several.
- Extract text in reading order, tables, and the fields of a per-type schema; each value has a page, bounding box and confidence.
- Send low-confidence fields to human review and keep corrections as labeled examples.
- Let tenants add custom fields without training a model from scratch.

**Non-functional**

- **Scale:** 10 million pages per day, about 115 per second on average and 5 times that during month-end peaks.
- **Latency:** a one-page receipt through the synchronous API in under 3 seconds at p95; 95% of batch documents within 15 minutes.
- **Accuracy:** at least 98% of key fields (totals, dates, IDs) correct after review; at least 80% of documents need no human touch.
- **Cost:** under 1 cent per page on average, so the vision-language model runs only where cheaper models are unsure.
- **Privacy:** originals encrypted and deleted after 30 days by default; no document content in logs.

## Key concepts

- :term[OCR]{id="ocr"}: needed only for scans and photos; born-digital PDFs carry a text layer that is faster to read and exact.
- :term[Layout analysis]{id="layout-analysis"}: finds columns, tables and reading order, so a two-column contract is not read as scrambled lines.
- :term[Vision-language models]{id="vision-language-model"}: read the page image together with the OCR text and fill a schema for layouts never seen before, at a higher cost per page.
- :term[Hallucination]{id="hallucination"}: a model can return a plausible total that is not on the page, so every value must be matched to text inside its bounding box.
- :term[Human in the loop]{id="human-in-the-loop"}: reviewers see only the uncertain fields, with the source region highlighted, and each correction becomes a training example.
- :term[Message queues]{id="message-queue"}: per-page tasks absorb month-end bursts and let each stage scale independently.
- :term[Idempotency]{id="idempotency"}: page tasks are retried after failures, so results are keyed by document, page and model version.
- :term[Offline evaluation]{id="offline-evaluation"}: field-level accuracy on labeled sets per document type decides which model handles which documents and where review thresholds sit.
- :term[Data drift]{id="data-drift"}: a new vendor's invoice layout shows up as a rising review rate for that type, the signal to add examples and retrain.

## High-level design

::diagram{id="document-understanding-hld"}

1. Tenants upload files through the ingest API. It stores the originals encrypted in object storage and puts one task per page on a queue, so month-end bursts wait in the queue instead of overloading GPUs.
2. Page workers read the text layer of born-digital PDFs and run OCR only on scanned pages. A layout model finds reading order, tables and key-value regions; a classifier labels the document type and where each document starts.
3. The extractor fills the tenant's schema for that type. Common templates go to a small fine-tuned model; unfamiliar layouts go to a vision-language model given the page image and OCR text, with output constrained to the schema. Each value carries a page, bounding box and confidence.
4. Validation checks every value against the page text inside its box, then applies business rules: line items sum to the total, dates parse, ID numbers pass their checksums. Confident documents go straight to the results store, and a webhook notifies the tenant.
5. Uncertain fields go to human review. Corrections update the results and become labeled examples that retrain the extractors and keep confidence scores :term[calibrated]{id="calibration"}.

The full version of this case study will cover the OCR versus vision-language model cost trade-off, tables across page breaks, calibrating confidence and review thresholds, per-tenant custom schemas, and accuracy metrics per field.
