import test from 'node:test';
import assert from 'node:assert/strict';
import { privateStorage } from '../lib/supabase-storage.ts';

test('Anexos usam Storage privado e credencial somente no servidor', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const responses = [new Response('{}'), new Response('arquivo'), new Response(null, {status:404}), new Response('{}')];
  globalThis.fetch = async (url, options) => { calls.push({url,options}); return responses.shift(); };
  try {
    const bucket = privateStorage('https://example.supabase.co','sb_secret_test-server-secret');
    const id = '42424242-4242-4242-4242-424242424242';
    await bucket.put(id,new Uint8Array([1]),{httpMetadata:{contentType:'application/pdf'}});
    assert.equal(await new Response((await bucket.get(id)).body).text(),'arquivo');
    assert.equal(await bucket.get(id),null);
    await bucket.delete(id);
    assert.deepEqual(calls.map(c=>c.options.method),['POST','GET','GET','DELETE']);
    assert.ok(calls.every(c=>c.url===`https://example.supabase.co/storage/v1/object/multtek-anexos/${id}`));
    assert.ok(calls.every(c=>c.options.headers.apikey==='sb_secret_test-server-secret' && !c.options.headers.Authorization));
    await assert.rejects(()=>bucket.get('../other-bucket/file'));
  } finally { globalThis.fetch = originalFetch; }
});
