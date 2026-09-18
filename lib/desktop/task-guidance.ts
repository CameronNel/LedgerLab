import type { DayTask } from '../accounting/workday-types';
import { htmlEscape as e } from '../accounting/exports';
const OUTPUTS: Record<DayTask['kind'], string> = {
    processing: 'A source-linked invoice or journal, supported by the original evidence.',
    bank: 'A bank match or documented reconciling item. A match is separate from posting a missing transaction.',
    response: 'A saved and submitted response identifying the evidence, conclusion, action and owner.',
    formal: 'A completed formal deliverable with supporting calculations, evidence and a conclusion.',
    forecast: 'A saved forecast with timing assumptions, liquidity risks and proposed actions.',
};
export function taskGuidanceHTML(task: DayTask): string {
    return `<details class="day-purpose"><summary>Why is this on my desk?</summary><dl><dt>Business reason</dt><dd>${e(task.brief)}</dd><dt>Your responsibility</dt><dd>Own the resolution and communicate it to ${e(task.requestor)}. Identifying a difference is the start, not the finished job.</dd><dt>Expected output</dt><dd>${e(OUTPUTS[task.kind])}</dd><dt>What good looks like</dt><dd>Evidence agrees to the saved work, exceptions have an owner and follow-up date, and the conclusion explains what remains uncertain.</dd><dt>From audit to accounting</dt><dd>Investigate, prepare supported corrections, follow up with the responsible person and document the resolution. Do not change independent evidence to make the books agree.</dd></dl><p>This explains the assignment, not its worked answer. Automated checks do not certify professional judgement or approval.</p></details>`;
}
