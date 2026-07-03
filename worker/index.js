// Cloudflare Worker for Mahmoud Adel portfolio
//   - POST /              → Cloudinary signature (existing, kept for backward compat)
//   - POST /r2            → R2 presigned PUT URL (new)
// All endpoints verify JWT from Render backend.

const ALLOWED_SIGN_ORIGINS = [
  'https://portfolio.lensmania.ae',
  'https://portfolio.alaaelshami.com',
  'https://portfolio.yousefkandel.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_SIGN_ORIGINS.includes(origin) ? origin : ALLOWED_SIGN_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Missing auth' }, 401, origin);

    let payload;
    try {
      payload = await verifyJWT(auth.substring(7), env.JWT_SECRET);
    } catch (e) {
      return json({ error: 'Invalid token: ' + e.message }, 401, origin);
    }

    const url = new URL(request.url);
    if (url.pathname === '/r2' || url.pathname.startsWith('/r2/')) {
      return await handleR2Sign(request, env, payload, origin);
    }
    return await handleCloudinarySign(env, origin);
  },
};

// ----- Cloudinary (unchanged) -----
async function handleCloudinarySign(env, origin) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'lensmania';
  const public_id = crypto.randomUUID();
  const signature = await cloudinarySign({ folder, public_id, timestamp }, env.CLOUDINARY_API_SECRET);
  return json({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    timestamp, folder, public_id, signature,
  }, 200, origin);
}

async function cloudinarySign(params, apiSecret) {
  const toSign = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + apiSecret;
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(toSign));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Per-site upload namespacing. The site is derived from the VERIFIED JWT's `sub`
// (admin email) — distinct domain per site, so it can't be spoofed by Origin and
// needs no frontend change. Known sites get a friendly slug; any future site falls
// back to its email domain. This makes every uploaded object self-identifying, so a
// shared bucket can never again be mis-attributed (see the 2026-06 Yousef incident).
const SITE_SLUGS = {
  'lensmania.ae': 'mahmoud',
  'allaportfolio.lensmania.ae': 'alaa',
  'portfolio.yousefkandel.com': 'yousef',
};
function sitePrefixFromEmail(sub) {
  const domain = (sub && sub.includes('@')) ? sub.split('@')[1].toLowerCase().trim() : '';
  if (!domain) return 'shared';
  return SITE_SLUGS[domain] || domain.replace(/[^a-z0-9.\-]/g, '') || 'shared';
}

// ----- R2 presigned PUT URL -----
async function handleR2Sign(request, env, payload, origin) {
  let body;
  try { body = await request.json(); } catch { body = {}; }

  const filename = (body.filename || 'upload').trim();
  const safeBase = filename.replace(/[^\w.\-]/g, '_').slice(-60);
  const ext = (safeBase.split('.').pop() || 'bin').toLowerCase().slice(0, 6);
  const site = sitePrefixFromEmail(payload && payload.sub);
  const objectKey = `${site}/videos/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const uploadUrl = await signR2PutUrl({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    key: objectKey,
    expiresIn: 3600,
  });

  const publicUrl = `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${objectKey}`;

  return json({ uploadUrl, publicUrl, objectKey }, 200, origin);
}

// ----- S3 v4 query-string (presigned) PUT URL signer -----
async function signR2PutUrl({ accountId, accessKeyId, secretAccessKey, bucket, key, expiresIn }) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${accessKeyId}/${credentialScope}`;
  const signedHeaders = 'host';

  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': signedHeaders,
  });

  const canonicalUri = `/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const canonicalQueryString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = await hmacSha256Bytes(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp);
  const kRegion = await hmacSha256Bytes(kDate, region);
  const kService = await hmacSha256Bytes(kRegion, service);
  const kSigning = await hmacSha256Bytes(kService, 'aws4_request');
  const signature = bytesToHex(await hmacSha256Bytes(kSigning, stringToSign));

  params.set('X-Amz-Signature', signature);
  return `https://${host}${canonicalUri}?${params.toString()}`;
}

async function hmacSha256Bytes(keyBytes, message) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message)));
}

async function sha256Hex(message) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(hash));
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ----- Shared -----
function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
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
