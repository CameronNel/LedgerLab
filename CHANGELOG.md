# Changelog

## 3.2.0 · 18 September 2026

- Compact Today, meaningful processing titles, available-work category counts, search/status/work-area filters, 20-row pagination and urgent/follow-up prioritisation. Future evidence remains unreleased.
- Read-only actual-ledger diagnostics and CSV export; duplicate/reversal/source/account/contact/bank/suspense safeguards. No automatic correction or approval.
- Exact money-input validation: reject malformed grouping rather than silently changing amounts.
- Local storage validation, quota-safe acknowledgements, raw-data recovery, deliberate restore, Web Locks around browser writes and visible memory/cross-tab notices.
- Native top-layer close dialogs, input focus/caret/scroll retention, and draft invalidation on same-case restoration. End-of-day notes are protected as unsaved work.
- Mail controller extracted; Inbox/Sent/Drafts folders and correct incoming unread counts. Explicit message links clear stale filters.
- Review filters/pagination/history export; utility registry shared with search; accessible combobox result announcements; saved-work backup shortcut.
- Package release version synchronised. One stable current HTML path, without accumulating another obsolete bundle. Earlier 3.1 remains in Git history.
- New domain and browser regression suites and actual-origin persistence/restart/concurrency CI coverage. See current verification for executed status and limitations.


## 3.1.0 · 18 September 2026

- Centralized all existing app IDs and names in one seven-section registry.
- Added permanent desktop navigation and grouped classic navigation without removing tools.
- Added keyboard-accessible global search over released evidence and actual learner work.
- Added read-only journal/account inspection and focused lesson viewing from search.
- Added paired evidence/work opening, task-purpose explanations and a waiting-items summary.
- Added training review responses with append-only response history within the saved note, original findings, stale-clearance checks and safe draft recovery. This is not an independent-reviewer permission system.
- Extracted desktop icon rendering and new search/menu/review/inspection responsibilities into separate modules; retained the existing window-manager implementation.
- Organized documentation into current, architecture and historical sections.
- Added 87 domain assertions and 39 Chromium interaction assertions for the new features.
- Fixed the sidebar collapse-state type and aligned the full-app TypeScript target with ES2022; dependency-backed type checking passed on GitHub.
- Kept the accounting engine, tax assumptions, storage schema and hosted deployment unchanged.

## Earlier source releases

See [the archive](docs/archive/README.md) for the original v3 day-by-day job, v2.1 month review, v2 workstation and earlier finance/takeover releases.
