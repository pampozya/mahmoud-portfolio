import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import {
  API_URL,
  BRAND_LOGO_WHITE_SRC,
  HERO_PORTFOLIO_ORDER,
  IMAGE_UPLOAD_ACCEPT,
  PLATFORMS,
  QRModal,
  UploadProgress,
  api,
  buildCategoryPayload,
  canUseBrowserNotifications,
  collabPlatformLabel,
  getThumbnail,
  getYouTubeId,
  isHeicFile,
  isHeroPortfolioItem,
  parseCategoryMeta,
  parseCollaborators,
  prepareImageUploadFile,
  resolveUrl,
  showAdminBrowserNotification,
  sortCategoriesForDisplay,
} from './App';

// Admin dashboard, login and token-gated review/delivery pages.
// Split out of App.jsx so the public portfolio bundle does not ship this code.

// ==================== LOGIN ====================

function LoginPage({ onLogin, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const data = await api.login(email, password);
      if (data.access_token) { localStorage.setItem('token', data.access_token); onLogin(data.access_token); }
      else setError(data.detail || 'Login failed');
    } catch (err) { setError('Connection error: ' + err.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Admin Login</h1>
        <p>Mahmoud Adel Portfolio</p>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading}>{loading ? 'Logging in…' : 'Login'}</button>
        </form>
        <button className="btn-text-link" onClick={onBack}>← Back to Portfolio</button>
      </div>
    </div>
  );
}

// ==================== ADMIN DASHBOARD ====================

function AdminDashboard({ token, onLogout, onBack }) {
  const [activeTab, setActiveTab] = useState('portfolio');
  const [portfolio, setPortfolio] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const latestNotificationRef = useRef(Number(localStorage.getItem('latestNotificationId') || 0));
  useEffect(() => { loadData(); }, []);

  const refreshNotifications = useCallback(async (announce = false) => {
    try {
      const items = await api.getNotifications(token);
      const list = Array.isArray(items) ? items : [];
      const newestId = list.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
      setUnreadCount(list.filter(item => !item.read).length);

      if (announce && latestNotificationRef.current > 0 && newestId > latestNotificationRef.current) {
        list
          .filter(item => !item.read && Number(item.id) > latestNotificationRef.current)
          .sort((a, b) => Number(a.id) - Number(b.id))
          .forEach(showAdminBrowserNotification);
      }

      if (newestId > latestNotificationRef.current) {
        latestNotificationRef.current = newestId;
        localStorage.setItem('latestNotificationId', String(newestId));
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    refreshNotifications(false);
    const interval = setInterval(() => refreshNotifications(true), 45000);
    return () => clearInterval(interval);
  }, [refreshNotifications]);

  // Enable browser spell check on all admin text fields
  useEffect(() => {
    const els = document.querySelectorAll('.admin-content input[type="text"], .admin-content textarea');
    els.forEach(el => { el.spellcheck = true; el.lang = navigator.language || 'en'; el.dir = 'auto'; });
  }, [activeTab, loading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, c, s] = await Promise.all([api.getPortfolio(), api.getCategories(), api.getSettings()]);
      setPortfolio(Array.isArray(p) ? p : []); setCategories(sortCategoriesForDisplay(c || [])); setSettings(s);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };
  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-back-small" onClick={onBack}>← Site</button>
          <h1>Portfolio Admin</h1>
        </div>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </header>
      <nav className="admin-nav">
        {[['portfolio','📹 Portfolio'],['categories','📁 Categories'],['testimonials','⭐ Testimonials'],['logos','🏷 Clients'],['deliveries','📦 Deliveries'],['analytics','📊 Analytics'],['notifications','🔔'],['settings','⚙️ Settings']].map(([tab, label]) => (
          <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
            {label}
            {tab === 'notifications' && unreadCount > 0 && <span className="admin-nav-badge">{unreadCount}</span>}
          </button>
        ))}
      </nav>
      <main className="admin-content">
        {loading && <p>Loading…</p>}
        {activeTab === 'portfolio' && <PortfolioManager portfolio={portfolio} categories={categories} token={token} onUpdate={loadData} settings={settings} />}
        {activeTab === 'categories' && <CategoriesManager categories={categories} portfolio={portfolio} token={token} onUpdate={loadData} />}
        {activeTab === 'testimonials' && <TestimonialsManager token={token} />}
        {activeTab === 'logos' && <ClientLogosManager token={token} />}
        {activeTab === 'deliveries' && <DeliveriesManager token={token} />}
        {activeTab === 'analytics' && <AnalyticsDashboard token={token} />}
        {activeTab === 'notifications' && <NotificationCenter token={token} onUnreadChange={setUnreadCount} />}
        {activeTab === 'settings' && settings && <SettingsManager settings={settings} token={token} onUpdate={loadData} portfolio={portfolio} />}
      </main>

      <ClaudeAssistant token={token} context={`Admin is managing portfolio for ${settings?.site_title || 'Mahmoud Adel'}, a videographer in ${settings?.location || 'Dubai, UAE'}.`} />
    </div>
  );
}

// ==================== VIDEO COMPRESSION ====================
/* global VideoEncoder, VideoDecoder, VideoFrame, AudioEncoder, AudioData */

async function compressWithWebCodecs(file, onProgress, audioBuffer) {
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = Math.min(audioBuffer.numberOfChannels, 2);

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url; video.muted = true; video.playsInline = true;
  await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = rej; });

  const { videoWidth: w, videoHeight: h, duration } = video;
  const scale = Math.min(1, 720 / Math.max(w, h));
  const tw = Math.round(w * scale / 2) * 2;
  const th = Math.round(h * scale / 2) * 2;

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: tw, height: th },
    audio: { codec: 'aac', sampleRate, numberOfChannels: numChannels },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  // Video encoder — check hardware support first, fall back to software
  const vcConfig = { codec: 'avc1.4D0028', width: tw, height: th, bitrate: 2_500_000, framerate: 30, hardwareAcceleration: 'prefer-hardware' };
  const vcSupport = await VideoEncoder.isConfigSupported(vcConfig);
  if (!vcSupport.supported) throw new Error('VideoEncoder config not supported on this device');

  const FRAME_DUR_US = Math.round(1_000_000 / 30);
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      const dur = (chunk.duration != null && chunk.duration > 0) ? chunk.duration : FRAME_DUR_US;
      muxer.addVideoChunk(chunk, meta, undefined, dur);
    },
    error: e => { throw e; },
  });
  videoEncoder.configure(vcConfig);

  // Audio encoder — hardware accelerated AAC
  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: e => { throw e; },
  });
  audioEncoder.configure({ codec: 'mp4a.40.2', sampleRate, numberOfChannels: numChannels, bitrate: 128_000 });

  // Feed audio chunks (fast)
  const CHUNK = 1024;
  for (let offset = 0; offset < audioBuffer.length; offset += CHUNK) {
    const len = Math.min(CHUNK, audioBuffer.length - offset);
    const planeBytes = len * 4;
    const buf = new ArrayBuffer(planeBytes * numChannels);
    for (let c = 0; c < numChannels; c++) {
      new Float32Array(buf, c * planeBytes, len).set(audioBuffer.getChannelData(c).subarray(offset, offset + len));
    }
    const ad = new AudioData({ format: 'f32-planar', sampleRate, numberOfFrames: len, numberOfChannels: numChannels, timestamp: Math.round((offset / sampleRate) * 1_000_000), data: buf });
    audioEncoder.encode(ad);
    ad.close();
  }

  // Encode video frames at 16x speed
  const canvas = document.createElement('canvas');
  canvas.width = tw; canvas.height = th;
  const ctx = canvas.getContext('2d');
  let frameNum = 0;

  await new Promise((resolve, reject) => {
    video.playbackRate = 16;
    const FRAME_DUR_US = Math.round(1_000_000 / 30);
    const onFrame = (now, meta) => {
      ctx.drawImage(video, 0, 0, tw, th);
      const ts = Math.round((meta?.mediaTime ?? video.currentTime) * 1_000_000);
      const frame = new VideoFrame(canvas, { timestamp: ts, duration: FRAME_DUR_US });
      videoEncoder.encode(frame, { keyFrame: frameNum % 60 === 0 });
      frame.close(); frameNum++;
      if (onProgress) onProgress(Math.min(99, Math.round((video.currentTime / duration) * 100)));
      if (!video.ended && !video.paused) video.requestVideoFrameCallback(onFrame);
    };
    video.requestVideoFrameCallback(onFrame);
    video.play().then(() => { video.onended = resolve; }).catch(reject);
  });

  await videoEncoder.flush();
  await audioEncoder.flush();
  muxer.finalize();
  URL.revokeObjectURL(url);
  return new File([muxer.target.buffer], file.name.replace(/\.[^.]+$/, '_c.mp4'), { type: 'video/mp4' });
}

function fmtEta(ms) {
  if (!isFinite(ms) || ms <= 0) return '';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s left`;
  return `${Math.floor(s / 60)}m ${s % 60}s left`;
}

async function compressWithFFmpeg(file, origMB, onProgress, setLabel) {
  setLabel(`🔄 Compressing ${origMB}MB video…`);
  const TIMEOUT_MS = 240000; // 4 minute timeout
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Compression timeout — uploading original file')), TIMEOUT_MS)
  );

  try {
    const { FFmpeg } = await Promise.race([
      import('@ffmpeg/ffmpeg'),
      timeoutPromise
    ]);
    const { fetchFile, toBlobURL } = await Promise.race([
      import('@ffmpeg/util'),
      timeoutPromise
    ]);

    const ffmpeg = new FFmpeg();
    const startTime = Date.now();
    ffmpeg.on('progress', ({ progress }) => {
      const p = Math.min(Math.max(progress, 0), 1);
      const pct = Math.round(p * 100);
      onProgress(pct);
      if (pct > 2) {
        const elapsed = Date.now() - startTime;
        const eta = (elapsed / p) * (1 - p);
        setLabel(`🔄 Compressing ${origMB}MB… ${pct}% — ${fmtEta(eta)}`);
      }
    });

    try {
      await Promise.race([
        ffmpeg.load({
          coreURL: await toBlobURL('https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd/ffmpeg-core.js', 'text/javascript'),
          wasmURL: await toBlobURL('https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd/ffmpeg-core.wasm', 'application/wasm'),
          workerURL: await toBlobURL('https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd/ffmpeg-core.worker.js', 'text/javascript'),
        }),
        timeoutPromise
      ]);
    } catch {
      await Promise.race([
        ffmpeg.load({
          coreURL: await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js', 'text/javascript'),
          wasmURL: await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm', 'application/wasm'),
        }),
        timeoutPromise
      ]);
    }

    const ext = file.name.split('.').pop().toLowerCase();
    await Promise.race([
      ffmpeg.writeFile(`in.${ext}`, await fetchFile(file)),
      timeoutPromise
    ]);

    await Promise.race([
      ffmpeg.exec(['-i', `in.${ext}`, '-c:v', 'libx264', '-crf', '23', '-preset', 'ultrafast', '-vf', 'scale=-2:min(ih\\,720)', '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart', 'out.mp4']),
      timeoutPromise
    ]);

    const data = await Promise.race([
      ffmpeg.readFile('out.mp4'),
      timeoutPromise
    ]);

    const compressed = new File([data.buffer], file.name.replace(/\.[^.]+$/, '.mp4'), { type: 'video/mp4' });
    const newMB = (compressed.size / 1024 / 1024).toFixed(0);
    setLabel(`Uploading (${origMB}MB → ${newMB}MB)…`);
    return compressed;
  } catch (err) {
    console.warn('FFmpeg compression failed:', err.message);
    setLabel(`Skipping compression (${err.message}) — uploading original…`);
    return file;
  }
}

// ==================== COLLABORATOR EDITOR ====================


const COLLABORATOR_LIBRARY_KEY = 'lensmania_collaborator_library';

function normalizeCollaborator(c) {
  if (!c || typeof c !== 'object') return null;
  const handle = (c.handle || c.name || '').trim();
  const role = (c.role || '').trim();
  const url = (c.url || '').trim();
  if (!handle && !url) return null;
  return { handle, role, url };
}

function collaboratorKey(c) {
  const normalized = normalizeCollaborator(c);
  if (!normalized) return '';
  return `${normalized.handle}|${normalized.role}|${normalized.url}`.toLowerCase();
}

function collaboratorLabel(c) {
  const normalized = normalizeCollaborator(c);
  if (!normalized) return '';
  return [normalized.handle, normalized.role].filter(Boolean).join(' — ') || normalized.url;
}

function mergeCollaboratorOptions(...groups) {
  const seen = new Set();
  const merged = [];
  groups.flat().forEach(c => {
    const normalized = normalizeCollaborator(c);
    const key = collaboratorKey(normalized);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(normalized);
  });
  return merged.sort((a, b) => collaboratorLabel(a).localeCompare(collaboratorLabel(b)));
}

function readSavedCollaborators() {
  try {
    const parsed = JSON.parse(localStorage.getItem(COLLABORATOR_LIBRARY_KEY) || '[]');
    return Array.isArray(parsed) ? mergeCollaboratorOptions(parsed) : [];
  } catch {
    return [];
  }
}

function saveCollaboratorLibrary(collaborators) {
  localStorage.setItem(COLLABORATOR_LIBRARY_KEY, JSON.stringify(mergeCollaboratorOptions(collaborators)));
}



function CollaboratorEditor({ value, onChange, savedCollaborators = [], onRemember }) {
  const list = parseCollaborators(value);
  const reusableCollaborators = mergeCollaboratorOptions(savedCollaborators)
    .filter(c => !list.some(existing => collaboratorKey(existing) === collaboratorKey(c)));
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('');
  const [url, setUrl] = useState('');
  const [selectedSaved, setSelectedSaved] = useState('');

  const update = (newList) => onChange(JSON.stringify(newList));

  const addCollaborator = (collaborator, remember = true) => {
    const normalized = normalizeCollaborator(collaborator);
    if (!normalized) return;
    if (list.some(existing => collaboratorKey(existing) === collaboratorKey(normalized))) return;
    update([...list, normalized]);
    if (remember && onRemember) onRemember(normalized);
  };

  const add = () => {
    if (!handle.trim()) return;
    const h = handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim()}`;
    addCollaborator({ handle: h, role, url });
    setHandle(''); setRole(''); setUrl('');
  };

  const reuseSaved = (key) => {
    const selected = reusableCollaborators.find(c => collaboratorKey(c) === key);
    if (!selected) return;
    addCollaborator(selected, false);
    setSelectedSaved('');
  };

  const remove = (i) => update(list.filter((_, j) => j !== i));

  return (
    <div className="collab-editor">
      {list.map((c, i) => (
        <div key={i} className="collab-row">
          <span className="collab-handle">{c.handle || c.name || c.url}</span>
          {c.role && <span className="collab-role-tag">{c.role}</span>}
          {c.url && <span className="collab-role-tag" style={{ color: 'var(--color-accent)', fontSize: '0.7rem' }}>{collabPlatformLabel(c)}</span>}
          <button type="button" className="collab-remove" onClick={() => remove(i)}>✕</button>
        </div>
      ))}
      {reusableCollaborators.length > 0 && (
        <select
          className="collab-reuse-select"
          value={selectedSaved}
          onChange={e => {
            setSelectedSaved(e.target.value);
            reuseSaved(e.target.value);
          }}
        >
          <option value="">Reuse saved collaborator…</option>
          {reusableCollaborators.map(c => (
            <option key={collaboratorKey(c)} value={collaboratorKey(c)}>
              {collaboratorLabel(c)}
            </option>
          ))}
        </select>
      )}
      <div className="collab-add-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <input
          type="text"
          placeholder="@handle"
          value={handle}
          onChange={e => setHandle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          style={{ flex: '1 1 100px' }}
        />
        <input
          type="text"
          placeholder="Role (e.g. Cinematographer)"
          value={role}
          onChange={e => setRole(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          style={{ flex: '2 1 160px' }}
        />
        <input
          type="url"
          placeholder="Link (Instagram, Vimeo, etc.)"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          style={{ flex: '2 1 180px' }}
        />
        <button type="button" className="btn-secondary btn-sm" onClick={add}>+ Add</button>
      </div>
    </div>
  );
}

// ==================== PORTFOLIO MANAGER ====================

const EMPTY_FORM = { category_id: '', title: '', description: 'Cinematic social media reel', video_url: '', video_type: 'youtube', embed_code: '', thumbnail_url: '', featured: false, use_in_hero: false, featured_focal_x: 50, featured_focal_y: 50, order: 0, aspect_ratio: '16:9', collaborators: '', bts_photos: '[]', seo_title: '', seo_description: '' };
const EMPTY_UPLOAD_CLIENT_LOGO = { name: '', image_url: '', link_url: '' };

async function ensureVideoMetadata(video) {
  if (Number.isFinite(video.duration) && video.duration > 0 && video.videoWidth) return;
  await new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('Video metadata unavailable.')); };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', done);
      video.removeEventListener('loadeddata', done);
      video.removeEventListener('error', fail);
      clearTimeout(timer);
    };
    const timer = setTimeout(fail, 6000);
    video.addEventListener('loadedmetadata', done);
    video.addEventListener('loadeddata', done);
    video.addEventListener('error', fail);
    video.load?.();
  });
}

