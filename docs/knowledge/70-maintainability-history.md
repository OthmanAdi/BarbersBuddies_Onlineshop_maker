# Maintainability and History Audit

**Pinned revision:** `61132dc366e4e30edc9c8a69cde64b010cbb09c4` (`61132dc`, 2026-01-06)

**Scope:** Read-only codebase-knowledge audit of dead-looking, duplicate, misspelled,
obsolete, commented-out, unreachable, and contradictory code and configuration.
This is not a deletion plan. No Firebase project, deployment, emulator, secret, or
runtime state was inspected.

## Provenance and confidence rules

- **Observed** means an import, route, package entry point, file content, or bounded
  Git history directly establishes the statement at the pinned revision.
- **Inferred** means the conclusion follows from observed structure, but an external
  caller, deployment setting, or product decision could change it.
- **Unknown** means only a Firebase deployment, production data, runtime telemetry,
  or stakeholder decision can answer it safely.

The bounded repository history contains three commits:

1. `83776e1` `Initial release - BarbersBuddies Open Source`: introduced the audited
   paths, including the frontend, Firebase functions, migration scripts, and release
   findings.
2. `2f87678` `New Demo Store-Owner & Customer accounts`: changed demo-seed files,
   `package.json`, `Auth.js`, `Footer.js`, and `ZPatternHero.js`.
3. `61132dc` `Add screenshots, demo system, and fix auth flow`: changed screenshots,
   `README.md`, and `Auth.js`.

**Observed:** Path histories for the candidates below contain only `83776e1`; neither
later commit changed them. Age alone is not evidence that a path is safe to delete.

## Entry-point model

- The browser entry is `src/index.js:1-23`, which renders `App` and always wraps it
  in `DevSupport` from `@react-buddy/ide-toolbox` at `src/index.js:6-17`.
- The declared browser routes and imported page roots are in `src/App.js:2-26` and
  `src/App.js:123-143`.
- The Firebase Functions package deploys `functions/index.js`, because
  `functions/package.json:14` declares `"main": "index.js"`.
- Root package scripts invoke `react-scripts` directly at `package.json:57-65`; they
  do not invoke a rewire/customization wrapper.

## Observed unreferenced or dormant paths

The following default exports have no non-self textual occurrence under `src`,
`functions`, or `scripts`, and none is imported or routed by the browser entry graph.
This proves they are excluded from the present static application graph, but does
not rule out a future dynamic import, external documentation instruction, or manual
reuse.

| Path and evidence | Classification | Impact | Proof required before removal or revival |
| --- | --- | --- | --- |
| `src/components/AboutUsSection.js:5-55` | **Observed:** unreferenced export | Separate About UI can drift from `ShopLandingPage`. | Search all source/docs for dynamic paths; obtain product decision on canonical About section. |
| `src/components/BookingConfirmation.js:10-403` | **Observed:** unreferenced export | Alternate booking confirmation and messaging flow is not part of a route. | Compare with live booking completion flow and add an integration test before consolidation. |
| `src/components/BookingManagementFunctions.js:5-122` | **Observed:** no import; duplicated booking helper names | Contains incompatible booking fields (`date`/`time`) and placeholder cloud URLs at `:37` and `:67`. | Establish a Firestore booking schema and run emulator tests before removing or merging. |
| `src/components/DistanceBadge.js:12-52` | **Observed:** unreferenced export | Location-distance presentation has no active consumer. | Verify map/list design and runtime search before removal. |
| `src/components/MobileShopOwnerButton.js:8-85` | **Observed:** unreferenced export | A second mobile unread-message implementation can diverge from navbar behavior. | Verify mobile navigation ownership and Firestore index requirements. |
| `src/components/OfferButton.js:3-135` | **Observed:** unreferenced export; invalid if imported | Uses TypeScript `interface` syntax in a `.js` file at `:3-9`, then HTML `class` and `onclick` inside JSX at `:96-106`; it is not a safe dormant feature. | Decide whether the third-party offer button is desired; then rewrite/test it as React or remove only after confirmation. |
| `src/components/ScrollIndicator.js:5-68` | **Observed:** unreferenced export | A team-section scroll affordance has no active consumer. | Check landing-page UX before cleanup. |
| `src/components/ShopDashboard.js:13-222` | **Observed:** unreferenced export and absent from `App` routes | An alternate shop dashboard, including placeholders, cannot be reached by normal routing. | Choose canonical dashboard (`Account` or this module) before changing routes or deleting it. |
| `src/networkBlocker.js:1-25` | **Observed:** `setupNetworkBlocker` has no import/call | A global TinyMCE request-blocking monkeypatch is dormant. | Confirm whether a network policy is still needed before removing it. |
| `src/utils.js:2-115` | **Observed:** exports are not imported | Google-address utility duplicates local behavior in `src/components/GoogleBusinessStep.js:616-624`. | Compare address output contracts, especially Turkish default phone behavior at `src/utils.js:105-115`, before consolidation. |

