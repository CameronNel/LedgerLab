export type NumberFormat = 'general'|'number'|'currency'|'accounting'|'percent'|'date'|'integer';
export type CellStyle = {bold?:boolean;italic?:boolean;underline?:boolean;wrap?:boolean;format?:NumberFormat;decimals?:number;align?:'left'|'center'|'right';fill?:string;color?:string;};
export type DesktopWorksheet = {id:string;name:string;cells:string[][];styles?:Record<string,CellStyle>;widths?:Record<string,number>;freezeRows?:number;freezeCols?:number;};
/** Learner-created desktop files. Source evidence is never stored or edited here. */
export type DesktopUserFile = {
  id: string;
  name: string;
  folder: string;
  kind: 'note' | 'workbook';
  text: string;
  cells: string[][];
  sheets?: DesktopWorksheet[];
  activeSheetId?: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
};
export type DesktopState = { version: 1; files: DesktopUserFile[]; readMail: string[] };
export const DESKTOP_LIMITS = { files: 80, rows: 500, columns: 52, sheets: 8, cellLength: 1000, textLength: 30000, bytes: 650000 } as const;
export const emptyDesktop = (): DesktopState => ({version: 1, files: [], readMail: []});
export function desktopFileError(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Choose a valid desktop file.';
  const f = value as DesktopUserFile;
  if (typeof f.id !== 'string' || !/^UF-[A-Za-z0-9_-]{1,80}$/.test(f.id)) return 'Invalid desktop file identifier.';
  if (typeof f.name !== 'string' || !f.name.trim() || f.name.length > 120 || /[\\/<>:"|?*\x00-\x1f]/.test(f.name) || /[. ]$/.test(f.name)) return 'Use a file name without path separators or reserved characters (120 characters maximum).';
  if (typeof f.folder !== 'string' || f.folder.length > 200 || !/^(Working papers|My notes)(\/[^/]+)*$/.test(f.folder) || f.folder.split('/').some(s => !s.trim() || s.trim() !== s || s === '.' || s === '..' || /[\\<>:"|?*\x00-\x1f]/.test(s))) return 'Save learner files under Working papers or My notes, using a relative folder path.';
  if (!['note','workbook'].includes(f.kind) || typeof f.deleted !== 'boolean' || typeof f.text !== 'string' || f.text.length > DESKTOP_LIMITS.textLength) return 'Invalid desktop file content.';
  if (!Array.isArray(f.cells) || f.cells.length > DESKTOP_LIMITS.rows || f.cells.some(r => !Array.isArray(r) || r.length > DESKTOP_LIMITS.columns || r.some(c => typeof c !== 'string' || c.length > DESKTOP_LIMITS.cellLength))) return `Working papers support up to ${DESKTOP_LIMITS.rows} rows, ${DESKTOP_LIMITS.columns} columns and ${DESKTOP_LIMITS.cellLength} characters per cell.`;
  if (f.kind === 'workbook' && !/\.xlsx$/i.test(f.name) || f.kind === 'note' && !/\.(txt|md)$/i.test(f.name)) return 'Working papers need an .xlsx name; notes need a .txt or .md name.';
  if (f.kind === 'workbook' && (!f.cells.length || !f.cells[0].length || f.cells.some(r => r.length !== f.cells[0].length))) return 'A working paper needs a rectangular cell grid.';
  if (f.kind === 'note' && f.cells.length) return 'Notes cannot contain worksheet cells.';
  if(f.sheets!==undefined){
    if(f.kind!=='workbook'||!Array.isArray(f.sheets)||!f.sheets.length||f.sheets.length>DESKTOP_LIMITS.sheets)return 'A workbook supports one to eight sheets.';
    const names=new Set<string>(),ids=new Set<string>();
    for(const sheet of f.sheets){
      if(!sheet||typeof sheet!=='object'||typeof sheet.id!=='string'||!/^[-A-Za-z0-9_]{1,80}$/.test(sheet.id)||ids.has(sheet.id)||typeof sheet.name!=='string'||!sheet.name.trim()||sheet.name!==sheet.name.trim()||sheet.name.length>31||/[\\/?*\[\]:]/.test(sheet.name)||/^'|'$/.test(sheet.name)||names.has(sheet.name.toLowerCase()))return 'Invalid or duplicate sheet name/identifier.';
      names.add(sheet.name.toLowerCase());ids.add(sheet.id);
      if(!Array.isArray(sheet.cells)||!sheet.cells.length||sheet.cells.length>DESKTOP_LIMITS.rows||!Array.isArray(sheet.cells[0])||!sheet.cells[0].length||sheet.cells[0].length>DESKTOP_LIMITS.columns||sheet.cells.some(r=>!Array.isArray(r)||r.length!==sheet.cells[0].length||r.some(c=>typeof c!=='string'||c.length>DESKTOP_LIMITS.cellLength)))return 'Invalid sheet grid or sheet size limit exceeded.';
      for(const [key,max] of [['freezeRows',20],['freezeCols',5]] as const)if(sheet[key]!==undefined&&(!Number.isInteger(sheet[key])||sheet[key]!<0||sheet[key]!>max))return 'Invalid frozen pane setting.';
      if(sheet.widths!==undefined&&(!sheet.widths||Array.isArray(sheet.widths)||typeof sheet.widths!=='object'||Object.entries(sheet.widths).some(([k,v])=>!/^\d+$/.test(k)||Number(k)>=DESKTOP_LIMITS.columns||typeof v!=='number'||!Number.isFinite(v)||v<40||v>600)))return 'Invalid column widths.';
      if(sheet.styles!==undefined){
        if(!sheet.styles||typeof sheet.styles!=='object'||Array.isArray(sheet.styles)||Object.keys(sheet.styles).length>DESKTOP_LIMITS.rows*DESKTOP_LIMITS.columns)return 'Invalid cell styles.';
        for(const [ref,style] of Object.entries(sheet.styles)){
          if(!/^(?:[A-Z]|A[A-Z])[1-9]\d{0,2}$/.test(ref)||Number(ref.replace(/^[A-Z]+/,''))>DESKTOP_LIMITS.rows||!style||typeof style!=='object'||Array.isArray(style))return 'Invalid cell style address.';
          if(Object.keys(style).some(k=>!['bold','italic','underline','wrap','format','decimals','align','fill','color'].includes(k)))return 'Unsupported cell style property.';
          for(const key of ['bold','italic','underline','wrap'] as const)if(style[key]!==undefined&&typeof style[key]!=='boolean')return 'Invalid style flag.';
          if(style.format!==undefined&&!['general','number','currency','accounting','percent','date','integer'].includes(style.format)||style.align!==undefined&&!['left','center','right'].includes(style.align)||style.decimals!==undefined&&(!Number.isInteger(style.decimals)||style.decimals<0||style.decimals>8))return 'Invalid number/alignment format.';
          for(const key of ['fill','color'] as const)if(style[key]!==undefined&&(typeof style[key]!=='string'||!/^#[A-Fa-f0-9]{6}$/.test(style[key]!)))return 'Invalid style colour.';
        }
      }
    }
    if(f.activeSheetId!==undefined&&!ids.has(f.activeSheetId))return 'The active sheet no longer exists.';
    if(JSON.stringify(f.cells)!==JSON.stringify(f.sheets[0].cells))return 'The legacy first-sheet mirror does not match the workbook.';
  }
  for (const field of ['createdAt','updatedAt'] as const) if (typeof f[field] !== 'string' || f[field].length > 40 || !Number.isFinite(Date.parse(f[field]))) return 'Invalid file timestamp.';
  return null;
}
export function desktopStateError(value: unknown): string | null {
  if (value === undefined) return null; // Backward-compatible with every earlier backup.
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Invalid desktop workspace.';
  const d = value as DesktopState;
  if (d.version !== 1 || !Array.isArray(d.files) || d.files.length > DESKTOP_LIMITS.files || !Array.isArray(d.readMail) || d.readMail.length > 2000 || d.readMail.some(id => typeof id !== 'string' || !/^MAIL-[A-Za-z0-9_-]{1,120}$/.test(id))) return 'Invalid desktop files or mail markers.';
  if (new Set(d.files.map(f => f?.id)).size !== d.files.length || new Set(d.readMail).size !== d.readMail.length) return 'Duplicate desktop identifiers.';
  for (const f of d.files) {const error = desktopFileError(f); if (error) return error;}
  const paths = d.files.filter(f => !f.deleted).map(f => `${f.folder}/${f.name}`.toLowerCase());
  if (new Set(paths).size !== paths.length) return 'A file with that name already exists in this folder.';
  if (new TextEncoder().encode(JSON.stringify(d)).byteLength > DESKTOP_LIMITS.bytes) return 'Desktop storage is full. Export your work and reduce file contents before saving.';
  return null;
}

/** UUID v4 with a secure-context-independent fallback for local preview files. */
export function newDesktopId():string {
  if(typeof crypto.randomUUID==='function')return `UF-${crypto.randomUUID()}`;
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return `UF-${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
