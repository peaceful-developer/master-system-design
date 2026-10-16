---
slug: file-sync
title: File sync and storage
track: A
order: 11
difficulty: intermediate
summary: Sync 1 EB of files for 100 million users across their devices within 5 seconds, by splitting files into hashed 4 MB blocks so only new blocks travel and each is stored once.
concepts: [delta-sync, content-addressable-storage, object-storage, erasure-coding, sharding, transaction, optimistic-concurrency-control, long-polling]
prerequisites: [key-value-store]
estimatedMinutes: 3
status: outline
exercises: []
diagram: file-sync-hld
---

## Problem statement

Design a file sync and storage service in the style of Dropbox or Google Drive: users keep a folder on each of their devices, and any file they add, edit or delete in one place appears everywhere else, with older versions kept for recovery.

The hard part is moving as little data as possible over flaky connections without ever losing or corrupting a file. A small edit to a 2 GB video must not re-upload the whole file, two devices editing the same file offline must not silently overwrite each other, and the metadata saying which version is current must stay exactly right, even though the bytes live elsewhere.

Questions to ask:

- How large can files get, and how much does a typical user store?
- How many devices per user, and how quickly must a change show up on the others?
- Do we support shared folders, and live co-editing inside a file? (Shared folders yes; co-editing no.)
- What should happen when two devices change the same file before syncing?
- How long do we keep old versions and deleted files?

## Requirements

**Functional**

- Upload, download, rename, move and delete files up to 50 GB, with uploads that resume after a dropped connection.
- Sync every change to all of a user's devices and to the members of shared folders.
- Keep previous versions for 30 days and restore any of them.
- Work offline, and sync when the device reconnects.

**Non-functional**

- **Scale:** 100 million users storing 10 GB each on average, about 1 EB of logical data; 500 million file changes per day (about 6,000 per second, 15,000 at peak).
- **Freshness:** a small change reaches the user's other online devices within 5 seconds.
- **Durability:** 99.999999999% (eleven nines) per year for file content; an acknowledged upload is never lost.
- **Availability:** 99.95% for sync and download.
- **Efficiency:** only changed blocks cross the network, and identical blocks are stored once.

## Key concepts

- :term[Delta sync]{id="delta-sync"}: the client splits each file into 4 MB blocks, so an edit inside a large file re-uploads only the blocks it touched, and a dropped upload resumes from the last finished block.
- :term[Content-addressable storage]{id="content-addressable-storage"}: each block is named by its SHA-256 hash, so a block that is already stored, from an earlier version or another copy of the file, is never uploaded or stored again.
- :term[Object storage]{id="object-storage"}: block bytes live in a cheap blob store keyed by hash, while the much smaller metadata lives in a database built for transactions.
- :term[Erasure coding]{id="erasure-coding"}: storing each block as 10 data fragments plus 4 parity fragments survives the loss of any 4 disks for 1.4× the raw size, instead of 3× for full copies, which matters at 1 EB.
- :term[Sharding]{id="sharding"}: metadata is sharded by namespace (one user's root folder or one shared folder), so a commit and that namespace's change journal live on the same shard.
- :term[Transactions]{id="transaction"}: a new file version and its journal entry are written together, so no device ever sees one without the other.
- :term[Optimistic concurrency control]{id="optimistic-concurrency-control"}: each commit names the version it started from; if another device committed first, the commit is rejected and the client keeps its edit as a "conflicted copy" instead of overwriting.
- :term[Long polling]{id="long-polling"}: each idle device keeps one open request to a notifier that returns as soon as its namespace changes, so changes arrive in seconds without timed polling.

## High-level design

::diagram{id="file-sync-hld"}

1. The client watches the local folder. When a file changes, it splits the file into blocks, hashes each one and sends a commit to the metadata service: the path, the ordered list of block hashes and the version it started from.
2. The metadata service replies with the hashes the block store doesn't have. The client uploads only those blocks to the block service, which checks each hash and writes the block to erasure-coded object storage.
3. The client repeats the commit. The metadata service checks that every block exists and that the base version is still current, then writes the new version and appends an entry to the namespace's journal in one transaction.
4. The commit publishes a "namespace changed" event. The notifier, which holds a long-poll connection from every online device, wakes the devices that follow that namespace.
5. Each woken device asks for the journal entries after its saved cursor, downloads the blocks it is missing, rebuilds the file locally and moves its cursor forward.

The full version of this case study will cover the estimates, content-defined chunking for edits that shift data, the journal and cursor protocol, conflict handling and version history, and moving cold blocks to cheaper storage tiers.
