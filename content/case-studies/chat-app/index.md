---
slug: chat-app
title: Chat application
track: A
order: 7
difficulty: intermediate
summary: Deliver 4 billion messages a day between 100 million daily users in under 300 ms over persistent WebSockets, storing each conversation in order and syncing every device.
concepts: [websocket, presence, sequence-number, wide-column-store, sharding, fan-out-on-write, at-least-once, idempotency-key, read-your-writes]
prerequisites: [notification-system, news-feed]
estimatedMinutes: 3
status: outline
exercises: []
diagram: chat-app-hld
---

## Problem statement

Design a chat app in the style of WhatsApp or Facebook Messenger: one-to-one and group conversations, delivered in real time to every device a user owns, with message history, receipts and online status.

Chat turns the usual request and response around: the server must push each message to the recipient the moment it arrives. That means holding tens of millions of open connections and always knowing which server holds each one. Each message must also appear exactly once and in order, even when a phone drops off the network halfway through sending and reconnects a minute later.

Questions to ask:

- One-to-one only, or groups too, and how large can a group be?
- Can a user be signed in on several devices, and must history sync across them?
- How long is history kept?
- Do we need sent, delivered and read receipts, and online status?
- Text only, or images and video too? (Media goes to object storage; messages carry links.)
- Is the chat end-to-end encrypted? That limits what the server can read and search.

## Requirements

**Functional**

- Send and receive one-to-one and group messages; groups have up to 500 members.
- Every message reaches all of the recipient's devices; history loads by scrolling back.
- Sent, delivered and read receipts; online and last-seen status.
- A push notification when the recipient has no open connection.

**Non-functional**

- **Scale:** 100 million daily users, 50 million connected at peak; 40 messages sent per user per day, which is 4 billion a day, about 46,000 per second on average and 140,000 at peak.
- **Connections:** about 100,000 open connections per chat server, so about 500 chat servers at peak.
- **Latency:** p99 under 300 ms from sender to an online recipient in the same region.
- **Durability:** once the sender sees "sent", the message is stored on three replicas and will be delivered.
- **Ordering:** messages in a conversation appear in the same order on every device.
- **Storage:** about 200 bytes per message, so roughly 800 GB a day and 290 TB a year before replication.

## Key concepts

- :term[WebSockets]{id="websocket"}: each app keeps one long-lived connection to a chat server, so messages are pushed as they arrive instead of the app polling every few seconds.
- :term[Presence]{id="presence"}: apps send a heartbeat every 30 seconds that refreshes a short-lived session entry; the same entry tells the system which chat server holds each device's connection.
- :term[Sequence numbers]{id="sequence-number"}: each conversation numbers its messages in one place, so every device shows the same order and can detect a gap and fetch what it missed.
- :term[Wide-column store]{id="wide-column-store"}: messages are partitioned by conversation id and sorted by sequence number, so opening a chat reads the latest 50 messages from one partition, and writes scale out with :term[sharding]{id="sharding"}.
- :term[Fan-out on write]{id="fan-out-on-write"}: each message is also appended to every recipient's inbox, so a reconnecting device catches up with one read. The 500-member cap bounds the cost per message.
- :term[At-least-once delivery]{id="at-least-once"}: the sender retries until the server acknowledges, and the server resends until the device acknowledges; a client-generated :term[idempotency key]{id="idempotency-key"} on each message lets both sides drop duplicates.
- :term[Read-your-writes]{id="read-your-writes"}: a message sent from a phone must also show up on the sender's laptop, so the sender's own inbox gets it too and their other devices sync it like any recipient's.

## High-level design

::diagram{id="chat-app-hld"}

1. The app opens a WebSocket through a load balancer to a chat server. The chat server writes a session entry, device to server, with a 60-second TTL that each heartbeat refreshes.
2. To send, the app passes a message with a client-generated id. The chat server assigns the next sequence number in the conversation, appends the message to the message store, and acknowledges "sent".
3. The chat server appends a pointer to the message to each member's inbox, then looks up the members' sessions and forwards the message to the chat servers that hold their connections, which push it down the WebSocket.
4. Devices with no session get a push through the notification system. When a device reconnects, it asks for inbox entries after the last one it saw, fetches those messages, and acknowledges them; that acknowledgement becomes the "delivered" receipt.
5. Online status is read from session entries on demand when a user opens a chat, rather than pushed to every contact on each change.

The full version of this case study will cover connection and storage estimates, how sequence numbers are assigned per conversation, group fan-out and receipts, multi-device sync, and draining chat servers during deploys without losing messages.
