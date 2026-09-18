/** Read-only search over the learner's released evidence, never the worked solution. */
import { WORKSPACE_APPS } from '../workspace/app-registry';
import { ACCOUNTS } from '../accounting/accounts';
import { LESSONS } from '../accounting/lessons';
import { dayTasks } from '../accounting/workday';
import { virtualFiles, type DesktopModel } from './files';
export type SearchResult = {
    id: string;
    title: string;
    detail: string;
    keywords: string;
    kind: 'app' | 'task' | 'file' | 'journal' | 'account' | 'lesson';
    ref: string;
};
export function workspaceSearchIndex(model: DesktopModel): SearchResult[] {
    const results: SearchResult[] = WORKSPACE_APPS.map(app => ({
        id: 'app:' + app.id, title: app.name, detail: app.section, keywords: app.keywords, kind: 'app', ref: app.id,
    }));
    for (const file of virtualFiles(model)) {
        if (file.folder === 'Recycle bin')
            continue;
        results.push({ id: 'file:' + file.id, title: file.name, detail: file.description, keywords: file.folder + ' ' + file.ref, kind: 'file', ref: file.id });
    }
    for (const task of dayTasks(model.state))
        results.push({
            id: 'task:' + task.id, title: task.title, detail: `Assignment · due ${task.due}`,
            keywords: [task.requestor, task.brief, ...task.evidence].join(' '), kind: 'task', ref: task.id,
        });
    for (const journal of model.journals)
        results.push({
            id: 'journal:' + journal.id, title: journal.id + ' · ' + journal.description,
            detail: `Posted journal · ${journal.date}`, keywords: [journal.reference, journal.sourceId, ...journal.lines.map(line => line.account)].join(' '), kind: 'journal', ref: journal.id,
        });
    for (const account of ACCOUNTS)
        results.push({ id: 'account:' + account.code, title: account.code + ' · ' + account.name,
            detail: 'Account activity', keywords: 'ledger account ' + account.name, kind: 'account', ref: account.code });
    for (const lesson of LESSONS)
        results.push({ id: 'lesson:' + lesson.id, title: lesson.title,
            detail: 'Learning guide · ' + lesson.category, keywords: lesson.objective, kind: 'lesson', ref: lesson.id });
    return results;
}
const normalise = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function searchWorkspace(index: readonly SearchResult[], query: string, limit = 40): SearchResult[] {
    const terms = normalise(query.trim()).split(/\s+/).filter(Boolean), cap = Math.min(100, Math.max(0, limit));
    if (!terms.length)
        return index.filter(item => item.kind === 'app').slice(0, cap);
    return index.map((item, position) => {
        const title = normalise(item.title), ref = normalise(item.ref), haystack = normalise(item.title + ' ' + item.detail + ' ' + item.keywords);
        const score = terms.every(term => haystack.includes(term)) ? terms.reduce((sum, term) => sum + (ref === term ? 100 : title === term ? 80 : title.startsWith(term) ? 40 : title.includes(term) ? 20 : 1), 0) : -1;
        return { item, score, position };
    }).filter(result => result.score >= 0).sort((a, b) => b.score - a.score || a.position - b.position).slice(0, cap).map(result => result.item);
}
