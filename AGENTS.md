# BarbersBuddies agent instructions

## Mission

Revive BarbersBuddies as a reliable shop-creation and appointment-booking product. Correctness, tenant isolation, recoverable writes, and evidence come before visual polish or broad dependency upgrades.

This repository is currently a React 18 Create React App client plus a Firebase backend. The browser uses Firebase Auth, Firestore, Storage, Analytics, and Functions directly. Firebase deploys `functions/index.js`, `firestore.rules`, `firestore.indexes.json`, and the CRA `build/` output.

## Start here

1. Read this file and any nearer `AGENTS.md` or `CLAUDE.md` before editing.
2. Read [llms.txt](llms.txt) for the repository map.
3. Read [docs/knowledge/README.md](docs/knowledge/README.md) and the knowledge artifact for your scope.
4. Read [.agents/memory/MEMORY.md](.agents/memory/MEMORY.md) for durable decisions, blockers, and the continuation point.
5. Record `git status --short --branch` and `git rev-parse HEAD`. The knowledge set is pinned to revision `61132dc366e4e30edc9c8a69cde64b010cbb09c4`; treat it as stale wherever current source differs.
6. Preserve unrelated and concurrent edits. Use a separate worktree or a disjoint file ownership boundary for parallel write work.

## Architecture entry points

- Browser composition: `src/index.js`, `src/App.js`
- Firebase Web SDK boundary: `src/firebase.js`
- Public booking flow: `src/components/ShopLandingPage.js`, `src/components/BookNow.js`
- Customer appointment mutations: `src/components/AppointmentCard.js`, `src/components/AppointmentRescheduleModal.js`, `src/components/MyAppointments.js`
- Owner calendar and booking views: `src/components/ShopCalendarTab.js`, `src/components/ClientManagementDashboard.js`
- Shop creation and drafts: `src/components/CreateBarberShop.js`, `src/components/useBarberShopPersistence.js`, `src/components/EmployeeManagementStep.js`
- Deployed Functions composition root: `functions/index.js`
- Rules and indexes: `firestore.rules`, `firestore.indexes.json`
- Deployment topology: `firebase.json`, `.firebaserc`
- Package boundaries: `package.json` and `functions/package.json` with separate lockfiles

Do not treat `functions/firebase-functions.js` or `src/components/messaging.js` as deployed entry points. Static research found them dormant or misplaced. Do not delete them without runtime and deployment evidence.

## Firebase safety gate

Offline is the default.

- Do not connect to, query, mutate, seed, clean, deploy, or configure a live Firebase project without explicit user authorization for the exact project and action.
- Do not run `npm run seed`, `npm run seed:clean`, `firebase deploy`, migration scripts, or any script that uses Admin credentials during ordinary setup or validation. `seed:clean` is destructive.
- Emulators must use a clearly non-production project ID and disposable data. Confirm the active alias before starting them.
- Do not infer deployed Functions, Rules, indexes, Storage rules, Auth providers, or schemas from checked-in files. Source and deployment state are separate evidence classes.
- Production Firebase work remains blocked until the user supplies or authorizes the necessary access. Prefer asking for redacted metadata and a non-production project.
- Never weaken Rules or make private draft, token, staff, or booking collections public to make a client flow pass.

## Secrets and sensitive data

- Never read, print, copy, summarize, index, commit, or send `.env*`, service-account JSON, private keys, access tokens, refresh tokens, customer data, employee data, or credential values.
- Firebase browser configuration is not a server secret, but still do not reproduce local values in logs or documentation.
- A tracked seed configuration at the pinned revision contains demo credential values. Do not reproduce them. Replace them with non-secret fixtures or environment references in a dedicated security change, and require rotation if they were used outside disposable data.
- Keep seed paths, credential files, screenshots, generated media, dependency trees, build output, and Firebase cache files out of knowledge extraction and Graphify corpora.
- If a command unexpectedly emits a secret, stop, redact the retained evidence, and report the path and exposure class without repeating the value.

## Source-trust hierarchy

