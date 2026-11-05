import test from 'node:test';
import assert from 'node:assert/strict';
import {parseClientRows,validateImportClient} from '../lib/client-import.mjs';

test('Relatório de cartórios mapeia somente os quatro campos e ignora duplicados',()=>{
  const rows=[['id','nome_cartorio','cidade','uf','cpfcnpj','usa_pix'],
    ['source-id',' Cartório A ',' Goiânia ','go','11.222.333/0001-81','sim'],
    ['other','Outra razão','Outra cidade','GO','11222333000181','não'],
    ['known','Já existe','Brasília','DF','04.252.011/0001-10','sim'],
    ['invalid','Documento CPF','Goiânia','GO','52998224725','sim']];
  const p=parseClientRows(rows,['04252011000110']);
  assert.deepEqual(p.clients,[{line:2,name:'Cartório A',city:'Goiânia',uf:'GO',cnpj:'11222333000181'}]);
  assert.equal(p.duplicates.length,2);assert.equal(p.invalid.length,1);assert.equal(p.total,4);
});
test('Cabeçalhos com acentos e linhas vazias; CNPJ numérico com zero inicial',()=>{
  const p=parseClientRows([['Relatório'],[],['Nome do cliente','CNPJ','UF','Município'],['Empresa',4252011000110,'df','Brasília'],[],['Alpha','12.ABC.345/01DE-35','GO','Goiânia']]);
  assert.equal(p.clients[0].cnpj,'04252011000110');assert.equal(p.clients[0].line,4);assert.equal(p.clients[1].cnpj,'12ABC34501DE35');assert.equal(p.total,2);
});
test('Não adivinha CNPJ textual incompleto e rejeita UF, nome e cidade inválidos',()=>{
  assert.match(validateImportClient({name:'',cnpj:'4252011000110',uf:'XX',city:''}).error,/CNPJ inválido/);
  assert.throws(()=>parseClientRows([['Nome','CPF','UF','Cidade']]),/Não encontrei/);
  assert.throws(()=>parseClientRows([['Nome','CNPJ','cpfcnpj','UF','Cidade']]),/repetidas/);
});
