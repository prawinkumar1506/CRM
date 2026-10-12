import {cronAuthorized,scheduledReport} from '../../../../lib/notifications';
import {db} from '../../../../lib/server';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(req:Request){if(!cronAuthorized(req))return Response.json({error:'Unauthorized'},{status:401});try{const result=await scheduledReport();await db().prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()).run();await db().prepare('DELETE FROM attempts WHERE expires<?').bind(Date.now()).run();await db().prepare("INSERT INTO settings(key,value) VALUES('last-cron',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify({at:new Date().toISOString(),...result})).run();return Response.json(result)}catch{return Response.json({error:'Daily report could not complete. Review configuration and notification outbox.'},{status:500})}}
