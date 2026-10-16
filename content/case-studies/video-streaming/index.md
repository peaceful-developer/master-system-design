---
slug: video-streaming
title: Video streaming platform
track: A
order: 10
difficulty: intermediate
summary: Stream to 10 million concurrent viewers at about 40 Tbps by transcoding every upload into adaptive-bitrate segments and serving nearly all bytes from CDN caches.
concepts: [transcoding, adaptive-bitrate-streaming, cdn, origin-shield, cache-hit-rate, hot-spot, message-queue, bandwidth]
prerequisites: [distributed-cache]
estimatedMinutes: 3
status: outline
exercises: []
diagram: video-streaming-hld
---

## Problem statement

Design a video platform in the style of YouTube or Netflix: creators upload videos, and viewers anywhere watch them on phones, TVs and laptops. Playback should start quickly and adapt to the viewer's network.

The hard part is bandwidth. At this scale, serving video usually costs more than storing it, and every byte the origin sends instead of an edge cache costs money and adds latency. Views are very uneven: a small set of videos gets most of the views, while millions of others are rarely watched. Uploads are large and often interrupted, every video must be encoded into many formats, and playback must survive a network that changes from second to second.

Questions to ask:

- User uploads, like YouTube, or a curated catalog, like Netflix? It changes both upload volume and caching.
- How many hours are uploaded a day, how many people watch, and what is peak concurrency?
- Which devices, and what maximum resolution?
- On-demand only, or live streaming too? (On-demand here.)
- How soon after upload must a video be watchable?
- Do we need DRM or regional restrictions?

## Requirements

**Functional**

- Upload videos up to 10 GB, resuming after a dropped connection.
- Transcode each upload into several resolutions and bitrates and generate thumbnails.
- Stream with adaptive bitrate on web, mobile and TV, with seeking anywhere in the video.
- Store and show video metadata: title, description, owner and view count.

**Non-functional**

- **Scale:** 50,000 hours uploaded a day; 100 million daily viewers watching about an hour each; 10 million concurrent streams at peak.
- **Bandwidth:** 10 million streams × 4 Mbps on average is about 40 Tbps of egress at peak.
- **Storage:** about 5 GB per hour of video across all renditions, so about 250 TB a day before replication, plus the originals.
- **Latency:** playback starts within 2 seconds at p95; rebuffering stays under 0.5% of watch time.
- **Processing:** a 10-minute video is watchable within 5 minutes of its upload finishing.
- **Availability:** 99.99% for playback; videos already cached at edges keep playing during an origin outage.

## Key concepts

- :term[Transcoding]{id="transcoding"}: each upload is split at keyframes into chunks of about 10 seconds, and hundreds of workers encode the chunks in parallel, so a long video is ready in minutes instead of hours.
- :term[Adaptive bitrate streaming]{id="adaptive-bitrate-streaming"}: each rendition is cut into segments of a few seconds and listed in an HLS or DASH manifest; the player picks the quality of each next segment from its measured throughput and buffer, so a slow network lowers quality instead of stalling.
- :term[CDN]{id="cdn"}: segments never change once written, which makes them ideal to cache at edges near viewers.
- :term[Cache hit rate]{id="cache-hit-rate"}: at 40 Tbps, each percentage point of edge hit rate is about 400 Gbps the origin does not have to send.
- :term[Origin shield]{id="origin-shield"}: a regional cache tier between edges and storage turns misses from hundreds of edges into one origin fetch, so a new video that goes viral is a :term[hot spot]{id="hot-spot"} for the shield, not for storage.
- :term[Message queue]{id="message-queue"}: finished uploads become transcoding jobs on a queue, so workers scale with queue depth and a failed chunk is simply retried.
- :term[Bandwidth]{id="bandwidth"}: egress dominates cost, so re-encoding popular videos with a newer codec that needs, say, 30% fewer bits at the same quality pays for the extra encoding many times over.

## High-level design

::diagram{id="video-streaming-hld"}

1. The creator's app sends the file to the upload API in parts of about 8 MB, retrying only the parts that fail. The original goes to object storage, and the upload API queues a transcoding job and marks the video "processing" in the metadata store.
2. Transcoders split the original into chunks, encode each one into the bitrate ladder (240p to 1080p or higher), package the results as segments with HLS and DASH manifests, write them to object storage, and mark the video "ready".
3. To play, the app asks the playback API for metadata and a manifest URL. It then requests segments from the nearest CDN edge.
4. An edge miss goes to the regional origin shield, and a shield miss goes to object storage. Popular videos can be pushed to edges ahead of the evening peak.
5. The player switches renditions segment by segment and reports startup time, rebuffering and bitrate, which guide the bitrate ladder and cache placement.

The full version of this case study will cover the bitrate ladder and codec choices, chunked parallel transcoding, the player's bitrate algorithm, CDN placement for the long tail, and counting views at scale.
