import { ledgerChecks } from './ledger-checks';
import { pageOf } from './task-queue';
import { preserveView } from './view-state';
import { htmlEscape as e, csv, downloadFile } from '../accounting/exports';
import type { DesktopModel } from './files';
export function mountHealthDesk(root: HTMLElement, model: () => DesktopModel,
    inspect: (kind: 'journal' | 'account', id: string) => void, app: (view: string) => void) {
    let filter = 'all', page = 0;
    function render() {
        const restore = preserveView(root), data = ledgerChecks(model());
        const list = pageOf(data.findings.filter(f => filter === 'all' || f.severity === filter), page);
        page = list.page;
        root.innerHTML = `<section class="pc-health"><header><span class="day-kicker">CLOSE · LEDGER CHECKS</span><h1>Investigate before signing off</h1><p>${e(data.month)} · Evidence available through ${e(data.asOf)} · ${data.journalCount} journals in this month</p></header>
        <p class="pc-health-scope">These checks use your actual ledger and released records, not the worked solution. Review flags are questions, not proof of an error. This does not replace the full month review or assess professional judgement.</p>
        <div class="pc-health-toolbar"><label>Show<select aria-label="Ledger finding severity"><option value="all" ${filter === 'all' ? 'selected' : ''}>All findings</option><option value="error" ${filter === 'error' ? 'selected' : ''}>Errors</option><option value="review" ${filter === 'review' ? 'selected' : ''}>Review flags</option></select></label><button type="button" data-health-export>Export checks CSV</button><button type="button" data-health-refresh>Refresh</button></div>
        <p role="status">${data.findings.filter(f => f.severity === 'error').length} errors · ${data.findings.filter(f => f.severity === 'review').length} review flags</p>
        ${list.rows.map(f => `<article class="pc-health-finding" data-severity="${f.severity}"><span class="day-state">${f.severity === 'error' ? 'Error' : 'Review'}</span><h2>${e(f.title)}</h2><p>${e(f.detail)}</p><div class="pc-health-links">${f.journalIds.slice(0, 8).map(id => `<button type="button" data-health-journal="${e(id)}">Inspect ${e(id)}</button>`).join('')}${f.journalIds.length > 8 ? `<details><summary>${f.journalIds.length - 8} more entries</summary>${f.journalIds.slice(8).map(id => `<button type="button" data-health-journal="${e(id)}">${e(id)}</button>`).join('')}</details>` : ''}${f.account ? `<button type="button" data-health-account="${e(f.account)}">Inspect account ${e(f.account)}</button>` : ''}${f.workspace ? `<button type="button" data-health-app="${e(f.workspace)}">Open bank reconciliation</button>` : ''}</div></article>`).join('') || '<section class="day-empty"><h2>No findings in this view</h2><p>This is not a clean-bill-of-health certificate. Complete source processing, reconciliations and the month review separately.</p></section>'}
        <nav class="day-pages" aria-label="Finding pages"><button type="button" data-health-prev ${page === 0 ? 'disabled' : ''}>Previous</button><span>${list.from}–${list.to} of ${list.total}</span><button type="button" data-health-next ${page + 1 >= list.pages ? 'disabled' : ''}>Next</button></nav></section>`;
        restore();
    }
    root.addEventListener('change', event => { const el = event.target as HTMLSelectElement; if (el.getAttribute('aria-label') === 'Ledger finding severity') { filter = el.value; page = 0; render(); } });
    root.addEventListener('click', event => {
        const el = (event.target as Element).closest<HTMLElement>('button'); if (!el) return;
        if (el.dataset.healthJournal) inspect('journal', el.dataset.healthJournal);
        else if (el.dataset.healthAccount) inspect('account', el.dataset.healthAccount);
        else if (el.dataset.healthApp) app(el.dataset.healthApp);
        else if (el.hasAttribute('data-health-export')) {
            const data = ledgerChecks(model());
            downloadFile(`Ledger-checks-${data.month}.csv`, csv(['Month', 'As of', 'Severity', 'Finding', 'Detail', 'Journals', 'Account'], data.findings.map(f => [data.month, data.asOf, f.severity, f.title, f.detail, f.journalIds.join('; '), f.account ?? ''])), 'text/csv');
        } else { if (el.hasAttribute('data-health-prev')) page--; if (el.hasAttribute('data-health-next')) page++; render(); }
    });
    render(); return { refresh: render };
}
