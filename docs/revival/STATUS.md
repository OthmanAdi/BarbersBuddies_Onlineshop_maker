# BarbersBuddies Revival Status

Updated: 2026-09-01, Europe/Berlin

Implementation worktree: `C:\Users\oasrvadmin\Documents\BarbersBuddies-revival-worktree`

Branch: `codex/barbersbuddies-revival`

Current implementation commit: `f37d6e7`

## Protected boundary

- `C:\Users\oasrvadmin\Documents\BarbersBuddies` remains the preserved canonical checkout at base `61132dc366e4e30edc9c8a69cde64b010cbb09c4`, including user-owned untracked material.
- The sibling snapshot was compared and was not selected as a newer source of truth.
- No remote was pushed or otherwise mutated.
- No production Firebase read, write, seed, migration, deploy, Auth change, Rules change, Hosting change, or credential use occurred.
- No Mailgun message was sent.

## Completed foundation

- The repository now contains agent guidance, `llms.txt`, a source-cited knowledge corpus, Graphify navigation artifacts, decisions, validation records, durable project memory, and an attested file-backed plan.
- Booking v2 provides additive server-authoritative create, cancel, and reschedule commands with idempotency, optimistic versions, IANA civil time, five-minute half-open occupancy, transaction conflict prevention, safe errors, and PII-free event/outbox records.
- Immutable notification snapshots, delivery-source resolution, the Mailgun boundary, and the leased outbox worker are committed. The worker remains unexported and unscheduled because provider delivery is at-least-once and production configuration is unavailable.
- Store v2 now has an authoritative schema, atomic idempotent create, dark HTTP boundary, strict frontend command client, and safe staged-asset client. Legacy UI cutover remains pending.
- Booking intent identity is consolidated into one durable registry, removing duplicate ownership between old and v2 modules.
- Blank development boot uses synchronous Firebase emulator connections and a complete non-secret `demo-barbersbuddies` configuration.

## Professional local access

Commit `f37d6e7` adds a reusable, environment-owned test persona system:

- A single frozen runtime decision is created before Firebase initialization.
- Runtime values are exact and fail closed: `development`, `test`, or `production` only.
- Demo access requires development, emulator mode, and a `demo-*` Firebase project.
- The immutable persona registry currently exposes `professional`, an anonymous `shop-owner` routed to `/account`.
- Provisioning coalesces rapid duplicate clicks, preserves matching fixture state, rejects conflicting profiles, sanitizes errors, and signs out partial failures.
- The professional persona has no password or reusable credential and writes only its own emulator user profile.
- The old hard-coded production-capable demo-email bypass was removed.
- Account and store-creation screens resolve the persona email from its Firestore profile because anonymous Auth users do not carry an email.
- The app root exposes non-secret runtime markers for diagnostics and browser proof.
- `npm run emulators:start` hard-pins the disposable project and automatically applies the Windows-safe Java temp path.

## Current evidence

| Layer | Current receipt | Limit |
|---|---|---|
| Frontend unit/component | 351 passed, 1 opt-in emulator test skipped on Node 22 | No production services |
| Demo controller | Unit tests cover production fail-closed, unknown personas, matching/conflicting profiles, sanitized failures, and click coalescing | Mocked Firebase dependencies |
| Demo emulator | 1/1 passed against real local Auth and Firestore | Disposable project only |
| Browser | Fresh Chrome observed the safe runtime, clicked the professional entry, and reached `/account` without runtime/access error | Does not prove booking or store creation |
| New-code lint | Zero warnings across `src/runtime`, `src/dev-access`, and emulator scripts | Legacy warnings remain elsewhere |
| Production build | Node 22 optimized build exits zero, 1.22 MB main bundle | Warning debt remains |
| Functions units | 204/204 | Unit layer, not deployed Functions |
| Firestore Rules | 25/25 recorded in disposable emulator | Production Rules not compared |
| Booking concurrency | Recorded 20-way overlap yields 1 success and 19 `SLOT_CONFLICT` results | V2 supported path only |

## Running locally

- React app: [http://localhost:3100](http://localhost:3100)
- Professional access: [http://localhost:3100/auth](http://localhost:3100/auth)
- Firebase Emulator UI: [http://127.0.0.1:4000](http://127.0.0.1:4000)
- Functions: `127.0.0.1:5001`
- Firestore: `127.0.0.1:8080`
- Auth: `127.0.0.1:9099`
- Storage: `127.0.0.1:9199`

## GitHub issue status

[Issue #2, `Booking not working`](https://github.com/OthmanAdi/BarbersBuddies_Onlineshop_maker/issues/2), remains open. It is not yet fixed on GitHub because:

- The repairs are local and have not been pushed.
- The active public booking UI is not fully cut over to booking v2.
- A real user-facing browser booking, including a duplicate attempt and calendar result, has not been completed.

Do not close or describe the issue as fixed until those three conditions are satisfied.

## Remaining critical work

- Cut the supported booking UI over to booking v2 without leaving direct Firestore mutation fallbacks.
- Repair and prove shop-local civil-date handling, service-duration/resource occupancy, buffers, and fail-closed availability.
- Exercise browser journeys for shop creation, booking, concurrent duplicate attempts, calendar display, cancellation, and reschedule.
- Decide production timezone, employee/resource scheduling, capacity, cancellation/consent policy, and legacy migration behavior from real data.
- Upgrade the legacy CRA/Firebase/Functions toolchain in bounded steps after critical journeys are protected.
- Triage dependency advisories without broad `audit fix --force` changes.

## Current stop boundary

All prior subagent work and the requested professional persona are integrated and committed locally. Documentation and the file-backed board are refreshed next. Then this run stops without a push and waits for the user.
