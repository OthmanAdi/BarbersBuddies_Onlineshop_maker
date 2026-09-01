# Repository Knowledge: Calendar, Time, Availability, and Booking Model

## Provenance

- Repository: `BarbersBuddies-revival-worktree`.
- Source URL: `https://github.com/OthmanAdi/BarbersBuddies---the-5-minutes-Barbershop-Online-Shop-Launcher.git`.
- Inspected revision: `61132dc366e4e30edc9c8a69cde64b010cbb09c4`.
- Branch or state: `codex/barbersbuddies-revival` at the inspected revision.
- Observed at: `2026-09-01T19:10:55+02:00`.
- Research question: inventory calendar, availability, slot, booking, cancellation, reschedule, notification, locale, and timezone behavior before changes.
- Included scope: `src/components`, `src/utils/bookingFunctions.js`, `functions/index.js`, Firestore rules/indexes, Firebase configuration, and seed date/booking data.
- Excluded scope: `.env*`, credentials, deployed Firebase data, Functions logs, live APIs, dependencies, generated files, and execution of application code.
- Budget used: focused read-only review of 39 source/config/test files and scoped text searches.
- Evidence method: static source inspection with line citations; no runtime claim is made from static evidence alone.
- Validation performed: inspected revision and status before/after research; no build, test, emulator, install, deployment, or network call was run.
- Target status comparison: the audit made no target changes. `graphify-out/` appeared after initial status during concurrent work and is outside this artifact's ownership.
- Redactions: no secret or credential values are reproduced. A credential-like hard-coded value was observed outside this artifact's scope and is intentionally omitted.
- Overall confidence: high for static representation and control-flow findings, low for deployed-data compatibility and runtime behavior.

## Executive Summary

- **Observed:** the booking domain has no single timestamp representation. Appointments use separate `selectedDate` (`YYYY-MM-DD`) and `selectedTime` (`HH:mm`) fields, while auditing uses a mixture of Firestore timestamps, JavaScript `Date`, and ISO text. `functions/index.js:87-98`, `src/components/BookNow.js:313-328`, `scripts/seed/data/bookings.js:65-100`.
- **Observed:** no application source in the included scope defines an IANA timezone, DST policy, booking buffer, lead time, or a canonical interval. The focused search found only ad hoc browser/runtime `Date` handling. `src/components/DateTimeSelectionStep.js:48-105`, `functions/index.js:630-670`.
- **Inferred, high confidence:** independent availability implementations and non-atomic client-side locking make capacity disagreements and duplicate bookings likely unless a deployed rule or uninspected backend compensates. `src/components/BookNow.js:263-297`, `functions/index.js:84-98`, `src/components/AppointmentRescheduleModal.js:173-260`.
- **Observed:** normal booking respects a per-day `slotDuration`, while reschedule, shop calendar, and agenda UIs use incompatible fixed 30- or 15-minute grids. `src/components/BookNow.js:181-195`, `src/components/AppointmentRescheduleModal.js:125-145`, `src/components/ShopCalendarTab.js:119-144`, `src/components/CustomAgenda.js:14-28`.
- **Unknown:** production shop timezone(s), data-shape variants, deployed Firestore rules/indexes, Functions region/runtime timezone, and business policy must be established before a safe migration or fix can be defined.

## Representation Matrix

