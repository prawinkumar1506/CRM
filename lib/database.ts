import {Pool,types} from 'pg';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
types.setTypeParser(20,v=>Number(v));
let pool:Pool|undefined,sqlite:DatabaseSync|undefined;
function pg(){if(!pool){pool=new Pool({connectionString:process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,ssl:{rejectUnauthorized:true,...(process.env.DATABASE_CA_CERT?{ca:process.env.DATABASE_CA_CERT}:{})}});pool.on('error',()=>{})}return pool}
function local(){if(process.env.VERCEL||process.env.NODE_ENV==='production'&&!process.env.ALLOW_LOCAL_DB)throw new Error('Configure Supabase DATABASE_URL before using Helio.');if(!sqlite){mkdirSync('.data',{recursive:true});sqlite=new DatabaseSync('.data/helio.db');sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;')}return sqlite}
export function postgresSQL(input:string){let s=input.trim(),ignore=/^INSERT OR IGNORE/i.test(s),replace=/^INSERT OR REPLACE/i.test(s);s=s.replace(/^INSERT OR (IGNORE|REPLACE)/i,'INSERT');let n=0;s=s.replace(/'(?:''|[^'])*'|\?/g,m=>m==='?'?'$'+(++n):m);s=s.replace(/\b(FROM|JOIN|UPDATE|INTO)\s+(users|sessions|settings|customers|events|files|outbox|attempts|webhook_inbox)\b/gi,(_,a,t)=>a+' helio.'+t);if(ignore)s+=' ON CONFLICT DO NOTHING';if(replace)s+=' ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value';return s}
class Statement{
 constructor(public sql:string,public args:any[]=[]){ }
 bind(...args:any[]){return new Statement(this.sql,args.map(v=>v===undefined?null:v))}
 async all<T=any>():Promise<{results:T[]}>{if(process.env.DATABASE_URL){const r=await pg().query(postgresSQL(this.sql),this.args);return {results:r.rows}}return {results:local().prepare(this.sql).all(...this.args) as T[]}}
 async first<T=any>():Promise<T|null>{return (await this.all<T>()).results[0]||null}
 async run(){if(process.env.DATABASE_URL){const r=await pg().query(postgresSQL(this.sql),this.args);return {meta:{changes:r.rowCount||0}}}return {meta:{changes:Number(local().prepare(this.sql).run(...this.args).changes)}}}
}
export const database={prepare:(s:string)=>new Statement(s),batch:async(statements:Statement[])=>{if(process.env.DATABASE_URL){const c=await pg().connect();try{await c.query('BEGIN');for(const s of statements)await c.query(postgresSQL(s.sql),s.args);await c.query('COMMIT')}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}else{const d=local();d.exec('BEGIN');try{for(const s of statements)d.prepare(s.sql).run(...s.args);d.exec('COMMIT')}catch(e){d.exec('ROLLBACK');throw e}}}};
