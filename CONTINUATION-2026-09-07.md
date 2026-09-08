# LedgerLab continuation — 7 September 2026

## Status

This is a **source-only continuation of the supplied version-4 handover**, not a new
published version. No hosted files, saved practice data, access settings, database
migrations or Git remotes were changed. The current live app and remote HEAD were
not accessed or reverified. Historical hosting details remain in `HANDOFF.md`.

Read this document and `VERIFICATION-2026-09-07.md` before relying on older test results.
The source includes tested accounting/persistence changes and UI changes that still
need execution in the complete application. It is **not yet verified for deployment**.

## Changes implemented

### Save, reload and revision handling

`lib/workspace/session.ts` is now the shared client persistence coordinator used by
`components/ledgerlab/app.tsx`. It deduplicates initial loads, prevents overlapping
loads/writes and duplicate submissions, validates server envelopes/revisions, and
exposes distinct loading, saving, rejected, conflicted and unconfirmed states.

A network failure or invalid acknowledgement does not establish that a save failed:
it might have committed. Further writes are therefore blocked until the user reloads
and inspects the saved workspace. The UI no longer presents an unconditional saved
indicator following a failed or unconfirmed request. A definite rejected command can
be corrected and submitted again; a stale revision requires reload.

The real views are mounted after the first successful workspace load, rather than
first mounting editors against the temporary empty initial state. New-case and backup
replacement remount the active view even when the replacement has the same seed.

### Notebook preservation and explicit conflict choices

Notebook text lives in the workspace session rather than only in the Settings view.
It survives navigation within the mounted workspace. Saved text, the draft's base and
the current draft remain distinct, so a reload of the same case does not silently
replace typing when another tab has saved newer notes. The user explicitly chooses
**Use saved notebook** or **Keep my draft** before resolving that conflict.

The Settings screen shows an unsaved-draft notice and a plain-text draft download.
A page-unload warning is installed while notes differ from saved text. Acknowledging
an older notebook submission does not discard later typing. Replacement confirmations
stay open on failed saves and explicitly warn that unsaved drafts are not in a full
saved-state backup.

**Boundary:** drafts are in memory, not a new browser-local storage system. Closing
the browser, ignoring the unload warning, or replacing the active case can discard
unsaved notes. Export or save the draft first. Full backups still contain confirmed
saved state only. Drafts are not retained as a separate history across different seeds.

### Production API validation and atomicity

`app/api/workspace/route.ts` delegates to `lib/workspace/service.ts`. The existing
platform identity header and D1 binding remain in the production wrapper. The extracted
handlers are the actual implementation, not a parallel mock used only by tests.

Incoming requests must have an appropriate JSON media type and a valid revision and
command object. Invalid JSON, null/array payloads, malformed UTF-8, invalid revisions
and cross-site requests are rejected. The request limit is now **3,000,000 UTF-8 bytes**
(instead of the old text-character count), enforced while reading the body, even without
a Content-Length header. The existing **1,500,000-byte** saved-state limit remains.

Commands pass through the unchanged accounting engine, followed by complete backup/state
validation before SQL. Invalid nested command data cannot persist malformed state.
Owner-filtered parameterised queries and compare-and-swap revision updates remain in
place. Concurrent stale saves return conflict rather than overwrite newer state.

### Verification and portability

- `scripts/accounting/persistence-check.ts`: 242 assertions against the actual session
  and request handlers, using Node's in-memory SQLite and the original migration.
- `scripts/accounting/run-portable.mjs`: runs accounting, workflow and persistence
  suites using an already available TypeScript compiler and Node type declarations.
  It does not install dependencies or replace full application verification.
- The normal `npm test` command now includes the persistence suite. The server-render
  fixture was updated for the added context fields but could not be rerun here.
- `scripts/browser/`: a loopback-only Playwright driver, local D1 config and instructions
  for delayed loading, notebook navigation, conflicts, lost acknowledgements, backup/
  restore, the 17 navigation views and a narrow-screen check. **Not executed.**
- Source packaging excludes the old manifest before writing a fresh one, preventing
  duplicate `SOURCE-MANIFEST.json` entries. Extracted ZIPs rebuild using that explicit
  manifest when no Git checkout is present, without collecting unrelated local files.
  Shell files receive executable ZIP modes.
  Build/install bootstraps invoke their environment script through Bash, so archives
  extracted without executable mode bits no longer fail at that handoff.
  `scripts/accounting/package-check.py` verifies inventory, hashes, modes and a
  byte-for-byte source ZIP rebuild outside Git. New source paths added to an extracted
  package must be included in a Git checkout (or its manifest) to enter a later package.

## Preserved boundaries

The accounting engine, source generator, money functions, answer keys, business scenario,
locked dependency versions, migration, saved-state version and existing PDF evidence
were not changed. No bank, payroll-payment, tax-filing or other real-world integration
was added. The owner-only hosted access configuration was not modified or independently
rechecked. A local injected QA identity does not prove the real sign-in boundary works.

## How to continue safely

1. Compare the supplied snapshot with the actual current Sites repository before merging.
   The supplied handover records upstream version-4 commit
   `31c257e4652d87ef3301f1f30d7c572680423a8c`; this continuation did not fetch it.
   The separate patch applies to the **uploaded handover snapshot**, not necessarily
   directly to a newer live branch. Do not apply it blindly over later work.
2. Install the existing locked dependencies in a compatible environment. Run
   `npm run typecheck`, `npm test`, `npm run lint` and `npm run build`. The portable
   suite is useful but is not a substitute for these checks.
3. Use `scripts/browser/README.md` for the real local browser checks. Verify the local
   D1 persistence path against the installed Cloudflare/Vite version first. Never use
   the local QA identity/config against a hosted deployment or add `--remote`.
4. Inspect the mobile layout and test remaining UI workflows: journal/invoice dialogs,
   CSV uploads, bank matching, period locks, report tabs, workpapers and destructive
   confirmations on error. Fix any failures and update the verification record.
5. Only with current publication authorisation and authenticated Sites access, build
   and deploy to the existing project while preserving its private audience. Confirm
   deployment and access after publication. Nothing in this archive authorises it.

No additional plugin was installed. Existing Desktop Commander was available but its
connected machine was offline during this work. No suitable direct access route to the
existing private Sites repository/deployment was available in this conversation. The
remaining local runtime checks need working locked dependencies; deployment additionally
needs the existing Sites access, not a replacement hosting provider.
