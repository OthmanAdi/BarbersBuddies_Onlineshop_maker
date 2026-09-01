# BarbersBuddies durable memory

Updated: 2026-09-01, Europe/Berlin

## Resume point

- Canonical original: `C:\Users\oasrvadmin\Documents\BarbersBuddies`, base `61132dc366e4e30edc9c8a69cde64b010cbb09c4`. Preserve its user-owned dirty state.
- Implementation: `C:\Users\oasrvadmin\Documents\BarbersBuddies-revival-worktree`, branch `codex/barbersbuddies-revival`. The professional local-access implementation is committed at `f37d6e7`.
- All requested subagents finished. Their bounded work was reviewed and committed. Do not start replacement agents for this paused run.
- No push, deployment, production Firebase access, Mailgun send, migration, or live seed occurred.
- The durable board is `C:\Users\oasrvadmin\Documents\BarbersBuddies\.planning\2026-09-01-barbersbuddies-revival`. No separate localhost board was created.

## Accepted architecture

- Booking v2 is additive, server-authoritative, and dark-gated. Create, cancel, and reschedule use strict validation, IANA civil time, half-open occupancy, transactions, idempotency, optimistic versions, safe public errors, and PII-free outbox metadata.
- Immutable event snapshots, recipient-source resolution, the Mailgun adapter, and the leased outbox worker are committed. Delivery remains at-least-once. The worker is deliberately unexported and unscheduled.
- Store v2 has strict schema, atomic idempotent create, a dark HTTP boundary, a strict frontend command client, and a safe staged-asset client. It is not yet the active legacy UI path.
- Browser booking intent identity is consolidated in `src/booking-v2/intentRegistry.js`. Legacy direct booking mutations and calendar calculations are still cutover blockers.
- Blank development resolves once at bootstrap to the disposable `demo-barbersbuddies` Firebase emulator configuration. Firebase and feature tooling consume the same frozen runtime decision.

## Professional local persona

- `src/runtime/` owns the exact `development`, `test`, or `production` decision before Firebase initialization.
- `src/dev-access/personas.js` is the immutable persona registry. The current `professional` persona is an anonymous `shop-owner` and routes to `/account`.
- `src/dev-access/demoAccessController.js` owns idempotent provisioning, race coalescing, conflict refusal, sanitized errors, and cleanup on failure.
- The persona has no password, token, or reusable credential. It writes only its own `users/{uid}` emulator profile.
- Demo access is available only for `NODE_ENV=development`, Firebase emulator mode, and a `demo-*` project. Production and live Firebase fail closed before Auth or Firestore calls.
- `npm run emulators:start` now applies the Windows-safe short Java temp path and hard-pins Auth, Firestore, Functions, and Storage to `demo-barbersbuddies`.

## Reliable receipts

- Complete CRA suite on Node 22: 351 passed, 1 opt-in emulator test skipped.
- Real Auth plus Firestore emulator persona test: 1/1 passed. It created an anonymous user, wrote the expected shop-owner profile, and verified no password field.
- Fresh headless Chrome loaded `/auth`, observed `development`, `emulator`, and `demo-barbersbuddies`, clicked **Enter professional demo**, reached `/account`, and observed no runtime or access error.
- New runtime, persona, and emulator-start modules pass ESLint with zero warnings.
- Optimized Node 22 production build exits zero. Existing warning debt remains, and the main bundle is 1.22 MB gzipped.
- Expanded Functions unit manifest passes 204/204. Previously recorded Node 20/22 booking, Rules, concurrency, Mailgun, notification, and outbox matrices remain valid for their scoped commits.
- Local services listen on app `3100`, Emulator UI `4000`, Functions `5001`, Firestore `8080`, Auth `9099`, and Storage `9199`.

## Open risks and honest limits

- GitHub issue #2, `Booking not working`, remains open and is not confirmed fixed. Local backend repairs do not equal a pushed fix or a proven public browser booking journey.
- The active legacy frontend still contains direct Firestore booking writes, unsafe calendar/time derivation, and paths not cut over to booking v2.
- Full browser journeys for store creation, booking, duplicate booking, calendar rendering, cancellation, and reschedule remain unproven.
- Production Firebase data, Rules, indexes, Auth configuration, Hosting, Functions configuration, and Mailgun delivery remain blocked until the user supplies access and authorizes those checks.
- Dependency advisories, CRA maintenance debt, broad lint/accessibility warnings, and bundle size remain tracked work. Do not run a broad automatic audit fix.

## Next action

Stop after the documentation commit and wait for the user. When explicitly resumed, begin with the full local browser booking journey for GitHub issue #2, then the store-creation journey. Keep production untouched and do not close the issue until the repaired path is pushed and reproduced through the user-facing flow.
