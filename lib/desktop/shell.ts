import {mountHealthDesk} from './health-desk';
import {mountMailDesk,type MailDeskHandle} from './mail-desk';
import {icon} from './icons';
import {WORKSPACE_SECTIONS,WORKSTATION_VERSION,appById,type WorkspaceSection} from '../workspace/app-registry';
import {workspaceMenuHTML} from './workspace-menu';
import {workspaceSearchIndex,type SearchResult} from './search-index';
import {openCommandPalette} from './command-palette';
import {inspectionHTML} from './inspection';
import {mountReviewDesk,type ReviewDeskHandle} from './review-desk';
import type {DayTask} from '../accounting/workday-types';
/** Framework-independent desktop. React mounts the existing accounting views into its app window. */
import {mountDayDesk,type DayDeskHandle} from './day-desk';
import type {Command} from '../accounting/types';
import {downloadFile,csv,htmlEscape as e} from '../accounting/exports';
import {DESKTOP_LIMITS,desktopFileError,newDesktopId,type DesktopUserFile} from './types';
import {evaluateWorkbook} from './worksheet';
import {workbookXLSX,importXLSX} from './workbook-io';
import {ensureWorkbook,syncWorkbook,parseDelimited} from './workbook-model';
import {mountSpreadsheet,type SpreadsheetHandle} from './spreadsheet';
import {desktopDialog} from './dialog';
import {type DesktopModel,type VirtualFile,virtualFiles,virtualFolders,sourceDocuments,scenarioMail,currentMonth,monthLabel,
  FINANCE_APPS,filePayload,readNote,createWorkingFile,uniqueFileName,csvPreview,csvTableHTML,safeDocumentHTML,safeFilename} from './files';
export type DesktopCallbacks = {
  send:(command:Command)=>Promise<boolean>;
  app:(view:string,target:HTMLElement)=>void;
  closeApp:()=>void;
  captureInvoice:(sourceId:string)=>void;
  prepareJournal:(sourceId:string)=>void;
  classic:()=>void;
  reload:()=>void;
  hasUnsavedForms?:()=>boolean;
  setMonth?:(month:string)=>void;
};
export type DesktopHandle = {
  update:(model:DesktopModel)=>void; openApp:(view:string,focusTask?:string)=>void; openDocument:(id:string)=>void;
  openFile:(id:string)=>void; openExplorer:(path?:string,fresh?:boolean)=>void; newWorkbook:(template?:string)=>void;
  openDaily:(taskId?:string,calendar?:boolean)=>void; openMail:(id?:string)=>void;
  canLeave:()=>boolean; hasUnsaved:()=>boolean; destroy:()=>void;
};
type EditorState={draft:DesktopUserFile;base:string|null;dirty:boolean;pending:boolean;orphan:boolean;active:[number,number]};
type WindowRecord={id:string;title:string;icon:string;el:HTMLElement;body:HTMLElement;x:number;y:number;width:number;height:number;max:boolean;min:boolean;kind:string;
  mail?:MailDeskHandle;daily?:DayDeskHandle;review?:ReviewDeskHandle;refresh?:()=>void;editor?:EditorState;sheet?:SpreadsheetHandle;closing?:boolean;save?:()=>Promise<void>;dispose?:()=>void;view?:string;path?:string;browse?:(path:string)=>void};
