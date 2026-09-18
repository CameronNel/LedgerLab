import type { Command } from '../accounting/types';
import { htmlEscape as e, downloadFile } from '../accounting/exports';
import { scenarioMail, sourceDocuments, virtualFiles, filePayload, type DesktopModel, type ScenarioMail } from './files';
import { preserveView } from './view-state';
export const incomingMail = (mail: Pick<ScenarioMail, 'category'>) => mail.category !== 'Sent' && mail.category !== 'Draft';
export type MailDeskHandle = { refresh: () => void; select: (id: string) => void };
export function mountMailDesk(root: HTMLElement, callbacks: {
    model: () => DesktopModel; send: (c: Command) => Promise<boolean>;
    source: (id: string) => void; assignment: (id: string) => void; app: (view: string) => void;
}, initial?: string): MailDeskHandle {
    let selected = initial ?? '', query = '', unreadOnly = false, folder = 'inbox';
    const model = callbacks.model;
    const folderFor = (mail: ScenarioMail | undefined) => mail?.category === 'Sent' ? 'sent' : mail?.category === 'Draft' ? 'drafts' : 'inbox';
    if (initial) folder = folderFor(scenarioMail(model()).find(m => m.id === initial));
    function render() {
        const restore = preserveView(root), all = scenarioMail(model()), read = new Set(model().state.desktop?.readMail ?? []);
        const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const found = all.filter(m => (folder === 'all' || folderFor(m) === folder)
            && (!unreadOnly || incomingMail(m) && !read.has(m.id))
            && terms.every(term => `${m.subject} ${m.from} ${m.attachments.join(' ')}`.toLowerCase().includes(term)));
        const chosen = found.find(m => m.id === selected) ?? found[0];
        if (chosen) selected = chosen.id;
        root.innerHTML = `<div class="pc-mail-toolbar"><div><strong>Harbour Mail</strong><small>Scenario inbox · ${all.filter(m => incomingMail(m) && !read.has(m.id)).length} unread</small></div>
        <label>Folder<select aria-label="Mail folder">${[['inbox', 'Inbox'], ['sent', 'Sent'], ['drafts', 'Drafts'], ['all', 'All correspondence']].map(([id, label]) => `<option value="${id}" ${id === folder ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label class="pc-search"><input aria-label="Search scenario emails" placeholder="Subject, sender or reference" value="${e(query)}" maxlength="120"></label>
        <label class="pc-unread-filter"><input type="checkbox" aria-label="Unread emails only" ${unreadOnly ? 'checked' : ''} ${['sent','drafts'].includes(folder) ? 'disabled' : ''}> Unread</label></div>
        <div class="pc-mail-layout"><nav class="pc-message-list" aria-label="Scenario messages">${found.map(m => `<button type="button" data-mail="${e(m.id)}" data-active="${chosen?.id === m.id}" aria-current="${chosen?.id === m.id}" data-unread="${incomingMail(m) && !read.has(m.id)}"><span><strong>${e(m.from)}</strong><time>${e(m.date)}</time></span><h3>${e(m.subject)}</h3><p>${e((m.body[0] ?? '').slice(0, 110))}</p><small>${e(m.category ?? 'Inbox')}${m.due ? ` · Due ${e(m.due)}` : ''} · ${m.attachments.length} attachments</small></button>`).join('') || '<p class="pc-padding">No messages match. Clear your search or choose another folder.</p>'}</nav>
        <article class="pc-message">${chosen ? `<div class="pc-message-actions">${incomingMail(chosen) ? `<button type="button" data-action="read" ${model().saving ? 'disabled' : ''}>${read.has(chosen.id) ? 'Mark unread' : 'Mark read'}</button>` : ''}<button type="button" data-action="export">Download email</button>${chosen.view ? `<button type="button" data-action="app">${chosen.taskId ? 'Open assignment' : 'Open task workspace'}</button>` : ''}</div>
        <header><span class="pc-eyebrow">SCENARIO ${folderFor(chosen) === 'inbox' ? 'EMAIL' : chosen.category?.toUpperCase()}</span><h2>${e(chosen.subject)}</h2><p><strong>${e(chosen.from)}</strong></p><time>${e(chosen.date)}</time>${chosen.due ? `<p><b>${e(chosen.priority ?? 'Normal')} priority · Due ${e(chosen.due)} end of day</b></p>` : ''}</header>
        <div class="pc-message-text">${chosen.body.map(p => `<p>${e(p)}</p>`).join('')}</div><section class="pc-attachments"><h3>Attachments · ${chosen.attachments.length}</h3>${chosen.attachments.map(id => `<button type="button" data-source="${e(id)}"><span><strong>${e(id)}</strong><small>${e(sourceDocuments(model()).find(d => d.id === id)?.title ?? 'Source document')}</small></span></button>`).join('')}</section><footer>Fictional correspondence. No real email is sent.</footer>` : '<p class="pc-padding">No message selected.</p>'}</article></div>`;
        restore();
    }
    root.addEventListener('input', event => { const el = event.target as HTMLInputElement; if (el.getAttribute('aria-label') === 'Search scenario emails') { query = el.value; render(); } });
    root.addEventListener('change', event => {
        const el = event.target as HTMLInputElement;
        if (el.getAttribute('aria-label') === 'Mail folder') { folder = el.value; unreadOnly = false; render(); }
        if (el.getAttribute('aria-label') === 'Unread emails only') { unreadOnly = el.checked; render(); }
    });
    root.addEventListener('click', event => {
        const el = (event.target as Element).closest<HTMLElement>('button'); if (!el) return;
        if (el.dataset.mail) { selected = el.dataset.mail; render(); root.querySelector('.pc-message')?.scrollTo(0, 0); return; }
        if (el.dataset.source) { callbacks.source(el.dataset.source); return; }
        const chosen = scenarioMail(model()).find(m => m.id === selected); if (!chosen) return;
        if (el.dataset.action === 'read' && incomingMail(chosen)) void callbacks.send({ type: 'markDesktopMailRead', mailId: chosen.id, read: !model().state.desktop?.readMail.includes(chosen.id) });
        if (el.dataset.action === 'app') { if (chosen.taskId) callbacks.assignment(chosen.taskId); else if (chosen.view) callbacks.app(chosen.view); }
        if (el.dataset.action === 'export') { const file = virtualFiles(model()).find(f => f.kind === 'mail' && f.ref === chosen.id); if (file) { const payload = filePayload(file, model()); downloadFile(payload.name, payload.content, payload.mime); } }
    });
    render();
    return { refresh: render, select: id => { selected = id; query = ''; unreadOnly = false; folder = folderFor(scenarioMail(model()).find(m => m.id === id)); render(); root.querySelector('.pc-message')?.scrollTo(0, 0); } };
}
