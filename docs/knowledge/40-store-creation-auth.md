# Store Creation and Ownership Knowledge Map

## Provenance

- Repository: `BarbersBuddies-revival-worktree`.
- Source URL: `https://github.com/OthmanAdi/BarbersBuddies---the-5-minutes-Barbershop-Online-Shop-Launcher.git`.
- Inspected revision: `61132dc366e4e30edc9c8a69cde64b010cbb09c4`.
- Branch or state: `codex/barbersbuddies-revival` at the inspected revision.
- Observed at: 2026-09-01, Europe/Berlin.
- Research question: trace shop creation and ownership from authentication through form state, Firestore, storage, public shop links, and owner management.
- Included scope: routing, auth/user records, creator wizard, drafts/temp records, employee invites, name index, owner dashboard, rules, and directly adjacent booking consumption.
- Excluded scope: Firebase project state, deployed rules/functions, environment values, storage rules, live data, dependency execution, and external network calls.
- Budget used: approximately 30 source/configuration files, read only.
- Evidence method: source inspection at the pinned revision; no target execution or Firebase access.
- Validation performed: citations were checked against the pinned source; no runtime, emulator, or deployment validation was authorized.
- Target status comparison: the study did not change the target. An untracked `graphify-out/` directory was observed after the initial clean preflight and is treated as concurrent work, not study output.
- Redactions: no environment or credential file contents were read.
- Overall confidence: high for source behavior and medium for deployed behavior.

## Executive Summary

**Observed.** Any authenticated user can enter the creation route, assemble a shop in client state, upload images, and use `addDoc` to create a `barberShops` document containing an `ownerId`; dashboards later select shops by that field. The actual Firestore rule permits any authenticated create but does not require the submitted owner to equal the authenticated user, and it lets the current owner change `ownerId`. This makes client-side role checks presentation only, not an ownership boundary. See `src/App.js:75-91`, `src/components/CreateBarberShop.js:1028-1044`, `src/components/CreateBarberShop.js:1596-1646`, `src/components/Account.js:832-850`, and `firestore.rules:11-16`.

**Observed.** The creator requires a temporary shop record and draft record, but neither collection is matched by the tracked Firestore rules. If those rules are deployed, the required temp-shop/draft writes are denied. The local-draft path also parses a local value and exits without applying it to state. See `src/components/CreateBarberShop.js:1369-1377`, `src/components/useBarberShopPersistence.js:46-104`, and `firestore.rules:1-67`.

**Inferred, high confidence.** The current creation workflow is not idempotent: it has no server transaction, idempotency key, or deterministic shop identity, and it uploads assets before the final Firestore write. Repeating a submit after a timeout or ambiguous failure can create duplicate stores and orphan files. See `src/components/CreateBarberShop.js:1554-1646` and `src/components/CreateBarberShop.js:1666-1676`.

## Architecture and Boundaries

| Component or boundary | Responsibility | Evidence label | Evidence | Confidence |
| :--- | :--- | :--- | :--- | :--- |
| Router | Makes auth, creator, account, public shop, booking, employee registration, and customization surfaces reachable. Only shop messages is wrapped in `ProtectedRoute`. | Observed | `src/App.js:75-91` | High |
| Auth and user record | Creates or updates `users/{uid}` and routes non-customers to creator. | Observed | `src/components/Auth.js:1456-1493`, `src/components/Auth.js:1593-1623` | High |
| Creator wizard | Owns multi-step local form, temporary state, asset uploads, final shop write, and success/error UI. | Observed | `src/components/CreateBarberShop.js:410-492`, `src/components/CreateBarberShop.js:1226-1460`, `src/components/CreateBarberShop.js:1532-1677` | High |
| Draft persistence | Uses one localStorage key plus a per-user Firestore draft document with a debounced save. | Observed | `src/components/useBarberShopPersistence.js:6-12`, `src/components/useBarberShopPersistence.js:46-140` | High |
| Shop name index | Client checks `shopNames`; Firestore triggers populate it after shop writes. | Observed | `src/components/ShopNameValidator.js:44-126`, `functions/triggers.js:4-32` | High |
| Owner surfaces | Account and management modal query final shops by `ownerId`; page builder saves direct updates. | Observed | `src/components/Account.js:449-470`, `src/components/Account.js:832-850`, `src/components/ShopManagementButton.js:13-59`, `src/components/PageBuilder.js:77-95` | High |
| Firestore rules | The only tracked enforcement layer for Firestore ownership. | Observed | `firestore.rules:1-67` | High |

