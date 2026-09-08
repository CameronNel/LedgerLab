/** Spreadsheet interaction layer. Calculation and file state live outside the DOM. */
import {htmlEscape as e} from '../accounting/exports';
import {DESKTOP_LIMITS,type DesktopUserFile,type DesktopWorksheet,type CellStyle,type NumberFormat} from './types';
import {evaluateWorkbook,FORMULA_FUNCTIONS,dateSerial,serialDate,type CellValue} from './worksheet';
import {address,columnName,position,ensureWorkbook,syncWorkbook,expandSheet,shiftFormula,mapReferences,quoteSheet,renameSheet,insertDelete,parseDelimited,toTSV} from './workbook-model';
export type SpreadsheetHandle={flush:()=>void;hasPendingEdit:()=>boolean;refresh:()=>void;setDisabled:(disabled:boolean)=>void;destroy:()=>void};
type Options={file:()=>DesktopUserFile;changed:()=>void;editingChanged?:()=>void;save:()=>Promise<void>;notify:(message:string)=>void;confirm:(title:string,message:string,accept:string)=>Promise<boolean>};
type Point=[number,number];
type Clip={rows:string[][];styles:CellStyle[][];values:CellValue[][];start:Point;sheetId:string;cut:boolean;tsv:string};
type Editing={row:number;col:number;value:string;original:string;start?:number;end?:number;point?:Point;};
const btn=(a:string,label:string,title=label)=>`<button type="button" data-xl="${a}" title="${e(title)}" aria-label="${e(title)}">${label}</button>`;
const colour=(v:string)=>/^#[a-f0-9]{6}$/i.test(v)?v:'#ffffff';
const numeric=(v:string)=>/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v);
export function displayCell(value:CellValue,style:CellStyle={}):string{
  if(typeof value==='boolean')return value?'TRUE':'FALSE';if(typeof value!=='number')return value;
  const decimals=style.decimals??2;if(style.format==='date'){const date=serialDate(value);return Number.isFinite(date.getTime())?date.toISOString().slice(0,10):'#NUM!';}
  if(style.format==='percent')return (value*100).toLocaleString('en-GB',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})+'%';
  if(style.format==='accounting'||style.format==='currency'){if(value===0)return '–';const text=Math.abs(value).toLocaleString('en-GB',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});return (value<0?'(':'')+(style.format==='currency'?'$':'')+text+(value<0?')':'');}
  if(style.format==='number'||style.format==='integer')return value.toLocaleString('en-GB',{minimumFractionDigits:style.format==='integer'?0:decimals,maximumFractionDigits:style.format==='integer'?0:decimals});
  return Number.isInteger(value)?String(value):String(Number(value.toPrecision(12)));
}
export function mountSpreadsheet(root:HTMLElement,options:Options):SpreadsheetHandle{return new Spreadsheet(root,options);}
class Spreadsheet implements SpreadsheetHandle{
  private selected:Point=[0,0];private anchor:Point=[0,0];private editing:Editing|null=null;private disabled=false;private dead=false;
  private undoStack:string[]=[];private redoStack:string[]=[];private clipboard:Clip|null=null;private pasteValues=false;
  private values:CellValue[][][]=[];private view:HTMLElement;private table:HTMLTableElement;private formula:HTMLInputElement;private nameBox:HTMLInputElement;
  private drag:'select'|'fill'|'reference'|null=null;private dragEnd:Point=[0,0];private resizing:{col:number;x:number;width:number}|null=null;
  private showFormulas=false;private filter='';private findIndex=-1;private tab='home';private filterOn=false;private filterHeader=0;
  constructor(private root:HTMLElement,private options:Options){
    root.className='xl-workbook';ensureWorkbook(options.file());this.prepareSize();
    root.innerHTML=`<div class="xl-menu" role="tablist" aria-label="Spreadsheet ribbon"><strong>Working papers</strong>${['home','data','view'].map(t=>`<button type="button" data-ribbon="${t}" role="tab" aria-selected="${t==='home'}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}<span></span>${btn('help','?','Spreadsheet help and shortcuts')}</div>
      <div class="xl-ribbon" data-panel="home"><div class="xl-group">${btn('undo','↶','Undo (Ctrl+Z)')}${btn('redo','↷','Redo (Ctrl+Y)')}<small>History</small></div><div class="xl-group">${btn('cut','Cut','Cut cells (Ctrl+X)')}${btn('copy','Copy','Copy cells (Ctrl+C)')}${btn('paste','Paste','Paste cells (Ctrl+V)')}${btn('paste-values','Values','Paste values only')}<small>Clipboard</small></div><div class="xl-group">${btn('bold','<b>B</b>','Bold (Ctrl+B)')}${btn('italic','<i>I</i>','Italic (Ctrl+I)')}${btn('underline','<u>U</u>','Underline (Ctrl+U)')}<label title="Cell fill">Fill <input type="color" data-style="fill" aria-label="Cell fill" value="#fff2cc"></label><label title="Font colour">A <input type="color" data-style="color" aria-label="Font colour" value="#172d27"></label><small>Font & fill</small></div><div class="xl-group"><select aria-label="Number format"><option value="general">General</option><option value="number">Number</option><option value="accounting">Accounting</option><option value="currency">Currency (AUD)</option><option value="percent">Percentage</option><option value="date">Date</option><option value="integer">Integer</option></select>${btn('decimals-less','.0 ←','Decrease decimal places')}${btn('decimals-more','→ .00','Increase decimal places')}<small>Number</small></div><div class="xl-group">${btn('align-left','≡','Align left')}${btn('align-center','≡','Align center')}${btn('align-right','≡','Align right')}${btn('wrap','Wrap','Wrap text')}<small>Alignment</small></div><div class="xl-group">${btn('sum','Σ','AutoSum (Alt+=)')}${btn('fill-down','↓','Fill down (Ctrl+D)')}${btn('fill-right','→','Fill right (Ctrl+R)')}${btn('find','Find','Find / replace (Ctrl+F)')}<small>Editing</small></div></div>
      <div class="xl-ribbon" data-panel="data" hidden><div class="xl-group">${btn('sort-asc','A ↓ Z','Sort selected range ascending')}${btn('sort-desc','Z ↓ A','Sort selected range descending')}<label><input type="checkbox" aria-label="Selection has headers" checked> Headers</label>${btn('filter','Filter','Filter rows without changing their data')}<small>Selected range</small></div><div class="xl-group">${btn('insert-row','Insert row')}${btn('delete-row','Delete row')}${btn('insert-column','Insert column')}${btn('delete-column','Delete column')}<small>Structure</small></div><div class="xl-group">${btn('add-rows','+ 100 rows','Add 100 rows')}${btn('add-columns','+ 5 columns','Add 5 columns')}${btn('clear','Clear contents','Clear selected contents (Delete)')}<small>Sheet size</small></div></div>
      <div class="xl-ribbon" data-panel="view" hidden><div class="xl-group">${btn('freeze-row','Freeze top row')}${btn('freeze-col','Freeze first column')}${btn('unfreeze','Unfreeze panes')}${btn('formulas','Show formulas','Toggle calculated values / formulas')}<small>View</small></div><div class="xl-group">${btn('rename-sheet','Rename sheet')}${btn('duplicate-sheet','Duplicate sheet')}${btn('fit-column','AutoFit column')}<small>Worksheet</small></div></div>
      <div class="xl-find" hidden><label>Find <input aria-label="Find in sheet" placeholder="Value, text or formula"></label><label>Replace <input aria-label="Replace with"></label>${btn('find-next','Next')}${btn('replace','Replace')}${btn('replace-all','Replace all')}${btn('close-find','×','Close find bar')}</div>
      <div class="xl-filter" hidden><label>Filter rows <input aria-label="Filter rows" placeholder="Type any text or amount to match"></label><span>Visual filter only. SUM includes hidden rows.</span>${btn('clear-filter','Clear filter')}</div>
      <div class="xl-sheet-name" hidden><label>Sheet name <input aria-label="Sheet name" maxlength="31"></label>${btn('confirm-rename','Rename')}${btn('cancel-rename','Cancel')}</div>
      <div class="xl-formula"><input class="xl-name" aria-label="Name box" value="A1" title="Go to a cell or select a range, e.g. B12:D20"><span class="xl-formula-controls">${btn('cancel-edit','×','Cancel cell edit (Escape)')}${btn('commit-edit','✓','Accept cell edit (Enter)')}<i>fx</i></span><input aria-label="Formula bar" maxlength="${DESKTOP_LIMITS.cellLength}" spellcheck="false" autocomplete="off" placeholder="Select a cell, then type a value or formula"></div>
      <div class="xl-grid-scroll" role="grid" aria-label="Working paper grid" tabindex="0"><table class="xl-grid"></table></div>
      <div class="xl-sheet-tabs" role="tablist" aria-label="Worksheet tabs"></div><div class="xl-status"><span data-xl-mode>Ready</span><span data-xl-summary></span><span class="xl-status-hint">AUD · Calculations only, not postings</span></div>
      <div class="xl-help" hidden><strong>Work as you would in a spreadsheet</strong><p>Click to select; double-click or F2 to edit. Type to replace. Enter moves down, Tab moves right, Escape cancels. Shift+arrows or drag selects a range. Copy/paste keeps formulas and adjusts relative references. F4 toggles $ references while editing. Drag the green fill handle or use Ctrl+D / Ctrl+R. Ctrl+S saves the workbook; Ctrl+Z undoes. Use the name box for ranges such as B5:D18.</p><p><strong>Functions:</strong> ${FORMULA_FUNCTIONS.join(', ')}. Cross-sheet references use 'Sheet name'!A1. Import/export supports basic XLSX cells, formulas and formatting, not all Excel objects. 500 rows × 52 columns per sheet, 8 sheets. No macros, external links, pivot tables or dynamic arrays. SUBTOTAL currently includes visually filtered rows.</p>${btn('help-close','Close help')}</div>`;
    this.view=root.querySelector('.xl-grid-scroll')!;this.table=root.querySelector('table')!;this.formula=root.querySelector('[aria-label="Formula bar"]')!;this.nameBox=root.querySelector('[aria-label="Name box"]')!;
    root.addEventListener('click',this.click);root.addEventListener('dblclick',this.doubleClick);root.addEventListener('keydown',this.keydown);root.addEventListener('input',this.input);root.addEventListener('change',this.change);
    root.addEventListener('pointerdown',this.pointerdown);root.addEventListener('copy',this.copyEvent);root.addEventListener('cut',this.cutEvent);root.addEventListener('paste',this.pasteEvent);
    document.addEventListener('pointermove',this.pointermove);document.addEventListener('pointerup',this.pointerup);this.render();
  }
  private get file(){return this.options.file();}private get sheets(){return ensureWorkbook(this.file);}private get sheet(){return this.sheets.find(s=>s.id===this.file.activeSheetId)!;}private get sheetIndex(){return this.sheets.indexOf(this.sheet);}
  private prepareSize(){const s=this.sheet;expandSheet(s,Math.max(100,s.cells.length),Math.max(26,s.cells[0].length));syncWorkbook(this.file);}
  private snapshot(){return JSON.stringify({sheets:this.sheets,activeSheetId:this.file.activeSheetId});}
  private begin(){if(this.disabled)throw Error('A save is in progress.');this.undoStack.push(this.snapshot());if(this.undoStack.length>40)this.undoStack.shift();this.redoStack=[];}
  private changed(){syncWorkbook(this.file);this.options.changed();this.render();}
  private bounds(){return {r1:Math.min(this.selected[0],this.anchor[0]),r2:Math.max(this.selected[0],this.anchor[0]),c1:Math.min(this.selected[1],this.anchor[1]),c2:Math.max(this.selected[1],this.anchor[1])};}
  private each(callback:(r:number,c:number)=>void){const b=this.bounds();for(let r=b.r1;r<=b.r2;r++)for(let c=b.c1;c<=b.c2;c++)callback(r,c);}
  private get activeStyle(){return this.sheet.styles?.[address(...this.selected)]??{};}
  private styleCSS(style:CellStyle,value:CellValue){return `${style.bold?'font-weight:700;':''}${style.italic?'font-style:italic;':''}${style.underline?'text-decoration:underline;':''}${style.fill?`background:${colour(style.fill)};`:''}color:${style.color?colour(style.color):typeof value==='number'&&value<0&&['accounting','currency'].includes(style.format??'')?'#b53c43':'inherit'};text-align:${style.align??(typeof value==='number'?'right':typeof value==='boolean'?'center':'left')};${style.wrap?'white-space:normal;overflow-wrap:anywhere;':''}`;}
  private render(){
    if(this.dead)return;const top=this.view.scrollTop,left=this.view.scrollLeft;this.values=evaluateWorkbook(this.sheets);const sheet=this.sheet,values=this.values[this.sheetIndex],fr=sheet.freezeRows??0,fc=sheet.freezeCols??0;
    const widths=sheet.cells[0].map((_,c)=>sheet.widths?.[c]??(c===0?210:112)),lefts:number[]=[];let offset=42;for(const width of widths){lefts.push(offset);offset+=width;}
    const sticky=(r:number,c:number)=>`${r<fr?`position:sticky;top:${28+r*26}px;z-index:${c<fc?6:4};`:''}${c<fc?`position:sticky;left:${lefts[c]}px;z-index:${r<fr?6:3};`:''}`;
    this.table.innerHTML=`<colgroup><col style="width:42px">${widths.map(w=>`<col style="width:${w}px">`).join('')}</colgroup><thead><tr><th class="xl-corner" data-all aria-label="Select all cells"></th>${widths.map((_,c)=>`<th data-col="${c}" scope="col" style="${c<fc?`left:${lefts[c]}px;z-index:9;`:''}">${columnName(c)}<span class="xl-col-resize" data-resize-col="${c}" title="Drag to resize, double-click to fit"></span></th>`).join('')}</tr></thead><tbody>${sheet.cells.map((row,r)=>{
      const hidden=this.filterOn&&this.filter&&r>this.filterHeader&&!values[r].some(v=>String(v).toLowerCase().includes(this.filter.toLowerCase()));
      return `<tr ${hidden?'hidden':''}><th scope="row" data-row="${r}" style="${r<fr?`top:${28+r*26}px;z-index:7;`:''}">${r+1}</th>${row.map((raw,c)=>{const ref=address(r,c),style=sheet.styles?.[ref]??{},value=values[r][c];return `<td role="gridcell" aria-label="${ref}" data-cell="${r},${c}" aria-selected="false" data-formula="${raw.startsWith('=')}" data-error="${typeof value==='string'&&/^#(?:REF|DIV|VALUE|NAME|N\/A|CIRC|ERROR|LIMIT|NUM)/.test(value)}" style="${this.styleCSS(style,value)}${sticky(r,c)}" title="${e(raw.startsWith('=')?raw:displayCell(value,style))}"><span class="xl-cell-value">${e(this.showFormulas&&raw.startsWith('=')?raw:displayCell(value,style))}</span></td>`;}).join('')}</tr>`;
    }).join('')}</tbody>`;
    this.table.style.width=(42+widths.reduce((a,b)=>a+b,0))+'px';this.view.setAttribute('aria-rowcount',String(sheet.cells.length));this.view.setAttribute('aria-colcount',String(sheet.cells[0].length));this.view.scrollTop=top;this.view.scrollLeft=left;
    const tabs=this.root.querySelector('.xl-sheet-tabs')!;tabs.innerHTML=this.sheets.map(s=>`<span class="xl-tab-wrap" data-current="${s.id===sheet.id}"><button type="button" role="tab" data-sheet="${e(s.id)}" aria-selected="${s.id===sheet.id}">${e(s.name)}</button><button type="button" class="xl-delete-tab" data-delete-sheet="${e(s.id)}" aria-label="Delete sheet ${e(s.name)}" title="Delete sheet (asks first)" ${this.sheets.length===1?'disabled':''}>×</button></span>`).join('')+btn('add-sheet','+','Add worksheet');
    (this.root.querySelector('[data-xl="undo"]') as HTMLButtonElement).disabled=!this.undoStack.length||this.disabled;(this.root.querySelector('[data-xl="redo"]') as HTMLButtonElement).disabled=!this.redoStack.length||this.disabled;
    this.paintSelection();
  }
  private paintSelection(){
    const maxr=this.sheet.cells.length-1,maxc=this.sheet.cells[0].length-1;this.selected=[Math.max(0,Math.min(this.selected[0],maxr)),Math.max(0,Math.min(this.selected[1],maxc))];this.anchor=[Math.max(0,Math.min(this.anchor[0],maxr)),Math.max(0,Math.min(this.anchor[1],maxc))];
    this.table.querySelectorAll('[aria-selected="true"]').forEach(c=>c.setAttribute('aria-selected','false'));this.table.querySelector('[data-active-cell]')?.removeAttribute('data-active-cell');this.table.querySelector('.xl-fill-handle')?.remove();
    this.each((r,c)=>this.cell(r,c)?.setAttribute('aria-selected','true'));this.cell(...this.selected)?.setAttribute('data-active-cell','true');
    const b=this.bounds(),end=this.cell(b.r2,b.c2);if(end&&!this.disabled&&!this.editing){const handle=document.createElement('button');handle.type='button';handle.className='xl-fill-handle';handle.setAttribute('aria-label','Drag to fill selected cells');handle.tabIndex=-1;end.append(handle);}
    const values:CellValue[]=[];this.each((r,c)=>values.push(this.values[this.sheetIndex]?.[r]?.[c]??''));const nums=values.filter((v):v is number=>typeof v==='number');
    this.root.querySelector('[data-xl-summary]')!.textContent=`Count: ${values.filter(v=>v!=='').length}${nums.length?`    Average: ${displayCell(nums.reduce((a,b)=>a+b,0)/nums.length,{format:'number'})}    Sum: ${displayCell(nums.reduce((a,b)=>a+b,0),{format:'number'})}`:''}`;
    if(!this.editing){this.nameBox.value=b.r1===b.r2&&b.c1===b.c2?address(...this.selected):`${address(b.r1,b.c1)}:${address(b.r2,b.c2)}`;this.formula.value=this.sheet.cells[this.selected[0]][this.selected[1]];}
    const select=this.root.querySelector<HTMLSelectElement>('[aria-label="Number format"]')!;select.value=this.activeStyle.format??'general';
    for(const a of ['bold','italic','underline','wrap'])this.root.querySelector(`[data-xl="${a}"]`)?.setAttribute('aria-pressed',String(!!this.activeStyle[a as keyof CellStyle]));
    this.root.querySelector('[data-xl-mode]')!.textContent=this.disabled?'Saving…':this.editing?'Edit':this.filterOn?'Filter enabled':'Ready';
  }
  private cell(r:number,c:number){return this.table.querySelector<HTMLTableCellElement>(`[data-cell="${r},${c}"]`);}
  private select(r:number,c:number,extend=false,scroll=true){this.selected=[Math.max(0,Math.min(r,this.sheet.cells.length-1)),Math.max(0,Math.min(c,this.sheet.cells[0].length-1))];if(!extend)this.anchor=[...this.selected];this.paintSelection();if(scroll)this.cell(...this.selected)?.scrollIntoView({block:'nearest',inline:'nearest'});}
  private startEdit(initial?:string,formulaFocus=false){
    if(this.disabled)return;if(this.editing)this.flush();const [r,c]=this.selected,raw=this.sheet.cells[r][c];this.editing={row:r,col:c,original:raw,value:initial??raw};
    const input=document.createElement('input');input.className='xl-cell-editor';input.setAttribute('aria-label','Edit '+address(r,c));input.maxLength=DESKTOP_LIMITS.cellLength;input.spellcheck=false;input.autocomplete='off';input.value=this.editing.value;
    this.cell(r,c)?.append(input);this.formula.value=this.editing.value;this.paintSelection();const target=formulaFocus?this.formula:input;target.focus();target.setSelectionRange(target.value.length,target.value.length);this.options.editingChanged?.();
  }
  hasPendingEdit=()=>!!this.editing&&this.editing.value!==this.editing.original;
  flush=()=>{
    const edit=this.editing;if(!edit)return;this.editing=null;this.table.querySelector('.xl-cell-editor')?.remove();
    if(edit.value!==edit.original){this.begin();let raw=edit.value;const ref=address(edit.row,edit.col);if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){const date=new Date(raw+'T00:00:00Z');if(Number.isFinite(date.getTime())){raw=String(dateSerial(date));this.sheet.styles??={};this.sheet.styles[ref]={...this.sheet.styles[ref],format:'date'};}}
      else if(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)%$/.test(raw)){raw=String(Number(raw.slice(0,-1))/100);this.sheet.styles??={};this.sheet.styles[ref]={...this.sheet.styles[ref],format:'percent'};}
      this.sheet.cells[edit.row][edit.col]=raw;this.changed();}else this.paintSelection();this.options.editingChanged?.();
  };
  private cancelEdit(){this.editing=null;this.table.querySelector('.xl-cell-editor')?.remove();this.paintSelection();this.view.focus();this.options.editingChanged?.();}
  private input=(event:Event)=>{
    queueMicrotask(()=>this.options.editingChanged?.());
    const input=event.target as HTMLInputElement;if(this.disabled)return;
    if(input===this.formula||input.classList.contains('xl-cell-editor')){if(!this.editing){const value=input.value;this.startEdit(undefined,true);input.value=value;}this.editing!.value=input.value;delete this.editing!.start;delete this.editing!.end;this.formula.value=input.value;const cellInput=this.table.querySelector<HTMLInputElement>('.xl-cell-editor');if(cellInput&&cellInput!==input)cellInput.value=input.value;this.root.querySelector('[data-xl-mode]')!.textContent='Edit';}
    if(input.getAttribute('aria-label')==='Filter rows'){this.filter=input.value;this.render();}
  };
  private change=(event:Event)=>{
    const target=event.target as HTMLInputElement;if(target.dataset.style)this.applyStyle({[target.dataset.style]:target.value});if(target.getAttribute('aria-label')==='Number format')this.applyStyle({format:target.value as NumberFormat});
  };
  private applyStyle(style:CellStyle){this.flush();if(this.disabled)return;this.begin();this.sheet.styles??={};this.each((r,c)=>{const key=address(r,c);this.sheet.styles![key]={...this.sheet.styles![key],...style};});this.changed();this.view.focus();}
  private doubleClick=(event:MouseEvent)=>{
    const target=event.target as Element;if(target.closest('[data-resize-col]')){this.fitColumn(Number(target.closest<HTMLElement>('[data-resize-col]')!.dataset.resizeCol));return;}
    const tab=target.closest<HTMLElement>('[data-sheet]');if(tab){void this.action('rename-sheet');return;}if(target.closest('[data-cell]')){this.flush();this.startEdit();}
  };
  private pointerdown=(event:PointerEvent)=>{
    if(this.disabled||event.button!==0)return;const target=event.target as Element;
    const resize=target.closest<HTMLElement>('[data-resize-col]');if(resize){event.preventDefault();this.flush();const c=Number(resize.dataset.resizeCol);this.resizing={col:c,x:event.clientX,width:this.sheet.widths?.[c]??(c===0?210:112)};return;}
    const td=target.closest<HTMLElement>('[data-cell]');if(!td)return;if(target.classList.contains('xl-cell-editor'))return;
    const point=td.dataset.cell!.split(',').map(Number) as Point;
    if(target.closest('.xl-fill-handle')){event.preventDefault();this.flush();this.drag='fill';this.dragEnd=point;return;}
    if(this.editing&&this.editing.value.startsWith('=')){
      const input=document.activeElement as HTMLInputElement,at=input===this.formula||input?.classList?.contains('xl-cell-editor')?input.selectionStart??this.editing.value.length:this.editing.value.length;
      if(this.editing.start!==undefined||/[=+\-*/^(,:;&<>]$/.test(this.editing.value.slice(0,at))){event.preventDefault();this.editing.start??=at;this.editing.end??=at;this.editing.point=point;this.drag='reference';this.pointReference(point);return;}
    }
    event.preventDefault();this.flush();this.select(point[0],point[1],event.shiftKey,false);this.drag='select';this.view.focus({preventScroll:true});
  };
  private pointReference(point:Point){
    const edit=this.editing!;const a=edit.point!,ref=a[0]===point[0]&&a[1]===point[1]?address(...point):`${address(...a)}:${address(...point)}`;const start=edit.start!,end=edit.end!;
    edit.value=edit.value.slice(0,start)+ref+edit.value.slice(end);edit.end=start+ref.length;this.formula.value=edit.value;const input=this.table.querySelector<HTMLInputElement>('.xl-cell-editor');if(input){input.value=edit.value;input.focus({preventScroll:true});input.setSelectionRange(edit.end,edit.end);}
  }
  private pointermove=(event:PointerEvent)=>{
    if(this.resizing){const r=this.resizing,w=Math.max(40,Math.min(600,r.width+event.clientX-r.x)),col=this.table.querySelectorAll('col')[r.col+1];if(col)(col as HTMLElement).style.width=w+'px';return;}
    if(!this.drag)return;const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-cell]');if(!target||!this.root.contains(target))return;const p=target.dataset.cell!.split(',').map(Number) as Point;
    if(this.drag==='select')this.select(p[0],p[1],true,false);else if(this.drag==='reference')this.pointReference(p);else{this.dragEnd=p;this.root.querySelector('[data-xl-mode]')!.textContent=`Fill to ${address(...p)}`;}
    const box=this.view.getBoundingClientRect();if(event.clientY>box.bottom-24)this.view.scrollTop+=22;if(event.clientX>box.right-24)this.view.scrollLeft+=30;
  };
  private pointerup=(event:PointerEvent)=>{
    if(this.resizing){const r=this.resizing;this.resizing=null;this.begin();this.sheet.widths??={};this.sheet.widths[r.col]=Math.max(40,Math.min(600,r.width+event.clientX-r.x));this.changed();}
    if(this.drag==='fill')this.fillHandle(this.dragEnd);this.drag=null;
  };
  private keydown=(event:KeyboardEvent)=>{
    if(this.disabled)return;const target=event.target as HTMLInputElement,mod=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();
    if(target===this.nameBox){if(event.key==='Enter'){event.preventDefault();this.goTo(this.nameBox.value);}return;}
    const inCell=target===this.formula||target.classList?.contains('xl-cell-editor');
    if(this.editing&&inCell){
      if(mod&&key==='s'){event.preventDefault();event.stopPropagation();this.flush();void this.options.save();return;}
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.cancelEdit();return;}
      if(event.key==='F4'){event.preventDefault();const edit=this.editing,at=target.selectionStart??edit.value.length;let candidate:RegExpExecArray|null=null,m:RegExpExecArray|null;const re=/\$?[A-Z]{1,2}\$?[1-9]\d*/gi;while((m=re.exec(edit.value))){if(m.index<=at&&m.index+m[0].length>=at){candidate=m;break;}if(m.index<at)candidate=m;}
        if(candidate){const raw=candidate[0],p=/^(\$?)([A-Z]+)(\$?)(\d+)$/i.exec(raw)!,next=!p[1]&&!p[3]?`$${p[2]}$${p[4]}`:p[1]&&p[3]?`${p[2]}$${p[4]}`:!p[1]&&p[3]?`$${p[2]}${p[4]}`:`${p[2]}${p[4]}`;edit.value=edit.value.slice(0,candidate.index)+next+edit.value.slice(candidate.index+raw.length);target.value=edit.value;this.formula.value=edit.value;const input=this.table.querySelector<HTMLInputElement>('.xl-cell-editor');if(input)input.value=edit.value;target.setSelectionRange(candidate.index+next.length,candidate.index+next.length);}return;}
      if(event.key==='Enter'||event.key==='Tab'){event.preventDefault();this.flush();this.select(this.selected[0]+(event.key==='Enter'?(event.shiftKey?-1:1):0),this.selected[1]+(event.key==='Tab'?(event.shiftKey?-1:1):0));this.view.focus();}return;
    }
    if(target.matches('input,textarea,select'))return;
    if(mod){
      if(['z','y','b','i','u','d','r','f','h','s','a','g'].includes(key)){event.preventDefault();event.stopPropagation();
        if(key==='s'){this.flush();void this.options.save();return;}if(key==='a'){this.anchor=[0,0];this.select(this.sheet.cells.length-1,this.sheet.cells[0].length-1,true,false);return;}if(key==='g'){this.nameBox.focus();this.nameBox.select();return;}
        void this.action(({z:event.shiftKey?'redo':'undo',y:'redo',b:'bold',i:'italic',u:'underline',d:'fill-down',r:'fill-right',f:'find',h:'find'} as Record<string,string>)[key]);return;}
      if(key==='v'){this.pasteValues=event.shiftKey;return;}
    }
    if(event.altKey&&event.key==='='){event.preventDefault();void this.action('sum');return;}
    let [r,c]=this.selected,move=false;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){
      const dr=event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0,dc=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0;
      if(mod){const occupied=this.sheet.cells[r]?.[c]!=='';let nr=r+dr,nc=c+dc;
        if(occupied&&this.sheet.cells[nr]?.[nc])while(nr>=0&&nc>=0&&nr<this.sheet.cells.length&&nc<this.sheet.cells[0].length&&this.sheet.cells[nr][nc]!==''){r=nr;c=nc;nr+=dr;nc+=dc;}
        else{r=nr;c=nc;while(r>=0&&c>=0&&r<this.sheet.cells.length&&c<this.sheet.cells[0].length&&this.sheet.cells[r][c]===''){const nr=r+dr,nc=c+dc;if(nr<0||nc<0||nr>=this.sheet.cells.length||nc>=this.sheet.cells[0].length)break;r=nr;c=nc;}}
      }else{r+=dr;c+=dc;}move=true;
    }else if(event.key==='Home'){c=0;if(mod)r=0;move=true;}else if(event.key==='End'){if(mod){r=0;c=0;this.sheet.cells.forEach((row,ri)=>row.forEach((v,ci)=>{if(v){r=Math.max(r,ri);c=Math.max(c,ci);}}));}else c=this.sheet.cells[0].length-1;move=true;}
    else if(event.key==='PageDown'||event.key==='PageUp'){r+=(event.key==='PageDown'?1:-1)*Math.max(1,Math.floor(this.view.clientHeight/26)-2);move=true;}
    else if(event.key==='Enter'){r+=event.shiftKey?-1:1;move=true;}else if(event.key==='Tab'){c+=event.shiftKey?-1:1;move=true;}
    if(move){event.preventDefault();event.stopPropagation();this.select(r,c,event.shiftKey&&!['Enter','Tab'].includes(event.key));return;}
    if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();void this.action('clear');return;}if(event.key==='F2'){event.preventDefault();this.startEdit();return;}
    if(event.key==='Escape'){this.clipboard=null;this.anchor=[...this.selected];this.paintSelection();return;}
    if(!mod&&!event.altKey&&event.key.length===1){event.preventDefault();this.startEdit(event.key);}
  };
  private goTo(raw:string){try{this.flush();const parts=raw.trim().split(':'),a=position(parts[0]),b=parts[1]?position(parts[1]):a;if(Math.max(a[0],b[0])>=DESKTOP_LIMITS.rows||Math.max(a[1],b[1])>=DESKTOP_LIMITS.columns)throw Error('The supported range is A1:AZ500.');if(Math.max(a[0],b[0])>=this.sheet.cells.length||Math.max(a[1],b[1])>=this.sheet.cells[0].length){this.begin();expandSheet(this.sheet,Math.max(a[0],b[0])+1,Math.max(a[1],b[1])+1);this.changed();}this.anchor=a;this.select(b[0],b[1],true);this.view.focus();}catch(error){this.options.notify((error as Error).message);}}
  private capture(cut:boolean):Clip{
    this.flush();const b=this.bounds(),rows:string[][]=[],styles:CellStyle[][]=[],values:CellValue[][]=[];
    for(let r=b.r1;r<=b.r2;r++){rows.push(this.sheet.cells[r].slice(b.c1,b.c2+1));styles.push(Array.from({length:b.c2-b.c1+1},(_,c)=>({...this.sheet.styles?.[address(r,c+b.c1)]})));values.push(this.values[this.sheetIndex][r].slice(b.c1,b.c2+1));}
    return this.clipboard={rows,styles,values,start:[b.r1,b.c1],sheetId:this.sheet.id,cut,tsv:toTSV(values)};
  }
  private copyEvent=(event:ClipboardEvent)=>{if((event.target as Element).matches('input,textarea')||this.disabled)return;event.preventDefault();const clip=this.capture(false);event.clipboardData?.setData('text/plain',clip.tsv);this.options.notify('Copied cells. Paste adjusts relative references; $ references stay fixed.');};
  private cutEvent=(event:ClipboardEvent)=>{if((event.target as Element).matches('input,textarea')||this.disabled)return;event.preventDefault();const clip=this.capture(true);event.clipboardData?.setData('text/plain',clip.tsv);this.options.notify('Cut cells selected. The source is removed only after a successful paste.');};
  private pasteEvent=(event:ClipboardEvent)=>{if((event.target as Element).matches('input,textarea')||this.disabled)return;event.preventDefault();try{const raw=event.clipboardData?.getData('text/plain')??'';this.paste(raw,this.pasteValues);this.pasteValues=false;}catch(error){this.options.notify((error as Error).message);}};
  private paste(raw:string,valuesOnly=false){
    this.flush();const internal=this.clipboard&&this.clipboard.tsv===raw?this.clipboard:null,rows=internal?(valuesOnly?internal.values.map(row=>row.map(String)):internal.rows):parseDelimited(raw),nr=rows.length,nc=Math.max(...rows.map(r=>r.length)),b=this.bounds();
    const height=nr===1&&nc===1?b.r2-b.r1+1:nr,width=nr===1&&nc===1?b.c2-b.c1+1:nc;
    if(b.r1+height>DESKTOP_LIMITS.rows||b.c1+width>DESKTOP_LIMITS.columns||rows.some(row=>row.some(v=>v.length>DESKTOP_LIMITS.cellLength)))throw Error('Paste exceeds the 500 × 52 grid or 1,000-character cell limit. Nothing was changed.');
    this.begin();expandSheet(this.sheet,b.r1+height,b.c1+width);
    const source=internal?this.sheets.find(s=>s.id===internal.sheetId):undefined;
    if(internal?.cut&&source&&!valuesOnly){for(let r=0;r<nr;r++)for(let c=0;c<nc;c++){source.cells[internal.start[0]+r][internal.start[1]+c]='';delete source.styles?.[address(internal.start[0]+r,internal.start[1]+c)];}}
    this.sheet.styles??={};for(let r=0;r<height;r++)for(let c=0;c<width;c++){
      const sr=r%nr,sc=c%nc;let v=rows[sr][sc]??'';const toR=b.r1+r,toC=b.c1+c;
      if(internal?.cut&&source&&source.id!==this.sheet.id&&!valuesOnly)v=mapReferences(v,(target,rc,rr,ac,ar,match,end)=>target||end?match:`${quoteSheet(source.name)}${ac?'$':''}${columnName(rc)}${ar?'$':''}${rr+1}`);
      this.sheet.cells[toR][toC]=internal&&!valuesOnly&&!internal.cut?shiftFormula(v,toR-internal.start[0]-sr,toC-internal.start[1]-sc):valuesOnly&&v.startsWith('=')?"'"+v:v;
      if(internal&&!valuesOnly)this.sheet.styles[address(toR,toC)]={...internal.styles[sr][sc]};
    }
    if(internal?.cut&&source&&!valuesOnly){
      const from=internal.start,dest=this.sheet;for(const s of this.sheets)s.cells=s.cells.map((row,r)=>row.map((v,c)=>mapReferences(v,(target,rc,rr,ac,ar,match,end)=>{
        // References to the moved cells follow them, including dependants on other sheets.
        if((target??s.name).toLowerCase()!==source.name.toLowerCase()||rr<from[0]||rr>=from[0]+nr||rc<from[1]||rc>=from[1]+nc)return match;
        const movedR=b.r1+rr-from[0],movedC=b.c1+rc-from[1];return `${end||s.id===dest.id&&!target?'':quoteSheet(dest.name)}${ac?'$':''}${columnName(movedC)}${ar?'$':''}${movedR+1}`;
      })));this.clipboard=null;
    }
    this.anchor=[b.r1,b.c1];this.selected=[b.r1+height-1,b.c1+width-1];this.changed();this.view.focus();
  }
  private fill(direction:'down'|'right'){
    this.flush();const b=this.bounds();if(direction==='down'&&b.r1===b.r2||direction==='right'&&b.c1===b.c2){this.options.notify('Select the source cell and the destination cells first.');return;}
    this.begin();this.sheet.styles??={};for(let r=b.r1;r<=b.r2;r++)for(let c=b.c1;c<=b.c2;c++){const sr=direction==='down'?b.r1:r,sc=direction==='right'?b.c1:c;if(r===sr&&c===sc)continue;this.sheet.cells[r][c]=shiftFormula(this.sheet.cells[sr][sc],r-sr,c-sc);this.sheet.styles[address(r,c)]={...this.sheet.styles[address(sr,sc)]};}this.changed();
  }
  private fillHandle(end:Point){
    const b=this.bounds();if(end[0]<=b.r2&&end[1]<=b.c2){this.paintSelection();return;}this.begin();this.sheet.styles??={};
    const down=end[0]-b.r2>=end[1]-b.c2,maxr=down?end[0]:b.r2,maxc=down?b.c2:end[1],height=b.r2-b.r1+1,width=b.c2-b.c1+1;
    for(let r=b.r1;r<=maxr;r++)for(let c=b.c1;c<=maxc;c++){
      if(r<=b.r2&&c<=b.c2)continue;const sr=b.r1+(r-b.r1)%height,sc=b.c1+(c-b.c1)%width;
      let v=shiftFormula(this.sheet.cells[sr][sc],r-sr,c-sc);
      if(down&&height===2&&numeric(this.sheet.cells[b.r1][c])&&numeric(this.sheet.cells[b.r2][c]))v=String(Number(this.sheet.cells[b.r1][c])+(r-b.r1)*(Number(this.sheet.cells[b.r2][c])-Number(this.sheet.cells[b.r1][c])));
      if(!down&&width===2&&numeric(this.sheet.cells[r][b.c1])&&numeric(this.sheet.cells[r][b.c2]))v=String(Number(this.sheet.cells[r][b.c1])+(c-b.c1)*(Number(this.sheet.cells[r][b.c2])-Number(this.sheet.cells[r][b.c1])));
      this.sheet.cells[r][c]=v;this.sheet.styles[address(r,c)]={...this.sheet.styles[address(sr,sc)]};
    }
    this.anchor=[b.r1,b.c1];this.selected=[maxr,maxc];this.changed();
  }
  private fitColumn(c:number){this.flush();const values=this.values[this.sheetIndex];const max=Math.max(8,...values.slice(0,500).map(row=>displayCell(row[c]??'',this.sheet.styles?.[address(values.indexOf(row),c)]).length));this.begin();this.sheet.widths??={};this.sheet.widths[c]=Math.max(70,Math.min(500,max*7+22));this.changed();}
  private click=(event:MouseEvent)=>{
    const target=event.target as Element;const ribbon=target.closest<HTMLElement>('[data-ribbon]');if(ribbon){this.tab=ribbon.dataset.ribbon!;this.root.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel=>panel.hidden=panel.dataset.panel!==this.tab);this.root.querySelectorAll('[data-ribbon]').forEach(tab=>tab.setAttribute('aria-selected',String(tab===ribbon)));return;}
    const sheet=target.closest<HTMLElement>('[data-sheet]');if(sheet){this.flush();this.file.activeSheetId=sheet.dataset.sheet!;this.anchor=this.selected=[0,0];this.filter='';this.filterOn=false;(this.root.querySelector('.xl-filter') as HTMLElement).hidden=true;this.prepareSize();this.render();this.view.scrollTop=this.view.scrollLeft=0;this.view.focus();return;}
    const del=target.closest<HTMLElement>('[data-delete-sheet]');if(del){void this.deleteSheet(del.dataset.deleteSheet!);return;}
    const col=target.closest<HTMLElement>('[data-col]'),row=target.closest<HTMLElement>('[data-row]');if(col&&!target.closest('[data-resize-col]')){this.flush();const c=Number(col.dataset.col);this.anchor=[0,event.shiftKey?this.anchor[1]:c];this.select(this.sheet.cells.length-1,c,true,false);this.view.focus();return;}
    if(row){this.flush();const r=Number(row.dataset.row);this.anchor=[event.shiftKey?this.anchor[0]:r,0];this.select(r,this.sheet.cells[0].length-1,true,false);this.view.focus();return;}
    if(target.closest('[data-all]')){this.anchor=[0,0];this.select(this.sheet.cells.length-1,this.sheet.cells[0].length-1,true,false);this.view.focus();return;}
    const action=target.closest<HTMLElement>('[data-xl]')?.dataset.xl;if(action){event.stopPropagation();void this.action(action).catch(error=>this.options.notify((error as Error).message));}
  };
  private async deleteSheet(id:string){if(this.sheets.length===1)return;this.flush();const sheet=this.sheets.find(s=>s.id===id)!;if(!await this.options.confirm('Delete worksheet?',`Delete “${sheet.name}” and all its cells? Other sheets remain. References to it will show #REF!. You can undo this change.`, 'Delete sheet'))return;
    this.begin();this.file.sheets=this.sheets.filter(s=>s.id!==id);for(const s of this.sheets)s.cells=s.cells.map(row=>row.map(v=>mapReferences(v,(target,c,r,ac,ar,match)=>target?.toLowerCase()===sheet.name.toLowerCase()?'#REF!':match)));if(this.file.activeSheetId===id)this.file.activeSheetId=this.sheets[0].id;this.anchor=this.selected=[0,0];this.changed();
  }
  private async action(action:string){
    if(action==='cancel-edit'){this.cancelEdit();return;}if(action==='commit-edit'){this.flush();this.view.focus();return;}
    if(['help','help-close'].includes(action)){const help=this.root.querySelector<HTMLElement>('.xl-help')!;help.hidden=action==='help-close'||!help.hidden;return;}
    if(action==='close-find'){(this.root.querySelector('.xl-find') as HTMLElement).hidden=true;this.view.focus();return;}
    this.flush();if(this.disabled)return;
    if(action==='undo'||action==='redo'){
      const from=action==='undo'?this.undoStack:this.redoStack,to=action==='undo'?this.redoStack:this.undoStack,snapshot=from.pop();if(!snapshot)return;to.push(this.snapshot());const data=JSON.parse(snapshot);this.file.sheets=data.sheets;this.file.activeSheetId=data.activeSheetId;this.changed();this.view.focus();return;
    }
    if(['bold','italic','underline','wrap'].includes(action)){this.applyStyle({[action]:!this.activeStyle[action as keyof CellStyle]});return;}
    if(action.startsWith('align-')){this.applyStyle({align:action.slice(6) as CellStyle['align']});return;}
    if(action.startsWith('decimals-')){this.applyStyle({format:this.activeStyle.format==='general'||!this.activeStyle.format?'number':this.activeStyle.format,decimals:Math.max(0,Math.min(8,(this.activeStyle.decimals??2)+(action==='decimals-more'?1:-1)))});return;}
    if(action==='clear'){this.begin();this.each((r,c)=>this.sheet.cells[r][c]='');this.changed();this.view.focus();return;}
    if(action==='copy'||action==='cut'){const clip=this.capture(action==='cut');try{await navigator.clipboard.writeText(clip.tsv);}catch{/* Internal clipboard still works in local files/sandboxed previews. */}this.options.notify(action==='cut'?'Cut ready. Paste to move the cells.':'Copied. Paste into this workbook or Excel.');this.view.focus();return;}
    if(action==='paste'||action==='paste-values'){let text=this.clipboard?.tsv??'';try{text=await navigator.clipboard.readText();}catch{if(!this.clipboard){this.options.notify('Click a destination cell and press Ctrl+V to grant clipboard access through your paste action.');this.view.focus();return;}}this.paste(text,action==='paste-values');return;}
    if(action==='fill-down'||action==='fill-right'){this.fill(action==='fill-down'?'down':'right');this.view.focus();return;}
    if(action==='sum'){
      const [r,c]=this.selected;let start=r-1;while(start>=0&&this.sheet.cells[start][c]!==''&&!String(this.values[this.sheetIndex][start][c]).startsWith('#')&&typeof this.values[this.sheetIndex][start][c]==='number')start--;
      if(start<r-1){this.begin();this.sheet.cells[r][c]=`=SUM(${address(start+1,c)}:${address(r-1,c)})`;this.changed();}else{let left=c-1;while(left>=0&&typeof this.values[this.sheetIndex][r][left]==='number')left--;if(left<c-1){this.begin();this.sheet.cells[r][c]=`=SUM(${address(r,left+1)}:${address(r,c-1)})`;this.changed();}else this.startEdit('=SUM(');}return;
    }
    if(action==='add-sheet'||action==='duplicate-sheet'){
      if(this.sheets.length>=DESKTOP_LIMITS.sheets)throw Error('This workbook already has eight sheets.');this.begin();const id='sheet-'+Math.random().toString(36).slice(2,12);let n=1;while(this.sheets.some(s=>s.name===`Sheet${n}`))n++;
      const s:DesktopWorksheet=action==='duplicate-sheet'?{...structuredClone(this.sheet),id,name:`Sheet${n}`}:{id,name:`Sheet${n}`,cells:Array.from({length:100},()=>Array<string>(26).fill('')),styles:{},widths:{}};
      this.sheets.push(s);this.file.activeSheetId=id;this.anchor=this.selected=[0,0];this.changed();this.view.focus();return;
    }
    if(action==='rename-sheet'){const bar=this.root.querySelector<HTMLElement>('.xl-sheet-name')!;bar.hidden=false;const input=bar.querySelector('input')!;input.value=this.sheet.name;input.focus();input.select();return;}
    if(action==='confirm-rename'){const name=(this.root.querySelector('[aria-label="Sheet name"]') as HTMLInputElement).value;const before=this.snapshot();renameSheet(this.file,this.sheet.id,name);this.undoStack.push(before);this.redoStack=[];(this.root.querySelector('.xl-sheet-name') as HTMLElement).hidden=true;this.changed();return;}
    if(action==='cancel-rename'){(this.root.querySelector('.xl-sheet-name') as HTMLElement).hidden=true;return;}
    if(action==='find'){const bar=this.root.querySelector<HTMLElement>('.xl-find')!;bar.hidden=false;const input=bar.querySelector('input')!;input.focus();input.select();return;}
    if(['find-next','replace','replace-all'].includes(action)){
      const needle=(this.root.querySelector('[aria-label="Find in sheet"]') as HTMLInputElement).value,replacement=(this.root.querySelector('[aria-label="Replace with"]') as HTMLInputElement).value;if(!needle)return;
      const matches:Point[]=[];this.sheet.cells.forEach((row,r)=>row.forEach((v,c)=>{if((v+'\n'+String(this.values[this.sheetIndex][r][c])).toLowerCase().includes(needle.toLowerCase()))matches.push([r,c]);}));if(!matches.length){this.options.notify('No matching cells on this sheet.');return;}
      if(action==='replace-all'){const replacements=matches.map(([r,c])=>{const old=this.sheet.cells[r][c],value=old.split(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi')).join(replacement);if(value.length>DESKTOP_LIMITS.cellLength)throw Error('Replacement would exceed the cell length limit. Nothing was changed.');return {r,c,old,value};});this.begin();for(const x of replacements)this.sheet.cells[x.r][x.c]=x.value;this.changed();this.options.notify(`Replaced text in ${replacements.filter(x=>x.old!==x.value).length} cells. Formulas are included in this search.`);return;}
      if(action==='replace'){const [r,c]=this.selected,raw=this.sheet.cells[r][c];if(raw.toLowerCase().includes(needle.toLowerCase())){const next=raw.replace(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),()=>replacement);if(next.length>DESKTOP_LIMITS.cellLength)throw Error('Replacement exceeds the cell length limit. Nothing was changed.');this.begin();this.sheet.cells[r][c]=next;this.changed();}}
      this.findIndex=(this.findIndex+1)%matches.length;this.select(...matches[this.findIndex]);return;
    }
    if(action==='filter'){this.filterOn=!this.filterOn;this.filterHeader=this.bounds().r1;(this.root.querySelector('.xl-filter') as HTMLElement).hidden=!this.filterOn;if(!this.filterOn)this.filter='';this.render();if(this.filterOn)(this.root.querySelector('[aria-label="Filter rows"]') as HTMLInputElement).focus();return;}
    if(action==='clear-filter'){this.filter='';(this.root.querySelector('[aria-label="Filter rows"]') as HTMLInputElement).value='';this.render();return;}
    if(action==='sort-asc'||action==='sort-desc'){
      const b=this.bounds(),headers=(this.root.querySelector('[aria-label="Selection has headers"]') as HTMLInputElement).checked,start=b.r1+(headers?1:0);if(start>=b.r2){this.options.notify('Select a table or range with at least two data rows. Sorting applies only to the selected columns.');return;}
      this.begin();const source=this.sheet.cells.map(row=>[...row]),styles={...this.sheet.styles},keys=Array.from({length:b.r2-start+1},(_,i)=>start+i),sortCol=b.c1;keys.sort((a,b)=>{const x=this.values[this.sheetIndex][a][sortCol],y=this.values[this.sheetIndex][b][sortCol];const c=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),undefined,{numeric:true});return c*(action==='sort-asc'?1:-1);});
      this.sheet.styles??={};keys.forEach((from,i)=>{const to=start+i;for(let c=b.c1;c<=b.c2;c++){this.sheet.cells[to][c]=shiftFormula(source[from][c],to-from,0);this.sheet.styles![address(to,c)]={...styles[address(from,c)]};}});this.changed();this.options.notify('Sorted the selected range only. Other columns were not moved.');return;
    }
    if(['insert-row','delete-row','insert-column','delete-column'].includes(action)){
      const axis=action.includes('column')?'column':'row',remove=action.startsWith('delete'),b=this.bounds(),index=axis==='row'?b.r1:b.c1,count=axis==='row'?b.r2-b.r1+1:b.c2-b.c1+1;
      const before=this.snapshot();insertDelete(this.file,this.sheet.id,axis,index,count,remove);this.undoStack.push(before);this.redoStack=[];this.anchor=this.selected=[Math.min(b.r1,this.sheet.cells.length-1),Math.min(b.c1,this.sheet.cells[0].length-1)];this.changed();return;
    }
    if(action==='add-rows'||action==='add-columns'){this.begin();expandSheet(this.sheet,action==='add-rows'?Math.min(DESKTOP_LIMITS.rows,this.sheet.cells.length+100):this.sheet.cells.length,action==='add-columns'?Math.min(DESKTOP_LIMITS.columns,this.sheet.cells[0].length+5):this.sheet.cells[0].length);this.changed();return;}
    if(action==='freeze-row'||action==='freeze-col'||action==='unfreeze'){this.begin();if(action==='freeze-row')this.sheet.freezeRows=this.sheet.freezeRows?0:1;else if(action==='freeze-col')this.sheet.freezeCols=this.sheet.freezeCols?0:1;else{this.sheet.freezeCols=0;this.sheet.freezeRows=0;}this.changed();return;}
    if(action==='formulas'){this.showFormulas=!this.showFormulas;this.render();return;}if(action==='fit-column'){this.fitColumn(this.selected[1]);return;}
  }
  setDisabled=(disabled:boolean)=>{this.disabled=disabled;this.root.classList.toggle('xl-saving',disabled);this.root.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('input,button,select').forEach(el=>el.disabled=disabled);(this.root.querySelector('[data-xl="undo"]') as HTMLButtonElement).disabled=disabled||!this.undoStack.length;(this.root.querySelector('[data-xl="redo"]') as HTMLButtonElement).disabled=disabled||!this.redoStack.length;this.root.querySelectorAll<HTMLButtonElement>('[data-delete-sheet]').forEach(el=>el.disabled=disabled||this.sheets.length===1);this.paintSelection();};
  refresh=()=>{this.editing=null;this.prepareSize();this.undoStack=[];this.redoStack=[];this.anchor=this.selected=[0,0];this.render();};
  destroy=()=>{this.dead=true;document.removeEventListener('pointermove',this.pointermove);document.removeEventListener('pointerup',this.pointerup);this.root.removeEventListener('click',this.click);this.root.removeEventListener('dblclick',this.doubleClick);this.root.removeEventListener('keydown',this.keydown);this.root.removeEventListener('input',this.input);this.root.removeEventListener('change',this.change);this.root.removeEventListener('pointerdown',this.pointerdown);this.root.removeEventListener('copy',this.copyEvent);this.root.removeEventListener('cut',this.cutEvent);this.root.removeEventListener('paste',this.pasteEvent);};
}
