---
slug: how-the-web-works
title: How the web works
phase: foundations
order: 1
summary: Follow one click from your browser to a server and back, and learn why every round trip costs you time.
estimatedMinutes: 12
concepts: [dns, tcp, tls, http, round-trip-time, keep-alive, http-2, http-3]
exercises: [how-the-web-works-quiz]
---

You type an address, press Enter, and a page appears in well under a second. In that blink, your browser looked up an address in a worldwide directory, shook hands with a computer that may be on another continent, agreed on secret keys, and asked for a page. Each of those steps costs time, and nearly every system design decision you'll make later is about paying for them less often.

:::primer
Think of loading a web page like calling a shop you have never called before:

1. You look up its number in a directory (**DNS**).
2. You dial and wait until they pick up (**TCP** connection).
3. You agree to speak in a code nobody else understands (**TLS** encryption).
4. You place your order and they read it back (**HTTP** request and response).

Every "wait for the other side to answer" is a **round trip**. Round trips are the unit of slowness on the internet.
:::

## The four steps at a glance

::figure{id="request-lifecycle" caption="Loading a page for the first time: DNS, TCP, TLS, then HTTP. Each step needs at least one round trip."}

Let's walk through each step, then add up what it costs.

## Step 1: Find the server with DNS

Computers find each other by :term[IP address]{id="ip-address"}, a number like `93.184.216.34`. People prefer names like `example.com`. :term[DNS]{id="dns"} is the internet's directory that turns names into addresses.

When your browser needs an address, it asks a **recursive resolver** (usually run by your internet provider or a public service). If the resolver doesn't already know the answer, it asks in stages:

1. A **root server** says which servers handle `.com`.
2. A **top-level domain server** for `.com` says which servers are in charge of `example.com`.
3. The domain's **authoritative server** gives the actual address.

That sounds slow, and the first lookup can take tens of milliseconds. But every answer carries a :term[TTL]{id="ttl"} (time to live) saying how long it may be cached. Your browser, your operating system and the resolver all keep copies, so most lookups are answered from a nearby cache in a millisecond or two.

:::tip[Design consequence]
DNS caching is why changing a DNS record doesn't take effect everywhere at once. If you plan to move traffic by changing DNS, lower the TTL well before the move.
:::

## Step 2: Open a connection with TCP

Now the browser knows where the server is. It opens a :term[TCP]{id="tcp"} connection, which promises that bytes arrive complete and in order, resending anything lost on the way.

Opening that connection takes a **three-way handshake**:

1. Client → server: "I'd like to talk" (SYN).
2. Server → client: "Sure, I hear you" (SYN-ACK).
3. Client → server: "Great, here comes my request" (ACK, often sent along with the first data).

The client can only start sending data after step 2 comes back. So the handshake costs one full :term[round-trip time]{id="round-trip-time"} (RTT) before any useful work happens.

How long is an RTT? It depends mostly on distance. Light in fibre travels about 200,000 km per second, so a round trip between New York and London (about 5,600 km each way) can't be faster than roughly 56 ms, and in practice it's often 70–80 ms. Within one city, a round trip might be a few milliseconds.

## Step 3: Make it private with TLS

Almost every site now uses HTTPS: HTTP inside an encrypted :term[TLS]{id="tls"} connection. TLS does two jobs:

- **Encryption:** nobody between you and the server can read or change the traffic.
- **Authentication:** the server proves it really is `example.com` by presenting a certificate signed by an authority your browser trusts.

The client and server must agree on keys before sending anything private. With TLS 1.3, the current version, a new connection needs **one extra round trip** for that. The older TLS 1.2 needed two.

## Step 4: Ask and answer with HTTP

Finally, the browser sends an :term[HTTP]{id="http"} request: a **method**, a **path**, some **headers** and sometimes a **body**.

```http
GET /index.html HTTP/1.1
Host: example.com
Accept: text/html
```

The server replies with a **status code**, headers and the content:

```http
HTTP/1.1 200 OK
Content-Type: text/html
Cache-Control: max-age=300

<!doctype html>…
```

Status codes come in families that are worth knowing by heart:

