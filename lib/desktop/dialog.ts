import {htmlEscape as e} from '../accounting/exports';
/** Local modal, not window.confirm: works inside embedded previews as well as local browsers. */
export function desktopDialog(host:HTMLElement,title:string,message:string,choices:{id:string;label:string;primary?:boolean;danger?:boolean}[]):Promise<string>{
  return new Promise(resolve=>{
    const previous=document.activeElement as HTMLElement|null,backdrop=document.createElement('div');backdrop.className='pc-modal-backdrop';
    backdrop.innerHTML=`<section class="pc-modal" role="dialog" aria-modal="true" aria-label="${e(title)}"><h2>${e(title)}</h2><p>${e(message)}</p><div class="pc-modal-actions">${choices.map(c=>`<button type="button" data-choice="${e(c.id)}" class="${c.primary?'primary':''} ${c.danger?'danger':''}">${e(c.label)}</button>`).join('')}</div></section>`;
    let done=false;const finish=(id:string)=>{if(done)return;done=true;backdrop.remove();if(previous?.isConnected)previous.focus({preventScroll:true});resolve(id);};
    backdrop.addEventListener('click',event=>{const id=(event.target as Element).closest<HTMLElement>('[data-choice]')?.dataset.choice;if(id)finish(id);});
    backdrop.addEventListener('keydown',event=>{
      event.stopPropagation();if(event.key==='Escape'){event.preventDefault();finish('cancel');}
      if(event.key==='Tab'){const buttons=Array.from(backdrop.querySelectorAll<HTMLButtonElement>('button')),first=buttons[0],last=buttons.at(-1)!;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    });
    host.append(backdrop);
    (backdrop.querySelector<HTMLButtonElement>('[data-choice="cancel"]')??backdrop.querySelector<HTMLButtonElement>('button'))?.focus();
  });
}
