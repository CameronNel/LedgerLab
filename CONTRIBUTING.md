# Contributing

## Make a bounded change

Read the current guide and architecture. Inspect the target branch before editing. Preserve existing user work and stable route IDs. Prefer small feature modules to replacing the accounting engine or desktop wholesale.

## Required checks

Run `npm run typecheck`, `npm test` and `npm run build` with the locked dependencies. For desktop changes also build the standalone and run the Chromium suites listed in `docs/current/verification.md`. A portable-domain pass is useful but does not replace a full-app build.

Add regression tests for failure paths, source-availability boundaries, stale saves, backups and draft recovery. Never put generated solved fixtures, test backups, browser profiles, credentials or personal company data into the distributable HTML or source package.

## State and accounting rules

Amounts remain safe integer cents. Posted journals are corrected through reversal/replacement, never silently edited. Independent source statements must not be rebuilt from an erroneous learner ledger. Review status must not imply statutory completeness or independent professional approval.

New optional state must preserve old backups. Use existing validated commands and optimistic concurrency; UI validation alone is insufficient. Saved review responses use the existing desktop-file command and do not write accounting journals.

## Release

Rebuild `public/offline/LedgerLab-Workstation.html` after imported source or CSS changes. Run `python scripts/accounting/package-source.py` to build a source ZIP with an explicit inventory. Keep verification claims dated and name the exact commands actually executed.

Changes to the repository do not deploy the hosted app. Publishing must preserve its current identity, data binding and private audience, and requires separate verified deployment steps.
