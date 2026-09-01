# Firebase Security and Data Boundary

## Provenance

- Repository: `BarbersBuddies-revival-worktree`
- Source URL: `https://github.com/OthmanAdi/BarbersBuddies---the-5-minutes-Barbershop-Online-Shop-Launcher.git`
- Inspected revision: `61132dc366e4e30edc9c8a69cde64b010cbb09c4`
- Branch/state: `codex/barbersbuddies-revival`; the inspection began clean. A later untracked `graphify-out/` directory is concurrent-work evidence and was not created or inspected by this study.
- Observed at: 2026-09-01, Europe/Berlin
- Research question: map the Firebase Functions, Firestore authorization/data model, authentication/tenancy, notifications, Storage, Hosting, indexes, atomicity, and live-state unknowns before changes.
- Included scope: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `functions/`, Firebase initialization, and the booking/auth/notification/messaging/ratings/shop UI call sites.
- Excluded scope: `.env*` contents, live Firebase console/configuration, deployed rule versions, secret values, dependency directories, execution, emulator startup, and network calls.
- Budget used: 31 Firebase-facing source/configuration files plus the tracked test inventory.
- Evidence method: source and Git metadata reads only. Every source claim below is labelled **Observed**, **Inferred**, or **Unknown**.
- Validation performed: confirmed canonical repository root, revision, tracked-file inventory, no reparse paths under the root, package entrypoint, and final target status. No target code, tests, deploy, or emulator was run.
- Redactions: environment-variable values and any credential-like literals are not reproduced.
- Overall confidence: high for the checked-out source behavior, low for deployed Firebase state.

## Executive Summary

**Observed:** Firebase has no coherent server-owned authorization or booking state boundary in this revision. HTTP Functions trust request bodies without token verification; several Firestore collections used by the app have no rule path; the client, Functions, and rules disagree on IDs and fields; and booking availability is a multi-step client workflow without transaction or idempotency protection.

The first repair milestone should be a single canonical, authenticated booking command path that owns authorization, slot reservation, booking state, notification intent, and idempotency. Rules and UI should then be made consumers of that contract, not independent writers of the same state.

**Unknown:** none of the current source proves which project, Functions revision, rules, indexes, Auth providers, Storage rules, secret configuration, or data schema is live. Do not infer production behavior from this local checkout until Firebase access permits a redacted deployment inventory.

## Trust Boundaries and Architecture

| Component or boundary | Responsibility | Evidence label | Evidence | Confidence |
| :--- | :--- | :--- | :--- | :--- |
| React Firebase bootstrap | Initializes Auth, Firestore, Storage, Analytics, and Functions from environment-variable names. | Observed | `src/firebase.js:20`, `src/firebase.js:30` | High |
| Browser booking workflow | Reads and creates time slots, calls a Function, then updates booking/slot and creates a notification. | Observed | `src/components/BookNow.js:263`, `src/components/BookNow.js:288`, `src/components/BookNow.js:334`, `src/components/BookNow.js:348` | High |
| Cloud Functions package | `functions/index.js` is the deployed package entrypoint and initializes the Admin SDK. | Observed | `functions/package.json:14`, `functions/index.js:1`, `functions/index.js:6` | High |
| Firestore Rules | Defines only `users`, `barberShops`, `bookings`, `messages`, `ratings`, `notifications`, `notificationPreferences`, `shopNames`, and `deletedAccounts`. | Observed | `firestore.rules:6`, `firestore.rules:12`, `firestore.rules:19`, `firestore.rules:30`, `firestore.rules:38`, `firestore.rules:45`, `firestore.rules:51`, `firestore.rules:56`, `firestore.rules:62` | High |
| Storage | Application uploads/deletes under several path forms, but no tracked Storage rule file or Storage deploy section exists. | Observed | `src/components/CreateBarberShop.js:1564`, `src/components/EmployeeRegisterPage.js:152`, `firebase.json:96` | High |
| Hosting | Two targets serve the SPA and attach universal CSP/CORS headers. | Observed | `firebase.json:2`, `firebase.json:42`, `firebase.json:49`, `firebase.json:88` | High |