Use evidence in this order:

1. Current tracked source at the exact inspected commit.
2. Current command receipts from the same worktree and runtime.
3. Emulator receipts from a named disposable project.
4. Authorized deployment metadata and production-safe observations.
5. Revision-pinned `docs/knowledge/` artifacts.
6. Graphify output and durable memory as navigation aids.

Graph output, old documentation, screenshots, comments, filenames, and memory are not authoritative behavior. Verify every material claim in source, a focused test, or an authorized runtime receipt. Label findings `Observed`, `Inferred`, or `Unknown`.

## Booking invariants

All booking work must converge on these invariants:

1. Server-authoritative commands own create, reschedule, cancel, confirm, and complete transitions. Create may be an anonymous guest command; cancel and reschedule require a verified Firebase identity.
2. One active booking owns exactly one deterministic resource-occupancy record. A cancelled booking owns none.
3. Booking and occupancy change atomically in a Firestore transaction or equivalent serialization boundary.
4. The transaction validates the authoritative shop, customer, resource, employee, services, duration, buffer, availability, transition, and vacancy.
5. Retries reuse a caller-provided idempotency key and return the original result. Double clicks and network retries must not create another booking.
6. Email, push, and notification delivery use a durable outbox. A delivery failure must not turn a committed booking into an ambiguous client failure.
7. Cancellation and rescheduling authorization derives from a verified Firebase UID and authoritative documents, never from request-body email, role, owner ID, or CORS. A guest/legacy booking may bind once to a verified UID only through the reviewed normalized-email rule.
8. The browser renders server results and never directly creates or repairs slot ownership.
9. Status values and allowed transitions live in one contract shared by Functions, Rules, migration, and UI tests.
10. Historical conflicts are reported through a dry-run migration. Never delete or silently rewrite overlapping records.

## Time model

The target scheduling model is explicit and zone-aware:

- Every shop or bookable location has a valid IANA `timeZone`.
- Customer input is a civil `localDate` (`YYYY-MM-DD`) plus `localStartTime` (`HH:mm`) interpreted only in the shop zone.
- The server resolves civil input to Firestore `startAt` and `endAt` timestamps.
- Occupancy is half-open: `[startAt, endAt)`. Adjacent appointments may touch at the boundary but may not overlap.
- `endAt` includes immutable service duration and buffer snapshots. UI slot increments do not define occupancy duration.
- Weekly availability is local wall-clock time. Date exceptions explicitly close, replace, or add intervals.
- DST gaps are rejected. Repeated DST times require an explicit offset or disambiguation policy.
- Do not use `toISOString()` to derive a shop-local date. Do not rely on the browser, developer machine, or Functions host timezone.

The authoritative timezone, capacity model, lead time, buffer, cancellation policy, guest-abuse controls, and legacy-data migration policy are unresolved product inputs. Do not invent them in a migration or deployment.

## Commands and evidence

Run commands from the repository root unless a command changes location. Keep the root and Functions dependency graphs separate.

Current deterministic install commands:

```powershell
npm ci --ignore-scripts
Push-Location functions
npm ci --ignore-scripts
Pop-Location
```

Current client gates:

```powershell
npm test -- --watchAll=false --runInBand
npm run build
```

Current Functions static syntax gate:

