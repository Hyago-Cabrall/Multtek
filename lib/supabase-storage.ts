// This key is a Worker secret and must never be included in browser assets.
export function privateStorage(url: string, key: string) {
  const base = `${url.replace(/\/$/, '')}/storage/v1/object/multtek-anexos/`;
  async function send(id: string, method: string, body?: Uint8Array, contentType?: string) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Invalid attachment identifier');
    return fetch(base + id, { method, body: body as BodyInit | undefined,
      headers: { apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }), ...(contentType ? { 'Content-Type': contentType } : {}) } });
  }
  return {
    async put(id: string, bytes: Uint8Array, options: { httpMetadata: { contentType: string } }) {
      const response = await send(id, 'POST', bytes, options.httpMetadata.contentType);
      if (!response.ok) throw new Error('Attachment upload failed');
      await response.body?.cancel();
    },
    async get(id: string) {
      const response = await send(id, 'GET');
      if (response.status === 404) { await response.body?.cancel(); return null; }
      if (!response.ok) { await response.body?.cancel(); throw new Error('Attachment download failed'); }
      return { body: response.body };
    },
    async delete(id: string) {
      const response = await send(id, 'DELETE');
      if (!response.ok && response.status !== 404) throw new Error('Attachment deletion failed');
      await response.body?.cancel();
    },
  };
}