### Authorization ownership

**Observed:** `ProtectedRoute` is a UI-only check of `users/{uid}.userType`; it is not an authorization boundary for Firestore or Functions. The user can write their complete user document under the checked rules. `barberShops` uses an in-document `ownerId`; bookings use a mixture of customer email and optional `shopOwnerId`; messages use customer and shop identifiers; notifications use different identity forms across writers.

- UI role check: `src/components/ProtectedRoute.js:12`, `src/components/ProtectedRoute.js:20`, `src/components/ProtectedRoute.js:23`.
- Whole-document user writes: `firestore.rules:6`.
- Shop owner predicate: `firestore.rules:12`.
- Booking predicates: `firestore.rules:19`.
- Message predicates: `firestore.rules:30`.
- Notification predicate: `firestore.rules:45`.

**Inferred, high confidence:** role, subscription, tenancy, and notification identity must become server-owned or strictly field-validated. UI checks are useful navigation behavior only.

## Functions Authentication, Authorization, and Contracts

### HTTP Functions

| Function | Current happy path | Authorization/validation observed | Consequential edge/error path |
| :--- | :--- | :--- | :--- |
| `createBooking` | Validates a few request fields, Admin-SDK creates `bookings` document, then sends two emails. | No Firebase token extraction or verification; only HTTP method, presence, and email-regex checks. `status`, price, slot, employee, and owner fields are not written. | An email failure returns 500 after the booking exists. A retry can create another booking. `functions/index.js:39`, `functions/index.js:70`, `functions/index.js:87`, `functions/index.js:105`, `functions/index.js:115` |
| `updateBooking` | Loads booking by request `bookingId`, updates mutable fields, then emails both parties. | No token, caller, field, or availability check. | Any caller able to reach it can target any existing booking ID. `functions/index.js:213`, `functions/index.js:227`, `functions/index.js:238`, `functions/index.js:249` |
| `cancelBooking` | Loads booking by request `bookingId`, sets cancellation data, sends emails. | No token/caller check and no POST-only branch after OPTIONS. | Any caller can attempt cancellation of any booking ID. `functions/index.js:283`, `functions/index.js:292`, `functions/index.js:305` |
| `rescheduleAppointment` | Reads booking/shop, queries conflicting records, directly updates booking, creates notification, sends customer/shop email work. | No token/caller check. `userId` comes from JSON and is persisted as `rescheduledBy`. | Availability check and update are separate; the shop email helper is empty. `functions/index.js:533`, `functions/index.js:541`, `functions/index.js:570`, `functions/index.js:583`, `functions/index.js:528` |
| `respondToRating` | Updates a rating and notifies its stored user. | No token or proof that caller owns the supplied shop/rating. | Any caller can attempt to add/replace a shop response. `functions/index.js:827`, `functions/index.js:832`, `functions/index.js:842` |
| `shopMessage` | Creates a message and notification from supplied identities, then seeks an FCM/email receiver. | Validates only field presence, not booking membership, sender identity, customer, or shop ownership. | Arbitrary fields can be supplied; receiver lookup mixes shop ID and user ID. `functions/index.js:869`, `functions/index.js:874`, `functions/index.js:887`, `functions/index.js:893`, `functions/index.js:924` |
| `updateFCMToken` | Writes supplied token to supplied user document. | No token/caller check. | A caller can set a notification token for any supplied user ID. `functions/index.js:1025`, `functions/index.js:1030`, `functions/index.js:1033` |

**Observed:** `setCorsHeaders` only selects which browser origin receives `Access-Control-Allow-Origin`; it does not authenticate or reject a request at the server. Each listed HTTP function above calls this helper, but none verifies an ID token. `functions/index.js:23`, `functions/index.js:30`, `functions/index.js:39`, `functions/index.js:213`, `functions/index.js:533`, `functions/index.js:827`, `functions/index.js:869`, `functions/index.js:1025`.

