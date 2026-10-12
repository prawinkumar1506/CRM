import {createClient} from '@supabase/supabase-js';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import path from 'node:path';
function local(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid file key');return path.join(process.cwd(),'.data','files',id)}
function bucket(){if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return null;return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}).storage.from('helio-quotations')}
function requireLocal(){if(process.env.VERCEL||process.env.DATABASE_URL)throw new Error('Configure the Supabase private quotation bucket and server key.')}
export const storage={
 async put(id:string,bytes:ArrayBuffer,options:any){const b=bucket();if(b){const {error}=await b.upload(id,bytes,{contentType:options.httpMetadata.contentType,upsert:false});if(error)throw new Error('Quotation storage failed. Check the private bucket configuration.');return}requireLocal();await mkdir('.data/files',{recursive:true});await writeFile(local(id),Buffer.from(bytes))},
 async get(id:string){const b=bucket();if(b){const {data,error}=await b.download(id);if(error||!data)return null;const bytes=await data.arrayBuffer();return {body:bytes,arrayBuffer:async()=>bytes}}requireLocal();try{const bytes=new Uint8Array(await readFile(local(id))).buffer;return {body:bytes,arrayBuffer:async()=>bytes}}catch(e:any){if(e.code==='ENOENT')return null;throw e}},
 async delete(id:string){const b=bucket();if(b){const {error}=await b.remove([id]);if(error)throw new Error('Could not remove quotation')}else{requireLocal();await unlink(local(id)).catch(()=>{})}}
};
