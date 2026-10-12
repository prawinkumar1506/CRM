import {after} from 'next/server';
import {waConfig} from '../../../lib/integrations';
import {db,iso,hash,safeEqual} from '../../../lib/server';
import {processWebhook} from '../../../lib/webhook-processing';
import {dispatchOutbox} from '../../../lib/notifications';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(req:Request){const q=new URL(req.url).searchParams,e=await waConfig();if(e.WA_VERIFY_TOKEN&&q.get('hub.mode')==='subscribe'&&safeEqual(q.get('hub.verify_token')||'',e.WA_VERIFY_TOKEN))return new Response(q.get('hub.challenge'));return new Response('Not configured or invalid verification',{status:403})}
export async function POST(req:Request){try{const e=await waConfig();if(!e.WA_APP_SECRET)return new Response('Not configured',{status:503});if(Number(req.headers.get('content-length')||0)>1000000)return new Response('Too large',{status:413});const raw=await req.text();if(raw.length>1000000)return new Response('Too large',{status:413});const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(e.WA_APP_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw))).toString('hex');if(!safeEqual(req.headers.get('x-hub-signature-256')||'','sha256='+sig))return new Response('Invalid signature',{status:401});JSON.parse(raw);const id=await hash(raw);await db().prepare('INSERT OR IGNORE INTO webhook_inbox(id,payload,state,created) VALUES(?,?,?,?)').bind(id,raw,'pending',iso()).run();after(async()=>{try{await processWebhook(id);await dispatchOutbox(5)}catch{/* Persisted for recovery. */}});return Response.json({ok:true})}catch{return new Response('Could not persist webhook',{status:500})}}
