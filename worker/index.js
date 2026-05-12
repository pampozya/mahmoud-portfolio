// Cloudflare Worker: Cloudinary signature endpoint for Mahmoud Adel portfolio
// Verifies JWT from Render backend, returns signed Cloudinary upload params.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Missing auth' }, 401);

    try {
      await verifyJWT(auth.substring(7), env.JWT_SECRET);
    } catch (e) {
      return json({ error: 'Invalid token: ' + e.message }, 401);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'lensmania';
    const public_id = crypto.randomUUID();
    const signature = await cloudinarySign({ folder, public_id, timestamp }, env.CLOUDINARY_API_SECRET);

    return json({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      timestamp,
      folder,
      public_id,
      signature,
    });
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function cloudinarySign(params, apiSecret) {
  const toSign = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + apiSecret;
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(toSign));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function verifyJWT(token, secret) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('Malformed token');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    b64urlDecode(s),
    new TextEncoder().encode(`${h}.${p}`)
  );
  if (!valid) throw new Error('Bad signature');
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Expired');
  return payload;
}
