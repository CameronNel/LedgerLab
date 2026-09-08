import assert from 'node:assert/strict';
import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {initialState,applyCommand,validateBackup,journalsFor} from '../../lib/accounting/engine';
import {companyForState} from '../../lib/accounting/career';
import {CAREER_MONTHS} from '../../lib/accounting/career';
import type {PracticeState,Command} from '../../lib/accounting/types';
import {desktopStateError,desktopFileError,type DesktopUserFile} from '../../lib/desktop/types';
import {virtualFiles,virtualFolders,sourceDocuments,scenarioMail,filePayload,createWorkingFile,csvPreview,uniqueFileName,safeDocumentHTML,type DesktopModel} from '../../lib/desktop/files';
import {evaluateGrid,worksheetCSV,worksheetXLSX,parseFormula,cellAddress} from '../../lib/desktop/worksheet';
import {createWorkspaceHandlers,type WorkspaceDatabase} from '../../lib/workspace/service';
import {WorkspaceSession} from '../../lib/workspace/session';
let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};const equal=(a:unknown,b:unknown,m:string)=>{assert.deepEqual(a,b,m);checks++;};const rejects=(fn:()=>unknown,m:string)=>{assert.throws(fn,m);checks++;};
const NOW='2026-09-07T09:00:00.000Z';
const takeover=(month='2025-07',seed=271828)=>applyCommand(initialState(seed),{type:'startCareer',seed,startMonth:month,role:'financial-manager',scenario:'messy',confirmation:'START TAKEOVER'},NOW);
function model(state=takeover()):DesktopModel{const company=companyForState(state);return{company,state,journals:journalsFor(company,state),displayName:'Test accountant',saving:false,saveStatus:'Saved workspace',error:'',generation:0};}
const note=(id='UF-note',name='Findings.txt'):DesktopUserFile=>({id,name,folder:'My notes',kind:'note',text:'Follow up on bank recon.',cells:[],createdAt:NOW,updatedAt:NOW,deleted:false});
function catalogueChecks(){
 for(const seed of [271828,42])for(const month of CAREER_MONTHS){
  const m=model(takeover(month,seed)),docs=sourceDocuments(m),ids=new Set(docs.map(d=>d.id)),files=virtualFiles(m),folders=virtualFolders(files,month);
  equal(new Set(files.map(f=>f.id)).size,files.length,'Unique virtual file identifiers');
  ok(files.some(f=>f.id==='NOTE:comparatives'),'Missing prior signed AFS is disclosed, not fabricated');
  ok(files.some(f=>f.id===`LIVE:afs:${month}`),'Current teaching AFS present');
  for(const f of files){ok(f.date.slice(0,7)<=month,'No later-period source released');ok(folders.includes(f.folder),'Every file belongs to a visible folder');}
  for(const message of scenarioMail(m)){ok(message.date.slice(0,7)<=month,'Scenario mail respects monthly gate');equal(Object.keys(message).sort().filter(k=>!['id','date','from','subject','body','attachments','view'].includes(k)),[],'Mail has no answer-figure payload');for(const id of message.attachments)ok(ids.has(id),'Mail attachments refer to released original evidence');}
  ok(!folders.some(f=>/^Finance\/2025-/.test(f)&&f.slice(8,15)>month),'No later-period Finance folder');
  const invoice=files.find(f=>f.kind==='document'&&f.folder.includes('/Invoices'));
  if(invoice){const payload=filePayload(invoice,m);ok(typeof payload.content==='string'&&payload.content.includes('<html'),'Source is genuine HTML, with honest .html filename');ok(payload.name.endsWith('.html'),'Source extension is honest');}
  const afs=filePayload(files.find(f=>f.id===`LIVE:afs:${month}`)!,m);ok(String(afs.content).includes(month),'AFS report period is scoped');
  for(const template of ['bank','payroll','accrual','blank']){const f=createWorkingFile(m,template,NOW,`UF-${template}`);equal(desktopFileError(f),null,'Template passes server file validation');ok(evaluateGrid(f.cells).every(row=>row.every(cell=>!String(cell).startsWith('#'))),'Template formulas evaluate without errors');}
 }
 const m=model();const docs=JSON.stringify(m.company.documents),f=createWorkingFile(m,'bank',NOW,'UF-bank');
 const changed=applyCommand(m.state,{type:'saveDesktopFile',file:f,expectedUpdatedAt:null},NOW);equal(JSON.stringify(companyForState(changed).documents),docs,'Saving working papers never mutates source evidence');
 equal(changed.journals,m.state.journals,'Working papers do not post journals');equal(changed.career,m.state.career,'Working papers do not sign off career deliverables');
 equal(filePayload(virtualFiles(m).find(f=>f.id==='NOTE:comparatives')!,m).name,'Prior-year AFS - outstanding evidence.txt','Prior-year missing evidence is explicit');
 for(const html of ['<html><head></head><body>x</body></html>','<html lang="en"><meta charset="utf-8"><body>x</body></html>'])ok(safeDocumentHTML(html).includes('Content-Security-Policy'),'Viewer adds CSP even to headless portfolio export');
}
function fileChecks(){
 equal(validateBackup(initialState()),null,'Legacy backups without desktop remain valid');equal(desktopStateError(undefined),null,'No schema migration required');
 let s=takeover();const before=structuredClone(s);let f=note();s=applyCommand(s,{type:'saveDesktopFile',file:f,expectedUpdatedAt:null},NOW);
 equal(s.desktop?.files.length,1,'New learner note saved');equal(s.schemaVersion,before.schemaVersion,'Saved state schema unchanged');equal(validateBackup(JSON.parse(JSON.stringify(s))),null,'Desktop backup roundtrips');
 f=s.desktop!.files[0];const token=f.updatedAt;
 s=applyCommand(s,{type:'saveDesktopFile',file:{...f,text:'Changed in same millisecond'},expectedUpdatedAt:token},NOW);f=s.desktop!.files[0];ok(f.updatedAt!==token,'Per-file token is monotonic even in the same millisecond');
 rejects(()=>applyCommand(s,{type:'saveDesktopFile',file:{...f,text:'Stale draft'},expectedUpdatedAt:token},NOW),'Stale per-file draft cannot overwrite new content');
 rejects(()=>applyCommand(s,{type:'saveDesktopFile',file:note('UF-duplicate','findings.TXT'),expectedUpdatedAt:null},NOW),'Duplicate path rejected case-insensitively');
 equal(uniqueFileName('Findings.txt','My notes',model(s)),'Findings (2).txt','Safe alternative name generated');
 s=applyCommand(s,{type:'trashDesktopFile',fileId:f.id,expectedUpdatedAt:f.updatedAt},NOW);f=s.desktop!.files[0];ok(f.deleted,'Learner file is recycled, not permanently deleted');
 rejects(()=>applyCommand(s,{type:'saveDesktopFile',file:{...f,deleted:false},expectedUpdatedAt:f.updatedAt},NOW),'Writing a recycled file is blocked');
 rejects(()=>applyCommand(s,{type:'trashDesktopFile',fileId:'DOC:HANDOVER',expectedUpdatedAt:NOW},NOW),'Original source cannot be recycled');
 s=applyCommand(s,{type:'saveDesktopFile',file:note('UF-replacement'),expectedUpdatedAt:null},NOW);
 rejects(()=>applyCommand(s,{type:'restoreDesktopFile',fileId:f.id,expectedUpdatedAt:f.updatedAt},NOW),'Restore collision cannot silently overwrite another file');
 let other=s.desktop!.files.find(v=>v.id==='UF-replacement')!;s=applyCommand(s,{type:'saveDesktopFile',file:{...other,name:'Other.txt'},expectedUpdatedAt:other.updatedAt},NOW);
 s=applyCommand(s,{type:'restoreDesktopFile',fileId:f.id,expectedUpdatedAt:f.updatedAt},NOW);ok(!s.desktop!.files.find(v=>v.id===f.id)!.deleted,'Recycled file restores when destination is available');
 for(const read of [true,true,false])s=applyCommand(s,{type:'markDesktopMailRead',mailId:'MAIL-HANDOVER',read},NOW);equal(s.desktop?.readMail,[],'Read/unread markers deduplicate and persist');
 for(const patch of [{id:'DOC:HANDOVER'},{name:'../x.txt'},{name:'x.xlsx'},{folder:'Finance/2025-07'},{folder:'My notes/../Evidence'},{folder:'Working papers//x'},{text:'x'.repeat(30001)},{kind:'script'},{cells:[['x']]},{createdAt:'yesterday'},{updatedAt:NaN},{name:'x\u0000.txt'}])ok(desktopFileError({...note(),...patch})!==null,'Malformed file rejected');
 const sheet=createWorkingFile(model(),'blank',NOW,'UF-sheet');delete sheet.sheets;delete sheet.activeSheetId;for(const cells of [[],[['a'],['a','b']],Array.from({length:501},()=>['']),[Array(53).fill('')],[['x'.repeat(1001)]],[[4]]])ok(desktopFileError({...sheet,cells})!==null,'Oversized or malformed worksheet rejected');
 ok(desktopStateError({version:1,files:Array.from({length:81},(_,i)=>note(`UF-${i}`,`${i}.txt`)),readMail:[]})!==null,'80-file storage bound enforced');
 ok(desktopStateError({version:1,files:[{...sheet,cells:Array.from({length:60},()=>Array(12).fill('x'.repeat(1000)))}],readMail:[]})!==null,'Serialized desktop byte limit enforced');
}
function worksheetChecks(){
 const rows=[['2','3','=A1+B1','=A1*B1','=B1-A1','=B1/A1','=-(A1+B1)','=SUM(A1:B1)'],['5','text','=AVERAGE(A1:B1)','=MIN(A1:B1)','=MAX(A1:B1)','=COUNT(A1:B2)','=ABS(-12)','=ROUND(-1.235,2)'],['=A3','=B3+1','=Z999','=1/0','=HYPERLINK("x","x")','=1+2*3','=SUM($A$1:$B$1)',"'=2+2"]];
 const v=evaluateGrid(rows);equal(v[0],[2,3,5,6,1,1.5,-5,5],'Arithmetic, precedence and SUM');equal(v[1],[5,'text',2.5,2,3,3,12,-1.24],'Functions, text handling and negative rounding');
 equal(v[2],['#CIRC!','#CIRC!','#REF!','#DIV/0!','#NAME?',7,5,'=2+2'],'Bad formulas are data/errors, not executable code');
 equal(evaluateGrid([['','=A1+1','=SUM(A1)']])[0],['',1,0],'Blank cells evaluate consistently');
 equal(evaluateGrid([['=2e3+5','=ROUND(125,-1)','=ROUND(1.005,2)','=SUM()']])[0],[2005,130,1.01,0],'Scientific values and rounding boundaries');
 rejects(()=>parseFormula('=WEBSERVICE("https://invalid")'),'External network formula rejected');rejects(()=>parseFormula('='+Array(400).fill('1').join('+')),'Excessive expression bounded');
 equal(cellAddress(59,11),'L60','Grid address bound');
 equal(csvPreview('a,b\r\n"x,y","two\nlines"\r\n"quote""d",3'),[['a','b'],['x,y','two\nlines'],['quote"d','3']],'CSV quoted fields, newlines and doubled quotes');
 ok(worksheetCSV([["=2+2","'=cmd|' /C x'!A0"]]).includes("'=cmd"),'CSV formula-like literal is escaped');
 const xlsx=worksheetXLSX([['Description','Amount'],['Value','125'],['Total','=SUM(B2:B2)'],['Literal',"'=WEBSERVICE(\"https://invalid\")"]]);
 equal(Array.from(xlsx.slice(0,4)),[80,75,3,4],'XLSX is a genuine ZIP package');
 const text=new TextDecoder().decode(xlsx);ok(text.includes('<f>SUM(B2:B2)</f><v>125</v>'),'XLSX contains whitelisted formula and cached correct result');ok(!text.includes('<f>WEBSERVICE'),'Unsafe formulas never exported as executable formulas');ok(!text.includes('externalLink'),'No external workbook relationships');
 if(process.env.LEDGERLAB_DESKTOP_TEST_OUTPUT){mkdirSync(process.env.LEDGERLAB_DESKTOP_TEST_OUTPUT,{recursive:true});writeFileSync(`${process.env.LEDGERLAB_DESKTOP_TEST_OUTPUT}/formula-regression.xlsx`,xlsx);writeFileSync(`${process.env.LEDGERLAB_DESKTOP_TEST_OUTPUT}/bank-reconciliation.xlsx`,worksheetXLSX(createWorkingFile(model(),'bank',NOW,'UF-bank-export').cells));}
}
async function apiChecks(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('drizzle/0000_careless_shadow_king.sql','utf8'));
 const database:WorkspaceDatabase={prepare(text:string){let values:SQLInputValue[]=[];const statement={bind(...input:unknown[]){values=input as SQLInputValue[];return statement;},async first<T>():Promise<T|null>{return(sqlite.prepare(text).get(...values) as T|undefined)??null;},async run(){const r=sqlite.prepare(text).run(...values);return{meta:{changes:Number(r.changes)}};}};return statement;}};
 const api=createWorkspaceHandlers({owner:async()=> 'desktop-test-owner',database:()=>database,now:()=>NOW});let drop=false,posts=0;
 const session=new WorkspaceSession(async(_url,init)=>{if(init?.method!=='POST')return api.GET();posts++;const result=await api.POST(new Request('http://localhost/api/workspace',init));if(drop){drop=false;throw new Error('Lost response after commit');}return result;});
 ok((await session.load()).ok,'Real session loads production SQLite handler');let f=note();ok((await session.save({type:'saveDesktopFile',file:f,expectedUpdatedAt:null})).ok,'Desktop save traverses production API');
 await session.load();equal(session.getSnapshot().state.desktop?.files[0].text,f.text,'File content roundtrips through SQLite');f=session.getSnapshot().state.desktop!.files[0];
 const stale={...f};drop=true;ok(!(await session.save({type:'saveDesktopFile',file:{...f,text:'Acknowledgement lost'},expectedUpdatedAt:f.updatedAt})).ok,'Lost file-save response fails closed');
 const n=posts;ok(!(await session.save({type:'saveDesktopFile',file:{...f,text:'Blind retry'},expectedUpdatedAt:f.updatedAt})).ok,'Blind retry is blocked');equal(posts,n,'No duplicate write after lost acknowledgement');
 await session.load();f=session.getSnapshot().state.desktop!.files[0];equal(f.text,'Acknowledgement lost','Reload discovers actual committed file');
 ok(!(await session.save({type:'saveDesktopFile',file:stale,expectedUpdatedAt:stale.updatedAt})).ok,'Current workspace revision still rejects stale file baseline');
 ok((await session.save({type:'trashDesktopFile',fileId:f.id,expectedUpdatedAt:f.updatedAt})).ok,'Recycle command persists through API');await session.load();f=session.getSnapshot().state.desktop!.files[0];ok(f.deleted,'Recycle marker roundtrips');
 ok((await session.save({type:'restoreDesktopFile',fileId:f.id,expectedUpdatedAt:f.updatedAt})).ok,'Restore command persists');ok((await session.save({type:'markDesktopMailRead',mailId:'MAIL-HANDOVER',read:true})).ok,'Scenario read marker saves');await session.load();equal(session.getSnapshot().state.desktop?.readMail,['MAIL-HANDOVER'],'Scenario read marker roundtrips');
 const before=session.getSnapshot().revision;ok(!(await session.save({type:'saveDesktopFile',file:{...note('UF-bad'),folder:'Finance/2025-07'},expectedUpdatedAt:null})).ok,'Invalid folder rejected by real boundary');equal(session.getSnapshot().revision,before,'Rejected file cannot advance revision');
 ok((await session.save({type:'importBackup',state:session.getSnapshot().state})).ok,'Desktop data accepted by existing backup restoration');
 sqlite.close();
}
async function main(){catalogueChecks();fileChecks();worksheetChecks();await apiChecks();console.log(`PASS: ${checks} desktop catalogue, monthly gating, worksheet, file validation and production SQLite/API checks.`);}
void main().catch(error=>{console.error(error);process.exitCode=1;});
