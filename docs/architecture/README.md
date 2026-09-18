# Workspace architecture

## Boundaries

Posting rules and the source generator are unchanged. The shared money-input parser now rejects malformed thousands grouping; valid amounts retain the same integer-cent representation. `WorkspaceSession` sends validated commands to either the production API or the standalone's local adapter. The desktop consumes the date-projected company and actual learner journals. React mounts the existing accounting views through its existing portal bridge.

| Module | Responsibility |
|---|---|
| `lib/workspace/app-registry.ts` | Canonical section names, app IDs, search aliases and source release version. |
| `lib/desktop/workspace-menu.ts` | Desktop section-menu rendering from the registry. |
| `lib/desktop/search-index.ts` | Read-only indexing and deterministic ranking; no solution fields. |
| `lib/desktop/command-palette.ts` | Native modal, keyboard selection and focus restoration. |
| `lib/desktop/inspection.ts` | Read-only actual journal/account and lesson inspection. |
| `lib/desktop/task-guidance.ts` | Assignment responsibility/output explanation. |
| `lib/desktop/review-notes.ts` | Validated review-file model, state fingerprint, stages and save commands. |
| `lib/desktop/review-desk.ts` | Review editor, response history, concurrency and draft recovery. |
| `lib/desktop/icons.ts` | Extracted existing desktop icon rendering. |
| `lib/desktop/task-queue.ts` | Pure task prioritisation, follow-up classification, search and bounded pagination. |
| `lib/desktop/ledger-checks.ts` | Actual-ledger diagnostics using only released source data; no worked-answer access. |
| `lib/desktop/health-desk.ts` | Read-only diagnostics UI, inspection links, severity filter and CSV export. |
| `lib/desktop/mail-desk.ts` | Incoming/Sent/Drafts folder state, unread handling and explicit message selection. |
| `lib/desktop/view-state.ts` | Restore focus/caret, disclosure state and scrolling after controlled DOM refresh. |
| `lib/desktop/dialog.ts` | Native top-layer modal close decisions, keyboard containment and focus return. |
| `lib/workspace/local-store.ts` | Validated offline envelopes, explicit memory fallback, storage failure and recovery boundary. |
| `lib/desktop/shell.ts` | Existing window manager and integration of the focused modules. |
| `components/ledgerlab/desktop/workspace.css` | Additive navigation/search/review styles; old accounting CSS preserved. |

## Review state

One reserved desktop note per active month stores the review responses: `UF-review-notes-YYYY-MM`. It uses the existing `saveDesktopFile` command with `expectedUpdatedAt`, workspace revision checking, backup validation and byte limits. No database migration is introduced.

Clearance records the existing assessment fingerprint with only these review-response files excluded. This prevents saving a response from invalidating itself, while changes to other supporting work reopen it. The existing full-month assessment still sees desktop-file changes; rerun a stale full-month review as usual.

Saved history is appended; the file-size limit causes a visible failure rather than silently removing old entries. The editor checks the case identity and original file timestamp before saving, retains drafts after uncertain acknowledgements and preserves orphaned drafts across case replacement.

These are single-learner training controls, not an authorization boundary. A reviewer name or cleared status is not independent approval. Real reviewer identities, separate permissions and immutable server-side audit records would be a separate feature.

## Compatibility and remaining work

All 19 route IDs and 18 accounting app entries remain. Existing financial rules, period controls and old backups are unchanged. No runtime library was added. The existing imperative desktop/React portal boundary is retained.

The large window-manager, explorer and spreadsheet implementations have not been rewritten or exhaustively split. This release extracts focused new responsibilities and the icon catalogue, rather than risking a broad rewrite alongside UX changes.

Detailed historical accounting invariants and hosting identity are in the [archived engineering handoff](../archive/2026-09-07/HANDOFF.md). Never assume its old deployment/test claims describe the current branch.

## Offline persistence

The storage key is unchanged for old backups and same-origin progress. The adapter validates envelopes and the existing backup schema. A persistent write is acknowledged only after `setItem` succeeds. A corrupt existing save is not a blank case. Recovery downloads the original text and requires a separately validated backup plus the literal replacement confirmation, or an explicitly chosen new case.

Browser POST operations use the Web Locks API when available, then check revisions inside the lock. On browsers/origins without Web Locks, only the existing revision check is available; atomic cross-tab exclusion is not claimed there. Storage events warn rather than silently replacing local drafts. Browser storage and profile retention are still outside application control; export backups regularly.

The hosted owner-scoped API and database schema are not changed. The offline app is not a multi-user server or a tamper-proof examination platform. Search/checks respect normal released evidence, but source/test code can reveal case expectations.