**Observed privacy risk:** `createBooking` logs the entire request body, which includes customer contact and appointment data. `functions/index.js:56`.

### Event and scheduled Functions

| Trigger | Behavior | Risk/contract mismatch |
| :--- | :--- | :--- |
| Shop-name triggers | Mirror `barberShops/{id}.name` into `shopNames/{id}` on create/update/delete. | `onShopUpdate` uses `update`, so absence of a mirror document is an error path. No uniqueness is enforced. `functions/triggers.js:4`, `functions/triggers.js:21` |
| New message | Looks up `users/{message.receiverId}`, sends FCM/email. | Direct UI message records do not set `receiverId`; a failure may cause event retries. `functions/index.js:424`, `functions/index.js:431`, `src/components/AppointmentCard.js:323`, `src/components/ShopMessageView.js:223` |
| New rating | Reads shop ratings array, appends rating, writes average/count. | Client also writes the same aggregate. The trigger is a read-modify-write, not a transaction. `functions/index.js:476`, `functions/index.js:487`, `src/components/AppointmentCard.js:472` |
| Status change | Creates customer notification and sends email when `status` changes. | It writes an email into `notifications.userId`, but rules expect an Auth UID. `functions/index.js:975`, `functions/index.js:988`, `firestore.rules:45` |
| Reminder schedule | Every hour, fetches confirmed bookings and enabled preferences, then sends email and appends a log. | Preferences are keyed by UID in the UI but read by booking email; logs are not read as a dedupe key. `functions/index.js:630`, `functions/index.js:638`, `functions/index.js:649`, `functions/index.js:658`, `functions/index.js:723`, `src/components/MyAppointments.js:270` |
| Deletion confirmation | `index.js` exports a Mailgun implementation. A second Gmail implementation exists in `functions/firebase-functions.js`, but it is not the package main/imported module. | Parallel source suggests stale implementation, not two deployed exports from this package. `functions/package.json:14`, `functions/index.js:774`, `functions/firebase-functions.js:15` |

## Firestore Collections and Ownership Model

| Collection | Current writer/reader model | Rules contract | Mismatch or risk |
| :--- | :--- | :--- | :--- |
| `users` | Client creates and updates profile, role, trial/subscription, and FCM-related fields. | Own UID may read/write whole document. `firestore.rules:6` | **Observed:** self-write makes role/subscription data client-controlled. `src/firebase.js:85`, `src/components/SubscriptionPage.js:57` |
| `barberShops` | Client creates data including `ownerId`, employees, registration tokens, availability, email, payment data, and assets. | Public read; any authenticated create; stored `ownerId` controls update/delete. `firestore.rules:12` | **Observed:** unrestricted create permits arbitrary `ownerId`; public document can expose private fields/tokens. `src/components/CreateBarberShop.js:1596` |
| `bookings` | Function creates a reduced document; clients also update/cancel/reschedule/rate. | Customer email or `shopOwnerId` may read/update/delete; any authenticated create. `firestore.rules:19` | **Observed:** function omits `shopOwnerId`; fields and lifecycle vary by writer. `functions/index.js:58`, `functions/index.js:87` |
| `bookedTimeSlots` | UI reads, subscribes, creates, updates, and cancels slots. | No match path. | **Observed:** checked-in rules do not permit client slot access. `src/components/BookNow.js:66`, `src/components/BookNow.js:288`, `firestore.rules:3` |
| `messages` | Client and Function create messages using shop-doc IDs, UID-like sender IDs, and sometimes customer email. | Rules compare caller UID to `customerId` or `shopId`; create permits any authenticated user. `firestore.rules:30` | **Observed:** shop document IDs are not owner UIDs, so owner read/write does not match UI data. `src/components/ShopMessageView.js:223` |
| `typing` | Client reads/writes typing indicators by booking ID. | No match path. | **Observed:** checked-in rules do not permit it. `src/components/AppointmentCard.js:381`, `src/components/ShopMessageView.js:164`, `firestore.rules:3` |
| `notifications` | UI uses `shopId`/email, Functions use email in `userId`; UI reads by shop ID. | Caller UID must equal `resource.data.userId`. `firestore.rules:45` | **Observed:** identity shapes do not agree, so writes/listeners cannot satisfy this rule consistently. `src/components/BookNow.js:375`, `functions/index.js:596`, `src/components/NotificationButton.js:31` |
| `notificationPreferences` | UI stores at document ID equal to UID. | Caller UID must equal document ID. `firestore.rules:51` | **Observed:** scheduler indexes preference map by UID but looks up with booking email. `src/components/NotificationPreferences.js:76`, `functions/index.js:651`, `functions/index.js:658` |
| `ratings` | Client batch creates rating, updates shop aggregate, and updates booking; trigger also aggregates. | Public read, any authenticated create, stored `userId` controls update. `firestore.rules:38` | **Observed:** UI stores email in `userId` but rule compares it to UID. `src/components/AppointmentCard.js:451`, `firestore.rules:41` |
| `shopNames` | Trigger/migration mirror supports client availability lookup. | Authenticated read, no client write. `firestore.rules:56` | **Observed:** mirror tracks names but does not make a name unique. `functions/triggers.js:8` |
| `tempShops`, `shopDrafts`, `notificationLogs`, `deletedAccounts` | Client uses drafts/temp shops; Functions use logs; client writes deletion record. | Only `deletedAccounts` has a rule path. | **Observed:** temp/draft/log client access is unruled in this file; deployed behavior is unknown. `src/components/CreateBarberShop.js:1370`, `src/components/useBarberShopPersistence.js:98`, `functions/index.js:723`, `firestore.rules:62` |

