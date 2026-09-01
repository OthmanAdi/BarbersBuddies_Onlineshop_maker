# BarbersBuddies Revival Decisions

## DEC-001: canonical source and implementation boundary

**Decision:** Treat `C:\Users\oasrvadmin\Documents\BarbersBuddies` at `61132dc366e4e30edc9c8a69cde64b010cbb09c4` as the source of truth, and implement only in the clean sibling worktree on `codex/barbersbuddies-revival`.

**Why:** The attached onlineshop folder is a non-Git snapshot with no unique shared source. The canonical checkout has user-owned untracked material and ignored sensitive files that must remain untouched.

**Consequence:** Fetch/compare remote state before each integration decision. Do not use the snapshot or `.git_backup` as an implementation base.

## DEC-002: Firebase remains offline by default

**Decision:** Work from source, controlled local tests, and eventually a disposable emulator project until the user authorizes exact Firebase access.

**Why:** Checked-in files cannot prove deployed Firebase state, and the project contains sensitive local material.

**Consequence:** No production mutation, deploy, seed, migration, or credential use. Separate emulator and production evidence in every status update.

## DEC-003: required research and planning tools

**Decision:** Use Planning With Files, Codebase Knowledge Builder, Graphify, and Context7 as the core revival workflow.

**Why:** The project needs durable resumability, source-cited architecture mapping, secret-safe navigation, and current dependency/framework documentation.

**Consequence:** Keep plans, knowledge, status, decisions, validation, and project memory current. Treat Graphify and memory as navigation aids and confirm material conclusions in current source or a focused receipt.

## DEC-004: Codebase Memory MCP is deferred, not rejected

**Decision:** Do not run its automatic installer yet. If adopted later, use a reviewed, version-pinned binary/manual setup with manual indexing, `auto_index=false`, `auto_watch=false`, and a reviewed ignore scope.

**Why:** Its installer can edit global agent configuration, add hooks/skills, run a daemon/watcher, and write repository artifacts. Existing Knowledge Builder and Graphify workflows can safely begin the revival.

**Consequence:** No Codebase Memory MCP daemon, watcher, automatic config change, or repository database is currently evidence for this project.

## DEC-005: graph trust limit

**Decision:** Retain the sanitized Graphify graph for fast orientation, but do not use it as sole proof.

**Why:** The current graph reports dangling edges, self-loops, collapsed endpoints, and a partial parser result.

**Consequence:** Verify every implementation-impacting graph conclusion directly in the relevant source and tests. Refresh only after the reviewed ignore boundary is still secret-safe.

## DEC-006: Node 22 migration is a proposal, not completed work

**Decision:** Consider a bounded migration to Node 22 after behavior is protected, but do not claim it has been performed.

**Why:** The Functions package declares Node 20 while the host runs Node 24. Node 22 is a likely supported target, but support and package compatibility need current, scoped verification.

**Consequence:** Preserve the current Node 20 declaration until a dedicated dependency/runtime change includes documentation, tests, and emulator/build receipts.

## DEC-007: Booking v2 is the offline contract; activation remains gated

**Decision:** Implement ADR 001 offline: named `createBookingV2`, `cancelBookingV2`, and `rescheduleBookingV2` commands with safe envelopes, deterministic five-minute occupancy, IANA-zone civil time, idempotency, versioning, and durable outbox records. Guest create is allowed. Cancel/reschedule require a verified Firebase identity, with an explicit one-time normalized-email binding path for unowned guest/legacy bookings.

**Why:** This is enough to close the known double-booking and ambiguous-retry design failures in disposable emulators while preserving the product/data choices that need real evidence.

**Consequence:** The v2 feature remains off. No data migration, legacy projection, deployment, or live access proceeds until product policy, authorized Firebase inventory, emulator evidence under the declared runtime, browser evidence, and an explicit release decision exist. In particular, timezone values, intentionally empty roster semantics, duration/buffer limits, abuse controls, cancellation policy, repeated-DST behavior, and legacy conflict handling are still unresolved.
