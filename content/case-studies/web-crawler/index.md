---
slug: web-crawler
title: Web crawler
track: A
order: 8
difficulty: intermediate
summary: Crawl 1 billion pages a month, about 400 per second, without overloading any site or fetching repeats, using a host-partitioned URL frontier, Bloom filters for seen URLs and content fingerprints.
concepts: [url-frontier, crawl-politeness, hash-partitioning, bloom-filter, simhash, dns, retry-with-backoff]
prerequisites: [rate-limiter, key-value-store]
estimatedMinutes: 3
status: outline
exercises: []
diagram: web-crawler-hld
---

## Problem statement

Design the crawler behind a search engine, in the style of Googlebot or Common Crawl: start from a list of seed URLs, download each page, extract its links, and keep going, then revisit pages as they change.

The web is huge, messy and owned by other people. The crawler must never overload a site, must skip the many URLs that lead to the same content, must escape traps such as endless calendar pages, and must decide which of tens of billions of known URLs deserve its limited fetch budget this month.

Questions to ask:

- What is the crawl for: a search index, an archive, or training data? It decides what we store.
- How many pages per month, and how often should popular pages be revisited?
- HTML only, or also PDFs and images?
- Must we run JavaScript to see a page's content?
- Must we obey robots.txt and limit our request rate per site? (Yes.)

## Requirements

**Functional**

- Start from seed URLs; fetch pages, extract links, and add new URLs to the crawl.
- Obey robots.txt and a minimum delay between requests to the same host.
- Store raw HTML with metadata (URL, fetch time, status, content fingerprint) for the indexer.
- Skip URLs already seen and pages that duplicate one already stored.
- Revisit pages on a schedule based on how often they change and how important they are.

**Non-functional**

- **Scale:** 1 billion pages a month, about 400 per second on average and 800 at peak; tens of billions of known URLs in the frontier.
- **Storage:** about 100 KB per page, so roughly 100 TB of raw HTML a month before compression.
- **Bandwidth:** 800 pages per second × 100 KB is about 80 MB/s, or 640 Mbit/s, of downloads at peak.
- **Politeness:** at most one request per second to any host by default, slower if the site asks.
- **Robustness:** malformed HTML, slow servers and traps never stall the crawl; a crashed fetcher loses only the pages it had in flight.

## Key concepts

- :term[URL frontier]{id="url-frontier"}: front queues order URLs by priority (importance and expected change), and back queues hold one host each, so the crawler decides both what matters most and when each host may be fetched again.
- :term[Crawl politeness]{id="crawl-politeness"}: each back queue records when its host may next be fetched, and robots.txt is cached for a day, so no site sees more than the agreed rate.
- :term[Hash partitioning]{id="hash-partitioning"}: URLs are assigned to crawler nodes by a hash of the hostname, so all state for one host lives on one node and politeness needs no coordination between nodes.
- :term[Bloom filter]{id="bloom-filter"}: answers "have we seen this URL?" in memory; 10 billion URLs at a 1% false-positive rate need about 12 GB in total, and a false positive only means skipping one new URL.
- :term[SimHash]{id="simhash"}: fingerprints page text so near-duplicates, such as the same article with different ads or timestamps, are detected and their links are not followed again.
- :term[DNS]{id="dns"}: a lookup can take tens to hundreds of milliseconds, which would stall a fetcher, so each node runs its own caching resolver.
- :term[Retry with backoff]{id="retry-with-backoff"}: server errors and timeouts push that host's next fetch further out, and the crawler slows down for hosts whose response times climb.

## High-level design

::diagram{id="web-crawler-hld"}

1. A scheduler feeds seed URLs and due recrawls into the URL frontier. The frontier places each URL in a priority queue, then routes it to the back queue for its host on the node that owns that host.
2. Fetchers take the next host whose delay has passed, check the cached robots.txt, resolve the host through the local DNS cache, and download the page with a timeout of a few seconds and a size cap.
3. The raw page goes to object storage and its metadata to a URL table. Parsers compute the page's fingerprint; if a near-duplicate is already known, the page is marked as a copy and processing stops there.
4. Parsers extract and normalize links (resolve relative paths, lowercase the host, strip fragments), drop URLs that look like traps or are too deep, and check the rest against the seen-URL filter.
5. Unseen URLs go back to the frontier. The scheduler re-adds stored URLs on a cadence that matches how often each page has changed.

The full version of this case study will cover frontier storage on disk, prioritization and recrawl scheduling, trap detection, JavaScript rendering, and how to scale fetchers across regions.
