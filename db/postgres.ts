import { Client, types } from 'pg';
// Epoch milliseconds fit safely in JS numbers. Never silently truncate larger bigint.
types.setTypeParser(20, value => { const n=Number(value); if(!Number.isSafeInteger(n))throw new Error('Unsafe bigint');return n; });
export class Database {
 private client:any; private finish:()=>Promise<void>;
 constructor(client:any,finish:()=>Promise<void>){this.client=client;this.finish=finish;}
 query(sql:string,args:any[]=[]){return this.client.query(sql,args)}
 prepare(sql:string){return new Statement(this,sql)}
 async batch(jobs:Statement[]){const results=[];for(const job of jobs)results.push(await job.run());return results;}
 close(){return this.finish()}
}
// Statements are application literals. Values always travel separately as parameters.
function parameters(sql:string){let n=0;return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g,t=>t==='?'?'$'+(++n):t)}
class Statement {
 private db:Database; private sql:string; private args:any[];
 constructor(db:Database,sql:string,args:any[]=[]){this.db=db;this.sql=sql;this.args=args;}
 bind(...args:any[]){return new Statement(this.db,this.sql,args)}
 async first<T=any>():Promise<T|null>{return (await this.all<T>()).results[0]??null}
 async all<T=any>():Promise<{results:T[]}>{const r=await this.db.query(parameters(this.sql),this.args);return {results:r.rows}}
 async run(){const r=await this.db.query(parameters(this.sql),this.args);return {success:true,meta:{changes:r.rowCount??r.affectedRows??0}}}
}
export async function connectDatabase(url:string){
 if(!url)throw new Error('DATABASE_URL is required');
 const parsed=new URL(url);
 if(!['postgres:','postgresql:'].includes(parsed.protocol))throw new Error('Invalid database protocol');
 // Strip SSL URL overrides so certificate verification cannot be silently disabled.
 for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])parsed.searchParams.delete(key);
 const client=new Client({connectionString:parsed.toString(),ssl:{rejectUnauthorized:true},connectionTimeoutMillis:10000,statement_timeout:15000});
 try {await client.connect();return new Database(client,()=>client.end());}
 catch(e){await client.end().catch(()=>{});throw e}
}