## Route and Authentication Boundary

1. **Observed happy entry.** On a signed-in user, `Auth` retrieves `users/{uid}` and routes `customer` users to `/shops`, every other stored `userType` to `/create-shop`; missing demo documents are routed by email heuristics. `src/components/Auth.js:1456-1493`.
2. **Observed account creation.** Google signup writes `userType` chosen in the UI and navigates customer to `/shops`, otherwise `/create-shop`. `src/components/Auth.js:1543-1623`. The legacy `signInWithGoogle` helper in `src/firebase.js:75-153` has overlapping user-document behavior with a different field set.
3. **Observed creator guard.** `CreateBarberShop` redirects only if Firebase auth has no current user. It does not load/check user type or existing-store ownership. `src/components/CreateBarberShop.js:1028-1044`.
4. **Observed ownership enforcement gap.** Rules authorize create based solely on being authenticated; update/delete check only the existing document's `ownerId`. They neither bind create `ownerId` to caller nor require owner immutability. `firestore.rules:11-16`.
5. **Inferred, high confidence.** A signed-in caller can submit a shop with another UID as `ownerId`, and a current owner can transfer a shop by updating that field. The UI's assignment of the current UID (`src/components/CreateBarberShop.js:1604-1608`) is not a security guarantee.

## Store Creation Behavior Trace

### Happy Path

1. **Observed.** The wizard carries basic details, services, availability, images, categories, and payment methods in React state. A derived `shopData` object is also maintained for child steps. `src/components/CreateBarberShop.js:414-492`, `src/components/CreateBarberShop.js:951-978`.
2. **Observed.** Step validation checks required basic fields, services, staff schedule, and payment selection. It creates `tempShops/{randomId}` before service/team flows. `src/components/CreateBarberShop.js:1226-1366`, `src/components/CreateBarberShop.js:1369-1459`.
3. **Observed.** Submit fetches the temp record, uploads shop and service files, constructs a final random `uniqueUrl`, then writes a randomly identified final `barberShops` document. `src/components/CreateBarberShop.js:1532-1646`.
4. **Observed.** After the final write it marks published, clears the draft, updates Zustand's persisted `userShops`, and shows a public `/shop/{uniqueUrl}` link. `src/components/CreateBarberShop.js:1646-1665`, `src/store.js:1-23`.
5. **Observed.** The public landing route resolves the final document with `where('uniqueUrl', '==', uniqueUrl)` and uses the first document returned. `src/components/ShopLandingPage.js:102-130`.
6. **Observed.** Account and shop management later re-query `barberShops` by `ownerId == auth.uid`; the management modal auto-selects the first returned shop. `src/components/Account.js:832-850`, `src/components/ShopManagementButton.js:25-59`.

### Error Path

1. **Observed.** Temp-shop creation errors are logged; one branch returns without a user-facing error, another displays a generic preparation error. `src/components/CreateBarberShop.js:1397-1407`, `src/components/CreateBarberShop.js:1442-1455`.
2. **Observed.** Final creation catches errors and displays a generic retry message, but does not delete already uploaded files or temporary documents. `src/components/CreateBarberShop.js:1564-1592`, `src/components/CreateBarberShop.js:1666-1676`.
3. **Observed.** Name-validator query errors set local availability back to null but do not notify the parent callback. `src/components/ShopNameValidator.js:109-117`.
4. **Observed.** Availability, service, and customization saves catch/console-log errors. The availability editor presents an error dialog; PageBuilder only logs it. `src/components/ShopAvailabilityEditor.js:92-125`, `src/components/ShopServicesTab.js:164-168`, `src/components/PageBuilder.js:77-95`.