## Behavior Trace: Booking and Calendar

### Happy Path

1. **Observed:** the booking page queries and subscribes to `bookedTimeSlots` for selected shop/date/employee, then calculates visual availability. `src/components/BookNow.js:63`, `src/components/BookNow.js:263`, `src/components/BookNow.js:441`.
2. **Observed:** it performs a read-before-write conflict query, creates a random-ID pending slot, builds booking data, and calls `createBooking`. `src/components/BookNow.js:280`, `src/components/BookNow.js:288`, `src/components/BookNow.js:313`, `src/components/BookNow.js:334`.
3. **Observed:** if the HTTP response is OK, it batches slot status plus selected booking fields, then separately creates a notification. `src/components/BookNow.js:348`, `src/components/BookNow.js:375`.
4. **Inferred, high confidence:** under the inspected rules this happy path stops at the first client `bookedTimeSlots` access because the collection has no rule. If a different live rule permits it, it still lacks an atomic reservation.

### Error Path

1. **Observed:** if the Function returns non-OK or fetch throws, the page deletes its pending slot. It does not delete a booking that the server may already have created before email delivery failed. `src/components/BookNow.js:407`, `src/components/BookNow.js:417`, `functions/index.js:87`, `functions/index.js:115`.
2. **Observed:** booking’s endpoint string is single-quoted rather than a template literal, so its configured Functions URL is not interpolated. `src/components/BookNow.js:334`.
3. **Observed:** cancellation and rescheduling both modify Firestore in the client and call unauthenticated Functions, producing duplicate/conflicting ownership of the same lifecycle. `src/components/AppointmentCard.js:211`, `src/components/AppointmentCard.js:229`, `src/components/AppointmentCard.js:264`, `src/components/AppointmentRescheduleModal.js:225`, `src/components/AppointmentRescheduleModal.js:254`.

### Edge Cases

