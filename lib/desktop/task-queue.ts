/** Presentation-only work triage. Never posts, changes due dates or marks work complete. */
import type { PracticeState } from '../accounting/types';
import type { DayTask, DayTaskStatus } from '../accounting/workday-types';
export type TaskRow = { task: DayTask; status: DayTaskStatus };
export type QueueFilter = 'all' | 'open' | 'due' | 'overdue' | 'arrived' | 'completed' | 'waiting' | 'attention';
export const TASK_PAGE_SIZE = 20;
export const TASK_KINDS: Record<DayTask['kind'], string> = {
    processing: 'Bookkeeping', bank: 'Bank matching', response: 'Management requests',
    formal: 'Close deliverables', forecast: 'Cash forecast',
};
export function followUpDue(row: TaskRow, state: PracticeState): boolean {
    const date = state.workday?.submissions[row.task.id]?.followUp;
    return row.status.state === 'Waiting' && !!date && date <= (state.workday?.today ?? '');
}
export function needsAttention(row: TaskRow, state: PracticeState): boolean {
    return !row.status.complete && (row.status.state === 'Needs correction' || followUpDue(row, state)
        || row.task.due < (state.workday?.today ?? ''));
}
/** Critical control issues first; future follow-ups remain waiting, not falsely complete. */
export function priorityQueue(rows: readonly TaskRow[], state: PracticeState): TaskRow[] {
    const today = state.workday?.today ?? '';
    const tier = (row: TaskRow) => row.status.complete ? 6
        : row.status.state === 'Waiting' && !followUpDue(row, state) ? 5
        : row.task.priority === 'Critical' ? 0
        : row.task.id.endsWith('-welcome') && row.task.release === today ? 1
        : needsAttention(row, state) ? 2 : row.task.due <= today ? 3 : 4;
    return [...rows].sort((a, b) => tier(a) - tier(b) || a.task.due.localeCompare(b.task.due)
        || ['Critical', 'High', 'Normal'].indexOf(a.task.priority) - ['Critical', 'High', 'Normal'].indexOf(b.task.priority)
        || a.task.id.localeCompare(b.task.id));
}
export function nextAction(rows: readonly TaskRow[], state: PracticeState): TaskRow | undefined {
    return priorityQueue(rows, state).find(row => !row.status.complete
        && (row.status.state !== 'Waiting' || followUpDue(row, state)));
}
export function filterQueue(rows: readonly TaskRow[], state: PracticeState,
    filter: string, query = '', kind = 'all', sourceTitles: Readonly<Record<string, string>> = {}): TaskRow[] {
    const today = state.workday?.today ?? '', terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return priorityQueue(rows, state).filter(row => {
        const { task, status } = row;
        const allowed = filter === 'all' || filter === 'open' && !status.complete
            || filter === 'due' && task.due === today && !status.complete
            || filter === 'overdue' && task.due < today && !status.complete
            || filter === 'arrived' && task.release === today || filter === 'completed' && status.complete
            || filter === 'waiting' && status.state === 'Waiting' || filter === 'attention' && needsAttention(row, state);
        // Intentionally do not index figure expectations or solution fields.
        const haystack = [task.id, task.title, task.requestor, task.brief, ...task.evidence,
            task.sourceId ? sourceTitles[task.sourceId] ?? '' : '',
            state.workday?.submissions[task.id]?.owner ?? ''].join(' ').toLowerCase();
        return allowed && (kind === 'all' || task.kind === kind) && terms.every(term => haystack.includes(term));
    });
}
export function pageOf<T>(rows: readonly T[], requested: number, size = TASK_PAGE_SIZE) {
    const safeSize = Number.isFinite(size) ? Math.max(1, Math.min(100, Math.floor(size))) : TASK_PAGE_SIZE;
    const pages = Math.max(1, Math.ceil(rows.length / safeSize));
    const page = Number.isFinite(requested) ? Math.max(0, Math.min(pages - 1, Math.floor(requested))) : 0;
    return { page, pages, total: rows.length, rows: rows.slice(page * safeSize, (page + 1) * safeSize),
        from: rows.length ? page * safeSize + 1 : 0, to: Math.min(rows.length, (page + 1) * safeSize) };
}