**Observed:** These component CSS files have no whole-repository literal filename
reference: `src/components/Account.css`, `ChartControls.css`,
`EmployeeManagementStepStyle.css`, `Home.css`, and `ImageCarousel.css`.
They are likely excluded from the bundle. `src/App.css` is not in this set; it is
imported by `src/components/AppointmentCard.js:20`, `src/components/BarberList.js:21`, and
`src/components/Home.js:15`.

## Duplicate and misplaced backend or migration paths

### Firebase functions outside the deployed entry

- **Observed:** `functions/firebase-functions.js:1-62` defines an independent
  `sendDeletionConfirmation` trigger, but `functions/index.js` does not require it.
  The deployed entry instead defines `sendDeletionConfirmationEmail` at
  `functions/index.js:774-824`.
- **Observed:** The two versions use different mail transports and payload fields:
  the dormant version expects `userData.name` at
  `functions/firebase-functions.js:25`, while the deployed version uses
  `userData.displayName` at `functions/index.js:785`.
- **Inferred:** Deploying this file as an additional entry without a migration plan
  could produce duplicate emails for one deletion document.
- **Safe action:** Treat `functions/index.js` as canonical until emulator deployment
  inspection and a deletion-trigger integration test prove otherwise.

### Server code in the browser tree

- **Observed:** `src/components/messaging.js:1-229` uses CommonJS
  `firebase-functions` and `firebase-admin` APIs, declares HTTP endpoints such as
  `exports.sendMessage` at `:6`, and has no source import.
- **Inferred:** It is misplaced Cloud Functions code. Importing it into the browser
  would make browser bundling and server credential boundaries unsafe.
- **Safe action:** Do not revive it from `src`; compare its endpoint contracts with
  `functions/index.js:424-475`, `:476-532`, `:533-629`, and current frontend callers
  before relocating or retiring it.

### Duplicate shop-name migrations

- **Observed:** `functions/createShopNameRecord.js:7-37` and
  `scripts/migrateShopNames.js:9-42` both self-execute a migration that writes
  `barberShops` to `shopNames`.
- **Observed:** No package script exposes either file. The browser-side version also
  imports nonexistent `../src/firebase/config` at `scripts/migrateShopNames.js:3`;
  the repository's Firebase module is `src/firebase.js`.
- **Observed:** Both commit a batch every 400 records and continue using the same
  batch (`functions/createShopNameRecord.js:23-29`,
  `scripts/migrateShopNames.js:26-34`). This needs validation against the Firestore
  SDK before either script is run; a new batch is normally needed after a commit.
- **Unknown:** Whether either script was ever executed against a production project,
  whether `shopNames` is complete, and whether transaction/idempotency semantics are
  required.
- **Safe action:** Keep both non-runnable. Build one explicitly named, Admin-SDK,
  idempotent migration with dry-run, pagination, per-batch replacement, counters,
  and a production backup/approval gate.

## Inactive or contradictory configuration and documentation

- **Observed:** `config-overides.js:1-87` is misspelled and inactive: no
  `react-app-rewired` or `customize-cra` dependency/script exists, while package
  commands use `react-scripts` (`package.json:57-65`). Its async-hooks replacement
  references `src/mocks/async-hooks-mock.js:1-17`, which therefore has no active
  configuration path.
- **Inferred:** The file was a failed or abandoned browser-polyfill attempt. Do not
  enable it piecemeal; it references packages not declared as direct dependencies.
- **Observed:** `firestore.indexes.json:8-14` repeats the exact
  `nameSearch ASCENDING` field twice in one index definition. This is structurally
  contradictory and should be checked with Firebase index validation before deploy.
- **Observed:** Legacy Firebase project/hosting names remain active configuration at
  `.firebaserc:4,14-17` and `firebase.json:50`. These names are not dead merely
  because branding changed.
- **Unknown:** Which Firebase alias/hosting target is the intended revival target.
  Do not rename, deploy, or remove aliases until the owner provides the project
  mapping and credentials.
- **Observed:** `_PRE_PUBLISH_FINDINGS.md:13-33` says callers use hardcoded EasyCut
  function URLs and functions use EasyCut senders. Current callers instead use
  `REACT_APP_CLOUD_FUNCTIONS_URL` at `src/components/AppointmentCard.js:229`,
  `src/components/AppointmentRescheduleModal.js:255`, `src/components/BookNow.js:334`,
  `src/components/ClientManagementDashboard.js:408`, and `src/components/MyAppointments.js:139,169`; the deployed
  deletion sender is BarbersBuddies at `functions/index.js:803`.
