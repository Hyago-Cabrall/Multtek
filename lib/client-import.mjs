import {cnpjValid, normalizeCnpj, ufs} from './rules.mjs';
const headerKey = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases = {name:['nomecartorio','nomedocliente','nomecliente','cliente','nome','razaosocial'],cnpj:['cpfcnpj','cnpj'],uf:['uf','estado'],city:['cidade','municipio']};

export function validateImportClient(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const city = typeof input?.city === 'string' ? input.city.trim() : '';
  const uf = typeof input?.uf === 'string' ? input.uf.trim().toUpperCase() : '';
  let document = input?.cnpj;
  // Excel numbers can lose leading zeroes. Text documents are never guessed.
  if (typeof document === 'number' && Number.isSafeInteger(document) && document >= 1e11 && document < 1e14) document = String(document).padStart(14,'0');
  const cnpj = typeof document === 'string' ? normalizeCnpj(document) : '';
  const problems = [];
  if (!name || name.length > 250) problems.push('Nome ausente ou maior que 250 caracteres');
  if (!cnpjValid(cnpj)) problems.push('CNPJ inválido ou ausente');
  if (!ufs.includes(uf)) problems.push('UF inválida ou ausente');
  if (!city || city.length > 150) problems.push('Cidade ausente ou maior que 150 caracteres');
  return {client:{name,cnpj,uf,city},error:problems.join('; ')};
}

export function parseClientRows(rows, existingCnpjs = []) {
  if (!Array.isArray(rows) || rows.length > 10030) throw new Error('O relatório deve ter até 10.000 linhas de dados.');
  let header = -1, columns;
  for (let i=0;i<Math.min(rows.length,30);i++) {
    const keys = (rows[i] || []).map(headerKey);
    const mapping = Object.fromEntries(Object.entries(aliases).map(([field,names])=>[field,keys.findIndex(key=>names.includes(key))]));
    if (Object.values(mapping).every(index=>index>=0)) {
      if (Object.values(aliases).some(names=>keys.filter(key=>names.includes(key)).length>1)) throw new Error('Há colunas repetidas para os campos de cliente. Confira o cabeçalho.');
      header=i;columns=mapping;break;
    }
  }
  if (header<0) throw new Error('Não encontrei as colunas Nome do cliente (ou nome_cartorio), CNPJ (ou cpfcnpj), UF e Cidade na primeira aba.');
  if(rows.length-header-1>10000)throw new Error('O relatório deve ter até 10.000 linhas de dados.');
  const known = new Set(existingCnpjs.map(normalizeCnpj).filter(Boolean));
  const seen = new Set();
  const clients=[],invalid=[],duplicates=[];
  let total=0;
  for (let i=header+1;i<rows.length;i++) {
    const cells = rows[i] || [];
    const input = Object.fromEntries(Object.entries(columns).map(([field,index])=>[field,cells[index]]));
    if (Object.values(input).every(value=>value==null || String(value).trim()==='')) continue;
    total++;
    const {client,error}=validateImportClient(input);
    if (cnpjValid(client.cnpj) && (known.has(client.cnpj)||seen.has(client.cnpj))) {
      duplicates.push({line:i+1,cnpj:client.cnpj,reason:known.has(client.cnpj)?'Já cadastrado (inclusive inativo)':'Repetido no relatório'});continue;
    }
    if (error) { invalid.push({line:i+1,error});continue; }
    seen.add(client.cnpj);clients.push({...client,line:i+1});
  }
  return {clients,invalid,duplicates,total};
}
