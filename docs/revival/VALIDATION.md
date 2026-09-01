# BarbersBuddies Revival Validation Ledger

Updated: 2026-09-01, Europe/Berlin

Each receipt is deliberately scoped. Local, unit, emulator, browser, production, and remote evidence are not interchangeable.

## Current-run gates

| Gate | Command or method | Receipt | Scope and limit |
|---|---|---:|---|
| Complete CRA suite | `CI=true`, Node 22, `react-scripts test --watchAll=false --runInBand` | 351 passed, 1 skipped | The skipped test is intentionally opt-in because it requires live local emulators |
| Professional persona emulator contract | `npm run test:demo-access:emulator` | 1/1 passed | Real local Auth and Firestore on `demo-barbersbuddies`; anonymous user plus own profile, no password field |
| New-code lint | `npx eslint --max-warnings 0 src/runtime src/dev-access scripts/start-firebase-emulators.js scripts/test-demo-access-emulator.js` | Pass, zero warnings | New runtime/persona/startup surface only |
| Optimized build | Node 22 `react-scripts build` | Exit 0 | Existing legacy lint, Tailwind, Browserslist, accessibility, and bundle-size warnings remain; main bundle 1.22 MB gzipped |
| Browser professional entry | Fresh headless Chrome DevTools session | Pass | Loaded `/auth`, confirmed exact safe runtime markers, clicked the button, reached `/account`, no runtime or access error |
| Emulator launcher | `npm run emulators:start` | All ready | Auth, Firestore, Functions, and Storage pinned to the disposable demo project; Windows short temp applied automatically |
| Secret pattern scan | Bounded scan of the staged feature patch | No known key/token/private-key patterns | Pattern scan is not a full historical secret audit |
| Patch integrity | `git diff --cached --check` | Pass | Feature commit patch only |

## Professional-access assertions

The unit and emulator tests directly establish:

- Production and live Firebase fail before any Auth or Firestore operation.
- Blank local development resolves to emulator mode and enables demo access by default.
- `REACT_APP_DEMO_ACCESS=false` disables the feature.
- Forcing demo access outside the exact safe boundary throws a stable configuration error.
- The `professional` persona is immutable, anonymous, passwordless, and typed as `shop-owner`.
- Unknown personas are rejected before authentication.
- Rapid repeated entry is coalesced into one Auth and Firestore operation.
- Matching profiles retain durable custom fixture fields.
- Conflicting profiles are not overwritten and the local session is signed out.
- Raw Firebase errors are not surfaced to the UI.
- The real emulator profile contains no `password` field.

## Browser receipt

A fresh Chrome profile loaded `http://localhost:3100/auth` and observed:

```text
path=/auth
data-app-environment=development
data-firebase-mode=emulator
data-firebase-project=demo-barbersbuddies
button=Enter professional demo
runtime-error=false
```

Chrome then clicked the button and observed:

```text
path=/account
runtime-error=false
access-error=false
```

This is genuine browser evidence for local professional entry. It is not evidence for store creation, booking, duplicate booking, calendar correctness, deployed Firebase, or production safety beyond the tested fail-closed configuration boundary.

## Previously committed core receipts

| Area | Receipt | Scope and limit |
|---|---:|---|
| Functions unit manifest | 204/204 | Current committed unit boundaries |
| Booking domain/time | 36/36 on Node 20 and Node 22 | Pure domain and IANA time rules |
| Civil-time primitives | 40/40 across four zones | No component cutover and no accepted cross-midnight policy |
| Transactional create plus mutations | 35/35 on Node 20 and Node 22 emulators | Includes overlap, replay, stale version, consent drift, and mutation races |
| Create overlap race | 20 concurrent requests: 1 success, 19 `SLOT_CONFLICT` | V2 server path only |
| Booking HTTP boundary | 27/27 on Node 20 and Node 22 | Contract rejection and response behavior, not a browser journey |
| Booking runtime gate | 15/15 on Node 20 and Node 22 | Dark-by-default policy |
| Booking index integration | 3/3 on Node 20 and Node 22 | Export/load boundary |
| Browser intent registry | Focused suite green | Consolidated durable operation identity |
| Store v2 schema | 85/85 plus adversarial checks | Additive schema, not legacy UI cutover |
| Store command and asset clients | Focused frontend suite included in 351/351 | Strict command and safe staging boundaries |
| Firestore Rules | 25/25 in disposable emulator | No production Rules comparison |
| Email templates | 16/16 on Node 20 and Node 22 | Rendering only |
| Mailgun adapter | 15/15 on Node 20 and Node 22 | Provider boundary, no live delivery |
| Leased outbox worker | Unit 10/10 and emulator 9/9 on Node 20 and Node 22 | At-least-once lifecycle, no production scheduler |

## Expected warnings and unresolved debt

- CRA and Testing Library emit React test-utils deprecation warnings.
- The optimized build reports many pre-existing unused variable, hook dependency, and accessibility warnings.
- Browserslist data is stale.
- Tailwind reports unsupported `min-*` and `max-*` variants for the current screen configuration.
- The main bundle is substantially larger than recommended.
- Firebase Functions declares Node 20 while the host emulator currently runs Node 24 and warns about the mismatch.
- The Functions SDK is old and requires a bounded breaking-change upgrade, not an automatic latest install.
- The root dependency audit still reports high and critical advisories. No broad or forced audit mutation was performed.

## Unrun gates

- Full browser store creation and persistence.
- Full browser booking through the repaired v2 path.
- Browser duplicate booking, overlap, timezone boundary, DST, and calendar display.
- Browser cancellation, reschedule, owner state transitions, accessibility, and responsive coverage.
- Production Firebase inventory, Rules/index comparison, Auth configuration, App Check, rate limiting, Hosting, and Functions configuration.
- Production data migration and duplicate/orphan reconciliation.
- Mailgun send, provider acceptance ambiguity, webhook, and delivered-message proof.
- Remote `main` integration and a clean-clone receipt. No push is authorized in this run.

## Conclusion

The professional emulator-only entry is green at unit, real-emulator, and browser levels, and the app is running locally. The broader project revival is not complete. In particular, GitHub issue #2 remains open and is not confirmed fixed until the public booking UI is cut over, proven in a browser, committed, and pushed.