- **Observed:** The findings document was introduced in `83776e1` and never changed.
  It is stale evidence, not a current release checklist.

## Reachable consistency risks retained as knowledge

These are not dead code, but they explain why duplicate cleanup must follow booking
schema and endpoint work rather than precede it.

- **Observed:** `src/components/BookNow.js:334` uses ordinary single quotes around
  `${process.env.REACT_APP_CLOUD_FUNCTIONS_URL}`. It sends that literal text as the
  fetch URL, unlike the template literals in the other callers cited above.
- **Observed:** Booking documents are modeled inconsistently: current booking
  creation sends `selectedDate`/`selectedTime` in `functions/index.js:64-96`, while
  the orphan helper reads/writes `date`/`time` in
  `src/components/BookingManagementFunctions.js:12-18,85-112`; active client logic
  also mixes the two forms (`src/components/BookNow.js:70,267-292` and
  `src/components/ClientManagementDashboard.js:394-419`).
- **Observed:** Commented alternate implementations remain in active files:
  `src/components/ClientManagementDashboard.js:88-238` and
  `src/components/BookNow.js:530-563`.
- **Inferred:** These competing representations can obscure which booking path owns
  availability, cancellation, and duplicate-booking protection.

## Safe cleanup and modernization protocol

1. Freeze the booking schema in a short ADR: field names, date/time timezone
   representation, status state machine, employee scope, and unique slot identity.
2. Write emulator-backed contract tests for create, cancel, reschedule, and concurrent
   booking attempts. Include the literal-URL regression in `BookNow`.
3. Produce an import/route report after every candidate change, then use coverage or
   a runtime smoke test to confirm no removed path is dynamically used.
4. For Functions, inspect the actual deployment manifest and emulator trigger list.
   Consolidate one endpoint/trigger at a time behind tests; never deploy an old
   alternate entry merely to discover its behavior.
5. For migrations, test only against an emulator/snapshot. Require dry-run output,
   pagination, idempotency, a fresh batch after every commit, and explicit production
   authorization.
6. Update `_PRE_PUBLISH_FINDINGS.md` only after live config verification. Preserve
   history by replacing assertions with dated verification notes rather than deleting
   evidence wholesale.
7. Make one logical commit per scope: booking contract, Functions consolidation,
   migration tooling, configuration/docs, then UI retirements. Each commit needs a
   specific test receipt.

## Extension guide for future agents

Before editing a candidate in this document:

1. Confirm the pinned revision or record the new HEAD and compare it with this audit.
2. Search import, export, route, dynamic import, filename, and string references.
3. Read the nearest `AGENTS.md` and `CLAUDE.md`; do not assume stale configuration is
   disposable because it is unused locally.
4. Use `git log -- <path>` and `git blame <path>` to establish provenance. Do not
   recommend removal solely on age or naming.
5. For Firebase-facing code, separate static proof from emulator, deployment, and
   production-data proof. Never read or publish secret values in this artifact.
6. Amend the evidence index below with the revision, commands/tests, and any changed
   conclusion.

## Unresolved questions

1. Which Firebase project and hosting target should become canonical?
2. Is the alternate `ShopDashboard` intended to replace the Account-based dashboard,
   or is it a retired experiment?
3. Which booking collection fields exist in real data, and are old `date`/`time`
   documents still present?
4. Was `shopNames` populated by a prior migration, trigger, or seed process?
5. Are the dormant About, confirmation, distance, mobile shop-owner, offer, and
   scroll components product requirements or discarded prototypes?
6. Is React Buddy development tooling intentionally included in production builds?
7. Does deployment have any nonstandard Functions entry configuration outside the
   checked-in `functions/package.json`?

## Evidence index

| Evidence | How it was used |
| --- | --- |
| `src/index.js:1-23`, `src/App.js:2-26,123-143` | Browser entry and route graph. |
| `functions/package.json:4-14`, `functions/index.js:39-123,774-824` | Functions deployment entry and live deletion trigger. |
| `package.json:57-65`, `config-overides.js:1-87` | Inactive override determination. |
| `rg` import/export/name scans at pinned revision | Static unreferenced-path classification. |
| `git log --oneline -10`, path histories for the cited candidates | Bounded provenance; all candidates trace only to `83776e1`. |
| `_PRE_PUBLISH_FINDINGS.md:5-52`, `.firebaserc:4,14-17`, `firebase.json:50` | Stale release findings and legacy config names. |
| `firestore.indexes.json:4-16` | Duplicate index-field observation. |
