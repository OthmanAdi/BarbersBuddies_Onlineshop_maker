# Frontend Routes, UX, and Client Data Ownership

**Provenance:** Codebase Knowledge Builder artifact, read-only source mapping.

- Revision: `61132dc366e4e30edc9c8a69cde64b010cbb09c4`
- Scope: React client under `src/`; no Firebase credentials, production data, emulator, browser, or test execution was used.
- Status labels: **Observed** means direct source evidence at this revision. **Inferred** means a conclusion from observed code that requires runtime or backend verification. **Unknown** has no source proof in this review.

## Entry points and application state

**Observed**

- React mounts `App` inside `React.StrictMode`, with the React Buddy development wrapper: `src/index.js:9-18`. Mount effects can be intentionally re-run in development.
- `App` provides Router, Stripe Elements, LanguageContext, global navigation, an offline indicator, and all route declarations: `src/App.js:106-150`.
- Zustand persists just `theme` and `userShops` to local storage key `theme-storage`: `src/store.js:5-23`. All booking, wizard, appointment, message, and loading state otherwise belongs to individual components.
- Firebase client initialization exports Auth, Firestore, Storage, Functions, Google provider, and convenience account helpers: `src/firebase.js:20-40`, `src/firebase.js:166-278`.
- The navigation layout uses a fixed navbar and spacer, with a JavaScript viewport breakpoint at 1024px: `src/components/Navbar.js:7-31`.

**Inferred**

- Side-effect-heavy screen components require StrictMode-safe effects. Existing duplicate fetch effects therefore cost more reads in development and make stale-response handling more important.

## Route map and intended journeys

| Route | Screen and access behavior | Journey role |
| --- | --- | --- |
| `/` | `Home`; unprotected. `src/App.js:123` | Marketing/entry. |
| `/auth` | `Auth`; navbar hidden. `src/App.js:124`, `src/components/Navbar.js:19-21` | Customer and owner sign-in/sign-up. |
| `/shops` | `BarberShops` and `BarberList`; unprotected. `src/App.js:125`, `src/components/BarberList.js:192-264` | Shop discovery. |
| `/shop/:uniqueUrl` | `ShopLandingPage`; unprotected. `src/App.js:128`, `src/components/ShopLandingPage.js:102-168` | Public shop storefront. |
| `/book/:shopId` | `BookNow`; unprotected. `src/App.js:129`, `src/components/BookNow.js:39-61` | Public appointment booking. |
| `/dashboard/customers` | `MyAppointments`; route unprotected, component asks user to sign in. `src/App.js:132`, `src/components/MyAppointments.js:209-223` | Customer appointment management. |
| `/create-shop` | `CreateBarberShop`; route unprotected, component redirects unauthenticated users. `src/App.js:127`, `src/components/CreateBarberShop.js:1028-1044` | Owner wizard. |
| `/account` | `AccountPage`; route unprotected, component handles authentication. `src/App.js:126`, `src/components/Account.js:449-474` | Owner/customer account and shop management. |
| `/dashboard/clients` | `ClientManagementDashboard`; route unprotected. `src/App.js:131`, `src/components/ClientManagementDashboard.js:32-86` | Owner booking dashboard. |
| `/customize-shop/:shopId` | `PageBuilderWrapper`; route unprotected and loads named shop. `src/App.js:134`, `src/components/PageBuilderWrapper.js:14-51` | Shop page editor. |
| `/employee-register/:shopId/:token` | `EmployeeRegisterPage`; public token flow. `src/App.js:133`, `src/components/EmployeeRegisterPage.js:68-145` | Employee self-registration. |
| `/shop-messages` | The only route wrapped in `ProtectedRoute`, requiring `userType === 'shop-owner'`. `src/App.js:136-143`, `src/components/ProtectedRoute.js:7-48` | Owner messaging. |

### Customer journey

**Observed**

