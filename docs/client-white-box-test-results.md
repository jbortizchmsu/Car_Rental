# Client-Side White-Box Testing Results

Structured / Internal Logic Testing — Web and Mobile Pure Utility Functions

This log is separate from `server/docs/white-box-test-results.md` (which uses `WB-` numbering
for the backend) since web and mobile are distinct projects with their own `package.json`s and
test runners. Test case IDs here use a `CU-` (Client Utility) prefix instead, so the two logs
can be combined later without ID collisions. Kept as a single combined file (rather than
separate `web/docs/` and `mobile/docs/` files) since the total client-side pure-function surface
is small (21 tests across 6 functions) and splitting it across two near-empty per-project files
would fragment a single, small, cohesive testing effort for no real benefit.

## Web — Vitest (`web/`)

**Framework choice:** Vitest, not Jest. `web/` is a Vite project (`"type": "module"`, Vite 8);
Vitest shares Vite's own config and esbuild-based transform pipeline, so TypeScript/ESM works
out of the box with zero extra `ts-jest`/Babel configuration, while its API (`describe`/`test`/
`expect`) is Jest-compatible. Installed as a devDependency; `vitest.config.ts` added
(`environment: 'node'`, since these are pure functions with no DOM interaction); `"test": "vitest run"`
script added to `package.json`.

**Production changes made (approved by the user before proceeding):**
- `web/src/components/BookingRequestModal.tsx`: `formatApiDate` changed from an unexported
  module-scope `const` to `export const` (no behavior change — same implementation, just made
  importable).
- `getLocalStartOfToday` and `isToday` were relocated from inside the `BookingRequestModal`
  component's function body out to module scope (as `export const`s, same as `formatApiDate`),
  since they can't be exported while nested inside a function. Both were previously used exactly
  once each inside the component (line ~445 and ~696); after removing the local declarations,
  those call sites now resolve to the module-scope versions automatically — no call-site changes
  were needed. Verified with `npx tsc --noEmit`: no new type errors anywhere in the project.

## Mobile — Jest + jest-expo (`mobile/`)

