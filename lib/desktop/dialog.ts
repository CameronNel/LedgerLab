import { htmlEscape as e } from '../accounting/exports';
/** Native top-layer modality keeps background windows inert for mouse and keyboard. */
export function desktopDialog(host: HTMLElement, title: string, message: string,
    choices: { id: string; label: string; primary?: boolean; danger?: boolean }[]): Promise<string> {
    return new Promise(resolve => {
        const previous = document.activeElement as HTMLElement | null;
        const dialog = document.createElement('dialog');
        dialog.className = 'pc-modal-backdrop';
        dialog.setAttribute('aria-label', title);
        dialog.innerHTML = `<section class="pc-modal"><h2>${e(title)}</h2><p>${e(message)}</p><div class="pc-modal-actions">${choices.map(c => `<button type="button" data-choice="${e(c.id)}" class="${c.primary ? 'primary' : ''} ${c.danger ? 'danger' : ''}">${e(c.label)}</button>`).join('')}</div></section>`;
        let done = false;
        const finish = (id: string) => {
            if (done) return;
            done = true; dialog.close(); dialog.remove();
            if (previous?.isConnected) previous.focus({ preventScroll: true });
            resolve(id);
        };
        dialog.addEventListener('click', event => {
            const id = (event.target as Element).closest<HTMLElement>('[data-choice]')?.dataset.choice;
            if (id) finish(id);
        });
        dialog.addEventListener('cancel', event => { event.preventDefault(); finish('cancel'); });
        dialog.addEventListener('keydown', event => {
            event.stopPropagation();
            if (event.key === 'Escape') { event.preventDefault(); finish('cancel'); }
        });
        host.append(dialog); dialog.showModal();
        (dialog.querySelector<HTMLButtonElement>('[data-choice="cancel"]') ?? dialog.querySelector<HTMLButtonElement>('button'))?.focus();
    });
}
