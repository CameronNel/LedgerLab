'use client';
import type { ReactNode } from 'react';
import { ArrowUpRight, Check, CircleHelp, Download, FileText, Search, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from '@/components/ui/select';
import { Table,TableHeader,TableBody,TableRow,TableHead,TableCell } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip,TooltipTrigger,TooltipContent } from '@/components/ui/tooltip';
import { money, numberMoney } from '@/lib/accounting/money';

export function Money({value,muted=false,signed=false}:{value:number;muted?:boolean;signed?:boolean}){return <span className={`money ${muted?'text-muted-foreground':''} ${value<0?'negative':''}`}>{signed&&value>0?'+':''}{money(value)}</span>;}
export function Amount({value,zero='—'}:{value:number;zero?:string}){return <span className={`money ${value<0?'negative':''}`}>{value===0?zero:value<0?`(${numberMoney(-value)})`:numberMoney(value)}</span>;}
export function Panel({title,subtitle,action,children,className=''}:{title?:ReactNode;subtitle?:ReactNode;action?:ReactNode;children:ReactNode;className?:string}){return <section className={`panel ${className}`}>{(title||action)&&<div className="panel-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>}{children}</section>;}
export function Stat({label,value,detail,icon,accent=false}:{label:string;value:ReactNode;detail?:ReactNode;icon?:ReactNode;accent?:boolean}){return <div className={`stat ${accent?'stat-accent':''}`}><div className="stat-label">{label}{icon}</div><div className="stat-value">{value}</div>{detail&&<div className="stat-detail">{detail}</div>}</div>;}
export function SelectField({value,onChange,options,label,className='',disabled=false}:{value:string;onChange:(s:string)=>void;options:{value:string;label:string}[];label:string;className?:string;disabled?:boolean}){return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} className={`select-field ${className}`}><SelectValue placeholder={label}/></SelectTrigger><SelectContent position="popper">{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;}
export function SearchField({value,onChange,placeholder='Search…'}:{value:string;onChange:(v:string)=>void;placeholder?:string}){return <div className="search-field"><Search size={17}/><Input aria-label={placeholder} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/>{value&&<button aria-label="Clear search" onClick={()=>onChange('')}><X size={16}/></button>}</div>;}
export function Status({children,tone='neutral'}:{children:ReactNode;tone?:'neutral'|'success'|'warning'|'danger'|'blue'}){return <Badge variant="outline" className={`status status-${tone}`}>{children}</Badge>;}
export function EmptyState({title,description,action}:{title:string;description?:string;action?:ReactNode}){return <div className="empty-state"><FileText size={30}/><h3>{title}</h3>{description&&<p>{description}</p>}{action}</div>;}
export function Callout({children,tone='blue',title}:{children:ReactNode;tone?:'blue'|'warning'|'success';title?:string}){return <div className={`callout callout-${tone}`}>{tone==='warning'?<AlertTriangle size={19}/>:tone==='success'?<Check size={19}/>:<CircleHelp size={19}/>}<div>{title&&<strong>{title}</strong>}<div>{children}</div></div></div>;}
export function Completion({done,total,label}:{done:number;total:number;label?:string}){return <div className="completion"><div><span>{label??'Completed'}</span><strong>{done} / {total}</strong></div><Progress value={total?done/total*100:0}/></div>;}
export function DataTable({headers,children,caption,className=''}:{headers:ReactNode[];children:ReactNode;caption?:string;className?:string}){return <div className={`data-table ${className}`}><Table>{caption&&<caption className="sr-only">{caption}</caption>}<TableHeader><TableRow>{headers.map((h,i)=><TableHead key={i}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{children}</TableBody></Table></div>;}
export {TableRow as Row,TableCell as Cell,Button,Input};
export function Help({text}:{text:string}){return <Tooltip><TooltipTrigger asChild><button className="help-icon" aria-label={text}><CircleHelp size={15}/></button></TooltipTrigger><TooltipContent className="max-w-sm text-sm">{text}</TooltipContent></Tooltip>;}
export function SmallLink({children,onClick}:{children:ReactNode;onClick:()=>void}){return <button className="small-link" onClick={onClick}>{children}<ArrowUpRight size={15}/></button>;}
export function DownloadButton({children='Export CSV',onClick}:{children?:ReactNode;onClick:()=>void}){return <Button variant="outline" onClick={onClick}><Download size={16}/>{children}</Button>;}
export function PageHeading({eyebrow,title,description,actions}:{eyebrow?:string;title:string;description?:string;actions?:ReactNode}){return <div className="page-heading"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="page-actions">{actions}</div>}</div>;}