1. Discovery reads all `barberShops` plus all active ratings, then filters client-side: `src/components/BarberList.js:192-264`, `src/components/BarberList.js:340-353`.
2. Storefront resolves `uniqueUrl` through a Firestore query and displays a loader or a generic unavailable state: `src/components/ShopLandingPage.js:102-168`, `src/components/ShopLandingPage.js:275-294`.
3. Service and employee CTAs link to booking with `?service=` or `?employee=`: `src/components/ShopLandingPage.js:766`, `src/components/ShopLandingPage.js:862`, `src/components/ServiceModal.js:77`.
4. `BookNow` presents service, employee, date/time, and personal-details steps: `src/components/BookNow.js:61`, `src/components/BookNow.js:971-1031`. Required fields and phone length are checked before submit: `src/components/BookNow.js:218-245`.
5. Booking attempts a client-created `bookedTimeSlots` reservation, calls `createBooking`, marks the reservation booked, updates the booking, and creates a notification: `src/components/BookNow.js:263-427`.
6. Customer appointments make an initial `bookings` query by lowercased email, enrich each with shop data, and render cards for chat, cancellation, rescheduling, and ratings: `src/components/MyAppointments.js:61-114`, `src/components/MyAppointments.js:277-319`, `src/components/AppointmentCard.js:717-835`.

**Observed error and edge states**

- BookNow renders loading and shop-not-found states: `src/components/BookNow.js:595-601`, `src/components/BookNow.js:731-754`; network/fetch failures are only logged before that fallback: `src/components/BookNow.js:138-142`, `src/components/BookNow.js:161-165`.
- The date picker disables past dates and past time slots: `src/components/DateTimeSelectionStep.js:53-59`, `src/components/DateTimeSelectionStep.js:98-108`, `src/components/DateTimeSelectionStep.js:193-204`, `src/components/DateTimeSelectionStep.js:274-275`.
- My Appointments has skeleton, signed-out, and empty-list states: `src/components/MyAppointments.js:209-223`, `src/components/MyAppointments.js:301-319`.

**Inferred**

- The storefront deep-link parameters are currently dead: `BookNow` does not read `location.search` or `URLSearchParams`, despite source links above. Service/stylist selection must be repeated after following those CTAs.

### Owner journey

**Observed**

1. The wizard initializes owner and trial state, captures shop details, availability, images, services, employees, payment methods, and Google Business choice: `src/components/CreateBarberShop.js:410-480`, `src/components/CreateBarberShop.js:697-715`, `src/components/CreateBarberShop.js:2057-2559`.
2. A temporary shop is created while navigating to later wizard steps: `src/components/CreateBarberShop.js:1369-1459`.
3. The normal visible final creation path belongs to `GoogleBusinessStep.handleStoreCreation`, which uploads images, builds shop data, uses `addDoc(barberShops)`, connects the temp shop, and clears the local/Firebase draft: `src/components/GoogleBusinessStep.js:176-381`.
4. Account fetches owned shops, offers edit/delete/manage controls, and owns profile deletion: `src/components/Account.js:752-854`, `src/components/Account.js:989-1069`.
5. The client dashboard selects the first shop owned by the current user and fetches its bookings: `src/components/ClientManagementDashboard.js:32-86`.

**Observed error and edge states**

- Create Shop shows a full loading screen before Firebase initialization and redirects unauthenticated users: `src/components/CreateBarberShop.js:1028-1044`.
- Wizard step validation rejects incomplete service/payment selections: `src/components/CreateBarberShop.js:1330-1362`.
- The owner dashboard has no explicit no-shop state beyond an empty booking list: `src/components/ClientManagementDashboard.js:69-76`.

## Client-owned data map

