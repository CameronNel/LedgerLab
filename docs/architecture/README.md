# Workspace architecture

## Boundaries

The financial engine and source generator remain unchanged. `WorkspaceSession` sends validated commands to either the production API or the standalone's local adapter. The desktop consumes the date-projected company and actual learner journals. React mounts the existing accounting views through its existing portal bridge.

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
