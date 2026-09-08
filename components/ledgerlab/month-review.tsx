'use client';
import {closePackDate} from '@/lib/accounting/workday-calendar';
import {useMemo,useState} from 'react';
import {useWorkspace} from './context';
import {assessMonth} from '@/lib/accounting/month-assessment';
import {monthReviewHTML,monthReviewDocument,reviewStyles,filterReview} from '@/lib/accounting/month-review-view';
import {downloadFile} from '@/lib/accounting/exports';
import {Button,Callout} from './shared';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
export function MonthReviewPanel(){
 const {state,company,send,saving,go,setMonth,openDocument}=useWorkspace();
 const [confirm,setConfirm]=useState(false),[notice,setNotice]=useState('');
 const report=useMemo(()=>state.career&&(!state.workday||state.workday.today>=closePackDate(state.career.activeMonth))?assessMonth(company,state):null,[company,state]);
 if(!report)return state.workday&&state.career?<p>Full month review opens on {closePackDate(state.career.activeMonth)}. Use Today → Check today’s work until closing evidence arrives.</p>:null;
 return <>
 <div onInput={event=>{const input=event.target as HTMLInputElement;if(!input.matches('[data-review-search],[data-review-passed]'))return;const root=input.closest<HTMLElement>('.mr-panel')!;filterReview(root,root.querySelector<HTMLInputElement>('[data-review-search]')?.value??'',!!root.querySelector<HTMLInputElement>('[data-review-passed]')?.checked);}}
 onClick={event=>{const button=(event.target as Element).closest<HTMLElement>('[data-review-action]');if(!button||saving)return;
  switch(button.dataset.reviewAction){case 'source':openDocument(button.dataset.id!);break;case 'work':setMonth(report.month);go(button.dataset.view!);break;case 'check':setNotice('Saved work checked. Unsaved drafts are excluded; nothing was posted, closed or advanced.');break;case 'submit':setConfirm(true);break;case 'export':downloadFile(`LedgerLab-month-feedback-${report.month}.html`,monthReviewDocument(company,state,report),'text/html');break;}
 }} dangerouslySetInnerHTML={{__html:`<style>${reviewStyles}</style>${monthReviewHTML(company,state,report)}`}}/>
 {notice&&<Callout>{notice}</Callout>}
 <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogHeader><DialogTitle>Submit saved month for review?</DialogTitle><DialogDescription>Only saved postings, matches, deliverables and forecasts are marked. Unsaved forms and workbook cells are excluded. This reveals case answers and records feedback assistance. It does not post corrections, close or advance the month.</DialogDescription></DialogHeader><div className="form-row"><Button variant="outline" disabled={saving} onClick={()=>setConfirm(false)}>Cancel</Button><Button disabled={saving} onClick={async()=>{if(await send({type:'submitMonthReview'})){setConfirm(false);setNotice('Review saved. Open each area to see the differences and next actions.');}}}>Submit saved work</Button></div></DialogContent></Dialog>
 </>;
}
