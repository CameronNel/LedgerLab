import {htmlEscape as e, printableStyles, csv} from './exports';
import {careerTasks, careerMetrics, forecastSchedule, FORECAST_FIELDS, careerEvidenceChecks} from './career-work';
import {careerKey} from './career';
import {money} from './money';
import type {PracticeCompany,PracticeState} from './types';
export function careerPortfolioHTML(company:PracticeCompany,state:PracticeState):string{
  if(!state.career)throw new Error('Start a takeover to export a portfolio.');
  const c=state.career;
  const months=Object.keys(c.closed).concat(c.closed[c.activeMonth]?[]:[c.activeMonth]).sort();
  let body=`<div class="mast"><div><div class="brand">LEDGERLAB / FINANCE TAKEOVER</div><h1>Work portfolio</h1><p>${e(company.name)} · ${e(c.role)} · ${e(c.startMonth)} to ${e(c.activeMonth)}</p></div><div>Seed ${company.seed}<br>${e(c.scenario)} handover</div></div><div class="note">Fictional AUD 2025 training case. This records work performed, not professional certification or proof of independent review. Quantitative submissions are source-checked; narrative judgement and forecast assumptions are not independently assessed. AFS evidence gaps remain open.</div>`;
  for(const month of months){
    const m=careerMetrics(company,state,month),closed=c.closed[month];
    body+=`<h2>${e(month)} · ${closed?'Closed':'Open'}</h2><p>${e(closed?.reason??'Work remains in progress.')}</p><table><tr><th>Monthly revenue</th><th>Gross profit</th><th>Profit before tax</th><th>Operating bank</th></tr><tr>${[m.revenue,m.grossProfit,m.profitBeforeTax,m.bank].map(n=>`<td>${money(n)}</td>`).join('')}</tr></table>`;
    for(const task of careerTasks(company,state,month)){
      const s=c.submissions[careerKey(month,task.id)];
      body+=`<h3>${e(task.title)} · ${e(s?.status??'Not started')}</h3><p>${e(task.brief)}</p>`;
      if(s){body+=`<table><tr><th>Submitted figure</th><th>AUD</th></tr>${task.figures.map(f=>`<tr><td>${e(f.label)}</td><td>${s.figures[f.id]===undefined?'Not supplied':money(s.figures[f.id])}</td></tr>`).join('')}</table>`;
        body+=task.responses.map(r=>`<h4>${e(r.label)}</h4><p style="white-space:pre-wrap">${e(s.responses[r.id]??'')}</p>`).join('');
        body+=`<p>Evidence: ${s.evidence.map(e).join(', ')}</p>`;}
    }
    const f=c.forecasts[month];if(f){body+=`<h3>13-week cash forecast · ${e(f.status)}</h3><p>${e(f.assumptions)}</p><table><tr><th>Week</th><th>Opening</th><th>In</th><th>Out</th><th>Closing</th><th>Stress closing</th></tr>`;
      const stressed=forecastSchedule(m.bank,f,true);
      body+=forecastSchedule(m.bank,f).map((w,i)=>`<tr><td>${w.week} · ${w.date}</td>${[w.opening,w.inflow,w.outflow,w.closing,stressed[i].closing].map(v=>`<td>${money(v)}</td>`).join('')}</tr>`).join('')+`</table><p>${e(f.actions)}</p>`;}
  }
  body+=`<h2>Month review attempts</h2><p>Saved learning receipts; detailed contemporaneous feedback is exported separately. Latest 24 attempts retained.</p><table><tr><th>Month</th><th>Submitted</th><th>Checks passed</th><th>Blockers</th><th>Feedback</th></tr>${(state.monthReviews??[]).map(r=>`<tr><td>${e(r.month)}</td><td>${e(r.at)}</td><td>${r.passed} / ${r.total}</td><td>${r.blockers}</td><td>${r.feedbackRevealed?'Answers shown':'Hidden'}</td></tr>`).join('')}</table>`;
  body+=`<h2>Current close controls</h2><ul>${careerEvidenceChecks(company,state).map(c=>`<li>${e(c.label)}: ${c.remaining} outstanding. ${e(c.detail)}</li>`).join('')}</ul><p>Assistance recorded: ${state.revealed.length} revealed work units; ${state.journals.filter(j=>j.origin==='solution').length} worked-answer journals.</p>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LedgerLab finance takeover portfolio</title><style>${printableStyles}</style><body>${body}</body></html>`;
}
export function careerForecastCSV(company:PracticeCompany,state:PracticeState,month:string):string{
  const f=state.career?.forecasts[month];if(!f)throw new Error('Save a cash forecast before exporting it.');
  const base=forecastSchedule(careerMetrics(company,state,month).bank,f),stress=forecastSchedule(careerMetrics(company,state,month).bank,f,true);
  return csv(['Week','Week starts','Opening AUD',...FORECAST_FIELDS.map(f=>`${f.label} AUD`),'Closing AUD','Cash headroom AUD','Stress closing AUD'],
    base.map((w,i)=>[w.week,w.date,w.opening/100,...FORECAST_FIELDS.map(k=>f.weeks[i][k.id]/100),w.closing/100,w.headroom/100,stress[i].closing/100]));
}