| Collection / state | Client writers | Client readers / listeners | Notes |
| --- | --- | --- | --- |
| `users` | Auth/Firebase helpers and App redirect handler: `src/firebase.js:85-130`; `src/App.js:70-89` | Navbar, Account, BookNow, Create Shop: `src/components/DesktopNavbar.js:30-64`; `src/components/Account.js:449-474`; `src/components/BookNow.js:489-511`; `src/components/CreateBarberShop.js:823-849` | User type and subscription state are client-consumed. |
| `barberShops` | Google creation, editor/account components: `src/components/GoogleBusinessStep.js:326-335`; `src/components/PageBuilder.js:80-83`; `src/components/Account.js:752-799` | Discovery, storefront, booking, dashboards | The client has more than one historic creation implementation. |
| `tempShops` / `shopDrafts` | Wizard and persistence hook: `src/components/CreateBarberShop.js:1369-1377`; `src/components/useBarberShopPersistence.js:92-140` | Employee registration and wizard | Temporary state participates in real employee flow. |
| `bookings` | Client booking updates, confirmation, cancellation/reschedule: `src/components/BookNow.js:348-367`; `src/components/AppointmentCard.js:264-271`; `src/components/AppointmentRescheduleModal.js:225-233` | Customer, owner dashboard, calendar | Correctness cannot be entrusted solely to component code. |
| `bookedTimeSlots` | BookNow, cancellation clients: `src/components/BookNow.js:289-297`; `src/components/AppointmentCard.js:211-225`; `src/components/ClientManagementDashboard.js:390-405` | BookNow listener/query, rescheduler | Intended concurrency guard, but currently not atomic. |
| `notifications`, `messages`, `ratings`, `typing` | Booking and AppointmentCard: `src/components/BookNow.js:375-392`; `src/components/AppointmentCard.js:323-405`, `src/components/AppointmentCard.js:450-509` | Notification/message views | Multiple independent write sequences. |

## High-confidence defects and risks

### P0: booking and appointment correctness

1. **Observed: configured booking endpoint is not interpolated.** `BookNow` passes a single-quoted literal beginning `${process.env...}` to `fetch`, not a template literal: `src/components/BookNow.js:334-340`. The previous commented flow repeats the same defect: `src/components/BookNow.js:563-569`. This client cannot reliably use the configured Cloud Functions base URL for this request.
2. **Observed: duplicate booking race.** Availability is read with `getDocs`, then a random `bookedTimeSlots` record is created with `addDoc`: `src/components/BookNow.js:263-297`. There is no transaction, deterministic slot identifier, or server-mediated claim in this component. Two clients can observe empty results and both create a pending reservation.
3. **Observed: reschedule modal references an undefined identifier.** The component accepts `appointmentId`, but reads `appointment.id` in its effect and dependencies: `src/components/AppointmentRescheduleModal.js:10-17`, `src/components/AppointmentRescheduleModal.js:57-97`. Appointment cards mount this component regardless of modal visibility: `src/components/AppointmentCard.js:1004-1021`. This can render-break the appointments screen.
4. **Observed: employee token claim is a stale-read/write race.** Token validity is read at `src/components/EmployeeRegisterPage.js:109-130`; submit later reads employees and batch-writes an updated array plus used-token state at `src/components/EmployeeRegisterPage.js:167-180`. It is not a Firestore transaction/precondition, so simultaneous claimants can both pass validation.

### P1: time, staff, and multi-step state

