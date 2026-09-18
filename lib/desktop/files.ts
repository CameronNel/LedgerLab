import {dayMail} from '../accounting/workday';
import {asOfDate,closePackDate} from '../accounting/workday-calendar';
import type {PracticeCompany,PracticeState,Journal,SourceDocument} from '../accounting/types';
import {documentHTML,financialStatementsHTML,bankCSV,payrollCSV,journalCSV,trialBalanceCSV,htmlEscape,csv} from '../accounting/exports';
import {careerTasks} from '../accounting/career-work';
import {careerPortfolioHTML} from '../accounting/career-exports';
import {trialBalance} from '../accounting/engine';
import {monthEnd} from '../accounting/money';
import {workbookXLSX} from './worksheet';
import {WORKPAPER_TEMPLATES,enrichWorkingFile} from './workpaper-templates';
import {newDesktopId,type DesktopUserFile} from './types';
export type DesktopModel = {company:PracticeCompany;state:PracticeState;journals:Journal[];displayName:string;saving:boolean;saveStatus:string;error:string;generation:number;reportingMonth?:string};
export type VirtualFile = {id:string;name:string;folder:string;kind:'document'|'mail'|'report'|'csv'|'note'|'workbook'|'template';date:string;description:string;ref:string;view?:string;taskId?:string;priority?:string;due?:string;category?:string};
export type ScenarioMail = {id:string;date:string;from:string;subject:string;body:string[];attachments:string[];view?:string;taskId?:string;priority?:string;due?:string;category?:string};
export type FilePayload = {name:string;content:string|Uint8Array;mime:string};
export {FINANCE_APPS} from '../workspace/app-registry';
export const currentMonth=(model:Pick<DesktopModel,'state'>)=>model.state.career?.activeMonth??'2025-12';
export const monthLabel=(month:string)=>new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
export const safeFilename=(name:string)=>name.replace(/[\\/<>:"|?*\x00-\x1f]/g,'-').replace(/[. ]+$/,'').slice(0,120)||'Untitled';
export function documentFolder(d:SourceDocument):string {
  if(d.id==='HANDOVER'||d.id.startsWith('HANDOVER-')||d.id==='TB-OPEN')return 'Handover';
  if(d.kind==='Contract')return 'Company reference/Contracts';
  const month=d.date.slice(0,7),base=`Finance/${month}`;
  const folders:Partial<Record<SourceDocument['kind'],string>>={
    'Bank statement':'Banking','Sales invoice':'Receivables/Invoices','Credit note':'Receivables/Credit notes',
    'Supplier invoice':'Payables/Invoices','Supplier credit note':'Payables/Credit notes','Customer statement':'Receivables/Statements',
    'Supplier statement':'Payables/Statements','Payroll register':'Payroll','Payslip':'Payroll/Payslips','Stock count':'Inventory',
  };
  if(folders[d.kind])return `${base}/${folders[d.kind]}`;
  return `${base}/${/FA-REGISTER|LEASE|ASSET/i.test(d.id)?'Assets & leases':'Month-end evidence'}`;
}
export function sourceDocuments(model:Pick<DesktopModel,'company'|'state'>):SourceDocument[]{
  const end=model.state.career?monthEnd(model.state.career.activeMonth):'9999-12-31';
  return [...model.company.documents,...model.state.customDocuments].filter(d=>d.date<=end);
}
/** These are scenario communications, not imported or sent email. No answer figures are included. */
export function scenarioMail(model:Pick<DesktopModel,'company'|'state'>):ScenarioMail[]{
  if(model.state.workday)return dayMail(model.state);
  const docs=sourceDocuments(model),byId=new Set(docs.map(d=>d.id)),result:ScenarioMail[]=[];
  const start=model.state.career?.startMonth??'2025-12',active=currentMonth(model);
  result.push({id:'MAIL-HANDOVER',date:`${start}-01`,from:'Departing accountant',subject:'Your handover: finance files and outstanding work',body:[
    `Welcome to Harbour & Co. You are taking responsibility for ${monthLabel(start)}${model.state.career?' onward':''}.`,
    'The Finance drive contains the source evidence, with a folder for each released month. Read the handover and opening policies before making changes.',
    'Investigate the inherited ledger. Source files are evidence, not proof that a transaction was posted. Correct errors with traceable entries, not by deleting history.',
    'Save your workings under Working papers. The prior-year signed AFS and complete comparative evidence have not been supplied; record an evidence request instead of inventing them.',
  ],attachments:['HANDOVER','TB-OPEN',...docs.filter(d=>d.id.startsWith('HANDOVER-')).map(d=>d.id)].filter(id=>byId.has(id)),view:'career'});
  const months=[...new Set(docs.map(d=>d.date.slice(0,7)))].filter(m=>m>='2025-01'&&m<=active).sort();
  for(const month of months){
    const batches=[
      {tag:'BANK',from:'Practice Bank',subject:'Monthly bank statement',kinds:['Bank statement']},
      {tag:'PAYROLL',from:'Payroll administrator',subject:'Payroll register and payslips for review',kinds:['Payroll register','Payslip']},
      {tag:'INVOICES',from:'Accounts administrator',subject:'Invoice and credit-note processing pack',kinds:['Sales invoice','Supplier invoice','Credit note','Supplier credit note']},
      {tag:'STATEMENTS',from:'Accounts administrator',subject:'Customer and supplier statements',kinds:['Customer statement','Supplier statement']},
    ];
    for(const b of batches){const attachments=docs.filter(d=>d.date.startsWith(month)&&b.kinds.includes(d.kind)).map(d=>d.id);if(!attachments.length)continue;
      result.push({id:`MAIL-${b.tag}-${month}`,date:monthEnd(month),from:b.from,subject:`${monthLabel(month)}: ${b.subject}`,body:[
        `The ${monthLabel(month)} documents are attached for your review and reconciliation.`,
        'Check the evidence against the ledger and supporting records. Investigate missing, duplicated or incorrectly coded items before posting or approving anything.',
        'This message is part of the fictional case. Its attachments are the same source documents used by the accounting engine.',
      ],attachments,view:b.tag==='BANK'?'bank':b.tag==='PAYROLL'?'payroll':'career'});
    }
    if(model.state.career&&month>=start){
      for(const task of careerTasks(model.company,model.state,month))result.push({
        id:`MAIL-TASK-${month}-${task.id}`,date:`${month}-01`,from:task.requestor,subject:`${monthLabel(month)}: ${task.title}`,body:[task.brief,`Requested deliverable: ${task.title}. Due: ${task.due}.`,
          'Document your evidence, findings and recommended action. Submit the formal deliverable from Your finance desk; an email read marker or a spreadsheet alone does not sign it off.'],
        attachments:task.evidence.filter(id=>byId.has(id)),view:task.view,
      });
    }
  }
  return result.sort((a,b)=>b.date.localeCompare(a.date)||a.subject.localeCompare(b.subject));
}
export function virtualFiles(model:DesktopModel):VirtualFile[]{
  const docs=sourceDocuments(model),active=currentMonth(model),list:VirtualFile[]=docs.map(d=>({
    id:`DOC:${d.id}`,ref:d.id,name:safeFilename(`${d.id} - ${d.party}`)+'.html',folder:documentFolder(d),kind:'document',date:d.date,
    description:`${d.kind} · ${d.title}${model.state.workday?` · Arrived ${d.metadata?.availableOn??d.date}`:''}`,view:d.kind==='Bank statement'?'bank':d.kind.includes('Payroll')||d.kind==='Payslip'?'payroll':undefined,
  }));
  for(const mail of scenarioMail(model))list.push({id:`EMAIL:${mail.id}`,ref:mail.id,name:safeFilename(mail.subject)+'.eml',folder:`Inbox/${mail.date.slice(0,7)}`,kind:'mail',date:mail.date,description:`From ${mail.from}`});
  const months=[...new Set(docs.map(d=>d.date.slice(0,7)))].filter(m=>m>='2025-01'&&m<=active).sort();
  for(const month of months){
    const date=asOfDate(model.state,month);
    for(const [ref,name,folder,kind,description,view] of [
      ['bank',`Bank statement data ${month}.csv`,'Banking','csv','Independent statement data · AUD','bank'],
      ['payroll',`Payroll register ${month}.csv`,'Payroll','csv','Independent payroll data · AUD','payroll'],
      ['tb',`Learner trial balance ${month}.csv`,'AFS & reporting','csv','Live learner balances, not a worked answer','reports'],
      ['journals',`Learner journal listing ${month}.csv`,'AFS & reporting','csv','Live learner journal movements for this month','ledger'],
      ['afs',`Draft financial statements ${month}.html`,'AFS & reporting','report','Live year-to-date teaching draft · unsigned','reports'],
    ] as const){if(ref==='payroll'&&!model.company.payroll[month])continue;list.push({id:`LIVE:${ref}:${month}`,ref:`${ref}:${month}`,name,folder:`Finance/${month}/${folder}`,kind,date,description,view});}
  }
  list.push({id:'NOTE:readme',ref:'readme',name:'Read me first.txt',folder:'Handover',kind:'note',date:`${model.state.career?.startMonth??active}-01`,description:'How to use your finance workstation'});
  list.push({id:'NOTE:comparatives',ref:'comparatives',name:'Prior-year AFS - outstanding evidence.txt',folder:'Handover',kind:'note',date:`${model.state.career?.startMonth??active}-01`,description:'An evidence gap, not a fabricated prior-year statement',view:'audit'});
  list.push({id:'NOTE:notebook',ref:'notebook',name:'Practice notebook.txt',folder:'My notes',kind:'note',date:`${active}-01`,description:'Your existing notebook · edit in Case, notebook & data',view:'settings'});
  if(model.state.career)list.push({id:'LIVE:portfolio',ref:'portfolio',name:'Finance work portfolio.html',folder:'Working papers',kind:'report',date:monthEnd(active),description:'Saved role deliverables and forecasts',view:'career'});
  for(const w of Object.values(model.state.workpapers))list.push({id:`WORK:${w.id}`,ref:w.id,name:safeFilename(`${w.id} - conclusion`)+'.txt',folder:'Working papers/Signed-off work',kind:'note',date:w.updatedAt.slice(0,10),description:'Saved accounting workpaper and evidence links',view:'audit'});
  for(const template of Object.keys(WORKPAPER_TEMPLATES))list.push({id:`TEMPLATE:${template}`,ref:template,name:WORKPAPER_TEMPLATES[template]+'.template',folder:'Working papers/Templates',kind:'template',date:`${active}-01`,description:'Create an editable working paper; does not post or sign off'});
  for(const f of model.state.desktop?.files??[])list.push({id:f.id,ref:f.id,name:f.name,folder:f.deleted?'Recycle bin':f.folder,kind:f.kind,date:f.updatedAt.slice(0,10),description:f.deleted?`Restore to ${f.folder}`:'Your saved working file'});
  return list;
}
export function virtualFolders(files:VirtualFile[],active:string):string[]{
  const folders=new Set(['','Handover','Inbox','Finance','Company reference','My notes','Recycle bin','Working papers','Working papers/Templates',`Working papers/${active}`,`Finance/${active}`]);
  for(const f of files){let folder=f.folder;while(folder){folders.add(folder);folder=folder.split('/').slice(0,-1).join('/');}}
  return [...folders].sort();
}
export function readNote(file:VirtualFile,model:DesktopModel):string {
  if(file.id.startsWith('UF-'))return model.state.desktop?.files.find(f=>f.id===file.id)?.text??'';
  if(file.ref==='readme'&&model.state.workday)return `DAY-BY-DAY FINANCE JOB\n\nOpen Today. Read the welcome email, then open the highlighted first-day assignment. Every task explains what to do, where to work, what evidence supports it and when it is due.\n\nThe taskbar clock advances the fictional PC date, not your real computer clock. Save all drafts before advancing. Late work stays open; no automatic posting or ticking-off takes place.\n\nThe accounting month stays open during its early-next-month close window. Use Check today's work during the month; full Month review opens when the close pack arrives. After closing, release the next month. This version supports one open accounting month.\n\nAll records and emails are fictional. AUD 2025 teaching assumptions remain unchanged. Internal deadlines use Monday-Friday without public holidays and are not statutory filing deadlines. Numerical checks do not certify your narratives, workbook cells, commercial assumptions or complete statutory AFS.\n\nWorking papers support your response; they do not post journals. Save them and link their file IDs to assignments. Use Case settings to export a full backup before moving to another browser/file version.`;
  if(file.ref==='notebook')return model.state.notes||'No notebook entries yet. Open Case, notebook & data to edit your existing notebook.';
  if(file.ref==='comparatives')return 'OUTSTANDING EVIDENCE\n\nA complete signed prior-year AFS set and comparative income information have not been supplied in this teaching case. Do not represent the generated current-year teaching draft as a signed statutory report.\n\nRecord the evidence request, identify missing disclosures and document the limits of your draft. The opening trial balance is supplied separately.\n\nThis file is a case limitation, not a document from the previous auditor.';
  if(file.id.startsWith('WORK:')){const w=model.state.workpapers[file.ref];return w?`${w.id}\n\nPrepared: ${w.prepared?'Yes':'No'} by ${w.preparer}\nReviewed: ${w.reviewed?'Yes':'No'} by ${w.reviewer}\nUpdated: ${w.updatedAt}\n\n${w.conclusion}\n\nEvidence:\n${w.evidence.join('\n')}`:'Workpaper unavailable.';}
  return `HARBOUR & CO. / FINANCE WORKSTATION\n\nThis is a simplified browser-based PC, not Microsoft Windows or Microsoft Office.\n\n1. Read the handover, then open the current-month Finance folder.\n2. Read scenario emails and their attached evidence.\n3. Open a source file beside the accounting app. Capture invoices, prepare journals and reconcile the statements yourself.\n4. Save supporting calculations in Working papers. Use the formal accounting modules for postings, submissions and sign-off.\n5. Close the month before releasing later actual documents.\n\nFILES\nOriginal evidence is read-only. Printable source documents are HTML, not disguised PDFs. Use Print / Save as PDF to make a PDF through your browser. Bank and payroll exports are CSV. Working papers export as real .xlsx workbooks or value-only CSV.\n\nSAVING\nLearner files and mail-read markers save with your workspace and backup. An unsaved editor draft lives in this tab until you save or close it. Save before reloading or changing cases. Recycled learner files remain recoverable.\n\nWORKSHEETS\nUp to 500 rows and 52 columns per sheet, with 8 sheets. Keyboard editing, range selection, relative/mixed/absolute references, common accounting formulas, fill, formatting and basic XLSX import/export are supported. See Spreadsheet help for the function list and limitations. No macros, external workbook links or arbitrary Excel formulas. Amounts in working papers are decimal AUD; the posting engine continues to use integer cents.\n\nSAFETY\nAll entities, emails and records are fictional. No real email is read or sent and no files on your own PC are accessed. No extra plugin is required.`;
}
export function filePayload(file:VirtualFile,model:DesktopModel):FilePayload {
  if(file.kind==='document'){
    const doc=sourceDocuments(model).find(d=>d.id===file.ref);if(!doc)throw new Error('This source is not available in the released case.');
    return {name:file.name,content:documentHTML(doc,model.company,model.state),mime:'text/html;charset=utf-8'};
  }
  if(file.kind==='mail'){
    const mail=scenarioMail(model).find(m=>m.id===file.ref);if(!mail)throw new Error('Scenario email unavailable.');
    const text=`From: ${mail.from.replace(/[\r\n]/g,' ')} <scenario@ledgerlab.invalid>\r\nTo: Finance team <finance@ledgerlab.invalid>\r\nDate: ${new Date(`${mail.date}T09:00:00Z`).toUTCString()}\r\nSubject: ${mail.subject.replace(/[\r\n]/g,' ')}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${mail.body.join('\r\n\r\n')}\r\n\r\nAttachment references (download the source files separately):\r\n${mail.attachments.join('\r\n')}\r\n\r\nFICTIONAL SCENARIO EMAIL. No message was sent or received.\r\n`;
    return {name:file.name,content:text,mime:'message/rfc822'};
  }
  if(file.kind==='workbook'){
    const f=model.state.desktop?.files.find(f=>f.id===file.id);if(!f)throw new Error('Save the working paper before exporting from the drive.');
    return {name:file.name.replace(/\.xlsx$/i,'')+'.xlsx',content:workbookXLSX(f),mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
  }
  if(file.kind==='note')return {name:file.name,content:readNote(file,model),mime:'text/plain;charset=utf-8'};
  if(file.ref==='portfolio')return {name:file.name,content:careerPortfolioHTML(model.company,model.state),mime:'text/html;charset=utf-8'};
  const [ref,month]=file.ref.split(':');if(!month||month>currentMonth(model))throw new Error('This reporting period is not available.');
  const content=ref==='bank'?bankCSV(model.company,month):ref==='payroll'?payrollCSV(model.company,month):ref==='tb'?trialBalanceCSV(model.journals,asOfDate(model.state,month)):ref==='journals'?journalCSV(model.journals.filter(j=>j.date.startsWith(month))):ref==='afs'?financialStatementsHTML(model.company,model.state,'2025-01-01',asOfDate(model.state,month)):'';
  if(!content)throw new Error('This file cannot be exported.');
  return {name:file.name,content,mime:ref==='afs'?'text/html;charset=utf-8':'text/csv;charset=utf-8'};
}
export function csvPreview(text:string):string[][] {
  const rows:string[][]=[],row:string[]=[];let field='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push([...row]);row.length=0;field='';}else field+=c;}
  if(field||row.length){row.push(field);rows.push(row);}return rows;
}
export function createWorkingFile(model:DesktopModel,template='blank',now=new Date().toISOString(),id=newDesktopId()):DesktopUserFile{
  const month=currentMonth(model),cells=Array.from({length:40},()=>Array<string>(8).fill(''));
  const set=(r:number,...values:(string|number)[])=>values.forEach((v,c)=>{cells[r-1][c]=String(v);});
  const bank=trialBalance(model.journals,asOfDate(model.state,month)).find(r=>r.code==='1000');
  let title='Working paper';
  if(template==='bank'){
    title='Bank reconciliation';const statement=sourceDocuments(model).find(d=>d.kind==='Bank statement'&&d.date.startsWith(month));
    set(1,title,month);set(2,'Snapshot of your learner ledger. Inputs in AUD. No posting or sign-off.');
    set(4,'Description','Amount AUD','Source / explanation');set(5,'Cash-book balance',(bank?(bank.debit-bank.credit)/100:0),'Learner ledger at creation');
    set(6,'Unrecorded receipts (+)',0);set(7,'Unrecorded payments (-)',0);set(8,'Other ledger corrections (+/-)',0);
    set(9,'Adjusted cash book','=SUM(B5:B8)');
    set(11,'Bank statement closing',statement?(statement.total/100):0,statement?.id??'Obtain source statement');
    set(12,'Deposits in transit (+)',0);set(13,'Outstanding payments (-)',0);set(14,'Bank errors (+/-)',0);
    set(15,'Adjusted bank statement','=SUM(B11:B14)');set(17,'Unexplained difference','=B9-B15');
    set(19,'Prepared by',model.displayName);set(20,'Conclusion','');set(22,'Reconcile the timing items and post book corrections in the accounting app.');
  }else if(template==='payroll'){
    title='Payroll control';set(1,title,month);set(2,'Independent register inputs in AUD. Compare with payroll and control accounts.');
    set(4,'Employee','Gross','Withholding','Deductions','Calculated net','Register net','Difference','Super');
    const pay=model.company.payroll[month]??[];
    for(const [i,p] of pay.slice(0,25).entries()){const r=i+5;set(r,p.name,p.gross/100,p.withholding/100,p.deductions/100,`=B${r}-C${r}-D${r}`,p.net/100,`=E${r}-F${r}`,p.super/100);}
    const end=4+Math.min(pay.length,25),total=end+2;
    if(pay.length){set(total,'Total',...Array.from({length:7},(_,c)=>`=SUM(${String.fromCharCode(66+c)}5:${String.fromCharCode(66+c)}${end})`));}
    set(total+2,'Prepared by',model.displayName);set(total+3,'Control-account reconciliation','');set(total+5,'No statutory rate verification is implied. Use the dated teaching-case assumptions.');
  }else if(template==='accrual'){
    title='Accrual rollforward';set(1,title,month);set(2,'Inputs in AUD. Reference source evidence and posting IDs.');
    set(4,'Expense / supplier','Opening','Reversal (-)','New accrual','Settlement (-)','Closing','Source','Comment');
    for(let r=5;r<=16;r++)set(r,'',0,0,0,0,`=SUM(B${r}:E${r})`);
    set(18,'Total',...Array.from({length:5},(_,c)=>`=SUM(${String.fromCharCode(66+c)}5:${String.fromCharCode(66+c)}16)`));
    set(20,'Ledger control balance',0);set(21,'Unexplained difference','=F18-B20');set(23,'Prepared by',model.displayName);set(24,'Conclusion','');
  }else{set(1,'Working paper',month);set(2,'Purpose','');set(3,'Prepared by',model.displayName);set(5,'Description','Amount AUD','Source','Notes');}
  return enrichWorkingFile({id,name:`${title} ${month}.xlsx`,folder:`Working papers/${month}`,kind:'workbook',text:'',cells,createdAt:now,updatedAt:now,deleted:false},model,template);
}
export function uniqueFileName(name:string,folder:string,model:DesktopModel,excludingId?:string):string{
  name=safeFilename(name);const existing=new Set((model.state.desktop?.files??[]).filter(f=>!f.deleted&&f.id!==excludingId&&f.folder.toLowerCase()===folder.toLowerCase()).map(f=>f.name.toLowerCase()));
  if(!existing.has(name.toLowerCase()))return name;
  const dot=name.lastIndexOf('.'),stem=dot>0?name.slice(0,dot):name,ext=dot>0?name.slice(dot):'';
  for(let n=2;n<1000;n++){const next=`${stem.slice(0,100)} (${n})${ext}`;if(!existing.has(next.toLowerCase()))return next;}throw new Error('Choose another file name.');
}
const documentCSP=`<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">`;
export const safeDocumentHTML=(html:string)=>/<head>/i.test(html)?html.replace(/<head>/i,documentCSP):html.replace(/(<html[^>]*>)/i,`$1${documentCSP}</head>`);
export function csvTableHTML(text:string):string {
  const rows=csvPreview(text),e=htmlEscape;
  return `<table class="pc-data-table"><thead><tr>${(rows[0]??[]).map(v=>`<th>${e(v)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(row=>`<tr>${row.map(v=>`<td>${e(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
