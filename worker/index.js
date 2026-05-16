// Cloudflare Worker for Mahmoud Adel portfolio
//   - POST /              → Cloudinary signature (existing, kept for backward compat)
//   - POST /r2            → R2 presigned PUT URL (new)
// All endpoints verify JWT from Render backend.

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

    const url = new URL(request.url);
    if (url.pathname === '/r2' || url.pathname.startsWith('/r2/')) {
      return await handleR2Sign(request, env);
    }
    return await handleCloudinarySign(env);
  },
};

// ----- Cloudinary (unchanged) -----
async function handleCloudinarySign(env) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'lensmania';
  const public_id = crypto.randomUUID();
  const signature = await cloudinarySign({ folder, public_id, timestamp }, env.CLOUDINARY_API_SECRET);
  return json({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    timestamp, folder, public_id, signature,
  });
}

async function cloudinarySign(params, apiSecret) {
  const toSign = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + apiSecret;
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(toSign));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ----- R2 presigned PUT URL -----
async function handleR2Sign(request, env) {
  let body;
  try { body = await request.json(); } catch { body = {}; }

  const filename = (body.filename || 'upload').trim();
  const safeBase = filename.replace(/[^\w.\-]/g, '_').slice(-60);
  const ext = (safeBase.split('.').pop() || 'bin').toLowerCase().slice(0, 6);
  const objectKey = `videos/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const uploadUrl = await signR2PutUrl({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    key: objectKey,
    expiresIn: 3600,
  });

  const publicUrl = `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${objectKey}`;

  return json({ uploadUrl, publicUrl, objectKey });
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
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
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