5. **Observed: BookNow's real-time availability query omits `selectedEmployee` from its effect dependencies.** The query conditionally filters that employee: `src/components/BookNow.js:63-74`; the dependency list contains only date and shop ID: `src/components/BookNow.js:83-84`. Choosing a stylist after a date can leave blocked-time state from the prior selection.
6. **Observed: no-preference and employee-specific capacity rules conflict.** The booking query filters by employee only when an employee is selected: `src/components/BookNow.js:263-271`. A no-preference booking treats any staff booking as a whole-shop collision, while employee selection allows parallel time slots. The product rule is **Unknown**.
7. **Observed: reschedule executes overlapping client and server side effects.** The modal writes booking and notification before calling the reschedule endpoint: `src/components/AppointmentRescheduleModal.js:225-271`; then its callback invokes parent code which calls that endpoint again: `src/components/AppointmentCard.js:559-577`, `src/components/MyAppointments.js:137-165`. The modal also does not create/move slot records and checks only `booked` state: `src/components/AppointmentRescheduleModal.js:177-189`.
8. **Observed: date-only values are mixed with UTC conversion.** Rescheduling creates `YYYY-MM-DD` through `toISOString`: `src/components/AppointmentRescheduleModal.js:174`. Shop calendar uses `toISOString` for query bounds and matching: `src/components/ShopCalendarTab.js:50-61`, `src/components/ShopCalendarTab.js:158-163`. Customer UI uses `new Date('YYYY-MM-DD')`: `src/components/MyAppointments.js:96-98`, `src/components/MyAppointments.js:121-128`. **Inferred:** non-UTC businesses can receive prior/next calendar dates.
9. **Observed: calendars disagree on slot duration and operating hours.** Booking uses a day-configured duration: `src/components/BookNow.js:181-195`; ShopCalendarTab uses 30 minutes: `src/components/ShopCalendarTab.js:125-142`; Custom and mobile agendas hard-code 09:00 to 21:45 at 15-minute increments: `src/components/CustomAgenda.js:14-21`, `src/components/MobileAgenda.js:34-43`.
10. **Observed: reschedule includes the close boundary whereas booking excludes it.** `AppointmentRescheduleModal` uses `<= close`: `src/components/AppointmentRescheduleModal.js:133-142`; BookNow loops only while `< endTime`: `src/components/BookNow.js:189-193`.

### P1: shop creation and persistence

11. **Observed: creation is non-idempotent from the client.** Multiple creation triggers call `handleStoreCreation`: `src/components/GoogleBusinessStep.js:1084-1105`, `src/components/GoogleBusinessStep.js:1132-1161`; it uses a fresh `addDoc`: `src/components/GoogleBusinessStep.js:326-329`. **Inferred:** rapid/retried requests can create duplicate shops unless a backend/rules invariant exists.
12. **Observed: local draft restoration never assigns parsed data.** If local storage exists, the hook parses it, marks loading false, and returns without `setPersistedData(parsed)`: `src/components/useBarberShopPersistence.js:50-67`. The storage key is global, not per user: `src/components/useBarberShopPersistence.js:6`.
13. **Observed: entering Create Shop resets local fields.** `resetForm` clears wizard state: `src/components/CreateBarberShop.js:1011-1026`; an effect invokes it whenever the route is `/create-shop`: `src/components/CreateBarberShop.js:851-856`. This conflicts with draft-resume intent.
14. **Observed: Zustand setter contract is violated.** `setUserShops` assigns its argument directly: `src/store.js:12-14`; Create Shop passes a React-style function updater: `src/components/CreateBarberShop.js:1650-1655`. The persisted `userShops` value can become a function rather than an array.

### P2: loading, stale UI, navigation, and visual consistency

