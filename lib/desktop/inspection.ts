import type { DesktopModel } from './files';
import type { SearchResult } from './search-index';
import { ACCOUNT_MAP } from '../accounting/accounts';
import { LESSONS } from '../accounting/lessons';
import { htmlEscape as e } from '../accounting/exports';
import { money } from '../accounting/money';
export function inspectionHTML(item: SearchResult, model: DesktopModel): string {
    if (item.kind === 'lesson') {
        const lesson = LESSONS.find(l => l.id === item.ref);
        if (!lesson)
            return '<p>This lesson is unavailable.</p>';
        return `<article class="pc-inspection"><h1>${e(lesson.title)}</h1><p>${e(lesson.objective)}</p>${lesson.explanation.map(p => `<p>${e(p)}</p>`).join('')}<h2>Before signing off</h2><ul>${lesson.checklist.map(p => `<li>${e(p)}</li>`).join('')}</ul><h2>Common traps</h2><ul>${lesson.pitfalls.map(p => `<li>${e(p)}</li>`).join('')}</ul><p>Guidance only. No example has been posted to your ledger.</p></article>`;
    }
    const journals = model.journals.filter(j => item.kind === 'journal' ? j.id === item.ref : j.lines.some(l => l.account === item.ref));
    return `<section class="pc-inspection"><h1>${e(item.title)}</h1><p>Read-only activity from your actual ledger. Corrections belong in the accounting workspace.</p>${journals.map(j => `<article><h2>${e(j.id)} · ${e(j.description)}</h2><p>${e(j.date)} · ${e(j.reference)}</p>${j.sourceId ? `<button type="button" data-inspect-source="${e(j.sourceId)}">Open source ${e(j.sourceId)}</button>` : ''}<div class="pc-inspection-table"><table><thead><tr><th>Account</th><th>Debit AUD</th><th>Credit AUD</th></tr></thead><tbody>${j.lines.filter(l => item.kind === 'journal' || l.account === item.ref).map(l => `<tr><td>${e(l.account)} · ${e(ACCOUNT_MAP[l.account]?.name ?? '')}</td><td>${e(money(l.debit))}</td><td>${e(money(l.credit))}</td></tr>`).join('')}</tbody></table></div></article>`).join('') || '<p>No posted activity is available.</p>'}</section>`;
}
