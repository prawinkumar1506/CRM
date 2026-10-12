// Non-destructive local migration; old files are retained, never uploaded.
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,existsSync,mkdirSync,copyFileSync} from 'node:fs';
import path from 'node:path';
const root='.wrangler/state/v3',dir=root+'/d1/miniflare-D1DatabaseObject';
if(!existsSync(dir)){console.log('No v1 local database; nothing to import.');process.exit(0)}
const found=readdirSync(dir).filter(n=>n.endsWith('.sqlite')&&n!=='metadata.sqlite');if(found.length!==1)throw new Error('Select the v1 database explicitly before importing.');
const source=new DatabaseSync(path.join(dir,found[0]),{readOnly:true}),dest=new DatabaseSync('.data/helio.db');
if(dest.prepare('SELECT COUNT(*) AS n FROM users').get().n)throw new Error('Destination already has users; import will not overwrite it.');
const tables=['users','settings','customers','events','files','outbox','attempts'];dest.exec('BEGIN');let count=0;try{for(const t of tables){for(const row of source.prepare('SELECT * FROM '+t).all()){const cols=Object.keys(row);dest.prepare(`INSERT INTO ${t}(${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')})`).run(...cols.map(k=>row[k]));count++}}dest.exec('COMMIT')}catch(e){dest.exec('ROLLBACK');throw e}
const r2dir=root+'/r2/miniflare-R2BucketObject',r2files=existsSync(r2dir)?readdirSync(r2dir).filter(n=>n.endsWith('.sqlite')&&n!=='metadata.sqlite'):[];mkdirSync('.data/files',{recursive:true});let files=0;for(const r2file of r2files){const r2=new DatabaseSync(path.join(r2dir,r2file),{readOnly:true});for(const row of r2.prepare('SELECT key,blob_id FROM _mf_objects').all()){if(!/^[a-f0-9-]{36}$/.test(row.key))continue;const from=path.join(root,'r2/site-creator-r2/blobs',row.blob_id);if(existsSync(from)){copyFileSync(from,path.join('.data/files',row.key));files++}}r2.close()}
source.close();dest.close();console.log(`Preserved ${count} local records and ${files} files. Users must sign in again.`);
