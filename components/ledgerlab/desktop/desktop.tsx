'use client';
import {forwardRef,useEffect,useImperativeHandle,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {WorkspaceContext,type WorkspaceContextValue} from '../context';
import {mountFinanceDesktop,type DesktopHandle} from '@/lib/desktop/shell';
import type {DesktopModel} from '@/lib/desktop/files';
type Props={model:DesktopModel;readModel:()=>DesktopModel;context:WorkspaceContextValue;renderView:(view:string)=>ReactNode;
  onClassic:()=>void;onCaptureInvoice:(sourceId:string)=>void;onPrepareJournal:(sourceId:string)=>void;};
/** Keeps desktop DOM stable while the existing React accounting screens render in a portal. */
export const FinanceDesktopView=forwardRef<DesktopHandle,Props>(function FinanceDesktopView(props,ref){
  const host=useRef<HTMLDivElement>(null),desktop=useRef<DesktopHandle|null>(null),latest=useRef(props);
  latest.current=props;
  const [portal,setPortal]=useState<{view:string;target:HTMLElement}|null>(null);
  useImperativeHandle(ref,()=>({
    update:model=>desktop.current?.update(model),openApp:(view,id)=>desktop.current?.openApp(view,id),openDocument:id=>desktop.current?.openDocument(id),
    openFile:id=>desktop.current?.openFile(id),openExplorer:(path,fresh)=>desktop.current?.openExplorer(path,fresh),newWorkbook:t=>desktop.current?.newWorkbook(t),
    openDaily:(id,calendar)=>desktop.current?.openDaily(id,calendar),openMail:id=>desktop.current?.openMail(id),
    canLeave:()=>desktop.current?.canLeave()??true,hasUnsaved:()=>desktop.current?.hasUnsaved()??false,destroy:()=>desktop.current?.destroy(),
  }),[]);
  useEffect(()=>{
    if(!host.current)return;
    const mounted=mountFinanceDesktop(host.current,latest.current.model,{
      send:async command=>{
        const ok=await latest.current.context.send(command);
        // Read the session directly, not a potentially stale React render, before acknowledging a file save.
        mounted.update(latest.current.readModel());return ok;
      },
      app:(view,target)=>setPortal(old=>old?.view===view&&old.target===target?old:{view,target}),
      closeApp:()=>setPortal(null),captureInvoice:id=>latest.current.onCaptureInvoice(id),prepareJournal:id=>latest.current.onPrepareJournal(id),
      classic:()=>latest.current.onClassic(),reload:()=>latest.current.context.reload(),setMonth:month=>latest.current.context.setMonth(month),
    });
    desktop.current=mounted;
    return()=>{mounted.destroy();desktop.current=null;};
  },[]);
  useEffect(()=>{desktop.current?.update(latest.current.readModel());},[props.model]);
  return <><div ref={host} aria-label="Finance PC desktop"/>{portal&&createPortal(
    <WorkspaceContext.Provider value={{...props.context,view:portal.view}}>
      <div key={`${portal.view}-${props.model.generation}`}>{props.renderView(portal.view)}</div>
    </WorkspaceContext.Provider>,portal.target,
  )}</>;
});
