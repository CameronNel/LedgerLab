/** Bounded calculation engine. No eval, network functions, macros or external links. */
import {csv} from '../accounting/exports';
import {DESKTOP_LIMITS,type DesktopWorksheet} from './types';
import {address,position} from './workbook-model';
export type CellValue=number|string|boolean;
type RangeValue={values:CellValue[];rows:number;columns:number};
type Value=CellValue|RangeValue;
type Expr={type:'literal';value:CellValue}|{type:'ref';ref:string;sheet?:string}|{type:'range';from:string;to:string;sheet?:string}|{type:'binary';op:string;left:Expr;right:Expr}|{type:'unary';op:string;value:Expr}|{type:'call';name:string;args:Expr[]};
export const FORMULA_FUNCTIONS=['SUM','AVERAGE','MIN','MAX','COUNT','COUNTA','COUNTBLANK','ABS','ROUND','ROUNDUP','ROUNDDOWN','INT','MOD','IF','IFERROR','AND','OR','NOT','SUMIF','SUMIFS','COUNTIF','COUNTIFS','AVERAGEIF','SUMPRODUCT','XLOOKUP','VLOOKUP','INDEX','MATCH','CONCAT','CONCATENATE','TRIM','UPPER','LOWER','LEN','LEFT','RIGHT','MID','VALUE','ISNUMBER','ISTEXT','ISBLANK','DATE','YEAR','MONTH','DAY','EOMONTH','EDATE','TODAY','NA','SUBTOTAL'] as const;
const FUNCTIONS=new Set<string>(FORMULA_FUNCTIONS);
const numeric=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const errorPattern=/^#(?:REF!|NAME\?|VALUE!|NUM!|DIV\/0!|N\/A|CIRC!|ERROR!|LIMIT!|CALC!)$/;
export const cellAddress=address;
const isError=(v:unknown):boolean=>typeof v==='string'&&errorPattern.test(v);
const range=(v:Value):v is RangeValue=>typeof v==='object';
const flat=(v:Value):CellValue[]=>range(v)?v.values:[v];
const scalar=(v:Value):CellValue=>{if(range(v))throw Error('#VALUE!');return v;};
const number=(v:Value):number=>{const x=scalar(v);if(isError(x))throw Error(String(x));if(typeof x==='number')return x;if(typeof x==='boolean')return Number(x);if(x==='')return 0;if(numeric.test(x.trim()))return Number(x);throw Error('#VALUE!');};
const text=(v:Value):string=>{const x=scalar(v);if(isError(x))throw Error(String(x));return typeof x==='boolean'?(x?'TRUE':'FALSE'):String(x);};
const truth=(v:Value):boolean=>{const x=scalar(v);if(typeof x==='boolean')return x;if(typeof x==='string'&&/^(true|false)$/i.test(x))return x.toUpperCase()==='TRUE';return number(x)!==0;};
export function parseFormula(raw:string):Expr{
  if(!raw.startsWith('=')||raw.length>DESKTOP_LIMITS.cellLength)throw Error('#ERROR!');
  const source=raw.slice(1),tokens:string[]=[];let offset=0;
  while(offset<source.length){if(/\s/.test(source[offset])){offset++;continue;}
    const m=/^(?:"(?:[^"]|"")*"|'(?:[^']|'')*'|#(?:REF!|NAME\?|VALUE!|NUM!|DIV\/0!|N\/A|CIRC!|ERROR!|LIMIT!)|(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?|\$?[A-Za-z_][A-Za-z0-9_.$]*|<=|>=|<>|[()+\-*/,:;!^%&=<>])/.exec(source.slice(offset));
    if(!m)throw Error('#NAME?');tokens.push(m[0]);offset+=m[0].length;if(tokens.length>600)throw Error('#ERROR!');
  }
  let i=0,depth=0;const take=(s:string)=>{if(tokens[i]!==s)throw Error('#ERROR!');i++;};
  const ref=(t:string,sheet?:string):Expr=>{position(t);if(tokens[i]===':'){i++;const to=tokens[i++];position(to??'');return {type:'range',from:t,to,sheet};}return {type:'ref',ref:t,sheet};};
  function primary():Expr{if(++depth>80)throw Error('#ERROR!');try{
    const t=tokens[i++];if(!t)throw Error('#ERROR!');
    if(t==='+'||t==='-')return {type:'unary',op:t,value:primary()};
    if(t==='('){const v=compare();take(')');return v;}
    if(t[0]==='"')return {type:'literal',value:t.slice(1,-1).replaceAll('""','"')};
    if(isError(t))return {type:'literal',value:t};
    if(numeric.test(t))return {type:'literal',value:Number(t)};
    if(tokens[i]==='!'){i++;const name=t[0]==="'"?t.slice(1,-1).replaceAll("''","'"):t;return ref(tokens[i++]??'',name);}
    if(tokens[i]==='('){const name=t.toUpperCase();if(!FUNCTIONS.has(name))throw Error('#NAME?');i++;const args:Expr[]=[];
      if(tokens[i]!==')')do{if(args.length)i++;args.push(tokens[i]===','||tokens[i]===';'||tokens[i]===')'?{type:'literal',value:''}:compare());}while(tokens[i]===','||tokens[i]===';');
      take(')');return {type:'call',name,args};}
    if(/^(TRUE|FALSE)$/i.test(t))return {type:'literal',value:t.toUpperCase()==='TRUE'};
    if(/^\$?[A-Za-z]+\$?[1-9]\d*$/.test(t))return ref(t);
    throw Error('#NAME?');
  }finally{depth--;}}
  function postfix():Expr{let n=primary();while(tokens[i]==='%'){i++;n={type:'unary',op:'%',value:n};}return n;}
  function binary(lower:()=>Expr,ops:string[]):Expr{let n=lower();while(ops.includes(tokens[i])){const op=tokens[i++];n={type:'binary',op,left:n,right:lower()};}return n;}
  const power=()=>binary(postfix,['^']);const product=()=>binary(power,['*','/']);const sum=()=>binary(product,['+','-']);const concat=()=>binary(sum,['&']);const compare=()=>binary(concat,['=','<>','<=','>=','<','>']);
  const result=compare();if(i!==tokens.length)throw Error('#ERROR!');return result;
}
const compareValues=(a:CellValue,b:CellValue)=>{if(isError(a))throw Error(String(a));if(isError(b))throw Error(String(b));if(a==='')a=typeof b==='number'?0:'';if(b==='')b=typeof a==='number'?0:'';
  if(typeof a==='string'&&typeof b==='string')return a.toLowerCase().localeCompare(b.toLowerCase());if(typeof a===typeof b)return a<b?-1:a>b?1:0;
  return (typeof a==='number'?0:typeof a==='string'?1:2)-(typeof b==='number'?0:typeof b==='string'?1:2);};
