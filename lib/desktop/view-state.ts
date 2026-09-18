/** Preserve position and editing context when a framework-independent panel repaints. */
export function preserveView(root: HTMLElement): () => void {
    const active = document.activeElement instanceof HTMLElement && root.contains(document.activeElement)
        ? document.activeElement : null;
    const key = (node: HTMLElement): string | null => {
        for (const name of ['id', 'name', 'aria-label', 'data-review-task', 'data-day-task', 'data-day-action']) {
            const value = node.getAttribute(name);
            if (value) return `[${name}="${CSS.escape(value)}"]`;
        }
        return null;
    };
    const selector = active && key(active);
    let selection: [number | null, number | null] | undefined;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)
        try { selection = [active.selectionStart, active.selectionEnd]; } catch { /* Non-text inputs have no caret. */ }
    const scrollers = ['.day-desk', '.pc-review-desk', '.pc-review-layout>nav', '.pc-message-list', '.pc-message', '.pc-health'];
    const positions = scrollers.map(selector => { const el = root.querySelector<HTMLElement>(selector); return { selector, top: el?.scrollTop ?? 0, left: el?.scrollLeft ?? 0 }; });
    const details = [...root.querySelectorAll<HTMLDetailsElement>('details')].map(el => ({
        key: el.querySelector('summary')?.textContent, open: el.open,
    }));
    return () => {
        for (const detail of root.querySelectorAll<HTMLDetailsElement>('details')) {
            const saved = details.find(d => d.key === detail.querySelector('summary')?.textContent);
            if (saved) detail.open = saved.open;
        }
        if (selector) {
            const next = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
            if (next && !next.disabled) {
                next.focus({ preventScroll: true });
                if (selection && typeof next.setSelectionRange === 'function')
                    try { next.setSelectionRange(...selection); } catch { /* Select/date controls. */ }
            }
        }
        for (const { selector, top, left } of positions) {
            const node = root.querySelector<HTMLElement>(selector);
            if (node) { node.scrollTop = top; node.scrollLeft = left; }
        }
    };
}
