# Build, Tests, and Dependency Contracts

## Provenance

- **Repository:** BarbersBuddies revival worktree
- **Source URL:** `https://github.com/OthmanAdi/BarbersBuddies---the-5-minutes-Barbershop-Online-Shop-Launcher.git`
- **Inspected revision:** `61132dc366e4e30edc9c8a69cde64b010cbb09c4`
- **Branch/state:** `codex/barbersbuddies-revival`; pre-existing untracked `graphify-out/` was observed and not inspected or changed.
- **Observed at:** 2026-09-01, Europe/Berlin
- **Research question:** What package, runtime, build, test, toolchain, and dependency-risk contracts must guide a safe revival?
- **Included scope:** Tracked manifests, lockfiles, build configuration, test files, entry surfaces, Firebase deployment configuration, and static import/reference searches.
- **Excluded scope:** `node_modules`, generated output, `.env*` contents, service-account files, live Firebase state, network/registry lookups, installs, builds, tests, emulators, and deployments.
- **Evidence method:** Read-only source inspection at the pinned revision. No target command was executed.
- **Validation performed:** Static manifest-to-lock root entry comparison found no declared dependency or devDependency differences for either package boundary. `resolved` and `integrity` counts matched within each lockfile (root 1,786; Functions 264).
- **Redactions:** No environment/configuration values, credentials, tokens, or service accounts were read or recorded.
- **Overall confidence:** High for static package and script facts; low for current install/runtime behavior until the validation plan is run.

## Executive Summary

**Observed:** The repository has two separately locked Node dependency graphs, not a workspace: a Create React App client at the root and a first-generation Firebase Functions package in `functions/`. The root scripts are limited to CRA start/build/test plus a privileged demo-data seeder. Functions declares Node 20 and relies on an ambient Firebase CLI for local serving and deployment. There is one tracked UI test, a stale CRA starter assertion, and no tests for booking, calendar, duplicate-booking protection, Firestore rules, Cloud Functions, or browser workflows.

**Observed:** The dependency graph carries direct deprecation markers for `react-beautiful-dnd` and `dnd-kit`, as well as older transitives introduced by the legacy CRA 5 toolchain. The client lock also contains a peer-installed Admin SDK associated with its direct `firebase-functions` package, while deployed Functions uses a distinct, materially older Functions/Admin SDK pair.

**Inferred:** The safest revival sequence is to make the two runtime boundaries reproducible, build a booking-invariant test harness against Firebase Emulator Suite, then modernize dependencies in small compatibility-verified slices. A framework or Firebase SDK upgrade before that coverage exists would combine product-risk changes with toolchain-risk changes.

## Architecture and Boundaries

| Component or boundary | Responsibility | Evidence label | Evidence | Confidence |
| :--- | :--- | :--- | :--- | :--- |
| Root package | CRA client runtime, build, test, and seed command boundary | Observed | `package.json:2-4`, `package.json:67-75` | High |
| Client composition | Mounts `App` under `React.StrictMode` and the React Buddy dev toolbox | Observed | `src/index.js:1-18` | High |
| Firebase Web client | Initializes Auth, Firestore, Storage, Analytics, and callable Functions clients from `REACT_APP_*` config names | Observed | `src/firebase.js:1-35` | High |
| Functions package | Firebase deployment source with `index.js` main and Node 20 declaration | Observed | `firebase.json:96-102`, `functions/package.json:11-20` | High |
| Hosting | Serves CRA `build` output with SPA rewrites for two hosting targets | Observed | `firebase.json:35-47`, `firebase.json:50-93` | High |
| Seed path | Privileged Node script requiring Admin SDK credentials from a root-level service-account path | Observed | `package.json:73-74`, `scripts/seed/index.js:21-48` | High |

### Build and runtime path

