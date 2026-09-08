/** Workbook operations shared by the editor, file imports and regression tests. */
import {DESKTOP_LIMITS, type DesktopUserFile, type DesktopWorksheet, type CellStyle} from './types';
export const columnName=(index:number):string=>{let text='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))text=String.fromCharCode(65+(n-1)%26)+text;return text;};
export const address=(row:number,col:number)=>`${columnName(col)}${row+1}`;
export function position(ref:string):[number,number]{const m=/^\$?([A-Z]+)\$?([1-9]\d*)$/i.exec(ref);if(!m)throw new Error('#REF!');let c=0;for(const x of m[1].toUpperCase())c=c*26+x.charCodeAt(0)-64;return [Number(m[2])-1,c-1];}
export function sheetGrid(rows=100,cols=26):string[][]{return Array.from({length:rows},()=>Array<string>(cols).fill(''));}
export function ensureWorkbook(file:DesktopUserFile):DesktopWorksheet[]{
  if(!file.sheets?.length)file.sheets=[{id:'sheet-1',name:'Workpaper',cells:file.cells,styles:{},widths:{},freezeRows:0,freezeCols:0}];
  if(!file.activeSheetId||!file.sheets.some(s=>s.id===file.activeSheetId))file.activeSheetId=file.sheets[0].id;
  file.cells=file.sheets[0].cells;return file.sheets;
}
export function syncWorkbook(file:DesktopUserFile){if(file.sheets?.length)file.cells=file.sheets[0].cells;}
export function expandSheet(sheet:DesktopWorksheet,rows:number,cols:number){
  if(rows>DESKTOP_LIMITS.rows||cols>DESKTOP_LIMITS.columns||rows<1||cols<1)throw new Error(`A sheet supports ${DESKTOP_LIMITS.rows} rows × ${DESKTOP_LIMITS.columns} columns.`);
  const nr=Math.max(rows,sheet.cells.length),nc=Math.max(cols,sheet.cells[0]?.length??1);
  if(nr!==sheet.cells.length||nc!==(sheet.cells[0]?.length??0))sheet.cells=Array.from({length:nr},(_,r)=>Array.from({length:nc},(_,c)=>sheet.cells[r]?.[c]??''));
}
type Ref={sheet?:string;col:number;row:number;absCol:boolean;absRow:boolean;raw:string;rangeEnd:boolean};
const references=/(?:(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_.]*))!)?(\$?)([A-Z]{1,3})(\$?)([1-9]\d*)(?::(\$?)([A-Z]{1,3})(\$?)([1-9]\d*))?/gi;
const formatRef=(r:Ref)=>`${r.sheet&&!r.rangeEnd?quoteSheet(r.sheet):''}${r.absCol?'$':''}${columnName(r.col)}${r.absRow?'$':''}${r.row+1}`;
/** Groups keep a qualified range's sheet context on its second endpoint. */
function mapReferenceGroups(formula:string,change:(first:Ref,last?:Ref)=>string):string{
 if(!formula.startsWith('='))return formula;
 return formula.split(/("(?:[^"]|"")*")/g).map((part,i)=>i%2?part:part.replace(references,(match,q,n,ac,c,ar,r,bc,d,br,u,offset:number,whole:string)=>{
  const prev=whole[offset-1]??'',next=whole[offset+match.length]??'';if(/[A-Za-z0-9_.]/.test(prev)||/[A-Za-z0-9_(]/.test(next))return match;
  const [row,col]=position(c+r),sheet=q?q.replace(/''/g,"'"):n,first:Ref={sheet,col,row,absCol:!!ac,absRow:!!ar,raw:d?match.slice(0,match.lastIndexOf(':')):match,rangeEnd:false};
  const last=d?{sheet,col:position(d+u)[1],row:Number(u)-1,absCol:!!bc,absRow:!!br,raw:`${bc}${d}${br}${u}`,rangeEnd:true}:undefined;return change(first,last);
 })).join('');
}
/** No references inside strings or identifiers are rewritten. The final flag marks a range endpoint. */
export function mapReferences(formula:string,change:(sheet:string|undefined,col:number,row:number,absCol:boolean,absRow:boolean,match:string,rangeEnd:boolean)=>string):string{
 const apply=(r:Ref)=>change(r.sheet,r.col,r.row,r.absCol,r.absRow,r.raw,r.rangeEnd);
 return mapReferenceGroups(formula,(a,b)=>{const x=apply(a),y=b?apply(b):'';return x==='#REF!'||y==='#REF!'?'#REF!':x+(b?':'+y:'');});
}
export function quoteSheet(name:string){return `'${name.replace(/'/g,"''")}'!`;}
export function shiftFormula(raw:string,dr:number,dc:number):string{
  return mapReferences(raw,(s,c,r,ac,ar,match,end)=>{const nr=r+(ar?0:dr),nc=c+(ac?0:dc);return nr<0||nc<0||nr>=DESKTOP_LIMITS.rows||nc>=DESKTOP_LIMITS.columns?'#REF!':`${s&&!end?quoteSheet(s):''}${ac?'$':''}${columnName(nc)}${ar?'$':''}${nr+1}`;});
}
export function renameSheet(file:DesktopUserFile,id:string,name:string){
  const sheets=ensureWorkbook(file),sheet=sheets.find(s=>s.id===id);name=name.trim();
  if(!sheet)throw new Error('Sheet not found.');
  if(!name||name.length>31||/[\\/?*\[\]:]/.test(name)||/^'|'$/.test(name)||sheets.some(s=>s.id!==id&&s.name.toLowerCase()===name.toLowerCase()))throw new Error('Use a unique sheet name (1–31 characters, no : \\ / ? * [ ]).');
  const old=sheet.name;sheet.name=name;
  for(const s of sheets)s.cells=s.cells.map(row=>row.map(v=>mapReferences(v,(target,c,r,ac,ar,match,end)=>target?.toLowerCase()===old.toLowerCase()?`${!end?quoteSheet(name):''}${ac?'$':''}${columnName(c)}${ar?'$':''}${r+1}`:match)));
  syncWorkbook(file);
}
export function insertDelete(file:DesktopUserFile,id:string,axis:'row'|'column',index:number,count:number,remove:boolean){
  const sheets=ensureWorkbook(file),sheet=sheets.find(s=>s.id===id)!;
  const size=axis==='row'?sheet.cells.length:sheet.cells[0].length,limit=axis==='row'?DESKTOP_LIMITS.rows:DESKTOP_LIMITS.columns;
  if(!Number.isInteger(count)||!Number.isInteger(index)||count<1||index<0||index>=size||remove&&index+count>size||remove&&size-count<1||!remove&&size+count>limit)throw new Error('That operation would exceed the sheet size or remove every row/column.');
  if(axis==='row')sheet.cells.splice(index,remove?count:0,...(remove?[]:sheetGrid(count,sheet.cells[0].length)));
  else for(const row of sheet.cells)row.splice(index,remove?count:0,...(remove?[]:Array<string>(count).fill('')));
  const styles:Record<string,CellStyle>={};for(const [ref,style] of Object.entries(sheet.styles??{})){let [r,c]=position(ref);let n=axis==='row'?r:c;if(remove&&n>=index&&n<index+count)continue;if(n>=index)n+=remove?-count:count;if(axis==='row')r=n;else c=n;styles[address(r,c)]=style;}sheet.styles=styles;
  if(axis==='column'){const widths:Record<string,number>={};for(const [key,width]of Object.entries(sheet.widths??{})){let n=Number(key);if(remove&&n>=index&&n<index+count)continue;if(n>=index)n+=remove?-count:count;widths[String(n)]=width;}sheet.widths=widths;}
  for(const s of sheets)s.cells=s.cells.map(row=>row.map(v=>mapReferenceGroups(v,(a,b)=>{
    if((a.sheet??s.name).toLowerCase()!==sheet.name.toLowerCase())return a.raw+(b?':'+b.raw:'');
    const get=(r:Ref)=>axis==='row'?r.row:r.col,set=(r:Ref,n:number)=>{if(axis==='row')r.row=n;else r.col=n;};
    const shift=(n:number)=>n>=index?n+(remove?-count:count):n;
    if(!b){const n=get(a);if(remove&&n>=index&&n<index+count)return '#REF!';set(a,shift(n));}
    else if(remove){const av=get(a),bv=get(b),lo=Math.min(av,bv),hi=Math.max(av,bv),cutEnd=index+count-1;
      if(lo>=index&&hi<=cutEnd)return '#REF!';
      const newLo=lo<index?lo:lo>cutEnd?lo-count:index,newHi=hi>cutEnd?hi-count:hi<index?hi:index-1;
      set(a,av<=bv?newLo:newHi);set(b,av<=bv?newHi:newLo);
    }else {set(a,shift(get(a)));set(b,shift(get(b)));}
    if([a,...(b?[b]:[])].some(r=>r.row<0||r.col<0||r.row>=DESKTOP_LIMITS.rows||r.col>=DESKTOP_LIMITS.columns))return '#REF!';
    return formatRef(a)+(b?':'+formatRef(b):'');
  })));
  syncWorkbook(file);
}
export function parseDelimited(text:string,delimiter='\t'):string[][]{
  const result:string[][]=[],row:string[]=[];let value='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'&&(quoted||value==='')){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
    else if(c===delimiter&&!quoted){row.push(value);value='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);result.push(row.splice(0));value='';}else value+=c;}
  if(quoted)throw new Error('The pasted/imported text has an unterminated quoted field.');
  if(value||row.length||!result.length){row.push(value);result.push(row);}return result;
}
export const toTSV=(rows:(string|number|boolean)[][])=>rows.map(row=>row.map(v=>/[\t\r\n"]/.test(String(v))?'"'+String(v).replaceAll('"','""')+'"':String(v)).join('\t')).join('\n');
