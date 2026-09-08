import {createLocalAccounting} from './local-accounting';
/** LOCAL PREVIEW / BROWSER TEST FIXTURE ONLY. Never imported by production React.
 * The desktop, document catalogue, formula engine and WorkspaceSession are real.
 * Storage is browser-local; accounting-window callbacks use the production command engine with local storage.
 */
import {initialState,applyCommand,validateBackup,journalsFor,trialBalance} from '../../lib/accounting/engine';
import {companyForState} from '../../lib/accounting/career';
import {htmlEscape as e,downloadFile} from '../../lib/accounting/exports';
import {WorkspaceSession,workspaceStatus} from '../../lib/workspace/session';
import {mountFinanceDesktop,type DesktopHandle} from '../../lib/desktop/shell';
import {type DesktopModel} from '../../lib/desktop/files';
import type {Command,WorkspaceEnvelope} from '../../lib/accounting/types';
const key='ledgerlab-finance-pc-preview-v1';
const seed=()=>applyCommand(initialState(271828),{type:'startCareer',seed:271828,startMonth:'2025-07',role:'financial-manager',scenario:'messy',daily:true,confirmation:'START TAKEOVER'},'2026-09-07T09:00:00.000Z');
const initial=():WorkspaceEnvelope=>({state:seed(),revision:0,updatedAt:'2026-09-07T09:00:00.000Z'});
let fallback=initial(),fault=false,storageFailed=false;
function read():WorkspaceEnvelope{if(storageFailed)return fallback;try{const raw=localStorage.getItem(key);if(raw){const value=JSON.parse(raw) as WorkspaceEnvelope;if(!validateBackup(value.state)&&Number.isSafeInteger(value.revision))return value;}}catch{storageFailed=true;}return fallback;}
function write(value:WorkspaceEnvelope){fallback=value;try{if(!storageFailed)localStorage.setItem(key,JSON.stringify(value));}catch{storageFailed=true;}}
const session=new WorkspaceSession(async(_url,init)=>{
  if(init?.method!=='POST')return Response.json(read());
  const saved=read(),action=JSON.parse(String(init.body));
  if(action.revision!==saved.revision)return Response.json({error:'Another preview tab changed this case. Reload the saved work.',conflict:true},{status:409});
  try{const now=new Date().toISOString(),state=applyCommand(saved.state,action.command as Command,now),error=validateBackup(state);if(error)throw new Error(error);
    const next={state,revision:saved.revision+1,updatedAt:now};write(next);
    if(fault){fault=false;throw new Error('PREVIEW_DROP_ACK');}return Response.json(next);
  }catch(error){if((error as Error).message==='PREVIEW_DROP_ACK')throw error;return Response.json({error:(error as Error).message},{status:400});}
});
let desktop:DesktopHandle;let reportingMonth='2025-07',lastActiveMonth='';
function model():DesktopModel{const s=session.getSnapshot(),company=companyForState(s.state),active=s.state.career?.activeMonth??'2025-12';if(lastActiveMonth!==active){reportingMonth=active;lastActiveMonth=active;}return {company,state:s.state,journals:journalsFor(company,s.state),displayName:'Finance team',saving:s.saving,saveStatus:storageFailed&&!s.error&&!s.saving?'Preview memory only':workspaceStatus(s),error:s.error,generation:s.generation,reportingMonth};}
let selectedSource='';
const send=async(command:Command)=>{const result=await session.save(command);desktop.update(model());return result.ok;};
const renderLocal=createLocalAccounting({activateMonth:()=>{reportingMonth=model().state.career?.activeMonth??reportingMonth;},model,send,desktop:()=>desktop,source:()=>selectedSource,setSource:id=>{selectedSource=id;}});
const app=(view:string,target:HTMLElement)=>{renderLocal(view,target);const label=target.parentElement?.querySelector('[data-action="classic"] span');if(label)label.textContent='Finance desk';};
async function start(){
  await session.load();
  desktop=mountFinanceDesktop(document.getElementById('desktop')!,model(),{
    send,app,hasUnsavedForms:()=>renderLocal.hasUnsaved(),closeApp:()=>{},
    captureInvoice:id=>{selectedSource=id;const doc=model().company.documents.find(d=>d.id===id);desktop.openApp(doc?.kind==='Sales invoice'||doc?.kind==='Credit note'?'receivables':'payables');},prepareJournal:id=>{selectedSource=id;desktop.openApp('ledger');},
    classic:()=>{desktop.openApp('career');},
    reload:()=>{void session.load();},setMonth:month=>{reportingMonth=month;desktop.update(model());},
  });
  session.subscribe(()=>desktop.update(model()));
  // Explicit test hooks in this preview fixture only; no corresponding production global or route.
  Object.assign(window,{ledgerlabPreview:{session,desktop,model,read,reset:()=>{write(initial());return session.load();},dropNextAcknowledgement:()=>{fault=true;},external:(command:Command)=>{const old=read();write({state:applyCommand(old.state,command),revision:old.revision+1,updatedAt:new Date().toISOString()});},selectedSource:()=>selectedSource}});
}
void start().catch(error=>{document.body.textContent=`Preview could not load: ${(error as Error).message}`;});
