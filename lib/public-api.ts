import { api } from './api';
import { openPostgres } from './postgres-db';
import { privateStorage } from './supabase-storage';

export async function publicApi(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
  const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
  if (!connectionString) return Response.json({ error: 'Banco de dados indisponível.' }, { status: 503 });
  let db: Awaited<ReturnType<typeof openPostgres>>;
  try { db = await openPostgres(connectionString, !!env.HYPERDRIVE); }
  catch (error) { const failure = error as { code?: string; name?: string; message?: string };
    let message = failure.message || 'unknown';
    for (const secret of [connectionString, new URL(connectionString).password, decodeURIComponent(new URL(connectionString).password)]) {
      if (secret) message = message.replaceAll(secret, '[redacted]');
    }
    console.error(JSON.stringify({ event: 'database_connection_failed', code: failure.code || failure.name || 'unknown', message: message.slice(0,500) }));
    return Response.json({ error: 'Banco de dados indisponível.' }, { status: 503 }); }
  const background: Promise<unknown>[] = [];
  const context = { waitUntil(promise: Promise<unknown>) { background.push(promise); ctx.waitUntil(promise); } } as ExecutionContext;
  const bucket = env.SUPABASE_URL && env.SUPABASE_SECRET_KEY
    ? privateStorage(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY) : undefined;
  try { return await api(request, { ...env, DB: db, BUCKET: bucket }, context); }
  finally { ctx.waitUntil(Promise.allSettled(background).then(() => db.close())); }
}