### Edge Cases and Defects

| Case | Behavior | Evidence label | Evidence |
| :--- | :--- | :--- | :--- |
| Temp/draft records are unmatched by tracked Firestore rules | Firestore denies unmatched paths by default; the required writes are therefore unavailable if this file is deployed. | Inferred, high confidence | `firestore.rules:1-67`, `src/components/CreateBarberShop.js:1369-1377`, `src/components/useBarberShopPersistence.js:69-104` |
| Local draft exists | Parsed local data is not sent to `setPersistedData`, then the hook returns before checking remote draft. | Observed | `src/components/useBarberShopPersistence.js:46-90` |
| Browser shared by users | A single constant `barbershop_draft` key is not UID/shop scoped. | Observed | `src/components/useBarberShopPersistence.js:6-7`, `src/components/useBarberShopPersistence.js:116-121` |
| Debounced save crosses lifecycle/auth change | No cancellation is shown; cleanup only flushes pending work when `hasUnsavedChanges` is true. | Inferred, medium confidence | `src/components/useBarberShopPersistence.js:92-122`, `src/components/useBarberShopPersistence.js:142-164` |
| Repeated or ambiguous final submit | A random add/write has no idempotency key or transaction. | Observed for lack of mechanism; inferred duplicate outcome | `src/components/CreateBarberShop.js:1554-1646` |
| Same normalized shop name | Validator reads a post-write trigger index, but final writes are direct random-ID adds. | Observed for mechanics; inferred TOCTOU duplicate outcome | `src/components/ShopNameValidator.js:57-107`, `functions/triggers.js:4-13`, `src/components/CreateBarberShop.js:1570-1646` |
| Prepublish employee invitations | Final shop copies fields from temp record but neither writes `tempShopId` nor updates temp record with `publishedShopId`; registration tries that bridge. | Observed | `src/components/CreateBarberShop.js:1596-1646`, `src/components/EmployeeRegisterPage.js:72-92` |
| `specialDates` and payment methods at creation | Both are present in state/validation but absent from final `shopData`. | Observed | `src/components/CreateBarberShop.js:951-978`, `src/components/CreateBarberShop.js:1352-1362`, `src/components/CreateBarberShop.js:1596-1644` |
| Asset compensation | Storage uploads complete before Firestore create; catch has no deletion/repair action. | Observed | `src/components/CreateBarberShop.js:1564-1592`, `src/components/CreateBarberShop.js:1666-1676` |

## Draft, Temp, Employee Invite, and Name-Index Details

### Drafts

**Observed.** The intended remote draft contract is `shopDrafts/{userId}` with source data, `lastUpdated`, `userId`, and `language`; `clearDraft` marks it deleted rather than removing it. `src/components/useBarberShopPersistence.js:92-140`. **Unknown.** Whether a deployed rule, migration, or cleanup job exists outside this repository to support it.

### Temporary shops and employees

**Observed.** Team setup stores employees in `tempShops/{shopId}` and a random 16-character token map, while final creation only copies current temp fields into the final shop. `src/components/EmployeeManagementStep.js:309-346`, `src/components/EmployeeManagementStep.js:444-503`, `src/components/CreateBarberShop.js:1596-1606`.

**Observed.** The employee registration page validates token expiry and used state on the client, reads current employees, appends one, and marks token consumed in a batch. `src/components/EmployeeRegisterPage.js:68-145`, `src/components/EmployeeRegisterPage.js:147-205`. **Inferred, high confidence.** This is not an authorization-safe invite consumer: final shops are publicly readable (`firestore.rules:12-15`), the registration route has no auth wrapper (`src/App.js:86-89`), and direct final-shop updates still require owner UID. It also lacks transaction retry semantics for concurrent invitation consumption.

### Name index and public link

**Observed.** `shopNames/{shopId}` stores normalized name in an after-create trigger and is read by the validator. `functions/triggers.js:4-13`, `src/components/ShopNameValidator.js:57-107`, `firestore.rules:55-59`. **Inferred, high confidence.** It is a usability signal, not a uniqueness invariant, because reservation happens after final creation.

