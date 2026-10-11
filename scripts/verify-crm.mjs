import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const suffix=Date.now().toString(36),password=crypto.randomUUID()+'Aa1!';
let adminCookie='',workerCookie='',otherCookie='';let checks=0;
function check(condition,label){assert.ok(condition,label);console.log('PASS '+label);checks++}
async function post(action,p={},cookie=adminCookie){const r=await fetch(base+'/api/crm',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:base},body:JSON.stringify({action,...p})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
async function snap(cookie=adminCookie){return (await fetch(base+'/api/crm',{headers:{Cookie:cookie}})).json()}
let r=await post('signup',{username:'qa_'+suffix,name:'QA Administrator',password});check(r.status===200,'First HR account can be created');adminCookie=r.cookie;
r=await post('signup',{username:'intruder_'+suffix,name:'Other',password});check(r.status===403,'A second public HR signup is rejected');
for(const name of ['worker','other']){r=await post('worker',{name:'QA '+name,username:name+'_'+suffix,password});check(r.status===200,'HR creates '+name+' account');const login=await post('login',{username:name+'_'+suffix,password},'');check(login.status===200,name+' can log in');if(name==='worker')workerCookie=login.cookie;else otherCookie=login.cookie}
let d=await snap(),worker=d.users.find(u=>u.username==='worker_'+suffix);check(!JSON.stringify(d).includes(password),'API snapshots do not expose passwords');
const names=d.settings.defaultNames;const c={id:'',eb:'990'+Date.now().toString().slice(-9),name:'QA Customer',phone:'',group:'QA area',assigned:worker.id,kind:'new',priority:'high',capacity:'3',phase:'unknown',load:'',usage:'',ebSource:'Not verified',internal:'pending',decision:'pending',stages:names.map((name,i)=>({id:'s'+i,name,status:'pending',due:'',note:''})),version:0};
r=await post('saveCustomer',{customer:c});check(r.status===200,'HR registers a customer by EB number');let customer=r.data.customers.find(x=>x.eb===c.eb);
r=await post('saveCustomer',{customer:c});check(r.status===400,'Duplicate EB numbers rejected');
check((await snap(workerCookie)).customers.some(x=>x.id===customer.id),'Assigned worker can see customer');check(!(await snap(otherCookie)).customers.some(x=>x.id===customer.id),'Other worker cannot see customer');
r=await post('comment',{customerId:customer.id,text:'Unauthorized'},otherCookie);check(r.status===403,'Other worker cannot update customer');
r=await post('settings',{settings:{hrPhone:'',ownerPhone:'',autoSummary:true}},workerCookie);check(r.status===403,'Worker cannot change HR settings');
r=await post('saveCustomer',{customer:{...customer,internal:'approved'}},workerCookie);check(r.status===403,'Worker cannot grant owner approval');
r=await post('saveCustomer',{customer:{...customer,internal:'approved'}});check(r.status===400,'Owner approval requires a quotation upload');
r=await post('saveCustomer',{customer:{...customer,decision:'accepted'}});check(r.status===400,'Customer acceptance requires owner approval');
const stale=structuredClone(customer);r=await post('comment',{customerId:customer.id,text:'Visit pending; follow up with EB office.'},workerCookie);check(r.status===200,'Worker can add a dated activity update');d=await snap();check(d.outbox.some(o=>o.text.includes('Visit pending')),'Worker update creates HR notification draft');check(d.customers[0].latestUpdate.includes('Visit pending'),'Latest worker update retained for daily report');
r=await post('saveCustomer',{customer:stale});check(r.status===409,'Stale edit cannot overwrite a newer update');
customer=d.customers.find(x=>x.id===customer.id);customer.stages[0].status='done';r=await post('saveCustomer',{customer});check(r.status===200,'Stage progress persists');
r=await post('workflow',{scope:'group',group:'QA area',names:[...names,'Customer handover']});check(r.status===200&&r.data.customers.find(x=>x.id===customer.id).stages[0].status==='done','Group workflow change preserves existing stage progress');
const fd=new FormData();fd.set('customerId',customer.id);fd.set('file',new Blob(['%PDF-1.4\n%%EOF'],{type:'application/pdf'}),'qa-quotation.pdf');let upload=await fetch(base+'/api/files',{method:'POST',headers:{Cookie:adminCookie,Origin:base},body:fd});check(upload.status===200,'Quotation file stored');d=await snap();const file=d.files.find(x=>x.customer_id===customer.id);let download=await fetch(base+'/api/files?id='+file.id,{headers:{Cookie:otherCookie}});check(download.status===403,'Quotation download respects customer permissions');download=await fetch(base+'/api/files?id='+file.id,{headers:{Cookie:workerCookie}});check(download.status===200&&(await download.text()).startsWith('%PDF'),'Assigned worker can retrieve uploaded quotation');
customer=d.customers.find(x=>x.id===customer.id);r=await post('saveCustomer',{customer:{...customer,internal:'approved',decision:'accepted'},note:'QA explicit approval and acceptance recorded'});check(r.status===200,'Owner approval and customer acceptance saved after quotation');
customer=r.data.customers.find(x=>x.id===customer.id);customer.stages.find(s=>s.name==='PM Surya Ghar registration').status='done';r=await post('saveCustomer',{customer});check(r.status===200&&r.data.customers.find(x=>x.id===customer.id).stages.find(s=>s.name==='Signed agreement').due,'Registration triggers agreement follow-up');
await post('daily');await post('daily');d=await snap();check(d.outbox.filter(o=>o.id.startsWith('daily-')).length===1,'Daily summary is deduplicated');
r=await post('ebLookup',{customerId:customer.id});check(r.status===409,'EB lookup reports unavailable instead of inventing results');
r=await fetch(base+'/api/whatsapp',{method:'POST',body:'{}'});check(r.status>=400,'Unconfigured webhook rejects incoming messages');
r=await post('logout',{},workerCookie);check(r.status===200&&!(await snap(workerCookie)).user,'Logout invalidates session');
console.log(`Verified ${checks} checks. Local QA data only; no messages sent.`);
