# ADR 001: Booking v2 command and occupancy contract

- **Status:** Proposed for offline implementation; live activation blocked
- **Date:** 2026-09-01
- **Scope:** Booking create, cancel, reschedule, lifecycle, occupancy, authorization, idempotency, notifications, and legacy migration
- **Baseline:** `61132dc366e4e30edc9c8a69cde64b010cbb09c4`

## Context

The current booking path has no single consistency boundary:

- The browser queries `bookedTimeSlots`, then creates a random slot document before it calls the backend. Two callers can both observe vacancy and claim the same interval. [src/components/BookNow.js:263-297](../../src/components/BookNow.js#L263)
- The create handler independently adds a booking without checking occupancy or caller identity. It persists the booking before sending email, so an email failure can turn a committed booking into an apparent request failure. [functions/index.js:39-119](../../functions/index.js#L39)
- The browser's create request uses a literal, non-interpolated endpoint string. [src/components/BookNow.js:334](../../src/components/BookNow.js#L334)
- Cancel mutates a slot, calls a Function, writes a notification, and mutates the booking in separate operations. [src/components/AppointmentCard.js:183-301](../../src/components/AppointmentCard.js#L183)
- Reschedule can reference an undeclared appointment, call the server twice through its callback chain, and never moves occupancy atomically. [src/components/AppointmentRescheduleModal.js:57-97](../../src/components/AppointmentRescheduleModal.js#L57), [src/components/AppointmentRescheduleModal.js:173-277](../../src/components/AppointmentRescheduleModal.js#L173)
- Checked-in Rules authorize bookings with request-body-derived email or owner fields and define no `bookedTimeSlots` match. [firestore.rules:18-27](../../firestore.rules#L18), [firestore.rules:1-67](../../firestore.rules#L1)

Firestore transactions are the chosen serialization boundary because they atomically apply all writes, retry after concurrent edits to read documents, and never partially apply a successful transaction. Transaction callbacks may run more than once, so they must not perform email, push, or other external side effects. See [Firebase: transactions and batched writes](https://firebase.google.com/docs/firestore/manage-data/transactions).

Authenticated commands derive identity from a Firebase ID token verified by the Admin SDK. The verified `uid`, not a request-body UID, email, role, or owner ID, is the durable identity. The verified token's normalized email is permitted only for the one-time legacy/guest binding defined below. See [Firebase: verify ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

## Decision

Booking v2 will be a server-authoritative command API. The browser may request commands and render their results, but it may not create, update, delete, reserve, or repair booking occupancy directly.

Offline implementation is approved. Production access, migration, deployment, traffic cutover, and feature activation remain blocked by the gates below.

### API and response envelope

V2 initially consists of three separately versioned Firebase HTTPS exports. Their deployed URL shape remains Firebase-controlled; callers bind to the export name, not an invented REST router:

| Export | Caller | Purpose |
| --- | --- | --- |
| `createBookingV2` | Guest or verified Firebase user | Create a booking and reserve its full occupancy interval |
| `cancelBookingV2` | Verified customer or current authoritative shop owner | Apply an allowed cancellation and release occupancy |
| `rescheduleBookingV2` | Verified customer or current authoritative shop owner | Move occupancy atomically and preserve lifecycle status |

`getBookingAvailabilityV2` is a later read endpoint. It is not part of the initial three-export implementation and must not block proving write correctness in the emulator.

Create accepts an optional `Authorization: Bearer <Firebase ID token>` header. A request without a token is a guest create and records `customerUid: null`. Later cancel or reschedule still requires a verified ID token, using the controlled legacy-binding rule below.

Every command requires `Idempotency-Key`. Mutations of an existing booking also require integer `expectedVersion`. The create body contains only intent:

```json
{
  "shopId": "shop-id",
  "requestedEmployeeId": "optional-employee-id",
  "serviceIds": ["service-id"],
  "localDate": "YYYY-MM-DD",
  "localStartTime": "HH:mm",
  "customer": {
    "name": "customer supplied",
    "email": "customer supplied",
    "phone": "customer supplied"
  },
  "consentVersion": "versioned-policy-id"
}
```

The server ignores client-supplied price, duration, buffer, timezone, resource ID, status, owner ID, and timestamps. It loads authoritative shop, service, employee, ownership, availability, and policy documents. All three exports use the same success envelope:

```json
{
  "ok": true,
  "commandId": "command-id",
  "replayed": false,
  "booking": {
    "bookingId": "booking-id",
    "version": 1,
    "status": "pending",
    "resourceId": "employee:employee-id",
    "startAt": "RFC-3339 instant",
    "endAt": "RFC-3339 instant"
  }
}
```

An idempotent replay returns the same `commandId` and canonical `booking` with `replayed: true`. Error responses use `{ "ok": false, "error": { "code", "message", "retryable" } }`. `message` is safe for display, `retryable` is a boolean, and no response contains an internal exception, token, credential, or unnecessary personal data.

### Authorization

- Cancel and reschedule reject a missing, invalid, expired, or unverifiable ID token with `UNAUTHENTICATED`.
- Customer authorization succeeds when `decodedToken.uid === booking.customerUid`.
- For a legacy or guest booking with no `customerUid`, authorization may compare the non-empty normalized email from the verified token with normalized `booking.userEmail`. On a match, the same transaction binds `customerUid` to the verified UID before applying the mutation. Once bound, later email matches cannot replace it.
- Shop authorization requires the verified UID to match the current owner loaded from the authoritative shop document.
- Request-body email, `customerUid`, `shopOwnerId`, `userType`, or role is never trusted as authorization evidence. Knowledge of booking fields is not authority.
- Cancel and reschedule re-check authoritative policy, state, shop, resource, and time constraints inside the transaction.
- Guest creation needs rate limiting and abuse protection before live activation. App Check may supplement abuse controls but does not replace authorization.

### Deterministic resource resolution

The transaction resolves exactly one capacity-bearing resource:

1. Build the authoritative employee roster and require every roster member to have a non-empty, stable employee ID. A malformed roster or a roster entry without a stable ID returns `SHOP_RESOURCE_CONFIG_REQUIRED`; invalid entries are not silently skipped.
2. If `requestedEmployeeId` is present, load that exact employee and require it to be active, bookable, eligible for every selected service, available for the full interval, and free in every covered bucket. The resource is `employee:{employeeId}`. A missing ID returns `EMPLOYEE_NOT_FOUND`; schedule or service ineligibility returns `EMPLOYEE_UNAVAILABLE`; occupied buckets return `SLOT_CONFLICT`.
3. If no employee preference is supplied and the roster exists, sort active stable employee IDs lexicographically. Inside the transaction, try them in that order and select the first eligible employee whose complete bucket set is free. This makes the same authoritative state produce the same allocation.
4. If the shop has no employee roster, use the single fallback resource `shop:{shopId}:primary`. The fallback is never used to bypass a malformed roster or a requested employee failure.
5. If no roster candidate is eligible, return `EMPLOYEE_UNAVAILABLE`. If eligible candidates exist but all covered bucket sets conflict, return `SLOT_CONFLICT`.

The production meaning of an empty roster remains a live-data gate. Offline fixtures must distinguish an intentionally empty roster from malformed or missing employee identity data.

### Time and five-minute occupancy buckets

- Each shop has one authoritative IANA `timeZone`.
- Input is civil `localDate` plus `localStartTime`, interpreted only in that shop timezone.
- The server snapshots selected services, price, service duration, and buffer, then derives Firestore `startAt` and `endAt` timestamps.
- Active occupancy is half-open: `[startAt, endAt)`. Adjacent appointments may touch at a boundary.
- `localStartTime` must identify a five-minute local bucket start. Service duration and buffer do not need to be multiples of five minutes.
- Reserve every five-minute local bucket whose interval intersects `[startAt, endAt)`. For example, a seven-minute booking starting at `10:00` reserves the `10:00` and `10:05` buckets. This conservative coverage prevents under-reservation without changing the exact half-open booking interval.
- Bucket identity is deterministic from `shopId`, resolved `resourceId`, `localDate`, and five-minute local bucket start. The document also stores resolved instant boundaries, `bookingId`, and booking version for auditability.
- The initial offline contract rejects any booking whose exact `endAt` falls on a different shop-local date than `localDate`. Cross-midnight booking support requires a later contract revision.
- Invalid calendar dates return `INVALID_DATE`; malformed, unaligned, nonexistent, or ambiguous local starts return `INVALID_TIME`; non-positive, excessive, or cross-midnight duration returns `INVALID_DURATION`.
- DST gaps are rejected. Repeated local times require explicit server-supported disambiguation before that shop can activate v2.

Create reads every deterministic bucket in the transaction and fails if any active owner exists. Cancel deletes every bucket owned by the expected booking and version. Reschedule reads the complete old and new bucket sets, verifies ownership and vacancy, then deletes old-only buckets and creates new-only buckets in the same transaction. Shared buckets are updated to the new version without releasing them between operations.

### Idempotency, optimistic versioning, and transactions

- An idempotency document is keyed by a digest of command type, caller scope, and `Idempotency-Key`. Authenticated scope uses verified UID; guest create scope uses shop ID.
- The document stores a canonical request digest, command state, booking ID, result envelope, and timestamps.
- Reusing a key with the same canonical request returns the stored result without repeating writes or side effects.
- Reusing a key with a different canonical request returns `IDEMPOTENCY_KEY_REUSED`.
- Booking version starts at `1`. Every successful mutation requires the current `expectedVersion` and increments the version once. A stale version returns `BOOKING_VERSION_CONFLICT` without changing booking, occupancy, command result, or outbox.
- The booking, all affected occupancy buckets, the idempotency result, and outbox events commit in one Firestore transaction.
- Transaction code performs only deterministic reads, validation, and Firestore writes. It never calls email, push, analytics, logging webhooks, or other external systems.

### State machine

The canonical lifecycle states are lowercase strings:

```text
pending -> confirmed -> completed
   |           |
   +-------> cancelled
   |
   +-------> rejected
```

- The only canonical statuses are `pending`, `confirmed`, `completed`, `rejected`, and `cancelled`.
- `cancelled`, `rejected`, and `completed` are terminal.
- Reschedule is an event, not a lifecycle status. It is allowed only from `pending` or `confirmed`, preserves that status, updates the schedule snapshot, and increments version.
- Confirm is allowed only from `pending`.
- Complete is allowed only from `confirmed` and only by an authorized shop actor.
- Reject is allowed only from `pending` and only by an authorized shop actor.
- Cancel is allowed only from `pending` or `confirmed` and must satisfy the authoritative cancellation policy.
- All other transitions return `INVALID_STATUS_TRANSITION`.

### Durable outbox

Each committed command writes one or more outbox records with a deterministic event identity derived from booking ID, resulting version, and event type. Delivery workers process records at least once, record attempts and terminal disposition, and use provider-side idempotency where available.

Email, push, in-app notification, and analytics failures never roll back or reinterpret a committed booking. Retrying delivery cannot create, cancel, reschedule, confirm, or complete a booking. API success means the booking transaction committed, not that every notification provider accepted delivery.

### Legacy reads, compatibility writes, and migration

- Canonical v2 bookings remain in `bookings/{bookingId}` with `schemaVersion: 2`, canonical fields, lifecycle status, version, resource snapshot, time snapshot, policy snapshot, and audit timestamps.
- During client cutover, reads are v2-first. A legacy adapter may translate a `schemaVersion`-missing document to a read-only legacy view. Translation must never invent authoritative resource ownership, timezone, or occupancy.
- V2 may write a reviewed legacy field projection into the same booking document so uncut read-only screens continue to render. The canonical fields win on disagreement.
- No browser code may write either the canonical fields or the compatibility projection.
- `bookedTimeSlots` is not authoritative. A temporary server-maintained compatibility projection is permitted only behind a named feature flag, with deterministic IDs and the same transaction. Random slot documents and client slot repair are forbidden.
- The migration starts with a read-only dry run over an authorized export or disposable fixture. It reports schema variants, invalid times, missing resources/timezones, duplicate intervals, orphan slots, and overlapping occupancy without modifying data.
- Automatic migration is idempotent and only upgrades records with an unambiguous resource, timezone, interval, and lifecycle mapping. Every migrated record keeps legacy source IDs and a migration version.
- Ambiguous, overlapping, invalid, or orphaned data is quarantined for explicit review. Migration never deletes, merges, cancels, or silently rewrites historical evidence.
- Dual-write remains enabled until all active readers use v2 and reconciliation reports zero unexplained differences. Disabling it and removing legacy paths require a separate reviewed decision.

### Stable error set

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_ARGUMENT` | Request shape or a field outside a more specific validation category is invalid |
| 400 | `INVALID_DATE` | `localDate` is malformed or is not a real calendar date |
| 400 | `INVALID_TIME` | Local start is malformed, not a five-minute bucket start, nonexistent, or ambiguous |
| 400 | `INVALID_DURATION` | Derived duration is non-positive, excessive, or crosses the initial same-day boundary |
| 400 | `INVALID_IDEMPOTENCY_KEY` | `Idempotency-Key` is missing or malformed |
| 401 | `UNAUTHENTICATED` | A command requiring identity has no valid verified Firebase token |
| 403 | `FORBIDDEN` | Verified caller lacks customer or current shop-owner authority |
| 404 | `SHOP_NOT_FOUND` | Shop does not exist or is inactive |
| 404 | `BOOKING_NOT_FOUND` | Booking does not exist or is not visible to the caller |
| 404 | `SERVICE_NOT_FOUND` | A requested authoritative service does not exist or is inactive |
| 404 | `EMPLOYEE_NOT_FOUND` | A requested stable employee ID does not exist in the shop roster |
| 409 | `SLOT_CONFLICT` | One or more required occupancy buckets are already owned |
| 409 | `IDEMPOTENCY_KEY_REUSED` | The idempotency key was reused with different canonical intent |
| 409 | `BOOKING_VERSION_CONFLICT` | `expectedVersion` is stale |
| 409 | `INVALID_STATUS_TRANSITION` | Lifecycle transition is not allowed |
| 409 | `BOOKING_MIGRATION_REQUIRED` | A legacy booking cannot be mutated safely until its shape is migrated or reviewed |
| 422 | `SHOP_RESOURCE_CONFIG_REQUIRED` | Employee roster identities are malformed or otherwise not deterministic |
| 422 | `OUTSIDE_AVAILABILITY` | Interval violates authoritative employee/shop availability or a date exception |
| 422 | `SHOP_TIMEZONE_REQUIRED` | Shop has no valid authoritative IANA timezone |
| 422 | `EMPLOYEE_UNAVAILABLE` | Requested or auto-selected employee candidates cannot serve the interval/services |
| 500 | `INTERNAL` | Unexpected server failure with no sensitive details |

Codes are API contract. UI text may change, but callers must branch only on code. `retryable` is explicitly set by the server: validation, authorization, not-found, conflict, migration, and configuration errors are `false`; `INTERNAL` may be `true` only when replaying the same command with the same idempotency key is safe. Internal SDK/provider errors are mapped to this set at the boundary.

## Minimum emulator acceptance matrix

The following must pass under the pinned Node 20 runtime and a clearly disposable Firebase project before any live activation:

| Area | Required proof |
| --- | --- |
| Export and envelope | Only `createBookingV2`, `cancelBookingV2`, and `rescheduleBookingV2` are required initially; success/error and replay envelopes exactly match this ADR |
| Guest create | Valid guest intent creates one schema-v2 booking, every intersecting bucket, one command result, and outbox records atomically |
| Authenticated create | Verified UID is captured as `customerUid`; body identity fields cannot override it |
| Legacy identity binding | Verified normalized token email may bind an unowned legacy/guest booking once; wrong email, conflicting UID, and request-body spoofing fail |
| Idempotent retry | Same key and intent returns the original `commandId`/booking with `replayed: true`; different intent returns `IDEMPOTENCY_KEY_REUSED` |
| Concurrency | At least 20 simultaneous creates for the same resource/interval yield exactly one bucket owner per resource and deterministic results |
| Interval coverage | A seven-minute duration reserves both intersecting buckets; adjacent exact intervals behave half-open; a cross-midnight interval returns `INVALID_DURATION` |
| Resource preference | Requested eligible employee wins; missing, invalid, ineligible, and busy requested employees map to the specified stable errors without fallback |
| Resource auto-allocation | No preference tries sorted active stable employee IDs and atomically chooses the first available candidate |
| Resource fallback | Only an intentionally empty roster uses `shop:{shopId}:primary`; malformed or missing stable roster IDs return `SHOP_RESOURCE_CONFIG_REQUIRED` |
| Cancel authorization | Missing token, wrong customer, body spoofing, and non-owner requests fail; bound customer or current authoritative owner succeeds |
| Cancel atomicity | Success enters `cancelled`, increments version, releases only owned buckets, and writes outbox; injected failure changes nothing |
| Reschedule authorization | Same negative and positive identity matrix as cancel |
| Reschedule atomicity | Conflict leaves old interval owned and booking unchanged; success moves all buckets and increments version once |
| Versioning | Two mutations with one expected version produce one success and one `BOOKING_VERSION_CONFLICT` |
| Lifecycle | The five named statuses and allowed edges succeed; every missing edge returns `INVALID_STATUS_TRANSITION`; terminal states cannot mutate |
| Transaction retry | Forced contention retries deterministic transaction code without duplicate bookings, commands, or outbox events |
| Delivery isolation | Provider failure leaves command successful; retry does not duplicate logical outbox delivery or booking mutation |
| Rules | Direct client writes to canonical bookings, occupancy, commands, and outbox are denied; permitted reads match identity and tenant |
| Time | Shop-zone conversion, DST gap/ambiguity rejection, local bucket identity, conservative intersection coverage, and same-day enforcement are deterministic |
| Legacy | Safe legacy binding/mutation is covered; ambiguous data returns `BOOKING_MIGRATION_REQUIRED`; dry run and conflict quarantine use fixtures |
| Error contract | Every public failure maps to exactly one listed code and boolean `retryable`; no SDK/provider error escapes the envelope |

Tests may use fake delivery providers only. They must not use production credentials, customer data, external email, push, live Firebase, seed, clean, deploy, or migration commands.

## Implementation and activation gates

### Safe to implement now, offline

- Request/response schemas, stable error mapping, state machine, pure time/resource/bucket functions, and deterministic IDs
- Transaction service against emulator-only repositories
- Idempotency, version, occupancy, and outbox models
- Disposable fixtures and the complete emulator acceptance matrix
- Deny-by-default Rules and required indexes, validated only in the emulator
- V2 client adapter and UI cutover behind a default-off feature flag
- Legacy adapters, reconciliation, and migration dry-run tooling against synthetic fixtures
- Runbooks that contain placeholders instead of project IDs, credentials, or live commands

### User or authorized live-data decisions required

- Exact non-production and production Firebase projects, deployed regions, Functions, Rules, indexes, Storage Rules, and Auth providers
- Explicit authorization before any project access, deploy, export, migration, live query, or traffic change
- Shop IANA timezones, stable employee roster IDs, intentionally empty-roster semantics, service durations, buffers, lead times, and cancellation/reschedule policy
- Approval of normalized verified-token email as the one-time binding rule for unowned guest/legacy bookings
- Guest abuse controls, rate limits, App Check posture, and retention/privacy requirements
- Read-only inventory of legacy schema variants, overlaps, orphan slots, statuses, and active booking volume
- Approved migration conflict policy, rollback point, compatibility window, launch cohort, monitoring, and kill switch

Until these gates are resolved, the v2 feature flag stays off, deployment commands are not run, and legacy data is not touched.

## Consequences

### Positive

- Deterministic bucket ownership plus Firestore transaction retries closes the duplicate-booking race.
- Three explicit versioned exports share one domain contract, making authorization, time interpretation, and validation testable without inventing an additional router.
- Sorted stable employee IDs make no-preference allocation reproducible and testable.
- Idempotency removes ambiguous double-click and network-retry outcomes.
- Optimistic versioning makes concurrent customer/shop edits explicit.
- Outbox delivery separates booking correctness from unreliable notification providers.
- Read-only dry runs and quarantine preserve historical evidence instead of hiding conflicts.

### Costs and tradeoffs

- A booking reserves multiple documents, increasing transaction reads/writes with duration. The maximum duration must keep transactions within Firestore limits and acceptable cost.
- Conservative five-minute coverage can reserve a few minutes beyond an exact non-multiple duration, reducing theoretical capacity while preventing under-reservation.
- Sorted first-available allocation is deterministic but can bias demand toward lower-sorted employee IDs.
- Cross-midnight appointments are intentionally unsupported in the initial offline contract.
- One-time normalized-email binding permits guest self-service after sign-in, but must never replace an existing `customerUid` and needs explicit product approval before activation.
- Dual-read and compatibility projection increase temporary complexity and require reconciliation.
- Production rollout cannot finish without product policy, authorized Firebase evidence, a migration review, and emulator/browser receipts.

## Three-commit rollout

1. **`docs/booking-v2-contract-and-domain`**: land this ADR, canonical schemas, pure validators, state machine, resource/time/bucket functions, stable errors, and isolated unit tests. No Firebase or UI activation.
2. **`feat/booking-v2-emulator-backend`**: add `createBookingV2`, `cancelBookingV2`, and `rescheduleBookingV2`, verified-token authorization and legacy binding, transaction repositories, deterministic employee allocation/occupancy, idempotency/versioning, outbox, deny-by-default Rules/indexes, legacy adapter, migration dry run, disposable fixtures, and the emulator acceptance matrix. Keep the feature flag off; defer `getBookingAvailabilityV2`.
3. **`feat/booking-v2-client-cutover`**: switch active create, cancel, and reschedule UI paths to the three v2 exports, remove direct client booking/slot mutations from those paths, add browser and accessibility tests, run reconciliation, and add the activation/rollback runbook. Live deployment, migration, and flag activation remain separately authorized operations, not implicit commit steps.

## Residual decisions

- Approve the one-time normalized-email binding policy and decide whether a stronger guest claim/recovery flow must replace it later.
- Choose authoritative shop timezones, stable employee IDs, intentionally empty-roster semantics, service/buffer constraints, and policy defaults.
- Set the maximum booking duration and guest-create abuse controls.
- Define a later cross-midnight and repeated-DST-time contract before enabling either case.
- Decide how long the compatibility projection remains and what reconciliation threshold permits retirement.
- Approve a conflict policy only after an authorized dry-run inventory shows the real legacy shapes and overlaps.
