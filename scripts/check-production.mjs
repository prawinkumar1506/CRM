// Focused offline checks. Uses a disposable workspace, never customer data or network services.
import {build} from 'esbuild';
import {mkdtempSync,writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=process.cwd();mkdirSync('work',{recursive:true});const dir=mkdtempSync(path.join(root,'work/production-check-'));
const source=`
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {database,postgresSQL} from ${JSON.stringify(path.join(root,'lib/database.ts'))};
import {encrypt,decrypt,saveWA,waConfig} from ${JSON.stringify(path.join(root,'lib/integrations.ts'))};
import {queue,db,uid,snapshot} from ${JSON.stringify(path.join(root,'lib/server.ts'))};
import {processWebhook} from ${JSON.stringify(path.join(root,'lib/webhook-processing.ts'))};
import {cronAuthorized} from ${JSON.stringify(path.join(root,'lib/notifications.ts'))};
delete process.env.DATABASE_URL;delete process.env.VERCEL;process.env.NODE_ENV='test';process.env.INTEGRATION_ENCRYPTION_KEY='a'.repeat(64);process.env.CRON_SECRET='test-cron-secret';
process.chdir(${JSON.stringify(dir)});mkdirSync('.data');const d=new DatabaseSync('.data/helio.db');d.exec(readFileSync(${JSON.stringify(path.join(root,'drizzle/0000_mute_dorian_gray.sql'))},'utf8'));d.exec(readFileSync(${JSON.stringify(path.join(root,'drizzle/0001_production_indexes.sql'))},'utf8'));d.close();let checks=0;function check(x,label){assert.ok(x,label);checks++;console.log('PASS '+label)}
check(postgresSQL("SELECT * FROM customers WHERE id=? AND name='?' ").includes("helio.customers WHERE id=$1 AND name='?'"),'Postgres placeholders preserve quoted question marks');
check(postgresSQL('INSERT OR IGNORE INTO events(id) VALUES(?)').endsWith('ON CONFLICT DO NOTHING'),'Postgres idempotent insert translation');
check(postgresSQL('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').includes('ON CONFLICT (key) DO UPDATE'),'Postgres metadata upsert translation');
const encrypted=encrypt('private-token');check(!encrypted.includes('private-token')&&decrypt(encrypted)==='private-token','API secrets encrypted and decryptable');let tamper=false;try{decrypt(encrypted.slice(0,-5)+'AAAAA')}catch{tamper=true}check(tamper,'Tampered credentials rejected');
await saveWA({WA_TOKEN:'private-token',WA_PHONE_ID:'12345'});await saveWA({WA_TOKEN:'',WA_TEMPLATE:'report'});check((await waConfig()).WA_TOKEN==='private-token','Blank credential form preserves existing token');
check(!cronAuthorized(new Request('https://example.test'))&&cronAuthorized(new Request('https://example.test',{headers:{authorization:'Bearer test-cron-secret'}})),'Scheduler requires its bearer secret');
await db().prepare("INSERT INTO settings(key,value) VALUES('workspace',?)").bind(JSON.stringify({hrPhone:'919999999999',ownerPhone:'918888888888',autoNotify:false})).run();await queue('x'.repeat(1600),'','daily-check',true);await queue('x'.repeat(1600),'','daily-check',true);const parts=(await db().prepare('SELECT * FROM outbox').all()).results;check(parts.length===3&&parts.every(p=>p.text.length<=900),'Long summaries split and deduplicate');
const c={id:'customer',eb:'12345678901',name:'Example',phone:'917777777777',stages:[]};await db().prepare('INSERT INTO customers(id,eb,assigned,data,updated) VALUES(?,?,?,?,?)').bind(c.id,c.eb,'worker',JSON.stringify(c),new Date().toISOString()).run();await db().prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind('wa-message:outgoing',JSON.stringify({customerId:c.id,phone:'918888888888'})).run();const payload={entry:[{changes:[{value:{messages:[{id:'reply',from:'918888888888',context:{id:'outgoing'},text:{body:'Confirmed'}}]}}]}]};await db().prepare('INSERT INTO webhook_inbox(id,payload,created) VALUES(?,?,?)').bind('batch',JSON.stringify(payload),new Date().toISOString()).run();await processWebhook('batch');await processWebhook('batch');const event=await db().prepare('SELECT * FROM events WHERE id=?').bind('reply').first();check(event.customer_id===c.id,'Owner reply maps by outbound message context');check((await db().prepare("SELECT * FROM outbox WHERE id='reply-reply'").all()).results.length===1,'Webhook retries do not duplicate reply notification');
const before=(await db().prepare('SELECT COUNT(*) AS n FROM settings').first()).n;let rollback=false;try{await database.batch([db().prepare("INSERT INTO settings(key,value) VALUES('atomic','yes')"),db().prepare("INSERT INTO settings(key,value) VALUES('workspace','duplicate')")])}catch{rollback=true}check(rollback&&(await db().prepare('SELECT COUNT(*) AS n FROM settings').first()).n===before,'Multi-statement failure rolls back');
console.log(checks+' focused checks passed. No external API calls.');
`;
const input=path.join(dir,'check.ts'),output=path.join(dir,'check.mjs');writeFileSync(input,source);await build({entryPoints:[input],outfile:output,bundle:true,platform:'node',format:'esm',packages:'external'});const r=spawnSync(process.execPath,[output],{stdio:'inherit',env:{...process.env,NODE_ENV:'test'}});process.exitCode=r.status||0;