async function seekVideoFrame(video, time) {
  await ensureVideoMetadata(video);
  const safeTime = Math.max(0, Math.min(video.duration - 0.08, time));
  await new Promise((resolve, reject) => {
    const done = () => requestAnimationFrame(() => { cleanup(); resolve(); });
    const fail = () => { cleanup(); reject(new Error('Could not read this video frame.')); };
    const cleanup = () => {
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', fail);
      clearTimeout(timer);
    };
    const timer = setTimeout(done, 1200);
    video.addEventListener('seeked', done, { once: true });
    video.addEventListener('error', fail, { once: true });
    video.currentTime = safeTime;
  });
}

function captureVideoCanvas(video, maxWidth = 900) {
  const width = Math.min(video.videoWidth || maxWidth, maxWidth);
  const height = Math.max(1, Math.round(width * (video.videoHeight || width) / (video.videoWidth || width)));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(video, 0, 0, width, height);
  return canvas;
}

function scoreThumbnailFrame(canvas) {
  const ctx = canvas.getContext('2d');
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let mean = 0, variance = 0, saturation = 0, gradient = 0, centerGradient = 0;
  let dark = 0, blown = 0, skin = 0, samples = 0, centerSamples = 0;

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const rightIdx = idx + 4;
      const downIdx = idx + (width * 4);
      const rightGray = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
      const downGray = 0.299 * data[downIdx] + 0.587 * data[downIdx + 1] + 0.114 * data[downIdx + 2];
      const edge = Math.abs(gray - rightGray) + Math.abs(gray - downGray);
      const isCenter = x > width * 0.25 && x < width * 0.75 && y > height * 0.22 && y < height * 0.78;

      mean += gray;
      variance += gray * gray;
      saturation += max ? (max - min) / max : 0;
      gradient += edge;
      if (isCenter) { centerGradient += edge; centerSamples++; }
      if (gray < 18) dark++;
      if (gray > 238) blown++;
      if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 14) skin++;
      samples++;
    }
  }

  mean /= samples || 1;
  const std = Math.sqrt(Math.max(0, (variance / (samples || 1)) - (mean * mean)));
  const exposure = 1 - Math.min(1, Math.abs(mean - 128) / 128);
  const sharpnessScore = Math.min(1, (gradient / (samples || 1)) / 46);
  const centerScore = Math.min(1, (centerGradient / (centerSamples || 1)) / 52);
  const contrastScore = Math.min(1, std / 70);
  const saturationScore = Math.min(1, (saturation / (samples || 1)) / 0.42);
  const skinBoost = Math.min(0.1, (skin / (samples || 1)) * 1.8);
  const exposurePenalty = Math.min(0.35, (dark / (samples || 1)) * 0.5 + (blown / (samples || 1)) * 0.45);

  return (sharpnessScore * 0.34) + (contrastScore * 0.22) + (exposure * 0.18) +
    (saturationScore * 0.12) + (centerScore * 0.12) + skinBoost - exposurePenalty;
}

async function extractSmartThumbnailFrames(video, onProgress) {
  await ensureVideoMetadata(video);
  const originalTime = video.currentTime || 0;
  const duration = video.duration;
  const sampleCount = Math.min(24, Math.max(12, Math.round(duration / 2)));
  const candidates = Array.from({ length: sampleCount }, (_, i) => 0.06 + ((i / Math.max(1, sampleCount - 1)) * 0.88));
  const scored = [];

  for (let i = 0; i < candidates.length; i++) {
    const pct = candidates[i];
    await seekVideoFrame(video, duration * pct);
    scored.push({ pct, score: scoreThumbnailFrame(captureVideoCanvas(video, 360)) });
    onProgress?.(8 + Math.round(((i + 1) / candidates.length) * 66));
  }

  const selected = [];
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const minGap = sampleCount >= 20 ? 0.07 : 0.09;
  sorted.forEach(frame => {
    if (selected.length < 6 && selected.every(existing => Math.abs(existing.pct - frame.pct) >= minGap)) selected.push(frame);
  });
  sorted.forEach(frame => {
    if (selected.length < 6 && !selected.includes(frame)) selected.push(frame);
  });

  const frames = [];
  for (let i = 0; i < selected.length; i++) {
    await seekVideoFrame(video, duration * selected[i].pct);
    frames.push(captureVideoCanvas(video, 900).toDataURL('image/jpeg', 0.82));
    onProgress?.(74 + Math.round(((i + 1) / selected.length) * 24));
  }
  await seekVideoFrame(video, originalTime).catch(() => {});
  return frames;
}