**Observed.** `uniqueUrl` is a 10-character random `nanoid`, without an explicitly enforced uniqueness reservation; landing takes first match. `src/components/CreateBarberShop.js:1570-1608`, `src/components/ShopLandingPage.js:105-130`.

## Data Contracts

| Surface | Role or contract | Evidence label | Evidence |
| :--- | :--- | :--- | :--- |
| `users/{uid}` | Auth profile, user-selected `userType`, trial/subscription, contact and provider details. | Observed | `src/components/Auth.js:1593-1608`, `src/firebase.js:104-143` |
| `barberShops/{randomId}` | `name`, `nameSearch`, contact/biography, services, `ownerId`, dates, `uniqueUrl`, availability, image URLs, pricing tier, theme, blocks; temp employees/tokens copied in. | Observed | `src/components/CreateBarberShop.js:1596-1644` |
| `shopDrafts/{uid}` | User-scoped intended wizard snapshot with timestamp and language. | Observed | `src/components/useBarberShopPersistence.js:69-104` |
| `tempShops/{randomId}` | Temporary creator record with `ownerId`, employees, and registration token map. | Observed | `src/components/CreateBarberShop.js:1369-1377`, `src/components/EmployeeManagementStep.js:327-346`, `src/components/EmployeeManagementStep.js:449-460` |
| `shopNames/{shopId}` | Trigger-maintained normalized-name lookup index. | Observed | `functions/triggers.js:4-32` |
| Storage paths | Creator uses owner UID for initial shop/service files, while post-create service editor uses final shop ID. | Observed | `src/components/CreateBarberShop.js:1564-1583`, `src/components/ShopServicesTab.js:100-118` |

## Target Invariants and Idempotency

These are target-state recommendations, not claims that the current system enforces them.

| Target invariant | Why it is needed | Current evidence |
| :--- | :--- | :--- |
| Final owner is immutable and equals authenticated caller at creation | Prevent forged ownership and unauthorized transfer. | `firestore.rules:11-16` |
| A final create has one idempotency key and one server-side result | Recover safely from retry, reload, timeout, or double submission. | `src/components/CreateBarberShop.js:1554-1646` |
| Name/slug reservation is atomic and canonical | Prevent duplicate shop names/links and ambiguous landing lookup. | `src/components/ShopNameValidator.js:57-107`, `functions/triggers.js:4-13` |
| Drafts are UID + draft-ID scoped and cancellable | Prevent cross-user local drafts and late debounced writes. | `src/components/useBarberShopPersistence.js:6-7`, `src/components/useBarberShopPersistence.js:92-164` |
| A temp record is private, owned, expiring, and has a deterministic final-store bridge | Keep prepublish employees/tokens from becoming orphaned. | `src/components/CreateBarberShop.js:1369-1377`, `src/components/EmployeeRegisterPage.js:72-92` |
| Invite redemption is an authenticated or signed server transaction | Prevent token disclosure, concurrent redemption, and unauthorized employee writes. | `src/components/EmployeeRegisterPage.js:109-130`, `src/components/EmployeeRegisterPage.js:167-186` |
| Uploads have a finalization/cleanup protocol | Avoid orphan assets when final store write fails. | `src/components/CreateBarberShop.js:1564-1592`, `src/components/CreateBarberShop.js:1666-1676` |

## Safe Extension Guide

