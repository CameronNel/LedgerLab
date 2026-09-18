import { htmlEscape as escape } from '../accounting/exports';
import { searchWorkspace, type SearchResult } from './search-index';
/** A native modal supplies focus containment and inert background interaction. */
export function openCommandPalette(host: HTMLElement, index: readonly SearchResult[], activate: (result: SearchResult) => void): () => void {
    const previous = document.activeElement as HTMLElement | null, dialog = document.createElement('dialog');
    dialog.className = 'pc-command-palette';
    dialog.setAttribute('aria-label', 'Search LedgerLab');
    dialog.innerHTML = `<header><h2>Find your work</h2><button type="button" data-search-close aria-label="Close search">×</button></header><label for="ledgerlab-global-query">Search apps, assignments, documents, journals, accounts and lessons</label><input id="ledgerlab-global-query" type="search" autocomplete="off" spellcheck="false" placeholder="Try an invoice reference, supplier or account" maxlength="200"><p class="pc-search-count" role="status" aria-live="polite"></p><div class="pc-search-results" role="list" aria-label="Search results"></div><footer>Arrow keys select a result. Enter opens it. Escape returns to your work.</footer>`;
    host.append(dialog);
    const input = dialog.querySelector<HTMLInputElement>('input')!, list = dialog.querySelector<HTMLElement>('.pc-search-results')!;
    let results: SearchResult[] = [], selected = 0, closed = false;
    const finish = (restore = true) => { if (closed)
        return; closed = true; dialog.close(); dialog.remove(); if (restore && previous?.isConnected)
        previous.focus({ preventScroll: true }); };
    const choose = (position: number) => { const item = results[position]; if (!item)
        return; finish(false); activate(item); };
    const highlight = () => { list.querySelectorAll<HTMLButtonElement>('button').forEach((button, i) => { button.dataset.selected = String(i === selected); }); list.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' }); };
    const render = () => {
        results = searchWorkspace(index, input.value);
        selected = 0;
        list.innerHTML = results.length ? results.map((result, i) => `<div role="listitem"><button type="button" data-search-result="${i}"><span class="pc-search-kind">${escape(result.kind)}</span><span><strong>${escape(result.title)}</strong><small>${escape(result.detail)}</small></span></button></div>`).join('') : '<p class="pc-search-empty">No matches in your available work. Try a shorter reference or a different word.</p>';
        dialog.querySelector('.pc-search-count')!.textContent = `${results.length}${results.length === 40 ? ' (first 40 shown)' : ''} results · unreleased evidence is excluded`;
        highlight();
    };
    input.addEventListener('input', render);
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
    dialog.querySelector('[data-search-close]')!.addEventListener('click', () => finish());
    dialog.addEventListener('click', event => { const item = (event.target as Element).closest<HTMLElement>('[data-search-result]'); if (item)
        choose(Number(item.dataset.searchResult)); });
    dialog.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.key === 'Escape') {
            event.preventDefault();
            finish();
            return;
        }
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && results.length) {
            event.preventDefault();
            selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
            highlight();
            input.focus();
        }
        if (event.key === 'Enter' && document.activeElement === input) {
            event.preventDefault();
            choose(selected);
        }
    });
    render();
    dialog.showModal();
    input.focus();
    return () => finish();
}