1. **Observed:** `npm start`, `npm run dev`, and `npm run build` invoke `react-scripts`; the lock resolves it to `5.0.1` (`package.json:68-72`, `package-lock.json:18847-18889`).
2. **Observed:** The root browser code imports the Firebase *Web* SDK from `firebase/*` and initializes a Functions client with `getFunctions(app)` (`src/firebase.js:1-35`).
3. **Observed:** Firebase deployment selects `functions/` as the only Functions source; Firebase's package entry is `functions/index.js` (`firebase.json:96-102`, `functions/package.json:14`).
4. **Observed:** Functions scripts use `firebase` commands, but neither tracked `package.json` declares `firebase-tools` (`functions/package.json:4-22`, `package.json:94-96`). The CLI therefore currently depends on an unpinned global/tooling environment.
5. **Unknown:** Whether the local Node/npm installation, globally available Firebase CLI, current Firebase projects, and deployed Functions runtime can execute this path. No execution was authorized for this study.

## Package and Lockfile Contract

| Boundary | Manifest contract | Resolved lock evidence | Evidence label |
| :--- | :--- | :--- | :--- |
| Root client | React `18.3.1`, Firebase Web SDK `^10.12.3`, Stripe browser SDK, CRA `5.0.1` | npm lockfile v3; Firebase resolves to `10.12.3`, `react-scripts` resolves to `5.0.1` | Observed: `package.json:5-65`, `package-lock.json:4-74`, `package-lock.json:10755-10788`, `package-lock.json:18847-18889` |
| Functions | Node `20`, `firebase-admin ^10.0.0`, `firebase-functions ^3.18.0`, Mailgun, Nodemailer | npm lockfile v3; Admin resolves to `10.3.0`, Functions resolves to `3.24.1` | Observed: `functions/package.json:11-20`, `functions/package-lock.json:3-17`, `functions/package-lock.json:1216-1260` |
| Root server-oriented packages | Root declares `firebase-functions`, Mailgun, Nodemailer, and FormData | Root lock resolves Functions `6.2.0` and peer Admin `13.0.2` | Observed: `package.json:27-39`, `package-lock.json:10790-10814`, `package-lock.json:10946-10965` |

**Observed:** Each manifest's declared dependency and devDependency names/ranges exactly match its own lockfile root entry. This does not establish that `npm ci` succeeds on the current machine or that transitive versions are secure.

**Observed:** Root `firebase-functions@6.2.0` has an `firebase-admin` peer range and the lock records peer `firebase-admin@13.0.2` (`package-lock.json:10790-10814`, `package-lock.json:10946-10965`). The actual deployed Functions package locks the separate v3/v10 combination above.

**Inferred:** Treat these as two intentionally isolated compatibility boundaries until a migration plan has current official Firebase compatibility evidence. Do not deduplicate or lift the Functions versions into the root simply because packages share names.

## Test and Quality-Gate Coverage

| Surface | Current evidence | Evidence label | Consequence |
| :--- | :--- | :--- | :--- |
| Client unit test | One test renders `App` and expects `learn react` | Observed: `src/App.test.js:1-8` | It supplies no booking/calendar/auth/payment contract coverage. |
| Test runner | CRA `react-scripts test`, Testing Library and `jest-dom` setup | Observed: `package.json:14-16`, `package.json:70`, `src/setupTests.js:1-5` | No explicit coverage threshold/configuration is tracked. |
| Functions tests | No test or lint script in Functions package | Observed: `functions/package.json:4-22` | HTTP handlers, triggers, schedulers, email paths, and authorization are unprotected by a tracked gate. |
| Browser/integration tests | No tracked Playwright, Cypress, or emulator test configuration | Observed | Concurrency, retry, timing, and UI behavior remain unproven. |
| Static analysis | Qodana config selects a JavaScript linter but has no tracked invocation/CI workflow | Observed: `qodana.yaml:5-29` | Static analysis is optional/manual at present. |

**Observed:** The phrase queried by the sole test occurs only in the test file in `src`. **Inferred:** The starter assertion is likely stale and may fail; run it before editing to establish the receipt.

### Required test matrix before booking/calendar changes

| Scenario | Expected invariant | Recommended first test layer |
| :--- | :--- | :--- |
| Concurrent booking submissions | At most one booking can claim the same employee/service/time capacity | Emulator-backed Functions/Firestore integration |
| Duplicate retry / double click | Same client request is idempotent | HTTP Function integration with an idempotency key |
| Reschedule race | Old slot is released only when new slot is atomically secured | Emulator-backed transaction test |
| Cancellation vs create | No orphaned/overbooked slot under concurrent writes | Emulator-backed transaction test |
| Time zone and DST boundary | Stored instants and visible slots preserve the intended local appointment | Pure domain unit tests plus browser flow |
| Authorization | Customer/shop owner cannot create, mutate, or read another tenant's booking | Rules-unit and Functions integration tests |

