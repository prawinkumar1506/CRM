import {db,queue,getSettings,iso} from './server';
export async function processWebhook(id:string){
 const stored=await db().prepare('SELECT * FROM webhook_inbox WHERE id=?').bind(id).first<any>();if(!stored||stored.state==='done')return;
 const payload=JSON.parse(stored.payload),settings=await getSettings();const customers=(await db().prepare('SELECT data FROM customers').all<any>()).results.map(r=>JSON.parse(r.data));let retry=false;
 for(const entry of payload.entry||[])for(const change of entry.changes||[]){
  for(const status of change.value?.statuses||[]){if(!['sent','delivered','read','failed'].includes(status.status))continue;const mapped=await db().prepare('SELECT value FROM settings WHERE key=?').bind('wa-message:'+status.id).first<any>();if(!mapped){retry=true;continue}const ref=JSON.parse(mapped.value);await db().prepare('INSERT OR IGNORE INTO events(id,customer_id,user_id,author,kind,text,created) VALUES(?,?,?,?,?,?,?)').bind('wa-status:'+status.id+':'+status.status,ref.customerId||'','whatsapp','WhatsApp Business','delivery',`Message ${status.status}${status.errors?.[0]?.title?': '+status.errors[0].title:''}. ID: ${status.id}`,iso()).run();if(ref.outboxId){const allowed=status.status==='read'?['accepted','sending','unknown','sent','delivered']:status.status==='delivered'?['accepted','sending','unknown','sent']:['accepted','sending','unknown'];await db().prepare(`UPDATE outbox SET state=? WHERE id=? AND state IN (${allowed.map(()=>'?').join(',')})`).bind(status.status,ref.outboxId,...allowed).run()}}
  for(const m of change.value?.messages||[]){if(!m.id||!m.from)continue;const text=String(m.text?.body||m.button?.text||m.interactive?.button_reply?.title||`Received ${m.type} message. Review the attachment in WhatsApp.`).slice(0,6000);let c:any;
   if(m.context?.id){const mapped=await db().prepare('SELECT value FROM settings WHERE key=?').bind('wa-message:'+m.context.id).first<any>();if(mapped){const ref=JSON.parse(mapped.value);if(ref.phone===m.from)c=customers.find(x=>x.id===ref.customerId)}}
   if(!c){const refs=customers.filter(x=>(m.from===settings.ownerPhone||m.from===x.phone)&&new RegExp('(?:^|\\D)'+x.eb+'(?:$|\\D)').test(text));if(refs.length===1)c=refs[0]}
   if(!c){const matches=customers.filter(x=>x.phone===m.from);if(matches.length===1)c=matches[0]}
   const stamp=Number(m.timestamp)*1000;const created=Number.isFinite(stamp)&&stamp>0?new Date(stamp).toISOString():iso();await db().prepare('INSERT OR IGNORE INTO events(id,customer_id,user_id,author,kind,text,created) VALUES(?,?,?,?,?,?,?)').bind(m.id,c?.id||'','whatsapp',m.from,c?'incoming':'unmatched',text,created).run();
   // Queue independently of event insertion so a interrupted delivery is recoverable.
   await queue(c?`WhatsApp reply · ${c.name} · from ${m.from}\n${text}`:`UNMATCHED WHATSAPP REPLY · ${m.from}\n${text}\nHR: match this reply to a customer before recording a decision.`,c?.id||'','reply-'+m.id);
  }
 }
 await db().prepare('UPDATE webhook_inbox SET state=? WHERE id=?').bind(retry?'pending':'done',id).run();
}
export async function recoverWebhooks(){const rows=(await db().prepare("SELECT id FROM webhook_inbox WHERE state='pending' ORDER BY created DESC LIMIT 20").all<any>()).results;for(const r of rows)try{await processWebhook(r.id)}catch{/* Keep durable pending record for the next run. */}}
