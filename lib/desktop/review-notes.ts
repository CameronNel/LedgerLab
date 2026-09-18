/** Training review responses reuse validated desktop-file persistence and backup support.
 * A cleared response is not an independent reviewer approval and never closes a period.
 */
import type { PracticeState, Command } from '../accounting/types';
import type { DayTask, DayTaskStatus } from '../accounting/workday-types';
import { dayTasks, dayTaskStatus } from '../accounting/workday';
import { assessmentFingerprint } from '../accounting/month-assessment';
import { desktopFileError, type DesktopUserFile } from './types';
export type ReviewStage = 'open' | 'prepared' | 'changes-requested' | 'cleared';
export type ReviewResponse = {
    taskId: string;
    stage: ReviewStage;
    response: string;
    fingerprint: string;
    raisedDetail: string;
    history: {
        at: string;
        stage: ReviewStage;
        response: string;
    }[];
};
export type ReviewBook = {
    format: 'LedgerLab review responses';
    version: 1;
    month: string;
    notes: Record<string, ReviewResponse>;
};
export const reviewFileId = (month: string) => 'UF-review-notes-' + month;
export function readReviewBook(state: PracticeState): {
    book: ReviewBook;
    file?: DesktopUserFile;
} {
    const month = state.career?.activeMonth ?? '2025-12', file = state.desktop?.files.find(f => f.id === reviewFileId(month));
    const empty: ReviewBook = { format: 'LedgerLab review responses', version: 1, month, notes: {} };
    if (!file)
        return { book: empty };
    if (file.deleted)
        throw new Error('Review responses are in the recycle bin. Restore the review-notes file before continuing.');
    try {
        const value = JSON.parse(file.text) as ReviewBook;
        if (value.format !== empty.format || value.version !== 1 || value.month !== month || !value.notes || typeof value.notes !== 'object' || Array.isArray(value.notes))
            throw new Error();
        for (const [key, note] of Object.entries(value.notes)) {
            if (!note || note.taskId !== key || !['open', 'prepared', 'changes-requested', 'cleared'].includes(note.stage) || typeof note.response !== 'string' || note.response.length > 2000 || typeof note.fingerprint !== 'string' || typeof note.raisedDetail !== 'string' || !Array.isArray(note.history))
                throw new Error();
            for (const item of note.history)
                if (!item || typeof item.at !== 'string' || !Number.isFinite(Date.parse(item.at)) || !['open', 'prepared', 'changes-requested', 'cleared'].includes(item.stage) || typeof item.response !== 'string' || item.response.length > 2000)
                    throw new Error();
        }
        return { book: value, file };
    }
    catch {
        throw new Error('The saved review-notes file is invalid. Download it and restore a valid backup; it will not be overwritten.');
    }
}
export function reviewFingerprint(state: PracticeState): string {
    // Exclude only this feature's response files so saving a response does not invalidate itself.
    return assessmentFingerprint({ ...state, desktop: state.desktop ? { ...state.desktop, files: state.desktop.files.filter(f => !/^UF-review-notes-\d{4}-\d{2}$/.test(f.id)) } : undefined });
}
export function reviewStage(note: ReviewResponse | undefined, status: DayTaskStatus, fingerprint: string): ReviewStage {
    if (!note)
        return status.state === 'Needs correction' ? 'changes-requested' : 'open';
    if (note.stage === 'cleared' && (!status.complete || note.fingerprint !== fingerprint))
        return 'changes-requested';
    if (note.stage === 'prepared' && status.state === 'Needs correction')
        return 'changes-requested';
    return note.stage;
}
export function saveReviewResponse(state: PracticeState, taskId: string, stage: ReviewStage, response: string, now: string): Command {
    if (state.career?.closed[state.career.activeMonth])
        throw new Error('This period is closed. Reopen it through the existing close controls before changing review responses.');
    const task = dayTasks(state).find(t => t.id === taskId);
    if (!task)
        throw new Error('Choose a currently available assignment.');
    if (!['open', 'prepared', 'changes-requested', 'cleared'].includes(stage))
        throw new Error('Choose a valid review stage.');
    if (response.trim().length < 20 || response.length > 2000)
        throw new Error('Write a specific response of 20 to 2,000 characters.');
    if (!Number.isFinite(Date.parse(now)))
        throw new Error('Invalid review timestamp.');
    const status = dayTaskStatus(task, state);
    if (stage === 'cleared' && !status.complete)
        throw new Error('Correct the underlying saved work before clearing this note. A response cannot override a failed check.');
    const { book, file } = readReviewBook(state), previous = book.notes[taskId];
    const note: ReviewResponse = { taskId, stage, response: response.trim(), fingerprint: reviewFingerprint(state), raisedDetail: previous?.raisedDetail ?? status.detail, history: [...(previous?.history ?? []), { at: now, stage, response: response.trim() }] };
    const updated = { ...book, notes: { ...book.notes, [taskId]: note } }, next: DesktopUserFile = {
        id: reviewFileId(book.month), name: `Review responses ${book.month}.txt`, folder: `Working papers/${book.month}/Review notes`, kind: 'note', cells: [],
        text: JSON.stringify(updated, null, 2), createdAt: file?.createdAt ?? now, updatedAt: now, deleted: false,
    };
    const error = desktopFileError(next);
    if (error)
        throw new Error('Review history reached its file limit. Export your work before starting a separate case. ' + error);
    return { type: 'saveDesktopFile', file: next, expectedUpdatedAt: file?.updatedAt ?? null };
}
export const reviewTitle = (task: DayTask, status: DayTaskStatus) => status.state === 'Waiting' ? `Follow up: ${task.title}` : status.state === 'Needs correction' ? `Correction required: ${task.title}` : `Review: ${task.title}`;
