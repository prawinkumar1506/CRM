import {database} from './database';
import {waConfig,integrationStatus} from './integrations';
import {defaultNames,normalizePhone,summary,today} from './model';
export const db=()=>database;
export const uid=()=>crypto.randomUUID();
export const iso=()=>new Date().toISOString();
export const hash=async(s:string)=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
export async function passwordHash(password:string,salt='v2$'+uid()){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:salt.startsWith('v2$')?600000:100000,hash:'SHA-256'},key,256);
 return salt+':'+Buffer.from(bits).toString('hex');
}
export function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let r=0;for(let i=0;i<a.length;i++)r|=a.charCodeAt(i)^b.charCodeAt(i);return r===0}
export function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status})}
export function clean(v:unknown,max=200){return String(v??'').trim().slice(0,max)}
export async function getUser(req:Request){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)helio_session=([^;]+)/)?.[1];if(!token)return null;return db().prepare('SELECT u.id,u.name,u.username,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.active=1').bind(await hash(token),Date.now()).first<any>()}
export async function requireUser(req:Request){const u=await getUser(req);if(!u)fail('Please sign in again.',401);return u}
export function admin(u:any){if(u.role!=='admin')fail('Only the administrator can do this.',403)}
export async function getSettings(){const row=await db().prepare("SELECT value FROM settings WHERE key='workspace'").first<any>();return {hrPhone:'',ownerPhone:'',defaultNames,groups:[],autoSummary:true,scheduledReports:false,autoNotify:false,...(row?JSON.parse(row.value):{})}}
export async function customerAccess(id:string,u:any){const row=await db().prepare('SELECT * FROM customers WHERE id=?').bind(id).first<any>();if(!row)fail('Customer not found',404);if(u.role!=='admin'&&row.assigned!==u.id)fail('This customer is not assigned to you.',403);return {...JSON.parse(row.data),version:row.version,updated:row.updated}}
export async function event(customerId:string,u:any,text:string,kind='update'){await db().prepare('INSERT INTO events(id,customer_id,user_id,author,kind,text,created) VALUES(?,?,?,?,?,?,?)').bind(uid(),customerId,u.id,u.name,kind,text,iso()).run()}
export async function queue(text:string,customerId='',id:string=uid(),scheduled=false,forceDraft=false){
 const settings=await getSettings(),chunks=text.match(/[\s\S]{1,750}/g)||[''];
 await db().batch(chunks.map((chunk,i)=>{const value=chunks.length>1?`(${i+1}/${chunks.length}) ${chunk}`:chunk;const state=!forceDraft&&settings.hrPhone&&(scheduled||settings.autoNotify)?'queued':'draft';return db().prepare('INSERT OR IGNORE INTO outbox(id,recipient,customer_id,text,state,created) VALUES(?,?,?,?,?,?)').bind(i?`${id}-${i}`:id,normalizePhone(settings.hrPhone),customerId,value,state,iso())}));
}
export async function allCustomers(u:any){const statement=db().prepare(u.role==='admin'?'SELECT * FROM customers ORDER BY updated DESC':'SELECT * FROM customers WHERE assigned=? ORDER BY updated DESC');const rows=await (u.role==='admin'?statement:statement.bind(u.id)).all<any>();return rows.results.map(r=>({...JSON.parse(r.data),version:r.version,updated:r.updated}))}
export async function snapshot(u:any){const customers=await allCustomers(u);const filter=u.role==='admin'?'':' WHERE customer_id IN (SELECT id FROM customers WHERE assigned=?)';const query=async(table:string,suffix='')=>{const stmt=db().prepare(`SELECT * FROM ${table}${filter}${suffix}`);return (await (u.role==='admin'?stmt:stmt.bind(u.id)).all()).results};return {user:u,customers,users:(await db().prepare('SELECT id,name,username,role,active FROM users WHERE active=1').all()).results,settings:await getSettings(),events:await query('events',' ORDER BY created DESC LIMIT 300'),files:await query('files'),outbox:u.role==='admin'?(await db().prepare('SELECT * FROM outbox ORDER BY created DESC LIMIT 100').all()).results:[],integrations:await integrationStatus()}}
export function validateCustomer(input:any){
 const c={...input};c.eb=clean(c.eb,20).replace(/[\s-]/g,'');if(!/^\d{9,15}$/.test(c.eb))fail('Enter a valid 9–15 digit EB service connection number.');c.name=clean(c.name,100);if(!c.name)fail('Customer name is required.');c.phone=normalizePhone(clean(c.phone,20));if(c.phone&&!/^\d{10,15}$/.test(c.phone))fail('Use a valid phone number with country code.');c.group=clean(c.group,60)||'Ungrouped';c.kind=c.kind==='existing'?'existing':'new';c.priority=c.priority==='high'?'high':'normal';c.phase=['single','three'].includes(c.phase)?c.phase:'unknown';
 for(const k of ['capacity','load','usage']){c[k]=clean(c[k],20);if(c[k]&&(!Number.isFinite(Number(c[k]))||Number(c[k])<0))fail('Capacity, load and usage must be positive numbers.')}c.ebMobile=clean(c.ebMobile,20);c.ebSource=clean(c.ebSource,200)||'Not verified';
 if(!Array.isArray(c.stages)||!c.stages.length||c.stages.length>40)fail('Use between 1 and 40 stages.');const names=new Set(),ids=new Set();c.stages=c.stages.map((s:any)=>{const name=clean(s.name,100),id=clean(s.id,100);if(!name||!id||names.has(name.toLowerCase())||ids.has(id))fail('Stage names and IDs must be unique.');names.add(name.toLowerCase());ids.add(id);const due=clean(s.due,10);if(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||Number.isNaN(Date.parse(due))))fail('Use a valid follow-up date.');return {id,name,status:['pending','active','blocked','done','skipped'].includes(s.status)?s.status:'pending',due,note:clean(s.note,2000)}});
 if(!['pending','approved','rejected'].includes(c.internal))fail('Invalid owner approval.');if(!['pending','accepted','declined'].includes(c.decision))fail('Invalid customer decision.');return c;
}
export async function storeCustomer(c:any,version:number){const updated=iso();c.updated=updated;const result=await db().prepare('UPDATE customers SET eb=?,assigned=?,data=?,version=version+1,updated=? WHERE id=? AND version=?').bind(c.eb,c.assigned,JSON.stringify(c),updated,c.id,version).run();if(!result.meta.changes)fail('Someone else updated this customer. Refresh and try again.',409)}
export async function daily(u:any){if(u.role!=='admin')return;const s=await getSettings();if(!s.autoSummary||s.scheduledReports)return;const customers=await allCustomers(u);if(!customers.length)return;await queue(summary(customers),'','daily-'+today(),false,true)}
export async function sendOutbox(id:string){
 const e=await waConfig();if(!e.WA_TOKEN||!e.WA_PHONE_ID||!e.WA_TEMPLATE)fail('WhatsApp API is not connected. Use Web fallback.',409);const row=await db().prepare('SELECT * FROM outbox WHERE id=?').bind(id).first<any>();if(!row)fail('Message not found',404);if(!/^\d{10,15}$/.test(row.recipient))fail('Set the HR WhatsApp number first.');if(row.text.length>900)fail('Use the split daily report or Web fallback for this long message.');
 const lock=await db().prepare("UPDATE outbox SET state='sending' WHERE id=? AND state IN ('draft','queued','failed')").bind(id).run();if(!lock.meta.changes)fail('Already submitted. Review delivery status before retrying.');
 let accepted=false;
 try{const response=await fetch(`https://graph.facebook.com/${e.WA_API_VERSION||'v23.0'}/${e.WA_PHONE_ID}/messages`,{method:'POST',signal:AbortSignal.timeout(12000),headers:{Authorization:`Bearer ${e.WA_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:row.recipient,type:'template',template:{name:e.WA_TEMPLATE,language:{code:e.WA_LANGUAGE||'en'},components:[{type:'body',parameters:[{type:'text',text:row.text.replace(/\s+/g,' ')}]}]}})});const body=await response.json() as any;
  if(!response.ok){await db().prepare("UPDATE outbox SET state='failed' WHERE id=?").bind(id).run();fail('WhatsApp rejected this message. Check the token, approved template and recipient before retrying.',502)}
  accepted=true;const mid=body.messages?.[0]?.id;if(!mid)throw new Error('No message ID');await db().prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').bind('wa-message:'+mid,JSON.stringify({customerId:row.customer_id,phone:row.recipient,outboxId:id})).run();await db().prepare("UPDATE outbox SET state='accepted' WHERE id=?").bind(id).run();
 }catch(error:any){if(accepted||!error.status)await db().prepare("UPDATE outbox SET state='unknown' WHERE id=?").bind(id).run();throw error}
}
