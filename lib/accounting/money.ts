// All ledger values are safe integer cents. No binary-float summation in journals.
export function cents(value: number): number { const n=Math.round((value+Number.EPSILON)*100); if(!Number.isSafeInteger(n))throw new Error('Amount is outside the supported range.'); return n; }
export function parseMoney(value: string): number {
 const clean=value.trim().replace(/,/g,'');
 if(!/^-?\d+(\.\d{0,2})?$/.test(clean)) throw new Error('Enter an amount with at most two decimal places.');
 const negative=clean.startsWith('-'); const [whole,fraction='']=clean.replace('-','').split('.');
 const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(n)||n>100_000_000_000) throw new Error('Amount is too large.');
 return negative?-n:n;
}
export function money(value:number,currency='AUD'):string { return new Intl.NumberFormat('en-AU',{style:'currency',currency,minimumFractionDigits:2}).format(value/100); }
export function compactMoney(value:number):string { const a=Math.abs(value); return `${value<0?'-':''}$${new Intl.NumberFormat('en-AU',{notation:'compact',maximumFractionDigits:1}).format(a/100)}`; }
export function numberMoney(value:number):string { return new Intl.NumberFormat('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100); }
export function pct(amount:number,basisPoints:number):number { return Math.round(amount*basisPoints/10000); }
export function sum(values:number[]):number { return values.reduce((a,b)=>a+b,0); }
export function isoMonth(month:number):string { return `2025-${String(month).padStart(2,'0')}`; }
export function monthEnd(month:string):string { const [y,m]=month.split('-').map(Number);return `${month}-${new Date(Date.UTC(y,m,0)).getUTCDate()}`; }
export function addDays(date:string,days:number):string { const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10); }
export function daysBetween(a:string,b:string):number { return Math.round((Date.parse(`${b}T12:00:00Z`)-Date.parse(`${a}T12:00:00Z`))/86400000); }
export function validDate(s:string):boolean { return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(`${s}T12:00:00Z`).toISOString().slice(0,10)===s; }