```powershell
Get-ChildItem -LiteralPath functions -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

The Functions package declares Node 20. Do not treat results under another Node major as a compatibility receipt.

The repository currently exposes this Functions-only emulator script:

```powershell
Push-Location functions
npm run serve
Pop-Location
```

That command requires an available Firebase CLI and a confirmed disposable project. It is not a full rules, Auth, Storage, or booking integration gate.

The reproducible integration gate is being assembled with pinned local `firebase-tools`. Do not claim an emulator pass until the committed emulator configuration and test scripts have run under the declared Functions runtime. Its intended shape is:

```powershell
npx --no-install firebase emulators:exec --project <DISPOSABLE_PROJECT_ID> --only auth,firestore,functions "npm run test:emulator"
```

Do not replace the disposable-project placeholder or claim this gate passes until the emulator stanza and `test:emulator` script are committed and the full suite has a receipt.

For each change, separate receipts into:

- static: parsing, type/lint checks, source inspection
- isolated: pure unit tests without Firebase
- build: production bundle compilation
- emulator: Functions, Rules, Auth, Storage, concurrency, and schema behavior
- browser: user journey, accessibility, responsive layout, and error states
- deployment: authorized remote configuration and deploy metadata
- production: explicitly authorized, non-destructive live observation

`npm audit` is time-sensitive. Save counts and affected package paths, do not run `npm audit fix` or `--force` as an unreviewed repair.

## File ownership and change discipline

- Root client work owns only the assigned `src/` feature files and their focused tests.
- Backend work owns only assigned `functions/` modules and backend tests.
- Data-policy work owns `firestore.rules`, `firestore.indexes.json`, emulator fixtures, and matching rules tests as one change set.
- Agent-workspace work owns `AGENTS.md`, `llms.txt`, `.agents/`, and `docs/knowledge/`.
- Dependency modernization owns one manifest/lockfile boundary at a time.
- No two agents edit the same file concurrently. Do not revert, reset, stash, or reformat another worker's changes.
- Make the smallest defensible change. Keep booking contract, Functions migration, Rules/indexes, dependency updates, and UI redesign in separate logical commits with focused receipts.
- Do not remove dormant code, migrations, configuration, or data unless deletion was explicitly approved and runtime evidence shows it is unused.

## Graphify

The current graph is at `graphify-out/graph.json`; its report is `graphify-out/GRAPH_REPORT.md` and its visual is `graphify-out/graph.html`.

Prefer narrow navigation before broad reads:

```powershell
graphify query "Where is booking creation owned?" --budget 2000
graphify explain "BookNow"
graphify affected "createBooking" --depth 2
graphify path "BookNow" "createBooking"
graphify diagnose multigraph --graph graphify-out/graph.json
```

The current graph has known extraction defects, including dangling endpoints and a partial parse of `ClientManagementDashboard.js`. Verify graph answers in source.

Do not run `graphify update .` or a new extraction until a reviewed `.graphifyignore` excludes seed configuration, `.env*`, credential files, dependencies, generated output, caches, docs/media that may contain personal data, and other sensitive paths. After that gate, the refresh sequence is:

```powershell
graphify extract . --code-only --out .
graphify diagnose multigraph --graph graphify-out/graph.json
graphify export html --graph graphify-out/graph.json --labels graphify-out/.graphify_labels.json
graphify benchmark graphify-out/graph.json
```

Review `graphify-out/manifest.json` by path only before retaining outputs. Never open or echo excluded secret-bearing files to validate exclusion.

## Codebase Knowledge Builder refresh contract

Refresh `docs/knowledge/` when HEAD differs materially from its pinned revision or when a feature boundary changes:

1. Record repository path, remote, branch, exact commit, dirty state, included scope, excluded scope, and research question.
2. Read all applicable `AGENTS.md` and `CLAUDE.md` files.
3. Exclude secrets, credentials, personal data, dependency trees, generated output, media, and live systems unless explicitly authorized.
4. Trace composition roots, dependency direction, persistence, happy path, error path, edge path, authorization, configuration, and tests.
5. Distinguish `Observed`, `Inferred`, and `Unknown`; attach exact `path:line` evidence to material statements.
6. Preserve unresolved product and deployment questions. Do not turn assumptions into decisions.
7. Update the affected artifact and `docs/knowledge/README.md`, including the new pinned revision and validation performed.
8. Validate every relative Markdown link, run `git diff --check`, and record commands that were not run.

## Durable memory

Project memory lives at [.agents/memory/MEMORY.md](.agents/memory/MEMORY.md). Keep only durable facts, decisions, blockers, evidence pointers, and one explicit continuation point. Do not copy chat transcripts, credentials, personal data, or speculative conclusions into memory. Update it when a decision changes or a milestone produces a reusable receipt.
