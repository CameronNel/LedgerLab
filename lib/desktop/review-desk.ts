import {pageOf,needsAttention} from './task-queue';
import {preserveView} from './view-state';
import type { Command } from '../accounting/types';
import { daySummary } from '../accounting/workday';
import { htmlEscape as e, csv, downloadFile } from '../accounting/exports';
import { readReviewBook, reviewFingerprint, reviewStage, reviewTitle, saveReviewResponse, type ReviewStage } from './review-notes';
import type { DesktopModel } from './files';
export type ReviewDeskHandle = {
    refresh: () => void;
    hasUnsaved: () => boolean;
    saveDraft: () => Promise<boolean>;
};
type Callbacks = {
    model: () => DesktopModel;
    send: (command: Command) => Promise<boolean>;
    openTask: (id: string) => void;
};
const LABELS: Record<ReviewStage, string> = { open: 'Open', prepared: 'Prepared', 'changes-requested': 'Changes requested', cleared: 'Cleared (training check)' };
export function mountReviewDesk(root: HTMLElement, c: Callbacks): ReviewDeskHandle {
    let query='',filter='all',page=0;
    let selected = '', response = '', stage: ReviewStage = 'open', dirty = false, pending = false, error = '', base: string | null = null, caseStamp = '', message = '';
    const currentCase = () => [c.model().state.seed, c.model().state.career?.startedAt, c.model().state.career?.activeMonth,c.model().generation].join(':');
    function load(id: string) { try {
        const { book, file } = readReviewBook(c.model().state);
        selected = id;
        response = book.notes[id]?.response ?? '';
        stage = book.notes[id]?.stage ?? 'open';
        base = file?.updatedAt ?? null;
        caseStamp = currentCase();
        error = '';
        message = '';
    }
    catch (err) {
        error = (err as Error).message;
    } }
    function render() {
        const restore=preserveView(root);
        const model = c.model();
        const preserved = (reason: string) => {
            root.innerHTML = `<section class="pc-review-desk"><h2>Preserved review draft</h2><p role="alert">${e(reason)}</p><pre>${e(response)}</pre><button type="button" data-review-download>Download response draft</button><button type="button" data-review-discard>Discard draft</button></section>`;
        };
        if (dirty && caseStamp !== currentCase()) {
            preserved('The active case changed. This response will not overwrite the new case.');
            return;
        }
        if (!model.state.workday) {
            root.innerHTML = '<section class="pc-review-desk"><h2>Review notes</h2><p>Start or enable a day-by-day case to review its assignments. Existing monthly cases and their month-review controls are unchanged.</p></section>';
            return;
        }
        let book;
        try {
            book = readReviewBook(model.state).book;
        }
        catch (err) {
            if (dirty)
                preserved((err as Error).message);
            else
                root.innerHTML = `<section class="pc-review-desk"><h2>Review notes need attention</h2><p role="alert">${e((err as Error).message)}</p></section>`;
            return;
        }
        const summary = daySummary(model.state), stamp = reviewFingerprint(model.state), current = summary.tasks.find(x => x.task.id === selected), note = book.notes[selected];
        const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const list=pageOf(summary.tasks.filter(({task,status})=>{
            const review=reviewStage(book.notes[task.id],status,stamp);
            return (filter==='all'||filter==='attention'&&(review==='changes-requested'||needsAttention({task,status},model.state))||filter==='responses'&&!!book.notes[task.id]||filter==='cleared'&&review==='cleared')
                &&terms.every(term=>`${task.id} ${task.title} ${task.requestor}`.toLowerCase().includes(term));
        }),page);page=list.page;
        root.innerHTML = `<section class="pc-review-desk"><header><span class="day-kicker">CLOSE · REVIEW NOTES</span><h1>Prepare, respond, resolve</h1><p>Deterministic checks with your saved responses. Not independent management approval.</p></header><p class="pc-review-message" role="status">${e(message)}</p>${error ? `<p role="alert" class="pc-review-error">${e(error)}</p>` : ''}<div class="pc-review-filters"><label>Search assignments<input type="search" data-review-query aria-label="Search review assignments" value="${e(query)}" maxlength="160" placeholder="Task, reference or person"></label><label>Show<select data-review-filter aria-label="Review filter">${[['all','All assignments'],['attention','Needs attention'],['responses','With responses'],['cleared','Cleared']].map(([id,label])=>`<option value="${id}" ${filter===id?'selected':''}>${label}</option>`).join('')}</select></label><button type="button" data-review-export>Export review history</button></div><div class="pc-review-layout"><nav aria-label="Review assignments">${list.rows.map(({ task, status }) => `<button type="button" data-review-task="${e(task.id)}" aria-current="${selected === task.id ? 'true' : 'false'}"><strong>${e(task.title)}</strong><small>${e(LABELS[reviewStage(book.notes[task.id], status, stamp)])} · ${e(task.due)}</small></button>`).join('')||'<p>No assignments match this filter.</p>'}<div class="pc-review-pages"><button type="button" data-review-prev ${page===0?'disabled':''}>Previous</button><span>${list.from}–${list.to} of ${list.total}</span><button type="button" data-review-next ${page+1>=list.pages?'disabled':''}>Next</button></div></nav><div>${current ? `<h2>${e(reviewTitle(current.task, current.status))}</h2><p>${e(current.status.detail)}</p>${note ? `<details><summary>Original review finding</summary><p>${e(note.raisedDetail)}</p></details>` : ''}${note && reviewStage(note, current.status, stamp) !== note.stage ? '<p class="pc-review-error">The saved work changed or no longer passes. Recheck it and clear the note again; your earlier response is retained.</p>' : ''}<button type="button" data-review-open>Open underlying assignment</button><label>Preparer response<textarea aria-label="Preparer response" maxlength="2000" rows="6">${e(response)}</textarea></label><label>Review stage<select aria-label="Review stage">${Object.entries(LABELS).map(([key, label]) => `<option value="${key}" ${stage === key ? 'selected' : ''}>${e(label)}</option>`).join('')}</select></label><p>Clearing is allowed only when the underlying task passes. It does not submit that task, close the month or certify your narrative.</p><div class="pc-review-actions"><button type="button" data-review-save>Save review response</button><button type="button" data-review-discard>Discard draft</button><button type="button" data-review-download>Download response draft</button></div><small>${dirty ? 'Unsaved response' : 'Saved responses are included in normal workspace backups.'}</small><details><summary>Response history (${note?.history.length ?? 0})</summary>${(note?.history ?? []).map(item => `<article><strong>${e(LABELS[item.stage])}</strong><small>${e(item.at)}</small><p>${e(item.response)}</p></article>`).join('') || '<p>No saved responses yet.</p>'}</details>` : '<h2>Select an assignment</h2><p>Read the finding, fix the underlying work, then record what you changed and why.</p>'}</div></div></section>`;
        if (pending) root.querySelectorAll<HTMLInputElement>('button,input,textarea,select').forEach(el => el.disabled = true);
        restore();
    }
    async function save(): Promise<boolean> {
        if (!dirty)
            return true;
        if (pending)
            return false;
        try {
            if (caseStamp !== currentCase())
                throw new Error('Case changed. Download this draft and discard it before saving new work.');
            const { file } = readReviewBook(c.model().state);
            if ((file?.updatedAt ?? null) !== base)
                throw new Error('Another save changed these review responses. Download your draft and reload the latest saved response before retrying.');
            const command = saveReviewResponse(c.model().state, selected, stage, response, new Date().toISOString());
            pending = true;
            error = '';
            render();
            const ok = await c.send(command);
            pending = false;
            if (ok) {
                dirty = false;
                load(selected);
                message = 'Review response saved. The ledger and period controls are unchanged.';
            }
            else
                error = c.model().error || 'Save failed or was not acknowledged. Your draft is retained; reload saved work before retrying.';
            render();
            return ok;
        }
        catch (err) {
            pending = false;
            error = (err as Error).message;
            render();
            return false;
        }
    }
    root.addEventListener('input', event => { if((event.target as HTMLElement).hasAttribute('data-review-query')){query=(event.target as HTMLInputElement).value;page=0;render();return;} if ((event.target as HTMLElement).getAttribute('aria-label') === 'Preparer response') {
        response = (event.target as HTMLTextAreaElement).value;
        dirty = true;
    } });
    root.addEventListener('change', event => { if((event.target as HTMLElement).hasAttribute('data-review-filter')){filter=(event.target as HTMLSelectElement).value;page=0;render();return;} if ((event.target as HTMLElement).getAttribute('aria-label') === 'Review stage') {
        stage = (event.target as HTMLSelectElement).value as ReviewStage;
        dirty = true;
    } });
    root.addEventListener('click', event => {
        const el = (event.target as Element).closest<HTMLElement>('button');
        if (!el || pending)
            return;
        if(el.hasAttribute('data-review-prev')||el.hasAttribute('data-review-next')){page+=el.hasAttribute('data-review-next')?1:-1;render();return;}
        if(el.hasAttribute('data-review-export')){
            try{const {book}=readReviewBook(c.model().state);downloadFile(`Review-history-${book.month}.csv`,csv(['Month','Task','Original finding','Recorded at','Stage','Response'],Object.values(book.notes).flatMap(note=>note.history.map(item=>[book.month,note.taskId,note.raisedDetail,item.at,item.stage,item.response]))),'text/csv');}
            catch(err){error=(err as Error).message;render();}return;
        }
        if (el.dataset.reviewTask) {
            if (dirty) {
                error = 'Save or discard this response before changing assignments.';
                render();
                return;
            }
            load(el.dataset.reviewTask);
            render();
        }
        else if (el.hasAttribute('data-review-save'))
            void save();
        else if (el.hasAttribute('data-review-discard')) {
            dirty = false;
            load(selected);
            render();
        }
        else if (el.hasAttribute('data-review-open'))
            c.openTask(selected);
        else if (el.hasAttribute('data-review-download'))
            downloadFile('Review-response-draft.txt', JSON.stringify({ case: caseStamp, taskId: selected, stage, response }, null, 2));
    });
    render();
    return { refresh: () => { if (!dirty && !pending && selected)
            load(selected); render(); }, hasUnsaved: () => dirty || pending, saveDraft: save };
}