| Surface | Current representation | Evidence label | Evidence | Risk / meaning |
| :--- | :--- | :--- | :--- | :--- |
| Appointment day | `selectedDate` string, normally `YYYY-MM-DD` | Observed | `functions/index.js:93`, `scripts/seed/data/bookings.js:74` | A civil date is stored without a zone. |
| Appointment time | `selectedTime` string, normally `HH:mm` | Observed | `functions/index.js:96`, `scripts/seed/data/bookings.js:75` | No offset, seconds, end instant, or duration is stored as the appointment interval. |
| Booking lifecycle time | Firestore server timestamp, JavaScript `Date`, and client ISO text | Observed | `functions/index.js:97`, `src/components/BookNow.js:326`, `src/components/CreateBarberShop.js:1607` | Audit/order semantics vary by writer. |
| Weekly shop hours | English weekday keys to `{open, close, slotDuration}` | Observed | `src/components/EnhancedAvailabilitySelector.js:12-40`, `src/components/ShopAvailabilityEditor.js:100-120` | The day strings are data keys, not localized display values. |
| Employee schedule | English weekday keys to arrays of whole-hour integers | Observed | `src/components/EmployeeRegisterPage.js:48-60`, `src/components/WeeklyScheduleSelector.js:83-95` | Cannot represent minute-level availability, breaks, or end-exclusive intervals. |
| Special-date exception | date-string key to `{type, endDate}` | Observed | `src/components/BarberCalendar.js:77-79`, `src/components/BarberCalendar.js:146-152` | There is no documented override-hours or capacity contract. |
| Slot lock | independent `bookedTimeSlots` document with shop/date/time/status/employee data | Observed | `src/components/BookNow.js:63-84`, `src/components/BookNow.js:288-297` | Random document IDs do not themselves enforce uniqueness. |
| Reminder instant | JavaScript parse of `date + 'T' + time` | Observed | `functions/index.js:655-670` | Interpretation relies on the Functions runtime locale/timezone. |
| Calendar display time | local browser `Date` and default locale formatting | Observed | `src/components/DateTimeSelectionStep.js:321-326`, `src/components/ShopCalendarTab.js:147-164` | Display semantics need not match shop semantics. |
| IANA zone / DST choice | no evidence in included source | Unknown | focused source search; `functions/index.js:657-670` contains no zone input | Cross-zone and DST behavior cannot be proven safe. |

## Lifecycle Paths

### Shop hours and special dates

1. **Observed:** the create-shop flow starts availability with Monday through Sunday set to `null`. `src/components/CreateBarberShop.js:697-705`.
2. **Observed:** the enhanced editor writes `{open, close, slotDuration}` per weekday and permits 15/30/45/60-minute values. `src/components/EnhancedAvailabilitySelector.js:16-40`, `src/components/EnhancedAvailabilitySelector.js:344-401`.
3. **Observed:** `ShopAvailabilityEditor` persists cleaned weekly hours and `specialDates`; it uses `holiday`, `promotion`, `event`, and `closed` as special-date types. `src/components/ShopAvailabilityEditor.js:60-80`, `src/components/ShopAvailabilityEditor.js:92-120`.
4. **Observed:** the final new-shop payload persists `availability` but the inspected payload does not include `specialDates`. `src/components/CreateBarberShop.js:1596-1646`.
5. **Observed:** the booking date picker only treats `holiday` as non-bookable. `src/components/DateTimeSelectionStep.js:68-95`, `src/components/DateTimeSelectionStep.js:182-204`.
6. **Inferred, high confidence:** special-date behavior is not a coherent availability override because the authoring type sets differ and only one type blocks the booking picker. `src/components/ShopAvailabilityEditor.js:60-80`, `src/components/DateTimeSelectionStep.js:107-143`.

### Customer booking

1. **Observed:** `BookNow` generates slots from the selected weekday's `open`, `close`, and `slotDuration`; it uses an end-exclusive loop (`time < endTime`). `src/components/BookNow.js:171-195`.
2. **Observed:** an employee restriction is checked only by `parseInt(selectedTime hour)` against a whole-hour schedule. `src/components/BookNow.js:250-261`, `src/components/BookNow.js:441-458`.
3. **Observed:** the client reads `bookedTimeSlots`, then adds a random-ID pending lock after finding no existing matching lock. `src/components/BookNow.js:263-297`.
4. **Observed:** the client sends a booking request and, on success, batch-marks its lock as booked and attaches the returned booking ID. `src/components/BookNow.js:313-367`.
5. **Observed:** the HTTPS `createBooking` handler writes a booking without a capacity lookup and stores only a subset of the request fields. `functions/index.js:58-98`.
6. **Observed:** a failure path deletes the client-created lock, while a successful backend booking followed by a failed client batch is not compensated in this source. `src/components/BookNow.js:398-427`.
7. **Inferred, high confidence:** two clients can pass the read-before-create check and create separate pending locks for the same resource/time. `src/components/BookNow.js:263-297`.
8. **Inferred, high confidence:** service durations cannot prevent overlap because the capacity check is only for one start-time string. `src/components/BookNow.js:181-195`, `src/components/BookNow.js:313-328`.

