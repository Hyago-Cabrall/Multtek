function document(base){
  let value=String(base).padStart(12,'0');
  for(let n=0;n<2;n++){let sum=0,w=2;for(let i=value.length-1;i>=0;i--){sum+=Number(value[i])*w;w=w===9?2:w+1}const rest=sum%11;value+=rest<2?0:11-rest}return value;
}
export async function testClientImport(request,check){
  const cnpj=document(980000000001);
  const rows=[{name:'Cliente importado',cnpj,uf:'go',city:'Goiânia',active:0,ignored:'não persistir'},
    {name:'Não sobrescrever',cnpj,uf:'GO',city:'Outra cidade'},
    {name:'Cliente existente inativo',cnpj:'11.222.333/0001-81',uf:'GO',city:'Goiânia'},
    {name:'Inválido',cnpj:'123',uf:'XX',city:''}];
  let result=await request('clients/import','POST',{rows});
  check(result.inserted===1&&result.skipped===2&&result.invalid.length===1,'Importação separa novos, duplicados e inválidos');
  let data=await request('data');const client=data.clients.find(c=>c.cnpj===cnpj);
  check(client.name==='Cliente importado'&&client.uf==='GO'&&client.active===1&&!('ignored' in client),'Importação permite apenas os campos existentes e mantém o primeiro registro');
  check(data.clients.find(c=>c.cnpj==='11222333000181').active===0,'Importação não reativa CNPJ já cadastrado');
  result=await request('clients/import','POST',{rows});
  check(result.inserted===0&&result.skipped===3,'Reimportar o mesmo relatório não duplica clientes');
  const many=Array.from({length:23},(_,i)=>({name:'Importado '+i,cnpj:document(980000000100+i),uf:'DF',city:'Brasília'}));
  check((await request('clients/import','POST',{rows:many})).inserted===23,'Importação processa vários blocos de até 100 parâmetros');
  check((await request('clients/import','POST',{rows:many})).skipped===23,'Unicidade permanece válida entre lotes');
  await request('clients/import','POST',{rows:[]},400);
  await request('clients/import','POST',{rows:Array(251).fill(rows[0])},400);
  const before=(await request('data')).clients.length;
  await request('clients/import','POST',{rows:[{name:'Sem documento',uf:'GO',city:'Goiânia'}]});
  check((await request('data')).clients.length===before,'Linhas sem CNPJ não geram cadastro');
}
