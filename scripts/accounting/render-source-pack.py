#!/usr/bin/env python3
"""Render a LedgerLab source JSON into a paginated, printable evidence book.

Usage: python scripts/accounting/render-source-pack.py --case case-source.json --out source-pack.pdf
Requires reportlab. All source amounts are integer cents, never dollars.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from html import escape
from decimal import Decimal
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER
from reportlab.lib.pagesizes import A4

INK=colors.HexColor('#19364f'); BLUE=colors.HexColor('#285ca5'); LIGHT=colors.HexColor('#edf3fa'); MUTED=colors.HexColor('#65778b'); RULE=colors.HexColor('#d6e0ec')
PAGE_W,PAGE_H=A4; MARGIN=44; WIDTH=PAGE_W-MARGIN*2
def clean(v):
    return str(v).translate(str.maketrans({'\u2013':'-','\u2014':'-','\u2019':"'",'\u2018':"'",'\u201c':'"','\u201d':'"','\u2022':'-','\u2192':' -> ','\u00d7':' x ','\u2212':'-','\u2264':'<=','\u2265':'>='}))
def text(v): return escape(clean(v))
def fmt(v): return f"{Decimal(int(v))/100:,.2f}"
def cash(v): return '$'+fmt(v)

styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='CoverLabel',fontName='Helvetica-Bold',fontSize=10,textColor=BLUE,spaceAfter=12,leading=14))
styles.add(ParagraphStyle(name='CoverTitle',fontName='Helvetica-Bold',fontSize=34,textColor=INK,leading=39,spaceAfter=22))
styles.add(ParagraphStyle(name='DocumentTitle',fontName='Helvetica-Bold',fontSize=21,textColor=INK,leading=26,spaceAfter=14,keepWithNext=True))
styles.add(ParagraphStyle(name='SectionHeading',fontName='Helvetica-Bold',fontSize=12,textColor=INK,leading=17,spaceBefore=18,spaceAfter=9,keepWithNext=True))
styles.add(ParagraphStyle(name='BodyCopy',fontName='Helvetica',fontSize=10,leading=15,textColor=INK,spaceAfter=10))
styles.add(ParagraphStyle(name='SmallCopy',fontName='Helvetica',fontSize=8,leading=11,textColor=MUTED,spaceAfter=6))
styles.add(ParagraphStyle(name='CellCopy',fontName='Helvetica',fontSize=8.5,leading=11,textColor=INK))
styles.add(ParagraphStyle(name='CellRight',parent=styles['CellCopy'],alignment=TA_RIGHT))
styles.add(ParagraphStyle(name='TableHeading',fontName='Helvetica-Bold',fontSize=8,leading=11,textColor=INK))
styles.add(ParagraphStyle(name='Meta',fontName='Helvetica',fontSize=9,leading=13,textColor=MUTED,spaceAfter=10))

def p(value,style='BodyCopy'): return Paragraph(text(value).replace('\n','<br/>'),styles[style])
def table(headers,rows,widths,align_right=()):
    data=[[p(h,'TableHeading') for h in headers]]
    for row in rows: data.append([p(value,'CellRight' if i in align_right else 'CellCopy') for i,value in enumerate(row)])
    t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
    commands=[('BACKGROUND',(0,0),(-1,0),LIGHT),('LINEBELOW',(0,0),(-1,0),.6,RULE),('LINEBELOW',(0,1),(-1,-1),.35,RULE),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]
    for i in align_right:commands.append(('ALIGN',(i,0),(i,-1),'RIGHT'))
    t.setStyle(TableStyle(commands));return t

class EvidenceBook(BaseDocTemplate):
    def afterFlowable(self,flowable):
        if isinstance(flowable,Paragraph) and flowable.style.name=='DocumentTitle':
            title=flowable.getPlainText(); key=f'doc-{self.seq.nextf("heading")}'
            self.canv.bookmarkPage(key)
            self.notify('TOCEntry',(0,title,self.page,key))

def render(case_path:Path,output:Path):
    case=json.loads(case_path.read_text());seed=case['seed'];output.parent.mkdir(parents=True,exist_ok=True)
    doc=EvidenceBook(str(output),pagesize=A4,leftMargin=MARGIN,rightMargin=MARGIN,topMargin=49,bottomMargin=48,title=f'LedgerLab - Harbour accounting case {seed}',author='LedgerLab',subject='Fictional accounting training source documents')
    def on_page(canvas,document):
        canvas.saveState();canvas.setStrokeColor(RULE);canvas.line(MARGIN,31,PAGE_W-MARGIN,31);canvas.setFont('Helvetica',7.5);canvas.setFillColor(MUTED);canvas.drawString(MARGIN,19,f'LEDGERLAB | FICTIONAL TRAINING EVIDENCE | SEED {seed} | AUD');canvas.drawRightString(PAGE_W-MARGIN,19,f'{document.page}');canvas.restoreState()
    frame=Frame(MARGIN,48,WIDTH,PAGE_H-97,id='body',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
    doc.addPageTemplates(PageTemplate(id='main',frames=frame,onPage=on_page))
    story=[Spacer(1,38),p('LEDGERLAB / ACCOUNTING PRACTICE','CoverLabel'),p('The December close','CoverTitle'),p(case['name'],'SectionHeading'),p(f'Financial year 2025 | Seed {seed} | Source evidence book','Meta'),Spacer(1,24),p('Your role','SectionHeading'),p('Take over the books of a fictional trading and installation business. January to November are the agreed historical ledger. December contains unprocessed invoices and missing closing entries. Use this evidence to complete bookkeeping, reconcile the balances, prepare estimates and taxes, and explain the final financial statements.'),p('How to work through the case','SectionHeading')]
    for i,line in enumerate(['Read the opening policies and unadjusted trial balance CSV.','Process invoices using the correct accounts, dates, contacts and GST treatment.','Reconcile bank, receivables, suppliers, payroll, assets and inventory.','Prepare the accruals, prepayments, provisions, leases and tax adjustments.','Tie the statements together and write evidence-backed workpaper conclusions.'],1):story.append(p(f'{i}. {line}'))
    story.extend([Spacer(1,18),p('All people, entities, invoices and bank details are fictional. This pack is not valid for payment, employment records, tax lodgement or statutory filing. The app and CSV exports hold the practice ledger; this book contains source evidence.','SmallCopy'),p('The case uses simplified withholding rates and specified tax assumptions. Full payroll legislation, foreign currency ledgers, consolidation and complete statutory disclosures are not modelled.','SmallCopy'),PageBreak(),p('Document index','SectionHeading')])
    toc=TableOfContents();toc.levelStyles=[ParagraphStyle(name='TOCEntry',fontName='Helvetica',fontSize=9.3,leading=14,spaceBefore=4,leftIndent=0,firstLineIndent=0,textColor=INK)];story.extend([toc,PageBreak()])
    evidence_ids={x for e in case['exercises'] for x in e['documents']}
    documents=[d for d in case['documents'] if d['date'].startswith('2025-12') or d['id'] in evidence_ids or d['id']=='TB-OPEN']
    order={'Memo':0,'Contract':1,'Sales invoice':2,'Supplier invoice':3,'Credit note':4,'Bank statement':5,'Customer statement':6,'Supplier statement':7,'Payroll register':8,'Payslip':9,'Stock count':10}
    documents.sort(key=lambda d:(0 if d['id']=='TB-OPEN' else 1,order.get(d['kind'],99),d['date'],d['id']))
    for index,d in enumerate(documents):
        if index:story.append(PageBreak())
        story.extend([p(d['kind'].upper(),'CoverLabel'),p(f"{d['id']} | {d['title']}",'DocumentTitle'),p(f"{d['party']} | Issued {d['date']}"+(f" | Due {d['dueDate']}" if d.get('dueDate') else ''),'Meta')])
        if d['kind']=='Bank statement':
            rows=[r for r in case['bank'] if r['date'][:7]==d['date'][:7]]
            story.extend([p('Practice Bank - operating account TRAINING-001','SectionHeading'),table(['Opening statement','Money in','Money out','Closing statement'],[[cash(d['metadata']['opening']),cash(sum(r['amount'] for r in rows if r['amount']>0)),cash(-sum(r['amount'] for r in rows if r['amount']<0)),cash(d['metadata']['closing'])]],[WIDTH/4]*4,(0,1,2,3)),Spacer(1,15),table(['Date','Description / reference','Money out','Money in','Balance'],[[r['date'],r['description']+'\n'+r['reference'],fmt(-r['amount']) if r['amount']<0 else '-',fmt(r['amount']) if r['amount']>0 else '-',fmt(r['balance'])] for r in rows],[58,WIDTH-58-72*3,72,72,72],(2,3,4))])
        elif d['kind']=='Payroll register':
            pay=case['payroll'][d['date'][:7]]
            rows=[[r['name']+'\n'+r['role'],fmt(r['gross']),fmt(r['withholding']),fmt(r['deductions']),fmt(r['net']),fmt(r['super'])] for r in pay]
            rows.append(['TOTAL',*[fmt(sum(r[k] for r in pay)) for k in ['gross','withholding','deductions','net','super']]])
            story.append(table(['Employee','Gross','Withheld','Deductions','Net pay','Super'],rows,[WIDTH-5*73,73,73,73,73,73],(1,2,3,4,5)))
        elif d['kind'] in ['Customer statement','Supplier statement']:
            story.append(table(['Open invoice / account item','Balance incl. GST'],[[l['description'],fmt(l['net'])] for l in d['lines']]+[['STATEMENT CLOSING BALANCE',fmt(d['total'])]],[WIDTH-120,120],(1,)))
        elif d.get('lines'):
            story.append(table(['Description','Qty','Unit amount','Net amount','GST'],[[l['description'],str(l['quantity']),fmt(l['unitPrice']),fmt(l['net']),fmt(l['tax'])] for l in d['lines']],[WIDTH-43-72-78-62,43,72,78,62],(1,2,3,4)))
            story.append(Spacer(1,12))
            if d['kind']=='Payslip':
                m=d['metadata'];totals=[['Gross earnings',cash(m['gross'])],['PAYG teaching withholding','('+cash(m['withholding'])+')'],['Other employee deductions','('+cash(m['deductions'])+')'],['NET PAY',cash(m['net'])],['Employer super (additional)',cash(m['super'])]]
            else:totals=[['Net amount',cash(d['net'])],['GST',cash(d['tax'])],['TOTAL',cash(d['total'])]]
            summary=table(['Summary','AUD'],totals,[WIDTH-135,135],(1,));story.append(KeepTogether(summary))
        if d['notes']:
            story.append(p('Supporting information','SectionHeading'))
            for note in d['notes']:story.append(p(note))
        story.append(Spacer(1,8));story.append(p('Source figures stay fixed while your practice ledger changes. Keep the original reference when recording the transaction.','SmallCopy'))
    doc.multiBuild(story)
    print(f'Rendered {len(documents)} source documents to {output}')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--case',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);a=parser.parse_args();render(a.case,a.out)