### Confirmation, cancellation, and reschedule

1. **Observed:** confirmation directly updates the booking to `confirmed` and creates notification/message documents. `src/components/BookingConfirmation.js:51-98`.
2. **Observed:** customer cancellation first marks one matched lock cancelled, invokes `cancelBooking`, then directly marks the booking cancelled. `src/components/AppointmentCard.js:183-225`, `src/components/AppointmentCard.js:229-271`.
3. **Observed:** the `cancelBooking` function updates booking status but has no `bookedTimeSlots` mutation. `functions/index.js:283-323`.
4. **Observed:** the reschedule modal checks a slot, directly changes the booking date/time/status, creates a notification, then calls the reschedule function. `src/components/AppointmentRescheduleModal.js:173-260`.
5. **Observed:** the reschedule function separately queries bookings whose status is `confirmed` or `pending`, then writes the new date/time and changes status to `rescheduled`. `functions/index.js:570-623`.
6. **Observed:** neither inspected reschedule path creates a new slot lock or releases the old one. `src/components/AppointmentRescheduleModal.js:173-260`, `functions/index.js:583-593`.
7. **Observed:** the reschedule modal's effect references `appointment.id`, but its declared props contain `appointmentId` rather than `appointment`. `src/components/AppointmentRescheduleModal.js:10`, `src/components/AppointmentRescheduleModal.js:59`, `src/components/AppointmentRescheduleModal.js:97`.
8. **Inferred, high confidence:** the undefined `appointment` reference can prevent the modal from rendering or its effect from running. Static inspection cannot prove the exact runtime error boundary. `src/components/AppointmentRescheduleModal.js:10`, `src/components/AppointmentRescheduleModal.js:59`.

### Calendars, agendas, and reminders

1. **Observed:** `ShopCalendarTab` builds local start/end days, serializes them through `toISOString()`, queries lexicographic date-string ranges, and matches day-view cards using another ISO date string. `src/components/ShopCalendarTab.js:20-62`, `src/components/ShopCalendarTab.js:147-164`.
2. **Observed:** the shop calendar's week and month controls are labelled as coming soon. `src/components/ShopCalendarTab.js:403-412`.
3. **Observed:** `CustomAgenda` and `MobileAgenda` display a fixed 09:00–21:45 fifteen-minute grid, independent of each shop's hours. `src/components/CustomAgenda.js:14-28`, `src/components/MobileAgenda.js:27-43`.
4. **Observed:** the hourly reminder job parses a local timestamp from separate date/time strings and has no visible per-booking/per-threshold delivery marker before sending. `functions/index.js:630-731`.
5. **Inferred, medium confidence:** a job can produce repeated reminder attempts while an appointment remains inside a configured time window. A live log and deployed scheduler configuration are required to establish actual duplicate delivery. `functions/index.js:665-731`.

## Time and Date Failure Modes