| Case | Behavior | Evidence label | Evidence |
| :--- | :--- | :--- | :--- |
| Simultaneous booking requests | Separate query and `addDoc` operations allow two callers to see no slot before either write. | Observed | `src/components/BookNow.js:263`, `src/components/BookNow.js:280`, `src/components/BookNow.js:288` |
| Retry after email failure | Firestore document precedes outbound email; server returns failure after persisted booking. | Observed | `functions/index.js:87`, `functions/index.js:105`, `functions/index.js:115` |
| Missing booking status | Function-created document omits `status`; conflict and scheduler queries filter statuses. | Observed | `functions/index.js:58`, `functions/index.js:87`, `functions/index.js:571`, `functions/index.js:640` |
| Slot cleanup failure | Client cleanup is an independent delete and cannot undo a server-created booking. | Observed | `src/components/BookNow.js:408`, `src/components/BookNow.js:417` |
| Reschedule collision | Function checks availability then updates separately; client pre-updates before Function call. | Observed | `functions/index.js:570`, `functions/index.js:583`, `src/components/AppointmentRescheduleModal.js:225` |
| Reminder duplication | Scheduler writes a notification log after delivery but never queries it before delivery. | Observed | `functions/index.js:683`, `functions/index.js:723` |

## CSP, CORS, Storage, and Indexes

### Hosting and CORS

**Observed:** both Hosting targets set `Access-Control-Allow-Origin: *` and a CSP with wildcard sources and `unsafe-inline`/`unsafe-eval`. SPA rewrites route all paths to `index.html`. `firebase.json:4`, `firebase.json:21`, `firebase.json:42`, `firebase.json:50`, `firebase.json:68`, `firebase.json:88`.

**Observed:** Functions provide a narrower browser-origin response list, but no authentication, credential validation, or server-side rejection based on origin. `functions/index.js:23`, `functions/index.js:30`.

### Storage

**Observed:** no tracked `storage.rules` exists and `firebase.json` has no `storage` stanza. Application code uploads assets under both `shops/{ownerUid}/...` and `shops/{shopId}/...`; shop landing reads under an owner-ID convention. `firebase.json:96`, `src/components/CreateBarberShop.js:1564`, `src/components/EmployeeRegisterPage.js:152`, `src/components/ShopLandingPage.js:61`.

**Unknown:** the live Storage rule set, CORS policy, object inventory, lifecycle policy, and whether currently-deployed paths match either source convention. This must be obtained from Firebase before making access claims.

### Firestore indexes

**Observed:** the checked-in index file declares only one `shopNames` index, with `nameSearch` listed twice. `firestore.indexes.json:2`.

**Observed:** several application query shapes combine fields/orders absent from that declaration, including booking calendar, booking slot, client dashboard, and message feeds. `src/components/BookNow.js:264`, `src/components/ShopCalendarTab.js:54`, `src/components/ClientManagementDashboard.js:52`, `src/components/ShopMessageView.js:98`.

**Unknown:** which indexes Firebase has already created manually or whether the checked-in JSON deploys successfully. Emulator/index validation is required before deleting or replacing index definitions.

## Offline Emulator Validation Plan

No commands were run in this study. Run this plan only in an isolated Firebase Emulator project with synthetic data and explicit approval:

1. Start Auth, Firestore, Functions, Storage, and Hosting emulators against a copied non-production configuration. Never point the revival checkout at production by default.
2. Add rules tests for each collection and operation with four principals: anonymous, customer A, customer B, shop owner A, and shop owner B. Assert direct slot/draft/typing access behavior explicitly.
3. Add Functions tests that call each HTTP endpoint without an ID token, with a customer token, with a wrong customer token, and with an unrelated shop-owner token. Verify no client-supplied owner/customer/user identity is accepted without server derivation.
4. Add booking concurrency tests: two simultaneous reservations for same shop/date/time/employee, repeated request idempotency, outbound-email failure, retry, cancellation, and reschedule race.
5. Add notification tests for UID-versus-email preference identity, exactly-once reminder intent, invalid FCM token behavior, missing message receiver identity, and status-transition notifications.
6. Add Storage tests for every actual object path convention, read/write/delete by owner, customer, employee-registration participant, unauthenticated visitor, and cross-shop attacker.
7. Capture emulator indexes required by tests, then reconcile them into one reviewed index configuration.