const button=(action:string,label:string,symbol='',extra='')=>`<button type="button" data-action="${action}" ${extra}>${symbol?icon(symbol):''}<span>${e(label)}</span></button>`;
const fileIcon=(file:VirtualFile)=>file.kind==='workbook'||file.kind==='csv'||file.kind==='template'?'sheet':file.kind==='mail'?'mail':file.kind==='note'?'note':'file';
export function mountFinanceDesktop(host:HTMLElement,initial:DesktopModel,callbacks:DesktopCallbacks):DesktopHandle {
  return new FinanceDesktop(host,initial,callbacks);
}
class FinanceDesktop implements DesktopHandle {
  private model:DesktopModel;
  private files:VirtualFile[]=[];
  private folders:string[]=[];
  private windows=new Map<string,WindowRecord>();
  private active='';private counter=0;private stage:HTMLElement;private taskbar:HTMLElement;private menu:HTMLElement;private toast:HTMLElement;
  private closeSearch:(()=>void)|undefined;
  private dead=false;private observer:ResizeObserver;private toastTimer:ReturnType<typeof setTimeout>|undefined;
  constructor(private host:HTMLElement,model:DesktopModel,private callbacks:DesktopCallbacks){
    this.model=model;this.refreshIndex();host.classList.add('finance-pc');
    host.innerHTML=`<nav class="pc-navigation" aria-label="Workspace sections"><strong>LedgerLab <small>v${WORKSTATION_VERSION}</small></strong>${WORKSPACE_SECTIONS.map(s=>`<button type="button" data-section="${s.id}">${e(s.name)}</button>`).join('')}<button type="button" data-action="global-search" class="pc-global-search" aria-label="Search LedgerLab (Control or Command K)">Search <kbd>Ctrl K</kbd></button></nav><div class="pc-storage-banner" role="status" hidden></div><div class="pc-stage"><div class="pc-wallpaper" aria-hidden="true"><div class="pc-orbit one"></div><div class="pc-orbit two"></div></div>
      <div class="pc-desktop-heading"><span class="pc-eyebrow">HARBOUR & CO.</span><h1>Your finance workstation.</h1><p>A new role. The same company files. Your month to own.</p></div>
      <nav class="pc-shortcuts" aria-label="Desktop shortcuts"></nav>
      <aside class="pc-welcome"><span class="pc-eyebrow">YOUR DESK</span><h2></h2><p></p><div>${button('current','Open current month','folder')}${button('career','Open Today','app')}</div><small>Fictional training workspace · AUD 2025</small></aside>
      <div class="pc-windows" aria-label="Open desktop windows"></div><div class="pc-save-error" role="alert" hidden></div></div>
      <nav class="pc-taskbar" aria-label="Taskbar"></nav><section class="pc-start" aria-label="Start menu" hidden></section>
      <div class="pc-toast" role="status" aria-live="polite" hidden></div>`;
    this.stage=host.querySelector('.pc-stage')!;this.taskbar=host.querySelector('.pc-taskbar')!;this.menu=host.querySelector('.pc-start')!;this.toast=host.querySelector('.pc-toast')!;
    host.addEventListener('keydown',this.backupKey,true);host.addEventListener('click',this.globalClick);host.addEventListener('keydown',this.globalKey);
    window.addEventListener('beforeunload',this.beforeUnload);
    this.observer=new ResizeObserver(()=>{for(const w of this.windows.values())this.place(w);});this.observer.observe(this.stage);
    this.paintDesktop();this.openWorkbench();
  }
  private refreshIndex(){this.files=virtualFiles(this.model);this.folders=virtualFolders(this.files,currentMonth(this.model));}
  update=(model:DesktopModel)=>{
    if(this.dead)return;
    const replaced=model.generation!==this.model.generation||model.state.seed!==this.model.state.seed||model.state.career?.startedAt!==this.model.state.career?.startedAt;
    const dailyChanged=!!model.state.workday!==!!this.model.state.workday;
    const changed=model.state!==this.model.state;this.model=model;
    if(dailyChanged){const old=this.windows.get('workbench');if(old&&!old.daily?.hasUnsaved())this.removeWindow(old);}
    if(changed){this.refreshIndex();this.closeSearch?.();this.closeSearch=undefined;}
    if(replaced){
      for(const w of [...this.windows.values()]){
        if(w.daily?.hasUnsaved()||w.review?.hasUnsaved()){w.refresh?.();}
        else if(w.editor&&(w.editor.dirty||w.sheet?.hasPendingEdit())){w.sheet?.flush();w.editor.orphan=true;w.editor.pending=false;w.refresh?.();}
        else this.removeWindow(w);
      }
      this.openExplorer(`Finance/${currentMonth(model)}`);
      if(this.hasUnsaved())this.notify('The case changed. Your unsaved drafts remain open for download or an explicit Save copy.');
    }else {for(const w of this.windows.values())if(changed||w.editor||w.kind==='app')w.refresh?.();}
    this.paintDesktop();if(dailyChanged)this.openWorkbench();
  };
  private paintDesktop(){
    const month=currentMonth(this.model),shortcuts=[['drive','Finance drive','folder'],['current','Current month','folder'],['mail','Mail','mail'],['career',this.model.state.workday?'Today':'Start here','app'],['work','Working papers','sheet'],['handover','Handover','note'],['trash','Recycle bin','trash']];
    this.host.querySelector('.pc-shortcuts')!.innerHTML=shortcuts.map(([a,l,i])=>`<button type="button" data-action="${a}"><span class="pc-shortcut-icon pc-${i}">${icon(i)}</span><span>${l}</span></button>`).join('');
    const welcome=this.host.querySelector('.pc-welcome')!;welcome.querySelector('h2')!.textContent=monthLabel(month);
    welcome.querySelector('p')!.textContent=this.model.state.career?`${this.model.state.career.role==='financial-manager'?'Financial manager':'Financial accountant'} · ${this.model.state.career.scenario} handover. Released evidence only.`:'Open Finance desk to choose your takeover month, role and handover. Your existing practice work is preserved.';
    const error=this.host.querySelector<HTMLElement>('.pc-save-error')!;error.hidden=!this.model.error;
    error.innerHTML=this.model.error?`<strong>Saved workspace needs attention</strong><p>${e(this.model.error)}</p>${button('reload','Reload saved work','refresh')}`:'';
    const storage=this.host.querySelector<HTMLElement>('.pc-storage-banner')!;
    const warning=this.model.storageNotice||(this.model.storageMode==='memory'?'Memory-only session: closing this tab loses work. Export a backup to keep your saved entries.':'');
    storage.hidden=!warning;storage.innerHTML=warning?`<span>${e(warning)}</span>${button('backup-now','Backup saved work','download')}`:'';
    this.host.classList.toggle('pc-has-storage-warning',!!warning);
    this.paintTaskbar();
  }
  private paintTaskbar(){
    const active=this.windows.get(this.active);
    const section=active?.view?appById(active.view)?.section:active?.daily?'today':active?.kind==='reviews'||active?.kind==='health'?'close':active?.kind==='mail'?'today':active?.kind==='explorer'||active?.kind==='viewer'||active?.kind==='editor'?'files':undefined;
    this.host.querySelectorAll<HTMLElement>('[data-section]').forEach(el=>{if(el.dataset.section===section)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    this.taskbar.innerHTML=`<button type="button" class="pc-start-button" data-action="start" aria-label="Open Start menu" aria-expanded="${!this.menu.hidden}"><b>LL</b></button>
      <button type="button" data-action="drive" aria-label="Open Finance drive">${icon('folder')}</button><button type="button" data-action="mail" aria-label="Open scenario mail">${icon('mail')}</button><span class="pc-taskbar-divider"></span>
      <div class="pc-task-items">${[...this.windows.values()].map(w=>`<div class="pc-task-item" data-active="${this.active===w.id&&!w.min}"><button type="button" data-task="${e(w.id)}" data-active="${this.active===w.id&&!w.min}" aria-pressed="${this.active===w.id&&!w.min}" title="${e(w.title)}${w.min?' (minimized)':''}">${icon(w.icon)}<span>${e(w.title)}</span>${w.editor?.dirty?'<i aria-label="Unsaved draft"></i>':''}</button><button type="button" class="pc-task-close" data-close-task="${e(w.id)}" aria-label="Close tab ${e(w.title)}" title="Close ${e(w.title)}">×</button></div>`).join('')}</div>
      <button type="button" class="pc-tile-button" data-action="tile" title="Arrange windows side by side" aria-label="Arrange windows side by side">${icon('tile')}</button>
      <button type="button" class="pc-sync" data-action="reload" title="${e(this.model.error||this.model.saveStatus)}" data-error="${!!this.model.error}">${icon(this.model.error?'refresh':this.model.saving?'refresh':this.model.storageMode==='memory'?'download':'check')}<span role="status">${e(this.model.error?'Save needs attention':this.model.saveStatus)}</span></button>
      ${this.model.state.workday?`<button type="button" class="pc-period day-pc-clock" data-action="clock" aria-label="Change simulated PC date"><strong>${e(this.model.state.workday.today)}</strong><small>PC date · Change</small></button>`:`<div class="pc-period"><strong>${e(currentMonth(this.model))}</strong><small>Simulation period</small></div>`}<button type="button" class="pc-show-desktop" data-action="show-desktop" aria-label="Show desktop" title="Show desktop"></button>`;
  }
  private openStart(section?:WorkspaceSection){
    this.menu.hidden=section?false:!this.menu.hidden;
    if(!this.menu.hidden)this.menu.innerHTML=`<header><div><strong>${e(this.model.displayName)}</strong><small>LedgerLab v${WORKSTATION_VERSION} · ${e(currentMonth(this.model))}</small></div></header>${workspaceMenuHTML(section)}<footer>${button('classic','Classic navigation','list')}<span>Fictional practice workspace</span></footer>`;
    this.paintTaskbar();if(!this.menu.hidden)this.menu.querySelector<HTMLButtonElement>('button')?.focus();
  }
  private search(){
    this.closeSearch?.();
    this.closeSearch=openCommandPalette(this.host,workspaceSearchIndex(this.model),item=>this.activateSearch(item));
  }
  private activateSearch(item:SearchResult){
    if(item.kind==='app'){if(item.ref==='desktop')this.openWorkbench();else this.openApp(item.ref);return;}
    if(item.kind==='task'){this.openDaily(item.ref);return;}
    if(item.kind==='file'){this.openFile(item.ref);return;}
    const id='inspection-'+item.kind;
    if(!this.windows.has(id)&&!this.roomForWindow())return;
    const w=this.windows.get(id)??this.createWindow(id,'LedgerLab · read-only inspection','file','inspection',950,680);
    w.refresh=()=>{w.body.innerHTML=inspectionHTML(item,this.model);};
    if(!w.body.dataset.inspectionEvents){w.body.dataset.inspectionEvents='true';w.body.addEventListener('click',event=>{const source=(event.target as Element).closest<HTMLElement>('[data-inspect-source]');if(source)this.openDocument(source.dataset.inspectSource!);});}
    w.refresh();this.focus(w);
  }
  private backup(){
    downloadFile(`LedgerLab-backup-${currentMonth(this.model)}.json`,JSON.stringify({format:'LedgerLab backup',version:1,state:this.model.state},null,2),'application/json');
    this.notify(this.hasUnsaved()?'Backup contains saved work only. Save or separately download your open drafts.':'Backup export requested. Check that your browser retained the file.');
  }
  private openHealth(){
    const id='ledger-checks';if(!this.windows.has(id)&&!this.roomForWindow())return;
    const w=this.windows.get(id)??this.createWindow(id,'Ledger checks · actual saved work','check','health',1000,700);
    if(!w.refresh){const panel=mountHealthDesk(w.body,()=>this.model,(kind,ref)=>this.activateSearch({kind,ref,id:kind+':'+ref,title:ref,detail:'Read-only inspection',keywords:''}),view=>this.openApp(view));w.refresh=panel.refresh;}else w.refresh();this.focus(w);
  }
  private openReviews(){
    const id='review-notes';if(!this.windows.has(id)&&!this.roomForWindow())return;
    const w=this.windows.get(id)??this.createWindow(id,'Review notes · training workflow','check','reviews',1100,700);
    if(!w.review){w.review=mountReviewDesk(w.body,{model:()=>this.model,send:this.callbacks.send,openTask:id=>this.openDaily(id)});w.refresh=w.review.refresh;w.save=async()=>{await w.review!.saveDraft();};}
    this.focus(w);
  }
  private openPairedWork(task:DayTask){
    const source=task.sourceId??task.evidence.find(id=>this.model.company.documents.some(d=>d.id===id));
    if(!source){this.notify('No released source is attached. Open the assignment instructions instead.');return;}
    if(task.kind==='response')this.openDaily(task.id);
    else this.openApp(task.view,task.kind==='formal'?task.formalId:task.kind==='forecast'?'@forecast':undefined);
    this.openDocument(source);this.tile();
  }
  private globalClick=(event:MouseEvent)=>{
    const target=event.target as Element;
    const section=target.closest<HTMLElement>('[data-section]');
    if(section){const id=section.dataset.section as WorkspaceSection;if(id==='today')this.openWorkbench();else this.openStart(id);return;}
    const close=target.closest<HTMLElement>('[data-close-task]'),task=target.closest<HTMLElement>('[data-task]');
    if(close){event.preventDefault();event.stopPropagation();const w=this.windows.get(close.dataset.closeTask!);if(w)void this.requestClose(w);return;}
    if(task){const w=this.windows.get(task.dataset.task!);if(w){if(this.active===w.id&&!w.min)this.minimize(w);else this.focus(w);}return;}
    if(target.closest('.pc-window'))return;
    const app=target.closest<HTMLElement>('[data-app]');if(app){this.openApp(app.dataset.app!);this.menu.hidden=true;this.paintTaskbar();return;}
    const action=target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if(action!=='start'&&!target.closest('.pc-start'))this.menu.hidden=true;
    switch(action){case 'start':this.openStart();break;case 'drive':this.openExplorer('');break;case 'current':this.openExplorer(`Finance/${currentMonth(this.model)}`);break;
      case 'handover':this.openExplorer('Handover');break;case 'work':this.openExplorer(`Working papers/${currentMonth(this.model)}`);break;case 'mail':this.openMail();break;case 'trash':this.openExplorer('Recycle bin');break;
      case 'backup-now':this.backup();break;case 'ledger-checks':this.openHealth();break;case 'global-search':this.search();break;case 'review-notes':this.openReviews();break;case 'clock':this.openDaily(undefined,true);break;case 'career':this.openWorkbench();break;case 'new-note':this.newNote();break;case 'tile':this.tile();break;
      case 'show-desktop':{const open=[...this.windows.values()].filter(w=>!w.min);if(open.length)open.forEach(w=>this.minimize(w));else for(const w of this.windows.values())this.focus(w);break;}
      case 'classic':if(this.canLeave())this.callbacks.classic();break;case 'reload':this.callbacks.reload();break;
    }
  };
  private backupKey=(event:KeyboardEvent)=>{
    if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='s'&&!this.host.querySelector('dialog[open]')){event.preventDefault();event.stopPropagation();this.backup();}
  };
  private globalKey=(event:KeyboardEvent)=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();this.search();return;}
    if((event.ctrlKey||event.altKey)&&event.key==='F4'){event.preventDefault();const w=this.windows.get(this.active);if(w)void this.requestClose(w);return;}
    if(event.key==='Escape'&&!this.menu.hidden){this.menu.hidden=true;this.paintTaskbar();return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){
      const w=this.windows.get(this.active);if(w?.save){event.preventDefault();void w.save();}
    }
  };
  private notify(message:string){if(this.dead)return;this.toast.textContent=message;this.toast.hidden=false;clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>{if(!this.dead)this.toast.hidden=true;},6500);}
  private roomForWindow(){if(this.windows.size<12)return true;this.notify('Close an existing window before opening another (12-window limit).');return false;}
  private createWindow(id:string,title:string,symbol:string,kind:string,width=930,height=620):WindowRecord{
    const old=this.windows.get(id);if(old){this.focus(old);return old;}
    if(this.windows.size>=12){this.notify('Close an existing window before opening another (12-window limit).');throw new Error('Desktop window limit reached.');}
    const el=document.createElement('section');el.className='pc-window';el.setAttribute('role','region');el.setAttribute('aria-label',title);el.dataset.window=id;
    el.innerHTML=`<header class="pc-window-titlebar"><div class="pc-window-title">${icon(symbol)}<strong></strong></div><div class="pc-window-controls"><button type="button" data-window-action="min" aria-label="Minimize ${e(title)}">${icon('min')}</button><button type="button" data-window-action="max" aria-label="Maximize ${e(title)}">${icon('max')}</button><button type="button" data-window-action="close" aria-label="Close ${e(title)}">${icon('close')}</button></div></header><div class="pc-window-body"></div><button type="button" class="pc-resize" aria-label="Resize ${e(title)}; use arrow keys" title="Drag to resize; arrow keys also resize"><span></span></button>`;
    el.querySelector('strong')!.textContent=title;
    const stagger=(this.counter++%5)*26;
    const w:WindowRecord={id,title,icon:symbol,el,body:el.querySelector('.pc-window-body')!,x:155+stagger,y:40+stagger,width,height,max:false,min:false,kind};
    this.windows.set(id,w);this.host.querySelector('.pc-windows')!.append(el);
    el.addEventListener('pointerdown',()=>{if(this.active!==w.id)this.focus(w,false);});
    el.querySelector('.pc-window-controls')!.addEventListener('pointerdown',event=>event.stopPropagation());
    el.addEventListener('focusin',()=>{if(this.active!==w.id)this.focus(w,false);});
    el.querySelector('.pc-window-controls')!.addEventListener('click',event=>{
      const action=(event.target as Element).closest<HTMLElement>('[data-window-action]')?.dataset.windowAction;
      if(action==='min')this.minimize(w);else if(action==='max'){w.max=!w.max;this.place(w);this.focus(w);}else if(action==='close')this.requestClose(w);
    });
    const bar=el.querySelector<HTMLElement>('.pc-window-titlebar')!;
    bar.addEventListener('dblclick',event=>{if(!(event.target as Element).closest('button')){w.max=!w.max;this.place(w);}});
    this.installDrag(w,bar,false);const resize=el.querySelector<HTMLElement>('.pc-resize')!;this.installDrag(w,resize,true);
    resize.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();w.max=false;w.width+=event.key==='ArrowRight'?20:event.key==='ArrowLeft'?-20:0;w.height+=event.key==='ArrowDown'?20:event.key==='ArrowUp'?-20:0;this.place(w);}});
    this.place(w);this.focus(w);return w;
  }
  private installDrag(w:WindowRecord,handle:HTMLElement,resize:boolean){
    let drag:{pointer:number;x:number;y:number;wx:number;wy:number;width:number;height:number}|null=null;
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0||(!resize&&(event.target as Element).closest('button'))||w.max||this.stage.clientWidth<680)return;
      event.preventDefault();handle.setPointerCapture(event.pointerId);drag={pointer:event.pointerId,x:event.clientX,y:event.clientY,wx:w.x,wy:w.y,width:w.width,height:w.height};w.el.dataset.dragging='true';
    });
    handle.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.pointer)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(resize){w.width=drag.width+dx;w.height=drag.height+dy;}else{w.x=drag.wx+dx;w.y=drag.wy+dy;}this.place(w);
    });
    const end=()=>{drag=null;delete w.el.dataset.dragging;};handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);handle.addEventListener('lostpointercapture',end);
  }
  private place(w:WindowRecord){
    const width=this.stage.clientWidth,height=this.stage.clientHeight;if(!width||!height)return;
    const mobile=width<680;
    w.width=Math.min(Math.max(420,w.width),width-16);w.height=Math.min(Math.max(280,w.height),height-16);
    w.x=Math.max(8,Math.min(w.x,width-w.width-8));w.y=Math.max(8,Math.min(w.y,height-w.height-8));
    Object.assign(w.el.style,{left:`${w.max||mobile?8:w.x}px`,top:`${w.max||mobile?8:w.y}px`,width:`${w.max||mobile?width-16:w.width}px`,height:`${w.max||mobile?height-16:w.height}px`});
    w.el.dataset.maximized=String(w.max||mobile);
    const control=w.el.querySelector<HTMLButtonElement>('[data-window-action="max"]')!;control.innerHTML=icon(w.max?'restore':'max');control.setAttribute('aria-label',`${w.max?'Restore':'Maximize'} ${w.title}`);
  }
  private focus(w:WindowRecord,focusControl=false){
    w.min=false;w.el.hidden=false;this.active=w.id;
    const ordered=[...this.windows.values()].filter(x=>x!==w).sort((a,b)=>Number(a.el.style.zIndex)-Number(b.el.style.zIndex));ordered.push(w);
    ordered.forEach((item,i)=>{item.el.style.zIndex=String(i+1);item.el.dataset.active=String(item===w);});
    this.paintTaskbar();if(focusControl)(w.el.querySelector('button') as HTMLButtonElement)?.focus();
  }
  private minimize(w:WindowRecord){w.min=true;w.el.hidden=true;const next=[...this.windows.values()].filter(x=>!x.min).sort((a,b)=>Number(b.el.style.zIndex)-Number(a.el.style.zIndex))[0];if(next)this.focus(next);else{this.active='';this.paintTaskbar();}}
  private async requestClose(w:WindowRecord){
    if(w.closing)return;if(w.editor?.pending){this.notify('The file save is still in progress.');return;}
    w.sheet?.flush();
    if(w.daily?.hasUnsaved()||w.review?.hasUnsaved()){
      w.closing=true;this.focus(w);
      const choice=await desktopDialog(this.host,'Save your response before closing?','This assignment has an unsaved response.',[{id:'save',label:'Save draft & close',primary:true},{id:'discard',label:'Discard response',danger:true},{id:'cancel',label:'Cancel'}]);
      w.closing=false;if(choice==='cancel')return;
      if(choice==='save'&&!await (w.daily??w.review)!.saveDraft()){this.notify('Save failed. Your response is still open.');return;}
    }
    if(w.editor?.dirty){
      w.closing=true;this.focus(w);
      const choice=await desktopDialog(this.host,'Save changes before closing?',`“${w.editor.draft.name}” has unsaved changes.`,[{id:'save',label:'Save & close',primary:true},{id:'discard',label:'Discard changes',danger:true},{id:'cancel',label:'Cancel'}]);
      w.closing=false;if(choice==='cancel')return;
      if(choice==='save'){await w.save?.();if(w.editor.dirty||w.editor.pending){this.notify('The file could not be saved. The window and draft are still open.');return;}}
    }
    this.removeWindow(w);
  }
  private removeWindow(w:WindowRecord){w.dispose?.();w.el.remove();this.windows.delete(w.id);if(w.kind==='app')this.callbacks.closeApp();
    const next=[...this.windows.values()].filter(x=>!x.min).sort((a,b)=>Number(b.el.style.zIndex)-Number(a.el.style.zIndex))[0];if(next)this.focus(next);else{this.active='';this.paintTaskbar();}}
  private tile(){
    const visible=[...this.windows.values()].filter(w=>!w.min).sort((a,b)=>Number(b.el.style.zIndex)-Number(a.el.style.zIndex));
    if(!visible.length)return;
    if(this.stage.clientWidth<880){visible[0].max=true;this.place(visible[0]);this.notify('This screen fits one full-size window. Use the taskbar to switch.');return;}
    const chosen=visible.slice(0,2),width=(this.stage.clientWidth-24)/chosen.length;
    chosen.forEach((w,i)=>{w.max=false;w.x=8+i*(width+8);w.y=8;w.width=width;w.height=this.stage.clientHeight-16;this.place(w);});
    for(const w of visible.slice(2))this.minimize(w);this.focus(chosen[0]);
  }
  private openWorkbench(){
    if(this.model.state.workday){this.openDaily();return;}
    const old=this.windows.get('workbench');if(old){this.focus(old);return;}if(!this.roomForWindow())return;
    const w=this.createWindow('workbench','Today · Monthly case','app','workbench',1080,690);
    const paint=()=>{
      const month=currentMonth(this.model),sources=sourceDocuments(this.model).filter(d=>d.date.startsWith(month)),invoices=sources.filter(d=>['Sales invoice','Supplier invoice','Credit note','Supplier credit note'].includes(d.kind)),captured=invoices.filter(d=>this.model.journals.some(j=>j.sourceId===d.id)),bank=this.model.company.bank.filter(b=>b.date.startsWith(month)),matched=bank.filter(b=>this.model.state.bankMatches[b.id]?.length);
      w.body.innerHTML=`<div class="pc-workbench"><header><span class="pc-eyebrow">YOUR FIRST MONTH IN THE ROLE</span><h1>${e(monthLabel(month))}: take ownership of the books.</h1><p>Start with the handover. Process the source records, reconcile the balances, then explain and close the month. Your working papers support the ledger; they do not post journals.</p></header><div class="pc-workbench-metrics"><div><strong>${invoices.length-captured.length}</strong><span>Invoices without a ledger link</span></div><div><strong>${bank.length-matched.length}</strong><span>Unmatched bank lines</span></div><div><strong>${this.model.state.desktop?.files.filter(f=>!f.deleted).length??0}</strong><span>Saved working files</span></div></div><div class="pc-workbench-steps">${[
        ['1','Read the handover','Understand the inherited balances, missing evidence and this month’s requests.','handover','Open handover'],
        ['2','Process the month','Capture invoices and prepare journals from the evidence, not from answer keys.','process','Invoices & source files'],
        ['3','Reconcile and investigate','Match the bank, check payroll and support the balance-sheet accounts.','bank','Open bank reconciliation'],
        ['4','Check answers, then close','Save your work, submit a month review, resolve mistakes and complete the role deliverables before closing.','close','Check answers / month review'],
      ].map(([n,title,text,action,label])=>`<article><b>${n}</b><div><h2>${title}</h2><p>${text}</p>${button(action,label,'forward')}</div></article>`).join('')}</div><section class="pc-workbench-tools"><h2>Open a tool</h2>${button('mail','Scenario inbox','mail')}${button('ledger','Post a journal','app')}${button('payroll','Payroll controls','app')}${button('templates','Working-paper templates','sheet')}${button('new-sheet','Blank workbook','plus')}${button('reports','Draft AFS','file')}${button('career','Role deliverables','check')}${button('close','Check answers / month review','check')}${button('settings','Backup & case setup','save')}</section><footer>Single-click opens items. Use the title-bar × or the taskbar tab’s × to close. Unsaved files ask Save / Discard / Cancel. No real company, email or bank connection.</footer></div>`;
    };
    w.refresh=paint;w.body.addEventListener('click',event=>{const action=(event.target as Element).closest<HTMLElement>('[data-action]')?.dataset.action;if(!action)return;
      if(action==='handover')this.openExplorer('Handover');else if(action==='process')this.openExplorer(`Finance/${currentMonth(this.model)}`);else if(action==='mail')this.openMail();else if(action==='templates')this.openExplorer('Working papers/Templates');else if(action==='new-sheet')this.newWorkbook();else this.openApp(action);
    });paint();
  }
  openDaily=(taskId?:string,calendar=false)=>{
    if(!this.model.state.workday){this.openApp('settings');return;}
    let w=this.windows.get('workbench');
    if(w&&!w.daily){this.removeWindow(w);w=undefined;}
    if(!w){
      if(!this.roomForWindow())return;
      w=this.createWindow('workbench','Today · LedgerLab','app','workbench',1130,755);
      w.daily=mountDayDesk(w.body,{model:()=>this.model,send:this.callbacks.send,mail:id=>this.openMail(id),source:id=>this.openDocument(id),
        file:id=>id==='WORKING-FOLDER'?this.openExplorer(`Working papers/${currentMonth(this.model)}`):this.openFile(id),app:(view,id)=>this.openApp(view,id),workbook:t=>this.newWorkbook(t),
        capture:this.callbacks.captureInvoice,journal:this.callbacks.prepareJournal,paired:task=>this.openPairedWork(task),
        dirtyElsewhere:()=>!!this.callbacks.hasUnsavedForms?.()||[...this.windows.values()].some(x=>!!x.editor?.dirty||!!x.sheet?.hasPendingEdit()||!!x.review?.hasUnsaved())});
      w.refresh=w.daily.refresh;w.save=async()=>{await w!.daily!.saveDraft();};
    }
    this.focus(w);if(taskId)w.daily!.openTask(taskId);if(calendar)w.daily!.calendar();
  };
  openExplorer(path='',fresh=false){
    if((fresh||!this.windows.has('explorer'))&&!this.roomForWindow())return;
    if(!fresh&&this.windows.has('explorer')){
      const w=this.windows.get('explorer')!;w.browse?.(path);this.focus(w);return;
    }
    const id=fresh?`explorer-${this.counter}`:'explorer',w=this.createWindow(id,'Finance drive','folder','explorer',1000,630);
    w.path=path;let query='',tiles=false,sort='name';const history:string[]=[];
    const navigate=(folder:string)=>{history.push(w.path??'');w.path=folder;query='';paint();};
    const listing=()=>{
      const target=w.body.querySelector('.pc-file-list');if(!target)return;
      const folder=w.path??'',q=query.trim().toLowerCase();
      let subfolders=q?[]:this.folders.filter(f=>f&&f.split('/').slice(0,-1).join('/')===folder);
      let found=this.files.filter(f=>q?`${f.name} ${f.folder} ${f.description}`.toLowerCase().includes(q)&&f.folder!=='Recycle bin':f.folder===folder);
      if(sort==='date')found=found.sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name));else if(sort==='type')found=found.sort((a,b)=>a.kind.localeCompare(b.kind)||a.name.localeCompare(b.name));else found=found.sort((a,b)=>a.name.localeCompare(b.name));
      subfolders=subfolders.sort();const entries=[...subfolders.map(f=>({folder:f,file:null as VirtualFile|null})),...found.map(f=>({folder:'',file:f}))];
      target.className=`pc-file-list ${tiles?'pc-file-tiles':''}`;
      target.innerHTML=entries.length?`${!tiles?'<div class="pc-file-columns"><span>Name</span><span>Type</span><span>Date</span></div>':''}${entries.map(({folder:f,file})=>{
        const symbol=file?fileIcon(file):'folder',name=file?.name??f.split('/').at(-1)!,description=file?.description??'Folder';
        return `<button type="button" class="pc-file-entry" ${file?`data-file="${e(file.id)}"`:`data-folder="${e(f)}"`} title="${e(description)}"><span class="pc-file-symbol pc-${symbol}">${icon(symbol)}</span><span class="pc-file-name"><strong>${e(name)}</strong><small>${e(q&&file?file.folder:description)}</small></span><span class="pc-file-type">${file?({document:'Document',mail:'Email',csv:'CSV data',report:'Live report',workbook:'Working paper',note:'Text',template:'Template'}[file.kind]):'Folder'}</span><span class="pc-file-date">${file?.date??''}</span></button>`;
      }).join('')}`:`<div class="pc-empty">${icon('folder')}<h3>${q?'No matching files':'This folder is ready for your work'}</h3><p>${q?'Search uses file names, locations and descriptions.':'Create a working paper or note using the toolbar. Source evidence stays read-only.'}</p></div>`;
      const footer=w.body.querySelector('.pc-explorer-status')!;footer.textContent=`${entries.length} items${q?' · Search results across the drive':` · ${folder||'Finance drive (F:)'}`} · ${monthLabel(currentMonth(this.model))} released`;
    };
    const paint=()=>{
      const focus=w.body.contains(document.activeElement)&&document.activeElement?.getAttribute('aria-label')==='Search finance drive';
      const selection=focus?(document.activeElement as HTMLInputElement).selectionStart:null;
      const folder=w.path??'',parts=folder.split('/').filter(Boolean);
      w.body.innerHTML=`<div class="pc-explorer-toolbar">${button('back','Back','back',history.length?'':'disabled')}${button('up','Up','up',folder?'':'disabled')}
        <nav class="pc-breadcrumb" aria-label="Folder path"><button type="button" data-folder="">Finance (F:)</button>${parts.map((p,i)=>`<span>›</span><button type="button" data-folder="${e(parts.slice(0,i+1).join('/'))}">${e(p)}</button>`).join('')}</nav>
        <label class="pc-search">${icon('search')}<input aria-label="Search finance drive" placeholder="Search finance drive" value="${e(query)}" maxlength="120"></label></div>
        <div class="pc-explorer-actions">${button('new-workbook','New working paper','plus')}${button('new-note','New note','note')}${button('import-csv','Import XLSX / CSV','sheet')}
        <span class="pc-flex"></span><select aria-label="Sort files"><option value="name">Name</option><option value="date">Newest first</option><option value="type">Type</option></select>${button('view',tiles?'Details':'Icons',tiles?'list':'grid')}${button('new-window','New window','folder')}</div>
        <div class="pc-explorer-layout"><nav class="pc-explorer-sidebar" aria-label="Folder shortcuts"><small>QUICK ACCESS</small>${[['', 'Finance drive'],['Handover','Handover'],[`Finance/${currentMonth(this.model)}`,'Current month'],['Inbox','Email files'],[`Working papers/${currentMonth(this.model)}`,'My working papers'],['Working papers/Templates','Templates'],['Company reference','Company reference'],['My notes','Notes'],['Recycle bin','Recycle bin']].map(([f,l])=>`<button type="button" data-folder="${e(f)}" data-active="${folder===f}">${icon(f==='Recycle bin'?'trash':f==='Inbox'?'mail':'folder')}<span>${l}</span></button>`).join('')}<small>MONTH ARCHIVE</small>${this.folders.filter(f=>/^Finance\/\d{4}-\d{2}$/.test(f)).map(f=>`<button type="button" data-folder="${e(f)}" data-active="${folder===f}">${icon('folder')}<span>${e(monthLabel(f.slice(8)))}</span></button>`).join('')}</nav><div class="pc-file-list"></div></div><footer class="pc-explorer-status"></footer>`;
      (w.body.querySelector('select') as HTMLSelectElement).value=sort;listing();
      if(focus){const input=w.body.querySelector<HTMLInputElement>('[aria-label="Search finance drive"]')!;input.focus();input.setSelectionRange(selection,selection);}
    };
    w.refresh=paint;w.browse=path=>{w.path=path;query='';history.length=0;paint();};
    w.body.addEventListener('input',event=>{if((event.target as HTMLElement).getAttribute('aria-label')==='Search finance drive'){query=(event.target as HTMLInputElement).value;listing();}});
    w.body.addEventListener('change',event=>{if((event.target as HTMLElement).getAttribute('aria-label')==='Sort files'){sort=(event.target as HTMLSelectElement).value;listing();}});
    w.body.addEventListener('click',event=>{
      const target=event.target as Element,folder=target.closest<HTMLElement>('[data-folder]'),file=target.closest<HTMLElement>('[data-file]');
      if(folder){navigate(folder.dataset.folder!);return;}if(file){this.openFile(file.dataset.file!);return;}
      switch(target.closest<HTMLElement>('[data-action]')?.dataset.action){
        case 'back':w.path=history.pop()??'';query='';paint();break;case 'up':navigate((w.path??'').split('/').slice(0,-1).join('/'));break;
        case 'new-workbook':this.newWorkbook();break;case 'new-note':this.newNote();break;case 'import-csv':this.importCSV();break;
        case 'view':tiles=!tiles;paint();break;case 'new-window':this.openExplorer(w.path,true);break;
      }
    });paint();
  }
  openApp=(view:string,focusTask?:string)=>{
    if(view==='ledger-checks'){this.openHealth();return;}
    if(view==='review-notes'){this.openReviews();return;}
    if(view==='daily'){this.openDaily();return;}
    if(!FINANCE_APPS.some(a=>a.id===view))view='career';
    if(!this.windows.has('accounting')&&!this.roomForWindow())return;
    const w=this.windows.get('accounting')??this.createWindow('accounting','LedgerLab accounting','app','app',1120,720);
    if(!w.body.querySelector('.pc-app-content')){
      w.body.innerHTML=`<div class="pc-app-toolbar"><strong>LedgerLab</strong><label>Workspace <select aria-label="Accounting workspace">${FINANCE_APPS.map(a=>`<option value="${a.id}">${e(a.name)}</option>`).join('')}</select></label><label class="pc-app-month">Month <select aria-label="Reporting month in accounting app"></select></label><span class="pc-flex"></span>${button('source-folder','Source files','folder')}${button('classic','Classic view','list')}</div><div class="pc-app-content"></div>`;
      w.body.querySelector('[aria-label="Accounting workspace"]')!.addEventListener('change',event=>this.openApp((event.target as HTMLSelectElement).value));
      w.body.querySelector('[aria-label="Reporting month in accounting app"]')!.addEventListener('change',event=>this.callbacks.setMonth?.((event.target as HTMLSelectElement).value));
      w.body.addEventListener('click',event=>{const action=(event.target as Element).closest<HTMLElement>('[data-action]')?.dataset.action;if(action==='source-folder')this.openExplorer(`Finance/${currentMonth(this.model)}`);else if(action==='classic'&&this.canLeave())this.callbacks.classic();});
    }
    w.view=view;(w.body.querySelector('[aria-label="Accounting workspace"]') as HTMLSelectElement).value=view;
    w.refresh=()=>{const select=w.body.querySelector<HTMLSelectElement>('[aria-label="Reporting month in accounting app"]')!;
      select.innerHTML=Array.from({length:Number(currentMonth(this.model).slice(-2))},(_,i)=>{const month=`2025-${String(i+1).padStart(2,'0')}`;return `<option value="${month}">${monthLabel(month)}</option>`;}).join('');select.value=this.model.reportingMonth??currentMonth(this.model);};w.refresh();
    this.callbacks.app(view,w.body.querySelector('.pc-app-content')!);this.focus(w);this.menu.hidden=true;
    if(focusTask){
      const content=w.body.querySelector<HTMLElement>('.pc-app-content')!;
      // The standalone adapter renders synchronously; React may mount its portal later.
      let watcher:MutationObserver|undefined,timer:ReturnType<typeof setTimeout>|undefined;
      const reveal=()=>{
        const query=focusTask==='@forecast'?'[data-local="forecast-toggle"],[data-career-forecast]':`details[data-task="${CSS.escape(focusTask)}"],[data-career-open="${CSS.escape(focusTask)}"]`;
        const target=content.querySelector<HTMLElement>(query);if(!target)return false;
        watcher?.disconnect();if(timer)clearTimeout(timer);
        if(target instanceof HTMLDetailsElement)target.open=true;else target.click();
        target.scrollIntoView({block:'start'});return true;
      };
      if(!reveal()){watcher=new MutationObserver(reveal);watcher.observe(content,{childList:true,subtree:true});timer=setTimeout(()=>watcher?.disconnect(),5000);}
    }

  };
  openDocument=(id:string)=>this.openFile(`DOC:${id}`);
  openFile(id:string){
    const file=this.files.find(f=>f.id===id);if(!file){this.notify('That file is not available in the released case.');return;}
    if(file.kind==='mail'){this.openMail(file.ref);return;}
    if(file.kind==='template'){this.newWorkbook(file.ref);return;}
    if(file.id.startsWith('UF-')){const user=this.model.state.desktop?.files.find(f=>f.id===id);if(user){if(user.deleted)this.openRecycled(user);else this.openEditor(structuredClone(user),false);}return;}
    const existing=this.windows.get(id);if(existing){this.focus(existing);return;}
    if(!this.roomForWindow())return;
    const w=this.createWindow(id,file.name,fileIcon(file),'viewer',file.kind==='csv'?1050:850,680);
    const paint=()=>{
      const current=this.files.find(f=>f.id===id);if(!current){w.body.innerHTML='<p class="pc-padding">This file is no longer in the released case.</p>';return;}
      const isDoc=current.kind==='document',doc=isDoc?sourceDocuments(this.model).find(d=>d.id===current.ref):undefined;
      const invoice=doc&&doc.date.startsWith(currentMonth(this.model))&&['Sales invoice','Supplier invoice','Credit note','Supplier credit note'].includes(doc.kind);
      const posted=doc?this.model.journals.filter(j=>j.sourceId===doc.id).length:0;
      w.body.innerHTML=`<div class="pc-viewer-toolbar">${button('download','Download','download')}${current.kind==='report'||isDoc?button('print','Print / Save as PDF','print'):''}
        ${invoice?button('capture','Capture invoice','plus'):doc?button('journal','Prepare journal','app'):''}${current.kind==='csv'?button('edit-copy','Open editable copy','sheet'):''}${current.view?button('app','Open workspace','app'):''}
        <span class="pc-flex"></span><small>${current.id.startsWith('LIVE:')?'Live learner figures':isDoc?`Read-only source · ${posted} ledger links`:'Read-only'}</small></div>
        <div class="pc-file-description">${e(current.description)}${isDoc?' · Printable HTML source document':''}</div><div class="pc-document-content"></div>`;
      const content=w.body.querySelector('.pc-document-content')!;
      try{
        const payload=filePayload(current,this.model);
        if(current.kind==='csv')content.innerHTML=csvTableHTML(String(payload.content));
        else if(isDoc||current.kind==='report'){
          const iframe=document.createElement('iframe');iframe.title=current.description;iframe.setAttribute('sandbox','allow-same-origin allow-modals');iframe.referrerPolicy='no-referrer';iframe.srcdoc=safeDocumentHTML(String(payload.content));content.append(iframe);
        }else{const pre=document.createElement('pre');pre.className='pc-read-note';pre.textContent=readNote(current,this.model);content.append(pre);}
      }catch(error){content.textContent=(error as Error).message;}
    };
    w.refresh=paint;w.body.addEventListener('click',event=>{
      const action=(event.target as Element).closest<HTMLElement>('[data-action]')?.dataset.action,current=this.files.find(f=>f.id===id);if(!current)return;
      try{if(action==='download'){const payload=filePayload(current,this.model);downloadFile(payload.name,payload.content,payload.mime);}
        else if(action==='edit-copy'){const payload=filePayload(current,this.model),rows=csvPreview(String(payload.content)),width=Math.max(...rows.map(r=>r.length));if(rows.length>DESKTOP_LIMITS.rows||width>DESKTOP_LIMITS.columns)throw new Error('This source is larger than the working-paper limit; download it for Excel.');const f=createWorkingFile(this.model);f.name=uniqueFileName(current.name.replace(/\.csv$/i,'.xlsx'),f.folder,this.model);f.cells=rows.map(r=>Array.from({length:width},(_,c)=>r[c]??''));delete f.sheets;delete f.activeSheetId;this.openEditor(f,true);}
        else if(action==='print')w.body.querySelector('iframe')?.contentWindow?.print();
        else if(action==='capture')this.callbacks.captureInvoice(current.ref);else if(action==='journal')this.callbacks.prepareJournal(current.ref);else if(action==='app'&&current.view)this.openApp(current.view);
      }catch(error){this.notify((error as Error).message);}
    });paint();
  }
  openMail(selected?:string){
    if(!this.windows.has('mail')&&!this.roomForWindow())return;
    const w=this.windows.get('mail')??this.createWindow('mail','Harbour Mail','mail','mail',1080,670);
    if(!w.mail){w.mail=mountMailDesk(w.body,{model:()=>this.model,send:this.callbacks.send,source:id=>this.openDocument(id),assignment:id=>this.openDaily(id),app:view=>this.openApp(view)},selected);w.refresh=w.mail.refresh;}
    else if(selected)w.mail.select(selected);else w.mail.refresh();
    this.focus(w);
  }
  newWorkbook(template='blank'){
    const file=createWorkingFile(this.model,template);file.name=uniqueFileName(file.name,file.folder,this.model);this.openEditor(file,true);
  }
  private newNote(){
    const now=new Date().toISOString(),file:DesktopUserFile={id:newDesktopId(),name:uniqueFileName('Untitled note.txt','My notes',this.model),folder:'My notes',kind:'note',text:'',cells:[],createdAt:now,updatedAt:now,deleted:false};this.openEditor(file,true);
  }
  private importCSV(){
    const picker=document.createElement('input');picker.type='file';picker.accept='.xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values';
    picker.addEventListener('change',async()=>{
      const upload=picker.files?.[0];if(!upload)return;
      try{
        if(/\.xlsx$/i.test(upload.name)){const fresh=createWorkingFile(this.model);fresh.name=uniqueFileName(safeFilename(upload.name),fresh.folder,this.model);const imported=await importXLSX(new Uint8Array(await upload.arrayBuffer()),fresh);this.openEditor(imported.file,true);if(imported.warnings.length)await desktopDialog(this.host,'Workbook imported with limitations',imported.warnings.join(' '),[{id:'ok',label:'Understood',primary:true}]);return;}
        if(upload.size>500000)throw new Error('Choose a CSV below 500 KB. Working papers support 500 rows and 52 columns.');
        const raw=await upload.text(),rows=/\.tsv$/i.test(upload.name)?parseDelimited(raw):csvPreview(raw);
        const cols=Math.max(1,...rows.map(r=>r.length));if(!rows.length||rows.length>DESKTOP_LIMITS.rows||cols>DESKTOP_LIMITS.columns||rows.some(r=>r.some(c=>c.length>DESKTOP_LIMITS.cellLength)))throw new Error('Import supports 1–500 rows, up to 52 columns and up to 1,000 characters per cell. No cells were imported.');
        const file=createWorkingFile(this.model);file.name=uniqueFileName(safeFilename(upload.name.replace(/\.[^.]+$/,''))+'.xlsx',file.folder,this.model);
        file.cells=rows.map(r=>Array.from({length:cols},(_,c)=>r[c]??''));delete file.sheets;delete file.activeSheetId;this.openEditor(file,true);
      }catch(error){this.notify((error as Error).message);}
    });picker.click();
  }
  private openRecycled(file:DesktopUserFile){
    if(!this.windows.has(`recycled-${file.id}`)&&!this.roomForWindow())return;
    const w=this.windows.get(`recycled-${file.id}`)??this.createWindow(`recycled-${file.id}`,file.name,'trash','recycled',650,400);
    w.body.innerHTML=`<div class="pc-recycled"><span class="pc-shortcut-icon pc-trash">${icon('trash')}</span><h2>${e(file.name)}</h2><p>This learner file is in the recycle bin.</p><p>Original folder: <strong>${e(file.folder)}</strong></p><div>${button('restore','Restore file','restore')}${button('download','Download saved copy','download')}</div><small>Original source evidence cannot be recycled.</small></div>`;
    w.body.onclick=async event=>{const action=(event.target as Element).closest<HTMLElement>('[data-action]')?.dataset.action;
      const latest=this.model.state.desktop?.files.find(f=>f.id===file.id);if(!latest)return;
      if(action==='restore'){if(await this.callbacks.send({type:'restoreDesktopFile',fileId:file.id,expectedUpdatedAt:latest.updatedAt}))this.removeWindow(w);}
      else if(action==='download'){const virtual=this.files.find(f=>f.id===file.id);if(virtual){const p=filePayload(virtual,this.model);downloadFile(p.name,p.content,p.mime);}}
    };this.focus(w);
  }
  private openEditor(file:DesktopUserFile,isNew:boolean){
    const old=this.windows.get(file.id);if(old){this.focus(old);return;}
    if(!this.roomForWindow())return;
    const w=this.createWindow(file.id,file.name,file.kind==='workbook'?'sheet':'note','editor',file.kind==='workbook'?1250:800,780);
    const edit:EditorState={draft:file,base:isNew?null:file.updatedAt,dirty:isNew,pending:false,orphan:false,active:[0,0]};w.editor=edit;
    const current=()=>this.model.state.desktop?.files.find(f=>f.id===file.id);
    const conflict=()=>edit.orphan||(!edit.pending&&(current()?.updatedAt??null)!==edit.base);
    const status=()=>{
      const line=w.body.querySelector<HTMLElement>('.pc-editor-status');if(!line)return;const dirty=edit.dirty||w.sheet?.hasPendingEdit();
      line.dataset.error=String(conflict());line.textContent=edit.pending?'Saving workbook…':edit.orphan?'The case changed. Download this draft or Save copy to keep it.':conflict()?'Saved file changed elsewhere. Reload saved or Save copy; your draft is intact.':dirty?'Unsaved changes · Ctrl+S to save':'Saved with this case · included in case backups';
      const save=w.body.querySelector<HTMLButtonElement>('[data-action="save"]');if(save)save.disabled=edit.pending||this.model.saving||conflict()||!dirty;
      for(const action of ['reload-file','recycle']){const control=w.body.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);if(control)control.disabled=!current()||edit.pending||this.model.saving;}
      const title=w.el.querySelector<HTMLElement>('.pc-window-title strong');if(title)title.textContent=(dirty?'• ':'')+edit.draft.name;
    };
    const changed=()=>{edit.dirty=true;status();this.paintTaskbar();};
    const paint=()=>{
      w.sheet?.destroy();const isSheet=edit.draft.kind==='workbook';
      w.body.innerHTML=`<div class="pc-editor-toolbar">${button('save','Save','save')}${button('copy','Save copy','plus')}${button('download',isSheet?'Export XLSX':'Download','download')}${isSheet?button('csv','CSV values','sheet'):''}<span class="pc-flex"></span>${button('file-details','File details','folder')}${button('reload-file','Reload saved','refresh',edit.base===null?'disabled':'')}${button('recycle','Recycle','trash',edit.base===null?'disabled':'')}</div>
        <div class="pc-editor-meta" hidden><label>File name<input aria-label="Working file name" maxlength="120" value="${e(edit.draft.name)}"></label><label>Folder<input aria-label="Working file folder" maxlength="200" value="${e(edit.draft.folder)}"></label></div><div class="pc-editor-status" role="status"></div>${isSheet?'<div class="pc-sheet-mount"></div>':'<textarea class="pc-note-editor" aria-label="Note text" maxlength="30000" placeholder="Record findings, evidence and follow-up actions."></textarea>'}`;
      if(isSheet){w.sheet=mountSpreadsheet(w.body.querySelector('.pc-sheet-mount')!,{file:()=>edit.draft,changed,editingChanged:()=>{status();},save:async()=>{await w.save?.();},notify:message=>this.notify(message),confirm:async(title,message,accept)=>(await desktopDialog(this.host,title,message,[{id:'accept',label:accept,danger:true},{id:'cancel',label:'Cancel'}]))==='accept'});}
      else (w.body.querySelector('textarea') as HTMLTextAreaElement).value=edit.draft.text;status();
    };
    w.save=async()=>{
      w.sheet?.flush();if(edit.pending||!edit.dirty)return;if(conflict()){this.notify('Reload the saved copy or save this draft under a new name.');return;}
      syncWorkbook(edit.draft);const invalid=desktopFileError(edit.draft);if(invalid){this.notify(invalid);return;}
      const submitted=structuredClone(edit.draft);edit.pending=true;w.sheet?.setDisabled(true);w.body.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('.pc-editor-meta input,textarea').forEach(input=>input.disabled=true);status();
      try{
        const ok=await this.callbacks.send({type:'saveDesktopFile',file:submitted,expectedUpdatedAt:edit.base});
        if(ok){const saved=current();if(saved){edit.base=saved.updatedAt;edit.draft=structuredClone(saved);edit.dirty=false;w.title=saved.name;this.notify('Saved '+saved.name);}}
      }catch(error){this.notify((error as Error).message);}finally{edit.pending=false;w.sheet?.setDisabled(false);w.body.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('.pc-editor-meta input,textarea').forEach(input=>input.disabled=false);status();this.paintTaskbar();}
    };
    w.refresh=()=>{const latest=current();if(!edit.dirty&&!w.sheet?.hasPendingEdit()&&!edit.pending&&!edit.orphan&&latest&&!latest.deleted&&latest.updatedAt!==edit.base){edit.draft=structuredClone(latest);edit.base=latest.updatedAt;paint();}else status();};
    w.dispose=()=>w.sheet?.destroy();
    w.body.addEventListener('input',event=>{
      if(edit.pending)return;const input=event.target as HTMLInputElement,aria=input.getAttribute('aria-label');
      if(aria==='Working file name')edit.draft.name=input.value;else if(aria==='Working file folder')edit.draft.folder=input.value;else if(aria==='Note text')edit.draft.text=input.value;else return;changed();
    });
    w.body.addEventListener('click',async event=>{
      const action=(event.target as Element).closest<HTMLElement>('[data-action]')?.dataset.action;if(!action)return;
      try{
        if(action==='file-details'){const meta=w.body.querySelector<HTMLElement>('.pc-editor-meta')!;meta.hidden=!meta.hidden;return;}
        w.sheet?.flush();if(action==='save'){await w.save!();return;}
        if(action==='download'){downloadFile(safeFilename(edit.draft.name),edit.draft.kind==='workbook'?workbookXLSX(edit.draft):edit.draft.text,edit.draft.kind==='workbook'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/plain;charset=utf-8');return;}
        if(action==='csv'){const sheets=ensureWorkbook(edit.draft),active=sheets.find(s=>s.id===edit.draft.activeSheetId)??sheets[0];const values=evaluateWorkbook(sheets)[sheets.indexOf(active)];downloadFile(safeFilename(edit.draft.name.replace(/\.xlsx$/i,''))+' - '+safeFilename(active.name)+'.csv',csv(values[0]?.map(String)??[],values.slice(1).map(row=>row.map(v=>typeof v==='boolean'?(v?'TRUE':'FALSE'):v))),'text/csv;charset=utf-8');return;}
        if(edit.pending){this.notify('The file save is still in progress.');return;}
        if(action==='copy'){
          const copy=structuredClone(edit.draft);copy.id=newDesktopId();copy.name=uniqueFileName(copy.name.replace(/(\.[^.]+)$/,' - copy$1'),copy.folder,this.model);copy.createdAt=copy.updatedAt=new Date().toISOString();copy.deleted=false;this.openEditor(copy,true);this.notify('A separate copy is open. Save it to keep it in this case.');
        }else if(action==='reload-file'){
          const latest=current();if(!latest||latest.deleted){this.notify('The saved file is missing or recycled. Download your draft or Save copy.');return;}
          if(edit.dirty&&await desktopDialog(this.host,'Reload saved file?','Replace this draft with the saved copy? Unsaved changes will be discarded.',[{id:'reload',label:'Reload saved',danger:true},{id:'cancel',label:'Cancel'}])!=='reload')return;
          edit.draft=structuredClone(latest);edit.base=latest.updatedAt;edit.dirty=false;edit.orphan=false;paint();this.paintTaskbar();
        }else if(action==='recycle'){
          const latest=current();if(!latest)return;
          if(await desktopDialog(this.host,'Recycle this file?','Move this learner file to the recycle bin? Unsaved changes will be discarded. You can restore the saved file later.',[{id:'recycle',label:'Move to recycle bin',danger:true},{id:'cancel',label:'Cancel'}])!=='recycle')return;
          if(await this.callbacks.send({type:'trashDesktopFile',fileId:latest.id,expectedUpdatedAt:edit.base??latest.updatedAt})){edit.dirty=false;this.removeWindow(w);}
        }
      }catch(error){this.notify((error as Error).message);}
    });paint();this.paintTaskbar();
  }
  hasUnsaved=()=>!!this.callbacks.hasUnsavedForms?.()||[...this.windows.values()].some(w=>w.daily?.hasUnsaved()||w.review?.hasUnsaved()||w.editor?.dirty||w.editor?.pending||w.sheet?.hasPendingEdit());
  canLeave=()=>!this.hasUnsaved()||window.confirm('There are unsaved response, accounting or working-file drafts. Leave this desktop and discard them? Save or download them first to keep your work.');
  private beforeUnload=(event:BeforeUnloadEvent)=>{if(this.hasUnsaved()){event.preventDefault();event.returnValue='';}};
  destroy=()=>{
    this.dead=true;this.closeSearch?.();clearTimeout(this.toastTimer);this.observer.disconnect();window.removeEventListener('beforeunload',this.beforeUnload);this.host.removeEventListener('keydown',this.backupKey,true);this.host.removeEventListener('click',this.globalClick);this.host.removeEventListener('keydown',this.globalKey);
    for(const w of this.windows.values())w.dispose?.();this.windows.clear();this.host.innerHTML='';this.host.classList.remove('finance-pc');
  };
}