function PortfolioManager({ portfolio, categories, token, onUpdate, settings }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [savedCollaborators, setSavedCollaborators] = useState(readSavedCollaborators);
  const [clientLogoForm, setClientLogoForm] = useState(EMPTY_UPLOAD_CLIENT_LOGO);
  const [adminSort, setAdminSort] = useState('order');
  const [featuredList, setFeaturedList] = useState([]);
  const [featuredDragIdx, setFeaturedDragIdx] = useState(null);
  const [featuredOrderMsg, setFeaturedOrderMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadFilename, setUploadFilename] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [btsPhotos, setBtsPhotos] = useState([]);
  const [autoFrames, setAutoFrames] = useState([]);
  const [fetchingThumb, setFetchingThumb] = useState(false);
  const [thumbOptions, setThumbOptions] = useState([]);
  const videoPreviewRef = useRef(null);
  const thumbFetchTimer = useRef(null);
  const set = (patch) => setForm(prev => ({ ...prev, ...patch }));
  const collaboratorOptions = useMemo(() => {
    const usedCollaborators = portfolio.flatMap(item => parseCollaborators(item.collaborators));
    return mergeCollaboratorOptions(usedCollaborators, savedCollaborators);
  }, [portfolio, savedCollaborators]);

  const rememberCollaborator = (collaborator) => {
    setSavedCollaborators(prev => {
      const next = mergeCollaboratorOptions(prev, [collaborator]);
      saveCollaboratorLibrary(next);
      return next;
    });
  };

  // ---- Featured "Selected Work" drag-reorder (mirrors CategoriesManager) ----
  useEffect(() => {
    setFeaturedList(
      [...portfolio]
        .filter(p => p.featured && !isHeroPortfolioItem(p))  // exclude the hero item; its order is the special hero sentinel
        .sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)) || (new Date(b.created_at) - new Date(a.created_at)))
    );
  }, [portfolio]);

  const persistFeaturedOrder = async (nextList) => {
    setFeaturedList(nextList);
    setFeaturedOrderMsg('Saving order…');
    const res = await api.reorderPortfolio(token, nextList.map(p => p.id));
    if (res?.ok) {
      setFeaturedOrderMsg('✅ Featured order saved');
      setTimeout(() => setFeaturedOrderMsg(''), 2200);
      onUpdate();
    } else {
      setFeaturedOrderMsg(`❌ ${res?.detail || 'Could not save order'}`);
    }
  };

  const onFeaturedDragStart = (i) => setFeaturedDragIdx(i);
  const onFeaturedDragOver = (e, i) => {
    e.preventDefault();
    if (featuredDragIdx === null || featuredDragIdx === i) return;
    const next = [...featuredList];
    const [moved] = next.splice(featuredDragIdx, 1);
    next.splice(i, 0, moved);
    setFeaturedList(next); setFeaturedDragIdx(i);
  };
  const onFeaturedDragEnd = async () => {
    if (featuredDragIdx === null) return;
    setFeaturedDragIdx(null);
    await persistFeaturedOrder(featuredList);
  };
  const moveFeatured = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= featuredList.length) return;
    const next = [...featuredList];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    await persistFeaturedOrder(next);
  };

  const captureFrame = async () => {
    const video = videoPreviewRef.current; if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
      setUploading(true); setUploadFilename('thumbnail.jpg'); setUploadProgress(0);
      const res = await api.uploadFile(token, file, p => setUploadProgress(p));
      if (res.url) { set({ thumbnail_url: res.url }); setUploadProgress(100); setUploadStatus('done'); }
      setUploading(false);
    }, 'image/jpeg', 0.9);
  };

  const handleUpload = async (e, field) => {
    let file = e.target.files[0]; if (!file) return;
    setUploading(true); setUploadStatus('');
    setUploadFilename(file.name); setUploadProgress(0);

    try {
      if (isHeicFile(file)) {
        setUploadFilename(`Converting ${file.name} to JPEG…`);
        setUploadProgress(1);
        file = await prepareImageUploadFile(file);
        setUploadFilename(file.name);
        setUploadProgress(0);
      }
      // R2 upload — no client-side compression, full original quality preserved.
      const res = await api.uploadFile(token, file, p => setUploadProgress(Math.max(1, p)));
      if (res.url) { set({ [field]: res.url }); setUploadProgress(100); setUploadStatus('done'); }
      else setUploadStatus('error');
    } catch (e) {
      console.error('Upload error:', e);
      setUploadStatus('error');
    } finally { setUploading(false); }
  };

  const handleClientLogoUpload = async (e) => {
    let file = e.target.files[0]; if (!file) return;
    setUploading(true); setUploadStatus('');
    setUploadFilename(file.name); setUploadProgress(0);
    try {
      if (isHeicFile(file)) {
        setUploadFilename(`Converting ${file.name} to JPEG…`);
        setUploadProgress(1);
        file = await prepareImageUploadFile(file);
        setUploadFilename(file.name);
        setUploadProgress(0);
      }
      const res = await api.uploadFile(token, file, p => setUploadProgress(Math.max(1, p)));
      if (res.url) {
        setClientLogoForm(prev => ({ ...prev, image_url: res.url }));
        setUploadProgress(100); setUploadStatus('done');
      } else setUploadStatus('error');
    } catch (err) {
      console.error('Client logo upload failed:', err);
      setUploadStatus('error');
    } finally { setUploading(false); }
  };

  const handleBtsUpload = async (e) => {
    const files = Array.from(e.target.files); if (!files.length) return;
    setUploading(true); setUploadStatus('uploading');
    const urls = [...btsPhotos];
    let succeeded = 0; let failed = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        let file = files[i];
        setUploadFilename(`(${i + 1}/${files.length}) ${file.name}`);
        setUploadProgress(0);
        try {
          if (isHeicFile(file)) {
            setUploadFilename(`(${i + 1}/${files.length}) Converting ${file.name} to JPEG…`);
            setUploadProgress(1);
            file = await prepareImageUploadFile(file);
            setUploadFilename(`(${i + 1}/${files.length}) ${file.name}`);
            setUploadProgress(0);
          }
          const res = await api.uploadFile(token, file, p => setUploadProgress(p));
          if (res.url) { urls.push(res.url); succeeded++; }
          else { failed++; }
        } catch (err) {
          console.error(`BTS upload failed for ${file.name}:`, err);
          failed++;
        }
      }
    } finally {
      setBtsPhotos(urls);
      set({ bts_photos: JSON.stringify(urls) });
      setUploading(false);
      setUploadProgress(100);
      if (failed > 0 && succeeded === 0) setUploadStatus('error');
      else if (failed > 0) { setUploadStatus('done'); setUploadFilename(`${succeeded} uploaded, ${failed} failed — check console`); }
      else setUploadStatus('done');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { use_in_hero, ...formPayload } = form;
    const payload = {
      ...formPayload,
      category_id: parseInt(form.category_id),
      bts_photos: JSON.stringify(btsPhotos),
      featured: form.featured,  // hero is independent of featured — set hero via the checkbox, featured via its own toggle
      order: use_in_hero ? HERO_PORTFOLIO_ORDER : (Number(form.order) === HERO_PORTFOLIO_ORDER ? 0 : Number(form.order || 0)),
    };
    try {
      if (use_in_hero) {
        await Promise.all(
          portfolio
            .filter(item => isHeroPortfolioItem(item) && item.id !== editId)
            .map(item => api.updatePortfolio(token, item.id, { order: 0 }))
        );
      }
      if (editId) await api.updatePortfolio(token, editId, payload);
      else await api.createPortfolio(token, payload);
      if (clientLogoForm.name.trim() && clientLogoForm.image_url) {
        await api.createClientLogo(token, {
          name: clientLogoForm.name.trim(),
          image_url: clientLogoForm.image_url,
          link_url: clientLogoForm.link_url.trim() || null,
          order: 999,
          active: true,
        });
      }
      cancelForm(); onUpdate();
    } catch (err) { console.error(err); }
  };

  const openEdit = (item) => {
    const bts = item.bts_photos ? JSON.parse(item.bts_photos) : [];
    setBtsPhotos(bts);
    setForm({ category_id: item.category_id, title: item.title, description: item.description || '', video_url: item.video_url || '', video_type: item.video_type || 'youtube', embed_code: item.embed_code || '', thumbnail_url: item.thumbnail_url || '', featured: item.featured, use_in_hero: isHeroPortfolioItem(item), featured_focal_x: item.featured_focal_x ?? 50, featured_focal_y: item.featured_focal_y ?? 50, order: item.order || 0, aspect_ratio: item.aspect_ratio || '16:9', collaborators: item.collaborators || '', bts_photos: item.bts_photos || '[]', seo_title: item.seo_title || '', seo_description: item.seo_description || '' });
    setClientLogoForm(EMPTY_UPLOAD_CLIENT_LOGO);
    setEditId(item.id); setShowForm(true); setUploadStatus('');
  };

  const cancelForm = () => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); setClientLogoForm(EMPTY_UPLOAD_CLIENT_LOGO); setBtsPhotos([]); setAutoFrames([]); setUploadStatus(''); setThumbOptions([]); };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this item?')) { await api.deletePortfolio(token, id); onUpdate(); }
  };

  const handleDuplicate = async (id) => {
    await api.duplicatePortfolio(token, id); onUpdate();
  };

  const needsUrl = !['embed', 'direct'].includes(form.video_type);
  const platformLabel = PLATFORMS[form.video_type]?.label || 'URL';

  return (
    <div className="manager-section">
      <div className="section-header">
        <h2>Portfolio Items ({portfolio.length})</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={adminSort} onChange={e => setAdminSort(e.target.value)} style={{ padding: '0.35rem 0.7rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#aaa', borderRadius: 4, fontSize: '0.85rem' }}>
            <option value="order">Sort: Default</option>
            <option value="views">Sort: Most Views</option>
            <option value="likes">Sort: Most Likes</option>
            <option value="newest">Sort: Newest</option>
          </select>
          <PDFExportButton portfolio={portfolio} settings={settings} />
          {!showForm && <button className="btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); setClientLogoForm(EMPTY_UPLOAD_CLIENT_LOGO); setBtsPhotos([]); }}>➕ Add New Item</button>}
        </div>
      </div>

      {showForm && (
        <form className="portfolio-form" onSubmit={handleSubmit}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--color-peach)' }}>{editId ? '✏️ Edit Item' : '➕ New Item'}</h3>

          <label className="field-label">Category *</label>
          <select value={form.category_id} onChange={e => {
            const catId = e.target.value;
            const catName = (categories.find(c => String(c.id) === catId)?.name || '').toLowerCase();
            const isVertical = /social.?media|medical|reel|tiktok|instagram|clinic|health/i.test(catName);
            set({ category_id: catId, ...(isVertical ? { aspect_ratio: '9:16' } : {}) });
          }} required>
            <option value="">Select category…</option>
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>

          <label className="field-label">Title *</label>
          <input type="text" placeholder="e.g. Dubai Real Estate Showreel" value={form.title} onChange={e => set({ title: e.target.value })} required />

          <label className="field-label">Description</label>
          <textarea placeholder="Brief description…" value={form.description} onChange={e => set({ description: e.target.value })} />

          <label className="field-label">Platform / Video Type</label>
          <select value={form.video_type} onChange={e => set({ video_type: e.target.value, video_url: '', embed_code: '' })}>
            {Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          <label className="featured-label hero-featured-label">
            <input
              type="checkbox"
              checked={form.use_in_hero}
              onChange={e => set({ use_in_hero: e.target.checked })}
            />
            🏠 Use this video in hero section
          </label>
          <p className="hero-featured-hint">
            Only one portfolio item can be the hero. Direct uploaded videos play as the hero background; external links use their thumbnail.
            This is independent of “Selected Work” — tick the Featured box below too only if you also want it in the highlights carousel.
          </p>

          {needsUrl && (
            <>
              <label className="field-label">
                {platformLabel} URL
                {fetchingThumb && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', marginLeft: '0.5rem' }}>🔍 Fetching thumbnail…</span>}
                {!fetchingThumb && form.thumbnail_url && form.video_url && <span style={{ color: '#86efac', fontSize: '0.78rem', marginLeft: '0.5rem' }}>✅ Thumbnail auto-fetched</span>}
              </label>
              <input
                type="url"
                placeholder={`Paste ${platformLabel} link…`}
                value={form.video_url}
                onChange={e => {
                  const url = e.target.value;
                  set({ video_url: url, thumbnail_url: '' });
                  setThumbOptions([]);
                  clearTimeout(thumbFetchTimer.current);
                  if (url.length > 10) {
                    thumbFetchTimer.current = setTimeout(async () => {
                      setFetchingThumb(true);
                      try {
                        const DEFAULT_DESC = 'Cinematic social media reel';
                        const applyMeta = (res) => {
                          const updates = {};
                          if (res.title && !form.title) updates.title = res.title;
                          if (res.description && (!form.description || form.description === DEFAULT_DESC)) updates.description = res.description;
                          if (Object.keys(updates).length) set(updates);
                        };
                        // YouTube: build multiple thumbnail options
                        const ytId = getYouTubeId(url);
                        if (ytId) {
                          const opts = ['maxresdefault','hqdefault','mqdefault','sddefault','0','1','2','3']
                            .map(q => `https://img.youtube.com/vi/${ytId}/${q}.jpg`);
                          setThumbOptions(opts);
                          set({ thumbnail_url: opts[1] });
                          // Still call backend for yt title/description
                          api.fetchThumbnail(token, url).then(res => applyMeta(res)).catch(() => {});
                          setFetchingThumb(false);
                          return;
                        }
                        const res = await api.fetchThumbnail(token, url);
                        applyMeta(res);
                        if (res.thumbnail_url) {
                          set({ thumbnail_url: res.thumbnail_url });
                          setThumbOptions([res.thumbnail_url]);
                        } else {
                          setThumbOptions(['manual']);
                        }
                      } catch {}
                      finally { setFetchingThumb(false); }
                    }, 800);
                  }
                }}
              />
            </>
          )}
          {form.video_type === 'direct' && (
            <>
              <label className="field-label">Upload Video File</label>
              <div className="upload-area">
                <label className="upload-label">
                  <input type="file" accept="video/mp4,video/quicktime,video/webm,video/avi" onChange={e => handleUpload(e, 'video_url')} disabled={uploading} />
                  <span>Choose video file…</span>
                </label>
                {form.video_url && <p className="upload-preview">✅ {form.video_url.split('/').pop()}</p>}
              </div>
              {form.video_url && (
                <div className="frame-picker">
                  <p className="field-label">Auto-extract frames or scrub manually</p>
                  <video ref={videoPreviewRef} src={resolveUrl(form.video_url)} controls className="frame-picker-video" crossOrigin="anonymous" />
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    <button type="button" className="btn-capture" onClick={captureFrame} disabled={uploading}>📸 Capture Current Frame</button>
                    <button type="button" className="btn-capture" onClick={async () => {
                      const video = videoPreviewRef.current; if (!video) return;
                      setUploading(true); setUploadStatus('');
                      setUploadFilename('Fast AI scanning frames…'); setUploadProgress(5);
                      try {
                        const frames = await extractSmartThumbnailFrames(video, p => setUploadProgress(p));
                        setAutoFrames(frames);
                        setUploadFilename(`⚡ Fast AI picked ${frames.length} strong frames`);
                        setUploadProgress(100);
                        setUploadStatus('done');
                      } catch (e) {
                        setUploadFilename(`❌ Could not analyze frames: ${e.message}`);
                        setUploadStatus('error');
                      } finally {
                        setUploading(false);
                      }
                    }} disabled={uploading}>⚡ AI Pick 6 Frames</button>
                    <button type="button" className="btn-capture" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'var(--color-peach)' }} onClick={async () => {
                      const video = videoPreviewRef.current; if (!video) return;
                      setUploading(true); setUploadStatus('');
                      setUploadFilename('AI analyzing frames…'); setUploadProgress(10);
                      const durations = [0.1, 0.25, 0.5, 0.75, 0.85, 0.95];
                      const b64Frames = [];
                      for (const pct of durations) {
                        video.currentTime = video.duration * pct;
                        await new Promise(r => setTimeout(r, 350));
                        const c = document.createElement('canvas'); c.width = Math.min(video.videoWidth, 800); c.height = Math.round(c.width * video.videoHeight / video.videoWidth);
                        c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
                        b64Frames.push(c.toDataURL('image/jpeg', 0.7).split(',')[1]);
                      }
                      setUploadProgress(50);
                      try {
                        const result = await api.aiBestThumbnail(token, b64Frames, form.title);
                        const best = result.best_frame || 0;
                        const allFrames = b64Frames.map(b => `data:image/jpeg;base64,${b}`);
                        setAutoFrames(allFrames);
                        setUploadProgress(80);
                        // Auto-upload the best frame
                        const blob = await (await fetch(allFrames[best])).blob();
                        const file = new File([blob], 'ai-thumbnail.jpg', { type: 'image/jpeg' });
                        const res = await api.uploadFile(token, file, p => setUploadProgress(80 + Math.round(p * 0.2)));
                        if (res.url) { set({ thumbnail_url: res.url }); setUploadStatus('done'); }
                        setUploadFilename(`✦ AI picked frame ${best + 1}: ${result.reason || ''}`);
                      } catch (e) {
                        setUploadFilename(`❌ AI error: ${e.message}`);
                        setUploadStatus('error');
                      }
                      setUploading(false);
                    }} disabled={uploading}>☁ Cloud AI Pick Best</button>
                  </div>
                  {autoFrames.length > 0 && (
                    <div className="auto-frames">
                      <p className="field-label" style={{ marginTop: '0.75rem' }}>Pick a thumbnail:</p>
                      <div className="auto-frames-grid">
                        {autoFrames.map((f, i) => (
                          <img key={i} src={f} alt={`Frame ${i+1}`} className={form.thumbnail_url === f ? 'frame-selected' : ''} onClick={async () => {
                            const blob = await (await fetch(f)).blob();
                            const file = new File([blob], 'thumb.jpg', { type: 'image/jpeg' });
                            setUploading(true); setUploadFilename('thumb.jpg'); setUploadProgress(0);
                            const res = await api.uploadFile(token, file, p => setUploadProgress(p));
                            if (res.url) { set({ thumbnail_url: res.url }); setUploadProgress(100); setUploadStatus('done'); }
                            setUploading(false);
                          }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {form.video_type === 'embed' && (
            <>
              <label className="field-label">Paste Embed Code (any platform)</label>
              <textarea placeholder='<iframe src="..." ...></iframe>' value={form.embed_code} onChange={e => set({ embed_code: e.target.value })} style={{ fontFamily: 'monospace', fontSize: '0.85rem' }} />
            </>
          )}

          <label className="field-label">Aspect Ratio</label>
          <select value={form.aspect_ratio} onChange={e => set({ aspect_ratio: e.target.value })}>
            <option value="16:9">16:9 — Landscape (YouTube, cinema)</option>
            <option value="9:16">9:16 — Vertical (Instagram Reels, TikTok)</option>
            <option value="1:1">1:1 — Square</option>
            <option value="4:3">4:3 — Classic</option>
            <option value="21:9">21:9 — Ultrawide / Cinematic</option>
          </select>

          <label className="field-label">Thumbnail Image (optional)</label>
          <p id="thumb-hint" style={{ display: 'none', color: '#fca5a5', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
            📸 Instagram/TikTok thumbnails can't be fetched automatically — please upload a screenshot below.
          </p>
          <div className="upload-area">
            <label className="upload-label">
              <input type="file" accept={IMAGE_UPLOAD_ACCEPT} onChange={e => handleUpload(e, 'thumbnail_url')} disabled={uploading} />
              <span>Choose thumbnail…</span>
            </label>
            {form.thumbnail_url && form.thumbnail_url !== '' && (
              <div className="thumb-preview"><img src={resolveUrl(form.thumbnail_url)} alt="Thumbnail preview" /></div>
            )}
          </div>
          {thumbOptions.length > 0 && thumbOptions[0] !== 'manual' && (
            <div className="thumb-options">
              <p className="field-label">Pick a thumbnail:</p>
              <div className="thumb-options-grid">
                {thumbOptions.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Option ${i+1}`}
                    className={form.thumbnail_url === url ? 'thumb-opt-selected' : 'thumb-opt'}
                    onClick={() => set({ thumbnail_url: url })}
                    onError={e => e.target.style.display = 'none'}
                  />
                ))}
              </div>
            </div>
          )}
          {thumbOptions[0] === 'manual' && (
            <p style={{ color: '#fca5a5', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
              📸 This platform doesn't support auto-thumbnails — take a screenshot of the video and upload it above.
            </p>
          )}

          <label className="field-label">BTS Photos (Behind the Scenes)</label>
          <div className="upload-area">
            <label className="upload-label">
              <input type="file" accept={`image/*,${IMAGE_UPLOAD_ACCEPT}`} multiple onChange={handleBtsUpload} disabled={uploading} />
              <span>Choose BTS photos…</span>
            </label>
            {btsPhotos.length > 0 && (
              <div className="bts-admin-grid">
                {btsPhotos.map((url, i) => (
                  <div key={i} className="bts-admin-item">
                    <img src={resolveUrl(url)} alt={`BTS ${i+1}`} />
                    <button type="button" onClick={() => { const n = btsPhotos.filter((_, j) => j !== i); setBtsPhotos(n); set({ bts_photos: JSON.stringify(n) }); }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="field-label">Collaborators</label>
          <CollaboratorEditor
            value={form.collaborators}
            onChange={val => set({ collaborators: val })}
            savedCollaborators={collaboratorOptions}
            onRemember={rememberCollaborator}
          />

          <div className="inline-client-logo-panel">
            <div>
              <label className="field-label">Worked With client logo (optional)</label>
              <p className="hero-featured-hint">
                Add a client/brand logo while uploading this video. It will appear in the Worked With strip after saving.
              </p>
            </div>
            <input
              type="text"
              placeholder="Client / brand name"
              value={clientLogoForm.name}
              onChange={e => setClientLogoForm(prev => ({ ...prev, name: e.target.value }))}
            />
            <input
              type="url"
              placeholder="Client website (optional)"
              value={clientLogoForm.link_url}
              onChange={e => setClientLogoForm(prev => ({ ...prev, link_url: e.target.value }))}
            />
            <div className="upload-area">
              <label className="upload-label">
                <input type="file" accept={`image/png,image/svg+xml,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif`} onChange={handleClientLogoUpload} disabled={uploading} />
                <span>{clientLogoForm.image_url ? 'Replace client logo…' : 'Upload client logo…'}</span>
              </label>
              {clientLogoForm.image_url && (
                <div className="client-logo-inline-preview">
                  <img src={resolveUrl(clientLogoForm.image_url)} alt="Client logo preview" />
                </div>
              )}
            </div>
          </div>

          <label className="field-label">SEO Title (for Google)</label>
          <input type="text" placeholder="Optimized title for search engines" value={form.seo_title} onChange={e => set({ seo_title: e.target.value })} />
          <label className="field-label">SEO Description</label>
          <textarea placeholder="Brief description for Google search results…" value={form.seo_description} onChange={e => set({ seo_description: e.target.value })} />

          <UploadProgress progress={uploadProgress} filename={uploadFilename} done={uploadStatus === 'done'} error={uploadStatus === 'error'} />

          <label className="featured-label">
            <input type="checkbox" checked={form.featured} onChange={e => set({ featured: e.target.checked })} />
            ⭐ Mark as Featured
          </label>

          {form.featured && (form.thumbnail_url || autoFrames.length > 0) && (
            <div className="focal-picker">
              <label className="field-label">Featured Highlight — Focal Point</label>
              <p className="focal-hint">Click anywhere on the image to set what stays centered in the home-page highlight banner.</p>
              <div
                className="focal-preview"
                onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
                  const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
                  set({ featured_focal_x: Math.round(x), featured_focal_y: Math.round(y) });
                }}
              >
                <img src={resolveUrl(form.thumbnail_url || autoFrames[0])} alt="Focal preview" draggable={false} />
                <div className="focal-dot" style={{ left: `${form.featured_focal_x}%`, top: `${form.featured_focal_y}%` }} />
              </div>
              <div className="focal-coords">x: {Math.round(form.featured_focal_x)}% &nbsp;·&nbsp; y: {Math.round(form.featured_focal_y)}%</div>
            </div>
          )}

          <div className="form-buttons">
            <button type="submit" className="btn-primary" disabled={uploading}>{editId ? '💾 Update' : '💾 Save'}</button>
            <button type="button" className="btn-secondary" onClick={cancelForm}>Cancel</button>
          </div>
        </form>
      )}

      {!showForm && featuredList.length > 0 && (
        <div className="featured-reorder" style={{ marginBottom: '1.75rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 0.35rem' }}>⭐ Selected Work order</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0 0 0.9rem' }}>
            Drag ⠿ or use ↑ ↓ to set the order of the homepage featured carousel. Only the first 5 appear on the homepage.
          </p>
          {featuredOrderMsg && <p className={`upload-status ${featuredOrderMsg.startsWith('✅') ? 'upload-ok' : featuredOrderMsg.startsWith('❌') ? 'upload-err' : ''}`}>{featuredOrderMsg}</p>}
          <div className="categories-list">
            {featuredList.map((item, i) => {
              const thumb = getThumbnail(item);
              return (
                <div key={item.id} className="category-item draggable"
                  draggable onDragStart={() => onFeaturedDragStart(i)} onDragOver={e => onFeaturedDragOver(e, i)} onDragEnd={onFeaturedDragEnd}>
                  <span className="drag-handle">⠿</span>
                  {thumb && <img src={thumb} alt="" style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 4, opacity: i < 5 ? 1 : 0.4 }} />}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{i + 1}. {item.title}</h3>
                    {i >= 5 && <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>not shown on homepage (rank &gt; 5)</p>}
                  </div>
                  <div className="card-actions">
                    <button type="button" className="btn-secondary btn-sm" onClick={() => moveFeatured(i, -1)} disabled={i === 0}>↑</button>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => moveFeatured(i, 1)} disabled={i === featuredList.length - 1}>↓</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="portfolio-list">
        {[...portfolio].sort((a, b) => {
          if (adminSort === 'views') return (b.views ?? 0) - (a.views ?? 0);
          if (adminSort === 'likes') return (b.likes ?? 0) - (a.likes ?? 0);
          if (adminSort === 'newest') return b.id - a.id;
          return (a.order ?? 0) - (b.order ?? 0);
        }).map(item => {
          const thumb = getThumbnail(item);
          return (
            <div key={item.id} className="portfolio-item-card">
              {thumb && <img src={thumb} alt={item.title} className="card-thumb-admin" style={{ aspectRatio: (item.aspect_ratio || '16:9').replace(':', '/'), height: 'auto' }} />}
              <div className="card-body-admin">
                <h3>{item.title}</h3>
                {item.description && <p>{item.description}</p>}
                <div style={{ display: 'flex', gap: '0.75rem', margin: '0.5rem 0', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: '#fff', fontWeight: 600 }}>👁 {item.views ?? 0}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: '#aaa', fontWeight: 500 }}>❤️ {item.likes || 0}</span>
                </div>
                <div className="item-meta">
                  <span className="type-badge">{PLATFORMS[item.video_type]?.label || item.video_type}</span>
                  <span className="type-badge">{item.aspect_ratio}</span>
                  {isHeroPortfolioItem(item) && <span>🏠</span>}
                  {item.featured && <span>⭐</span>}
                  {settings?.reel_of_month_id === item.id && <span>🎬</span>}
                </div>
              </div>
              <div className="card-actions">
                <button className="btn-secondary btn-sm" onClick={() => openEdit(item)}>✏️ Edit</button>
                <button className="btn-secondary btn-sm" onClick={() => handleDuplicate(item.id)}>📋 Copy</button>
                <button className="btn-secondary btn-sm" title="Create client review link" onClick={async () => {
                  const res = await api.createReviewSession(token, { portfolio_id: item.id, client_name: '' });
                  if (res.token) {
                    const link = `${window.location.origin}/portfolio?review=${res.token}`;
                    navigator.clipboard.writeText(link);
                    alert(`✅ Review link copied!\n\n${link}\n\nExpires in 30 days.`);
                  }
                }}>🔗 Review</button>
                <button className="btn-danger btn-sm" onClick={() => handleDelete(item.id)}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== CATEGORIES MANAGER ====================

function CategoriesManager({ categories, portfolio = [], token, onUpdate }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [dragIdx, setDragIdx] = useState(null);
  const [list, setList] = useState(categories);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editThumb, setEditThumb] = useState('');
  const [editCoverId, setEditCoverId] = useState('');
  const [saved, setSaved] = useState(null);
  const [addMsg, setAddMsg] = useState('');
  const [adding, setAdding] = useState(false);
  const [orderMsg, setOrderMsg] = useState('');

  useEffect(() => setList(categories), [categories]);

  const categoryItems = (catId) => portfolio
    .filter(item => item.category_id === catId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.title).localeCompare(String(b.title)));

  const coverItemFor = (cat) => portfolio.find(item => item.id === Number(parseCategoryMeta(cat).cover_portfolio_id));

  const persistOrder = async (nextList) => {
    setList(nextList);
    setOrderMsg('Saving order…');
    const res = await api.reorderCategories(token, nextList.map(c => c.id));
    let saved = res?.ok === true;
    if (!res?.ok) {
      const fallback = await Promise.all(nextList.map((cat, index) => {
        const meta = parseCategoryMeta(cat);
        return api.updateCategory(token, cat.id, buildCategoryPayload({
          name: cat.name,
          slug: cat.slug,
          description: meta.description,
          thumbnail_url: meta.thumbnail_url,
          cover_portfolio_id: meta.cover_portfolio_id,
          order: index,
        }));
      }));
      saved = fallback.every(item => item?.id);
    }
    if (saved) {
      setOrderMsg('✅ Category order saved');
      setTimeout(() => setOrderMsg(''), 2200);
    } else {
      setOrderMsg(`❌ ${res?.detail || 'Could not save order'}`);
    }
    onUpdate();
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) { setAddMsg('❌ Both name and slug are required'); return; }
    setAdding(true); setAddMsg('');
    try {
      const res = await api.createCategory(token, buildCategoryPayload({ name: name.trim(), slug: slug.trim(), order: list.length }));
      if (res.id) {
        setAddMsg('✅ Category added!');
        setName(''); setSlug('');
        setTimeout(() => setAddMsg(''), 3000);
        onUpdate();
      } else {
        setAddMsg(`❌ ${res.detail || 'Failed to add — slug may already exist'}`);
      }
    } catch (err) {
      setAddMsg(`❌ ${err.message}`);
    } finally { setAdding(false); }
  };

  const startEdit = (cat) => {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditSlug(cat.slug);
    const meta = parseCategoryMeta(cat);
    setEditDescription(meta.description || '');
    setEditThumb(meta.thumbnail_url || '');
    setEditCoverId(meta.cover_portfolio_id ? String(meta.cover_portfolio_id) : '');
  };

  const saveEdit = async (id) => {
    const res = await api.updateCategory(token, id, buildCategoryPayload({
      name: editName.trim(),
      slug: editSlug.trim(),
      description: editDescription.trim() || null,
      thumbnail_url: editThumb.trim() || null,
      cover_portfolio_id: editCoverId ? Number(editCoverId) : null,
      order: parseCategoryMeta(list.find(cat => cat.id === id)).order ?? list.findIndex(cat => cat.id === id),
    }));
    if (res?.id) {
      setSaved(id); setTimeout(() => setSaved(null), 2000);
      setEditId(null); onUpdate();
    } else {
      alert(res?.detail || 'Could not save category');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category? Portfolio items in it will remain but lose their category.')) return;
    await api.deleteCategory(token, id); onUpdate();
  };

  const onDragStart = (i) => setDragIdx(i);
  const onDragOver = (e, i) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const newList = [...list];
    const [moved] = newList.splice(dragIdx, 1);
    newList.splice(i, 0, moved);
    setList(newList); setDragIdx(i);
  };
  const onDragEnd = async () => {
    if (dragIdx === null) return;
    setDragIdx(null);
    await persistOrder(list);
  };

  const moveCategory = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    await persistOrder(next);
  };

  return (
    <div className="manager-section">
      <h2>Portfolio Categories</h2>

      <form className="category-form" onSubmit={handleAdd}>
        <label className="field-label">Category Name</label>
        <input type="text" placeholder="e.g. Work" value={name}
          onChange={e => { setName(e.target.value); setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-')); }} />
        <label className="field-label">Slug (auto-generated)</label>
        <input type="text" placeholder="e.g. work" value={slug}
          onChange={e => setSlug(e.target.value)} />
        {addMsg && <p className={`upload-status ${addMsg.startsWith('✅') ? 'upload-ok' : 'upload-err'}`}>{addMsg}</p>}
        <button type="submit" className="btn-primary" disabled={adding}>{adding ? 'Adding…' : '➕ Add Category'}</button>
      </form>

      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Drag ⠿ or use ↑ ↓ to reorder the public category rail · click ✏️ to rename and choose a cover video.
      </p>
      {orderMsg && <p className={`upload-status ${orderMsg.startsWith('✅') ? 'upload-ok' : orderMsg.startsWith('❌') ? 'upload-err' : ''}`}>{orderMsg}</p>}

      <div className="categories-list">
        {list.map((cat, i) => {
          const items = categoryItems(cat.id);
          const currentCover = coverItemFor(cat);
          const previewItem = editId === cat.id
            ? portfolio.find(item => item.id === Number(editCoverId))
            : currentCover;
          const catMeta = parseCategoryMeta(cat);
          const previewThumb = previewItem ? getThumbnail(previewItem) : catMeta.thumbnail_url;
          return (
          <div key={cat.id} className="category-item draggable"
            draggable={editId !== cat.id} onDragStart={() => onDragStart(i)} onDragOver={e => onDragOver(e, i)} onDragEnd={onDragEnd}>
            <span className="drag-handle">⠿</span>

            {editId === cat.id ? (
              <div className="cat-edit-inline">
                <input value={editName} onChange={e => { setEditName(e.target.value); setEditSlug(e.target.value.toLowerCase().replace(/\s+/g, '-')); }}
                  placeholder="Name" autoFocus />
                <input value={editSlug} onChange={e => setEditSlug(e.target.value)} placeholder="slug" />
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Description (optional)" rows={2} />
                <label className="field-label">Category cover video</label>
                <select value={editCoverId} onChange={e => setEditCoverId(e.target.value)}>
                  <option value="">Auto-pick from category</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>{item.title}</option>
                  ))}
                </select>
                <input value={editThumb} onChange={e => setEditThumb(e.target.value)} placeholder="Manual cover thumbnail URL (optional fallback)" style={{ fontSize: '0.8rem' }} />
                {previewThumb && (
                  <div className="category-cover-preview">
                    <img src={previewThumb} alt="" />
                    <span>{previewItem ? `Cover: ${previewItem.title}` : 'Manual cover image'}</span>
                  </div>
                )}
                <div className="cat-edit-btns">
                  <button type="button" className="btn-primary btn-sm" onClick={() => saveEdit(cat.id)}>💾 Save</button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                <h3>{cat.name} {saved === cat.id && <span style={{ color: '#86efac', fontSize: '0.8rem' }}>✅ Saved</span>}</h3>
                <p>/{cat.slug}</p>
                <p>{currentCover ? `Cover: ${currentCover.title}` : catMeta.thumbnail_url ? 'Manual cover image' : 'Cover: auto-picked'}</p>
              </div>
            )}

            {editId !== cat.id && (
              <div className="card-actions">
                <button type="button" className="btn-secondary btn-sm" onClick={() => moveCategory(i, -1)} disabled={i === 0}>↑</button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => moveCategory(i, 1)} disabled={i === list.length - 1}>↓</button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => startEdit(cat)}>✏️ Edit</button>
                <button type="button" className="btn-danger btn-sm" onClick={() => handleDelete(cat.id)}>🗑</button>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== TESTIMONIALS MANAGER ====================

const EMPTY_T = { name: '', role: '', text: '', rating: 5, photo_url: '' };

function TestimonialsManager({ token }) {
  const [list, setList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_T);
  const [editId, setEditId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadFilename, setUploadFilename] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');

  useEffect(() => {
    api.getAllTestimonials(token)
      .then(data => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]));
  }, [token]);

  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true); setUploadFilename(file.name); setUploadProgress(0); setUploadStatus('');
    try {
      const res = await api.uploadFile(token, file, p => setUploadProgress(p));
      if (res.url) { setForm(prev => ({ ...prev, photo_url: res.url })); setUploadProgress(100); setUploadStatus('done'); }
      else setUploadStatus('error');
    } catch { setUploadStatus('error'); } finally { setUploading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editId) await api.updateTestimonial(token, editId, form);
    else await api.createTestimonial(token, form);
    setShowForm(false); setEditId(null); setForm(EMPTY_T);
    api.getAllTestimonials(token).then(setList);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete?')) return;
    await api.deleteTestimonial(token, id);
    api.getAllTestimonials(token).then(setList);
  };

  const reviewShareUrl = `${window.location.origin}/?leave-review=1`;
  const showQrPageUrl = `${window.location.origin}/?qr=review`;
  const [showShareQR, setShowShareQR] = useState(false);
  const [copyTip, setCopyTip] = useState('');
  const copyShareLink = async () => {
    try { await navigator.clipboard.writeText(reviewShareUrl); setCopyTip('✅ Copied!'); setTimeout(() => setCopyTip(''), 1800); }
    catch { setCopyTip('Press Cmd+C to copy'); }
  };

  return (
    <div className="manager-section">
      <div className="section-header">
        <h2>Client Testimonials ({list.length})</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {!showForm && <button className="btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_T); }}>➕ Add Review</button>}
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ color: 'var(--color-peach)', fontSize: '0.95rem', marginBottom: '0.3rem' }}>📨 Share review link with clients</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>Send this link or QR to past clients — opens directly to the testimonial form.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn-secondary btn-sm" onClick={copyShareLink}>{copyTip || '🔗 Copy Link'}</button>
            <button className="btn-secondary btn-sm" onClick={() => setShowShareQR(true)}>📱 Show QR</button>
            <a href="/?qr=review" target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm" style={{ textDecoration: 'none', display: 'inline-block' }}>📲 Mobile View</a>
          </div>
        </div>
        <code style={{ display: 'block', marginTop: '0.6rem', background: 'rgba(0,0,0,0.35)', padding: '0.5rem 0.75rem', borderRadius: 4, fontSize: '0.78rem', color: 'var(--color-light)', wordBreak: 'break-all' }}>{reviewShareUrl}</code>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>💡 <strong>Mobile View</strong> opens a fullscreen QR — bookmark on your phone home screen to show clients after every shoot.</p>
      </div>

      {showShareQR && <QRModal url={reviewShareUrl} title="Leave a Review" onClose={() => setShowShareQR(false)} />}

      {showForm && (
        <form className="portfolio-form" onSubmit={handleSubmit}>
          <label className="field-label">Client Name *</label>
          <input type="text" placeholder="e.g. Ahmed Al Mansoori" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <label className="field-label">Role / Company</label>
          <input type="text" placeholder="e.g. CEO, Dubai Properties" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
          <label className="field-label">Review *</label>
          <textarea placeholder="What they said about your work…" value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} required />
          <label className="field-label">Rating</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button" onClick={() => setForm({ ...form, rating: n })}
                style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: n <= form.rating ? '#fbbf24' : '#444', transition: 'color 0.15s' }}>★</button>
            ))}
          </div>
          <label className="field-label">Client Photo (optional)</label>
          <div className="upload-area">
            <label className="upload-label">
              <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} />
              <span>Choose photo…</span>
            </label>
            {form.photo_url && <div className="thumb-preview" style={{ maxWidth: '80px' }}><img src={resolveUrl(form.photo_url)} alt="preview" /></div>}
          </div>
          <UploadProgress progress={uploadProgress} filename={uploadFilename} done={uploadStatus === 'done'} error={uploadStatus === 'error'} />
          <div className="form-buttons">
            <button type="submit" className="btn-primary">💾 Save</button>
            <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setForm(EMPTY_T); }}>Cancel</button>
          </div>
        </form>
      )}
      {list.filter(t => !t.approved).length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#fca5a5', marginBottom: '0.75rem', fontSize: '1rem' }}>⏳ Pending Approval ({list.filter(t => !t.approved).length})</h3>
          <div className="portfolio-list">
            {list.filter(t => !t.approved).map(t => (
              <div key={t.id} className="portfolio-item-card" style={{ borderColor: 'rgba(252,165,165,0.3)' }}>
                <div className="card-body-admin">
                  <div style={{ color: '#FFD700' }}>{'★'.repeat(t.rating)}</div>
                  <h3>{t.name}{t.role && <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}> — {t.role}</span>}</h3>
                  <p>"{t.text}"</p>
                </div>
                <div className="card-actions">
                  <button className="btn-primary btn-sm" onClick={async () => { await api.approveTestimonial(token, t.id); api.getAllTestimonials(token).then(setList); }}>✅ Approve</button>
                  <button className="btn-danger btn-sm" onClick={() => handleDelete(t.id)}>🗑 Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 style={{ color: 'var(--color-peach)', marginBottom: '0.75rem', fontSize: '1rem' }}>✅ Approved ({list.filter(t => t.approved).length})</h3>
      {list.filter(t => t.approved).length === 0 && list.filter(t => !t.approved).length === 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 8, padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>No testimonials yet</p>
          <p style={{ fontSize: '0.85rem' }}>Share the review link above with clients, or click "Add Review" to add one manually.</p>
        </div>
      )}
      <div className="portfolio-list">
        {list.filter(t => t.approved).map(t => (
          <div key={t.id} className="portfolio-item-card">
            <div className="card-body-admin">
              <div style={{ color: '#FFD700', fontSize: '1.1rem', marginBottom: '0.4rem' }}>{'★'.repeat(t.rating)}</div>
              <h3>{t.name}{t.role && <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}> — {t.role}</span>}</h3>
              <p>"{t.text}"</p>
              <div style={{ marginTop: '0.4rem' }}>
                <span className={`type-badge`} style={{ background: t.active ? 'rgba(34,197,94,0.15)' : 'rgba(252,165,165,0.15)', color: t.active ? '#86efac' : '#fca5a5' }}>
                  {t.active ? '👁 Visible' : '🙈 Hidden'}
                </span>
              </div>
            </div>
            <div className="card-actions">
              <button className="btn-secondary btn-sm" onClick={async () => { await api.toggleTestimonialActive(token, t.id); api.getAllTestimonials(token).then(setList); }}>
                {t.active ? '🙈 Hide' : '👁 Show'}
              </button>
              <button className="btn-secondary btn-sm" onClick={() => { setForm({ name: t.name, role: t.role || '', text: t.text, rating: t.rating, photo_url: t.photo_url || '' }); setEditId(t.id); setShowForm(true); }}>✏️</button>
              <button className="btn-danger btn-sm" onClick={() => handleDelete(t.id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== CLIENT LOGOS MANAGER ====================

const EMPTY_LOGO = { name: '', image_url: '', link_url: '', order: 0, active: true };

function ClientLogosManager({ token }) {
  const [list, setList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_LOGO);
  const [editId, setEditId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadFilename, setUploadFilename] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');

  const reload = useCallback(() => api.getAllClientLogos(token).then(d => setList(Array.isArray(d) ? d : [])).catch(() => {}), [token]);
  useEffect(() => { reload(); }, [reload]);

  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true); setUploadFilename(file.name); setUploadProgress(0); setUploadStatus('');
    try {
      const res = await api.uploadFile(token, file, p => setUploadProgress(p));
      if (res.url) { setForm(prev => ({ ...prev, image_url: res.url })); setUploadProgress(100); setUploadStatus('done'); }
      else setUploadStatus('error');
    } catch { setUploadStatus('error'); } finally { setUploading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.image_url || !form.name) return;
    if (editId) await api.updateClientLogo(token, editId, form);
    else await api.createClientLogo(token, { ...form, order: list.length });
    setShowForm(false); setEditId(null); setForm(EMPTY_LOGO); setUploadStatus('');
    reload();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this logo?')) return;
    await api.deleteClientLogo(token, id); reload();
  };

  const toggleActive = async (logo) => {
    await api.updateClientLogo(token, logo.id, { ...logo, active: !logo.active }); reload();
  };

  const openEdit = (logo) => {
    setEditId(logo.id); setForm({ name: logo.name, image_url: logo.image_url, link_url: logo.link_url || '', order: logo.order, active: logo.active });
    setShowForm(true); setUploadStatus('');
  };

  return (
    <div className="manager-section">
      <div className="section-header">
        <h2>Client Logos ({list.length})</h2>
        {!showForm && <button className="btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_LOGO); }}>➕ Add Logo</button>}
      </div>

      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Logos appear in a scrolling strip under the hero. Use transparent PNG or SVG for best look. They display grayscale and turn full-color on hover.
      </p>

      {showForm && (
        <form className="portfolio-form" onSubmit={handleSubmit}>
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--color-peach)' }}>{editId ? '✏️ Edit Logo' : '➕ New Logo'}</h3>

          <label className="field-label">Brand Name *</label>
          <input type="text" placeholder="e.g. Emaar" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />

          <label className="field-label">Logo Image * <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', fontWeight: 400 }}>— transparent PNG or SVG works best</span></label>
          <div className="upload-area">
            <label className="upload-label">
              <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" onChange={handleUpload} disabled={uploading} />
              <span>{uploading ? `Uploading… ${uploadProgress || 0}%` : '📤 Upload Logo'}</span>
            </label>
            {form.image_url && <div className="thumb-preview" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.75rem', display: 'inline-block', marginLeft: '0.75rem' }}><img src={resolveUrl(form.image_url)} alt="preview" style={{ maxHeight: 50 }} /></div>}
          </div>
          <UploadProgress progress={uploadProgress} filename={uploadFilename} done={uploadStatus === 'done'} error={uploadStatus === 'error'} />

          <label className="field-label">Brand Website (optional)</label>
          <input type="url" placeholder="https://emaar.com" value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })} />

          <label className="featured-label">
            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
            <span>Active (visible on site)</span>
          </label>

          <div className="form-buttons">
            <button type="submit" className="btn-primary" disabled={!form.name || !form.image_url}>💾 {editId ? 'Update' : 'Add'}</button>
            <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_LOGO); }}>Cancel</button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No logos yet. Add the first one to build your "Trusted by" strip.</p>
      ) : (
        <div className="portfolio-list">
          {list.map(logo => (
            <div key={logo.id} className="portfolio-item-card" style={{ opacity: logo.active ? 1 : 0.5 }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.25rem', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
                <img src={resolveUrl(logo.image_url)} alt={logo.name} style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }} />
              </div>
              <div className="card-body-admin">
                <h3>{logo.name}</h3>
                {logo.link_url && <p style={{ fontSize: '0.78rem' }}>🔗 {logo.link_url}</p>}
              </div>
              <div className="card-actions">
                <button className="btn-secondary btn-sm" onClick={() => openEdit(logo)}>✏️ Edit</button>
                <button className="btn-secondary btn-sm" onClick={() => toggleActive(logo)}>{logo.active ? '👁 Hide' : '👁 Show'}</button>
                <button className="btn-danger btn-sm" onClick={() => handleDelete(logo.id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== DELIVERIES MANAGER ====================

const EMPTY_DELIVERY = { client_name: '', project_title: '', message: '', files: [], password: '', expires_days: 30 };

function DeliveriesManager({ token }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_DELIVERY);
  const [savedLink, setSavedLink] = useState(null);

  const load = () => api.listDeliveries(token).then(d => setList(Array.isArray(d) ? d : [])).catch(() => setList([])).finally(() => setLoading(false));
  useEffect(() => { load(); }, [token]); // eslint-disable-line

  const set = patch => setForm(prev => ({ ...prev, ...patch }));
  const cancel = () => { setShowForm(false); setEditId(null); setForm(EMPTY_DELIVERY); setSavedLink(null); };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.client_name || !form.project_title || form.files.length === 0) return;
    if (editId) {
      await api.updateDelivery(token, editId, form);
      cancel(); load();
    } else {
      const res = await api.createDelivery(token, form);
      if (res.token) {
        const url = `${window.location.origin}/portfolio?delivery=${res.token}`;
        navigator.clipboard.writeText(url);
        setSavedLink(url);
        load();
      }
    }
  };

  const openEdit = (d) => {
    setEditId(d.id);
    setForm({ client_name: d.client_name, project_title: d.project_title, message: d.message || '',
              files: d.files || [], password: '', expires_days: 30 });
    setShowForm(true); setSavedLink(null);
  };

  const remove = async (id) => { if (!window.confirm('Delete this delivery? Client links will stop working.')) return; await api.deleteDelivery(token, id); load(); };
  const copyLink = (t) => { const url = `${window.location.origin}/portfolio?delivery=${t}`; navigator.clipboard.writeText(url); alert(`✅ Copied:\n${url}`); };

  return (
    <div>
      <div className="manager-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>📦 Client Deliveries</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
              Send original files to clients via Google Drive, Dropbox, WeTransfer or any direct link. No size limit, optional password & expiry.
            </p>
          </div>
          {!showForm && <button className="btn-primary" onClick={() => { setShowForm(true); setForm(EMPTY_DELIVERY); setEditId(null); setSavedLink(null); }}>➕ New Delivery</button>}
        </div>

        {savedLink && (
          <div style={{ background: 'rgba(134,239,172,0.1)', border: '1px solid #86efac', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ color: '#86efac', fontWeight: 700, marginBottom: '0.5rem' }}>✅ Delivery created — link copied!</p>
            <code style={{ display: 'block', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: 4, fontSize: '0.8rem', wordBreak: 'break-all', color: 'var(--color-light)' }}>{savedLink}</code>
            <button className="btn-secondary btn-sm" style={{ marginTop: '0.6rem' }} onClick={cancel}>Done</button>
          </div>
        )}

        {showForm && !savedLink && (
          <form className="portfolio-form" onSubmit={submit}>
            <h3 style={{ color: 'var(--color-peach)', marginBottom: '1rem' }}>{editId ? '✏️ Edit Delivery' : '📦 New Delivery'}</h3>
            <label className="field-label">Client Name *</label>
            <input value={form.client_name} onChange={e => set({ client_name: e.target.value })} placeholder="e.g. Forsan Mall" required />
            <label className="field-label">Project Title *</label>
            <input value={form.project_title} onChange={e => set({ project_title: e.target.value })} placeholder="e.g. Spring Sale Campaign 2026" required />
            <label className="field-label">Message to Client (optional)</label>
            <textarea value={form.message} onChange={e => set({ message: e.target.value })} placeholder="A note shown on the delivery page…" />

            <label className="field-label">Files * <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', fontWeight: 400 }}>— paste direct links from Google Drive (use "Anyone with link"), Dropbox, WeTransfer, etc.</span></label>
            {form.files.map((f, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 80px auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input value={f.name} onChange={e => { const nf = [...form.files]; nf[i] = { ...nf[i], name: e.target.value }; set({ files: nf }); }} placeholder="File name (e.g. Final Cut.mp4)" />
                <input value={f.url} onChange={e => { const nf = [...form.files]; nf[i] = { ...nf[i], url: e.target.value }; set({ files: nf }); }} placeholder="https://drive.google.com/..." type="url" />
                <input value={f.size_mb || ''} onChange={e => { const nf = [...form.files]; nf[i] = { ...nf[i], size_mb: parseFloat(e.target.value) || null }; set({ files: nf }); }} placeholder="MB" type="number" min="0" step="0.1" />
                <button type="button" className="btn-danger btn-sm" onClick={() => set({ files: form.files.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button type="button" className="btn-secondary btn-sm" onClick={() => set({ files: [...form.files, { name: '', url: '', size_mb: null }] })} style={{ marginBottom: '1rem' }}>➕ Add File</button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="field-label">Password (optional)</label>
                <input value={form.password} onChange={e => set({ password: e.target.value })} placeholder="Leave blank for no password" />
              </div>
              <div>
                <label className="field-label">Expires in (days)</label>
                <input type="number" value={form.expires_days} onChange={e => set({ expires_days: parseInt(e.target.value) || 0 })} min="0" placeholder="0 = never" />
              </div>
            </div>

            <div className="form-buttons">
              <button type="submit" className="btn-primary">{editId ? 'Save Changes' : '🔗 Create & Copy Link'}</button>
              <button type="button" className="btn-secondary" onClick={cancel}>Cancel</button>
            </div>
          </form>
        )}

        {loading ? <p>Loading…</p> : list.length === 0 ? <p style={{ color: 'var(--color-text-muted)' }}>No deliveries yet. Create one to share files with a client.</p> : (
          <div className="portfolio-list" style={{ marginTop: '1rem' }}>
            {list.map(d => {
              const expired = d.expires_at && new Date(d.expires_at) < new Date();
              return (
                <div key={d.id} className="portfolio-item-card" style={{ opacity: expired ? 0.55 : 1 }}>
                  <div>
                    <h3 style={{ color: 'var(--color-peach)', marginBottom: '0.3rem' }}>{d.project_title}</h3>
                    <p style={{ color: 'var(--color-light)', fontSize: '0.85rem' }}>👤 {d.client_name}</p>
                    <div className="card-tags" style={{ marginTop: '0.5rem' }}>
                      <span className="type-badge">📁 {d.files.length} file{d.files.length !== 1 ? 's' : ''}</span>
                      <span className="type-badge">⬇ {d.download_count} download{d.download_count !== 1 ? 's' : ''}</span>
                      {d.has_password && <span className="type-badge">🔒 Locked</span>}
                      {expired && <span className="type-badge" style={{ background: 'rgba(252,165,165,0.15)', color: '#fca5a5' }}>Expired</span>}
                      {d.expires_at && !expired && <span className="type-badge">Expires {new Date(d.expires_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="card-actions">
                    <button className="btn-secondary btn-sm" onClick={() => copyLink(d.token)}>🔗 Copy Link</button>
                    <button className="btn-secondary btn-sm" onClick={() => openEdit(d)}>✏️ Edit</button>
                    <button className="btn-danger btn-sm" onClick={() => remove(d.id)}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== ANALYTICS DASHBOARD ====================

function AnalyticsDashboard({ token }) {
  const [data, setData] = useState(null);
  const [sources, setSources] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      api.getAnalytics(token).catch(() => null),
      api.getInquirySources(token).catch(() => null),
    ]).then(([a, s]) => { setData(a); setSources(s); }).finally(() => setLoading(false));
  }, [token]);
  if (loading) return <div className="manager-section"><p>Loading analytics…</p></div>;
  if (!data || typeof data !== 'object') return <div className="manager-section"><p style={{ color: '#fca5a5' }}>Could not load analytics.</p></div>;
  const byDay = Array.isArray(data.by_day) ? data.by_day : [];
  const byCountry = Array.isArray(data.by_country) ? data.by_country : [];
  const total = typeof data.total === 'number' ? data.total : 0;
  const maxDay = Math.max(...(byDay.map(d => d.count)), 1);
  return (
    <div>
      <div className="analytics-cards">
        <div className="analytics-card"><div className="analytics-number">{total.toLocaleString()}</div><div className="analytics-label">Total Visits</div></div>
        <div className="analytics-card"><div className="analytics-number">{byDay.length > 0 ? byDay[byDay.length - 1].count : 0}</div><div className="analytics-label">Today</div></div>
        <div className="analytics-card"><div className="analytics-number">{byCountry.length}</div><div className="analytics-label">Countries</div></div>
      </div>
      <div className="manager-section">
        <h2>Visits — Last 30 Days</h2>
        <div className="bar-chart">
          {byDay.map(d => (
            <div key={d.date} className="bar-col">
              <div className="bar-tooltip">{d.count}</div>
              <div className="bar-fill" style={{ height: `${Math.round((d.count / maxDay) * 100)}%` }} />
              <div className="bar-label">{d.date.slice(5)}</div>
            </div>
          ))}
          {byDay.length === 0 && <p className="state-text">No data yet</p>}
        </div>
      </div>
      <div className="analytics-two-col">
        <div className="manager-section">
          <h2>Top Countries</h2>
          <div className="country-list">
            {byCountry.map(c => (
              <div key={c.country} className="country-row">
                <span className="country-name">{c.country}</span>
                <span className="country-count">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="manager-section">
          <h2>Recent Visitors</h2>
          <div className="visits-table">
            {(Array.isArray(data.recent) ? data.recent : []).map(v => (
              <div key={v.id} className="visit-row">
                <div className="visit-time">{v.timestamp}</div>
                <div className="visit-location">{v.city}, {v.country}</div>
                <div className="visit-ua">{v.ua}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {sources && ((Array.isArray(sources.contact_sources) && sources.contact_sources.length > 0) || (Array.isArray(sources.utm_sources) && sources.utm_sources.length > 0)) && (
        <div className="analytics-two-col">
          {Array.isArray(sources.contact_sources) && sources.contact_sources.length > 0 && (
            <div className="manager-section">
              <h2>📬 Inquiry Sources</h2>
              <div className="country-list">
                {sources.contact_sources.sort((a,b) => b.count - a.count).map(s => (
                  <div key={s.source} className="country-row">
                    <span className="country-name">{s.source || 'Not specified'}</span>
                    <span className="country-count">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Array.isArray(sources.utm_sources) && sources.utm_sources.length > 0 && (
            <div className="manager-section">
              <h2>🔗 Link Sources (UTM)</h2>
              <div className="country-list">
                {sources.utm_sources.sort((a,b) => b.count - a.count).map(s => (
                  <div key={s.source} className="country-row">
                    <span className="country-name">{s.source}</span>
                    <span className="country-count">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== SETTINGS MANAGER ====================

function SettingsManager({ settings, token, onUpdate, portfolio }) {
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [autoSaveMsg, setAutoSaveMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadFilename, setUploadFilename] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const autoSaveTimer = useRef(null);

  const applyTheme = useCallback((f) => {
    const root = document.documentElement;
    if (f.color_primary)    root.style.setProperty('--color-peach',  f.color_primary);
    if (f.color_background) root.style.setProperty('--color-dark',   f.color_background);
    if (f.color_surface)    root.style.setProperty('--color-maroon', f.color_surface);
    if (f.color_text)       root.style.setProperty('--color-light',  f.color_text);
  }, []);

  const handleChange = useCallback((patch) => {
    setForm(prev => {
      const next = { ...prev, ...patch };
      // Apply theme colors instantly if any color field changed
      const colorKeys = ['color_primary','color_background','color_surface','color_text'];
      if (colorKeys.some(k => k in patch)) applyTheme(next);
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(async () => {
        try {
          await api.updateSettings(token, next);
          setAutoSaveMsg('✅ Saved'); setTimeout(() => setAutoSaveMsg(''), 2000);
          onUpdate();
        } catch { setAutoSaveMsg('⚠️ Save failed'); }
      }, 800);
      return next;
    });
  }, [token, applyTheme, onUpdate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await api.updateSettings(token, form);
    setSaved(true); setTimeout(() => setSaved(false), 3000); onUpdate();
  };

  const handleImgUpload = async (e, field) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true); setUploadFilename(file.name); setUploadProgress(0); setUploadStatus('');
    try {
      const res = await api.uploadFile(token, file, p => setUploadProgress(p));
      if (res.url) { handleChange({ [field]: res.url }); setUploadProgress(100); setUploadStatus('done'); }
      else setUploadStatus('error');
    } catch { setUploadStatus('error'); } finally { setUploading(false); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) { setPwMsg('❌ Passwords do not match'); return; }
    const res = await api.changePassword(token, { current_password: pwForm.current_password, new_password: pwForm.new_password });
    if (res.ok) { setPwMsg('✅ Password changed!'); setPwForm({ current_password: '', new_password: '', confirm: '' }); }
    else setPwMsg(`❌ ${res.detail || 'Failed'}`);
  };

  const handleExport = async () => {
    const data = await api.exportData(token);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `lensmania-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const field = (label, name, type = 'text') => (
    <div className="form-group">
      <label>{label}</label>
      <input type={type} name={name} value={form[name] || ''} onChange={e => handleChange({ [name]: e.target.value })} />
    </div>
  );

  const imgUpload = (label, fieldName) => (
    <div className="form-group">
      <label>{label}</label>
      <div className="upload-area">
        <label className="upload-label">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => handleImgUpload(e, fieldName)} disabled={uploading} />
          <span>Choose photo…</span>
        </label>
        {form[fieldName] && <div className="thumb-preview" style={{ maxWidth: '100%', marginTop: '0.75rem' }}><img src={resolveUrl(form[fieldName])} alt="" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '4px' }} /></div>}
      </div>
    </div>
  );

  return (
    <div className="manager-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Site Settings</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{autoSaveMsg}</span>
      </div>
      {saved && <div className="success-message">✅ Settings saved!</div>}
      <UploadProgress progress={uploadProgress} filename={uploadFilename} done={uploadStatus === 'done'} error={uploadStatus === 'error'} />
      <form className="settings-form" onSubmit={handleSubmit}>

        <h3 className="settings-group-title">📅 Availability</h3>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.available_for_booking !== false} onChange={e => handleChange({ available_for_booking: e.target.checked })} style={{ width: 'auto', accentColor: 'var(--color-peach)' }} />
            🟢 Available for bookings
          </label>
        </div>
        {field('Availability message (optional)', 'availability_text')}

        <h3 className="settings-group-title">🖼 Appearance</h3>
        {imgUpload('Hero Background Photo', 'hero_image')}
        {field('Showreel Video URL (plays as hero background)', 'showreel_url', 'url')}
        <div className="form-group">
          <label>Reel of the Month</label>
          <select value={form.reel_of_month_id || ''} onChange={e => handleChange({ reel_of_month_id: e.target.value ? parseInt(e.target.value) : null })}>
            <option value="">— None —</option>
            {portfolio.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.maintenance_mode || false} onChange={e => handleChange({ maintenance_mode: e.target.checked })} style={{ width: 'auto', accent: 'var(--color-peach)' }} />
            🔧 Maintenance Mode (hides public site)
          </label>
        </div>

        <h3 className="settings-group-title">🔗 Social Sharing</h3>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', marginBottom: '1rem' }}>
          Image shown when the <strong>main site link</strong> is shared on WhatsApp/Facebook/X. Recommended 1200×630. Leave blank to use the default card. Per-video and review-link share cards are unaffected.
        </p>
        {imgUpload('Main link share image', 'og_image')}

        <h3 className="settings-group-title">🎨 Theme Colors</h3>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', marginBottom: '1rem' }}>Customize site colors. Leave blank to use defaults.</p>
        <div className="theme-color-grid">
          {[
            ['color_primary',    'Accent / Buttons',   '#d4b896'],
            ['color_background', 'Page Background',    '#080808'],
            ['color_surface',    'Card / Section BG',  '#111111'],
            ['color_text',       'Heading Text',       '#f0f0f0'],
          ].map(([key, label, def]) => (
            <div key={key} className="theme-color-item">
              <label>{label}</label>
              <div className="theme-color-row">
                <input type="color" value={form[key] || def} onChange={e => handleChange({ [key]: e.target.value })} className="color-swatch-input" />
                <input type="text" value={form[key] || ''} placeholder={def} onChange={e => handleChange({ [key]: e.target.value })} className="color-hex-input" maxLength={7} />
                {form[key] && <button type="button" onClick={() => handleChange({ [key]: '' })} className="color-reset-btn" title="Reset to default">↺</button>}
              </div>
            </div>
          ))}
        </div>

        <h3 className="settings-group-title">👤 About</h3>
        {imgUpload('About Photo', 'about_image')}
        <div className="form-group">
          <label>About Text (English)</label>
          <textarea value={form.about_text || ''} onChange={e => handleChange({ about_text: e.target.value })} style={{ minHeight: '100px' }} />
        </div>
        <div className="form-group">
          <label>About Text (Arabic — اختياري)</label>
          <textarea dir="rtl" value={form.about_text_ar || ''} onChange={e => handleChange({ about_text_ar: e.target.value })} style={{ minHeight: '100px' }} />
        </div>

        <h3 className="settings-group-title">📋 Site Info</h3>
        {field('Site Title (English)', 'site_title')}
        {field('Site Title (Arabic — اختياري)', 'site_title_ar')}
        <div className="form-group">
          <label>Site Description (English)</label>
          <textarea value={form.site_description || ''} onChange={e => handleChange({ site_description: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Site Description (Arabic)</label>
          <textarea dir="rtl" value={form.site_description_ar || ''} onChange={e => handleChange({ site_description_ar: e.target.value })} />
        </div>
        {field('Email', 'email', 'email')}
        {field('Phone', 'phone', 'tel')}
        {field('WhatsApp (e.g. 971501234567)', 'whatsapp', 'tel')}
        {field('Location', 'location')}

        <h3 className="settings-group-title">🔗 Social Links</h3>
        {field('Instagram URL', 'instagram', 'url')}
        {field('YouTube URL', 'youtube', 'url')}
        {field('TikTok URL', 'tiktok', 'url')}
        {field('Snapchat URL', 'snapchat', 'url')}
        {field('LinkedIn URL', 'linkedin', 'url')}

        <h3 className="settings-group-title">📈 Analytics</h3>
        {field('Google Analytics ID (e.g. G-XXXXXXXXXX)', 'ga_tracking_id')}

        <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>💾 Save All Settings</button>
      </form>

      <h3 className="settings-group-title" style={{ marginTop: '2rem' }}>🔐 Change Password</h3>
      {pwMsg && <p className={`upload-status ${pwMsg.startsWith('✅') ? 'upload-ok' : 'upload-err'}`}>{pwMsg}</p>}
      <form onSubmit={handlePasswordChange} className="portfolio-form">
        <label className="field-label">Current Password</label>
        <input type="password" value={pwForm.current_password} onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} required />
        <label className="field-label">New Password</label>
        <input type="password" value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} required />
        <label className="field-label">Confirm New Password</label>
        <input type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} required />
        <button type="submit" className="btn-primary">Change Password</button>
      </form>

      <h3 className="settings-group-title" style={{ marginTop: '2rem' }}>💾 Data Backup</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>Download all your portfolio data as a JSON file.</p>
      <button className="btn-secondary" onClick={handleExport}>⬇️ Export Backup</button>
    </div>
  );
}

// ==================== NOTIFICATION CENTER ====================

const NOTIF_ICONS = { like: '❤️', reaction: '😊', contact: '📩', visit: '👁', interested: '🔥' };

function NotificationCenter({ token, onUnreadChange }) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState(canUseBrowserNotifications() ? Notification.permission : 'unsupported');

  const load = useCallback(() => {
    api.getNotifications(token)
      .then((items) => {
        const list = Array.isArray(items) ? items : [];
        const unread = list.filter(n => !n.read).length;
        setNotifs(list);
        onUnreadChange?.(unread);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, onUnreadChange]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 45000);
    return () => clearInterval(interval);
  }, [load]);

  const enableBrowserAlerts = async () => {
    if (!canUseBrowserNotifications()) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      showAdminBrowserNotification({
        id: 'enabled',
        title: 'Dashboard notifications enabled',
        body: 'New portfolio activity can now alert you while this app is open.',
      });
    }
  };

  const markRead = async () => {
    await api.markAllRead(token); load();
  };

  const remove = async (id) => {
    await api.deleteNotification(token, id);
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  const unread = notifs.filter(n => !n.read).length;

  return (
    <div className="manager-section">
      <div className="section-header">
        <h2>🔔 Notifications {unread > 0 && <span className="notif-badge">{unread}</span>}</h2>
        {unread > 0 && <button className="btn-secondary btn-sm" onClick={markRead}>Mark all read</button>}
      </div>
      <div className="notif-permission-card">
        <div>
          <strong>Browser alerts</strong>
          <p>
            {permission === 'granted' && 'Enabled for this device while the portfolio app or dashboard is open.'}
            {permission === 'default' && 'Enable alerts on this device for new inquiries, reactions, reviews, and hot leads.'}
            {permission === 'denied' && 'Blocked in this browser. Enable notifications from site settings to receive alerts here.'}
            {permission === 'unsupported' && 'Not supported in this browser.'}
          </p>
        </div>
        {permission === 'default' && <button className="btn-primary btn-sm" onClick={enableBrowserAlerts}>Enable alerts</button>}
      </div>
      {loading ? <p>Loading…</p> : notifs.length === 0 ? <p className="state-text">No notifications yet.</p> : (
        <div className="notif-list">
          {notifs.map(n => (
            <div key={n.id} className={`notif-item${n.read ? ' read' : ''}`}>
              <span className="notif-icon">{NOTIF_ICONS[n.type] || '•'}</span>
              <div className="notif-body">
                <div className="notif-title">{n.title}</div>
                {n.body && <div className="notif-desc">{n.body}</div>}
                <div className="notif-time">{new Date(n.created_at).toLocaleString()}</div>
              </div>
              <button className="notif-delete" onClick={() => remove(n.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== PDF EXPORT ====================

async function generatePortfolioPDF(portfolio, settings, selectedIds) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const items = selectedIds.length ? portfolio.filter(p => selectedIds.includes(p.id)) : portfolio;
  const W = 210; const H = 297;
  const peach = [255, 167, 129];
  const dark = [45, 10, 26];

  // Cover page
  doc.setFillColor(...dark);
  doc.rect(0, 0, W, H, 'F');
  doc.setTextColor(...peach);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text(settings?.site_title || 'Portfolio', W / 2, 80, { align: 'center' });
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(settings?.site_description || '', W / 2, 96, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(232, 196, 179);
  if (settings?.email) doc.text(`✉ ${settings.email}`, W / 2, 120, { align: 'center' });
  if (settings?.phone) doc.text(`📞 ${settings.phone}`, W / 2, 130, { align: 'center' });
  if (settings?.whatsapp) {
    doc.setTextColor(37, 211, 102);
    doc.textWithLink(`💬 WhatsApp: wa.me/${settings.whatsapp}`, W / 2, 142, { align: 'center', url: `https://wa.me/${settings.whatsapp}` });
  }
  doc.setTextColor(232, 196, 179);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString(), W / 2, H - 15, { align: 'center' });

  // Items
  for (const item of items) {
    doc.addPage();
    doc.setFillColor(...dark);
    doc.rect(0, 0, W, H, 'F');

    // Thumbnail
    const thumb = getThumbnail(item);
    if (thumb) {
      try {
        const img = await loadImageAsDataUrl(thumb);
        doc.addImage(img, 'JPEG', 0, 0, W, 120);
      } catch {}
    }

    // Overlay
    doc.setFillColor(...dark);
    doc.setGState(new doc.GState({ opacity: 0.5 }));
    doc.rect(0, 0, W, 120, 'F');
    doc.setGState(new doc.GState({ opacity: 1 }));

    // Title
    doc.setTextColor(...peach);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(item.title || '', 15, 140);

    // Description
    if (item.description) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(232, 196, 179);
      const lines = doc.splitTextToSize(item.description, W - 30);
      doc.text(lines.slice(0, 4), 15, 152);
    }

    // Stats
    doc.setFontSize(9);
    doc.setTextColor(...peach);
    doc.text(`👁 ${item.views} views  ❤️ ${item.likes || 0} likes`, 15, 185);

    // Watch link
    if (item.video_url) {
      doc.setTextColor(37, 211, 102);
      doc.textWithLink('▶ Watch Video →', 15, 200, { url: item.video_url });
    }

    // WhatsApp button
    if (settings?.whatsapp) {
      doc.setFillColor(37, 211, 102);
      doc.roundedRect(15, 210, 80, 12, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.textWithLink('💬 Inquire on WhatsApp', 55, 218, { align: 'center', url: `https://wa.me/${settings.whatsapp}?text=I'm interested in "${item.title}"` });
    }
  }

  doc.save(`${(settings?.site_title || 'portfolio').replace(/\s+/g, '-')}-portfolio.pdf`);
}

function loadImageAsDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function PDFExportButton({ portfolio, settings }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [generating, setGenerating] = useState(false);

  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const generate = async () => {
    setGenerating(true);
    try { await generatePortfolioPDF(portfolio, settings, selected); }
    catch (e) { console.error(e); }
    finally { setGenerating(false); setOpen(false); }
  };

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>📄 Export PDF</button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="pdf-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
            <h3>Export Portfolio PDF</h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>Select items to include (or leave all unchecked for full portfolio)</p>
            <div className="pdf-item-list">
              {portfolio.map(item => (
                <label key={item.id} className="pdf-item-check">
                  <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                  {item.title}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn-primary" onClick={generate} disabled={generating}>
                {generating ? 'Generating…' : '⬇️ Generate PDF'}
              </button>
              <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ==================== CLAUDE ADMIN ASSISTANT ====================

function ClaudeAssistant({ token, context }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm Claude, your AI assistant. I can help you write video descriptions, SEO titles, your bio, social captions, content ideas — anything for your portfolio. What do you need?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => { if (open && bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages, open]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const res = await api.aiChat(token, userMsg, context);
      setMessages(prev => [...prev, { role: 'assistant', text: res.response || res.detail || 'Something went wrong.' }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: '❌ Error connecting to AI. Check your ANTHROPIC_API_KEY in Render.' }]);
    } finally { setLoading(false); }
  };

  const copy = (text, i) => {
    navigator.clipboard.writeText(text);
    setCopied(i); setTimeout(() => setCopied(null), 2000);
  };

  const QUICK = [
    'Write a short bio for a Dubai-based videographer',
    'Give me 5 SEO title ideas for a real estate video',
    'Write an Instagram caption for a corporate shoot',
    'Suggest 5 portfolio category names for a videographer',
  ];

  return (
    <>
      <button className={`claude-fab${open ? ' open' : ''}`} onClick={() => setOpen(!open)} title="Claude AI Assistant">
        {open ? '✕' : '✦'}
      </button>

      {open && (
        <div className="claude-panel">
          <div className="claude-header">
            <span>✦ Claude AI Assistant</span>
            <button onClick={() => setMessages([messages[0]])}>Clear</button>
          </div>

          <div className="claude-messages">
            {messages.map((m, i) => (
              <div key={i} className={`claude-msg ${m.role}`}>
                <div className="claude-bubble">{m.text}</div>
                {m.role === 'assistant' && i > 0 && (
                  <button className="claude-copy" onClick={() => copy(m.text, i)}>
                    {copied === i ? '✅' : '📋'}
                  </button>
                )}
              </div>
            ))}
            {loading && (
              <div className="claude-msg assistant">
                <div className="claude-bubble claude-typing"><span /><span /><span /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && (
            <div className="claude-quick">
              {QUICK.map((q, i) => (
                <button key={i} onClick={() => { setInput(q); }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="claude-input-row">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask anything… (Enter to send)"
              rows={2}
              disabled={loading}
            />
            <button className="claude-send" onClick={send} disabled={loading || !input.trim()}>
              {loading ? '…' : '↑'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ==================== MAIN APP ====================

// ==================== REVIEW PORTAL ====================
function ReviewPortal({ reviewToken }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState([]);
  const [author, setAuthor] = useState(() => localStorage.getItem('reviewer_name') || '');
  const [nameSet, setNameSet] = useState(!!localStorage.getItem('reviewer_name'));
  const [commentText, setCommentText] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    api.getReview(reviewToken)
      .then(d => { setData(d); setComments(d.comments || []); })
      .catch(() => setError('Review link not found or expired.'));
  }, [reviewToken]);

  const fmtTime = (s) => {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const c = await api.addReviewComment(reviewToken, commentText.trim(), currentTime, author);
      setComments(prev => [...prev, c].sort((a, b) => a.timestamp_sec - b.timestamp_sec));
      setCommentText('');
    } catch {}
    setSubmitting(false);
  };

  const seekTo = (sec) => { if (videoRef.current) { videoRef.current.currentTime = sec; videoRef.current.play(); } };

  if (error) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0308', color: '#FFA781', fontSize: '1.2rem' }}>{error}</div>;
  if (!data) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0308', color: '#FFA781' }}>Loading review…</div>;

  const { portfolio: item, session } = data;
  const embedUrl = (() => {
    if (item.video_type === 'direct') return null;
    const p = item.video_type || 'youtube';
    if (p === 'youtube') { const m = item.video_url?.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/); return m ? `https://www.youtube.com/embed/${m[1]}?enablejsapi=1` : null; }
    if (p === 'vimeo') { const m = item.video_url?.match(/vimeo\.com\/(\d+)/); return m ? `https://player.vimeo.com/video/${m[1]}` : null; }
    return null;
  })();

  if (!nameSet) return (
    <div style={{ minHeight: '100vh', background: '#0d0308', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1a0812', border: '1px solid rgba(255,167,129,0.2)', borderRadius: 12, padding: '2.5rem', maxWidth: 380, width: '90%', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎬</div>
        <h2 style={{ color: '#FFA781', marginBottom: '0.5rem' }}>Client Review</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>"{item.title}"</p>
        <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Your name" style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(255,167,129,0.08)', border: '1px solid rgba(255,167,129,0.25)', borderRadius: 6, color: '#FFA781', fontSize: '1rem' }} onKeyDown={e => e.key === 'Enter' && author.trim() && (localStorage.setItem('reviewer_name', author), setNameSet(true))} autoFocus />
        <button onClick={() => { if (author.trim()) { localStorage.setItem('reviewer_name', author); setNameSet(true); } }} style={{ width: '100%', padding: '0.75rem', background: '#FFA781', color: '#1a0008', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>Enter Review →</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0d0308', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'rgba(26,0,8,0.95)', borderBottom: '1px solid rgba(255,167,129,0.15)', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.4rem' }}>🎬</span>
          <div>
            <div style={{ color: '#FFA781', fontWeight: 700, fontSize: '0.95rem' }}>{item.title}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>Review by {author} · {comments.length} comment{comments.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        {session.expires_at && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem' }}>Expires {new Date(session.expires_at).toLocaleDateString()}</div>}
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 0, minHeight: 0 }}>
        {/* Video side */}
        <div style={{ background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', gap: '1rem', position: 'relative' }}>
          <div style={{ width: '100%', maxWidth: 860, position: 'relative', paddingTop: item.aspect_ratio === '9:16' ? '56.25%' : '56.25%' }}>
            {item.video_type === 'direct' && item.video_url
              ? <video ref={videoRef} src={resolveUrl(item.video_url, 'video')} controls style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} onTimeUpdate={e => setCurrentTime(e.target.currentTime)} />
              : embedUrl ? <iframe title={`${item.title} review video`} src={embedUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen />
              : item.thumbnail_url ? <img src={resolveUrl(item.thumbnail_url)} alt={item.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
          </div>
          {/* Timestamp markers */}
          {comments.length > 0 && item.video_type === 'direct' && (
            <div style={{ width: '100%', maxWidth: 860 }}>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.4rem' }}>Click a marker to jump to that moment:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {comments.map(c => (
                  <button key={c.id} onClick={() => seekTo(c.timestamp_sec)} style={{ padding: '0.2rem 0.6rem', background: c.resolved ? 'rgba(134,239,172,0.15)' : 'rgba(255,167,129,0.15)', border: `1px solid ${c.resolved ? '#86efac' : '#FFA781'}`, borderRadius: 999, color: c.resolved ? '#86efac' : '#FFA781', fontSize: '0.72rem', cursor: 'pointer' }}>
                    ⏱ {fmtTime(c.timestamp_sec)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Comments side */}
        <div style={{ background: '#12030a', borderLeft: '1px solid rgba(255,167,129,0.12)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 57px)' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,167,129,0.1)' }}>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem' }}>
              {item.video_type === 'direct' ? `Comment at: ${fmtTime(currentTime)}` : 'Leave a comment'}
            </div>
            <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Type your feedback…" rows={3} style={{ width: '100%', background: 'rgba(255,167,129,0.06)', border: '1px solid rgba(255,167,129,0.2)', borderRadius: 6, color: '#F5E6D3', padding: '0.6rem', fontSize: '0.85rem', resize: 'none', marginBottom: '0.5rem' }} onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) submitComment(); }} />
            <button onClick={submitComment} disabled={submitting || !commentText.trim()} style={{ width: '100%', padding: '0.6rem', background: '#FFA781', color: '#1a0008', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Sending…' : `💬 Add Comment${item.video_type === 'direct' ? ` at ${fmtTime(currentTime)}` : ''}`}
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
            {comments.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', textAlign: 'center', marginTop: '2rem' }}>No comments yet. Watch the video and share your thoughts!</p>}
            {comments.map(c => (
              <div key={c.id} style={{ background: c.resolved ? 'rgba(134,239,172,0.05)' : 'rgba(255,167,129,0.05)', border: `1px solid ${c.resolved ? 'rgba(134,239,172,0.15)' : 'rgba(255,167,129,0.12)'}`, borderRadius: 8, padding: '0.75rem', marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#FFA781', fontSize: '0.75rem', fontWeight: 600 }}>{c.author}</span>
                  <button onClick={() => seekTo(c.timestamp_sec)} style={{ color: 'rgba(255,167,129,0.6)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem' }}>⏱ {fmtTime(c.timestamp_sec)}</button>
                </div>
                <p style={{ color: '#F5E6D3', fontSize: '0.85rem', lineHeight: 1.5 }}>{c.text}</p>
                {c.resolved && <span style={{ color: '#86efac', fontSize: '0.7rem' }}>✅ Resolved</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== DELIVERY PAGE (CLIENT) ====================
function DeliveryPage({ deliveryToken }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async (pwd) => {
    setSubmitting(true); setError(null);
    try {
      const r = await fetch(`${API_URL}/delivery/${deliveryToken}/access`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ password: pwd || '' })
      });
      if (r.status === 404) { setError('Delivery not found.'); setSubmitting(false); return; }
      if (r.status === 410) { setError('This delivery link has expired.'); setSubmitting(false); return; }
      const d = await r.json();
      setData(d);
    } catch { setError('Could not load delivery.'); }
    setSubmitting(false);
  };

  useEffect(() => { load(''); }, [deliveryToken]); // eslint-disable-line

  if (error) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#080808', color:'#d4b896', fontSize:'1.2rem', padding:'2rem', textAlign:'center' }}>{error}</div>;
  if (!data) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#080808', color:'#d4b896' }}>Loading…</div>;

  if (data.locked) return (
    <div style={{ minHeight:'100vh', background:'#080808', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
      <div style={{ background:'#111', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'2.5rem', maxWidth:420, width:'100%', textAlign:'center' }}>
        <img src={BRAND_LOGO_WHITE_SRC} alt="" style={{ height:60, marginBottom:'1rem' }} />
        <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>🔒</div>
        <h2 style={{ color:'#d4b896', marginBottom:'0.4rem' }}>Password Protected</h2>
        <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.85rem', marginBottom:'1.4rem' }}>
          {data.client_name} — {data.project_title}
        </p>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" autoFocus
          onKeyDown={e => e.key === 'Enter' && load(password)}
          style={{ width:'100%', padding:'0.75rem', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, color:'#fff', fontSize:'1rem', marginBottom:'1rem' }} />
        <button onClick={() => load(password)} disabled={submitting}
          style={{ width:'100%', padding:'0.75rem', background:'#d4b896', color:'#080808', border:'none', borderRadius:6, fontWeight:700, fontSize:'1rem', cursor:'pointer' }}>
          {submitting ? 'Checking…' : 'Unlock →'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(180deg,#080808 0%,#111 100%)', padding:'2rem 1rem' }}>
      <div style={{ maxWidth:760, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:'2.5rem' }}>
          <img src={BRAND_LOGO_WHITE_SRC} alt="Mahmoud Adel" style={{ height:64, marginBottom:'1rem' }} />
          <div style={{ display:'inline-block', background:'rgba(212,184,150,0.12)', color:'#d4b896', padding:'0.3rem 0.9rem', borderRadius:999, fontSize:'0.75rem', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:700, marginBottom:'1rem' }}>
            Client Delivery
          </div>
          <h1 style={{ color:'#fff', fontSize:'2rem', marginBottom:'0.4rem' }}>{data.project_title}</h1>
          <p style={{ color:'rgba(255,255,255,0.55)', fontSize:'0.95rem' }}>For {data.client_name}</p>
          {data.expires_at && <p style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.78rem', marginTop:'0.5rem' }}>Available until {new Date(data.expires_at).toLocaleDateString()}</p>}
        </div>

        {data.message && (
          <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'1.2rem 1.4rem', marginBottom:'1.5rem' }}>
            <p style={{ color:'#d4b896', fontSize:'0.78rem', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.4rem', fontWeight:700 }}>Message</p>
            <p style={{ color:'rgba(255,255,255,0.85)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{data.message}</p>
          </div>
        )}

        <h2 style={{ color:'#d4b896', fontSize:'1rem', marginBottom:'0.8rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>Files ({data.files.length})</h2>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
          {data.files.map((f, i) => (
            <a key={i} href={f.url} target="_blank" rel="noreferrer" onClick={() => api.trackDeliveryDownload(deliveryToken)}
               style={{ background:'#181818', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'1rem 1.2rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', textDecoration:'none', color:'#fff', transition:'all 0.2s' }}
               onMouseEnter={e => { e.currentTarget.style.borderColor = '#d4b896'; e.currentTarget.style.background = '#1c1c1c'; }}
               onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = '#181818'; }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.9rem', minWidth: 0, flex: 1 }}>
                <div style={{ width:46, height:46, background:'rgba(212,184,150,0.12)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'1.4rem' }}>📁</div>
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontWeight:600, fontSize:'0.95rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{f.name || 'File'}</div>
                  {f.size_mb && <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.78rem' }}>{f.size_mb >= 1000 ? `${(f.size_mb/1000).toFixed(1)} GB` : `${f.size_mb} MB`}</div>}
                </div>
              </div>
              <div style={{ background:'#d4b896', color:'#080808', padding:'0.5rem 1rem', borderRadius:6, fontWeight:700, fontSize:'0.85rem', whiteSpace:'nowrap' }}>⬇ Download</div>
            </a>
          ))}
        </div>

        <div style={{ textAlign:'center', marginTop:'2.5rem', paddingTop:'1.5rem', borderTop:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.3)', fontSize:'0.75rem' }}>
          Delivered by Mahmoud Adel · <a href="/portfolio" style={{ color:'#d4b896', textDecoration:'none' }}>lensmania.ae</a>
        </div>
      </div>
    </div>
  );
}

// ==================== REVIEW QR PAGE (mobile-optimized) ====================
function ReviewQRPage() {
  const canvasRef = useRef(null);
  const reviewUrl = `${window.location.origin}/?leave-review=1`;
  const [siteName, setSiteName] = useState('');

  useEffect(() => {
    api.getSettings().then(s => setSiteName(s?.site_title || 'Mahmoud Adel')).catch(() => setSiteName('Mahmoud Adel'));
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, reviewUrl, {
        width: Math.min(window.innerWidth, window.innerHeight) * 0.7,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
    }
  }, [reviewUrl]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.25rem',
      textAlign: 'center',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ fontFamily: "'DM Mono', 'Inter', monospace", fontSize: '0.75rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.5)', marginBottom: '1.5rem', textTransform: 'uppercase' }}>
        {siteName} — Client Review
      </div>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2rem, 7vw, 3.5rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '0.75rem' }}>
        Scan to leave a review
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1rem', maxWidth: 460, marginBottom: '2rem', lineHeight: 1.5 }}>
        Open your phone camera and point it at the code below. Tap the link that appears, then share your experience.
      </p>
      <div style={{ background: '#fff', padding: '1.25rem', borderRadius: 16, boxShadow: '0 0 0 1px rgba(255,255,255,0.15), 0 30px 60px rgba(0,0,0,0.6)', display: 'inline-block' }}>
        <canvas ref={canvasRef} style={{ display: 'block' }} />
      </div>
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '1.5rem', wordBreak: 'break-all', maxWidth: 500 }}>
        {reviewUrl}
      </p>
      <a href="/" style={{ marginTop: '2rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem 1.25rem', borderRadius: 999 }}>
        ← Back to site
      </a>
    </div>
  );
}

export { LoginPage, AdminDashboard, ReviewPortal, DeliveryPage, ReviewQRPage };
