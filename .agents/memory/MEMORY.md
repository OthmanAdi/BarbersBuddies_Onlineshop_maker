# BarbersBuddies durable memory

Updated: 2026-09-01, Europe/Berlin

## Baseline

- Canonical revival worktree: this repository on branch `codex/barbersbuddies-revival`.
- Knowledge baseline: commit `61132dc366e4e30edc9c8a69cde64b010cbb09c4`.
- The attached non-Git `BarbersBuddies_Onlineshop_maker-main` snapshot had no newer shared source after normalized comparison. This Git worktree is the implementation target.
- Architecture: React 18 Create React App client, Firebase Web SDK, Firebase Functions, Firestore Rules/indexes, and Firebase Hosting.
- Package boundaries are separate: root client and `functions/` each have their own manifest and lockfile. Functions declares Node 20.
- Durable technical research lives in `docs/knowledge/`. Graphify navigation lives in `graphify-out/`.

## Decisions

- Work offline by default. Firebase emulators are the first runtime boundary; production Firebase access, mutation, and deployment require explicit authorization for the exact target.
- Treat `functions/index.js` as the Functions composition root. Do not activate alternate backend copies without deployment evidence and a migration decision.
- Booking v2 is a server-authoritative, idempotent command API with deterministic occupancy and a durable notification outbox. Guest create is allowed; cancel and reschedule require a verified Firebase identity, with a one-time reviewed normalized-email binding for unowned legacy/guest bookings.
- Scheduling will use shop IANA timezone, civil date/time input, server-derived timestamps, and half-open `[startAt, endAt)` occupancy.
- Rules, indexes, Functions behavior, schema migration, and UI callers must change behind emulator-backed contract tests, not as isolated client patches.
- Existing data is evidence. Migrations need dry-run output and must not silently delete, merge, or reinterpret historical records.
- Keep dependency modernization separate from booking correctness. Upgrade one compatibility boundary at a time after coverage exists.
- Use revision-pinned knowledge artifacts and label claims `Observed`, `Inferred`, or `Unknown`.

## Known critical defects at the pinned baseline

- Booking availability uses a non-transactional query followed by a random-ID slot write; concurrent requests can claim the same time.
- The booking client contains a non-interpolated endpoint string, while the server writes a different booking shape and does not check slot vacancy.
- Email failures can occur after a booking commit, causing ambiguous client failure and duplicate retry risk.
- Reschedule can reference an undefined appointment, invoke the server twice, and does not atomically move occupancy.
- Client and server status sets, booking fields, date representations, and authorization identifiers disagree.
- State-changing HTTP Functions use CORS but have no observed Firebase ID-token authorization boundary.
- Checked-in Rules have no match for several client-used collections, including `bookedTimeSlots`, `tempShops`, and `shopDrafts`.
- User role/subscription data, public shop employee/token data, invite redemption, and FCM token updates require a focused authorization redesign.
- No tracked Storage Rules file exists.
- The only tracked client test is a stale CRA starter assertion; no booking, Functions, Rules, emulator, concurrency, or browser suite exists.
- A tracked seed configuration contains demo credential values. Never reproduce them; replace and rotate through a dedicated security process.

## Current receipts

- On 2026-09-01, `npm ci --ignore-scripts` completed in both package boundaries under host Node `v24.12.0` and npm `11.6.2`.
- That host Node major does not satisfy the Functions package Node 20 declaration, so it is install evidence, not Functions compatibility proof.
- Initial registry audits reported 96 root advisories (7 critical, 42 high) and 25 Functions advisories (3 critical, 13 high). After pinning local emulator/test dependencies, the root count changed to 96 (6 critical, 40 high) and Functions remained 25. Counts are time-sensitive; no automatic audit fix was authorized.
- The Graphify code-only graph contains 699 nodes and 1,123 post-build edges. It is navigational only: health checks reported dangling endpoints, self-loops, collapsed same-endpoint edges, and a partial parse of `src/components/ClientManagementDashboard.js`.
- `npm run build` passed on Node 24.12.0. The legacy full CRA test command still fails before assertions with `TextDecoder` in the Firebase Auth/undici path, while the new focused `src/api/bookingCommands.test.js` passed 13/13 without Firebase imports.
- Isolated domain tests passed 17/17 under local Node 22.20.0. Time, Rules, and transactional create/emulator work are active and are not yet emulator proof.
- Seed hardening now uses generated local-only credentials and fails closed unless both Auth and Firestore emulator hosts are local and the project ID begins `demo-`; it has static/in-memory guard receipts only, not an emulator seed receipt.

## Blockers and required product input

- Exact Firebase project, Hosting targets, Functions region/runtime, deployed Functions, Rules, indexes, Storage Rules, and Auth providers are unknown.
- Production credentials and access are intentionally unavailable. Wait for the user; do not use browser automation to enter their Google account without a new explicit request.
- The offline contract requires an authoritative IANA shop timezone and rejects DST gaps/ambiguous starts. Actual shop timezones and repeated-DST disambiguation policy remain undecided.
- Capacity may be per shop, employee, chair, or pooled resource; the source is inconsistent.
- Service duration, buffers, lead time, cancellation/reschedule policy, anonymous-booking abuse controls, and historical schema migration policy need product decisions or redacted data evidence.
- Existing production duplicates, orphan slots, drafts, temp shops, and schema variants are unknown.

## Continuation point

Finish and review the active time, Rules, and transactional create slices. Then add cancel/reschedule transaction services and HTTP export integration, run the disposable Auth/Firestore/Functions emulator matrix under the declared runtime, and only then cut the UI over from direct slot writes. Keep the v2 feature flag off and do not request production access until the offline gates are recorded.