15. **Observed: BookNow fetches shop data three times.** Effects at `src/components/BookNow.js:125-146`, `src/components/BookNow.js:148-169`, and `src/components/BookNow.js:472-487` duplicate the same resource load. Failed loads are console-only, then become a generic not-found UI.
16. **Observed: ShopLandingPage contains two real fetch effects and one inactive effect.** Fetching occurs at `src/components/ShopLandingPage.js:102-168` and `src/components/ShopLandingPage.js:213-265`; the effect at `src/components/ShopLandingPage.js:170-211` defines a fetch function but does not call it. The first fetch suppresses its caught error: `src/components/ShopLandingPage.js:132-133`.
17. **Observed: customer appointment data is a one-time fetch, but each visible card starts a message listener.** List fetch: `src/components/MyAppointments.js:61-114`. Per-card listener runs without an `isChatOpen` guard: `src/components/AppointmentCard.js:48-96`. Multi-device booking state can be stale while message subscriptions grow with visible cards.
18. **Observed: cancel is multi-write and response status is not checked before local changes.** Customer cancellation changes slot, POSTs, creates notification, and updates booking in separate operations: `src/components/AppointmentCard.js:211-271`. Owner cancellation similarly mutates slot then POSTs and optimistically changes state: `src/components/ClientManagementDashboard.js:390-429`.
19. **Observed: theme has competing owners.** App sets nested `data-theme="barber"`: `src/App.js:106-145`; navbar changes document root based on Zustand theme: `src/components/DesktopNavbar.js:114-118`; store starts from `emerald`: `src/store.js:8-10`. **Inferred:** user theme changes can be visually overridden or inconsistent.
20. **Observed: the only test is a stale CRA sample.** `src/App.test.js:1-8` expects a “learn react” link. No booking, calendar, wizard, access, or component tests were found in `src/` during this mapping.

## Accessibility and responsive evidence

**Observed**

- The application does include responsive layout classes in core booking and appointments screens, such as `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`: `src/components/MyAppointments.js:277-299`, and BookNow has separate mobile/desktop step progress layouts: `src/components/BookNow.js:918-960`.
- A JS `window.innerWidth <= 1024` switch chooses the navbar instead of CSS-only responsive behavior: `src/components/Navbar.js:7-31`.
- Icon-only interactive controls lack visible accessible names in representative paths: agenda close button `src/components/AgendaButton.js:138-148`, DateTime month arrows `src/components/DateTimeSelectionStep.js:154-166`, and rating star buttons `src/components/AppointmentCard.js:977-985`.
- Appointment modal controls are checkbox/label-driven rather than semantic dialog components with visible focus management: `src/components/AppointmentCard.js:842-968`, `src/components/AppointmentCard.js:970-1022`.

**Unknown**

- Keyboard trapping, initial focus, Escape behavior, screen-reader announcements, color contrast, touch targets, and actual small-screen overflow need browser and assistive-technology receipts. Source inspection alone cannot validate them.

## Frontend trust-boundary constraints

**Observed**

- Most routes are not guarded by `ProtectedRoute`; only owner messages are: `src/App.js:122-144`.
- The client loads a requested shop ID for editing without an owner comparison: `src/components/PageBuilderWrapper.js:14-51`.
- Client components write bookings, slots, shop records, employee tokens, messages, ratings, and notification state directly (data map above).

**Required constraint for future work**

- Treat every client validation, route guard, disabled button, query, and `isLoading` flag as a user-experience affordance only. Firebase Security Rules and privileged server endpoints must enforce identity, shop ownership, role, single-use tokens, slot capacity, booking idempotency, status transitions, and notification/email authority.
- Do not include Firebase secrets in knowledge artifacts. Production rules, indexes, function source, environment configuration, and data records are **Unknown** until authorized Firebase access is provided.

## Target UX principles and extension guide

1. **One calendar truth.** Introduce a shared domain representation for shop timezone, local service date, time, duration, employee/capacity, and status. Derive all booking picker, reschedule picker, shop calendar, and agenda rendering from it. Do not extend independent slot loops.
2. **Server-authoritative state changes.** A single idempotent command should own booking, reschedule, cancel, slot records, audit data, and notifications. UI should call it once, expose pending/success/conflict/error states, then render canonical server results.
3. **Preserve intent through journeys.** Parse and validate service/staff deep-link inputs at booking entry. Retain draft data per authenticated user and resume it deliberately, never by global browser key or route-entry reset.
4. **Explicit boundaries.** Add route guards only as a UX convenience, then pair them with Rules/server checks. Components that edit a shop must receive verified ownership, not only a URL parameter.
5. **One source of visual state.** Theme, language, responsive breakpoint policy, error surfaces, and modal primitives each need a single owner. New screens should use the approved primitive rather than add a second pattern.
6. **Design all states before happy-path styling.** Every fetch/mutation must specify initial loading, empty, recoverable error, permission denied, offline, conflict, and success behavior; show actionable retry where safe.
7. **Test the invariants, not only markup.** Add emulator-backed tests for simultaneous booking, token claim, cancel/reschedule compensation, role ownership, dates across timezones, duration overlap, deep links, and draft recovery. Replace the stale CRA test.