| Failure mode | Label | Evidence | Why it matters |
| :--- | :--- | :--- | :--- |
| Date shifts through `toISOString()` | Observed | `src/components/AppointmentRescheduleModal.js:174`, `src/components/ShopCalendarTab.js:50-51`, `src/components/BarberCalendar.js:77-79` | Local midnight serializes on a different UTC calendar date in positive-offset zones. |
| Date-only parser ambiguity | Observed | `src/components/BookNow.js:173`, `src/components/MyAppointments.js:97-98`, `src/components/PersonalDetailsStep.js:161-163` | `new Date('YYYY-MM-DD')` is repeatedly used before local weekday/display operations. |
| Runtime-local appointment parsing | Observed | `functions/index.js:657-670`, `src/components/CountdownTimer.js:8-42` | No shop IANA zone participates in instant creation. |
| Incompatible slot end rules | Observed | `src/components/BookNow.js:189-193`, `src/components/AppointmentRescheduleModal.js:133-145`, `src/components/ShopCalendarTab.js:129-142` | Booking excludes close; reschedule includes it; calendar has its own fixed duration. |
| Hour-only employee capacity | Observed | `src/components/BookNow.js:255-261`, `src/components/WeeklyScheduleSelector.js:83-95` | A 09:30 selection is accepted/denied only by hour 9. |
| Current-time cutoff is policy-free | Observed | `src/components/DateTimeSelectionStep.js:98-105` | A fixed 15-minute browser-clock rule ignores duration, buffer, and server time. |
| Reschedule state can remove capacity visibility | Observed | `functions/index.js:576`, `functions/index.js:583-593` | The conflict query excludes `rescheduled` records even though they retain the new time. |
| Legacy booking schemas conflict | Observed | `src/utils/bookingFunctions.js:67-80`, `src/components/BookingManagementFunctions.js:83-117` | One utility expects `selectedDate/selectedTime` strings, another expects `date: Timestamp` and `time`. |
| Agenda rounding can emit invalid `HH:60` | Observed | `src/components/CustomAgenda.js:24-28`, `src/components/MobileAgenda.js:27-32` | Rounding 53–59 minutes upward does not carry to the next hour. |
| Tests do not cover scheduling behavior | Observed | `src/App.test.js:1-8` | The only tracked test is the scaffold link assertion. |

## Target Contract: Half-Open Intervals and IANA Zones

The following is a **proposed target contract**, not current behavior.

1. **Proposed invariant:** every bookable resource belongs to exactly one `timeZone` containing a valid IANA identifier, for example a shop or a shop location.
2. **Proposed invariant:** customer input is a civil `localDate` plus `localStartTime` interpreted solely in that resource zone. The server resolves it to `startAt` and `endAt` Firestore timestamps.
3. **Proposed invariant:** occupancy is always `[startAt, endAt)`. Adjacent appointments are valid when `previous.endAt === next.startAt`; any overlap satisfies `candidate.startAt < existing.endAt && existing.startAt < candidate.endAt`.
4. **Proposed invariant:** `endAt` equals selected service duration plus required resource buffer, with each component captured in the immutable booking snapshot. Weekly `slotDuration` defines customer-visible start increments only, not service occupancy.
5. **Proposed invariant:** the server alone authorizes create, confirm, cancel, and reschedule. It uses an idempotency key and one transaction or equivalent serialization boundary to write booking, resource occupancy, audit event, and notification outbox state.
6. **Proposed invariant:** availability stores weekly local wall-clock intervals plus explicit date exceptions. Exceptions must state whether they close, replace, or add availability, never rely on display category labels.
7. **Proposed invariant:** DST gaps reject unavailable wall times with a clear alternative; DST repeated times require an explicit offset/disambiguation policy. Never silently rely on browser or Functions host timezone.
8. **Proposed invariant:** all rendering formats an instant in the shop zone by default, optionally also showing the viewer's zone. Civil date fields may remain as denormalized query keys only if server-derived and zone-tagged.

### Target record shapes

```text
barberShops/{shopId}
  timeZone: IANA zone string
  weeklyAvailability: weekday -> [ { startLocalTime, endLocalTime } ]
  dateOverrides: localDate -> { mode, intervals? }

bookings/{bookingId}
  shopId, resourceId, timeZone
  localDate, localStartTime
  startAt, endAt                         // Firestore timestamps
  serviceSnapshot, durationMinutes, bufferMinutes
  status, idempotencyKey, createdAt, updatedAt

resourceOccupancy/{deterministicResourceIntervalKey}
  shopId, resourceId, startAt, endAt, bookingId, state
```

