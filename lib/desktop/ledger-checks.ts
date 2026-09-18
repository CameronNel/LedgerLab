/** Advisory controls over actual available records, independent of all worked answers. */
import type { Journal } from '../accounting/types';
import { ACCOUNT_MAP } from '../accounting/accounts';
import { money } from '../accounting/money';
import { asOfDate, bankAvailableOn } from '../accounting/workday-calendar';
import type { DesktopModel } from './files';
export type LedgerFinding = {
    id: string; severity: 'error' | 'review'; title: string; detail: string;
    journalIds: string[]; account?: string; workspace?: string;
};
export function ledgerChecks(model: DesktopModel) {
    const month = model.reportingMonth ?? model.state.career?.activeMonth ?? '2025-12';
    const asOf = asOfDate(model.state, month);
    const available = model.journals.filter(j => j.date <= asOf);
    const period = available.filter(j => j.date.startsWith(month));
    const findings: LedgerFinding[] = [];
    const reversed = new Set(available.flatMap(j => j.reverses ? [j.reverses] : []));
    const identities = new Map<string, Journal[]>(), signatures = new Map<string, Journal[]>();
    for (const j of period) {
        const sameId = identities.get(j.id) ?? []; sameId.push(j); identities.set(j.id, sameId);
        const valid = j.lines.every(l => Number.isSafeInteger(l.debit) && Number.isSafeInteger(l.credit) && l.debit >= 0 && l.credit >= 0 && !(l.debit && l.credit));
        const debit = j.lines.reduce((n, l) => n + l.debit, 0), credit = j.lines.reduce((n, l) => n + l.credit, 0);
        if (!valid || !Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit !== credit)
            findings.push({ id: 'amount:' + j.id, severity: 'error', title: 'Invalid or unbalanced journal',
                detail: `${j.id}: amounts must be safe integer cents, single-sided and balanced. Inspect the original entry before correcting it.`, journalIds: [j.id] });
        const missing = j.lines.filter(l => !ACCOUNT_MAP[l.account] || ACCOUNT_MAP[l.account]?.control && !model.company.contacts.some(c => c.id === l.contact && c.kind === ACCOUNT_MAP[l.account].control));
        if (missing.length) findings.push({ id: 'account:' + j.id, severity: 'error', title: 'Account or control-contact problem',
            detail: `${j.id}: ${missing.length} line(s) have an unknown account or lack the required customer/supplier.`, journalIds: [j.id] });
        // Identical economic lines alone are not evidence of duplication. Require the same source/reference too.
        const source = (j.sourceId || j.reference || '').trim();
        if (!j.reverses && !reversed.has(j.id) && source && valid) {
            const signature = JSON.stringify([j.date, source, j.cashClass ?? '', j.lines.map(l => [l.account, l.contact ?? '', l.itemId ?? '', l.debit, l.credit]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
            const entries = signatures.get(signature) ?? []; entries.push(j); signatures.set(signature, entries);
        }
    }
    for (const [id, entries] of identities) if (entries.length > 1)
        findings.push({ id: 'duplicate-id:' + id, severity: 'error', title: 'Repeated journal identifier', detail: `${id} occurs ${entries.length} times.`, journalIds: [id] });
    for (const entries of signatures.values()) if (entries.length > 1)
        findings.push({ id: 'duplicate:' + entries[0].id, severity: 'review', title: 'Possible duplicate posting',
            detail: `${entries.length} unreversed entries share the date, source/reference and accounting lines. This may be legitimate: inspect the evidence. Nothing is reversed automatically.`, journalIds: entries.map(j => j.id) });
    const learnerIds = new Set(model.state.journals.map(j=>j.id));
    const unsupported = period.filter(j => learnerIds.has(j.id) && !j.reverses && !reversed.has(j.id) && !j.sourceId);
    if (unsupported.length) findings.push({ id: 'source-links', severity: 'review', title: 'Entries without linked source evidence',
        detail: `${unsupported.length} unreversed non-seed journal(s) have no source link. Manual adjustments can be valid; retain support and a clear narration.`, journalIds: unsupported.map(j => j.id) });
    const suspense = available.reduce((n, j) => n + j.lines.filter(l => l.account === '6990').reduce((v, l) => v + l.debit - l.credit, 0), 0);
    if (suspense) findings.push({ id: 'suspense', severity: 'review', title: 'Unresolved suspense balance',
        detail: `Account 6990 has ${money(suspense)} at ${asOf} (debit-positive). Investigate its composition; do not clear it with a balancing entry.`, journalIds: [], account: '6990' });
    const bank = model.company.bank.filter(row => row.date.startsWith(month) && row.date <= asOf && (!model.state.workday || bankAvailableOn(row.date) <= model.state.workday.today));
    const unmatched = bank.filter(row => !model.state.bankMatches[row.id]?.length);
    if (unmatched.length) findings.push({ id: 'bank', severity: 'review', title: 'Available bank lines still unmatched',
        detail: `${unmatched.length} of ${bank.length} available ${month} bank lines have no saved match. Matching is separate from posting.`, journalIds: [], workspace: 'bank' });
    return { month, asOf, journalCount: period.length, bankCount: bank.length, unmatched: unmatched.length,
        findings: findings.sort((a, b) => (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1) || a.id.localeCompare(b.id)) };
}
