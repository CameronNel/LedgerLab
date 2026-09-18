# Continue LedgerLab

Read [README](README.md), [current guide](docs/current/guide.md), [verification](docs/current/verification.md) and [architecture](docs/architecture/README.md) before editing.

Current source release: **3.1.0**. The standalone is `public/offline/LedgerLab-Workstation-v3.1.html`. The hosted application has not been updated. Do not claim deployment or a full React build based on the standalone tests.

Keep old route IDs, integer-cent postings, independent source evidence, release-date guards, save concurrency, backup compatibility, unsaved drafts and close controls. UI convenience must never auto-post an answer or falsely approve professional judgement.

The shared registry is `lib/workspace/app-registry.ts`. New workspace features live in focused modules under `lib/desktop/`; `shell.ts` integrates them. Review responses are validated desktop note files with per-file compare-and-swap protection, not a new financial ledger or authentication role.

Old handoffs are [archived](docs/archive/README.md). Their feature counts, release status and test claims are historical. Current user instructions and the actual repository revision take precedence.