The matrix is a recommendation, not evidence that such transactions or tests already exist.

## Obsolete Tooling and Dependency Risk Groups

| Group | Finding | Evidence label | Safe treatment |
| :--- | :--- | :--- |
| Drag and drop | `react-beautiful-dnd@13.1.1` is marked deprecated in the lockfile | Observed: `package-lock.json:18385-18403` | Inventory imports and replace behind component-level tests. |
| Drag and drop | `dnd-kit@0.0.2` is marked unsupported in the lockfile | Observed: `package-lock.json:9081` | Establish whether it is imported before removal; choose a maintained package only after current documentation review. |
| CRA toolchain | CRA 5 resolves old transitive tooling, including lockfile deprecation markers | Observed: `package-lock.json:18847-18889`, `package-lock.json:739`, `package-lock.json:11471`, `package-lock.json:12244` | Keep the existing build stable first; investigate a Vite/other migration only as a separately tested change. |
| Functions SDKs | Deployment uses first-generation `firebase-functions@3.24.1` with Admin `10.3.0`, whereas root carries Functions `6.2.0` and peer Admin `13.0.2` | Observed: `functions/package-lock.json:1216-1260`, `package-lock.json:10790-10814`, `package-lock.json:10946-10965` | Verify Node 20 and Firebase generation/SDK support from current official documentation before upgrade. |
| Unwired override | `config-overides.js` is misspelled and static search found no runner reference or rewiring package/script | Observed: `config-overides.js:1-87`, `package.json:67-96` | Do not assume its webpack fallbacks take effect. Confirm intended build tool before deletion or repair. |
| Unregistered migrations | `scripts/migrateShopNames.js` is not exposed by an npm script and imports `../src/firebase/config`; a second migration exists under Functions | Observed: `scripts/migrateShopNames.js:1-42`, `functions/createShopNameRecord.js:1-37`, `package.json:67-75` | Quarantine from routine commands; reconcile to a single reviewed, idempotent administrative migration. |
| Client-tree server code | `src/components/messaging.js` requires Functions and Admin SDK but static search found no importer | Observed: `src/components/messaging.js:1-6` | Confirm dead-code status before removal; never ship Admin SDK logic in a browser bundle. |

## Security-Sensitive Configuration and Libraries

| Surface | Risk-relevant observation | Evidence label |
| :--- | :--- | :--- |
| Firebase client config | Browser initialization reads named public `REACT_APP_FIREBASE_*` values; values were excluded | Observed: `src/firebase.js:20-35` |
| Payments | Stripe browser SDK is initialized from `REACT_APP_STRIPE_PUBLISHABLE_KEY` | Observed: `src/App.js:13-28`, `src/Services/stripe.js:2-18` |
| Backend credentials | Functions initialize Mailgun from Functions config/environment names; no values were read | Observed: `functions/index.js:8-21` |
| Mail delivery | Functions depend on Mailgun, Nodemailer, and FormData | Observed: `functions/package.json:15-20`, `functions/index.js:1-10` |
| Hosting policy | Both hosting targets use wildcard CSP directives, `unsafe-inline`, `unsafe-eval`, and wildcard CORS headers | Observed: `firebase.json:4-33`, `firebase.json:51-80` |
| HTTP CORS | Main Functions code has a small origin allowlist; orphan client-tree handler code sets wildcard CORS | Observed: `functions/index.js:23-37`, `src/components/messaging.js:6-15` |

**Inferred:** Hosting headers and all unauthenticated HTTP handlers should receive a focused security review before a public relaunch. This artifact does not claim a vulnerability, because deployed rules, auth checks, and production configuration were deliberately not inspected.

## Safe Migration Order

