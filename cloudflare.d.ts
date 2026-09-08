// The hosted runtime supplies these bindings. Narrow declarations keep app queries typed.
interface D1Result<T=unknown>{results:T[];success:boolean;meta:{changes:number;[key:string]:unknown};}
interface D1PreparedStatement{bind(...values:unknown[]):D1PreparedStatement;first<T=Record<string,unknown>>(columnName?:string):Promise<T|null>;all<T=Record<string,unknown>>():Promise<D1Result<T>>;run<T=unknown>():Promise<D1Result<T>>;raw<T=unknown[]>():Promise<T[]>;}
interface D1Database{prepare(sql:string):D1PreparedStatement;batch<T=unknown>(statements:D1PreparedStatement[]):Promise<D1Result<T>[]>;exec(sql:string):Promise<{count:number;duration:number}>;}
interface Fetcher{fetch(input:Request|string,init?:RequestInit):Promise<Response>;}
declare module 'cloudflare:workers'{export const env:{DB:D1Database;BUCKET?:unknown;[key:string]:unknown};}
