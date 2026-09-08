/** Small OOXML reader/writer for supported grid features. Imported workbooks never execute code. */
import {htmlEscape,zipFiles} from '../accounting/exports';
import {evaluateWorkbook,parseFormula,dateSerial,type CellValue} from './worksheet';
import {DESKTOP_LIMITS,desktopFileError,type CellStyle,type DesktopWorksheet,type DesktopUserFile,type NumberFormat} from './types';
import {address,columnName,position,ensureWorkbook,shiftFormula} from './workbook-model';
const xml=(value:unknown)=>htmlEscape(String(value).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,''));
const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships',PKG='http://schemas.openxmlformats.org/package/2006/relationships';
export function formatCode(s:CellStyle):string{
  const decimal='0'+((s.decimals??2)>0?'.'+'0'.repeat(s.decimals??2):'');
  switch(s.format){case 'number':return '#,##'+decimal;case 'integer':return '#,##0';case 'currency':return '"$"#,##'+decimal+';[Red]("$"#,##'+decimal+');"-"';case 'accounting':return '#,##'+decimal+';[Red](#,##'+decimal+');"-"';case 'percent':return decimal+'%';case 'date':return 'yyyy-mm-dd';default:return 'General';}
}
export function workbookXLSX(input:DesktopUserFile|DesktopWorksheet[]):Uint8Array{
  const sheets=Array.isArray(input)?input:ensureWorkbook(structuredClone(input)),values=evaluateWorkbook(sheets);
  const styles:CellStyle[]=[{}],styleMap=new Map<string,number>([['{}',0]]);
  const styleId=(s:CellStyle={})=>{const key=JSON.stringify(Object.fromEntries(Object.entries(s).sort()));let id=styleMap.get(key);if(id===undefined){id=styles.length;styleMap.set(key,id);styles.push(s);}return id;};
  const entries=sheets.map((sheet,si)=>{
    const rows=sheet.cells.map((row,r)=>`<row r="${r+1}" ht="20" customHeight="1">${row.map((raw,c)=>{
      const style=sheet.styles?.[address(r,c)]??{},sid=styleId(style),value=values[si][r][c];if(raw===''&&!Object.keys(style).length)return '';
      const ref=address(r,c);let formula='';if(raw.startsWith('='))try{parseFormula(raw);formula=`<f>${xml(raw.slice(1))}</f>`;}catch{/* Unsupported formulas stay inert and visible. */}
      if(formula){if(typeof value==='number')return `<c r="${ref}" s="${sid}">${formula}<v>${value}</v></c>`;if(typeof value==='boolean')return `<c r="${ref}" s="${sid}" t="b">${formula}<v>${value?1:0}</v></c>`;
        if(/^#(?:REF!|NAME\?|VALUE!|NUM!|DIV\/0!|N\/A)$/.test(value))return `<c r="${ref}" s="${sid}" t="e">${formula}<v>${xml(value)}</v></c>`;
        return `<c r="${ref}" s="${sid}" t="str">${formula}<v>${xml(value)}</v></c>`;}
      if(typeof value==='number')return `<c r="${ref}" s="${sid}"><v>${value}</v></c>`;if(typeof value==='boolean')return `<c r="${ref}" s="${sid}" t="b"><v>${value?1:0}</v></c>`;
      return `<c r="${ref}" s="${sid}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const fr=sheet.freezeRows??0,fc=sheet.freezeCols??0,views=`<sheetViews><sheetView workbookViewId="0">${fr||fc?`<pane xSplit="${fc}" ySplit="${fr}" topLeftCell="${address(fr,fc)}" activePane="${fr&&fc?'bottomRight':fr?'bottomLeft':'topRight'}" state="frozen"/>`:''}</sheetView></sheetViews>`;
    const cols=sheet.cells[0].map((_,c)=>`<col min="${c+1}" max="${c+1}" width="${((sheet.widths?.[c]??112)-5)/7}" customWidth="1"/>`).join('');
    return {name:`xl/worksheets/sheet${si+1}.xml`,content:`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}"><dimension ref="A1:${address(sheet.cells.length-1,sheet.cells[0].length-1)}"/>${views}<sheetFormatPr defaultRowHeight="20"/><cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`};
  });
  const fonts=styles.map(s=>`<font><sz val="11"/><name val="Calibri"/>${s.bold?'<b/>':''}${s.italic?'<i/>':''}${s.underline?'<u/>':''}<color rgb="FF${(s.color??'#172d27').slice(1)}"/></font>`).join('');
  const fills='<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+styles.map(s=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${(s.fill??'#ffffff').slice(1)}"/><bgColor indexed="64"/></patternFill></fill>`).join('');
  const xfs=styles.map((s,i)=>`<xf numFmtId="${164+i}" fontId="${i}" fillId="${s.fill?i+2:0}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" horizontal="${s.align??'general'}" wrapText="${s.wrap?1:0}"/></xf>`).join('');
  const styleXML=`<?xml version="1.0"?><styleSheet xmlns="${NS}"><numFmts count="${styles.length}">${styles.map((s,i)=>`<numFmt numFmtId="${164+i}" formatCode="${xml(formatCode(s))}"/>`).join('')}</numFmts><fonts count="${styles.length}">${fonts}</fonts><fills count="${styles.length+2}">${fills}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${styles.length}">${xfs}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zipFiles([
    {name:'[Content_Types].xml',content:`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`},
    {name:'_rels/.rels',content:`<?xml version="1.0"?><Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:'xl/workbook.xml',content:`<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="${REL}"><bookViews><workbookView activeTab="${Array.isArray(input)?0:Math.max(0,sheets.findIndex(s=>s.id===input.activeSheetId))}"/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`},
    {name:'xl/_rels/workbook.xml.rels',content:`<?xml version="1.0"?><Relationships xmlns="${PKG}">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${REL}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rIdStyles" Type="${REL}/styles" Target="styles.xml"/></Relationships>`},
    {name:'xl/styles.xml',content:styleXML},...entries,
  ]);
}
export function worksheetXLSX(cells:string[][]):Uint8Array{return workbookXLSX([{id:'sheet-1',name:'Workpaper',cells}]);}
const parseXML=(raw:string)=>{if(/<!DOCTYPE|<!ENTITY/i.test(raw))throw Error('XML entities are not supported.');const d=new DOMParser().parseFromString(raw,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('Malformed workbook XML.');return d;};
const nodes=(root:Document|Element,name:string)=>Array.from(root.getElementsByTagNameNS('*',name));
function rgb(el:Element|undefined):string|undefined{const v=el?.getAttribute('rgb');return v&&/^[0-9a-f]{6,8}$/i.test(v)?'#'+v.slice(-6):undefined;}
const crcTable=Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes:Uint8Array){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
/** Bounded ZIP extraction via native deflate. Reject encrypted files, external content and zip bombs. */
async function unzip(bytes:Uint8Array):Promise<Map<string,string>>{
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),files=new Map<string,string>();let end=-1,total=0;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw Error('This is not a readable .xlsx ZIP file.');
  const count=view.getUint16(end+10,true),central=view.getUint32(end+16,true);if(count>300||count===65535)throw Error('Workbook archive has too many parts.');
  let p=central;
  for(let i=0;i<count;i++){
    if(p+46>bytes.length||view.getUint32(p,true)!==0x02014b50)throw Error('Invalid ZIP directory.');
    const flags=view.getUint16(p+8,true),method=view.getUint16(p+10,true),compressed=view.getUint32(p+20,true),size=view.getUint32(p+24,true),nl=view.getUint16(p+28,true),el=view.getUint16(p+30,true),cl=view.getUint16(p+32,true),offset=view.getUint32(p+42,true);
    const name=new TextDecoder().decode(bytes.slice(p+46,p+46+nl));p+=46+nl+el+cl;
    if(flags&1||!([0,8].includes(method)))throw Error('Encrypted or unsupported workbook compression.');
    if(/(?:^|\/)\.\.(?:\/|$)|\\|^\//.test(name)||files.has(name))throw Error('Invalid or duplicate ZIP path.');
    if(/vbaProject|externalLinks|connections\.xml|embeddings|queryTables/i.test(name))throw Error('Macros, external workbook links, data connections and embedded objects are not imported.');
    total+=size;if(size>4_000_000||total>12_000_000||compressed>3_000_000)throw Error('Workbook exceeds safe import limits.');
    if(!/\.xml$|\.rels$/i.test(name))continue;
    if(offset+30>bytes.length||view.getUint32(offset,true)!==0x04034b50)throw Error('Invalid ZIP entry.');
    const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);if(start+compressed>bytes.length)throw Error('Truncated workbook archive.');let data=bytes.slice(start,start+compressed);
    if(method===8){const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')),reader=stream.getReader(),chunks:Uint8Array[]=[];let read=0;for(;;){const part=await reader.read();if(part.done)break;read+=part.value.length;if(read>size||read>4_000_000){await reader.cancel();throw Error('Workbook inflation exceeds declared size.');}chunks.push(part.value);}data=new Uint8Array(read);let at=0;for(const chunk of chunks){data.set(chunk,at);at+=chunk.length;}}
    if(data.length!==size)throw Error('Workbook entry size mismatch.');if(crc32(data)!==view.getUint32(p-(46+nl+el+cl)+16,true))throw Error('Workbook entry checksum failed. The file may be corrupted.');files.set(name,new TextDecoder().decode(data));
  }
  return files;
}
export async function importXLSX(bytes:Uint8Array,file:DesktopUserFile):Promise<{file:DesktopUserFile;warnings:string[]}>{
  if(bytes.length>3_000_000)throw Error('Choose an XLSX smaller than 3 MB.');
  const parts=await unzip(bytes),workbook=parseXML(parts.get('xl/workbook.xml')??''),rels=parseXML(parts.get('xl/_rels/workbook.xml.rels')??''),relationships=new Map<string,string>();
  for(const r of nodes(rels,'Relationship')){if(r.getAttribute('TargetMode')==='External')throw Error('External workbook relationships are not imported.');let target=r.getAttribute('Target')??'';target=target.startsWith('/')?target.slice(1):'xl/'+target;if(target.includes('..'))throw Error('Unsupported workbook relationship path.');relationships.set(r.getAttribute('Id')??'',target);}
  const shared=parts.has('xl/sharedStrings.xml')?nodes(parseXML(parts.get('xl/sharedStrings.xml')!),'si').map(si=>nodes(si,'t').map(t=>t.textContent??'').join('')):[];
  const styles:CellStyle[]=[];if(parts.has('xl/styles.xml')){
    const style=parseXML(parts.get('xl/styles.xml')!),fonts=nodes(style,'font'),fills=nodes(style,'fill'),formats=new Map(nodes(style,'numFmt').map(n=>[Number(n.getAttribute('numFmtId')),n.getAttribute('formatCode')??'']));
    const xfs=nodes(style,'cellXfs')[0];if(xfs)for(const xf of Array.from(xfs.children)){
      const f=fonts[Number(xf.getAttribute('fontId'))],fill=fills[Number(xf.getAttribute('fillId'))],id=Number(xf.getAttribute('numFmtId')),code=formats.get(id)??({9:'0%',10:'0.00%',14:'mm-dd-yy',15:'d-mmm-yy',16:'d-mmm',17:'mmm-yy',22:'m/d/yy h:mm',2:'0.00',3:'#,##0',4:'#,##0.00',44:'_($* #,##0.00_)'} as Record<number,string>)[id]??'';
      const s:CellStyle={};if(f&&nodes(f,'b').some(n=>n.getAttribute('val')!=='0'))s.bold=true;if(f&&nodes(f,'i').length)s.italic=true;if(f&&nodes(f,'u').length)s.underline=true;
      const color=f?rgb(nodes(f,'color')[0]):undefined,fg=fill?rgb(nodes(fill,'fgColor')[0]):undefined;if(color)s.color=color;if(fg)s.fill=fg;
      const a=nodes(xf,'alignment')[0];if(a?.getAttribute('wrapText')==='1')s.wrap=true;const align=a?.getAttribute('horizontal');if(align&&['left','center','right'].includes(align))s.align=align as CellStyle['align'];
      if(code){s.format=/[dy]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]|\\./g,''))?'date':code.includes('%')?'percent':code.includes('$')?'currency':code.includes('#,##')&&code.includes('(')?'accounting':code.includes('0')?'number':'general';s.decimals=Math.min(8,/(?:0|#)\.([0#]+)/.exec(code)?.[1].length??0);}styles.push(s);
    }
  }
  const sheetNodes=nodes(workbook,'sheet');if(!sheetNodes.length||sheetNodes.length>DESKTOP_LIMITS.sheets)throw Error('Import supports one to eight sheets.');
  const warnings=new Set<string>();let unsupported=0;
  const sheets=sheetNodes.map((node,i):DesktopWorksheet=>{
    const path=relationships.get(node.getAttributeNS(REL,'id')??node.getAttribute('r:id')??'');if(!path||!parts.has(path))throw Error('Workbook sheet is missing.');const doc=parseXML(parts.get(path)!);
    const cells=nodes(doc,'c'),sharedFormulas=new Map<string,{raw:string;r:number;c:number}>();let rows=30,cols=12;
    for(const cell of cells){const f=nodes(cell,'f')[0];if(f?.getAttribute('t')==='shared'&&f.textContent){const [r,c]=position(cell.getAttribute('r')??'');const id=f.getAttribute('si');if(id===null||sharedFormulas.has(id))throw Error('Invalid shared formula definition.');sharedFormulas.set(id,{raw:'='+f.textContent,r,c});}}
    for(const cell of cells){const [r,c]=position(cell.getAttribute('r')??'');if(r>=DESKTOP_LIMITS.rows||c>=DESKTOP_LIMITS.columns)throw Error(`Sheet “${node.getAttribute('name')}” exceeds 500 rows or 52 columns. No data was imported.`);rows=Math.max(rows,r+1);cols=Math.max(cols,c+1);}
    const grid=Array.from({length:rows},()=>Array<string>(cols).fill('')),cellStyles:Record<string,CellStyle>={},widths:Record<string,number>={};
    for(const cell of cells){const ref=cell.getAttribute('r')!,[r,c]=position(ref),type=cell.getAttribute('t'),v=nodes(cell,'v')[0]?.textContent??'',formula=nodes(cell,'f')[0];let raw='';
      if(formula){if(formula.getAttribute('t')==='array'||formula.getAttribute('t')==='dataTable')throw Error('Array and data-table formulas are not supported. Convert to ordinary cells before import.');if(formula.getAttribute('t')==='shared'){const base=sharedFormulas.get(formula.getAttribute('si')??'');if(!base)throw Error('Shared formula definition is missing.');raw=shiftFormula(base.raw,r-base.r,c-base.c);}else raw='='+(formula.textContent??'');raw=raw.replace(/_xlfn\.|_xlws\./g,'');try{parseFormula(raw);}catch{unsupported++;}}
      else if(type==='s'){const index=Number(v);if(!Number.isInteger(index)||index<0||index>=shared.length)throw Error('Invalid shared string index.');raw=shared[index];}
      else if(type==='inlineStr')raw=nodes(cell,'t').map(n=>n.textContent??'').join('');else if(type==='b')raw=v==='1'?'TRUE':'FALSE';else if(type==='d'){const date=new Date(v);if(!Number.isFinite(date.getTime()))throw Error('Invalid workbook date.');raw=String(dateSerial(date));}else raw=v;
      if(!formula&&['s','inlineStr','str'].includes(type??'')&&(raw.startsWith('=')||/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)||/^(TRUE|FALSE)$/i.test(raw)||raw.startsWith("'")))raw="'"+raw;
      if(raw.length>DESKTOP_LIMITS.cellLength)throw Error('A cell exceeds the 1,000-character import limit.');grid[r][c]=raw;
      const style=styles[Number(cell.getAttribute('s'))]??{};if(Object.keys(style).length)cellStyles[address(r,c)]={...style};
    }
    for(const col of nodes(doc,'col')){const lo=Number(col.getAttribute('min'))-1,hi=Math.min(Number(col.getAttribute('max'))-1,cols-1),w=Math.max(40,Math.min(600,Number(col.getAttribute('width'))*7+5));for(let c=lo;c<=hi;c++)if(c>=0&&Number.isFinite(w))widths[c]=w;}
    if(nodes(doc,'mergeCell').length)warnings.add('Merged cells were unmerged; their top-left values are retained.');if(nodes(doc,'conditionalFormatting').length)warnings.add('Conditional formatting rules were not imported.');if(nodes(doc,'drawing').length||nodes(doc,'tableParts').length)warnings.add('Charts, drawings and Excel table objects are not imported; cell data is retained.');
    if(node.getAttribute('state')&&node.getAttribute('state')!=='visible')warnings.add('Hidden sheets are visible in this editor.');
    const pane=nodes(doc,'pane')[0];return {id:`sheet-${i+1}`,name:node.getAttribute('name')??`Sheet${i+1}`,cells:grid,styles:cellStyles,widths,freezeRows:Math.min(20,Math.max(0,Number(pane?.getAttribute('ySplit')??0))),freezeCols:Math.min(5,Math.max(0,Number(pane?.getAttribute('xSplit')??0)))};
  });
  if(unsupported)warnings.add(`${unsupported} unsupported formulas are retained but display #NAME? / #ERROR! here. Recheck in Excel; unsupported formulas export as inert text/error values.`);
  const active=Number(nodes(workbook,'workbookView')[0]?.getAttribute('activeTab')??0);const result={...file,sheets,cells:sheets[0].cells,activeSheetId:sheets[active]?.id??sheets[0].id};const error=desktopFileError(result);if(error)throw Error(error);if(new TextEncoder().encode(JSON.stringify(result)).length>DESKTOP_LIMITS.bytes-10000)throw Error('This workbook is too large for the available workspace storage.');
  return {file:result,warnings:[...warnings]};
}