1. Preserve the current two-lockfile state and record local Node/npm/Firebase CLI versions.
2. Run deterministic installs and the existing build/test commands without dependency updates. Save the exact receipts.
3. Replace the stale starter test with a minimal smoke test, then add booking/calendar transaction and authorization coverage against emulators.
4. Make the Functions boundary reproducible by pinning or documenting Firebase CLI ownership, validating emulator behavior, and reconciling privileged scripts.
5. Remove or relocate confirmed dead client-tree server code and unregistered migration scripts in separately reviewed commits.
6. Modernize dependencies one risk group at a time: deprecated drag/drop packages, Functions/Admin SDK generation, then CRA/build tooling. Consult current primary documentation and rerun the full matrix after each group.
7. Tighten hosting CSP/CORS and validate payment/email/Firebase behavior with authorized non-production credentials.

## Validation Baseline

The following commands are **recommended and not run during this study**:

```powershell
# Record runtime/tool versions first
node --version
npm --version
firebase --version

# Deterministic dependency installation, separately per package boundary
npm ci --ignore-scripts
Push-Location functions; npm ci --ignore-scripts; Pop-Location

# Existing client gates
npm test -- --watchAll=false
npm run build

# Only after Firebase CLI/config and non-production project authority are available
Push-Location functions; npm run serve; Pop-Location
```

**Command receipts supplied to this research task, not rerun or independently reproduced in this artifact:** root dependency audit reported 96 advisories (7 critical, 42 high); Functions dependency audit reported 25 advisories (3 critical, 13 high). These figures are time-sensitive and must be refreshed with a current, authorized registry-backed audit before prioritization or remediation claims.

## Unresolved Questions

| Question | Why unresolved | Evidence needed | Impact |
| :--- | :--- | :--- | :--- |
| Do clean installs, tests, and production builds pass on this machine? | Execution was out of scope | Captured `npm ci`, test, and build receipts with Node/npm versions | High |
| Which Node/npm/Firebase CLI versions are currently installed and used for deploy? | No runtime/tool inspection in this study | Version command receipts and deployment documentation | High |
| Are Functions v3/Admin v10 supported for the declared Node 20 runtime and deployed generation? | Current external documentation was excluded | Current official Firebase compatibility documentation and emulator/deploy receipt | High |
| Which packages account for the supplied audit findings? | No registry audit output was inspected | Current `npm audit --json` receipts for both boundaries | High |
| Are booking writes transactional and protected by Firestore rules? | Rules/runtime behavior were outside this artifact's test scope | Rules inspection plus emulator concurrency tests | Critical |
| Is `src/components/messaging.js` dead code? | Static search found no importer but bundler/runtime analysis was not executed | Build graph/import audit and build receipt | Medium |
| What Firebase projects and secrets are safe for testing? | Credentials and live state were excluded | User-authorized non-production Firebase configuration | Critical |

## Evidence Index

| Evidence | Supports | Label |
| :--- | :--- | :--- |
| `package.json:5-75` | Root dependencies and scripts | Observed |
| `package-lock.json:4-74` | Root lockfile version and root manifest mirror | Observed |
| `package-lock.json:10755-10814` | Firebase Web SDK and root peer Admin SDK | Observed |
| `package-lock.json:10946-10965` | Root Functions SDK and peer dependency contract | Observed |
| `package-lock.json:18385-18403` | Deprecated `react-beautiful-dnd` | Observed |
| `package-lock.json:18847-18889` | Locked CRA build/test toolchain | Observed |
| `functions/package.json:4-22` | Functions commands, Node declaration, dependencies, main | Observed |
| `functions/package-lock.json:1216-1260` | Locked Functions/Admin SDK versions | Observed |
| `firebase.json:35-47` | Root hosting build and SPA route contract | Observed |
| `firebase.json:96-102` | Firebase Functions source and Firestore configuration files | Observed |
| `src/index.js:1-18` | Client composition | Observed |
| `src/firebase.js:1-35` | Firebase Web services boundary | Observed |
| `src/App.test.js:1-8` | Sole tracked automated test | Observed |
| `scripts/seed/index.js:21-48` | Privileged seed dependency/credential boundary | Observed |
| `functions/index.js:1-37` | Email/Functions/CORS boundary | Observed |
| Command receipt supplied to task | Time-sensitive audit counts only | Reported receipt |
