# BarbersBuddies Revival Validation Ledger

This ledger distinguishes evidence classes. A pass in one class does not imply a pass in another.

## Static evidence

| Command | Outcome | Limits |
|---|---|---|
| `Get-ChildItem -LiteralPath functions -Recurse -Filter *.js \| ForEach-Object { node --check $_.FullName }` | Pass, 4/4 tracked Functions JavaScript files parse on Node 24.12.0 | This is syntax only, not Node 20 runtime or Firebase behavior |
| `npm ls --all` in `functions` | Pass, no invalid/extraneous dependencies; one optional `encoding` dependency is unmet | Dependency-tree receipt only |
| Graphify extract/build/diagnose on sanitized code corpus | Completed, but diagnostics report dangling/self-loop/collapsed edges | Navigation aid only; not a correctness gate |

## Isolated evidence

| Command | Outcome | Limits |
|---|---|---|
| `npm test -- --watchAll=false --runInBand` | Fail before assertions: `ReferenceError: TextDecoder is not defined` through Firebase Auth/undici under Node 24 and legacy CRA/Jest | The legacy Firebase-importing suite remains unverified |
| Focused `src/api/bookingCommands.test.js` | Pass, 20/20 CRA tests and ESLint pass | Firebase-free client-adapter receipt only; not a UI journey or backend proof |
| `functions/test/booking/domain.test.js` plus `time.test.js` | Pass, 36/36 under local Node 22.20.0 | Pure domain/time receipt; Node 22 is not the declared Functions runtime |
| Transactional create tests | Active, no final integrated receipt | Do not claim a pass until the committed emulator command runs |

## Build evidence

| Command | Outcome | Limits |
|---|---|---|
| `npm ci --ignore-scripts` | Pass at repository root, 1,785 packages installed | Initial audit: 96 advisories (14 low, 33 moderate, 42 high, 7 critical); lifecycle behavior not tested |
| `Push-Location functions; npm ci --ignore-scripts; Pop-Location` | Pass, 264 packages installed | 25 advisories: 1 low, 8 moderate, 13 high, 3 critical; Functions declares Node 20, host is Node 24 |
| `npm run build` | Pass on Node 24.12.0 | Warning-heavy CRA build; roughly 1.21 MB gzipped main bundle; does not exercise Firebase or a browser journey |

## Emulator evidence

Firestore Rules have a bounded disposable-project receipt: 25/25 tests passed for `demo-barbersbuddies` using Firebase CLI 15.28.2 and Rules Unit Testing 3.0.4. This proves only the checked-in Firestore policy harness; Auth, Functions, transactions, concurrency, and full application flows remain unverified.

Planned shape once committed and explicitly configured:

```powershell
npx --no-install firebase emulators:exec --project <DISPOSABLE_PROJECT_ID> --only auth,firestore,functions "npm run test:emulator"
```

This must cover rules, identity/tenant checks, guest/authenticated create, idempotency, at least 20 concurrent overlap attempts, cancellation/reschedule occupancy changes, time/DST edge cases, and store-creation ownership. Run it under Node 20 before treating it as a release gate. Do not replace placeholders or record a pass until the prerequisites exist.

## Browser evidence

**Not run.** No local app session or browser receipt exists for sign-in, store creation, booking, duplicate attempts, calendar rendering, cancellation/reschedule, accessibility, responsive layout, or error recovery.

Required eventual local commands begin with:

```powershell
npm start
```

The runtime target, port, Firebase mode, and test data must be recorded before browser results are considered valid.

## Deployment evidence

**Not run.** No authorized deploy, deployed Rules/indexes comparison, Hosting verification, or Functions runtime metadata has been collected.

Do not run `firebase deploy` or Firebase configuration commands without explicit project-level authorization.

## Production evidence

**Blocked by design.** Production credentials and authorization are pending from the user. No production reads, writes, booking attempts, configuration changes, seeds, migrations, or deployments have been performed.

## Current validation conclusion

The code installs and produces a browser bundle on this host. It now has focused domain/time, client-command, and Firestore Rules receipts, but no complete frontend suite, Auth/Functions/concurrency emulator proof, browser proof, Node 20 compatibility proof, or Firebase production evidence. Those missing gates are release blockers for booking, authorization, and data-safety claims.