## DST and Adjacency Test Matrix

| Case | Proposed assertion | Current evidence label | Current evidence / gap |
| :--- | :--- | :--- | :--- |
| Adjacent 30-minute bookings | `[09:00,09:30)` and `[09:30,10:00)` both commit | Observed gap | No canonical interval is stored. `functions/index.js:87-98`. |
| Long service plus buffer | 60-minute service + 15-minute buffer blocks starts before 10:15 | Observed gap | Booking only locks one `HH:mm` start. `src/components/BookNow.js:263-297`. |
| Same resource, concurrent create | exactly one transaction commits | Observed gap | Current client performs non-atomic read then add. `src/components/BookNow.js:263-297`. |
| Same instant, different clients zones | server resolves both in shop zone to the same interval | Unknown | No IANA zone field or resolver is in scope. |
| Berlin spring-forward gap | unavailable nonexistent wall time is rejected | Observed gap | Current code uses native `Date` parsing without DST policy. `functions/index.js:657-670`. |
| Berlin fall-back repeated hour | chosen offset/disambiguation is persisted and displayed | Observed gap | `selectedTime` has no offset/disambiguation field. `functions/index.js:93-98`. |
| Midnight boundary | overnight availability and next-day end are handled explicitly | Observed gap | Slot loops assume same-day `open`/`close` arithmetic. `src/components/BookNow.js:181-193`. |
| Holiday override | closure prevents booking and reopens capacity only when declared | Observed gap | Picker only blocks `holiday`; editor emits several types. `src/components/DateTimeSelectionStep.js:107-143`, `src/components/ShopAvailabilityEditor.js:60-80`. |
| Cancel then rebook | cancellation atomically releases occupancy | Observed gap | Lock and booking writes are separate. `src/components/AppointmentCard.js:211-271`, `functions/index.js:283-323`. |
| Reschedule | destination locks before source releases, with rollback on failure | Observed gap | Direct booking move precedes function call and no lock mutation is present. `src/components/AppointmentRescheduleModal.js:225-260`. |
| Reminder idempotency | each threshold sends at most once | Observed gap | Logs are written after sending and are not read as a guard. `functions/index.js:665-731`. |

## Extension Guide

1. **Proposed first write scope:** create one isolated scheduling-domain module and one server-authoritative booking API. It should own zone resolution, interval construction, availability expansion, conflict checks, idempotency, and state transitions. Do not add another UI-local slot generator.
2. **Proposed second write scope:** replace `BookNow`, confirmation, cancellation, and reschedule calls with that API, retaining the current UI only as a renderer of server-derived availability. Relevant callers are `src/components/BookNow.js`, `src/components/AppointmentCard.js`, `src/components/AppointmentRescheduleModal.js`, and `src/components/BookingConfirmation.js`.
3. **Proposed third write scope:** migrate/rebuild shop calendar and agendas from `startAt`/`endAt` plus resource zone, then remove or quarantine legacy helpers with incompatible schemas. Relevant files are `src/components/ShopCalendarTab.js`, `src/components/CustomAgenda.js`, `src/components/MobileAgenda.js`, `src/utils/bookingFunctions.js`, and `src/components/BookingManagementFunctions.js`.
4. **Proposed fourth write scope:** change Firestore rules/indexes only alongside server authorization and a data migration plan. The currently tracked rules protect `bookings` but provide no visible `bookedTimeSlots` rule, so deployed configuration must be verified first. `firestore.rules:18-27`, `firestore.rules:66`.
5. **Proposed validation scope:** add unit tests for zone/interval math, emulator transaction tests, browser tests for booking/reschedule/cancel, and regression fixtures for legacy records. The current tracked test does not establish these behaviors. `src/App.test.js:1-8`.

## Unresolved Questions

