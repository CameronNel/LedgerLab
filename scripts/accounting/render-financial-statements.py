#!/usr/bin/env python3
"""Render exported LedgerLab report data to a paginated AFS teaching PDF.

python scripts/accounting/render-financial-statements.py --data financial-report-data.json --out financial-statements.pdf
Requires reportlab. Numeric report values are integer cents, computed by the accounting engine.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
from pathlib import Path
from reportlab.platypus import PageTemplate, Frame, Spacer, PageBreak, TableStyle, KeepTogether, CondPageBreak
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.styles import ParagraphStyle

spec=importlib.util.spec_from_file_location('ledgerlab_pdf',Path(__file__).with_name('render-source-pack.py'))
pdf=importlib.util.module_from_spec(spec)
spec.loader.exec_module(pdf)

def report_table(data):
    count=len(data['columns'])
    widths=[pdf.WIDTH-105*count]+[105]*count
    rows=[[r['label'],*[pdf.fmt(v) for v in r['values']]] for r in data['rows']]
    table=pdf.table(['Line item',*data['columns']],rows,widths,tuple(range(1,count+1)))
    table.setStyle(TableStyle([('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    for i,row in enumerate(data['rows'],1):
        if row.get('total'):
            table.setStyle(TableStyle([('BACKGROUND',(0,i),(-1,i),pdf.LIGHT),('LINEABOVE',(0,i),(-1,i),.7,pdf.RULE)]))
    return table

def render(data_path:Path,output:Path):
    data=json.loads(data_path.read_text())
    if data.get('format')!='LedgerLab financial report' or data.get('units')!='integer cents':
        raise ValueError('Use report data exported by the LedgerLab accounting engine.')
    for table in [*data['statements'],*[t for n in data['notes'] for t in n['tables']]]:
        for row in table['rows']:
            if len(row['values'])!=len(table['columns']) or any(not isinstance(v,int) for v in row['values']):
                raise ValueError('Report table columns or integer-cent values are invalid.')
    output.parent.mkdir(parents=True,exist_ok=True)
    doc=pdf.EvidenceBook(str(output),pagesize=pdf.A4,leftMargin=pdf.MARGIN,rightMargin=pdf.MARGIN,topMargin=49,bottomMargin=48,title=f"LedgerLab - {data['name']} financial statements",author='LedgerLab',subject='Fictional training financial statements with supporting notes')
    def footer(canvas,document):
        canvas.saveState();canvas.setStrokeColor(pdf.RULE);canvas.line(pdf.MARGIN,31,pdf.PAGE_W-pdf.MARGIN,31);canvas.setFont('Helvetica',7.5);canvas.setFillColor(pdf.MUTED);canvas.drawString(pdf.MARGIN,19,f"LEDGERLAB | TRAINING FINANCIAL STATEMENTS | SEED {data['seed']} | AUD");canvas.drawRightString(pdf.PAGE_W-pdf.MARGIN,19,str(document.page));canvas.restoreState()
    frame=Frame(pdf.MARGIN,48,pdf.WIDTH,pdf.PAGE_H-97,id='body',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
    doc.addPageTemplates(PageTemplate(id='main',frames=frame,onPage=footer))
    p=pdf.p
    story=[Spacer(1,42),p('LEDGERLAB / REPORTING PRACTICE','CoverLabel'),p('Financial statements','CoverTitle'),p(data['name'],'SectionHeading'),p(f"{data['from']} to {data['to']} | AUD | Seed {data['seed']}",'Meta'),Spacer(1,18),p(data.get('mode','Learner ledger'),'SectionHeading'),p('Primary statements, a profit-to-cash reconciliation and eighteen numbered notes. All numerical tables are computed by the same integer-cent accounting engine that supports the application.'),p('Read this draft in context','SectionHeading'),p('These are fictional training statements. Prior-year performance and cash-flow information is not supplied. The comparative financial position is the agreed opening trial balance at 31 December 2024. A complete statutory disclosure assessment, subsequent-events review, related-party review and going-concern conclusion require additional evidence.'),p('Worked numerical figures do not imply that the missing disclosure evidence has been obtained. No audit opinion, directors’ declaration or authorisation date is generated. Your saved assessments and outstanding questions remain visible.'),p('Where a monthly performance period is selected, the primary profit, equity and cash-flow statements use that period; the numbered supporting notes use year-to-date movements to the reporting date.','SmallCopy'),PageBreak(),p('Report index','SectionHeading')]
    toc=TableOfContents();toc.levelStyles=[ParagraphStyle(name='FinancialTOC',fontName='Helvetica',fontSize=9.2,leading=14,spaceBefore=5,textColor=pdf.INK)]
    story.extend([toc,PageBreak()])
    for i,table in enumerate(data['statements']):
        if i:story.append(PageBreak())
        story.extend([p(table['title'],'DocumentTitle'),p(f"{data['name']} | AUD | {data['to']}",'Meta'),report_table(table)])
        if i==0:story.append(p('Comparative performance information has not been supplied. No other comprehensive income is modelled in this case.','SmallCopy'))
        if i==1:story.append(p('Current classification follows the supplied operating cycle, short-term provision settlements and explicit current debt accounts. Deferred tax is non-current. Investigate suspense before completing the reporting file.','SmallCopy'))
        if i==2:story.append(p('Opening equity includes profits from earlier months where a monthly reporting period is selected. All other equity movements are derived from the posted equity accounts.','SmallCopy'))
        if i in (3,4):story.append(p('Interest paid is financing and interest received is investing under the selected case policy. Non-cash lease commencement is excluded from cash flows. The indirect bridge contains no balancing plug.','SmallCopy'))
    story.append(PageBreak())
    for note in data['notes']:
        story.extend([PageBreak() if note['id']=='18' else CondPageBreak(230),p(f"Note {note['id']} | {note['title']}",'DocumentTitle')])
        for paragraph in note['paragraphs']:story.append(p(paragraph))
        for table in note['tables']:story.extend([p(table['title'],'SectionHeading'),report_table(table)])
        story.extend([Spacer(1,12),p('Source evidence: '+', '.join(note['documents']),'SmallCopy')])
        if note.get('source'):story.append(p(note['source']['label']+'\n'+note['source']['url'],'SmallCopy'))
        assessment=data.get('disclosures',{}).get(note['id'],{})
        assessment_block=[p(f"Preparer assessment | Note {note['id']}",'SectionHeading'),p('Assessment marked complete by the learner.' if assessment.get('completed') else 'Assessment remains open.','SmallCopy')]
        if assessment.get('text'):assessment_block.append(p(assessment['text']))
        else:
            assessment_block.append(p('No assessment has been saved. Address these preparation questions:'))
            for prompt in note['prompts']:assessment_block.append(p('- '+prompt))
        story.append(KeepTogether(assessment_block))
    if data.get('workpapers'):
        story.extend([PageBreak(),p('Preparer workpaper conclusions','DocumentTitle')])
        for key,w in data['workpapers'].items():
            if not w.get('conclusion'):continue
            story.extend([p(key,'SectionHeading'),p(w['conclusion']),p(f"Prepared: {w['preparer'] if w.get('prepared') else 'not signed'} | Reviewed: {w['reviewer'] if w.get('reviewed') else 'not signed / requires review'}",'SmallCopy')])
    if data.get('balanceReconciliations'):
        story.extend([PageBreak(),p('Balance-sheet reconciliation schedules','DocumentTitle')])
        for r in data['balanceReconciliations']:
            story.extend([p(f"{r['account']} | {r['name']} | {r['asOf']}",'SectionHeading'),p(f"Amounts follow the account's normal {r['normal']} balance direction.",'SmallCopy'),pdf.table(['Supporting component','Evidence','Amount AUD'],[[i['description'],i.get('documentId',''),pdf.fmt(i['amount'])] for i in r['items']],[pdf.WIDTH-220,120,100],(2,)),pdf.table(['Reconciliation','Amount AUD'],[['Ledger balance',pdf.fmt(r['ledger'])],['Supported amount',pdf.fmt(r['support'])],['Difference',pdf.fmt(r['difference'])]],[pdf.WIDTH-120,120],(1,)),p(r['conclusion']),p(f"Prepared by {r['preparer'] or 'not signed'} | Review: {r['reviewer'] if r.get('reviewed') else 'open'}",'SmallCopy')])
    doc.multiBuild(story)
    print(f"Rendered five primary report tables and {len(data['notes'])} notes to {output}")

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--data',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);args=parser.parse_args();render(args.data,args.out)