| Range | Meaning | Examples |
| --- | --- | --- |
| 2xx | It worked | 200 OK, 201 Created, 204 No Content |
| 3xx | Look elsewhere | 301 Moved Permanently, 304 Not Modified |
| 4xx | The client made a mistake | 400 Bad Request, 401 Unauthorized, 404 Not Found, 429 Too Many Requests |
| 5xx | The server failed | 500 Internal Server Error, 503 Service Unavailable |

## Adding up the cost

Suppose the server is about 100 ms away (one RTT is 100 ms) and the DNS answer isn't cached:

| Step | Round trips | Time |
| --- | --- | --- |
| DNS lookup (uncached) | about 1 | ~100 ms |
| TCP handshake | 1 | 100 ms |
| TLS 1.3 handshake | 1 | 100 ms |
| HTTP request and response | 1 | 100 ms + server time |
| **Total before the first byte of the page** | **about 4** | **~400 ms** |

That's before the server does any work, and before the page asks for its images, scripts and styles. This is why the biggest performance wins usually come from **removing round trips** or **making them shorter**, not from making servers faster.

## How the web saves round trips

**Reuse connections.** With :term[keep-alive]{id="keep-alive"}, one TCP and TLS connection serves many requests. Only the first request pays for the handshakes.

**Send many requests at once.** :term[HTTP/2]{id="http-2"} lets one connection carry many requests in parallel (multiplexing) instead of one at a time.

**Move the server closer.** A content delivery network (CDN) keeps copies of content in cities near users, so the RTT drops from 100 ms to perhaps 10 ms. You'll meet CDNs in [caching and CDNs](/learn/building-blocks/caching-and-cdns).

**Combine handshakes.** :term[HTTP/3]{id="http-3"} runs over QUIC, which sets up the transport and encryption together in a single round trip, and can resume known connections with none.

:::deeper[Head-of-line blocking and why HTTP/3 uses UDP]
HTTP/2 multiplexes many requests over one TCP connection. But TCP delivers bytes strictly in order: if one packet is lost, everything behind it waits until it's resent, even bytes belonging to unrelated requests. This is :term[head-of-line blocking]{id="head-of-line-blocking"} at the transport layer, and on lossy mobile networks it can make HTTP/2 slower than several separate HTTP/1.1 connections.

QUIC, the transport under HTTP/3, is built on :term[UDP]{id="udp"} and implements its own reliable streams. A lost packet only delays the stream it belongs to. QUIC also folds the TLS 1.3 handshake into its own, and connections can survive a change of network (say, Wi-Fi to cellular) because they are identified by a connection ID rather than by IP address and port.

The trade-off: QUIC runs in user space instead of the operating system kernel, so it can cost more CPU, and some networks still block or throttle UDP. That's why browsers fall back to HTTP/2 when HTTP/3 fails.
:::

## Why this matters for system design

Almost every component you'll add later exists to fight the costs in this lesson:

- **Caches and CDNs** shorten or skip round trips.
- **Load balancers** sit at the end of the TCP and TLS connections and spread requests across servers.
- **Connection pools** between your services reuse connections instead of handshaking for every call.
- **Batching** combines many small requests into one round trip.

When you look at any design, ask: *how many round trips does a request take, and how long is each one?*

:::interview
When asked "what happens when you type a URL into the browser?", don't recite every detail. Walk through DNS, TCP, TLS and HTTP in order, give a rough cost in round trips, then say where you'd optimize: caching DNS, reusing connections, putting a CDN in front, and moving to HTTP/2 or HTTP/3. Tying each step to a design choice is what makes the answer strong.
:::

## Key takeaways

- Loading a page takes four kinds of steps: DNS lookup, TCP handshake, TLS handshake and the HTTP exchange.
- Each step costs at least one round trip, and round-trip time is set mostly by physical distance.
- A cold request to a server 100 ms away can take ~400 ms before the first byte arrives.
- The web gets faster mainly by removing round trips (connection reuse, HTTP/2, HTTP/3) and shortening them (CDNs).

::quiz{id="how-the-web-works-quiz"}
