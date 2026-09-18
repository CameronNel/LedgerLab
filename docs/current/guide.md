# LedgerLab 3.2: your daily workspace

## Start and find your work

Open `public/offline/LedgerLab-Workstation.html` in a desktop browser. A fresh case begins on 1 July 2025 in the financial-manager role with a messy handover. Today opens first. Read the onboarding email, open its assignment and inspect the supplied evidence.

The seven permanent sections are Today, Work, Close, Reports, Files, Learn and Settings. Today is the home screen; the desktop is its environment, not a competing finance desk. Classic navigation uses the same registry and retains old bookmark IDs.

Today presents one recommended action and a short next queue before optional guidance. Critical control tasks and due follow-ups take priority. A future follow-up is not due now, and Waiting is never treated as completed.

Choose **My tasks** to search references, source titles, people or descriptions. Combine status and work-area filters. Only arrived work is included. Lists show 20 tasks per page with the exact matching count. Reset filters returns to the starting view. Routine instructions and tool guidance can be expanded when needed.

## Search and work beside the evidence

Press **Ctrl+K** on Windows/Linux or **Cmd+K** on macOS, or choose Search. Search available source documents, assignments, actual journals, accounts and lessons. All query words must match; exact references rank first. Up/down selects a result, Enter opens it and Escape returns to your work. Future evidence and task-answer fields are not searched. Recycled files are excluded; changing the case closes stale search results.

Account and journal results open read-only activity with source links. Lesson results explain the concept without posting the worked example into your case.

Choose **Open evidence + work** in an assignment to open its released source beside the working area. On narrow screens, use the taskbar to switch windows. Opening evidence does not capture an invoice, fill an answer, match a bank line or post a journal.

Expand **Why is this on my desk?** for the business reason, responsibility, expected output and supportable completion criteria. Waiting items retain their owner, follow-up date and original deadline.

Amounts use a dot for decimals. `1234.56` and `1,234.56` mean the same amount; `1,2` is rejected rather than silently becoming 12. Rejected input stays on screen. Save draft and Submit response remain separate actions.

## Review and investigate

**Close → Review notes** shows available assignments, their actual check results and saved responses. Search or filter the review list, and export original findings and response history. Stages include Open, Prepared, Changes requested and Cleared (training check).

Clearance requires the underlying task to pass. Changed supporting work invalidates stale clearance without deleting history. These stages do not post entries, submit assignments, close months, certify narrative quality or represent approval by an independent human reviewer.

Review notes are structured text files under `Working papers/<month>/Review notes` and are included in ordinary backups. Do not edit their JSON manually. Malformed or recycled files are not overwritten silently. The existing 30,000-character file limit is enforced without truncating history.

**Close → Ledger checks** reports the selected accounting month and evidence cut-off. Journal findings cover that month; suspense is cumulative through the cut-off. It flags possible duplicate postings, repeated journal IDs, unbalanced or invalid lines, unknown accounts/control contacts, missing source links, suspense and unmatched arrived bank lines. CSV exports contain all current findings, not just the visible page.

These are advisory questions, not automatic corrections. A manual adjustment without a source link may be valid, and recurring journals can look similar. Reversal-linked originals are excluded from duplicate suggestions. Inspect the evidence before reversing anything. No findings does not replace reconciliations, full month review or professional judgement.

## A less noisy inbox

Inbox, Sent and Drafts are distinct. Only incoming unread correspondence contributes to the unread count. Changing folders does not mark mail read. A link to a particular message clears stale filters so that message opens. All correspondence is fictional; nothing is sent to real people or institutions.

## Save, migrate and recover safely

**Export a backup before upgrading or replacing a case.** The current standalone uses a browser database with transactional saves. Checking the revision and saving the next payload happen together; a competing tab receives a conflict instead of overwriting newer work. A save is confirmed only after its transaction commits. Quota errors, aborts and lost acknowledgements retain explicit failure/uncertainty states rather than claiming success.

On first use, validated data from an older localStorage version is migrated. The original bytes are retained for recovery. Later sessions use the database, not the old copy. Old and new application versions do not keep their separate stores synchronized: use a backup to transfer between them. See [transactional storage](transactional-storage.md) for the persistence boundary and migration details.

A corrupt or missing saved payload opens recovery instead of silently generating a new case. Download the original stored data, select a valid backup, and type **REPLACE SAVED DATA** to restore. Starting fresh is a separate explicit choice. Recovery advances the revision so that an older tab cannot overwrite the restored case.

The amber banner identifies a memory-only session or changes from another tab. **Backup saved work**, the Settings backup action, or **Ctrl/Cmd+Shift+S** exports confirmed saved state. Unsaved workbook/response drafts are excluded; save or download them separately. The small-screen backup label wraps rather than hiding part of its action.

A failed or uncertain save keeps its draft. Reload to resolve uncertainty before retrying. When newer saved work conflicts with a draft, download the old draft and explicitly load/discard to the latest saved version. Switching assignments cannot silently discard unsaved review responses. Closing offers Save, Discard and Cancel; Escape cancels. Replacing even the same case makes prior draft ownership stale. Unsaved end-of-day notes also require recording, downloading or deliberate discard.

Browser persistence belongs to an origin and profile. Localhost tests do not prove every browser allows durable `file://` storage. An unavailable persistent database reports an error instead of silently downgrading saves. Opaque previews remain explicitly memory-only. Clearing all site data may remove both the database and the legacy recovery copy. Regular exported backups remain necessary.

## Keep the dates and actions separate

The PC date controls evidence arrival. The source/effective date controls accounting. The open accounting month controls the close. Reading mail, saving a workbook, submitting an assignment, checking work, submitting a month review, closing a period and releasing the next month are separate operations.

The case remains one fictional AUD 2025 entity with one open accounting period. There are no additional operating years, parallel periods, consolidation, operational FX, purchase-order/payment execution or real multi-user approvals. Full dependency-backed application type checking, tests and a production build have passed; the privately hosted application has not been deployed from this release.

For the detailed calendar and unchanged case scope, see the [archived day-by-day guide](../archive/2026-09-07/DAY-BY-DAY-V3.md). For actual verification outcomes, see the [verification record](verification.md).