function criterion(value:CellValue,rule:CellValue):boolean{
  if(isError(value))return false;
  const m=typeof rule==='string'?/^(<=|>=|<>|<|>|=)?(.*)$/s.exec(rule):null,op=m?.[1]??'=',raw=m?m[2]:rule;
  const right:CellValue=typeof raw==='string'&&numeric.test(raw)?Number(raw):raw;
  if(typeof right==='string'&&/[?*~]/.test(right)&&(op==='='||op==='<>')){
    let source='';for(let i=0;i<right.length;i++){const c=right[i];if(c==='~'&&i+1<right.length)source+=right[++i].replace(/[.*+?^${}()|[\]\\]/g,'\\$&');else source+=c==='*'?'.*':c==='?'?'.':c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
    const result=new RegExp('^'+source+'$','i').test(String(value));return op==='='?result:!result;
  }
  const c=compareValues(value,right);return op==='='?c===0:op==='<>'?c!==0:op==='>'?c>0:op==='<'?c<0:op==='>='?c>=0:c<=0;
}
export const dateSerial=(date:Date)=>Math.floor((Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate())-Date.UTC(1899,11,30))/86400000);
export const serialDate=(serial:number)=>new Date(Date.UTC(1899,11,30)+Math.trunc(serial)*86400000);
export function evaluateWorkbook(sheets:Pick<DesktopWorksheet,'name'|'cells'>[]):CellValue[][][]{
  const cache=new Map<string,CellValue>(),visiting=new Set<string>(),parsed=new Map<string,Expr>();let operations=0;
  function at(si:number,r:number,c:number):CellValue{
    if(si<0||r<0||c<0||r>=DESKTOP_LIMITS.rows||c>=DESKTOP_LIMITS.columns)throw Error('#REF!');
    const key=`${si}:${r}:${c}`;if(cache.has(key))return cache.get(key)!;if(visiting.has(key))throw Error('#CIRC!');if(visiting.size>200)throw Error('#LIMIT!');
    const raw=sheets[si].cells[r]?.[c]??'';if(!raw)return '';visiting.add(key);let value:CellValue;
    try{if(raw.startsWith("'"))value=raw.slice(1);else if(raw.startsWith('=')){let expr=parsed.get(raw);if(!expr){expr=parseFormula(raw);parsed.set(raw,expr);}value=scalar(evaluate(expr,si));}
      else if(numeric.test(raw.trim()))value=Number(raw);else if(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)%$/.test(raw.trim()))value=Number(raw.trim().slice(0,-1))/100;
      else if(/^(TRUE|FALSE)$/i.test(raw))value=raw.toUpperCase()==='TRUE';else value=raw;
      if(typeof value==='number'&&!Number.isFinite(value))throw Error('#NUM!');
    }catch(error){value=error instanceof Error&&isError(error.message)?error.message:'#ERROR!';}finally{visiting.delete(key);}cache.set(key,value);return value;
  }
  function evaluate(n:Expr,si:number):Value{
    if(++operations>2000000)throw Error('#LIMIT!');
    if(n.type==='literal')return n.value;
    if(n.type==='ref'||n.type==='range'){
      const target=n.sheet?sheets.findIndex(s=>s.name.toLowerCase()===n.sheet!.toLowerCase()):si;
      if(n.type==='ref'){const [r,c]=position(n.ref);return at(target,r,c);}
      const [r1,c1]=position(n.from),[r2,c2]=position(n.to),values:CellValue[]=[];
      if(target<0||Math.max(r1,r2)>=DESKTOP_LIMITS.rows||Math.max(c1,c2)>=DESKTOP_LIMITS.columns)throw Error('#REF!');
      for(let r=Math.min(r1,r2);r<=Math.max(r1,r2);r++)for(let c=Math.min(c1,c2);c<=Math.max(c1,c2);c++)values.push(at(target,r,c));return {values,rows:Math.abs(r2-r1)+1,columns:Math.abs(c2-c1)+1};
    }
    if(n.type==='unary'){const value=number(evaluate(n.value,si));return n.op==='-'?-value:n.op==='%'?value/100:value;}
    if(n.type==='binary'){
      const a=evaluate(n.left,si),b=evaluate(n.right,si);if(n.op==='&')return text(a)+text(b);
      if(['=','<>','<=','>=','<','>'].includes(n.op)){const c=compareValues(scalar(a),scalar(b));return n.op==='='?c===0:n.op==='<>'?c!==0:n.op==='<'?c<0:n.op==='>'?c>0:n.op==='<='?c<=0:c>=0;}
      const x=number(a),y=number(b);if(n.op==='/'&&y===0)throw Error('#DIV/0!');return n.op==='+'?x+y:n.op==='-'?x-y:n.op==='*'?x*y:n.op==='^'?x**y:x/y;
    }
    const get=(i:number)=>{if(!n.args[i])throw Error('#VALUE!');return evaluate(n.args[i],si);},num=(i:number)=>number(get(i)),str=(i:number)=>text(get(i)),arity=(min:number,max=min)=>{if(n.args.length<min||n.args.length>max)throw Error('#VALUE!');};
    const name=n.name;
    if(name==='IF'){arity(2,3);return truth(get(0))?get(1):n.args[2]?get(2):false;}
    if(name==='IFERROR'){arity(2);try{const value=get(0);return isError(value)?get(1):value;}catch{return get(1);}}
    if(name==='NA'){arity(0);return '#N/A';}
    if(name==='TODAY'){arity(0);return dateSerial(new Date());}
    if(['ISNUMBER','ISTEXT','ISBLANK'].includes(name)){arity(1);const value=get(0);if(name==='ISBLANK'){const arg=n.args[0];if(arg.type!=='ref')return false;const index=arg.sheet?sheets.findIndex(s=>s.name.toLowerCase()===arg.sheet!.toLowerCase()):si;if(index<0)return false;const [r,c]=position(arg.ref);return !(sheets[index].cells[r]?.[c]??'');}return name==='ISNUMBER'?typeof value==='number':typeof value==='string'&&!isError(value);}
    if(name==='NOT'){arity(1);return !truth(get(0));}
    if(name==='AND'||name==='OR'){arity(1,255);const values=n.args.flatMap(x=>{const v=evaluate(x,si);return range(v)||x.type==='ref'?flat(v).filter(z=>typeof z==='number'||typeof z==='boolean'||isError(z)):[scalar(v)];}).map(truth);if(!values.length)throw Error('#VALUE!');return name==='AND'?values.every(Boolean):values.some(Boolean);}
    if(['SUM','AVERAGE','MIN','MAX','COUNT','COUNTA','COUNTBLANK'].includes(name)){
      const args=n.args.map(x=>evaluate(x,si)),values=args.flatMap(flat);
      if(name==='COUNT')return args.reduce<number>((total,v,i)=>total+(range(v)?v.values.filter(x=>typeof x==='number').length:n.args[i].type==='ref'?Number(typeof v==='number'):Number(typeof v==='number'||typeof v==='boolean'||typeof v==='string'&&numeric.test(v))),0);
      if(name==='COUNTA')return args.reduce<number>((total,v,i)=>{const arg=n.args[i];if(arg.type==='ref'){const idx=arg.sheet?sheets.findIndex(s=>s.name.toLowerCase()===arg.sheet!.toLowerCase()):si;const [r,c]=position(arg.ref);return total+Number(idx<0||!!sheets[idx].cells[r]?.[c]);}if(arg.type==='range'){const idx=arg.sheet?sheets.findIndex(s=>s.name.toLowerCase()===arg.sheet!.toLowerCase()):si;if(idx<0)return total+1;const [r1,c1]=position(arg.from),[r2,c2]=position(arg.to);let count=0;for(let r=Math.min(r1,r2);r<=Math.max(r1,r2);r++)for(let c=Math.min(c1,c2);c<=Math.max(c1,c2);c++)if(sheets[idx].cells[r]?.[c])count++;return total+count;}return total+flat(v).length;},0);if(name==='COUNTBLANK')return values.filter(v=>v==='').length;
      const error=values.find(isError);if(error)throw Error(String(error));
      const numbers=args.flatMap((v,i)=>range(v)?v.values.filter((x):x is number=>typeof x==='number'):n.args[i].type==='ref'?(typeof v==='number'?[v]:[]):[number(v)]);
      if(name==='SUM')return numbers.reduce((a,b)=>a+b,0);if(name==='AVERAGE'){if(!numbers.length)throw Error('#DIV/0!');return numbers.reduce((a,b)=>a+b,0)/numbers.length;}
      return numbers.length?(name==='MIN'?Math.min(...numbers):Math.max(...numbers)):0;
    }
    if(['ABS','ROUND','ROUNDUP','ROUNDDOWN','INT','MOD'].includes(name)){
      arity(['ABS','INT'].includes(name)?1:2);const value=num(0);if(name==='ABS')return Math.abs(value);if(name==='INT')return Math.floor(value);
      if(name==='MOD'){const by=num(1);if(!by)throw Error('#DIV/0!');return value-by*Math.floor(value/by);}
      const digits=Math.trunc(num(1));if(Math.abs(digits)>15)throw Error('#NUM!');const p=10**digits,scaled=Math.abs(value)*p;
      return Math.sign(value)*(name==='ROUNDUP'?Math.ceil(scaled-Number.EPSILON*scaled):name==='ROUNDDOWN'?Math.floor(scaled+Number.EPSILON*scaled):Math.round(scaled+Number.EPSILON*scaled))/p;
    }
    if(['SUMIF','COUNTIF','AVERAGEIF','SUMIFS','COUNTIFS'].includes(name)){
      const plural=name.endsWith('IFS'),count=name.startsWith('COUNT');
      if(plural){if(n.args.length<(count?2:3)||(n.args.length-(count?0:1))%2)throw Error('#VALUE!');}else arity(2,count?2:3);
      const base=flat(get(plural?0:n.args.length===3?2:0)),pairs:{values:CellValue[];rule:CellValue}[]=[];
      if(plural){for(let i=count?0:1;i<n.args.length;i+=2)pairs.push({values:flat(get(i)),rule:scalar(get(i+1))});}else pairs.push({values:flat(get(0)),rule:scalar(get(1))});
      if(pairs.some(p=>p.values.length!==base.length))throw Error('#VALUE!');let sum=0,matches=0,numbers=0;
      base.forEach((v,i)=>{if(pairs.every(p=>criterion(p.values[i],p.rule))){matches++;if(isError(v)&&!count)throw Error(String(v));if(typeof v==='number'){sum+=v;numbers++;}}});
      if(count)return matches;if(name==='AVERAGEIF'){if(!numbers)throw Error('#DIV/0!');return sum/numbers;}return sum;
    }
    if(name==='SUMPRODUCT'){
      const arrays=n.args.map(x=>flat(evaluate(x,si)));if(!arrays.length||arrays.some(a=>a.length!==arrays[0].length))throw Error('#VALUE!');
      return arrays[0].reduce<number>((sum,_,i)=>sum+arrays.reduce<number>((p,a)=>{if(isError(a[i]))throw Error(String(a[i]));return p*(typeof a[i]==='number'?a[i] as number:0);},1),0);
    }
    if(name==='XLOOKUP'){
      arity(3,6);const needle=scalar(get(0)),lookup=flat(get(1)),result=flat(get(2));if(lookup.length!==result.length)throw Error('#VALUE!');
      const mode=n.args[4]?num(4):0,search=n.args[5]?num(5):1;if(![0,2,-1,1].includes(mode)||![1,-1].includes(search))throw Error('#VALUE!');
      const ids=Array.from({length:lookup.length},(_,i)=>i);if(search===-1)ids.reverse();let found=ids.find(i=>mode===2?criterion(lookup[i],needle):compareValues(lookup[i],needle)===0);
      if(found===undefined&&(mode===-1||mode===1)){const candidates=ids.filter(i=>mode===-1?compareValues(lookup[i],needle)<0:compareValues(lookup[i],needle)>0);candidates.sort((a,b)=>compareValues(lookup[a],lookup[b])*(mode===-1?-1:1));found=candidates[0];}
      return found===undefined?n.args[3]?get(3):'#N/A':result[found]===''?0:result[found];
    }
    if(name==='VLOOKUP'){
      arity(3,4);const needle=scalar(get(0)),table=get(1),col=Math.trunc(num(2));if(!range(table)||col<1||col>table.columns)throw Error('#REF!');const approximate=n.args[3]?truth(get(3)):true;let found=-1;
      for(let r=0;r<table.rows;r++){const cmp=compareValues(table.values[r*table.columns],needle);if(cmp===0){found=r;break;}if(approximate&&cmp<0)found=r;}
      return found<0?'#N/A':(table.values[found*table.columns+col-1]===''?0:table.values[found*table.columns+col-1]);
    }
    if(name==='MATCH'){
      arity(2,3);const needle=scalar(get(0)),values=flat(get(1)),mode=n.args[2]?num(2):1;let index=-1;if(![0,1,-1].includes(mode))throw Error('#VALUE!');
      for(let i=0;i<values.length;i++){const cmp=compareValues(values[i],needle);if(mode===0?criterion(values[i],needle):cmp===0){index=i;break;}if(mode===1&&cmp<0||mode===-1&&cmp>0)index=i;}return index<0?'#N/A':index+1;
    }
    if(name==='INDEX'){arity(2,3);const value=get(0);if(!range(value))throw Error('#VALUE!');const r=Math.trunc(num(1))-1,c=n.args[2]?Math.trunc(num(2))-1:0;if(r<0||c<0||r>=value.rows||c>=value.columns)throw Error('#REF!');return (value.values[r*value.columns+c]===''?0:value.values[r*value.columns+c]);}
    if(name==='SUBTOTAL'){arity(2,30);const code=num(0),map:Record<number,string>={1:'AVERAGE',2:'COUNT',3:'COUNTA',4:'MAX',5:'MIN',9:'SUM',101:'AVERAGE',102:'COUNT',103:'COUNTA',104:'MAX',105:'MIN',109:'SUM'};if(!map[code])throw Error('#VALUE!');return evaluate({type:'call',name:map[code],args:n.args.slice(1)},si);}
    if(name==='CONCAT'||name==='CONCATENATE')return n.args.flatMap(x=>flat(evaluate(x,si))).map(text).join('');
    if(['TRIM','UPPER','LOWER','LEN','LEFT','RIGHT','MID','VALUE'].includes(name)){
      arity(name==='MID'?3:1,name==='LEFT'||name==='RIGHT'?2:name==='MID'?3:1);const value=str(0);
      if(name==='VALUE')return number(value.replace(/,/g,''));if(name==='LEN')return value.length;if(name==='TRIM')return value.trim().replace(/ +/g,' ');if(name==='UPPER')return value.toUpperCase();if(name==='LOWER')return value.toLowerCase();
      const nchar=n.args[1]?Math.trunc(num(1)):1;if(nchar<0||name==='MID'&&nchar<1)throw Error('#VALUE!');if(name==='MID'){const len=Math.trunc(num(2));if(len<0)throw Error('#VALUE!');return value.slice(nchar-1,nchar-1+len);}return name==='LEFT'?value.slice(0,nchar):nchar?value.slice(-nchar):'';
    }
    if(['DATE','YEAR','MONTH','DAY','EOMONTH','EDATE'].includes(name)){
      arity(name==='DATE'?3:name==='EOMONTH'||name==='EDATE'?2:1);if(name==='DATE'){let y=Math.trunc(num(0));if(y>=0&&y<1900)y+=1900;return dateSerial(new Date(Date.UTC(y,num(1)-1,num(2))));}
      const date=serialDate(num(0));if(name==='YEAR')return date.getUTCFullYear();if(name==='MONTH')return date.getUTCMonth()+1;if(name==='DAY')return date.getUTCDate();
      const offset=Math.trunc(num(1)),end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+offset+1,0));if(name==='EDATE')end.setUTCDate(Math.min(date.getUTCDate(),end.getUTCDate()));return dateSerial(end);
    }
    throw Error('#NAME?');
  }
  return sheets.map((s,si)=>s.cells.map((row,r)=>row.map((_,c)=>at(si,r,c))));
}
export function evaluateGrid(cells:string[][]):CellValue[][]{return evaluateWorkbook([{name:'Workpaper',cells}])[0];}
export function worksheetCSV(cells:string[][]):string{const values=evaluateGrid(cells);return csv(values[0]?.map(String)??[],values.slice(1).map(row=>row.map(v=>typeof v==='boolean'?(v?'TRUE':'FALSE'):v)));}
export {workbookXLSX,worksheetXLSX} from './workbook-io';
