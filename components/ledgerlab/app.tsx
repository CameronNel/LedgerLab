'use client';
import {WORKSPACE_SECTIONS,WORKSPACE_APPS} from '@/lib/workspace/app-registry';
import {useState,useEffect,useMemo,useCallback,useSyncExternalStore,useRef} from 'react';
import {Monitor,LayoutDashboard,BookOpen,Files,ReceiptText,Landmark,Users,Package,Building2,Scale,Calculator,ChartNoAxesCombined,ShieldCheck,GraduationCap,Settings,ChevronRight,Check,Cloud,RefreshCw,AlertCircle,WalletCards,ListChecks} from 'lucide-react';
import {Sidebar,SidebarProvider,SidebarContent,SidebarHeader,SidebarGroup,SidebarGroupLabel,SidebarMenu,SidebarMenuItem,SidebarMenuButton,SidebarFooter,SidebarTrigger,useSidebar} from '@/components/ui/sidebar';
import {TooltipProvider} from '@/components/ui/tooltip';
import {Toaster,toast} from 'sonner';
import {WorkspaceContext,type JournalDraft} from './context';
import {FinanceDesktopView} from './desktop/desktop';
import type {DesktopHandle} from '@/lib/desktop/shell';
import type {DesktopModel} from '@/lib/desktop/files';
import {InvoiceForm} from './invoice-form';
import {WorkspaceSession,workspaceStatus} from '@/lib/workspace/session';
import {Button,SelectField,Completion} from './shared';
import {companyForState} from '@/lib/accounting/career';
import {CareerView,CareerCloseView} from './career';
import {Callout} from './shared';
import {journalsFor,progress} from '@/lib/accounting/engine';
import type {Command,Journal} from '@/lib/accounting/types';
import {Overview,PracticeView,DocumentsView,LedgerView} from './core-views';
import {SubledgerView,BankView} from './reconciliation-views';
import {PayrollView,AssetsView,InventoryView} from './schedule-views';
import {TaxView,ProvisionsView} from './tax-provisions';
import {ReportsView} from './reports';
import {CloseView,AuditView} from './close-audit';
import {KnowledgeView} from './knowledge';
import {SettingsView} from './settings';
import {JournalForm,DocumentPreview,ExerciseSheet,JournalPreview} from './dialogs';
const NAV_ICONS={Monitor,LayoutDashboard,BookOpen,Files,ReceiptText,Landmark,Users,Package,Building2,Scale,Calculator,ChartNoAxesCombined,ShieldCheck,GraduationCap,Settings,WalletCards,ListChecks};
const NAV=WORKSPACE_SECTIONS.map(section=>({group:section.name,items:WORKSPACE_APPS.filter(app=>app.section===section.id).map(app=>({id:app.id,title:app.name,icon:NAV_ICONS[app.icon as keyof typeof NAV_ICONS]??BookOpen}))}));
const validViews=new Set(NAV.flatMap(n=>n.items.map(i=>i.id)));
function Navigation({view,go,complete,total,period}:{view:string;go:(v:string)=>void;complete:number;total:number;period:string}){const {isMobile,setOpenMobile}=useSidebar();const active=NAV.find(g=>g.items.some(i=>i.id===view))?.group??'Today';const [expanded,setExpanded]=useState(active);useEffect(()=>setExpanded(active),[active]);return <Sidebar className="app-sidebar" collapsible="offcanvas"><SidebarHeader className="p-0"><div className="brand-lockup"><div className="brand-mark"><BookOpen size={23} strokeWidth={1.7}/></div><div className="brand-word">Ledger<span>Lab</span></div></div><div className="company-switch"><span className="company-monogram">H&C</span><div><strong>Harbour & Co.</strong><small>Accounting practice company</small></div></div></SidebarHeader><SidebarContent>{NAV.map(group=><SidebarGroup key={group.group}><button className="workspace-section-toggle" aria-expanded={expanded===group.group} onClick={()=>setExpanded(expanded===group.group?'':group.group)}>{group.group}<ChevronRight size={14}/></button><div hidden={expanded!==group.group}><SidebarMenu>{group.items.map(item=><SidebarMenuItem key={item.id}><SidebarMenuButton isActive={view===item.id} onClick={()=>{go(item.id);if(isMobile)setOpenMobile(false);}}><item.icon/><span>{item.title}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></div></SidebarGroup>)}</SidebarContent><SidebarFooter className="p-0"><div className="sidebar-bottom"><strong>{period}</strong><Completion done={complete} total={total}/><span>Build skill through doing.</span></div></SidebarFooter></Sidebar>;}
export function WorkspaceApp({displayName}:{displayName:string}) {
 const [session] = useState(() => new WorkspaceSession((url, init) => fetch(url, init)));
 const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot);
 const {state,loaded,saving,loading,error,generation,notebook} = snapshot;
 const desktopRef=useRef<DesktopHandle|null>(null),viewRef=useRef('desktop');
 const [view,setView]=useState('desktop'),[month,setMonth]=useState('2025-12');
 const [journalDraft,setJournalDraft]=useState<JournalDraft|null>(null),[documentId,setDocumentId]=useState<string|null>(null);
 const [invoiceId,setInvoiceId]=useState<string|null>(null);
 const [exerciseId,setExerciseId]=useState<string|null>(null),[journal,setJournal]=useState<Journal|null>(null);
 const company=useMemo(()=>companyForState(state),[state.seed,state.career?.startMonth,state.career?.activeMonth,state.career?.scenario,state.career?.role,state.workday?.today]);
 const journals=useMemo(()=>journalsFor(company,state),[company,state]);
 const p=useMemo(()=>progress(company,state),[company,state]);
 const load=useCallback(async()=>{
   const result=await session.load();
   if(!result.ok&&result.busy)toast.info(result.error);
 },[session]);
 useEffect(()=>{void session.load();},[session]);
 useEffect(()=>{if(state.career){setMonth(state.career.activeMonth);setJournalDraft(null);setDocumentId(null);setExerciseId(null);setJournal(null);setInvoiceId(null);}},[state.career?.activeMonth,state.career?.startedAt]);
 useEffect(()=>{
   const hash=()=>{const requested=window.location.hash.slice(1).split('?')[0],next=validViews.has(requested)?requested:'desktop';
     if(viewRef.current==='desktop'&&next!=='desktop'&&desktopRef.current&&!desktopRef.current.canLeave()){window.history.replaceState(null,'','#desktop');return;}
     viewRef.current=next;setView(next);};
   hash();window.addEventListener('hashchange',hash);
   return()=>window.removeEventListener('hashchange',hash);
 },[]);
 useEffect(()=>{
   setJournalDraft(null);setDocumentId(null);setExerciseId(null);setJournal(null);setInvoiceId(null);
 },[generation]);
 useEffect(()=>{
   if(notebook.text===notebook.remote)return;
   const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
   window.addEventListener('beforeunload',warn);
   return()=>window.removeEventListener('beforeunload',warn);
 },[notebook.text,notebook.remote]);
 const navigate=useCallback((v:string)=>{
   if(!validViews.has(v))return;
   viewRef.current=v;setView(v);window.location.hash=v;window.scrollTo({top:0,behavior:'instant'});
 },[]);
 const go=useCallback((v:string)=>{
   if(view==='desktop'&&v!=='desktop'){desktopRef.current?.openApp(v);return;}
   navigate(v);
 },[view,navigate]);
 async function send(command:Command):Promise<boolean>{
   if(['startCareer','newCase','importBackup'].includes(command.type)&&desktopRef.current&&!desktopRef.current.canLeave())return false;
   const result=await session.save(command);
   if(!result.ok){
     if(result.busy)toast.info(result.error);else toast.error(result.error,{duration:7000});
     return false;
   }
   const messages:Partial<Record<Command['type'],string>>={saveDesktopFile:'Working file saved.',trashDesktopFile:'Learner file moved to the recycle bin.',restoreDesktopFile:'Learner file restored.',startCareer:'Takeover started. Your first month is ready.',captureSourceInvoice:'Source invoice captured.',saveCareerSubmission:'Role deliverable saved.',saveCareerForecast:'Cash forecast saved.',closeCareerMonth:'Takeover month closed.',advanceCareerMonth:'Next month released.',reopenCareerMonth:'Latest month reopened.',postJournal:'Journal posted.',postDocument:'Invoice and journal created.',reverseJournal:'Reversal posted.',reverseJournalBatch:'Reversal batch posted.',saveJournalTemplate:'Reusable journal template saved.',deleteJournalTemplate:'Journal template removed.',applySolution:'Worked answer posted. This exercise is marked as assisted.',saveWorkpaper:'Workpaper saved.',saveBalanceReconciliation:'Balance reconciliation saved.',saveDisclosure:'Financial statement assessment saved.',saveEvidenceRequest:'Evidence request updated.',saveNotes:'Notebook saved.',lockPeriod:'Period status updated.',newCase:'New practice case generated.',importBackup:'Practice backup restored.',matchBank:'Bank transaction matched.',allocateCredit:'Credit allocated. The control balance is unchanged.',removeAllocation:'Allocation removed.'};
   if(messages[command.type])toast.success(messages[command.type]);
   return true;
 }
 const context={company,state,journals,saving:saving||loading,loaded,send,go,view,month,setMonth,
   openJournal:(d:JournalDraft={})=>setJournalDraft(d),openDocument:(id:string)=>{if(view==='desktop')desktopRef.current?.openDocument(id);else setDocumentId(id);},
   openExercise:(id:string)=>{if(company.exercises.some(e=>e.id===id)){setExerciseId(id);return;}if(state.career){const source:Record<string,string>={'EX-PAYROLL':`PAY-${month}`,'EX-LEAVE':'LEAVE-REPORT','EX-LEASE':'LEASE-2025','EX-DEPRECIATION':`FA-REGISTER-${state.career.activeMonth}`,'EX-STOCK':'COUNT-2025','EX-NRV':'COUNT-2025','EX-LOAN':'LOAN-AGREEMENT'};const task=company.exercises.find(e=>e.expected.some(j=>j.date.startsWith(state.career!.activeMonth)&&j.sourceId===source[id]));if(task){setExerciseId(task.id);return;}go('career');return;}toast.error('This exercise is not available in the current case.');},inspectJournal:(j:Journal)=>setJournal(j),reload:load,
   notebook,editNotebook:session.editNotebook,resolveNotebook:session.resolveNotebook};
 function content(screen=view){switch(screen){case 'career':return <CareerView/>;case 'practice':return <PracticeView/>;case 'documents':return <DocumentsView/>;case 'ledger':return <LedgerView/>;case 'receivables':return <SubledgerView kind="customer"/>;case 'payables':return <SubledgerView kind="supplier"/>;case 'bank':return <BankView/>;case 'payroll':return <PayrollView/>;case 'close':return state.career?<CareerCloseView/>:<CloseView/>;case 'assets':return <AssetsView/>;case 'inventory':return <InventoryView/>;case 'provisions':return state.career&&state.career.activeMonth!=='2025-12'?<><Callout>The year-end ECL, legal, warranty and leave-estimate evidence has not been released. Process monthly claim settlements and maintain the inherited balances; reassess when new evidence arrives.</Callout><Button onClick={()=>go('career')}>Open finance desk</Button></>:<ProvisionsView/>;case 'tax':return state.career&&state.career.activeMonth!=='2025-12'?<><Callout>Annual income-tax and deferred-tax work opens with the December evidence. Monthly GST transfers, settlements and tax instalments are processed from this month’s source queue.</Callout><Button onClick={()=>go('career')}>Open finance desk</Button></>:<TaxView/>;case 'reports':return <ReportsView/>;case 'audit':return <AuditView/>;case 'knowledge':return <KnowledgeView/>;case 'settings':return <SettingsView/>;default:return state.career?<CareerView/>:<Overview/>;}}
 function readDesktopModel():DesktopModel{const current=session.getSnapshot(),co=companyForState(current.state);return {company:co,state:current.state,journals:journalsFor(co,current.state),displayName,saving:current.saving||current.loading,saveStatus:workspaceStatus(current),error:current.error,generation:current.generation,reportingMonth:month};}
 const desktopModel:DesktopModel={company,state,journals,displayName,saving:saving||loading,saveStatus:workspaceStatus(snapshot),error,generation,reportingMonth:month};
 return <WorkspaceContext.Provider value={context}><TooltipProvider>
   {view==='desktop'?(loaded?<FinanceDesktopView ref={desktopRef} model={desktopModel} readModel={readDesktopModel} context={context} renderView={content}
     onClassic={()=>navigate(state.career?'career':'overview')}
     onCaptureInvoice={id=>setInvoiceId(id)}
     onPrepareJournal={id=>{const d=[...company.documents,...state.customDocuments].find(d=>d.id===id);if(d)setJournalDraft({sourceId:id,description:d.title,date:state.career&&d.date<`${state.career.activeMonth}-01`?`${state.career.activeMonth}-01`:d.date});}}/>
     :<main className="workspace-content"><section className="panel padded" role="status"><h1>{error?'Saved workspace unavailable':'Loading your finance PC…'}</h1><p>{error||'Your saved company files and practice work will appear here.'}</p>{error&&<Button onClick={load} disabled={loading}>Reload saved work</Button>}</section></main>):(
   <SidebarProvider style={{'--sidebar-width':'250px'} as React.CSSProperties}>
     <Navigation view={view} go={go} complete={p.completed} total={p.total} period={state.career?`${state.career.activeMonth} takeover`:'December close'}/>
     <main className="workspace-main">
       <header className="topbar"><div className="topbar-left">
         <SidebarTrigger aria-label="Toggle navigation" className="md:hidden"/>
         <div className="breadcrumb"><span>Harbour & Co.</span><ChevronRight size={14}/>
           <strong>{NAV.flatMap(n=>n.items).find(i=>i.id===view)?.title}</strong></div>
       </div><div className="topbar-right">
         <span className="save-status" role="status" aria-live="polite" data-problem={!!error}>
           {saving||loading?<Cloud size={14}/>:error?<AlertCircle size={14}/>:<Check size={14}/>} {workspaceStatus(snapshot)}
         </span>
         <SelectField label="Reporting month" value={month} onChange={setMonth} options={Array.from({length:state.career?Number(state.career.activeMonth.slice(-2)):12},(_,i)=>({value:`2025-${String(i+1).padStart(2,'0')}`,label:new Date(Date.UTC(2025,i,15)).toLocaleDateString('en-GB',{month:'long',year:'numeric'})}))}/>
         <span className="avatar" title={displayName}>{displayName.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()}</span>
       </div></header>
       {(loading||saving)&&<div className="loading-bar"/>}
       {error&&<div className="alert-bar" role="alert"><span>{error}</span>
         <Button variant="outline" onClick={load} disabled={saving||loading}><RefreshCw size={15}/>Reload saved work</Button>
       </div>}
       <div className="workspace-content" key={`${view}-${generation}`} aria-busy={loading}>
         {loaded?content():<section className="panel padded" role="status">
           <h1>{error?'Saved workspace unavailable':'Loading your saved practice…'}</h1>
           <p>{error?'Use Reload saved work to try again. No blank case has replaced your saved work.':'Your journal, notebook and case settings will appear after your saved workspace loads.'}</p>
         </section>}
       </div>
     </main>
   </SidebarProvider>)}
   {loaded&&exerciseId&&<ExerciseSheet key={exerciseId} exerciseId={exerciseId} onClose={()=>setExerciseId(null)}/>}
   {loaded&&journalDraft&&<JournalForm draft={journalDraft} onClose={()=>setJournalDraft(null)}/>}
   {loaded&&journal&&<JournalPreview journal={journal} onClose={()=>setJournal(null)}/>}
   {loaded&&documentId&&<DocumentPreview documentId={documentId} onClose={()=>setDocumentId(null)}/>}
   {loaded&&invoiceId&&<InvoiceForm key={invoiceId} source={[...company.documents,...state.customDocuments].find(d=>d.id===invoiceId)} onClose={()=>setInvoiceId(null)}/>}
   <Toaster position="bottom-right" richColors closeButton/>
 </TooltipProvider></WorkspaceContext.Provider>;
}
