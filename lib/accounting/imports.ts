import type {Journal,PracticeCompany} from './types';
import {parseMoney} from './money';
import {journalError} from './engine';
export function parseCSV(text:string):string[][]{
 const input=text.replace(/^\uFEFF/,''),rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell.length)throw new Error('Malformed quote in CSV field.');else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('CSV has an unclosed quoted field.');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
export function importJournalCSV(text:string,company:PracticeCompany,existingIds:Set<string>,locked=false):{journals:Journal[];lineCount:number}{
 if(text.length>1_000_000)throw new Error('Use a CSV smaller than 1 MB.');const rows=parseCSV(text);if(rows.length<2)throw new Error('The CSV needs headers and at least one journal.');if(rows.length>2001)throw new Error('Use at most 2,000 journal lines per import.');const header=rows[0].map(h=>h.trim().toLowerCase()),column=(name:string)=>header.indexOf(name.toLowerCase());
 if(new Set(header).size!==header.length)throw new Error('CSV headers must be unique.');
 for(const name of ['Journal ID','Date','Narration','Account','Debit AUD','Credit AUD'])if(column(name)<0)throw new Error(`Missing required column: ${name}.`);
 const value=(row:string[],name:string)=>column(name)<0?'':(row[column(name)]??'').trim(),map=new Map<string,Journal>();
 for(let i=1;i<rows.length;i++){const r=rows[i];if(r.length!==header.length)throw new Error(`CSV row ${i+1} has a different number of fields from the header.`);const id=value(r,'Journal ID'),date=value(r,'Date'),description=value(r,'Narration'),reference=value(r,'Reference'),source=value(r,'Source document')||(company.documents.some(d=>d.id===reference)?reference:''),module=value(r,'Module')||'CSV import';
  if(!id)throw new Error(`Missing journal ID on row ${i+1}.`);if(existingIds.has(id))throw new Error(`Journal ${id} already exists. Importing it would duplicate the entry.`);
  let j=map.get(id);if(!j){j={id,date,description,reference,module,lines:[],origin:'learner',...(source?{sourceId:source}:{}),...(value(r,'Exercise')?{exerciseId:value(r,'Exercise')}:{}),...(value(r,'Cash flow class')?{cashClass:value(r,'Cash flow class') as Journal['cashClass']}:{})};map.set(id,j);}else if(j.date!==date||j.description!==description||j.reference!==reference||j.sourceId!==(source||undefined)||j.module!==module||j.exerciseId!==(value(r,'Exercise')||undefined)||j.cashClass!==(value(r,'Cash flow class')||undefined))throw new Error(`Rows for ${id} disagree on date, narration, reference, source or module.`);
  j.lines.push({account:value(r,'Account'),debit:parseMoney(value(r,'Debit AUD')||'0'),credit:parseMoney(value(r,'Credit AUD')||'0'),...(value(r,'Contact')?{contact:value(r,'Contact')}:{}),...(value(r,'Inventory item')?{itemId:value(r,'Inventory item')}:{}),...(value(r,'Line memo')?{memo:value(r,'Line memo')}:{})});
 }
 const journals=[...map.values()];if(journals.length>200)throw new Error('Use at most 200 journals per import.');for(const j of journals){const error=journalError(j,company,locked);if(error)throw new Error(`${j.id}: ${error}`);}return {journals,lineCount:rows.length-1};
}
