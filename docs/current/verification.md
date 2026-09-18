# Workstation 3.2: verified second pass

18 September 2026. The second-pass starting point was `f1b7f316da2028316b013c05ec3bf2403e7a92a8` on `ux/clearer-daily-workspace`. This record supersedes earlier statements that the full application had not been built and that Web Locks around localStorage were sufficient for offline concurrent saves.

## Completed integration run

GitHub Actions run [35325647902](https://github.com/CameronNel/LedgerLab/actions/runs/35325647902), for source commit `894ece7ea8ae0e0ff83b595e2e05b763fff80dab`, completed successfully. Both the full-application and standalone jobs passed. Run [35325795911](https://github.com/CameronNel/LedgerLab/actions/runs/35325795911) subsequently passed those jobs and generated the verified release artifacts.

The full-application job installed the locked dependencies and executed `npm run typecheck`, `npm test`, and `npm run build`. The standalone job ran the portable domain/API suites, strict standalone compilation, first-party syntax checks, bundle generation, and all seven Chromium drivers: transactional storage, clarity, workspace, workday, workstation, month review and clipboard.

The portable domain/API suite contains 77,006 assertions. The seven completed browser drivers recorded 366 assertions/milestones without uncaught page errors. These are checks, not independent real-world scenarios or professional certifications. The storage driver additionally runs 50 competing-writer rounds, alternating start order and checking one committed write, one rejected stale write, the exact winning payload, and a revision advanced exactly once. Repeated internal assertions are not represented as thousands of new scenarios.

## Defects found and addressed

Earlier revisions failed real-origin stress testing: two tabs could both acknowledge a same-revision localStorage write. The final standalone uses IndexedDB, with revision comparison and payload/revision updates inside one transaction. Save acknowledgement waits for transaction completion. The tests retain the original concurrency requirement; it was not removed or weakened.

Coverage includes a thrown quota error, transaction abort after a successful put, browser-process restart, lost acknowledgement with retry blocked until reload, operation without Web Locks, legacy migration with original bytes preserved, corrupt startup, explicit validated recovery, stale writes after recovery, and removed payloads without silent reseeding.

A separate recovery screenshot timed out when its tab was in the background. The driver foregrounds that tab before capture while retaining the second tab for the stale-write test. The full browser run then completed successfully.

The second pass also added strict money-format validation, task prioritisation and pagination, clearer mail folders and unread counts, advisory ledger checks, review search/export, native close-dialog focus handling, and stronger unsaved-draft ownership checks. Financial command validation, source independence and the dated AUD 2025 teaching assumptions remain intact.

## Final visual correction

Inspection of the retained narrow-screen screenshot found that the backup button's text overflowed its border even though its border fitted the viewport. A shared responsive stylesheet now fixes that in both the React layout and standalone build. `check-responsive.py` checks the actual text rectangles, not only the border box, at 320, 390, 600, 768 and 1440 pixels. It also executes the small-screen backup action. All 20 checks passed locally; this eighth driver is now required in CI. Consult the latest source commit's Actions run for its final integrated outcome and screenshot artifact.

## Reproducible delivery

The CI package job runs only after both application and browser jobs succeed. It rebuilds `public/offline/LedgerLab-Workstation.html` twice and compares the files, refreshes `SOURCE-MANIFEST.json`, verifies the complete source archive and a byte-identical rebuild outside Git, and publishes the app/source/checksums as `ledgerlab-verified-release`.

For a same-repository pull request, only the generated HTML and source manifest may be committed by that job. A moved branch stops the write rather than overwriting newer work. Browser screenshots and JSON check summaries are a separate artifact; generated case fixtures and learner backups are not included in those deliverables. The artifact's `SOURCE-COMMIT.txt` identifies the packaged source. Consult the corresponding Actions run for any later source change.

## Boundaries

A production build passing is not a live deployment. The privately hosted application, its authentication and its database were not changed. The real-origin storage test uses an isolated localhost origin and disposable Chromium profile; it does not prove every browser's `file://` storage policy. Memory-only previews require exported backups.

Consolidation, operational FX, additional operating years, simultaneous posting periods, payment execution, unrestricted AI correspondence, real multi-user reviewer permissions and independent professional-judgement grading were not added. Review clearances and diagnostic flags remain explicitly training/advisory checks.

See [transactional storage and migration](transactional-storage.md) and the [daily guide](guide.md).