## Safe Extension Guide

- Treat `functions/index.js` as the current deployed Functions composition root. Do not make `functions/firebase-functions.js` a second competing entrypoint without an explicit migration decision. `functions/package.json:14`.
- Put every state-changing booking, cancellation, reschedule, rating response, message, FCM-token, and subscription command behind an authenticated server boundary. Derive caller UID from verified authentication, then load authoritative booking/shop/user documents before mutation.
- Define one persisted identity convention per field. Use UIDs for authorization-bearing IDs and keep email as non-authoritative contact data. Make collection contracts explicit before changing rules or UI.
- Make booking slot ownership a single atomic server operation with a deterministic uniqueness key or equivalent transaction/precondition. Treat email/push work as retryable side effects linked to a durable command/outbox record.
- Split public shop presentation data from owner-only operational data, especially employee registration tokens, internal contact fields, subscription/payment metadata, and staff data.
- Introduce Storage rules and a single canonical object path convention before permitting new uploads. Do not infer a live Storage policy from missing local files.
- When adding a collection, update its Firestore rules, index requirements, emulator tests, and this document’s collection inventory in the same change set.

## Unresolved Questions

| Question | Why unresolved | Evidence needed | Impact |
| :--- | :--- | :--- | :--- |
| Which Firebase project/targets are actively serving users? | `.firebaserc` lists multiple project/target mappings, but source alone cannot establish current deployment. | Redacted Firebase project/Hosting/Functions inventory. | Determines blast radius and deployment plan. |
| Are checked-in rules and indexes deployed? | No deploy receipt or live Firebase access was in scope. | `firebase deploy --only firestore` history or console export. | Determines whether source-denial findings reproduce live. |
| What Storage rules and objects are live? | No tracked rule file/stanza and live console was excluded. | Redacted Storage rules/CORS/object-path inventory. | Required for upload/data-exposure assessment. |
| Which Function revision is live, and are legacy Functions still deployed? | Local `main` identifies intended exports only. | `firebase functions:list` and deploy metadata. | Required before delete/rename work. |
| What booking schema exists in live records? | Seed/source code use divergent field names and types. | Redacted collection schema sample and counts. | Required for safe migration and indexes. |
| Which Auth providers and account controls are enabled? | Client references Google/email flows, but console configuration is excluded. | Redacted Auth provider and authorized-domain inventory. | Required for end-to-end authorization tests. |

## Evidence Index

| Evidence | Supports | Label |
| :--- | :--- | :--- |
| `functions/index.js:23` | CORS helper and non-authentication boundary | Observed |
| `functions/index.js:39` | Booking HTTP entrypoint and request contract | Observed |
| `functions/index.js:213` | Booking update HTTP entrypoint | Observed |
| `functions/index.js:533` | Reschedule conflict/update behavior | Observed |
| `functions/index.js:630` | Scheduled reminder behavior | Observed |
| `functions/index.js:827` | Rating response HTTP entrypoint | Observed |
| `functions/index.js:869` | Message HTTP entrypoint | Observed |
| `functions/index.js:1025` | FCM token HTTP entrypoint | Observed |
| `firestore.rules:6` | Whole-document user write policy | Observed |
| `firestore.rules:12` | Public shop reads and owner policy | Observed |
| `firestore.rules:19` | Booking access predicates | Observed |
| `firestore.rules:30` | Message access predicates | Observed |
| `firestore.rules:45` | Notification identity predicate | Observed |
| `src/components/BookNow.js:263` | Client booking/slot workflow | Observed |
| `src/components/AppointmentRescheduleModal.js:225` | Client-first reschedule workflow | Observed |
| `src/components/EmployeeRegisterPage.js:68` | Client-side registration-token validation | Observed |
| `src/components/NotificationPreferences.js:76` | Preference document identity | Observed |
| `firebase.json:96` | Deployed Firebase configuration sections | Observed |
| `firestore.indexes.json:2` | Checked-in index inventory | Observed |
