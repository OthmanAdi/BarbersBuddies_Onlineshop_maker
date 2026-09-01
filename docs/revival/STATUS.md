# BarbersBuddies Revival Status

## 2026-09-01: source selection and protected implementation boundary

- Selected `C:\Users\oasrvadmin\Documents\BarbersBuddies` as the canonical source because it is the real Git checkout at `61132dc366e4e30edc9c8a69cde64b010cbb09c4` on `main` tracking `origin/main`.
- Verified the attached `BarbersBuddies_Onlineshop_maker-main` folder is a non-Git snapshot with no unique shared source after line-ending normalization.
- Fetched `origin`; the observed `origin/main...HEAD` divergence was `0 0`.
- Preserved the original checkout, including its pre-existing untracked state, and created the clean implementation worktree on `codex/barbersbuddies-revival`.

## 2026-09-01: architecture and agent knowledge harvest

- Installed and applied the requested Codebase Knowledge Builder workflow against a tracked, secret-safe corpus pinned to the source revision above.
- Added source-cited knowledge artifacts under `docs/knowledge/` and agent-operating guidance in the concurrently owned workspace files.
- Built a sanitized Graphify code graph from 165 tracked code files. It has 699 nodes, 1,123 post-build edges, 85 labeled communities, an HTML export, and a benchmark reporting roughly 4.5x context reduction.
- Graphify diagnostics found 566 dangling endpoints, five self-loops, and collapsed endpoints. Its partial parse near `src/components/ClientManagementDashboard.js` is tool-specific because the CRA production build accepts that file. The graph is navigation support, not behavioral proof.

## 2026-09-01: dependency and build baseline

- `npm ci --ignore-scripts` completed at the repository root: 1,785 packages added and 96 audit advisories (14 low, 33 moderate, 42 high, 7 critical).
- `npm ci --ignore-scripts` completed in `functions`: 264 packages added and 25 audit advisories (1 low, 8 moderate, 13 high, 3 critical).
- `npm run build` completed on the Node 24.12.0 host. It emitted hook, unused-variable, accessibility, Tailwind, legacy Babel-preset, and bundle-size warnings; the main bundle is about 1.21 MB gzipped.
- `npm test -- --watchAll=false --runInBand` failed before any assertion with `ReferenceError: TextDecoder is not defined` in the Firebase Auth/undici import path under Node 24 and the legacy CRA/Jest stack.
- Functions `npm ls --all` and `node --check` for all four tracked Functions JavaScript files passed on the host. No Functions test script exists, and Node 20 runtime behavior remains unverified.

## 2026-09-01: booking v2 foundation in progress

- ADR 001 now freezes the offline command contract: named `createBookingV2`, `cancelBookingV2`, and `rescheduleBookingV2` exports; a uniform safe envelope; guest create; verified identity for cancel/reschedule; deterministic allocation and five-minute occupancy; idempotency; versioning; IANA-zone intervals; and a durable outbox. It remains proposed for offline implementation and live activation is blocked.
- The integrated pure booking domain/time suites pass 36/36 under local Node 22.20.0. They cover stable public errors, lifecycle edges, operation-scoped idempotency identifiers, deterministic roster candidates, five-minute occupancy, IANA-zone conversion, DST rejection, exact half-open boundaries, buffer handling, and availability exceptions.
- The focused browser command adapter passes 20/20 isolated CRA tests plus lint. It validates the canonical success envelope, permits guest create, requires identity/version for mutations, and accepts exactly the ADR's 21 server error codes. It contains no Firebase import, so this receipt does not repair the legacy Firebase/Jest `TextDecoder` failure.
- Pinned local test tooling now includes `firebase-tools@15.28.2`, `@firebase/rules-unit-testing@3.0.4`, and `@js-temporal/polyfill@0.5.1`. Local Firebase CLI 15.28.2 runs with local Node 22.20.0; this is tooling availability, not an emulator receipt or a runtime migration.
- Seed configuration was hardened to generate local demo credentials and fail closed unless both Auth and Firestore emulators are local and the project starts with `demo-`. Static and in-memory guard checks passed. No seed command, emulator, or live Firebase action was run.
- The Firestore Rules/index harness passes 25/25 in the Firestore emulator for disposable project `demo-barbersbuddies`. Direct client writes to booking infrastructure are denied; participant/authoritative-owner reads and owner-ID hardening are covered. This is not Auth/Functions or full-flow emulator proof.
- Transactional create/backend tests remain active parallel work and are not yet accepted as integrated proof.

## Current truth

- Browser, Auth/Functions emulator, integrated booking-flow, deployment, and production Firebase flows are unverified. Firestore Rules alone have a disposable-emulator receipt.
- The original booking race, duplicate, timezone, authorization, rules, and store-creation defects remain unrepaired in the active UI and deployed path. V2 work is additive and not yet wired into `functions/index.js` or booking screens.
- Seed hardening is ready for review but has no emulator seed receipt. No credential values are recorded here.
- `npm audit fix` and force upgrades have not been run because suggested remediations include major migrations and removal-like changes.

## Continuation point

Accept the active transactional-create slice against ADR 001. Then implement cancellation/rescheduling transactions and HTTPS export wiring, run the disposable Auth/Firestore/Functions emulator matrix under Node 20, and only then replace direct browser booking/slot writes.
