import {LocalWorkspaceStore,LocalStoreError,LOCAL_WORKSPACE_KEY} from '../../lib/workspace/local-store';
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
const key=LOCAL_WORKSPACE_KEY;
const seed=()=>applyCommand(initialState(271828),{type:'startCareer',seed:271828,startMonth:'2025-07',role:'financial-manager',scenario:'messy',daily:true,confirmation:'START TAKEOVER'},'2026-09-07T09:00:00.000Z');
const initial=():WorkspaceEnvelope=>({state:seed(),revision:0,updatedAt:'2026-09-07T09:00:00.000Z'});
const store=new LocalWorkspaceStore(()=>localStorage,initial());
let fault=false,externalChange=false;
const read=()=>store.read();
const write=(value:WorkspaceEnvelope)=>store.write(value);
const transport:ConstructorParameters<typeof WorkspaceSession>[0]=async(_url,init)=>{
  if(init?.method!=='POST')return Response.json(read());
  const saved=read(),action=JSON.parse(String(init.body));
  if(action.revision!==saved.revision)return Response.json({error:'Another preview tab changed this case. Reload the saved work.',conflict:true},{status:409});
  try{const now=new Date().toISOString(),state=applyCommand(saved.state,action.command as Command,now),error=validateBackup(state);if(error)throw new Error(error);
    const next={state,revision:saved.revision+1,updatedAt:now};write(next);
    if(fault){fault=false;throw new Error('PREVIEW_DROP_ACK');}return Response.json(next);
  }catch(error){if((error as Error).message==='PREVIEW_DROP_ACK')throw error;return Response.json({error:(error as Error).message},{status:error instanceof LocalStoreError&&error.kind==='conflict'?409:400});}
};
const session=new WorkspaceSession((url,init)=>init?.method==='POST'&&store.mode==='browser'&&navigator.locks
  ?navigator.locks.request(key,()=>transport(url,init)):transport(url,init));
let desktop:DesktopHandle;let reportingMonth='2025-07',lastActiveMonth='';
function model():DesktopModel{const s=session.getSnapshot(),company=companyForState(s.state),active=s.state.career?.activeMonth??'2025-12';if(lastActiveMonth!==active){reportingMonth=active;lastActiveMonth=active;}return {company,state:s.state,journals:journalsFor(company,s.state),displayName:'Finance team',saving:s.saving,saveStatus:store.mode==='memory'&&!s.error&&!s.saving?'Preview memory only':workspaceStatus(s),error:s.error,generation:s.generation,reportingMonth,storageMode:store.mode,storageNotice:externalChange?'Another tab changed the saved workspace. Save or download your drafts, then reload before continuing.':''};}
let selectedSource='';
const send=async(command:Command)=>{const result=await session.save(command);desktop.update(model());return result.ok;};
const renderLocal=createLocalAccounting({activateMonth:()=>{reportingMonth=model().state.career?.activeMonth??reportingMonth;},model,send,desktop:()=>desktop,source:()=>selectedSource,setSource:id=>{selectedSource=id;}});
const app=(view:string,target:HTMLElement)=>{renderLocal(view,target);const label=target.parentElement?.querySelector('[data-action="classic"] span');if(label)label.textContent='Finance desk';};
async function start(){
  const loaded=await session.load();if(!loaded.ok){showRecovery();return;}
  desktop=mountFinanceDesktop(document.getElementById('desktop')!,model(),{
    send,app,hasUnsavedForms:()=>renderLocal.hasUnsaved(),closeApp:()=>{},
    captureInvoice:id=>{selectedSource=id;const doc=model().company.documents.find(d=>d.id===id);desktop.openApp(doc?.kind==='Sales invoice'||doc?.kind==='Credit note'?'receivables':'payables');},prepareJournal:id=>{selectedSource=id;desktop.openApp('ledger');},
    classic:()=>{desktop.openApp('career');},
    reload:()=>{void session.load().then(result=>{if(result.ok)externalChange=false;desktop.update(model());});},setMonth:month=>{reportingMonth=month;desktop.update(model());},
  });
  session.subscribe(()=>desktop.update(model()));
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null){externalChange=true;desktop.update(model());}});
  // Explicit test hooks in this preview fixture only; no corresponding production global or route.
  Object.assign(window,{ledgerlabPreview:{session,desktop,model,read,reset:()=>{write(initial());return session.load();},dropNextAcknowledgement:()=>{fault=true;},external:(command:Command)=>{const old=read();write({state:applyCommand(old.state,command),revision:old.revision+1,updatedAt:new Date().toISOString()});},selectedSource:()=>selectedSource}});
}
function showRecovery(){
 const host=document.getElementById('desktop')!;
 host.innerHTML=`<main class="pc-recovery"><span class="day-kicker">LEDGERLAB · SAVE RECOVERY</span><h1>Your saved work needs attention</h1><p role="alert">${e(session.getSnapshot().error)}</p><p>No new case has replaced the existing data. Keep a copy of the stored text before restoring a backup.</p><button type="button" data-recover-download>Download stored data for recovery</button><label>Restore a LedgerLab backup<input type="file" accept=".json,application/json" data-recover-file></label><label>Type REPLACE SAVED DATA to confirm<input data-recover-confirm autocomplete="off"></label><button type="button" data-recover-restore>Restore selected backup</button><button type="button" data-recover-new>Start a fresh case instead</button><p data-recover-status role="status"></p></main>`;
 let backup:unknown;
 const status=host.querySelector<HTMLElement>('[data-recover-status]')!;
 host.querySelector<HTMLInputElement>('[data-recover-file]')!.addEventListener('change',async event=>{
  backup=undefined;const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;
  try{if(file.size>3_000_000)throw Error('Backup is too large.');const data=JSON.parse(await file.text());backup=data.state??data;const invalid=validateBackup(backup as WorkspaceEnvelope['state']);if(invalid)throw Error(invalid);status.textContent='Backup validated. Confirm replacement to restore it.';}catch(error){backup=undefined;status.textContent=(error as Error).message;}
 });
 host.addEventListener('click',async event=>{
  const el=(event.target as Element).closest<HTMLElement>('button');if(!el)return;
  if(el.hasAttribute('data-recover-download')){const raw=store.recoveryText();if(raw!==null)downloadFile('LedgerLab-storage-recovery.txt',raw);else status.textContent='No stored text could be read.';return;}
  try{
   const confirmation=host.querySelector<HTMLInputElement>('[data-recover-confirm]')!.value;
   let value=initial();
   if(el.hasAttribute('data-recover-restore')){if(!backup)throw Error('Select a valid backup first.');value={state:backup as WorkspaceEnvelope['state'],revision:0,updatedAt:new Date().toISOString()};}
   else if(!el.hasAttribute('data-recover-new'))return;
   store.recover(value,confirmation);await start();
  }catch(error){status.textContent=(error as Error).message;}
 });
}
void start().catch(error=>{document.body.textContent=`Preview could not load: ${(error as Error).message}`;});
