import {storage} from './storage';
import {waConfig} from './integrations';

import {db,fail,uid,iso,event} from './server';
export async function graph(path:string,body:any,form=false){const e=await waConfig();const r=await fetch(`https://graph.facebook.com/${e.WA_API_VERSION||'v23.0'}/${path}`,{method:'POST',signal:AbortSignal.timeout(12000),headers:{Authorization:`Bearer ${e.WA_TOKEN}`,...(form?{}:{'Content-Type':'application/json'})},body:form?body:JSON.stringify(body)});const d=await r.json() as any;if(!r.ok)fail(d.error?.message||'WhatsApp rejected the message. Review the error before using Web fallback.',502);return d}
export async function businessSend(c:any,user:any,phone:string,text:string,fileId:string,requestId:string){
 const e=await waConfig();if(!e.WA_TOKEN||!e.WA_PHONE_ID)fail('Business API is not connected. Use the WhatsApp Web fallback.',409);
 const template=fileId?e.WA_DOCUMENT_TEMPLATE:e.WA_TEMPLATE;if(!template)fail(fileId?'Configure an approved document-header template first.':'Configure an approved text template first.',409);
 if(text.length>900)fail('Message exceeds the configured template limit. Shorten it or use Web fallback.');
 if(!/^[a-zA-Z0-9-]{10,80}$/.test(requestId))fail('Invalid send request.');
 const prior=await db().prepare('SELECT value FROM settings WHERE key=?').bind('wa-request:'+requestId).first<any>();if(prior)fail('This send was already submitted. Check the customer history before retrying.',409);
 const components:any[]=[];if(fileId){const f=await db().prepare('SELECT * FROM files WHERE id=? AND customer_id=?').bind(fileId,c.id).first<any>();if(!f||f.type!=='application/pdf')fail('Choose an uploaded PDF quotation.');const object=await storage?.get(fileId);if(!object)fail('Quotation file not found.');const form=new FormData();form.set('messaging_product','whatsapp');form.set('type','application/pdf');form.set('file',new Blob([await object.arrayBuffer()],{type:'application/pdf'}),f.name);const media=await graph(e.WA_PHONE_ID+'/media',form,true);components.push({type:'header',parameters:[{type:'document',document:{id:media.id,filename:f.name}}]})}
 components.push({type:'body',parameters:[{type:'text',text}]});
 await db().prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind('wa-request:'+requestId,'sending').run();
 try{const result=await graph(e.WA_PHONE_ID+'/messages',{messaging_product:'whatsapp',to:phone,type:'template',template:{name:template,language:{code:e.WA_LANGUAGE||'en'},components}});const mid=result.messages?.[0]?.id;if(!mid)throw new Error('No message ID returned');await db().prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind('wa-message:'+mid,JSON.stringify({customerId:c.id,phone,fileId,created:iso()})).run();await db().prepare('UPDATE settings SET value=? WHERE key=?').bind(mid,'wa-request:'+requestId).run();await event(c.id,user,`WhatsApp Business accepted ${fileId?'quotation PDF and message':'message'} to ${phone}. Message ID: ${mid}`,'message');return mid}catch(err){await db().prepare('UPDATE settings SET value=? WHERE key=?').bind('Check outcome before retrying','wa-request:'+requestId).run();throw err}
}
