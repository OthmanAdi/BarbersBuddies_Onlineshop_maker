# BarbersBuddies codebase knowledge

This directory is the revision-pinned engineering map for the BarbersBuddies revival. It was produced from tracked source at Git revision `61132dc366e4e30edc9c8a69cde64b010cbb09c4` on branch `codex/barbersbuddies-revival`.

The study was source-only. It excluded environment files, service-account files, credential values, dependency directories, generated media, Firebase cache data, live Firebase resources, installs, builds, emulators, browser runs, and deployments. Individual artifacts record any narrower or supplied receipts.

## Index

| Artifact | Scope |
| --- | --- |
| [00-system-architecture.md](00-system-architecture.md) | Composition roots, persistence boundaries, core journeys, configuration, and cross-cutting reliability risks |
| [10-booking-concurrency.md](10-booking-concurrency.md) | Create, cancel, reschedule, status, duplicate-booking races, idempotency, and target booking invariants |
| [20-calendar-time-model.md](20-calendar-time-model.md) | Current date/time representations, calendar disagreements, timezone and DST risks, and target interval model |
| [30-firebase-security-data.md](30-firebase-security-data.md) | Functions authorization, Firestore Rules, collection contracts, Storage unknowns, indexes, messaging, notifications, and data exposure |
| [40-store-creation-auth.md](40-store-creation-auth.md) | Authentication, ownership, drafts, temp shops, final creation, names/slugs, employee invites, and uploads |
| [50-frontend-routes-ux.md](50-frontend-routes-ux.md) | Route map, customer and owner journeys, responsive behavior, accessibility, state handling, and UI ownership |
| [60-build-tests-dependencies.md](60-build-tests-dependencies.md) | Package boundaries, lockfiles, scripts, runtime expectations, missing gates, dependency risks, and validation order |
| [70-maintainability-history.md](70-maintainability-history.md) | Bounded Git history, dormant or duplicated paths, contradictory configuration, cleanup safety, and extension protocol |

## Reading order

Start with system architecture, then read the artifact for the files you will change. Booking changes require the booking, calendar/time, Firebase security, and frontend artifacts together. Shop-creation changes require the store/auth and Firebase security artifacts together. Dependency changes require the build/tests artifact and an explicit compatibility plan.

## Evidence and trust

- `Observed` means the pinned tracked source or a specifically identified receipt directly supports the claim.
- `Inferred` means the conclusion follows from source but still needs a focused test, product decision, or runtime receipt.
- `Unknown` means source cannot answer the question safely.
- Current source and current focused receipts outrank these artifacts.
- Graphify output is a navigation aid and must be verified in source.
- Checked-in Firebase files do not prove what is deployed.

## Staleness rule

These artifacts are stale wherever current `HEAD` differs from the pinned revision or where deployment state has changed. Before relying on an artifact:

```powershell
git rev-parse HEAD
git diff --name-only 61132dc366e4e30edc9c8a69cde64b010cbb09c4..HEAD
```

If a changed file intersects an artifact's evidence index or domain boundary, refresh that artifact before using it for an architectural, migration, security, or deletion decision. A refresh must record the new commit, scope, exclusions, commands/receipts, confidence labels, exact source citations, unresolved questions, and validation performed. Update this index in the same commit.

## Safety boundary

Do not use this knowledge set as authorization to inspect credentials, run seed/clean or migration scripts, access a Google account, connect to production Firebase, weaken Rules, deploy, or modify live data. Follow the repository [agent instructions](../../AGENTS.md) and [durable memory](../../.agents/memory/MEMORY.md).
