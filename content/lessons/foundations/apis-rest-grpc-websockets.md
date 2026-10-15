---
slug: apis-rest-grpc-websockets
title: 'APIs: REST, gRPC and WebSockets'
phase: foundations
order: 2
summary: How programs talk to each other, when to use REST, gRPC or a live connection, and how to change an API without breaking anyone.
estimatedMinutes: 12
concepts: [api, rest, grpc, protocol-buffers, websocket, server-sent-events, long-polling, pagination, api-versioning, idempotency]
exercises: [apis-quiz]
---

Every time a weather app shows tomorrow's forecast, it has asked a server a question in a format both sides agreed on beforehand. That agreement is an :term[API]{id="api"}. In system design you'll draw boxes connected by arrows, and every arrow is an API: its shape decides how fast, how flexible and how fragile the system is.

:::primer
An **API** is a menu. It lists what you can ask for ("get user 42", "create an order") and what you'll get back. You don't need to know how the kitchen works; you only need the menu.

This lesson compares three popular ways of writing that menu:

- **REST**: plain HTTP requests on URLs, readable by humans and every tool.
- **gRPC**: compact, typed, fast calls between your own services.
- **WebSockets** (and friends): a line that stays open so the server can push updates.
:::

## REST: resources and verbs

:term[REST]{id="rest"} models your system as **resources** (nouns) with URLs, manipulated with standard :term[HTTP]{id="http"} methods (verbs).

| Method | Meaning | Example | Safe to retry? |
| --- | --- | --- | --- |
| GET | Read | `GET /users/42` | Yes |
| POST | Create (or trigger an action) | `POST /orders` | Not by default |
| PUT | Replace | `PUT /users/42` | Yes |
| PATCH | Partly update | `PATCH /users/42` | Depends |
| DELETE | Remove | `DELETE /orders/7` | Yes |

"Safe to retry" is the property called :term[idempotency]{id="idempotency"}: doing it twice has the same effect as doing it once. Deleting order 7 twice still leaves it deleted. Creating an order twice creates two orders, which is why payment APIs add extra protection (you'll see how in [rate limiting and idempotency](/learn/building-blocks/rate-limiting-and-idempotency)).

A typical REST exchange:

```http
POST /orders HTTP/1.1
Content-Type: application/json

{ "productId": "p-19", "quantity": 2 }
```

```http
HTTP/1.1 201 Created
Location: /orders/9031

{ "id": "9031", "status": "pending" }
```

**Why REST is everywhere:** it works with any language, browsers speak it natively, responses can be cached by browsers and CDNs, and you can debug it with a single command line tool.

**Where REST hurts:** JSON is verbose and slow to parse at very high volumes, there's no built-in schema (a typo in a field name fails at runtime), and showing one screen may need many separate requests.

### Paging through big lists

Never return a million rows in one response. :term[Pagination]{id="pagination"} returns a page at a time:

- **Offset pagination** (`?offset=200&limit=50`) is simple, but deep pages get slow (the database still counts past the first 200 rows), and if items are inserted while someone browses, they see duplicates or skip items.
- **Cursor pagination** (`?after=eyJpZCI6OTAzMX0&limit=50`) returns an opaque cursor pointing just after the last item. It stays fast and correct as data changes, which is why social feeds use it.

## gRPC: fast, typed calls between services

:term[gRPC]{id="grpc"} lets one service call a function on another as if it were local. You describe messages and methods in a schema file using :term[Protocol Buffers]{id="protocol-buffers"}:

```text
service OrderService {
  rpc GetOrder (GetOrderRequest) returns (Order);
  rpc WatchOrders (WatchRequest) returns (stream Order);
}

message GetOrderRequest { string id = 1; }
message Order { string id = 1; string status = 2; int64 total_cents = 3; }
```

Code generators turn that file into client and server code in many languages. Messages travel as compact binary over :term[HTTP/2]{id="http-2"}, so gRPC is typically smaller and faster than JSON over REST, and it supports **streaming** in either or both directions.

**Trade-offs:** browsers can't call gRPC directly without a proxy, binary messages are harder to inspect by eye, and both sides must share the schema. That's why a common pattern is **REST (or GraphQL) at the edge for browsers and partners, gRPC between internal services.**

## Real-time: getting updates without asking

Chat, live scores and stock tickers need the server to tell the client "something changed". There are four ways to do it, from simplest to most capable:

1. **Polling:** the client asks every few seconds. Simple, but wasteful, and updates arrive late.
2. **:term[Long polling]{id="long-polling"}:** the client asks, and the server holds the request open until there's news (or a timeout), then the client asks again. Near-instant, works everywhere, but each message costs a new request.
3. **:term[Server-sent events (SSE)]{id="server-sent-events"}:** one long HTTP response that the server keeps writing events into. One-way (server to client), simple, and reconnects automatically. Great for notifications and streaming AI responses.
4. **:term[WebSockets]{id="websocket"}:** a full two-way connection. The client and server can send messages at any time. Best for chat, multiplayer games and collaborative editing.

:::warning[Live connections change your servers]
A WebSocket stays open for minutes or hours. A server holding 100,000 open connections needs memory for each, and a load balancer can't simply send each message anywhere: the connection lives on one specific server. Plan for **connection servers** that hold sockets, plus a way (like pub/sub) to route a message to whichever server holds the recipient's connection.
:::

## Choosing an API style

| Situation | Good fit | Why |
| --- | --- | --- |
| Public API for partners and browsers | REST | Universal, cacheable, easy to explore |
| Internal service-to-service calls at high volume | gRPC | Typed contracts, compact, streaming |
| Server pushes updates, client rarely sends | SSE | Simple, one-way, auto-reconnect |
| Both sides send often (chat, games) | WebSockets | True two-way, low overhead per message |
| Must work behind every old proxy | Long polling | It's just ordinary HTTP requests |

:::deeper[Evolving an API without breaking clients]
Once other people depend on your API, every change is risky. A few rules keep you safe:

- **Add, don't rename.** New optional fields are safe; renaming or removing fields breaks old clients. In Protocol Buffers, never reuse a field number: old clients decode numbers, not names.
- **Be liberal in what you accept.** Clients should ignore unknown fields so the server can add data freely.
- **Version when you must break.** Publish `/v2/orders` beside `/v1/orders` (or a version header), run both, and retire v1 on a published schedule once traffic drops.
- **Deprecate visibly.** Return a deprecation header, email API key owners, and watch the traffic graph before turning anything off.

:term[API versioning]{id="api-versioning"} is mostly about *people*: the hard part is giving every client a realistic path to upgrade.
:::

:::interview
In the "API design" step of an interview, write 3–6 endpoints with methods, paths, key fields and status codes, for example `POST /urls → 201 { shortCode }` and `GET /{code} → 301`. Then say *why* you chose the style: "REST for the public API because clients are browsers; gRPC between the services because of volume." Mention pagination and idempotency for anything that lists or creates.
:::

## Key takeaways

- An API is a contract. Its style affects speed, flexibility and how easy it is to change.
- REST uses resources and HTTP methods. It's universal and cacheable; use cursor pagination for big lists.
- gRPC gives typed, compact, streaming calls and shines between your own services.
- For real-time updates, pick polling, long polling, SSE or WebSockets based on direction and frequency of messages.
- Change public APIs by adding, not renaming, and version when you must break.

::quiz{id="apis-quiz"}
