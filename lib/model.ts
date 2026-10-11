export type Stage = { id:string; name:string; status:'pending'|'active'|'blocked'|'done'|'skipped'; due:string; note:string };
export type Customer = {id:string; eb:string; name:string; phone:string; group:string; assigned:string; kind:'new'|'existing'; priority:string; capacity:string; phase:string; load:string; usage:string; ebSource:string; ebVerifiedAt?:string; latestUpdate?:string; internal:string; decision:string; stages:Stage[]; version:number; updated:string; created:string};
export const defaultNames=['Site visit & EB assessment','Owner quotation approval','Customer confirmation','Additional load','PM Surya Ghar registration','Signed agreement','Installation & serial numbers','DCR & installation documents','Net-meter application','Net-meter installation','Inspection','Subsidy received'];
export const defaultStages=()=>defaultNames.map((name,i)=>({id:'stage-'+i,name,status:'pending' as const,due:'',note:''}));
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const dateOffset=(n:number)=>{const d=new Date(today()+'T12:00:00+05:30');d.setDate(d.getDate()+n);return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(d)};
export function progress(c:Customer){return Math.round(c.stages.filter(s=>['done','skipped'].includes(s.status)).length/Math.max(1,c.stages.length)*100)}
export function nextStage(c:Customer){return c.stages.find(s=>!['done','skipped'].includes(s.status))}
export function pending(c:Customer){return c.stages.filter(s=>!['done','skipped'].includes(s.status))}
export function summary(customers:Customer[]){return `HELIO · DAILY SOLAR BRIEF\n${today()} · ${customers.length} customers\n\n`+customers.map(c=>`${c.name} · EB ${c.eb}\n${progress(c)}% complete · ${nextStage(c)?.name||'All stages complete'}\nOwner: ${c.internal} · Customer: ${c.decision}\nLatest: ${c.latestUpdate||nextStage(c)?.note||'No update recorded'}\n${pending(c).map(s=>`${s.status.toUpperCase()} — ${s.name}${s.due?' · Due '+s.due:''}${s.note?' · '+s.note:''}`).join('\n')||'All stages complete'}`).join('\n\n')}
export function normalizePhone(p:string){let n=p.replace(/[^0-9]/g,'');if(n.length===10)n='91'+n;return n}
export function whatsappUrl(phone:string,text:string){return 'https://web.whatsapp.com/send?phone='+normalizePhone(phone)+'&text='+encodeURIComponent(text)}
export function applyWorkflow(c:Customer,names:string[]){const byName=new Map(c.stages.map(s=>[s.name.toLowerCase(),s]));const stages=names.map(name=>byName.get(name.toLowerCase())||{id:crypto.randomUUID(),name,status:'pending' as const,due:'',note:''});return {...c,stages}}
export const demoUsers=[{id:'demo-admin',name:'Veda',username:'veda',role:'admin'},{id:'demo-worker-1',name:'Deepak',username:'deepak',role:'worker'},{id:'demo-worker-2',name:'Charan',username:'charan',role:'worker'}];
export function demoCustomers():Customer[]{return [
 ['R. Karthik','Chennai','5','three',8,'Net meter visit awaiting EB confirmation',-1,'high'],
 ['Meena Rajan','Chengalpattu','3','single',1,'Quotation ready for owner review',0,'normal'],
 ['S. Balasubramanian','Chennai','5','three',5,'Collect signed agreement before installation',0,'high'],
 ['Anitha Kumar','Tambaram','3','single',3,'Follow up on additional-load application',1,'normal'],
 ['Vijay Narayanan','Chennai','10','three',6,'Inverter serial number pending from site team',0,'normal'],
 ['Lakshmi Suresh','Chengalpattu','3','three',12,'Subsidy received. Installation complete.',0,'normal'],
 ['Arun Prakash','Tambaram','5','three',2,'Customer reviewing the approved quotation',2,'normal'],
 ['Priya Mohan','Chennai','3','single',0,'Site visit scheduled for tomorrow',1,'normal']
].map((x,i)=>{const stages=defaultStages().map((s,j)=>({...s,status:j<Number(x[4])?'done' as const:j===Number(x[4])?(i===0?'blocked' as const:'active' as const):'pending' as const,due:j===Number(x[4])?dateOffset(Number(x[6])):'',note:j===Number(x[4])?String(x[5]):''}));return {id:'sample-'+i,eb:'DEMO-0'+(100000000+i),name:String(x[0]),phone:'',group:String(x[1]),assigned:demoUsers[1+i%2].id,kind:i===5?'existing':'new',priority:String(x[7]),capacity:String(x[2]),phase:String(x[3]),load:String(x[2]),usage:'420',ebSource:'Demo data · not fetched from EB',internal:Number(x[4])>1?'approved':'pending',decision:Number(x[4])>2?'accepted':'pending',stages,version:1,updated:new Date().toISOString(),created:dateOffset(-i-4)}})}
