// API interna. Todas as operações autorizadas no servidor.
import {cpfValid,taskValid,conclusion,ufs,normalizeCnpj,cnpjValid} from './rules.mjs';
import {validateImportClient} from './client-import.mjs';
const enc=new TextEncoder();
const uid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
async function digest(s:string){return hex(await crypto.subtle.digest('SHA-256',enc.encode(s)))}
async function password(s:string,salt=uid()){const k=await crypto.subtle.importKey('raw',enc.encode(s),'PBKDF2',false,['deriveBits']);return salt+':'+hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},k,256))}
function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status})}
function safeUser(u:any){const {password,...s}=u;return s}
function validateUser(b:any,creating:boolean){if(!b.name?.trim()||!(/^[a-z0-9._-]{3,50}$/i.test(b.username||''))||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email||''))||!cpfValid(b.cpf)||!(/^\d{10,13}$/.test(String(b.phone||'').replace(/\D/g,'')))||!['admin','member'].includes(b.role))fail('Confira nome, usuário (mínimo 3 caracteres), e-mail, CPF, celular e perfil.');if((creating||b.password)&&String(b.password||'').length<10)fail('A senha deve ter pelo menos 10 caracteres.');}
export async function api(req:Request,env:any,ctx:ExecutionContext){
 const db=env.DB as D1Database;const url=new URL(req.url);const path=url.pathname.replace('/api/','');const method=req.method;
 const q=(sql:string,...args:any[])=>db.prepare(sql).bind(...args);
 const one=(sql:string,...args:any[])=>q(sql,...args).first<any>();
 const all=async(sql:string,...args:any[])=>(await q(sql,...args).all<any>()).results;
 const json=(x:any,status=200,headers:any={})=>Response.json(x,{status,headers:{'Cache-Control':'no-store',...headers}});
 try{
 if(!db)fail('Banco de dados indisponível.',503);
 if(!['GET','HEAD'].includes(method)&&req.headers.get('origin')!==url.origin)fail('Origem da solicitação inválida.',403);
 const cookie=(req.headers.get('cookie')||'').match(/(?:^|;\s*)multtek_session=([^;]+)/)?.[1];
 const user=cookie?await one('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.active=1 AND u.deleted=0',await digest(cookie),Date.now()):null;
 if(path==='auth'&&method==='GET'){const count=await one('SELECT COUNT(*) n FROM users');return json({user:user?safeUser(user):null,setup:!count.n,setupKeyRequired:env.PUBLIC_DEPLOYMENT==='true',push:!!env.VAPID_PUBLIC_KEY,publicKey:env.VAPID_PUBLIC_KEY||null})}
 let b:any={};if(!['GET','DELETE'].includes(method)&&path!=='upload'){const raw=await req.text();if(path==='clients/import'&&raw.length>1024*1024)fail('O lote excede o limite de 1 MB.',413);if(raw){try{b=JSON.parse(raw)}catch{fail('JSON inválido.')}}}
 if(path==='setup'&&method==='POST'){
  if(await one("SELECT key FROM settings WHERE key='initialized'"))fail('A instalação já foi concluída.',409);
  // Public bootstrap fails closed until the owner provisions a secret in Cloudflare.
  if(env.PUBLIC_DEPLOYMENT==='true'){
   if(typeof env.SETUP_TOKEN!=='string'||env.SETUP_TOKEN.length<32)fail('A instalação ainda não foi liberada pelo responsável.',503);
   if(typeof b.setup_token!=='string'||b.setup_token.length>256||await digest(b.setup_token)!==await digest(env.SETUP_TOKEN))fail('Chave de instalação inválida.',403);
  }
  validateUser({...b,role:'admin'},true);const id=uid();
  await db.batch([q("INSERT INTO settings(key,value) VALUES('initialized','1')"),q('INSERT INTO users(id,name,username,email,cpf,phone,password,role,active,created) VALUES(?,?,?,?,?,?,?,?,1,?)',id,b.name.trim(),b.username.toLowerCase(),b.email.toLowerCase(),b.cpf.replace(/\D/g,''),b.phone.replace(/\D/g,''),await password(b.password),'admin',now()),...['A fazer','Fazendo','Pausada','Finalizada'].map((s,i)=>q('INSERT INTO stages(id,name,color,position,initial,done) VALUES(?,?,?,?,?,?)',uid(),s,['#728199','#5f62e9','#e9a23b','#29a680'][i],i,i===0?1:0,i===3?1:0)),...['WhatsApp','Ligação','Ticket','Implantação'].map((s,i)=>q('INSERT INTO origins(id,name) VALUES(?,?)',String(i+1),s))]);return json({ok:true});
 }
 if(path==='login'&&method==='POST'){
 const key=await digest('login:'+String(b.username||'').toLowerCase()+':'+(req.headers.get('cf-connecting-ip')||'local'));
 const a=await one('SELECT * FROM attempts WHERE key=?',key);if(a&&a.expires>Date.now()&&a.count>=8)fail('Muitas tentativas. Aguarde 15 minutos.',429);
 await q('INSERT INTO attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<? THEN excluded.expires ELSE expires END',key,Date.now()+900000,Date.now(),Date.now()).run();
 const u=await one('SELECT * FROM users WHERE username=? AND active=1 AND deleted=0',String(b.username||'').toLowerCase());const expected=await password(String(b.password||''),u?.password.split(':')[0]||'invalid-user-salt');if(!u||u.password!==expected)fail('Usuário ou senha incorretos.',401);
 const token=uid()+uid();await db.batch([q('DELETE FROM attempts WHERE key=?',key),q('DELETE FROM sessions WHERE expires<?',Date.now()),q('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)',await digest(token),u.id,Date.now()+43200000)]);return json({ok:true},200,{'Set-Cookie':`multtek_session=${token}; HttpOnly; ${url.protocol==='https:'?'Secure; ':''}SameSite=Strict; Path=/; Max-Age=43200`});
 }
 if(!user)fail('Entre na sua conta para continuar.',401);
 const admin=()=>{if(user.role!=='admin')fail('Acesso restrito ao administrador.',403)};
 if(path==='logout'&&method==='POST'){if(b.endpoint)await q('DELETE FROM subscriptions WHERE endpoint=? AND user_id=?',b.endpoint,user.id).run();await q('DELETE FROM sessions WHERE token=?',await digest(cookie!)).run();return json({ok:true},200,{'Set-Cookie':'multtek_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'})}
 if(path==='data'&&method==='GET'){
 ctx.waitUntil(deliver(env));
 const [users,clients,stages,origins,tasks,notifications]=await Promise.all([all(user.role==='admin'?'SELECT id,name,username,email,cpf,phone,role,active,deleted FROM users WHERE deleted=0':'SELECT id,name,active FROM users WHERE deleted=0'),all('SELECT * FROM clients'),all('SELECT * FROM stages ORDER BY position'),all('SELECT * FROM origins'),all('SELECT t.*, (SELECT COUNT(*) FROM attachments a WHERE a.task_id=t.id) attachment_count FROM tasks t WHERE t.deleted=0 ORDER BY t.updated DESC'),all('SELECT * FROM notifications WHERE user_id=? ORDER BY created DESC LIMIT 100',user.id)]);
 return json({user:safeUser(user),users,clients,stages,origins,tasks,notifications});
 }
 if(path==='users'&&method==='POST'){
 admin();validateUser(b,!b.id);const old=b.id?await one('SELECT * FROM users WHERE id=? AND deleted=0',b.id):null;if(b.id&&!old)fail('Usuário não encontrado.',404);
 if(old&&old.role==='admin'&&(!b.active||b.role!=='admin')){const n=await one("SELECT COUNT(*) n FROM users WHERE role='admin' AND active=1 AND deleted=0");if(n.n<=1)fail('Mantenha pelo menos um administrador ativo.')}
 if(old&&!b.active){const n=await one('SELECT COUNT(*) n FROM tasks t JOIN stages s ON s.id=t.stage_id WHERE t.assignee_id=? AND t.deleted=0 AND s.done=0',b.id);if(n.n)fail('Transfira as tarefas em aberto antes de inativar este usuário.')}
 const vals=[b.name.trim(),b.username.toLowerCase(),b.email.toLowerCase(),b.cpf.replace(/\D/g,''),b.phone.replace(/\D/g,''),b.password?await password(b.password):old?.password,b.role,b.active===false||b.active===0?0:1];
 if(old)await db.batch([q('UPDATE users SET name=?,username=?,email=?,cpf=?,phone=?,password=?,role=?,active=? WHERE id=?',...vals,b.id),...(!b.active||b.password?[q('DELETE FROM sessions WHERE user_id=?',b.id),q('DELETE FROM subscriptions WHERE user_id=?',b.id)]:[])]);else await q('INSERT INTO users(name,username,email,cpf,phone,password,role,active,id,created) VALUES(?,?,?,?,?,?,?,?,?,?)',...vals,uid(),now()).run();return json({ok:true});
 }
 if(path.startsWith('users/')&&method==='DELETE'){admin();const id=path.split('/')[1];const old=await one('SELECT * FROM users WHERE id=?',id);if(!old)fail('Usuário não encontrado.',404);if(old.role==='admin'&&old.active){const n=await one("SELECT COUNT(*) n FROM users WHERE role='admin' AND active=1 AND deleted=0");if(n.n<=1)fail('Não é possível excluir o último administrador ativo.')};const n=await one('SELECT COUNT(*) n FROM tasks t JOIN stages s ON s.id=t.stage_id WHERE t.assignee_id=? AND t.deleted=0 AND s.done=0',id);if(n.n)fail('Transfira as tarefas em aberto antes de excluir.');await db.batch([q('UPDATE users SET active=0,deleted=1 WHERE id=?',id),q('DELETE FROM sessions WHERE user_id=?',id),q('DELETE FROM subscriptions WHERE user_id=?',id)]);return json({ok:true})}
 if(path==='clients/import'&&method==='POST'){
  if(!Array.isArray(b.rows)||!b.rows.length||b.rows.length>250)fail('Envie entre 1 e 250 clientes por lote.');
  const valid:any[]=[],invalid:any[]=[],seen=new Set<string>();let repeated=0;
  for(let i=0;i<b.rows.length;i++){
   const row=b.rows[i],line=Number.isSafeInteger(row?.line)&&row.line>0?row.line:i+2;
   const {client,error}=validateImportClient(row);
   if(error){invalid.push({line,error});continue;}
   if(seen.has(client.cnpj)){repeated++;continue;}seen.add(client.cnpj);valid.push(client);
  }
  const jobs=[];
  for(let start=0;start<valid.length;start+=20){
   const batch=valid.slice(start,start+20);
   jobs.push(q('INSERT INTO clients(id,name,uf,city,cnpj) VALUES '+batch.map(()=>'(?,?,?,?,?)').join(',')+' ON CONFLICT(cnpj) DO NOTHING',...batch.flatMap(c=>[uid(),c.name,c.uf,c.city,c.cnpj])));
  }
  const result=jobs.length?await db.batch(jobs):[];
  const inserted=result.reduce((sum:number,r:any)=>sum+Number(r.meta.changes),0);
  return json({inserted,skipped:valid.length-inserted+repeated,invalid});
 }
 if(path==='clients'&&method==='POST'){
 if(!b.name?.trim()||!b.city?.trim()||!ufs.includes(b.uf))fail('Preencha nome, UF e cidade.');
 const old=b.id?await one('SELECT * FROM clients WHERE id=?',b.id):null;if(b.id&&!old)fail('Cliente não encontrado.',404);
 const cnpj=b.cnpj===undefined?(old?.cnpj??null):(normalizeCnpj(b.cnpj)||null);
 if(cnpj&&!cnpjValid(cnpj))fail('CNPJ inválido. Informe 12 letras/números e 2 dígitos verificadores válidos.');
 if(cnpj){const duplicate=await one('SELECT id FROM clients WHERE cnpj=? AND id<>?',cnpj,b.id||'');if(duplicate)fail('Este CNPJ já está cadastrado em outro cliente, inclusive inativo.',409)}
 if(b.id)await q('UPDATE clients SET name=?,uf=?,city=?,cnpj=?,active=? WHERE id=?',b.name.trim(),b.uf,b.city.trim(),cnpj,b.active?1:0,b.id).run();
 else await q('INSERT INTO clients(id,name,uf,city,cnpj,active) VALUES(?,?,?,?,?,1)',uid(),b.name.trim(),b.uf,b.city.trim(),cnpj).run();return json({ok:true});
 }
 if(path.startsWith('clients/')&&method==='DELETE'){await q('UPDATE clients SET active=0 WHERE id=?',path.split('/')[1]).run();return json({ok:true})}
 if(path==='stages'&&method==='POST'){
 admin();if(b.initial&&b.done)fail('A etapa inicial não pode ser uma etapa de conclusão.');if(!b.name?.trim()||!/^#[0-9a-f]{6}$/i.test(b.color))fail('Informe nome e cor válidos.');const list=await all('SELECT * FROM stages ORDER BY position');const old=list.find(s=>s.id===b.id);if(old&&old.done!==Number(!!b.done)){const n=await one('SELECT COUNT(*) n FROM tasks WHERE stage_id=? AND deleted=0',old.id);if(n.n)fail('Mova as tarefas antes de alterar a classificação de conclusão.')}
 if(old?.initial&&!b.initial)fail('Defina outra etapa inicial antes de remover essa classificação.');if(old?.done&&!b.done&&list.filter(s=>s.done).length===1)fail('Mantenha pelo menos uma etapa de conclusão.');
 const jobs=[];if(b.initial)jobs.push(q('UPDATE stages SET initial=0'));if(old)jobs.push(q('UPDATE stages SET name=?,color=?,initial=?,done=? WHERE id=?',b.name.trim(),b.color,b.initial?1:0,b.done?1:0,b.id));else jobs.push(q('INSERT INTO stages(id,name,color,position,initial,done) VALUES(?,?,?,?,?,?)',uid(),b.name.trim(),b.color,list.length,b.initial?1:0,b.done?1:0));await db.batch(jobs);return json({ok:true});
 }
 if(path==='stages/order'&&method==='POST'){admin();const list=await all('SELECT id FROM stages');if(!Array.isArray(b.ids)||new Set(b.ids).size!==list.length||list.some(s=>!b.ids.includes(s.id)))fail('Ordem inválida.');await db.batch(b.ids.map((id:string,i:number)=>q('UPDATE stages SET position=? WHERE id=?',i,id)));return json({ok:true})}
 if(path.startsWith('stages/')&&method==='DELETE'){
 admin();const id=path.split('/')[1],target=url.searchParams.get('target');const old=await one('SELECT * FROM stages WHERE id=?',id),dest=await one('SELECT * FROM stages WHERE id=?',target);if(!old||!dest||id===target)fail('Escolha outra etapa de destino.');const list=await all('SELECT * FROM stages');if(old.done&&!dest.done&&list.filter(s=>s.done).length===1)fail('Escolha uma etapa de conclusão ou crie outra antes de excluir.');const time=now();const jobs:any[]=[];
 jobs.push(q("INSERT INTO history(id,task_id,actor_id,event,created) SELECT lower(hex(randomblob(16))),id,?,?,? FROM tasks WHERE stage_id=?",user.id,`Etapa removida: ${old.name} → ${dest.name}`,time,id));
 if(conclusion(old,dest))jobs.push(q("INSERT INTO notifications(id,user_id,task_id,message,created) SELECT lower(hex(randomblob(16))),creator_id,id,'Tarefa #' || id || ' concluída',? FROM tasks WHERE stage_id=? AND deleted=0",time,id));
 jobs.push(q('UPDATE tasks SET stage_id=?,version=version+1,updated=?,completed=CASE WHEN ?=0 THEN NULL WHEN completed IS NULL THEN ? ELSE completed END WHERE stage_id=?',target,time,dest.done,time,id));if(old.initial)jobs.push(q('UPDATE stages SET initial=1 WHERE id=?',target));jobs.push(q('DELETE FROM stages WHERE id=?',id));await db.batch(jobs);ctx.waitUntil(deliver(env));return json({ok:true});
 }
 if(path==='tasks'&&method==='POST'){
 if(!taskValid(b))fail('Preencha os campos obrigatórios. O resumo aceita até 2.000 palavras e a duração deve ser válida.');const old=b.id?await one('SELECT * FROM tasks WHERE id=? AND deleted=0',b.id):null;if(b.id&&!old)fail('Tarefa não encontrada.',404);
 const client=await one('SELECT * FROM clients WHERE id=?',b.client_id),assignee=await one('SELECT * FROM users WHERE id=?',b.assignee_id),origin=await one('SELECT * FROM origins WHERE id=?',b.origin_id);if(!client||(!client.active&&old?.client_id!==b.client_id)||!assignee||((!assignee.active||assignee.deleted)&&old?.assignee_id!==b.assignee_id)||!origin)fail('Selecione cliente e responsável ativos e origem válida.');
 const stage=old?await one('SELECT * FROM stages WHERE id=?',b.stage_id):await one('SELECT * FROM stages WHERE initial=1');if(!stage)fail('Etapa inválida.');const previous=old?await one('SELECT * FROM stages WHERE id=?',old.stage_id):null;const time=now(),mutation=uid(),jobs:any[]=[];
 if(old){if(old.version!==b.version)fail('Esta tarefa foi alterada por outra pessoa. Reabra para atualizar os dados.',409);jobs.push(q('UPDATE tasks SET summary=?,client_id=?,origin_id=?,stage_id=?,assignee_id=?,duration=?,updated=?,completed=?,version=version+1,mutation=? WHERE id=? AND version=?',b.summary.trim(),b.client_id,b.origin_id,stage.id,b.assignee_id,b.duration??null,time,stage.done?(old.completed||time):null,mutation,old.id,b.version));}
 else jobs.push(q('INSERT INTO tasks(summary,client_id,origin_id,stage_id,creator_id,assignee_id,duration,created,updated,completed,mutation) VALUES(?,?,?,?,?,?,?,?,?,?,?)',b.summary.trim(),b.client_id,b.origin_id,stage.id,user.id,b.assignee_id,b.duration??null,time,time,stage.done?time:null,mutation));
 let event=!old?'Tarefa criada':'Dados atualizados';if(old&&old.stage_id!==stage.id)event=`${previous.name} → ${stage.name}${!stage.done&&previous.done?' · Tarefa reaberta':''}`;if(old&&old.assignee_id!==b.assignee_id)event+=' · Responsável: '+assignee.name;
 jobs.push(q('INSERT INTO history(id,task_id,actor_id,event,created) SELECT ?,id,?,?,? FROM tasks WHERE mutation=?',uid(),user.id,event,time,mutation));
 if(!old||old.assignee_id!==b.assignee_id)jobs.push(q('INSERT INTO notifications(id,user_id,task_id,message,created) SELECT ?,?,id,?,? FROM tasks WHERE mutation=?',uid(),b.assignee_id,'Uma tarefa foi atribuída a você',time,mutation));
 if(old&&conclusion(previous,stage))jobs.push(q('INSERT INTO notifications(id,user_id,task_id,message,created) SELECT ?,creator_id,id,?,? FROM tasks WHERE mutation=?',uid(),`Tarefa #${old.id} concluída`,time,mutation));
 const result=await db.batch(jobs);if(!result[0].meta.changes)fail('Conflito de edição. Reabra a tarefa.',409);const saved=await one('SELECT * FROM tasks WHERE mutation=?',mutation);ctx.waitUntil(deliver(env));return json(saved);
 }
 if(path.startsWith('tasks/')&&method==='GET'){const id=path.split('/')[1];const task=await one('SELECT * FROM tasks WHERE id=? AND deleted=0',id);if(!task)fail('Tarefa não encontrada.',404);return json({task,history:await all('SELECT h.*,u.name actor FROM history h JOIN users u ON u.id=h.actor_id WHERE task_id=? ORDER BY created DESC',id),attachments:await all('SELECT * FROM attachments WHERE task_id=?',id)})}
 if(path.startsWith('tasks/')&&method==='DELETE'){const id=path.split('/')[1];const task=await one('SELECT * FROM tasks WHERE id=? AND deleted=0',id);if(!task)fail('Tarefa não encontrada.',404);if(user.role!=='admin'&&task.creator_id!==user.id)fail('Somente o criador ou administrador pode excluir.',403);await db.batch([q('UPDATE tasks SET deleted=1,version=version+1 WHERE id=?',id),q('INSERT INTO history(id,task_id,actor_id,event,created) VALUES(?,?,?,?,?)',uid(),id,user.id,'Tarefa excluída',now())]);return json({ok:true})}
 if(path==='notifications/read'&&method==='POST'){await q('UPDATE notifications SET read=1 WHERE user_id=?',user.id).run();return json({ok:true})}
 if(path==='push'&&method==='POST'){const sub=b.subscription;let endpoint:URL;try{endpoint=new URL(sub.endpoint)}catch{fail('Inscrição inválida.')};if(endpoint!.protocol!=='https:'||!['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].some(h=>endpoint!.hostname===h||endpoint!.hostname.endsWith('.'+h))||!sub.keys?.p256dh||!sub.keys?.auth)fail('Serviço de push inválido.');await q('INSERT INTO subscriptions(id,user_id,endpoint,data) VALUES(?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,data=excluded.data',uid(),user.id,sub.endpoint,JSON.stringify(sub)).run();ctx.waitUntil(deliver(env));return json({ok:true})}
 if(path==='upload'&&method==='POST'){
 const form=await req.formData(),id=Number(form.get('task_id')),file=form.get('file') as File;if(!file||typeof file==='string'||!file.size||file.size>20*1024*1024)fail('Arquivo vazio ou maior que 20 MB.');const task=await one('SELECT * FROM tasks WHERE id=? AND deleted=0',id);if(!task)fail('Tarefa não encontrada.',404);const count=await one('SELECT COUNT(*) n FROM attachments WHERE task_id=?',id);if(count.n>=10)fail('Limite de 10 anexos por tarefa.');const bytes=new Uint8Array(await file.arrayBuffer());const mime=detect(bytes,file.name);if(!mime)fail('Conteúdo ou formato não permitido.');const key=uid();await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});try{await q('INSERT INTO attachments(id,task_id,user_id,name,mime,size,created) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM attachments WHERE task_id=?)<10',key,id,user.id,file.name.slice(0,200),mime,file.size,now(),id).run();const stored=await one('SELECT id FROM attachments WHERE id=?',key);if(!stored){await env.BUCKET.delete(key);fail('Limite de anexos atingido.')}}catch(e){await env.BUCKET.delete(key);throw e}return json({ok:true});
 }
 if(path.startsWith('files/')){const id=path.split('/')[1],a=await one('SELECT a.*,t.creator_id FROM attachments a JOIN tasks t ON t.id=a.task_id WHERE a.id=? AND t.deleted=0',id);if(!a)fail('Anexo não encontrado.',404);if(method==='DELETE'){if(user.role!=='admin'&&a.user_id!==user.id&&a.creator_id!==user.id)fail('Sem permissão para excluir este anexo.',403);await q('DELETE FROM attachments WHERE id=?',id).run();await env.BUCKET.delete(id);return json({ok:true})}if(method==='GET'){const f=await env.BUCKET.get(id);if(!f)fail('Arquivo não encontrado.',404);return new Response(f.body,{headers:{'Content-Type':a.mime,'Content-Disposition':`${url.searchParams.has('download')?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(a.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox"}})}}
 fail('Recurso não encontrado.',404);
 }catch(e:any){const integrity:Record<string,string>={last_admin:'Mantenha pelo menos um administrador ativo.',open_assignments:'Transfira as tarefas em aberto antes de inativar.',immutable_creator:'O criador da tarefa não pode ser alterado.',inactive_assignee:'Selecione um responsável ativo.'};for(const [key,message] of Object.entries(integrity)){if(e.message?.includes(key))return json({error:message},409)}if(e.message?.includes('clients.cnpj'))return json({error:'Este CNPJ já está cadastrado em outro cliente, inclusive inativo.'},409);if(e.message?.includes('UNIQUE constraint'))return json({error:path==='setup'?'O administrador já foi criado. Faça login.':'Já existe um cadastro com esse usuário, e-mail ou CPF.'},409);return json({error:e.status?e.message:'Não foi possível concluir a operação. Tente novamente.'},e.status||500)}
}
function detect(b:Uint8Array,name:string){const s=new TextDecoder('latin1').decode(b.slice(0,16)),ext=name.toLowerCase().split('.').pop();if(ext==='pdf'&&s.startsWith('%PDF-'))return 'application/pdf';if(['jpg','jpeg'].includes(ext!)&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';if(ext==='png'&&b[0]===137&&s.slice(1,4)==='PNG')return 'image/png';if(ext==='webp'&&s.startsWith('RIFF')&&s.slice(8,12)==='WEBP')return 'image/webp';if(ext==='wav'&&s.startsWith('RIFF')&&s.slice(8,12)==='WAVE')return 'audio/wav';if(ext==='ogg'&&s.startsWith('OggS'))return 'audio/ogg';if(ext==='mp3'&&(s.startsWith('ID3')||(b[0]===255&&(b[1]&224)===224)))return 'audio/mpeg';if(ext==='m4a'&&s.slice(4,8)==='ftyp')return 'audio/mp4';if(ext==='webm'&&b[0]===26&&b[1]===69&&b[2]===223&&b[3]===163)return 'audio/webm';return null}
// Push delivery implementation loaded only on the server.
async function deliver(env:any){if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY)return;const {sendPush}=await import('./push');const db=env.DB;const pending=await db.prepare('SELECT * FROM notifications WHERE sent=0 AND attempts<5 AND next_attempt<? ORDER BY created LIMIT 25').bind(Date.now()).all();for(const n of pending.results){const claim=await db.prepare('UPDATE notifications SET next_attempt=? WHERE id=? AND sent=0 AND next_attempt<?').bind(Date.now()+120000,n.id,Date.now()).run();if(!claim.meta.changes)continue;const subs=await db.prepare('SELECT * FROM subscriptions WHERE user_id=?').bind(n.user_id).all();if(!subs.results.length)continue;let failed=false;for(const s of subs.results){try{await sendPush(JSON.parse(s.data),{title:'Multtek',body:n.message,url:'/?task='+n.task_id,tag:n.id},env)}catch(e:any){if(e.statusCode===404||e.statusCode===410)await db.prepare('DELETE FROM subscriptions WHERE id=?').bind(s.id).run();else failed=true}}await db.prepare('UPDATE notifications SET sent=?,attempts=attempts+1,next_attempt=? WHERE id=?').bind(failed?0:1,Date.now()+60000*Math.pow(2,n.attempts),n.id).run()}}
export {deliver};