**Framework choice:** `jest-expo` (Expo's own recommended preset), pinned to `jest-expo@~54` to
match this project's Expo SDK 54 / React 19.1.0 — the latest `jest-expo@57` has a peer dependency
on React `^19.2.3` and installing it produced an `ERESOLVE` conflict against this project's pinned
`react@19.1.0`. `"preset": "jest-expo"` added under a new `"jest"` key in `package.json`;
`"test": "jest"` script added.

**Empirically confirmed blocker (before any extraction):** merely *importing*
`BookingFormScreen.tsx` from a test file — regardless of what is or isn't exported — crashes Jest,
because the file's own top-level imports include `@react-native-async-storage/async-storage` and
other native modules that fail outside a real app/device runtime (`[@RNC/AsyncStorage]: NativeModule:
AsyncStorage is null`). This ruled out a simple "just add `export`" fix for the mobile functions —
confirmed by a throwaway diagnostic import before any real work began.

**Production changes made (approved by the user — extraction of the 3 pure formatters only):**
- Created `mobile/src/utils/booking-form-utils.ts` containing `formatDateOnly`,
  `formatExpiryDisplay`, and `calcDays`, extracted verbatim (no logic changes) from
  `BookingFormScreen.tsx`.
- `BookingFormScreen.tsx` now imports these three from the new file instead of declaring them
  locally; `formatDisplay` (not requested for testing) was left in place, unchanged.
- **`checkIsInProgress` was explicitly NOT extracted or refactored**, per the user's choice — it
  remains a closure over component state/refs inside `BookingFormScreen.tsx`, untested this round.
  Testing it would require rewriting it to accept explicit parameters instead of closing over
  component state, which the user chose not to do in this round.
- Verified with `npx tsc --noEmit` (mobile project): no new type errors.

---

## Shared Date Helpers (identical implementations in both web and mobile)

`formatApiDate` and `getLocalStartOfToday` exist as byte-identical copies in both
`BookingRequestModal.tsx` (web) and `BookingFormScreen.tsx` (mobile). Per this round's scope,
only the web copy was tested directly — the mobile copy of `formatApiDate` was left untouched and
unexported (not part of the approved mobile extraction), since it wasn't one of the three
functions the user approved for extraction. The logic itself is proven correct via the web tests
below; the mobile copy's identical source text means the same behavior applies there too, but
this was not independently re-verified through a mobile-side test.

| Test Case ID | Module/Function | Branch or Path Tested | Test Data | Expected Result | Actual Result | Pass/Fail | Remarks |
|---|---|---|---|---|---|---|---|
| CU-001 | formatApiDate (web) | Single-digit month/day/hour/minute/second | `new Date(2026, 0, 5, 3, 4, 5)` | `'2026-01-05T03:04:05'` | `'2026-01-05T03:04:05'` | Pass | Covers the identical mobile copy's logic by inspection (byte-identical source), not independently re-tested on the mobile side. |
| CU-002 | formatApiDate (web) | All double-digit components | `new Date(2026, 11, 25, 23, 45, 30)` | `'2026-12-25T23:45:30'` | `'2026-12-25T23:45:30'` | Pass | |
| CU-003 | getLocalStartOfToday (web) | Returns midnight of today | Called with no args | `hours/minutes/seconds/ms === 0`, Y/M/D matches `new Date()` | All fields matched exactly | Pass | |

## Web — `isToday` (server/src/components/BookingRequestModal.tsx)

| Test Case ID | Module/Function | Branch or Path Tested | Test Data | Expected Result | Actual Result | Pass/Fail | Remarks |
|---|---|---|---|---|---|---|---|
| CU-004 | isToday | `null` input | `isToday(null)` | `false` | `false` | Pass | |
| CU-005 | isToday | Date matching today's calendar date, different time-of-day | `new Date(y, m, d, 23, 59, 59)` (today, end of day) | `true` | `true` | Pass | |
| CU-006 | isToday | Date one day before today | Yesterday | `false` | `false` | Pass | |
| CU-007 | isToday | Date one day after today | Tomorrow | `false` | `false` | Pass | |

## Web — `getRelativeTime` (web/src/lib/notification-types.ts)

| Test Case ID | Module/Function | Branch or Path Tested | Test Data | Expected Result | Actual Result | Pass/Fail | Remarks |
|---|---|---|---|---|---|---|---|
| CU-008 | getRelativeTime | `< 1 minute` ago | 30 seconds ago | `'just now'` | `'just now'` | Pass | |
| CU-009 | getRelativeTime | `< 60 minutes` ago | 45 minutes ago | `'45m ago'` | `'45m ago'` | Pass | |
| CU-010 | getRelativeTime | `< 24 hours` ago | 5 hours ago | `'5h ago'` | `'5h ago'` | Pass | |
| CU-011 | getRelativeTime | `< 7 days` ago | 3 days ago | `'3d ago'` | `'3d ago'` | Pass | |
| CU-012 | getRelativeTime | `>= 7 days` ago (fallback) | 10 days ago | Falls through to `toLocaleDateString()` | Matched `date.toLocaleDateString()` exactly | Pass | |
| CU-013 | getRelativeTime | Accepts both a `string` and a `Date` for the same instant | Same instant passed as `Date` and as `.toISOString()` string | Identical output for both | Identical output confirmed | Pass | |

## Mobile — `formatDateOnly` / `formatExpiryDisplay` / `calcDays` (mobile/src/utils/booking-form-utils.ts, extracted from BookingFormScreen.tsx)

| Test Case ID | Module/Function | Branch or Path Tested | Test Data | Expected Result | Actual Result | Pass/Fail | Remarks |
|---|---|---|---|---|---|---|---|
| CU-014 | formatDateOnly | Single-digit month/day | `new Date(2026, 0, 5)` | `'2026-01-05'` | `'2026-01-05'` | Pass | |
| CU-015 | formatDateOnly | Double-digit month/day | `new Date(2026, 11, 25)` | `'2026-12-25'` | `'2026-12-25'` | Pass | |
| CU-016 | formatExpiryDisplay | `null` input | `formatExpiryDisplay(null)` | `'Select license expiry date...'` | `'Select license expiry date...'` | Pass | |
| CU-017 | formatExpiryDisplay | Valid `Date` | `new Date(2026, 5, 15)` | Matches `toLocaleDateString('en-PH', {month:'short', day:'numeric', year:'numeric'})` | Matched exactly | Pass | |
| CU-018 | calcDays | Normal multi-day range | 3 days apart | `3` | `3` | Pass | |
| CU-019 | calcDays | Same start/end date | Identical `Date` for both args | `1` (clamped, never `0`) | `1` | Pass | |
| CU-020 | calcDays | End date before start date | End 3 days earlier than start | `1` (clamped, never negative) | `1` | Pass | |
| CU-021 | calcDays | End a few hours after start, same calendar day | 11 hours apart, same day | `1` (rounds up via `Math.ceil`) | `1` | Pass | |

## Blocked — Not Tested This Round

`checkIsInProgress` (`mobile/src/screens/BookingFormScreen.tsx`) — the user chose not to extract
or refactor it this round (see "Production changes made" above). It remains a `useCallback`
closure over component state/refs (`hasSubmittedRef`, `step`, `destinationName`, etc.) and cannot
be imported or tested in isolation without either (a) extracting its logic into a pure function
taking explicit parameters, or (b) mocking every native module `BookingFormScreen.tsx` transitively
imports just to load the file at all. Test cases 20-24 from the original task scope (`hasSubmittedRef.current
=== true`, `step > 1`, destination-fields-filled, other-fields-filled, all-empty) are **not
implemented** — no test IDs were reserved for them, so a future round can pick up at CU-022 once
an extraction decision is made.