1. **Ownership and schema first.** Change `firestore.rules` with emulator tests before restoring client write paths. Bind `ownerId` to `request.auth.uid` on create, prohibit ownership changes on update, and validate fields/types. Do not make `tempShops` broadly public merely to unblock the wizard.
2. **Move finalization server-side.** Add a single authenticated creation endpoint that reserves canonical name/slug, accepts/reuses an idempotency key, owns the final document ID, applies an explicit final schema including `specialDates` and `paymentMethods`, and records a repairable asset-finalization job.
3. **Repair lifecycle contracts.** Replace global localStorage draft key with per-user/per-draft keys; set parsed local data; cancel debounced work when identity changes; persist the temp-to-final mapping or eliminate temp records in favor of a controlled draft state.
4. **Replace invite and nested-array mutations.** Use a transaction/callable function for token redemption and for concurrent updates to employee/service arrays. Tokens and employee PII should not reside on public shop documents.
5. **Make UI a faithful consumer.** Retain route guards/preflights for UX, but let all final authorization come from backend/rules. Pick one canonical owner dashboard path: `Account` management modal or `ShopDashboard`; the latter currently queries `users` by a `uid` field although auth records are addressed by document ID. `src/components/ShopDashboard.js:71-112`.
6. **Add narrow validation.** Emulator rules tests, unit tests for draft migration and payload preservation, integration tests for retry/idempotency, and two-client tests for same-name and parallel submit/invite scenarios.

## Adjacent Booking Boundary

**Observed.** Store availability/services feed `BookNow`; it fetches a shop twice, derives times only from availability, checks then adds a slot without a transaction, and invokes the booking function with a single-quoted literal that prevents environment interpolation. `src/components/BookNow.js:125-203`, `src/components/BookNow.js:263-340`. The function accepts unsigned request body fields and writes booking data without `shopOwnerId`, while Firestore booking rules expect that field for owner access. `functions/index.js:39-119`, `firestore.rules:18-27`.

**Inferred, high confidence.** This needs a separate atomic booking design, but it must be coordinated with store availability, employee contract, and owner ID invariants before a revival test can credibly cover duplicate booking.

## Unresolved Questions

| Question | Why unresolved | Evidence needed | Impact |
| :--- | :--- | :--- | :--- |
| Are tracked Firestore rules/functions currently deployed? | Firebase access was explicitly excluded. | Deployment metadata or authorized Firebase console/CLI receipt. | Could turn source-confirmed blockers into live blockers or reveal drift. |
| What Storage rules are active? | No tracked Storage rules file was found. | Authorized rule export/config receipt. | Upload and employee-photo ownership cannot be assessed. |
| Is multi-shop ownership allowed? | UI supports multiple shops but no product policy is documented. | Product decision and live data expectations. | Determines uniqueness/idempotency scope and dashboard UX. |
| Must shop names and public URLs be globally unique? | Validator treats names as unavailable but persistence is non-atomic. | Product policy and migration plan for duplicates. | Determines canonical reservation key and redirects. |
| How should employees authenticate and consent? | Registration page has no auth boundary and stores PII in public shop data. | Product/legal/privacy decision. | Determines invite security, data model, and rules. |
| Which functions endpoint is intended for current client builds? | Source contains a non-interpolated endpoint literal. | Non-secret environment contract and deployment receipt. | Blocks booking test and end-to-end proof. |

## Evidence Index

| Evidence | Supports | Label |
| :--- | :--- | :--- |
| `src/App.js:75-91` | Route exposure and only one protected route | Observed |
| `src/components/Auth.js:1456-1493` | Login routing and demo fallback | Observed |
| `src/components/CreateBarberShop.js:1369-1459` | Temp-shop lifecycle | Observed |
| `src/components/CreateBarberShop.js:1532-1677` | Final creation, uploads, error behavior | Observed |
| `src/components/useBarberShopPersistence.js:46-164` | Draft restore/save lifecycle | Observed |
| `src/components/EmployeeManagementStep.js:309-346` | Temporary employee write | Observed |
| `src/components/EmployeeRegisterPage.js:68-205` | Client token validation and redemption | Observed |
| `src/components/ShopNameValidator.js:44-126` | Client name availability check | Observed |
| `functions/triggers.js:4-32` | Post-write name-index maintenance | Observed |
| `src/components/Account.js:832-850` | Owner dashboard data query | Observed |
| `firestore.rules:1-67` | Existing authorization and unmatched collection gaps | Observed |
| `src/components/BookNow.js:263-340` | Adjacent booking/store contract risks | Observed |
| `functions/index.js:39-119` | Booking backend request trust and persistence | Observed |
