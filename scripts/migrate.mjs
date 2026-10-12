import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
try{process.loadEnvFile('.env.local')}catch{}
if(process.env.DATABASE_URL){const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true,...(process.env.DATABASE_CA_CERT?{ca:process.env.DATABASE_CA_CERT}:{})}});try{await pool.query(readFileSync('supabase/schema.sql','utf8'));console.log('Supabase schema ready')}finally{await pool.end()}}
else{if(process.env.VERCEL)throw new Error('DATABASE_URL required');mkdirSync('.data',{recursive:true});const db=new DatabaseSync('.data/helio.db');db.exec('CREATE TABLE IF NOT EXISTS helio_migrations(name TEXT PRIMARY KEY, hash TEXT NOT NULL)');for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort()){const sql=readFileSync('drizzle/'+name,'utf8'),hash=createHash('sha256').update(sql).digest('hex');const old=db.prepare('SELECT hash FROM helio_migrations WHERE name=?').get(name);if(old){if(old.hash!==hash)throw new Error('Applied migration changed: '+name);continue}db.exec('BEGIN');try{db.exec(sql);db.prepare('INSERT INTO helio_migrations(name,hash) VALUES(?,?)').run(name,hash);db.exec('COMMIT');console.log('Applied '+name)}catch(e){db.exec('ROLLBACK');throw e}}db.close()}