| Question | Why unresolved | Evidence needed | Impact |
| :--- | :--- | :--- | :--- |
| What is the authoritative timezone for each shop/location? | No IANA field occurs in inspected source. | Redacted production shop samples and product decision. | Defines all date, DST, calendar, and reminder behavior. |
| Are shops single-resource, employee-resource, chair-resource, or capacity-pool businesses? | Current lock may omit employee ID and no resource model exists. | Product policy and production data samples. | Defines deterministic occupancy key and conflict scope. |
| What are duration, buffer, lead-time, cancellation, and reschedule policies? | Code contains a fixed 15-minute client cutoff only. | Written business policy and stakeholder decision. | Determines interval and transition validation. |
| Which booking schemas are live? | Source contains string and timestamp legacy utilities. | Firestore schema census with sensitive fields redacted. | Determines migration and compatibility plan. |
| Are cloud endpoints deployed and which runtime/region is active? | Static source cannot prove endpoint interpolation, auth, region, or runtime timezone. | Firebase CLI/config receipts, deploy metadata, and safe log review. | Required before changing server behavior. |
| Are composite indexes deployed for scheduling queries? | Tracked index file contains only `shopNames`. | `firebase firestore:indexes` or console receipt after authorization. | Current booking/calendar queries may fail at runtime. |
| What behavior is expected for DST gaps/repeated times and overnight opening? | No policy appears in source. | Product decision and acceptance tests. | Prevents silent appointment shifts or impossible bookings. |
| How should historical appointment wall time be preserved during migration? | Existing records omit zone and instant. | Data sample plus migration owner decision. | Avoids corrupting prior records. |

## Evidence Index

| Evidence | Supports | Label |
| :--- | :--- | :--- |
| `src/components/BookNow.js:63-84` | live slot-lock listener | Observed |
| `src/components/BookNow.js:171-195` | customer slot generation and end-exclusive loop | Observed |
| `src/components/BookNow.js:250-297` | employee hour check and non-transactional lock creation | Observed |
| `src/components/BookNow.js:313-367` | booking request and post-response lock mutation | Observed |
| `src/components/DateTimeSelectionStep.js:48-105` | past-date and fixed current-time checks | Observed |
| `src/components/DateTimeSelectionStep.js:182-204` | local civil-date serialization and holiday-only blocking | Observed |
| `src/components/AppointmentRescheduleModal.js:125-145` | fixed 30-minute inclusive-close reschedule slots | Observed |
| `src/components/AppointmentRescheduleModal.js:173-260` | read/check/direct-update/call reschedule flow | Observed |
| `src/components/AppointmentCard.js:183-271` | cancellation lock, function, and direct booking mutations | Observed |
| `src/components/ShopAvailabilityEditor.js:60-120` | special-date taxonomy and persistence payload | Observed |
| `src/components/ShopCalendarTab.js:20-62` | local-day/ISO query boundaries | Observed |
| `src/components/CustomAgenda.js:14-28` | hard-coded agenda slots and rounding | Observed |
| `src/components/MobileAgenda.js:27-43` | mobile hard-coded agenda slots | Observed |
| `src/utils/bookingFunctions.js:67-80` | legacy string-schema availability utility | Observed |
| `src/components/BookingManagementFunctions.js:83-117` | legacy timestamp-schema availability utility | Observed |
| `functions/index.js:58-98` | create-booking validation and stored fields | Observed |
| `functions/index.js:283-323` | cancellation endpoint behavior | Observed |
| `functions/index.js:570-623` | reschedule availability query and state update | Observed |
| `functions/index.js:630-731` | hourly reminder parsing, thresholds, and logging | Observed |
| `firestore.rules:18-27` | tracked booking access rules | Observed |
| `firestore.indexes.json:1-18` | tracked composite-index inventory | Observed |
| `scripts/seed/utils/dates.js:6-75` | seed date/Date/ISO conversion behavior | Observed |
| `scripts/seed/data/bookings.js:65-122` | seeded booking record shape and lifecycle fields | Observed |
| `src/App.test.js:1-8` | current test scope | Observed |
