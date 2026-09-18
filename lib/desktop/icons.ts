/** Desktop icon primitives; no state or event handlers. */
const SVG: Record<string, string> = {
    folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z"/><path d="M3 10h18"/>',
    file: '<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v5h4M9 12h6M9 16h6"/>',
    sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 9v12"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    app: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 7v10h8M11 13v4M15 10v7"/>',
    bank: '<path d="m3 8 9-5 9 5H3Zm2 3v7m5-7v7m4-7v7m5-7v7M3 21h18"/>',
    note: '<path d="M5 3h14v18H5Z M8 8h8M8 12h8M8 16h5"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    back: '<path d="m14 5-7 7 7 7"/>', forward: '<path d="m10 5 7 7-7 7"/>', up: '<path d="m5 14 7-7 7 7"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>', min: '<path d="M5 17h14"/>', max: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
    restore: '<path d="M8 5V3h13v13h-3M3 8h13v13H3Z"/>', download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    print: '<path d="M7 8V3h10v5M7 17H3V8h18v9h-4M7 14h10v7H7Z"/>',
    save: '<path d="M4 3h13l3 3v15H4ZM8 3v6h8V3M8 21v-8h8v8"/>',
    plus: '<path d="M12 4v16M4 12h16"/>', tile: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
    home: '<path d="m3 11 9-8 9 8M5 9v12h14V9M10 21v-7h4v7"/>',
    check: '<path d="m4 12 5 5L20 6"/>', refresh: '<path d="M20 6v5h-5M4 18v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3"/>',
    grid: '<path d="M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/>',
};
export const icon = (name: string, cls = '') => `<svg class="pc-icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[name] ?? SVG.file}</svg>`;
