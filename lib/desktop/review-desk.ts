import type { Command } from '../accounting/types';
import { daySummary } from '../accounting/workday';
import { htmlEscape as e, downloadFile } from '../accounting/exports';
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
    let selected = '', response = '', stage: ReviewStage = 'open', dirty = false, pending = false, error = '', base: string | null = null, caseStamp = '', message = '';
    const currentCase = () => [c.model().state.seed, c.model().state.career?.startedAt, c.model().state.career?.activeMonth].join(':');
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
        root.innerHTML = `<section class="pc-review-desk"><header><span class="day-kicker">CLOSE · REVIEW NOTES</span><h1>Prepare, respond, resolve</h1><p>Deterministic checks with your saved responses. Not independent management approval.</p></header><p class="pc-review-message" role="status">${e(message)}</p>${error ? `<p role="alert" class="pc-review-error">${e(error)}</p>` : ''}<div class="pc-review-layout"><nav aria-label="Review assignments">${summary.tasks.map(({ task, status }) => `<button type="button" data-review-task="${e(task.id)}" aria-current="${selected === task.id ? 'true' : 'false'}"><strong>${e(task.title)}</strong><small>${e(LABELS[reviewStage(book.notes[task.id], status, stamp)])} · ${e(task.due)}</small></button>`).join('')}</nav><div>${current ? `<h2>${e(reviewTitle(current.task, current.status))}</h2><p>${e(current.status.detail)}</p>${note ? `<details><summary>Original review finding</summary><p>${e(note.raisedDetail)}</p></details>` : ''}${note && reviewStage(note, current.status, stamp) !== note.stage ? '<p class="pc-review-error">The saved work changed or no longer passes. Recheck it and clear the note again; your earlier response is retained.</p>' : ''}<button type="button" data-review-open>Open underlying assignment</button><label>Preparer response<textarea aria-label="Preparer response" maxlength="2000" rows="6">${e(response)}</textarea></label><label>Review stage<select aria-label="Review stage">${Object.entries(LABELS).map(([key, label]) => `<option value="${key}" ${stage === key ? 'selected' : ''}>${e(label)}</option>`).join('')}</select></label><p>Clearing is allowed only when the underlying task passes. It does not submit that task, close the month or certify your narrative.</p><div class="pc-review-actions"><button type="button" data-review-save>Save review response</button><button type="button" data-review-discard>Discard draft</button><button type="button" data-review-download>Download response draft</button></div><small>${dirty ? 'Unsaved response' : 'Saved responses are included in normal workspace backups.'}</small><details><summary>Response history (${note?.history.length ?? 0})</summary>${(note?.history ?? []).map(item => `<article><strong>${e(LABELS[item.stage])}</strong><small>${e(item.at)}</small><p>${e(item.response)}</p></article>`).join('') || '<p>No saved responses yet.</p>'}</details>` : '<h2>Select an assignment</h2><p>Read the finding, fix the underlying work, then record what you changed and why.</p>'}</div></div></section>`;
        if (pending)
            root.querySelectorAll<HTMLInputElement>('button,textarea,select').forEach(el => el.disabled = true);
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
    root.addEventListener('input', event => { if ((event.target as HTMLElement).getAttribute('aria-label') === 'Preparer response') {
        response = (event.target as HTMLTextAreaElement).value;
        dirty = true;
    } });
    root.addEventListener('change', event => { if ((event.target as HTMLElement).getAttribute('aria-label') === 'Review stage') {
        stage = (event.target as HTMLSelectElement).value as ReviewStage;
        dirty = true;
    } });
    root.addEventListener('click', event => {
        const el = (event.target as Element).closest<HTMLElement>('button');
        if (!el || pending)
            return;
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