## Recommended implementation boundaries

| Scope | Owned files / responsibilities | Validation gate |
| --- | --- | --- |
| Booking domain | `BookNow`, `AppointmentRescheduleModal`, `AppointmentCard`, owner cancel/dashboard code, Cloud Functions, Firestore Rules | Emulator concurrency and idempotency tests; no UI-only repair. |
| Time/calendar | BookNow, DateTime step, reschedule modal, ShopCalendarTab, CustomAgenda, MobileAgenda, shared date utility | Tests in a non-UTC timezone and real browser calendar walkthrough. |
| Shop creation | Create Shop, GoogleBusinessStep, persistence hook, Zustand store, employee registration | One create command, draft migration, duplicate-submit test, token-race test. |
| Access and UX platform | App routes, ProtectedRoute, PageBuilderWrapper, dashboard, navbar/modal primitives | Rules authorization tests plus keyboard/mobile QA. |
| Evidence | Replace `App.test.js`; add feature tests and an explicit test matrix | CI receipts for unit, emulator, and browser checks. |

## Unresolved questions

1. **Unknown:** Which Cloud Function writes `bookings`, and does it already provide idempotency/slot transactions that the client accidentally bypasses?
2. **Unknown:** What do current Firestore Rules and indexes permit, especially for booking writes, owner editor routes, employee tokens, `messages`, and `typing`?
3. **Unknown:** Is an appointment without a chosen employee meant to occupy one shared chair or select any available employee? The current client applies inconsistent rules.
4. **Unknown:** What are authoritative shop timezones, resource capacity, booking lead time, cancellation windows, and multi-service duration/overlap policies?
5. **Unknown:** Does existing data contain duplicate `bookedTimeSlots`, orphan pending slots, duplicate shops, temp shops, or cross-user local drafts? Migration work must be evidence-driven.
6. **Unknown:** Which Google Business operations are currently authorized and which must wait for the owner to provide credentials and consent?

## Evidence index

- Application shell and routes: `src/index.js:9-18`; `src/App.js:106-150`; `src/store.js:5-23`; `src/firebase.js:20-40`.
- Customer discovery and booking: `src/components/BarberList.js:192-264`; `src/components/ShopLandingPage.js:102-168`; `src/components/BookNow.js:63-84`; `src/components/BookNow.js:218-427`; `src/components/DateTimeSelectionStep.js:146-388`; `src/components/PersonalDetailsStep.js:92-242`.
- Customer management: `src/components/MyAppointments.js:31-165`; `src/components/MyAppointments.js:209-435`; `src/components/AppointmentCard.js:48-96`; `src/components/AppointmentCard.js:183-313`; `src/components/AppointmentRescheduleModal.js:26-315`.
- Owner creation and management: `src/components/CreateBarberShop.js:697-856`; `src/components/CreateBarberShop.js:1369-1679`; `src/components/GoogleBusinessStep.js:176-381`; `src/components/useBarberShopPersistence.js:46-164`; `src/components/EmployeeRegisterPage.js:68-180`; `src/components/ClientManagementDashboard.js:32-86`.
- Calendars and responsive/accessibility evidence: `src/components/ShopCalendarTab.js:14-164`; `src/components/CustomAgenda.js:14-21`; `src/components/MobileAgenda.js:34-43`; `src/components/Navbar.js:7-31`; `src/components/AgendaButton.js:138-148`; `src/components/AppointmentCard.js:842-1022`.
