import {db,getSettings,allCustomers,queue,sendOutbox,safeEqual} from './server';
import {today,summary} from './model';
import {integrationStatus} from './integrations';
import {recoverWebhooks} from './webhook-processing';
export async function dispatchOutbox(limit=20){const state=await integrationStatus();if(!state.whatsapp)return {sent:0,reason:'Business API not configured'};const rows=(await db().prepare("SELECT id FROM outbox WHERE state='queued' ORDER BY created LIMIT ?").bind(limit).all<any>()).results;let sent=0,failed=0;const deadline=Date.now()+40000;for(const r of rows){if(Date.now()>deadline)break;try{await sendOutbox(r.id);sent++}catch{failed++}}return {sent,failed}}
export async function scheduledReport(){await recoverWebhooks();const settings=await getSettings();if(settings.scheduledReports){const customers=await allCustomers({role:'admin'});if(customers.length){const key='report-snapshot:'+today();await db().prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').bind(key,summary(customers)).run();const saved=await db().prepare('SELECT value FROM settings WHERE key=?').bind(key).first<any>();await queue(saved.value,'','scheduled-'+today(),true)}}return dispatchOutbox(40)}
export function cronAuthorized(req:Request){const secret=process.env.CRON_SECRET;return !!secret&&safeEqual(req.headers.get('authorization')||'','Bearer '+secret)}

