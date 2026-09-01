# BarbersBuddies Revival Plan

## Goal

Revive the newest BarbersBuddies source into a secure, agent-ready, locally runnable product. The critical outcome is that booking, calendar/time, duplicate-prevention, store creation, authorization, and their supporting UI and Functions paths are understood, repaired, and verified through appropriately scoped evidence before any remote integration.

## Non-goals and safety boundaries

- Do not reset, delete, overwrite, or absorb uncommitted work from either attached source folder.
- Do not read, copy, index, commit, or expose credentials, customer data, service-account material, or environment values.
- Do not query, mutate, seed, clean, configure, or deploy a Firebase project without explicit authorization for that project and action.
- Do not claim emulator, browser, deployment, or production proof without a direct receipt.
- Do not turn unresolved product rules, especially appointment capacity and legacy-data migration, into a silent schema migration.
- Do not make broad dependency upgrades or a visual redesign before booking and authorization behavior have focused protection.

## Current phase

**Phases 1 and 2: complete, with an active booking foundation.** Source selection, secret-safe knowledge/Graphify harvest, agent workspace, baseline installs, and the offline Booking v2 ADR are complete. Pure booking domain, time, client command-adapter, and Firestore Rules harness work are complete; the transactional create/emulator slice is active. No v2 path is deployed or activated.

## Milestones

| Phase | Outcome | Status |
|---|---|---|
| 0. Source preservation | Canonical checkout selected, remote compared, original checkout preserved | Complete |
| 1. Baseline and harvest | Source-cited knowledge, sanitized graph, installs, build/test/security baseline | Complete |
| 2. Agent workspace | Durable instructions, memory, knowledge, plan, decision, status, and validation artifacts | Complete |
| 3. Booking and time correctness | One server-authoritative atomic booking lifecycle with deterministic occupancy and idempotency | In progress |
| 4. Store, auth, and Firebase hardening | Verified authorization, rules, indexes, ownership, and creation flow | Pending |
| 5. Frontend and UI repair | Correct state, accessible critical journeys, clear errors and loading states | Pending |
| 6. Dependency and maintainability work | Bounded runtime/package modernization and warning reduction | Pending |
| 7. Integrated verification | Static, isolated, emulator, local browser, and concurrency receipts | Pending |
| 8. Delivery | Logical commits, fresh remote comparison, safe push to `main`, and handoff | Pending |

## Acceptance criteria

- A new agent can orient from `AGENTS.md`, `llms.txt`, `.agents/memory/`, `docs/knowledge/`, and this control plane without chat history.
- Supported booking operations cannot create duplicate or overlapping occupancy records, including retry and concurrent-request cases.
- Booking timestamps are derived from explicit shop-zone civil time and persisted as an unambiguous interval.
- Store creation and protected data operations derive authorization from verified identities and authoritative documents, not request-body ownership or client-selected roles.
- Rules, Functions, client contracts, indexes, and tests agree on the supported schema and state transitions.
- Clean installs, focused tests, production build, emulator coverage, and browser journeys have separately recorded outcomes.
- Every commit is narrow, reviewed for secret/generated content, user-authored only, and compared against freshly fetched `origin/main` before a push.

## Firebase gates

Offline work is authorized; production Firebase work is not.

1. No live Firebase access until the user supplies or authorizes the exact project and operation.
2. Emulator work must use a confirmed disposable non-production project ID and disposable data.
3. Production-only proof remains blocked for deployed Functions, rules, indexes, Storage rules, Auth providers, data migrations, Hosting, and real booking records.
4. No `npm run seed`, `npm run seed:clean`, migration, or deploy command may run against an unknown or live project. `seed:clean` is destructive.
5. Seed hardening is complete in the worktree but has not yet received an emulator seed receipt. Any historically used non-disposable credential requires rotation and history remediation review before release.

## Planned commit sequence

1. `docs: establish revival knowledge and agent workspace`
2. `security: make demo seeding emulator-only`
3. `test: establish booking domain, client API, Rules, and emulator foundations`
4. `feat(booking): enforce atomic idempotent booking lifecycle`
5. `fix(calendar): adopt explicit booking interval and timezone contract`
6. `fix(auth): harden store ownership, Functions authorization, rules, and indexes`
7. `fix(ui): repair booking, creation, calendar, and accessibility journeys`
8. `chore(deps): modernize bounded dependency and runtime boundaries`

The exact order may change only when a prerequisite receipt demonstrates a smaller safe sequence.

## Active blockers

| Blocker | Effect | Handling |
|---|---|---|
| Firebase production access intentionally unavailable | No live configuration, data, deployment, or production-flow proof | Continue with static, mocked, and disposable-emulator work; wait for explicit access |
| Booking capacity, lead time, buffer, cancellation, timezone, and legacy migration policy are unresolved | A final production data contract cannot be safely invented | Record a proposed contract, add tests around invariants, and request/await final product input before migration/deployment |
| Legacy full client suite fails before assertions (`TextDecoder` under Node 24 / legacy CRA-Jest-Firebase path) | Existing Firebase-importing test path remains unverified | The focused Firebase-free booking API suite passes 20/20; repair or replace the legacy bootstrap separately |
| Current Functions package declares Node 20 while local focused tests use Node 22 | Node 22 receipts are not declared-runtime compatibility proof | Run the emulator matrix under Node 20 before release; treat Node 22 migration as a separate proposal |
| Shop timezone, capacity, service/buffer, abuse, cancellation, and legacy migration policy are unresolved | No safe production activation/migration | Keep v2 feature flag off; use ADR fixtures only until user-authorized product/data evidence exists |

## Next action

Review and integrate the active transactional-create slice against ADR 001. Next, implement cancel/reschedule transaction services and named HTTPS export wiring, then execute the disposable Auth/Firestore/Functions emulator acceptance matrix before any UI mutation cutover.
