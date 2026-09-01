# BarbersBuddies Revival Decisions

## DEC-001: preserve source and implement in a clean worktree

Use the canonical original checkout only as protected evidence and implement in the clean `codex/barbersbuddies-revival` worktree. The adjacent onlineshop folder is not an alternate source of truth. Do not reset, stash, or alter user-owned original state.

## DEC-002: Firebase and delivery remain offline by default

No production Firebase or Mailgun action without exact user authorization and configuration. Use disposable emulators for behavior evidence. No push, deploy, migration, seed, or credential use has occurred.

## DEC-003: booking v2 is additive and dark-gated

Create, cancel, and reschedule are server-authoritative named commands with idempotency, versioning, strict civil-time validation, deterministic five-minute occupancy, and transaction read-before-write. Keep activation dark except Functions emulator or explicit `BOOKING_V2_ENABLED=true`.

## DEC-004: identity and public error contracts are strict

Guest create is permitted; cancel/reschedule require a verified Firebase identity, with one controlled normalized-email binding path for compatible legacy/guest bookings. Public responses use canonical error codes and never expose internal errors, keys, or PII.

## DEC-005: notifications use immutable, PII-free snapshots

The outbox stores routing metadata, not recipient/body/raw provider payload. Notification content must render from an immutable event snapshot so later booking changes cannot rewrite historical messages. The snapshot requires canonical `startAt`, IANA timezone/civil time agreement, and explicit currency `minorUnitDigits`; do not assume all currencies have two decimal places.

## DEC-006: delivery is at-least-once, not exact-once

Lease-based outbox claiming and deterministic message correlation reduce duplicate risk but cannot prove exactly-once delivery. The worker/index/scripts are committed at `c8c4ebd` and independently pass Node 20/22 unit 10/10 plus emulator 9/9 after the Mailgun `Error`-subclass normalization repair. Mailgun has no verified provider idempotency key in this integration, so a crash after acceptance may cause retry. Do not export or schedule the worker until resolver, producer, and configuration are complete.

## DEC-007: currency and notification snapshots require explicit authority

`4c123c6` commits an explicitly supported EUR/two-minor-digit policy and a pure snapshot builder that accepts only exact trusted fields and canonicalizes a timestamp before template validation. Do not broaden currencies, fabricate minor-unit metadata, or silently coerce legacy/non-EUR data. Event ID and snapshot-producer linkage remain separate active integration work.

## DEC-008: store/UI cutover requires real product inputs

The v2 store schema is additive only. Do not wire legacy store creation or calendar UI until timezone, currency/minor-unit policy, services, resource/employee scheduling, capacity, consent/cancellation policy, and migration conflict handling are explicitly decided or evidenced. `bca4afc` fixes the payment-step implicit-submit duplicate-store trigger, but durable server-side store idempotency remains required.

## DEC-009: legacy calendar/direct edits are P0 cutover blockers

The legacy client must not be treated as a v2 caller: it converts civil dates via UTC serialization, models availability as matching time strings rather than intervals/resources/buffers, and permits arbitrary direct booking updates. `74ebb35` provides pure civil-time primitives only; it intentionally lacks `24:00` and cross-midnight policy and has no component cutover. Replace paths only behind the v2 command and emulator/browser evidence; do not patch them with additional client-only checks.

## DEC-010: knowledge tools are navigational, receipts are authoritative

Planning With Files, Codebase Knowledge Builder, Graphify, agent memory, and project guidance are maintained for resumability. Graph/query results guide exploration but material claims require source inspection or a scoped test/emulator receipt.

## DEC-011: shop creation is server-owned but remains dark

`417c48b` validates the server-owned v2 shop schema and `64b44eb` supplies atomic idempotent creation. `95a1625` supplies its HTTP boundary. Do not export or activate that boundary until the frontend/store orchestration is accepted and the emulator/browser release gates are met.

## DEC-012: blank emulator boot is a startup receipt only

The blank dev application must use the disposable Firebase emulator project and safe Storage policy. A listening service set and rendered Chrome DOM prove startup, not booking/store behavior, persistence, authorization, or production readiness.

## DEC-013: environment is decided once before Firebase initialization

The application creates one frozen runtime value at bootstrap. Firebase initialization, diagnostics, and local persona tooling consume that same value. `NODE_ENV` accepts only `development`, `test`, or `production`. Demo access can be enabled only in development, in emulator mode, with a `demo-*` project ID. Attempts to force it in production or against live Firebase fail before any Auth or Firestore call.

## DEC-014: test identities are named personas, not shared credentials

Local feature testing uses an immutable persona registry and an injected provisioning controller. The professional persona uses Firebase Anonymous Auth, creates only its own emulator profile, contains no password or reusable token, coalesces repeated entry, and refuses profile conflicts. Future personas must extend this registry and retain the same runtime boundary.

## DEC-015: local emulator startup owns the Windows Java workaround

The repository command, not operator memory, owns the short Windows `TEMP` and `TMP` path needed by the Firestore emulator on this host. The launcher stays hard-pinned to `demo-barbersbuddies` and the exact Auth, Firestore, Functions, and Storage service set.

## DEC-016: a repaired subsystem does not close a user-facing issue

GitHub issue #2 remains open. Backend booking invariants and local tests do not establish that the public issue is fixed. Closure requires the supported browser booking flow, duplicate-attempt behavior, calendar result, remote integration, and a reproduction against the delivered revision.
