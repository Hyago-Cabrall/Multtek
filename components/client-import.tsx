'use client';
import {useEffect,useRef,useState} from 'react';
import {Upload,X,Loader2,CheckCircle2} from 'lucide-react';
import {parseClientRows} from '../lib/client-import.mjs';
import {formatCnpj} from '../lib/rules.mjs';

type Client = {name:string;cnpj:string;uf:string;city:string;line:number};
type Result = {inserted:number;skipped:number;invalid:{line:number;error:string}[]};
export function ClientImport({clients,onImport,onComplete}:{
  clients:{cnpj?:string|null}[];onImport:(rows:Client[])=>Promise<Result>;onComplete:()=>Promise<void>;
}) {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[filename,setFilename]=useState('');
  const [preview,setPreview]=useState<ReturnType<typeof parseClientRows>|null>(null);
  const [error,setError]=useState(''),[result,setResult]=useState<Result|null>(null),[finished,setFinished]=useState(false),[processed,setProcessed]=useState(0);
  const dialog=useRef<HTMLElement>(null),trigger=useRef<HTMLButtonElement>(null),busyRef=useRef(false);
  busyRef.current=busy;
  useEffect(()=>{
    if(!open)return;
    const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    const controls=()=>Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),summary,[tabindex="0"]')||[]).filter(e=>e.offsetParent!==null);
    controls()[0]?.focus();
    const keydown=(e:KeyboardEvent)=>{
      if(e.key==='Escape'&&!busyRef.current)setOpen(false);
      if(e.key==='Tab'){const elements=controls();if(e.shiftKey&&document.activeElement===elements[0]){e.preventDefault();elements.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===elements.at(-1)){e.preventDefault();elements[0]?.focus()}}
    };
    document.addEventListener('keydown',keydown);
    return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',keydown);trigger.current?.focus()};
  },[open]);
  async function read(file?:File){
    setError('');setPreview(null);setResult(null);setFinished(false);setProcessed(0);setFilename(file?.name||'');
    if(!file)return;
    if(!/\.xlsx$/i.test(file.name)||file.size>5*1024*1024){setError('Selecione um arquivo .xlsx de até 5 MB.');return;}
    setBusy(true);
    try{
      const {readSheet}=await import('read-excel-file/browser');
      const rows=await readSheet(file);
      const parsed=parseClientRows(rows,clients.map(c=>c.cnpj||''));
      if(!parsed.total)throw new Error('O relatório não contém clientes nas colunas esperadas.');
      setPreview(parsed);
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível ler o relatório. Confira se o arquivo é um XLSX válido.');}
    finally{setBusy(false)}
  }
  async function save(){
    if(!preview?.clients.length||busy)return;
    setBusy(true);setError('');setFinished(false);setProcessed(0);
    const summary:Result={inserted:0,skipped:preview.duplicates.length,invalid:[...preview.invalid]};
    try{
      for(let i=0;i<preview.clients.length;i+=250){
        const batch=preview.clients.slice(i,i+250);
        const response=await onImport(batch);
        summary.inserted+=response.inserted;summary.skipped+=response.skipped;summary.invalid.push(...response.invalid);
        setProcessed(i+batch.length);setResult({...summary,invalid:[...summary.invalid]});
      }
      setFinished(true);
    }catch{setError('A importação foi interrompida. Os lotes concluídos foram salvos. Você pode tentar novamente: CNPJs já cadastrados serão ignorados.');}
    finally{
      try{await onComplete()}catch{setError('Atualize a página para conferir os clientes salvos.');}
      setBusy(false);
    }
  }
  const issues=result?.invalid||preview?.invalid||[];
  return <>
    <button ref={trigger} className="secondary import-trigger" onClick={()=>{setOpen(true);setPreview(null);setResult(null);setError('');setFilename('');setFinished(false)}}><Upload size={16}/>Importar relatório</button>
    {open&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOpen(false)}}>
      <section ref={dialog} className="modal client-import-modal" role="dialog" aria-modal="true" aria-labelledby="client-import-title" aria-describedby="client-import-description">
        <header className="modal-header"><div><span className="section-kicker">CLIENTES</span><h2 id="client-import-title">Importar relatório</h2></div><button aria-label="Fechar importação" disabled={busy} onClick={()=>setOpen(false)}><X size={21}/></button></header>
        <div className="modal-body">
          <p id="client-import-description">Importe nome do cliente, CNPJ, UF e cidade. Clientes já cadastrados, inclusive inativos, serão ignorados e seus dados serão mantidos.</p>
          <label className="upload-zone import-file"><Upload size={22}/><strong>{filename||'Selecionar relatório Excel'}</strong><span>.xlsx · até 5 MB · primeira aba</span><input aria-label="Selecionar relatório Excel" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={e=>{read(e.target.files?.[0]);e.target.value=''}}/></label>
          {busy&&<p role="status" className="import-progress"><Loader2 size={17} className="spin"/>{preview?`Importando: ${processed} de ${preview.clients.length}`:'Lendo relatório…'}</p>}
          {error&&<p className="import-error" role="alert">{error}</p>}
          {preview&&<>
            <div className="import-summary" aria-live="polite">
              <div><strong>{result?result.inserted:preview.clients.length}</strong><span>{result?'Cadastrados':'Novos clientes'}</span></div>
              <div><strong>{result?result.skipped:preview.duplicates.length}</strong><span>Duplicados ignorados</span></div>
              <div><strong>{issues.length}</strong><span>Linhas inválidas</span></div>
            </div>
            {finished&&<p className="import-success" role="status"><CheckCircle2 size={17}/>Importação concluída.</p>}
            {!result&&preview.clients.length>0&&<div className="import-preview"><h3>Prévia dos primeiros clientes</h3><div className="table-wrap"><table><thead><tr><th>Nome do cliente</th><th>CNPJ</th><th>UF</th><th>Cidade</th></tr></thead><tbody>{preview.clients.slice(0,5).map(c=><tr key={c.cnpj}><td>{c.name}</td><td>{formatCnpj(c.cnpj)}</td><td>{c.uf}</td><td>{c.city}</td></tr>)}</tbody></table></div></div>}
            {issues.length>0&&<details className="import-issues"><summary>Conferir linhas inválidas ({issues.length})</summary><ul>{issues.map((issue,i)=><li key={i}><strong>Linha {issue.line}:</strong> {issue.error}</li>)}</ul></details>}
            {preview.duplicates.length>0&&<details className="import-issues"><summary>Conferir duplicados do relatório ({preview.duplicates.length})</summary><ul>{preview.duplicates.map(d=><li key={d.line}>Linha {d.line}: {formatCnpj(d.cnpj)} — {d.reason}</li>)}</ul></details>}
            {!preview.clients.length&&!result&&<p className="muted">Nenhum novo cliente válido para importar.</p>}
          </>}
        </div>
        <footer className="modal-footer"><button className="secondary" disabled={busy} onClick={()=>setOpen(false)}>{finished?'Fechar':'Cancelar'}</button>{!finished&&<button className="primary" disabled={busy||!preview?.clients.length} onClick={save}><Upload size={16}/>{result?'Tentar novamente':`Importar ${preview?.clients.length||0} clientes`}</button>}</footer>
      </section>
    </div>}
  </>;
}
