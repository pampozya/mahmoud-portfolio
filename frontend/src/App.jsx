import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DOMPurify from 'dompurify';
import './App.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
const BASE_URL = process.env.REACT_APP_BASE_URL || '';
const PUBLIC_ASSET_URL = process.env.PUBLIC_URL || '.';
const LOGO_ASSET_VERSION = '20260523-real';
const BRAND_LOGO_VERSION = '20260524-monogram';
const BRAND_LOGO_WHITE_SRC = `/logo-white.svg?v=${BRAND_LOGO_VERSION}`;
const SHARE_CARD_VERSION = 'fit-v2';
const HERO_PORTFOLIO_ORDER = -10000;
const NARRATIVES_CATEGORY_SLUG = 'narratives';
const NARRATIVES_CATEGORY_ALIASES = ['cinematic-videos', 'cinematic-interviews'];
const CATEGORY_META_PREFIX = '__lensmania_category_meta__:';
const IMAGE_UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif';

const isHeicFile = (file) =>
  Boolean(file && (/hei[cf]/i.test(file.type || '') || /\.(heic|heif)$/i.test(file.name || '')));

const canUseBrowserNotifications = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

async function showAdminBrowserNotification(notification) {
  if (!canUseBrowserNotifications() || Notification.permission !== 'granted') return;
  const title = notification?.title || 'New portfolio notification';
  const options = {
    body: notification?.body || 'Open the dashboard to review it.',
    icon: '/favicon-512.png',
    badge: '/favicon.png',
    tag: notification?.id ? `portfolio-notification-${notification.id}` : 'portfolio-notification',
    data: { url: '/admin' },
  };

  try {
    const registration = await navigator.serviceWorker.ready;
    registration.showNotification(title, options);
  } catch {
    try { new Notification(title, options); } catch {}
  }
}

const toJpegName = (name = 'image') => {
  const base = name.replace(/\.(heic|heif)$/i, '') || 'image';
  return `${base}.jpg`;
};

async function prepareImageUploadFile(file) {
  if (!isHeicFile(file)) return file;
  const { default: heic2any } = await import('heic2any');
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return new File([blob], toJpegName(file.name), { type: 'image/jpeg', lastModified: file.lastModified });
}

const isNarrativesCategory = (catOrSlug) => {
  const slug = typeof catOrSlug === 'string' ? catOrSlug : catOrSlug?.slug;
  return NARRATIVES_CATEGORY_ALIASES.includes((slug || '').toLowerCase());
};

const isActivePublicCategory = (group, activeCategory) =>
  group.slug === activeCategory || (group.aliases || []).includes(activeCategory);

const isHeroPortfolioItem = (item) => Number(item?.order) === HERO_PORTFOLIO_ORDER;

const parseCategoryMeta = (cat) => {
  const rawDescription = cat?.description || '';
  const lines = rawDescription.split('\n');
  let meta = {};
  let description = rawDescription;
  if (lines[0]?.startsWith(CATEGORY_META_PREFIX)) {
    try {
      meta = JSON.parse(lines[0].slice(CATEGORY_META_PREFIX.length));
      description = lines.slice(1).join('\n').trim();
    } catch {
      description = lines.slice(1).join('\n').trim();
    }
  }
  return {
    description,
    thumbnail_url: cat?.thumbnail_url || meta.thumbnail_url || '',
    cover_portfolio_id: cat?.cover_portfolio_id ?? meta.cover_portfolio_id ?? null,
    order: Number.isFinite(Number(meta.order))
      ? Number(meta.order)
      : (Number.isFinite(Number(cat?.order)) ? Number(cat.order) : null),
  };
};

const categorySortValue = (cat, fallbackIndex = 0) => {
  const meta = parseCategoryMeta(cat);
  return Number.isFinite(Number(meta.order)) ? Number(meta.order) : fallbackIndex;
};

const sortCategoriesForDisplay = (cats = []) => [...cats]
  .map((cat, index) => ({ cat, index }))
  .sort((a, b) => {
    const orderDiff = categorySortValue(a.cat, a.index) - categorySortValue(b.cat, b.index);
    return orderDiff || a.index - b.index;
  })
  .map(({ cat }) => cat);

const buildCategoryPayload = ({ name, slug, description, thumbnail_url, cover_portfolio_id, order }) => {
  const cleanDescription = (description || '').trim();
  const cleanThumb = (thumbnail_url || '').trim();
  const cleanCoverId = cover_portfolio_id ? Number(cover_portfolio_id) : null;
  const cleanOrder = Number.isFinite(Number(order)) ? Number(order) : null;
  const meta = {};
  if (cleanThumb) meta.thumbnail_url = cleanThumb;
  if (cleanCoverId) meta.cover_portfolio_id = cleanCoverId;
  if (cleanOrder !== null) meta.order = cleanOrder;
  const metaLine = Object.keys(meta).length ? `${CATEGORY_META_PREFIX}${JSON.stringify(meta)}` : '';

  return {
    name,
    slug,
    description: metaLine ? `${metaLine}${cleanDescription ? `\n${cleanDescription}` : ''}` : (cleanDescription || null),
    thumbnail_url: cleanThumb || null,
    cover_portfolio_id: cleanCoverId,
  };
};

const WORKED_WITH_LOGOS = [
  {
    id: 'worked-with-dubai-police',
    name: 'Dubai Police',
    image_url: `${PUBLIC_ASSET_URL}/client-dubai-police.svg?v=${LOGO_ASSET_VERSION}`,
    link_url: 'https://www.dubaipolice.gov.ae/',
  },
  {
    id: 'worked-with-dubai-municipality',
    name: 'Dubai Municipality',
    image_url: `${PUBLIC_ASSET_URL}/client-dubai-municipality.svg?v=${LOGO_ASSET_VERSION}`,
    link_url: 'https://www.dm.gov.ae/',
  },
  {
    id: 'worked-with-dubai-civil-defence',
    name: 'Dubai Civil Defence',
    image_url: `${PUBLIC_ASSET_URL}/client-dubai-civil-defence.png?v=${LOGO_ASSET_VERSION}`,
    link_url: 'https://www.dcd.gov.ae/',
  },
  {
    id: 'worked-with-dubai-media-office',
    name: 'Dubai Media Office',
    image_url: `${PUBLIC_ASSET_URL}/client-dubai-media-office.png?v=${LOGO_ASSET_VERSION}`,
    link_url: 'https://mediaoffice.ae/',
  },
  {
    id: 'worked-with-sharjah-municipality',
    name: 'Sharjah Municipality',
    image_url: `${PUBLIC_ASSET_URL}/client-sharjah-municipality.png?v=${LOGO_ASSET_VERSION}`,
    link_url: 'https://www.shjmun.gov.ae/',
  },
  {
    id: 'worked-with-gitex-global',
    name: 'GITEX Global',
    image_url: `${PUBLIC_ASSET_URL}/client-gitex-global.png?v=${LOGO_ASSET_VERSION}`,
    link_url: 'https://www.gitex.com/',
  },
  {
    id: 'worked-with-raising-canes',
    name: "Raising Cane's",
    image_url: `${PUBLIC_ASSET_URL}/client-raising-canes.svg?v=${LOGO_ASSET_VERSION}`,
    link_url: 'https://www.raisingcanes.com/',
  },
  {
    id: 'worked-with-moonlight-clinic',
    name: 'Moonlight Clinic',
  },
  {
    id: 'worked-with-infrafit-clinic',
    name: 'Infrafit Clinic',
  },
  {
    id: 'worked-with-doctor-style-clinic',
    name: 'Doctor Style Clinic',
  },
  {
    id: 'worked-with-r-define-clinic',
    name: 'R Define Clinic',
  },
  {
    id: 'worked-with-be-well-clinic',
    name: 'Be Well Clinic',
  },
  {
    id: 'worked-with-dr-hanadi',
    name: 'Dr Hanadi',
  },
];

const mergeWorkedWithLogos = (logos) => {
  const dynamicLogos = Array.isArray(logos) ? logos : [];
  const dynamicNames = new Set(
    dynamicLogos
      .map((logo) => (logo?.name || '').trim().toLowerCase())
      .filter(Boolean)
  );

  return [
    ...dynamicLogos,
    ...WORKED_WITH_LOGOS.filter((logo) => !dynamicNames.has(logo.name.toLowerCase())),
  ];
};

// Keep Render free tier warm — ping every 4 minutes
setInterval(() => fetch(`${API_URL}/health`).catch(() => {}), 4 * 60 * 1000);

// ==================== API ====================

const api = {
  login: (email, password) =>
    fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(r => r.json()),
  changePassword: (token, data) =>
    fetch(`${API_URL}/auth/change-password`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }).then(r => r.json()),
  getCategories: () => fetch(`${API_URL}/categories`, { cache: 'no-store' }).then(r => r.json()),
  createCategory: (token, data) =>
    fetch(`${API_URL}/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }).then(r => r.json()),
  reorderCategories: (token, ids) =>
    fetch(`${API_URL}/categories/reorder`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ids }) }).then(r => r.json()),
  updateCategory: (token, id, data) =>
    fetch(`${API_URL}/categories/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }).then(r => r.json()),
  deleteCategory: (token, id) =>
    fetch(`${API_URL}/categories/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  getPortfolio: (sort) =>
    fetch(`${API_URL}/portfolio${sort ? `?sort=${sort}` : ''}`, { cache: 'no-store' }).then(r => r.json()),
  createPortfolio: (token, data) =>
    fetch(`${API_URL}/portfolio`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }).then(r => r.json()),
  updatePortfolio: (token, id, data) =>
    fetch(`${API_URL}/portfolio/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }).then(r => r.json()),
  deletePortfolio: (token, id) =>
    fetch(`${API_URL}/portfolio/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  reorderPortfolio: (token, ids) =>
    fetch(`${API_URL}/portfolio/reorder`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ids }) }).then(r => r.json()),
  duplicatePortfolio: (token, id) =>
    fetch(`${API_URL}/portfolio/${id}/duplicate`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  likePortfolio: (id) =>
    fetch(`${API_URL}/portfolio/${id}/like`, { method: 'POST' }).then(r => r.json()),
  getSettings: () => fetch(`${API_URL}/settings`, { cache: 'no-store' }).then(r => r.json()),
  updateSettings: (token, data) =>
    fetch(`${API_URL}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }).then(r => r.json()),
  getTestimonials: () => fetch(`${API_URL}/testimonials`, { cache: 'no-store' }).then(r => r.json()),
  getAllTestimonials: (token) => fetch(`${API_URL}/testimonials/all`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  createTestimonial: (token, data) =>
    fetch(`${API_URL}/testimonials`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }).then(r => r.json()),
  updateTestimonial: (token, id, data) =>
    fetch(`${API_URL}/testimonials/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }).then(r => r.json()),
  submitTestimonialPublic: (data) =>
    fetch(`${API_URL}/testimonials/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  approveTestimonial: (token, id) =>
    fetch(`${API_URL}/testimonials/${id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  toggleTestimonialActive: (token, id) =>
    fetch(`${API_URL}/testimonials/${id}/toggle-active`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  deleteTestimonial: (token, id) =>
    fetch(`${API_URL}/testimonials/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  getClientLogos: () => fetch(`${API_URL}/client-logos`, { cache: 'no-store' }).then(r => r.json()),
  getAllClientLogos: (token) => fetch(`${API_URL}/client-logos/all`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  createClientLogo: (token, data) =>
    fetch(`${API_URL}/client-logos`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }).then(r => r.json()),
  updateClientLogo: (token, id, data) =>
    fetch(`${API_URL}/client-logos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }).then(r => r.json()),
  deleteClientLogo: (token, id) =>
    fetch(`${API_URL}/client-logos/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  reorderClientLogos: (token, ids) =>
    fetch(`${API_URL}/client-logos/reorder`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ids }) }).then(r => r.json()),
  exportData: (token) => fetch(`${API_URL}/export`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  aiChat: (token, message, context) =>
    fetch(`${API_URL}/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ message, context }) }).then(r => r.json()),
  aiBestThumbnail: (token, frames, title) =>
    fetch(`${API_URL}/ai/best-thumbnail`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ frames, title }) }).then(r => r.json()),
  fetchThumbnail: (token, url) =>
    fetch(`${API_URL}/fetch-thumbnail`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ url }) }).then(r => r.json()),
  reactToPortfolio: (id, reaction) =>
    fetch(`${API_URL}/portfolio/${id}/react`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reaction }) }).then(r => r.json()),
  trackVideoView: (id) =>
    fetch(`${API_URL}/portfolio/${id}/view-track`, { method: 'POST' }).catch(() => {}),
  submitContact: (data) =>
    fetch(`${API_URL}/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  getNotifications: (token) => fetch(`${API_URL}/notifications`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  getUnreadCount: (token) => fetch(`${API_URL}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  markAllRead: (token) => fetch(`${API_URL}/notifications/read-all`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  deleteNotification: (token, id) => fetch(`${API_URL}/notifications/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  trackVisit: () => {
    const utm = new URLSearchParams(window.location.search).get('utm_source') ||
                new URLSearchParams(window.location.search).get('ref') || null;
    return fetch(`${API_URL}/track`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ utm_source: utm }) }).catch(() => {});
  },
  getAnalytics: (token) => fetch(`${API_URL}/analytics`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  getUploadSignature: async (token) => {
    const r = await fetch('https://lensmania-sign.pampozya.workers.dev/', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `Signature failed (${r.status})`);
    return data;
  },

  // PRIMARY upload path — Cloudflare R2 (no forced compression, full original quality)
  // `uploadFile` is aliased to this below so every existing caller goes to R2 transparently.
  uploadFile: (token, file, onProgress) => api.uploadFileR2(token, file, onProgress),
  uploadFileR2: (token, file, onProgress) => new Promise(async (resolve, reject) => {
    try {
      const sigR = await fetch('https://lensmania-sign.pampozya.workers.dev/r2', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' }),
      });
      const sig = await sigR.json();
      if (!sigR.ok) throw new Error(sig.error || `R2 signature failed (${sigR.status})`);
      if (!sig.uploadUrl || !sig.publicUrl) throw new Error('R2 not configured on Worker');

      const xhr = new XMLHttpRequest();
      xhr.open('PUT', sig.uploadUrl);
      // Don't send Authorization header — presigned URL contains its own auth via query string
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ url: sig.publicUrl, filename: file.name });
        } else {
          reject(new Error(`R2 upload failed (${xhr.status}): ${xhr.responseText?.slice(0, 200) || 'unknown'}`));
        }
      };
      xhr.onerror = () => reject(new Error('R2 network error'));
      xhr.send(file);
    } catch (e) { reject(new Error(`Upload failed: ${e.message}`)); }
  }),

  // LEGACY upload path — Cloudinary. Kept as fallback; existing video_urls already on Cloudinary keep working.
  uploadFileCloudinary: (token, file, onProgress, preSig = null) => new Promise(async (resolve, reject) => {
    try {
      // Use pre-fetched signature if provided, else fetch fresh
      let sig = preSig;
      if (!sig) {
        const r = await fetch('https://lensmania-sign.pampozya.workers.dev/', {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }
        });
        sig = await r.json();
        if (!r.ok) throw new Error(sig.error || `Signature failed (${r.status})`);
      }

      const isVideo = ['video/mp4','video/quicktime','video/webm','video/avi','video/x-msvideo','video/x-matroska'].includes(file.type) || /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);
      if (sig.cloud_name && sig.api_key && sig.signature) {
        // Signed direct upload — works for all file sizes, bypasses backend timeout
        const resourceType = isVideo ? 'video' : 'image';
        const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB chunks
        const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloud_name}/${resourceType}/upload`;

        const doXhr = (formData, headers = {}) => new Promise((res, rej) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', uploadUrl);
          Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => {
            try {
              const data = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300) {
                res(data);
              } else {
                rej(new Error(`Cloudinary error (${xhr.status}): ${data.error?.message || 'Upload failed'}`));
              }
            } catch { rej(new Error(`Bad response from Cloudinary (${xhr.status})`)); }
          };
          xhr.onerror = () => rej(new Error('Cloudinary network error'));
          xhr.send(formData);
        });

        const buildForm = (chunk, extra = {}) => {
          const form = new FormData();
          form.append('file', chunk);
          form.append('api_key', sig.api_key);
          form.append('timestamp', sig.timestamp);
          form.append('folder', sig.folder);
          form.append('public_id', sig.public_id);
          form.append('signature', sig.signature);
          Object.entries(extra).forEach(([k, v]) => form.append(k, v));
          return form;
        };

        try {
          if (file.size <= CHUNK_SIZE) {
            const r = await doXhr(buildForm(file));
            if (r.secure_url) { resolve({ url: r.secure_url, filename: r.original_filename || file.name }); }
            else { reject(new Error(`Upload failed: ${r.error?.message || 'Unknown error'}`)); }
          } else {
            // Chunked signed upload for large files
            const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            let offset = 0;
            let lastResult = null;
            while (offset < file.size) {
              const end = Math.min(offset + CHUNK_SIZE, file.size);
              const r = await doXhr(buildForm(file.slice(offset, end)), {
                'X-Unique-Upload-Id': uploadId,
                'Content-Range': `bytes ${offset}-${end - 1}/${file.size}`,
              });
              if (r.error) throw new Error(r.error.message);
              lastResult = r;
              offset = end;
              if (onProgress) onProgress(Math.round((offset / file.size) * 100));
            }
            if (lastResult?.secure_url) { resolve({ url: lastResult.secure_url, filename: lastResult.original_filename || file.name }); }
            else { reject(new Error('No URL from Cloudinary')); }
          }
        } catch (e) { reject(e); return; }
        return;
      }
      // Signature missing — Cloudinary not configured on server
      reject(new Error('Cloudinary not configured. Contact admin.'));
    } catch (e) { reject(new Error(`Upload failed: ${e.message}`)); }
  }),
  // Review portal
  createReviewSession: (token, data) =>
    fetch(`${API_URL}/review-sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }).then(r => r.json()),
  getReviewSessions: (token) =>
    fetch(`${API_URL}/review-sessions`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  deleteReviewSession: (token, id) =>
    fetch(`${API_URL}/review-sessions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  getReview: (token) => fetch(`${API_URL}/review/${token}`).then(r => r.json()),
  addReviewComment: (token, text, timestamp_sec, author) =>
    fetch(`${API_URL}/review/${token}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, timestamp_sec, author }) }).then(r => r.json()),
  resolveComment: (token, id) =>
    fetch(`${API_URL}/review/comments/${id}/resolve`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  getInquirySources: (token) =>
    fetch(`${API_URL}/analytics/sources`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  // Deliveries
  createDelivery: (token, data) =>
    fetch(`${API_URL}/deliveries`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }).then(r => r.json()),
  listDeliveries: (token) =>
    fetch(`${API_URL}/deliveries`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  updateDelivery: (token, id, data) =>
    fetch(`${API_URL}/deliveries/${id}`, { method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }).then(r => r.json()),
  deleteDelivery: (token, id) =>
    fetch(`${API_URL}/deliveries/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  accessDelivery: (token, password) =>
    fetch(`${API_URL}/delivery/${token}/access`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ password }) }).then(r => r.json()),
  trackDeliveryDownload: (token) =>
    fetch(`${API_URL}/delivery/${token}/track`, { method: 'POST' }).catch(() => {}),
};

// ==================== TRANSLATION ====================

function hasArabic(text) {
  return /[؀-ۿ]/.test(text || '');
}

function TranslateToggle({ text, className = '' }) {
  const [translated, setTranslated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  if (!hasArabic(text) || !text?.trim()) return null;

  const translate = async () => {
    if (translated) { setShow(s => !s); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target: 'en' }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTranslated(data.translation);
      setShow(true);
    } catch { setTranslated(null); }
    setLoading(false);
  };

  return (
    <span className={`translate-toggle-wrap ${className}`}>
      {show && translated && <span className="translated-text">{translated}</span>}
      <button className="translate-btn" onClick={translate} disabled={loading} title={show ? 'Show original' : 'Translate to English'}>
        {loading ? '⏳' : show ? '🌐 AR' : '🌐 EN'}
      </button>
    </span>
  );
}

// ==================== VIDEO PLATFORM UTILS ====================

const PLATFORMS = {
  youtube: { label: 'YouTube', color: '#FF0000' },
  vimeo: { label: 'Vimeo', color: '#1AB7EA' },
  tiktok: { label: 'TikTok', color: '#000000' },
  instagram: { label: 'Instagram', color: '#E1306C' },
  facebook: { label: 'Facebook', color: '#1877F2' },
  twitter: { label: 'X / Twitter', color: '#000000' },
  snapchat: { label: 'Snapchat', color: '#FFFC00' },
  dailymotion: { label: 'Dailymotion', color: '#0066DC' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2' },
  direct: { label: 'Direct Upload', color: '#FFA781' },
  embed: { label: 'Custom Embed Code', color: '#888' },
};

function detectPlatform(url) {
  if (!url) return 'direct';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('vimeo.com')) return 'vimeo';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('snapchat.com')) return 'snapchat';
  if (url.includes('dailymotion.com')) return 'dailymotion';
  if (url.includes('linkedin.com')) return 'linkedin';
  return 'direct';
}

function getYouTubeId(url) {
  const m = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
function getVimeoId(url) {
  const m = url?.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}
function getTikTokId(url) {
  const m = url?.match(/video\/(\d+)/);
  return m ? m[1] : null;
}
function getInstagramCode(url) {
  const m = url?.match(/\/(p|reel|tv)\/([^/?]+)/);
  return m ? { type: m[1], code: m[2] } : null;
}
function getDailymotionId(url) {
  const m = url?.match(/video\/([a-z0-9]+)/i);
  return m ? m[1] : null;
}

function getEmbedUrl(item) {
  const url = item.video_url;
  const type = item.video_type || detectPlatform(url);
  if (!url && type !== 'embed') return null;
  switch (type) {
    case 'youtube': { const id = getYouTubeId(url); return id ? `https://www.youtube.com/embed/${id}` : null; }
    case 'vimeo': { const id = getVimeoId(url); return id ? `https://player.vimeo.com/video/${id}` : null; }
    case 'tiktok': { const id = getTikTokId(url); return id ? `https://www.tiktok.com/embed/v2/${id}` : null; }
    case 'instagram': { const ig = getInstagramCode(url); return ig ? `https://www.instagram.com/${ig.type}/${ig.code}/embed/` : null; }
    case 'facebook': return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&width=800`;
    case 'dailymotion': { const id = getDailymotionId(url); return id ? `https://www.dailymotion.com/embed/video/${id}` : null; }
    default: return null;
  }
}

function getShowreelEmbed(url) {
  if (!url) return null;
  const ytId = getYouTubeId(url);
  if (ytId) return `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&showinfo=0`;
  const vId = getVimeoId(url);
  if (vId) return `https://player.vimeo.com/video/${vId}?autoplay=1&muted=1&loop=1&background=1`;
  return null;
}

const WEB_VIDEO_VARIANTS = {
  'https://pub-534146b836b546889e3727f44f5adb93.r2.dev/mahmoud/videos/1781700105152-fb5756a9.mp4':
    'https://pub-534146b836b546889e3727f44f5adb93.r2.dev/mahmoud/videos/1781700105152-fb5756a9-web.mp4',
  'https://pub-534146b836b546889e3727f44f5adb93.r2.dev/mahmoud/videos/1783530234780-ac7665c5.mp4':
    'https://pub-534146b836b546889e3727f44f5adb93.r2.dev/mahmoud/videos/1783530234780-ac7665c5-web.mp4',
  'https://pub-534146b836b546889e3727f44f5adb93.r2.dev/mahmoud/videos/20260821-silal-fresh-from-farm-to-market.mp4':
    'https://pub-534146b836b546889e3727f44f5adb93.r2.dev/mahmoud/videos/hero-loop-silal-optimized.mp4',
};

// Preserve these records in the admin/database, but do not advertise projects
// whose original Cloudinary video and thumbnail assets are no longer available.
const UNAVAILABLE_PUBLIC_PORTFOLIO_IDS = new Set([3, 9, 13, 21, 26, 27]);

// Muted, audio-stripped 720p loops for the hero masthead only (never used in the modal player).
const HERO_VIDEO_VARIANTS = {
  'https://pub-534146b836b546889e3727f44f5adb93.r2.dev/mahmoud/videos/web/39-web.mp4':
    'https://pub-534146b836b546889e3727f44f5adb93.r2.dev/mahmoud/videos/hero-loop-39-720.mp4',
  'https://pub-534146b836b546889e3727f44f5adb93.r2.dev/mahmoud/videos/20260821-silal-fresh-from-farm-to-market.mp4':
    'https://pub-534146b836b546889e3727f44f5adb93.r2.dev/mahmoud/videos/hero-loop-silal-720.mp4',
};

function resolveUrl(url, type = 'auto') {
  if (!url) return null;
  if (type === 'hero') return HERO_VIDEO_VARIANTS[url] || WEB_VIDEO_VARIANTS[url] || resolveUrl(url);
  if (type === 'video' && WEB_VIDEO_VARIANTS[url]) return WEB_VIDEO_VARIANTS[url];
  if (url.startsWith('/')) return `${BASE_URL}${url}`;
  // Serve Cloudinary videos at original quality (no q_auto compression). R2 URLs pass through as-is.
  return url;
}

function getThumbnail(item) {
  if (item.thumbnail_url) return resolveUrl(item.thumbnail_url);
  const type = item.video_type || detectPlatform(item.video_url);
  if (type === 'youtube' && item.video_url) {
    const id = getYouTubeId(item.video_url);
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }
  return null;
}

function getPortfolioShareUrl(item) {
  if (!item?.id) return window.location.href;
  const baseVersion = item.updated_at || item.thumbnail_url || item.id;
  const version = `${String(baseVersion).replace(/[^A-Za-z0-9_-]/g, '')}-${SHARE_CARD_VERSION}`;
  return `${window.location.origin}/share/${item.id}${version ? `?v=${version}` : ''}`;
}

function getPortfolioShareImageUrl(item) {
  const fallback = getThumbnail(item);
  if (!item?.id || !fallback || typeof window === 'undefined') return fallback;
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  if (isLocal) return fallback;
  const baseVersion = item.updated_at || item.thumbnail_url || item.id;
  const version = `${String(baseVersion).replace(/[^A-Za-z0-9_-]/g, '')}-${SHARE_CARD_VERSION}`;
  return `${window.location.origin}/share-image/${item.id}.jpg${version ? `?v=${version}` : ''}`;
}

function getAspectPadding(ratio) {
  const map = { '16:9': '56.25%', '9:16': '177.78%', '4:3': '75%', '1:1': '100%', '21:9': '42.86%' };
  return map[ratio] || '56.25%';
}

// ==================== UPLOAD PROGRESS ====================

function UploadProgress({ progress, filename, done, error }) {
  if (progress === null && !done && !error) return null;
  return (
    <div className="upload-progress-wrap">
      <div className="upload-progress-info">
        <span className="upload-progress-name">{filename}</span>
        <span className="upload-progress-pct">{error ? '❌ Failed' : done ? '✅ Done' : `${progress}%`}</span>
      </div>
      <div className="upload-progress-bar">
        <div className={`upload-progress-fill${done ? ' done' : ''}${error ? ' error' : ''}`} style={{ width: `${done ? 100 : (progress || 0)}%` }} />
      </div>
    </div>
  );
}

function PwaUpdateToast() {
  const [visible, setVisible] = useState(() => Boolean(window.__portfolioUpdateReady));
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const onUpdateReady = () => setVisible(true);
    const syncViewportGap = () => {
      const gap = Math.max(0, window.innerHeight - document.documentElement.clientHeight);
      document.documentElement.style.setProperty('--viewport-bottom-offset', `${gap}px`);
    };
    syncViewportGap();
    window.addEventListener('portfolio-sw-update', onUpdateReady);
    window.addEventListener('resize', syncViewportGap);
    window.visualViewport?.addEventListener('resize', syncViewportGap);
    if (window.__portfolioUpdateReady) setVisible(true);
    return () => {
      window.removeEventListener('portfolio-sw-update', onUpdateReady);
      window.removeEventListener('resize', syncViewportGap);
      window.visualViewport?.removeEventListener('resize', syncViewportGap);
    };
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const registration = window.__portfolioWaitingRegistration || await navigator.serviceWorker?.getRegistration?.();
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.setTimeout(() => window.location.reload(), 3500);
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  if (!visible) return null;
  return (
    <div className="pwa-update-toast" role="status" aria-live="polite">
      <div>
        <strong>Update available</strong>
        <span>Refresh to load the latest portfolio.</span>
      </div>
      <button type="button" onClick={refresh} disabled={refreshing}>
        {refreshing ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );
}

// ==================== REACTION PICKER ====================

const REACTIONS = [
  { key: 'heart', emoji: '❤️', label: 'Love' },
  { key: 'fire', emoji: '🔥', label: 'Fire' },
  { key: 'clap', emoji: '👏', label: 'Clap' },
  { key: 'wow', emoji: '😮', label: 'Wow' },
];

function ReactionPicker({ itemId, userReaction, onReact }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="reaction-wrap" onMouseLeave={() => setOpen(false)}>
      <button className={`reaction-trigger${userReaction ? ' reacted' : ''}`} onClick={e => { e.stopPropagation(); setOpen(!open); }}>
        {userReaction ? REACTIONS.find(r => r.key === userReaction)?.emoji : '😊'}
      </button>
      {open && (
        <div className="reaction-picker" onClick={e => e.stopPropagation()}>
          {REACTIONS.map(r => (
            <button key={r.key} className={`reaction-btn${userReaction === r.key ? ' active' : ''}`} onClick={() => { onReact(itemId, r.key); setOpen(false); }} title={r.label}>
              <span>{r.emoji}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== SELECTED WORK (FEATURED) ====================

function FeaturedCarousel({ items, onSelect, lang }) {
  const [idx, setIdx] = useState(0);
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  const touchStartX = useRef(null);
  const total = items.length;
  const isAr = lang === 'ar';

  // GSAP scroll-reveal — frame scale-in + info stagger-rise
  useEffect(() => {
    if (!sectionRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from('.fc-frame', {
        opacity: 0, y: 16, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 88%', toggleActions: 'play none none none' },
      });
      gsap.from('.fc-info > *', {
        y: 22, opacity: 0, duration: 0.75, stagger: 0.07, ease: 'expo.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 82%', toggleActions: 'play none none none' },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, [idx]);

  const item = total ? items[idx] : null;
  const isDirectVideo = item && item.video_type === 'direct' && item.video_url;
  const videoUrl = isDirectVideo ? resolveUrl(item.video_url, 'video') : null;

  // Auto-play featured video muted when in view, pause when out
  useEffect(() => {
    if (!videoRef.current || !isDirectVideo) return;
    const v = videoRef.current;
    const tryPlay = () => { v.play().catch(() => {}); };
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) tryPlay();
      else v.pause();
    }, { threshold: 0 });
    obs.observe(v);
    v.addEventListener('canplay', tryPlay);
    return () => { obs.disconnect(); v.removeEventListener('canplay', tryPlay); };
  }, [isDirectVideo, videoUrl]);

  if (!total) return null;
  const thumb = getThumbnail(item);
  const fx = item.featured_focal_x ?? 50;
  const fy = item.featured_focal_y ?? 50;
  const year = item.created_at ? new Date(item.created_at).getFullYear() : null;
  const featuredSummary = (item.description || '').split(/\n{2,}|\n/)[0].trim();
  const collabs = parseCollaborators(item.collaborators);
  const prev = () => setIdx(i => (i - 1 + total) % total);
  const next = () => setIdx(i => (i + 1) % total);

  return (
    <section className="featured-section" ref={sectionRef} aria-label={isAr ? 'أعمال مختارة' : 'Selected work'}>
      <div
        className="fc-frame"
        onTouchStart={e => { if (total > 1) touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          if (total <= 1 || touchStartX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
          touchStartX.current = null;
        }}
      >
        {/* Media */}
        <button type="button" className="fc-media-btn" onClick={() => onSelect(item)} aria-label={`${isAr ? 'مشاهدة' : 'Watch'} ${item.title}`}>
          {isDirectVideo ? (
            <video ref={videoRef} key={videoUrl} src={videoUrl} poster={thumb || undefined}
              muted loop playsInline autoPlay preload="auto"
              className="fc-media" style={{ objectPosition: `${fx}% ${fy}%` }}
            />
          ) : (
            <div className="fc-media fc-media-thumb"
              style={thumb ? { backgroundImage: `url(${thumb})`, backgroundPosition: `${fx}% ${fy}%` } : {}}
            />
          )}
          <div className="fc-overlay" aria-hidden="true" />
        </button>

        {/* Top bar */}
        <div className="fc-top" aria-hidden="true">
          <span className="fc-chapter">02 — {isAr ? 'أعمال مختارة' : 'Selected Work'}</span>
          {total > 1 && (
            <span className="fc-counter">
              <span className="fc-counter-current">{String(idx + 1).padStart(2, '0')}</span>
              <span className="fc-counter-sep"> / </span>
              <span className="fc-counter-total">{String(total).padStart(2, '0')}</span>
            </span>
          )}
        </div>

        {/* Bottom info */}
        <div className="fc-bottom" dir="auto" key={`fc-info-${item.id}`}>
          <div className="fc-info">
            {collabs.length > 0 && (
              <div className="fc-credits">
                {collabs.slice(0, 3).map((c, i) => {
                  const clean = (c.handle || c).replace('@', '');
                  return (
                    <a key={i} href={collabLinkHref(c)} target="_blank" rel="noreferrer" className="fc-credit-pill">
                      @{clean}{c.role && <span className="fc-credit-role"> · {c.role}</span>}
                      {c.url && !/instagram\.com/i.test(c.url) && <span className="fc-credit-role"> · {collabPlatformLabel(c)}</span>}
                    </a>
                  );
                })}
              </div>
            )}
            <span className="fc-label">{isAr ? 'مشروع' : 'Project'}</span>
            <h2 className="fc-title">{item.title}</h2>
            {featuredSummary && <p className="fc-desc">{featuredSummary}</p>}
          </div>
          <div className="fc-actions">
            {total > 1 && (
              <div className="fc-dots">
                {items.map((_, i) => (
                  <button key={i} type="button"
                    className={i === idx ? 'fc-dot active' : 'fc-dot'}
                    onClick={() => setIdx(i)}
                    aria-label={`Featured ${i + 1}`}
                  />
                ))}
              </div>
            )}
            <button type="button" className="fc-cta" onClick={() => onSelect(item)}>
              {isAr ? 'مشاهدة المشروع' : 'View Project'}<span aria-hidden="true"> →</span>
            </button>
          </div>
        </div>

        {/* Side arrows */}
        {total > 1 && (
          <>
            <button type="button" className="fc-arrow fc-arrow-prev" onClick={prev} aria-label="Previous">‹</button>
            <button type="button" className="fc-arrow fc-arrow-next" onClick={next} aria-label="Next">›</button>
          </>
        )}
      </div>
    </section>
  );
}

// ==================== QR CODE MODAL ====================

function QRModal({ url, title, onClose }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (canvasRef.current) import('qrcode').then(m => (m.default || m).toCanvas(canvasRef.current, url, { width: 256, color: { dark: '#5B0E2D', light: '#ffffff' } })).catch(() => {});
  }, [url]);

  const download = () => {
    const link = document.createElement('a');
    link.download = `qr-${title.replace(/\s+/g, '-')}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="qr-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3>QR Code</h3>
        <p>{title}</p>
        <canvas ref={canvasRef} />
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button className="btn-primary" onClick={download}>⬇️ Download PNG</button>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ==================== AVAILABILITY BADGE ====================

function AvailabilityBadge({ available, text, lang }) {
  const defaultText = available ? 'Available for bookings' : 'Currently booked';
  return (
    <div className={`availability-badge${available ? ' available' : ' booked'}`}>
      <span className="avail-dot" />
      {text || defaultText}
    </div>
  );
}

// ==================== COOKIE CONSENT ====================

function CookieConsent({ lang }) {
  const [visible, setVisible] = useState(!localStorage.getItem('cookie_consent'));
  if (!visible) return null;
  const accept = () => { localStorage.setItem('cookie_consent', '1'); setVisible(false); };
  return (
    <div className="cookie-banner">
      <p>We use cookies to improve your experience. By using this site you agree to our privacy policy.</p>
      <div className="cookie-actions">
        <button className="btn-cookie-accept" onClick={accept}>Accept</button>
        <button className="btn-cookie-decline" onClick={() => setVisible(false)}>Decline</button>
      </div>
    </div>
  );
}

// ==================== HERO — SILENT SHOWREEL MASTHEAD ====================

function HeroMasthead({ settings, heroImg, siteTitle, featuredItem, isAr, suspendPlayback = false }) {
  const sectionRef = useRef(null);
  const mediaRef = useRef(null);
  const videoRef = useRef(null);

  const showreelUrl = featuredItem && featuredItem.video_type === 'direct' && featuredItem.video_url
    ? resolveUrl(featuredItem.video_url, 'hero')
    : null;
  const shouldRenderVideo = Boolean(showreelUrl && !suspendPlayback);
  const fallbackImg = featuredItem ? (getThumbnail(featuredItem) || heroImg) : heroImg;
  const heroCollaborators = featuredItem ? parseCollaborators(featuredItem.collaborators) : [];
  const heroFocalX = featuredItem?.featured_focal_x ?? 50;
  const heroFocalY = featuredItem?.featured_focal_y ?? 50;
  const heroMediaStyle = { objectPosition: `${heroFocalX}% ${heroFocalY}%` };

  // GSAP parallax drift on the media layer as the hero scrolls past
  // (disabled on touch / small screens — iOS URL-bar resize fights it and weaker GPUs jank)
  useEffect(() => {
    if (!sectionRef.current || !mediaRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const isSmallOrTouch = window.matchMedia('(max-width: 900px), (hover: none)').matches;
    const ctx = gsap.context(() => {
      if (!isSmallOrTouch) {
        gsap.to(mediaRef.current, {
          yPercent: 18,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.8,
          },
        });
      }
      gsap.fromTo(
        '.hero-frame',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', delay: 0.15 }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  // Best-effort autoplay (some mobile browsers refuse silent autoplay until interaction)
  useEffect(() => {
    if (!videoRef.current || !shouldRenderVideo) return;
    const v = videoRef.current;
    const tryPlay = () => v.play().catch(() => {});
    tryPlay();
    document.addEventListener('touchstart', tryPlay, { once: true, passive: true });
    document.addEventListener('click', tryPlay, { once: true });
    return () => {
      document.removeEventListener('touchstart', tryPlay);
      document.removeEventListener('click', tryPlay);
    };
  }, [shouldRenderVideo]);

  const scrollToNext = () => {
    const next = document.querySelector('#portfolio') || document.querySelector('section + section');
    if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const titleParts = (siteTitle || 'Mahmoud Adel').trim().split(/\s+/);
  const firstName = titleParts[0] || '';
  const lastName = titleParts.slice(1).join(' ');

  return (
    <section className="hero" ref={sectionRef} aria-label="Showreel">
      <div className="hero-panel">
        <div className="hero-media" ref={mediaRef}>
          {shouldRenderVideo ? (
            <video
              ref={videoRef}
              src={showreelUrl}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={fallbackImg || undefined}
              aria-hidden="true"
              style={heroMediaStyle}
            />
          ) : fallbackImg ? (
            <img src={fallbackImg} alt="" aria-hidden="true" style={heroMediaStyle} />
          ) : null}
        </div>
        <div className="hero-vignette" aria-hidden="true" />
        <div className="hero-frame">
          <div className="hero-name-wrap">
            <h1 className="hero-name">
              {firstName}
              {lastName && <span className="hero-name-em">{lastName}</span>}
            </h1>
            <p className="hero-role">{isAr ? 'مدير تصوير ومصور سينمائي' : 'Cinematographer & Director'}</p>
            <span className="hero-rule" aria-hidden="true" />
          </div>

          <div className="hero-bottomline">
            <button type="button" className="hero-primary-cta" onClick={scrollToNext}>
              <span className="hero-primary-cta-icon" aria-hidden="true">▶</span>
              <span>{isAr ? 'الأعمال المختارة' : 'Selected Work'}</span>
            </button>
            <span className="hero-availability">
              {settings?.available_for_booking !== false
                ? (isAr ? 'متاح للمشاريع — دبي' : `Available for projects — ${settings?.location || 'Dubai'}`)
                : (isAr ? 'محجوز حالياً — دبي' : `Currently booked — ${settings?.location || 'Dubai'}`)}
            </span>
            {heroCollaborators.length > 0 && (
              <div className="hero-collaborators" aria-label={isAr ? 'المتعاونون' : 'Project credits'}>
                <span className="hero-collaborators-label">{isAr ? 'بمشاركة' : 'Credits'}</span>
                <div className="hero-collaborators-list">
                  {heroCollaborators.map((c, i) => {
                    const clean = (c.handle || c).replace('@', '');
                    return (
                      <a key={i} href={collabLinkHref(c)} target="_blank" rel="noreferrer">
                        @{clean}{c.role && <span>{c.role}</span>}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function CinematicBrief({ portfolio, settings, siteDesc, isAr }) {
  const items = Array.isArray(portfolio) ? portfolio : [];
  const latestItem = [...items].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
  const latestYear = latestItem?.created_at ? new Date(latestItem.created_at).getFullYear() : new Date().getFullYear();
  const signals = [
    { label: isAr ? 'الأسلوب' : 'Visual style', value: isAr ? 'سينمائي' : 'Cinematic' },
    { label: isAr ? 'الإنتاج' : 'Production', value: isAr ? 'مرن' : 'Agile' },
    { label: isAr ? 'التسليم' : 'Delivery', value: isAr ? 'جاهز' : 'Ready' },
    { label: isAr ? 'الوجهة' : 'Based in', value: (settings?.location || 'Dubai').split(',')[0] },
  ];

  return (
    <section className="cinematic-brief" aria-label="Portfolio briefing">
      <div className="cinematic-brief-inner">
        <div className="brief-copy">
          <span className="brief-kicker">{isAr ? 'ملخص بصري' : 'Selected cinematic work'}</span>
          <h2>{siteDesc || (isAr ? 'تصوير فيديو احترافي' : 'Cinematic video work for brands, people, and places.')}</h2>
          <p>
            {isAr
              ? `مجموعة منظمة من أعمال ${settings?.location || 'دبي'} مع فئات واضحة وروابط سريعة للمشاهدة.`
              : 'Cinematic storytelling, curated reels, and a direct path to the work that best fits the brief.'}
          </p>
        </div>
        <div className="brief-stats" aria-label="Portfolio highlights">
          {signals.map(signal => (
            <div className="brief-stat" key={signal.label}>
              <strong>{signal.value}</strong>
              <span>{signal.label}</span>
            </div>
          ))}
        </div>
        <div className="brief-routing" aria-label="Quick routes">
          <a href="#portfolio">View work</a>
          <a href="#contact">Book a shoot</a>
          <span>{latestYear} / {settings?.location || 'Dubai, UAE'}</span>
        </div>
      </div>
    </section>
  );
}

// ==================== SPOTLIGHT (REEL OF THE MONTH) ====================

function SpotlightSection({ item, categories, onOpen, isAr, suspendPlayback = false }) {
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  const rawCat = categories.find(c => c.id === item.category_id);
  const cat = rawCat && isNarrativesCategory(rawCat)
    ? { ...rawCat, name: 'Narratives' }
    : rawCat;
  const thumb = getThumbnail(item);
  const year = item.created_at ? new Date(item.created_at).getFullYear() : null;
  const spotlightSummary = (item.description || '').split(/\n{2,}|\n/)[0].trim();
  const isDirectVideo = item.video_type === 'direct' && item.video_url;
  const videoUrl = isDirectVideo ? resolveUrl(item.video_url, 'video') : null;

  // Auto-play featured video muted when in view
  useEffect(() => {
    if (!videoRef.current || !isDirectVideo) return;
    const v = videoRef.current;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.3 });
    obs.observe(v);
    return () => obs.disconnect();
  }, [isDirectVideo, videoUrl]);

  useEffect(() => {
    if (!sectionRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from('.spotlight-frame-inner', {
        scale: 1.05,
        opacity: 0,
        duration: 1.6,
        ease: 'expo.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 80%', toggleActions: 'play none none reverse' },
      });
      gsap.from('.spotlight-meta-row', {
        y: 30,
        opacity: 0,
        duration: 0.9,
        stagger: 0.1,
        ease: 'expo.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', toggleActions: 'play none none reverse' },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section className="spotlight-section" ref={sectionRef} aria-label="Reel of the month">
      <div className="spotlight-header">
        <span className="spotlight-chapter">02 — {isAr ? 'في الواجهة' : 'Spotlight'}</span>
        <span className="spotlight-now-playing">{isAr ? '— يعرض الآن —' : '— Now Playing —'}</span>
      </div>
      <button
        type="button"
        className="spotlight-frame"
        onClick={() => onOpen(item)}
        aria-label={`Play ${item.title}`}
      >
        {isDirectVideo && !suspendPlayback ? (
          <video
            ref={videoRef}
            key={videoUrl}
            src={videoUrl}
            poster={thumb || undefined}
            muted
            loop
            playsInline
            preload="none"
            className="spotlight-frame-inner spotlight-frame-video"
          />
        ) : (
          <div
            className="spotlight-frame-inner"
            style={thumb ? { backgroundImage: `url(${thumb})` } : {}}
          />
        )}
        <span className="spotlight-frame-shade" aria-hidden="true" />
        <span className="spotlight-play-icon" aria-hidden="true">
          <span className="spotlight-play-glyph">▶</span>
        </span>
      </button>
      <div className="spotlight-info">
        <div className="spotlight-meta-row spotlight-credits">
          {cat && <span className="spotlight-credit-chip">{cat.name}</span>}
          {year && <span className="spotlight-credit-chip">{year}</span>}
        </div>
        <h2 className="spotlight-meta-row spotlight-title-new">{item.title}</h2>
        {spotlightSummary && <p className="spotlight-meta-row spotlight-desc-new">{spotlightSummary}</p>}
        <div className="spotlight-meta-row">
          <button type="button" className="featured-cta" onClick={() => onOpen(item)}>
            <span>{isAr ? 'مشاهدة' : 'Watch Reel'}</span>
            <span className="featured-cta-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}

// ==================== EVENT FILMS RAIL ====================

const CURATED_EVENT_IDS = [64, 71, 67, 77, 47, 22, 57, 82, 93, 52];
const INITIAL_VISIBLE_PROJECTS = 15;

function EventsSection({ portfolio, categories, onOpen, isAr }) {
  const railRef = useRef(null);
  const eventCategory = categories.find(category => category.slug === 'events');
  const eventItems = eventCategory
    ? portfolio.filter(item => item.category_id === eventCategory.id)
    : [];
  const eventItemsById = new Map(eventItems.map(item => [item.id, item]));
  const curatedItems = CURATED_EVENT_IDS.map(id => eventItemsById.get(id)).filter(Boolean);
  const curatedIds = new Set(curatedItems.map(item => item.id));
  const items = [...curatedItems, ...eventItems.filter(item => !curatedIds.has(item.id))].slice(0, 10);
  if (items.length === 0) return null;

  const scrollRail = direction => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(320, rail.clientWidth * 0.72), behavior: 'smooth' });
  };

  return (
    <section className="events-rail-section fade-in-section" aria-labelledby="events-heading">
      <span className="events-watermark" aria-hidden="true">LIVE</span>
      <div className="events-rail-header">
        <div className="events-heading-wrap">
          <span className="events-eyebrow">{isAr ? 'أفلام الفعاليات' : 'Event films'}</span>
          <h2 className="events-title" id="events-heading">
            {isAr ? 'حيث تتحول اللحظة إلى قصة.' : <>Where moments<br /><em>become stories.</em></>}
          </h2>
        </div>
        <div className="events-header-aside">
          <p>{isAr ? 'طاقة الحدث، الحضور، والتفاصيل — محفوظة في أفلام سينمائية.' : 'Energy, atmosphere, and every defining detail—preserved in cinematic motion.'}</p>
          <div className="events-rail-controls" aria-label={isAr ? 'التنقل بين أفلام الفعاليات' : 'Event film navigation'}>
            <button type="button" onClick={() => scrollRail(-1)} aria-label={isAr ? 'السابق' : 'Previous projects'}>←</button>
            <button type="button" onClick={() => scrollRail(1)} aria-label={isAr ? 'التالي' : 'Next projects'}>→</button>
          </div>
        </div>
      </div>
      <div className="events-rail-shell">
        <div className="events-rail" ref={railRef} aria-label={isAr ? 'أفلام فعاليات مختارة' : 'Selected event films'}>
          {items.map((item, index) => {
            const cat = categories.find(c => c.id === item.category_id);
            const thumb = getThumbnail(item);
            return (
              <button
                key={item.id}
                type="button"
                className={`events-rail-card${index === 0 ? ' events-rail-card--lead' : ''}`}
                onClick={() => onOpen(item)}
                style={{ '--event-index': index, ...(thumb ? { '--event-thumb': `url(${thumb})` } : {}) }}
                aria-label={`${isAr ? 'مشاهدة' : 'Watch'} ${item.title}`}
              >
                <span className="events-card-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="events-card-play" aria-hidden="true">↗</span>
                <span className="events-card-content">
                  <span className="events-card-tag">{cat?.name || (isAr ? 'فعاليات' : 'Events')}</span>
                  <strong className="events-card-title">{item.title}</strong>
                  <span className="events-card-watch">{isAr ? 'شاهد الفيلم' : 'Watch film'} <span>→</span></span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="events-rail-footer" aria-hidden="true">
          <span>{isAr ? 'اسحب للاستكشاف' : 'Drag to explore'}</span>
          <span className="events-rail-line" />
          <span>{String(items.length).padStart(2, '0')} {isAr ? 'أفلام' : 'films'}</span>
        </div>
      </div>
    </section>
  );
}

// ==================== VIDEO PLAYER ====================

function VideoPlayer({ url, poster }) {
  const [error, setError] = useState(false);
  const [started, setStarted] = useState(false);
  const videoRef = useRef(null);
  const startVideo = (e) => {
    e.stopPropagation();
    setStarted(true);
    videoRef.current?.play?.().catch(() => {});
  };
  return error ? (
    <div className="no-video" style={{ flexDirection: 'column', gap: '0.75rem', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '2rem' }}>⚠️</div>
      <p style={{ fontWeight: 600, color: 'var(--color-peach)' }}>Video file unavailable</p>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', maxWidth: '320px' }}>
        This file was lost when the server restarted. Set up <strong>Cloudinary</strong> in Render environment variables to prevent this, then re-upload.
      </p>
    </div>
  ) : (
    <>
      <video
        ref={videoRef}
        key={url}
        controls
        playsInline
        preload="metadata"
        poster={poster || undefined}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#000' }}
        onPlay={() => setStarted(true)}
        onError={() => setError(true)}
      >
        <source src={url} type="video/mp4" />
        <source src={url} type="video/webm" />
        <source src={url} type="video/quicktime" />
      </video>
      {poster && !started && (
        <button type="button" className="video-poster-overlay" onClick={startVideo} aria-label="Play video">
          <img src={poster} alt="" />
          <span aria-hidden="true">▶</span>
        </button>
      )}
    </>
  );
}

// ==================== VIDEO MODAL ====================

function VideoModal({ item, onClose, lang, whatsapp }) {
  const platform = item.video_type || detectPlatform(item.video_url);
  const isInstagram = platform === 'instagram';
  const embedUrl = isInstagram ? null : getEmbedUrl(item);
  const directUrl = item.video_type === 'direct' ? resolveUrl(item.video_url, 'video') : null;
  const isEmbed = item.video_type === 'embed';
  const padding = getAspectPadding(item.aspect_ratio || '16:9');
  const modalPoster = getPortfolioShareImageUrl(item);
  const bts = item.bts_photos ? JSON.parse(item.bts_photos) : [];
  const collabs = parseCollaborators(item.collaborators);
  const [btsIndex, setBtsIndex] = useState(null);
  const btsCount = bts.length;
  const btsOpen = btsIndex !== null && btsIndex >= 0 && btsIndex < btsCount;
  const year = item.created_at ? new Date(item.created_at).getFullYear() : null;
  const platformLabel = PLATFORMS[platform]?.label || 'Video';
  const isBtsVideo = (url) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url || '');
  const closeBts = () => setBtsIndex(null);
  const prevBts = () => setBtsIndex(i => (i - 1 + btsCount) % btsCount);
  const nextBts = () => setBtsIndex(i => (i + 1) % btsCount);

  useEffect(() => {
    const h = (e) => {
      if (btsOpen) {
        if (e.key === 'Escape') closeBts();
        else if (e.key === 'ArrowLeft') prevBts();
        else if (e.key === 'ArrowRight') nextBts();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, btsOpen, btsCount]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content project-modal${(item.aspect_ratio === '9:16' || item.aspect_ratio === '1:1') ? ' modal-vertical project-modal--vertical' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="project-modal-stage">
          <div className="video-wrapper" style={{ paddingTop: padding }}>
            {isInstagram && (
              <div className="instagram-card">
                {item.thumbnail_url && <img src={resolveUrl(item.thumbnail_url)} alt={item.title} />}
                <div className="instagram-card-content">
                  <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                    <defs><radialGradient id="ig" cx="30%" cy="107%" r="150%"><stop offset="0%" stopColor="#fdf497"/><stop offset="5%" stopColor="#fdf497"/><stop offset="45%" stopColor="#fd5949"/><stop offset="60%" stopColor="#d6249f"/><stop offset="90%" stopColor="#285AEB"/></radialGradient></defs>
                    <rect width="24" height="24" rx="6" fill="url(#ig)"/>
                    <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="1.5" fill="none"/>
                    <circle cx="17.5" cy="6.5" r="1" fill="white"/>
                  </svg>
                  <p>Instagram doesn't allow embedded playback</p>
                  <a href={item.video_url} target="_blank" rel="noreferrer">Watch on Instagram ↗</a>
                </div>
              </div>
            )}
            {!isInstagram && embedUrl && <iframe src={embedUrl} title={item.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />}
            {directUrl && <VideoPlayer url={directUrl} poster={modalPoster} />}
            {isEmbed && item.embed_code && <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.embed_code, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'src'] }) }} style={{ position: 'absolute', inset: 0 }} />}
            {!isInstagram && !embedUrl && !directUrl && !isEmbed && <div className="no-video">{item.video_url ? <a href={item.video_url} target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: 'none' }}>Watch on {PLATFORMS[item.video_type]?.label || 'Platform'} ↗</a> : 'No video'}</div>}
          </div>
        </div>
        <div className="modal-info project-modal-info">
          <div className="project-modal-kicker">
            <span>{platformLabel}</span>
            {year && <span>{year}</span>}
            {item.aspect_ratio && <span>{item.aspect_ratio}</span>}
          </div>
          <div className="modal-title-row">
            <h3>{item.title}</h3>
            <TranslateToggle text={item.title} />
          </div>
          {item.description && (
            <div className="modal-desc-wrap">
              <p>{item.description}</p>
              <TranslateToggle text={item.description} />
            </div>
          )}
          <div className="project-modal-actions">
            {item.video_url && <a href={item.video_url} target="_blank" rel="noreferrer">Open source ↗</a>}
            {whatsapp ? (
              <a 
                href={`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('I want to book a project like "' + item.title + '"')}`} 
                target="_blank" 
                rel="noreferrer" 
                className="btn-primary whatsapp-book-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#25D366', color: '#fff', border: 'none', padding: '0.75rem 1.25rem', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold' }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Book a project like this via WhatsApp
              </a>
            ) : (
              <a href="#contact" onClick={onClose} className="btn-primary">Start a project →</a>
            )}
          </div>
          {collabs.length > 0 && (
            <div className="modal-collaborators">
              <span className="modal-section-label">Credits</span>
              {collabs.map((c, i) => {
                const clean = (c.handle || c).replace('@', '');
                return (
                  <a key={i} href={collabLinkHref(c)} target="_blank" rel="noreferrer" className="modal-collab-chip">
                    <span className="modal-collab-handle">@{clean}</span>
                    {c.role && <span className="modal-collab-role">{c.role}</span>}
                    {c.url && !/instagram\.com/i.test(c.url) && <span className="modal-collab-role">{collabPlatformLabel(c)}</span>}
                  </a>
                );
              })}
            </div>
          )}
          {bts.length > 0 && (
            <div className="bts-strip">
              <p className="bts-label">{lang === 'ar' ? 'خلف الكواليس' : 'Behind the Scenes'}</p>
              <div className="bts-thumbs">
                {bts.map((url, i) => (
                  <div key={i} className="bts-thumb-wrap" onClick={() => setBtsIndex(i)}>
                    {isBtsVideo(url) ? (
                      <>
                        <video src={resolveUrl(url)} muted playsInline preload="metadata" />
                        <span className="bts-thumb-play">▶</span>
                      </>
                    ) : (
                      <img src={resolveUrl(url)} alt={`BTS ${i + 1}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {btsOpen && (
        <div className="bts-fullscreen" onClick={closeBts}>
          <button className="bts-close" onClick={e => { e.stopPropagation(); closeBts(); }} aria-label="Close">✕</button>
          {btsCount > 1 && (
            <button className="bts-nav bts-prev" onClick={e => { e.stopPropagation(); prevBts(); }} aria-label="Previous">‹</button>
          )}
          {isBtsVideo(bts[btsIndex]) ? (
            <video key={bts[btsIndex]} src={resolveUrl(bts[btsIndex])} controls autoPlay playsInline onClick={e => e.stopPropagation()} />
          ) : (
            <img src={resolveUrl(bts[btsIndex])} alt={`BTS ${btsIndex + 1}`} onClick={e => e.stopPropagation()} />
          )}
          {btsCount > 1 && (
            <button className="bts-nav bts-next" onClick={e => { e.stopPropagation(); nextBts(); }} aria-label="Next">›</button>
          )}
          {btsCount > 1 && <div className="bts-counter">{btsIndex + 1} / {btsCount}</div>}
        </div>
      )}
    </div>
  );
}

// ==================== LEAVE REVIEW FORM ====================

function LeaveReviewForm({ lang, isAr }) {
  const autoOpen = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('leave-review') === '1';
  const [open, setOpen] = useState(autoOpen);
  const [form, setForm] = useState({ name: '', role: '', text: '', rating: 5 });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.submitTestimonialPublic(form);
      setSubmitted(true);
    } catch { setSubmitted(true); }
    finally { setLoading(false); }
  };

  if (submitted) return (
    <div className="review-thanks">
      <p>🙏 {isAr ? 'شكراً! سيتم مراجعة تعليقك قريباً.' : 'Thank you! Your review is pending approval.'}</p>
    </div>
  );

  return (
    <div className="leave-review-wrap">
      {!open ? (
        <button className="btn-secondary" onClick={() => setOpen(true)}>
          ⭐ {isAr ? 'اترك تقييمك' : 'Leave a Review'}
        </button>
      ) : (
        <form className="leave-review-form" onSubmit={handleSubmit}>
          <h3>{isAr ? 'شاركنا تجربتك' : 'Share Your Experience'}</h3>
          <input type="text" placeholder={isAr ? 'اسمك *' : 'Your Name *'} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <input type="text" placeholder={isAr ? 'المسمى الوظيفي (اختياري)' : 'Your Role (optional)'} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
          <div className="star-picker">
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button" onClick={() => setForm({ ...form, rating: n })}
                style={{ fontSize: '1.6rem', background: 'none', border: 'none', cursor: 'pointer', color: n <= form.rating ? '#FFA781' : '#444', transition: 'color 0.15s' }}>★</button>
            ))}
          </div>
          <textarea placeholder={isAr ? 'رأيك *' : 'Your review *'} value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} required />
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? '…' : isAr ? 'إرسال' : 'Submit'}</button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ==================== PUBLIC SITE ====================

function PublicSite() {
  const lang = 'en';
  const isAr = false;
  const [categories, setCategories] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeCategory, setActiveCategory] = useState(() => new URLSearchParams(window.location.search).get('cat') || 'all');
  const [sort, setSort] = useState('latest');
  const [selectedItem, setSelectedItem] = useState(null);
  const [likedItems, setLikedItems] = useState(() => JSON.parse(localStorage.getItem('liked_items') || '{}'));
  const [reactedItems, setReactedItems] = useState(() => JSON.parse(localStorage.getItem('reacted_items') || '{}'));
  const [reactions, setReactions] = useState({});
  const [loading, setLoading] = useState(true);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '', service: '', source: '' });
  const [contactSent, setContactSent] = useState(false);
  const [qrItem, setQrItem] = useState(null);
  const [hoveredVideo, setHoveredVideo] = useState(null);
  const [clientLogos, setClientLogos] = useState([]);
  const [activeSection, setActiveSection] = useState('');
  const [visibleProjectCount, setVisibleProjectCount] = useState(INITIAL_VISIBLE_PROJECTS);

  useEffect(() => {
    api.trackVisit();
    Promise.all([
      api.getCategories().catch(() => []),
      api.getPortfolio().catch(() => []),
      api.getSettings().catch(() => null),
      api.getTestimonials().catch(() => []),
      api.getClientLogos().catch(() => []),
    ])
      .then(([cats, items, sett, tests, logos]) => {
        const publicItems = Array.isArray(items)
          ? items.filter(item => !UNAVAILABLE_PUBLIC_PORTFOLIO_IDS.has(Number(item.id)))
          : [];
        setCategories(sortCategoriesForDisplay(cats || [])); setPortfolio(publicItems);
        setSettings(sett); setTestimonials(tests || []);
        setClientLogos(mergeWorkedWithLogos(logos));
      }).finally(() => setLoading(false));
  }, []);

  // If URL is ?item=ID, auto-open that portfolio item's modal
  useEffect(() => {
    if (loading) return;
    const itemId = new URLSearchParams(window.location.search).get('item');
    if (!itemId) return;
    const found = portfolio.find(p => String(p.id) === String(itemId));
    if (found) {
      setSelectedItem(found);
      api.trackVideoView(found.id);
    }
  }, [loading, portfolio]);

  // If URL is ?leave-review=1, scroll to testimonials after content settles
  useEffect(() => {
    const wantsReview = new URLSearchParams(window.location.search).get('leave-review') === '1';
    if (!wantsReview || loading) return;
    const scrollToReview = () => {
      const el = document.getElementById('testimonials');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    // Multiple attempts — layout shifts as images/iframes load
    const t1 = setTimeout(scrollToReview, 300);
    const t2 = setTimeout(scrollToReview, 900);
    const t3 = setTimeout(scrollToReview, 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [loading]);

  // Apply custom theme colors from settings
  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    if (settings.color_primary)    root.style.setProperty('--color-peach',  settings.color_primary);
    if (settings.color_background) root.style.setProperty('--color-dark',   settings.color_background);
    if (settings.color_surface)    root.style.setProperty('--color-maroon', settings.color_surface);
    if (settings.color_text)       root.style.setProperty('--color-light',  settings.color_text);
  }, [settings]);

  useEffect(() => {
    if (settings?.ga_tracking_id) {
      const s = document.createElement('script');
      s.src = `https://www.googletagmanager.com/gtag/js?id=${settings.ga_tracking_id}`;
      s.async = true; document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function() { window.dataLayer.push(arguments); };
      window.gtag('js', new Date()); window.gtag('config', settings.ga_tracking_id);
    }
  }, [settings?.ga_tracking_id]);

  // Scroll-triggered fade-ins — reveal once and stay visible even as sections grow.
  useEffect(() => {
    const obs = new IntersectionObserver((entries, observer) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
    document.querySelectorAll('.fade-in-section').forEach(el => obs.observe(el));
    // Reveal anything already on-screen at load (top of page) so it's not stuck hidden
    requestAnimationFrame(() => {
      document.querySelectorAll('.fade-in-section').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.85 && r.bottom > 0) el.classList.add('visible');
      });
    });
    return () => obs.disconnect();
  }, [portfolio, settings?.about_text, testimonials.length]);

  // Lenis smooth scroll + GSAP ScrollTrigger sync (cinematic weighted scroll)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false,
    });
    const onScroll = () => ScrollTrigger.update();
    lenis.on('scroll', onScroll);
    const raf = (time) => { lenis.raf(time * 1000); };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  // GSAP ScrollTrigger section reveals (Lenis synced above)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Hand off ghost-watermark vertical centering to GSAP so x-parallax doesn't clobber it
    gsap.set('.ghost-watermark', { yPercent: -50 });
    const ctx = gsap.context(() => {
      // Cinematic brief — copy stagger then stat cards then routing links
      gsap.from('.brief-copy > *', {
        y: 28, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'expo.out',
        scrollTrigger: { trigger: '.cinematic-brief', start: 'top 82%', toggleActions: 'play none none none' },
      });
      gsap.from('.brief-stat', {
        y: 24, opacity: 0, scale: 0.94, duration: 0.75, stagger: 0.09, ease: 'expo.out',
        scrollTrigger: { trigger: '.brief-stats', start: 'top 85%', toggleActions: 'play none none none' },
      });
      gsap.from('.brief-routing > *', {
        y: 14, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out',
        scrollTrigger: { trigger: '.brief-routing', start: 'top 92%', toggleActions: 'play none none none' },
      });

      // About is optional; only register animations when the section exists.
      if (document.querySelector('.about-section')) {
        gsap.from('.about-img-wrap', {
          x: -50, opacity: 0, duration: 1.1, ease: 'expo.out',
          scrollTrigger: { trigger: '.about-section', start: 'top 78%', toggleActions: 'play none none none' },
        });
        gsap.from('.about-text > *', {
          y: 28, opacity: 0, duration: 0.85, stagger: 0.1, ease: 'expo.out',
          scrollTrigger: { trigger: '.about-section', start: 'top 78%', toggleActions: 'play none none none' },
        });
      }

      // Testimonials — title animates; cards render naturally (no opacity gate to avoid async-data timing issues)
      gsap.from('.testimonials-section .section-title', {
        y: 28, opacity: 0, duration: 0.85, ease: 'expo.out',
        scrollTrigger: { trigger: '.testimonials-section', start: 'top 82%', toggleActions: 'play none none none' },
      });

      // Contact — title, details stagger from left, form fields stagger up
      gsap.from('.contact-section .section-title', {
        y: 28, opacity: 0, duration: 0.85, ease: 'expo.out',
        scrollTrigger: { trigger: '.contact-section', start: 'top 82%', toggleActions: 'play none none none' },
      });
      gsap.from('.contact-details > *', {
        x: -28, opacity: 0, duration: 0.75, stagger: 0.07, ease: 'expo.out',
        scrollTrigger: { trigger: '.contact-section', start: 'top 78%', toggleActions: 'play none none none' },
      });
      gsap.from('.contact-form > *', {
        y: 20, opacity: 0, duration: 0.6, stagger: 0.06, ease: 'power3.out',
        scrollTrigger: { trigger: '.contact-section', start: 'top 78%', toggleActions: 'play none none none' },
      });

      // Ghost watermarks — slow scrub parallax drift left/right as section scrolls past
      gsap.utils.toArray('.ghost-watermark--left').forEach(el => {
        gsap.to(el, {
          x: -60, ease: 'none',
          scrollTrigger: { trigger: el.closest('section'), start: 'top bottom', end: 'bottom top', scrub: 2 },
        });
      });
      gsap.utils.toArray('.ghost-watermark--right').forEach(el => {
        gsap.to(el, {
          x: 60, ease: 'none',
          scrollTrigger: { trigger: el.closest('section'), start: 'top bottom', end: 'bottom top', scrub: 2 },
        });
      });
    });
    // Recalculate ScrollTrigger positions after React paints the updated DOM
    // (needed when testimonials/portfolio load async and cards weren't in the DOM on first run)
    const rafId = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => { cancelAnimationFrame(rafId); ctx.revert(); };
  }, [portfolio, settings?.about_text, testimonials.length]);

  // Mobile card video scroll-play
  const isMobileDevice = useRef(window.matchMedia('(hover: none) and (pointer: coarse)').matches).current;
  useEffect(() => {
    if (!isMobileDevice) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const v = e.target;
        if (e.isIntersecting) { v.playbackRate = 1.5; v.play().catch(() => {}); }
        else { v.pause(); v.currentTime = 0; }
      });
    }, { threshold: 0.5 });
    const attach = () => {
      document.querySelectorAll('.card-mobile-video').forEach(v => obs.observe(v));
    };
    attach();
    return () => obs.disconnect();
  }, [isMobileDevice, portfolio, sort, activeCategory]);

  // Card stagger — animates immediately on load, cards are ready before user scrolls there
  useEffect(() => {
    if (!portfolio.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = document.querySelectorAll('.portfolio-masonry .video-card');
    if (!cards.length) return;
    if (isMobileDevice) {
      gsap.set(cards, { opacity: 1, y: 0, clearProps: 'transform' });
      return;
    }
    gsap.fromTo(cards, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', stagger: 0.06 });
  }, [portfolio, sort, activeCategory, visibleProjectCount, isMobileDevice]);

  // Scroll progress bar — direct scroll listener
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bar = document.querySelector('.scroll-progress');
    if (!bar) return;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? window.scrollY / max : 0;
      bar.style.transform = `scaleX(${pct})`;
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, []);

  // Section nav highlight
  useEffect(() => {
    const ids = ['portfolio', 'about', 'testimonials', 'contact'];
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id); });
    }, { threshold: 0.25 });
    ids.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [portfolio, settings?.about_text, testimonials.length]);

  // Auto-apply dir="auto" to all text elements so Arabic content flows RTL
  useEffect(() => {
    const sel = '.public-site h1, .public-site h2, .public-site h3, .public-site h4, .public-site h5, .public-site h6, .public-site p, .public-site li, .public-site label, .public-site blockquote, .public-site figcaption';
    document.querySelectorAll(sel).forEach(el => { if (!el.hasAttribute('dir')) el.setAttribute('dir', 'auto'); });
  }, [portfolio, testimonials, settings, selectedItem]);

  const sortedPortfolio = [...portfolio].sort((a, b) => {
    if (sort === 'featured') return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const publicCategoryGroups = categories.reduce((groups, cat) => {
    if (isNarrativesCategory(cat)) {
      const existing = groups.find(group => group.slug === NARRATIVES_CATEGORY_SLUG);
      if (existing) existing.ids.push(cat.id);
      else groups.push({
        id: NARRATIVES_CATEGORY_SLUG,
        ids: [cat.id],
        name: 'Narratives',
        slug: NARRATIVES_CATEGORY_SLUG,
        aliases: NARRATIVES_CATEGORY_ALIASES,
      });
      return groups;
    }
    groups.push({ id: cat.id, ids: [cat.id], name: cat.name, slug: cat.slug });
    return groups;
  }, []);
  const activeGroup = publicCategoryGroups.find(group => isActivePublicCategory(group, activeCategory));
  const filteredItems = !activeGroup ? sortedPortfolio
    : sortedPortfolio.filter(item => activeGroup.ids.includes(item.category_id));
  const visiblePortfolioItems = filteredItems.slice(0, visibleProjectCount);
  const remainingProjectCount = Math.max(0, filteredItems.length - visiblePortfolioItems.length);

  useEffect(() => {
    setVisibleProjectCount(INITIAL_VISIBLE_PROJECTS);
  }, [activeCategory, sort]);
  const categoryCounts = portfolio.reduce((counts, item) => {
    counts[item.category_id] = (counts[item.category_id] || 0) + 1;
    return counts;
  }, {});
  const publicCategoryGroupsWithThumbs = publicCategoryGroups.map(group => {
    const groupCategories = categories.filter(c => group.ids.includes(c.id));
    const selectedCoverItem = groupCategories
      .map(cat => portfolio.find(item => item.id === Number(parseCategoryMeta(cat).cover_portfolio_id) && group.ids.includes(item.category_id)))
      .find(Boolean);
    if (selectedCoverItem) {
      return {
        ...group,
        thumb: getThumbnail(selectedCoverItem),
        coverVideoUrl: selectedCoverItem.video_type === 'direct' && selectedCoverItem.video_url
          ? resolveUrl(selectedCoverItem.video_url, 'video')
          : null,
      };
    }
    const catData = groupCategories.find(c => parseCategoryMeta(c).thumbnail_url);
    const catThumb = catData ? parseCategoryMeta(catData).thumbnail_url : null;
    if (catThumb) return { ...group, thumb: catThumb, coverVideoUrl: null };
    const groupItems = portfolio.filter(item => group.ids.includes(item.category_id));
    const heroItem = groupItems.find(item => item.featured && getThumbnail(item)) || groupItems.find(item => getThumbnail(item));
    return { ...group, thumb: heroItem ? getThumbnail(heroItem) : null, coverVideoUrl: null };
  });
  const publicCategoryById = publicCategoryGroupsWithThumbs.reduce((map, group) => {
    group.ids.forEach(id => { map[id] = group; });
    return map;
  }, {});

  const reelOfMonth = settings?.reel_of_month_id ? portfolio.find(p => p.id === settings.reel_of_month_id) : null;

  const siteTitle = isAr && settings?.site_title_ar ? settings.site_title_ar : (settings?.site_title || 'Mahmoud Adel');
  const siteDesc = isAr && settings?.site_description_ar ? settings.site_description_ar : (settings?.site_description || 'Professional Videographer');
  const heroImg = settings?.hero_image ? resolveUrl(settings.hero_image) : '';
  const heroPortfolioItem =
    portfolio.find(p => isHeroPortfolioItem(p) && p.video_type === 'direct' && p.video_url) ||
    portfolio.find(p => p.featured && p.video_type === 'direct' && p.video_url) ||
    portfolio.find(p => isHeroPortfolioItem(p)) ||
    portfolio.find(p => p.featured);
  const showreelEmbed = getShowreelEmbed(settings?.showreel_url);

  const handleLike = (e, item) => {
    e.stopPropagation();
    if (likedItems[item.id]) return;
    api.likePortfolio(item.id).then(res => {
      const updated = { ...likedItems, [item.id]: true };
      setLikedItems(updated); localStorage.setItem('liked_items', JSON.stringify(updated));
      setPortfolio(prev => prev.map(p => p.id === item.id ? { ...p, likes: res.likes } : p));
    });
  };

  const handleReact = (itemId, reaction) => {
    if (reactedItems[itemId]) return;
    api.reactToPortfolio(itemId, reaction).then(res => {
      const updated = { ...reactedItems, [itemId]: reaction };
      setReactedItems(updated); localStorage.setItem('reacted_items', JSON.stringify(updated));
      setReactions(prev => ({ ...prev, [itemId]: res }));
      setPortfolio(prev => prev.map(p => p.id === itemId ? { ...p, reactions: JSON.stringify(res) } : p));
    });
  };

  const handleShare = (e, item) => {
    e.stopPropagation();
    const url = getPortfolioShareUrl(item);
    if (navigator.share) { navigator.share({ title: item.title, url }); }
    else { navigator.clipboard.writeText(url); }
  };

  const handleContact = async (e) => {
    e.preventDefault();
    try { await api.submitContact(contactForm); } catch {}
    const subject = encodeURIComponent(`Portfolio Inquiry from ${contactForm.name}${contactForm.service ? ` — ${contactForm.service}` : ''}`);
    const body = encodeURIComponent(`Name: ${contactForm.name}\nEmail: ${contactForm.email}\nService: ${contactForm.service}\n\n${contactForm.message}`);
    window.open(`mailto:${settings?.email || ''}?subject=${subject}&body=${body}`);
    setContactSent(true); setTimeout(() => setContactSent(false), 4000);
  };

  const openItem = (item) => {
    setSelectedItem(item);
    api.trackVideoView(item.id);
  };

  if (settings?.maintenance_mode) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>{isAr ? 'الموقع تحت الصيانة' : 'Under Maintenance'}</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>{isAr ? 'نعود قريباً' : 'We\'ll be back soon'}</p>
      </div>
    </div>
  );

  return (
    <div id="top" className={`public-site${settings?.about_text ? ' has-about' : ''}`} dir="auto">
      <div className="scroll-progress" aria-hidden="true" />
      <header className="public-header">
        <div className="header-inner">
          <a href="#top" className="site-logo">
            <img src={BRAND_LOGO_WHITE_SRC} alt={siteTitle} className="header-logo-img" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
            <span style={{ display: 'none' }}>{siteTitle}</span>
          </a>
          <nav className="header-nav">
            <a href="#portfolio" className={activeSection === 'portfolio' ? 'nav-active' : ''}>Work</a>
            {settings?.about_text && <a href="#about" className={activeSection === 'about' ? 'nav-active' : ''}>About</a>}
            {testimonials.length > 0 && <a href="#testimonials" className={activeSection === 'testimonials' ? 'nav-active' : ''}>Reviews</a>}
            <a href="#contact" className={activeSection === 'contact' ? 'nav-active' : ''}>Contact</a>
            {settings?.whatsapp && (
              <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="nav-whatsapp" style={{ color: '#25D366' }} title="WhatsApp">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{ verticalAlign: 'middle' }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
            )}
          </nav>
        </div>
      </header>

      <HeroMasthead
        settings={settings}
        heroImg={heroImg}
        siteTitle={siteTitle}
        featuredItem={heroPortfolioItem}
        isAr={isAr}
        suspendPlayback={Boolean(selectedItem)}
      />

      <CinematicBrief
        portfolio={portfolio}
        settings={settings}
        siteDesc={siteDesc}
        isAr={isAr}
      />

      {clientLogos.length > 0 && (
        <section className="client-logos-bar fade-in-section" aria-label={isAr ? 'عملت مع' : 'Worked with'}>
          <div className="client-logos-label">{isAr ? 'عملت مع' : 'WORKED WITH'}</div>
          <div className="client-logos-marquee">
            <div className="client-logos-track">
              {[...clientLogos, ...clientLogos].map((logo, i) => {
                const content = logo.image_url
                  ? <img src={resolveUrl(logo.image_url)} alt={logo.name} title={logo.name} loading="lazy" />
                  : <span className="client-logo-text">{logo.name}</span>;
                const className = logo.image_url ? 'client-logo' : 'client-logo client-logo--text';
                return logo.link_url
                  ? <a key={`${logo.id}-${i}`} href={logo.link_url} target="_blank" rel="noopener noreferrer" className={className}>{content}</a>
                  : <div key={`${logo.id}-${i}`} className={className}>{content}</div>;
              })}
            </div>
          </div>
        </section>
      )}

      {reelOfMonth && (
        <SpotlightSection item={reelOfMonth} categories={categories} onOpen={openItem} isAr={isAr} suspendPlayback={Boolean(selectedItem)} />
      )}

      <EventsSection portfolio={portfolio} categories={categories} onOpen={openItem} isAr={isAr} />

      <section className="portfolio-section fade-in-section" id="portfolio">
        <span className="ghost-watermark ghost-watermark--right" aria-hidden="true">WORK</span>
        <div className="section-inner">
          <div className="portfolio-header">
            <div>
              <h2 className="section-title">{isAr ? 'الأعمال المختارة' : 'Selected Work'}</h2>
              <p className="section-intro">
                {isAr ? 'مجموعة مختارة من الأفلام والريلز والأعمال البصرية.' : 'A curated selection of films, reels, and commissioned visual work.'}
              </p>
            </div>
            <div className="sort-tabs">
              {[['latest', isAr ? 'الأحدث' : 'Latest'], ['featured', isAr ? 'المميزة' : 'Featured']].map(([val, label]) => (
                <button key={val} className={sort === val ? 'tab-btn tab-active' : 'tab-btn'} onClick={() => setSort(val)}>{label}</button>
              ))}
            </div>
          </div>

          {categories.length > 0 && (
            <div className="category-preview-shell">
              <div className="category-preview-rail" aria-label={isAr ? 'تصنيفات الأعمال' : 'Work categories'}>
                <button
                  className={activeCategory === 'all' ? 'category-preview-card active' : 'category-preview-card'}
                  onClick={() => setActiveCategory('all')}
                >
                  <span className="category-preview-index">00</span>
                  <strong>{isAr ? 'الكل' : 'All work'}</strong>
                  <span>{portfolio.length} {isAr ? 'عمل' : portfolio.length === 1 ? 'project' : 'projects'}</span>
                </button>
                {publicCategoryGroupsWithThumbs
                  .map(cat => ({ ...cat, count: cat.ids.reduce((sum, id) => sum + (categoryCounts[id] || 0), 0) }))
                  .filter(cat => cat.count > 0)
                  .map((cat, index) => {
                  const { count } = cat;
                  return (
                  <button
                    key={cat.id}
                    className={isActivePublicCategory(cat, activeCategory) ? 'category-preview-card active' : 'category-preview-card'}
                    onClick={() => setActiveCategory(cat.slug)}
                    style={cat.thumb ? { '--category-thumb': `url(${cat.thumb})` } : undefined}
                  >
                    <span className="category-preview-index">{String(index + 1).padStart(2, '0')}</span>
                    <strong>{cat.name}</strong>
                    <span>
                      {count} {isAr ? 'عمل' : count === 1 ? 'project' : 'projects'}
                    </span>
                  </button>
                  );
                })}
              </div>
              <div className="category-swipe-cue" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          {loading ? (
            <div className="portfolio-masonry">
              {['16/9','9/16','16/9','4/3','16/9','9/16'].map((ratio, i) => (
                <div key={i} className="video-card">
                  <div className="card-thumb skeleton-block" style={{ aspectRatio: ratio, width: '100%', borderRadius: '3px' }} />
                  <div className="card-body">
                    <div className="skeleton-line" style={{ width: `${55 + (i % 3) * 15}%`, height: '1rem', marginBottom: '0.4rem' }} />
                    <div className="skeleton-line" style={{ width: `${35 + (i % 2) * 10}%`, height: '0.75rem' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="state-panel">
              <span>{isAr ? 'لا توجد أعمال هنا بعد' : 'No films in this cut yet'}</span>
              <p>{isAr ? 'جرّب فئة أخرى أو عد لاحقاً.' : 'Try another category, or come back for the next edit.'}</p>
            </div>
          ) : (
            <>
            <div className="portfolio-masonry">
              {visiblePortfolioItems.map(item => {
                const thumb = getThumbnail(item);
                const liked = likedItems[item.id];
                const platform = PLATFORMS[item.video_type || detectPlatform(item.video_url)];
                const isHovered = hoveredVideo === item.id;
                const isDirect = item.video_type === 'direct' && item.video_url;
                const cat = publicCategoryById[item.category_id] || categories.find(c => c.id === item.category_id);
                const cleanDescription = (item.description || '').trim();
                const showDescription = cleanDescription && !/^cinematic social media reel\.?$/i.test(cleanDescription);
                const cardYear = item.created_at ? new Date(item.created_at).getFullYear() : null;
                const cardCollaborators = parseCollaborators(item.collaborators);
                return (
                  <div key={item.id} className={`video-card${item.featured ? ' video-card--featured' : ''}`}
                    onClick={() => openItem(item)}
                    onMouseEnter={() => setHoveredVideo(item.id)}
                    onMouseLeave={() => setHoveredVideo(null)}
                  >
                    <div className="card-thumb" style={{ aspectRatio: (item.aspect_ratio || '16:9').replace(':', '/'), width: '100%', position: 'relative', overflow: 'hidden' }}>
                      {isDirect && isMobileDevice ? (
                        thumb ? (
                          <img src={thumb} alt={item.title} loading="lazy" className="card-mobile-poster" />
                        ) : (
                          <div className="thumb-placeholder card-mobile-poster">
                            <span style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>▶</span>
                            {platform && <span style={{ fontSize: '0.7rem', color: platform.color, fontWeight: 700, opacity: 0.8 }}>{platform.label}</span>}
                          </div>
                        )
                      ) : isDirect && isHovered && !selectedItem ? (
                        <video src={resolveUrl(item.video_url, 'video')} autoPlay muted loop playsInline preload="none" className="card-hover-video" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onLoadedData={e => { e.target.playbackRate = 1.5; }} />
                      ) : thumb ? (
                        <img src={thumb} alt={item.title} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div className="thumb-placeholder" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: platform ? `${platform.color}22` : undefined }}>
                          <span style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>▶</span>
                          {platform && <span style={{ fontSize: '0.7rem', color: platform.color, fontWeight: 700, opacity: 0.8 }}>{platform.label}</span>}
                        </div>
                      )}
                      <div className="play-overlay" style={{ position: 'absolute', inset: 0 }}><span>▶</span></div>
                      {cardYear && <span className="card-year-badge" aria-hidden="true">{cardYear}</span>}
                      <div className="card-thumb-meta">
                        {cat && <span>{cat.name}</span>}
                        {item.featured && <span>{isAr ? 'مميز' : 'Featured'}</span>}
                      </div>
                    </div>
                    <div className="card-body">
                      <h3>{item.title}</h3>
                      <TranslateToggle text={item.title} />
                      {cardCollaborators.length > 0 && (
                        <div className="card-collaborators" aria-label="Project credits">
                          <span className="card-collaborators-label">Credits</span>
                          {cardCollaborators.map((c, i) => {
                            const clean = (c.handle || c).replace('@', '');
                            return (
                              <a key={i} href={collabLinkHref(c)} target="_blank" rel="noreferrer" className="collab-tag" onClick={e => e.stopPropagation()}>
                                @{clean}{c.role && <span className="collab-tag-role"> · {c.role}</span>}
                              </a>
                            );
                          })}
                        </div>
                      )}
                      {showDescription && <p>{cleanDescription}</p>}
                      {showDescription && <TranslateToggle text={cleanDescription} />}
                      <div className="card-actions-row">
                        <button type="button" className="card-watch-link" onClick={() => openItem(item)}>
                          {isAr ? 'مشاهدة العمل' : 'Watch project'} <span aria-hidden="true">→</span>
                        </button>
                        <div className="card-btns">
                          <button className={`card-like-btn${liked ? ' liked' : ''}`} onClick={e => handleLike(e, item)}>
                            {liked ? '❤️' : '♡'}
                          </button>
                          <ReactionPicker itemId={item.id} userReaction={reactedItems[item.id]} onReact={handleReact} />
                          <button className="card-share-btn" onClick={e => handleShare(e, item)} title="Share">🔗</button>
                          <button className="card-share-btn" onClick={e => { e.stopPropagation(); setQrItem(item); }} title="QR Code">📱</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {remainingProjectCount > 0 && (
              <div className="portfolio-load-more-wrap">
                <button
                  type="button"
                  className="portfolio-load-more"
                  onClick={() => setVisibleProjectCount(count => count + INITIAL_VISIBLE_PROJECTS)}
                >
                  <span>{isAr ? 'عرض المزيد' : 'Load More Work'}</span>
                  <span className="portfolio-load-more-count">+{Math.min(INITIAL_VISIBLE_PROJECTS, remainingProjectCount)}</span>
                </button>
                <span className="portfolio-count-status">
                  {isAr
                    ? `${visiblePortfolioItems.length} من ${filteredItems.length}`
                    : `Showing ${visiblePortfolioItems.length} of ${filteredItems.length} projects`}
                </span>
              </div>
            )}
            </>
          )}
        </div>
      </section>

      {settings?.about_text && (
        <section className="about-section" id="about">
          <span className="ghost-watermark ghost-watermark--left" aria-hidden="true">ABOUT</span>
          <div className="section-inner about-inner">
            {settings.about_image && <div className="about-img-wrap"><img src={resolveUrl(settings.about_image)} alt={siteTitle} className="about-img" /></div>}
            <div className="about-text">
              <h2 className="section-title" style={{ textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'عني' : 'About'}</h2>
              <p>{isAr && settings.about_text_ar ? settings.about_text_ar : settings.about_text}</p>
            </div>
          </div>
        </section>
      )}

      <section className="testimonials-section" id="testimonials">
        <span className="ghost-watermark ghost-watermark--right" aria-hidden="true">REVIEWS</span>
        <div className="section-inner">
          <h2 className="section-title">{isAr ? 'آراء العملاء' : 'Client Reviews'}</h2>
          {testimonials.length > 0 && (
            <div className="testimonials-grid">
              {testimonials.map(t => (
                <div key={t.id} className="testimonial-card">
                  <div className="testimonial-stars">{'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}</div>
                  <p className="testimonial-text">"{t.text}"</p>
                  <div className="testimonial-author">
                    {t.photo_url && <img src={resolveUrl(t.photo_url)} alt={t.name} className="testimonial-photo" />}
                    <div>
                      <div className="testimonial-name">{t.name}</div>
                      {t.role && <div className="testimonial-role">{t.role}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <LeaveReviewForm lang={lang} isAr={isAr} />
        </div>
      </section>

      <section className="contact-section" id="contact">
        <span className="ghost-watermark ghost-watermark--left" aria-hidden="true">CONTACT</span>
        <div className="section-inner">
          <h2 className="section-title">{isAr ? 'تواصل معي' : 'Get In Touch'}</h2>
          <div className="contact-layout">
            <div className="contact-details">
              {settings?.email && <a href={`mailto:${settings.email}`} className="contact-item">✉ {settings.email}</a>}
              {settings?.phone && <span className="contact-item">📞 {settings.phone}</span>}
              {settings?.location && <span className="contact-item">📍 {settings.location}</span>}
              {settings?.whatsapp && (
                <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="whatsapp-contact-btn">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  {isAr ? 'تواصل عبر واتساب' : 'Chat on WhatsApp'}
                </a>
              )}
              <div className="social-links">
                {settings?.instagram && <a href={settings.instagram} target="_blank" rel="noreferrer" className="social-btn">Instagram</a>}
                {settings?.youtube && <a href={settings.youtube} target="_blank" rel="noreferrer" className="social-btn">YouTube</a>}
                {settings?.tiktok && <a href={settings.tiktok} target="_blank" rel="noreferrer" className="social-btn">TikTok</a>}
                {settings?.snapchat && <a href={settings.snapchat} target="_blank" rel="noreferrer" className="social-btn">Snapchat</a>}
                {settings?.linkedin && <a href={settings.linkedin} target="_blank" rel="noreferrer" className="social-btn">LinkedIn</a>}
              </div>
            </div>
            <form className="contact-form" onSubmit={handleContact}>
              {contactSent && <div className="success-message">✅ {isAr ? 'جاري فتح تطبيق البريد…' : 'Opening your email app…'}</div>}
              <input type="text" placeholder={isAr ? 'الاسم' : 'Your Name'} value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} required />
              <input type="email" placeholder={isAr ? 'البريد الإلكتروني' : 'Your Email'} value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} required />
              <select value={contactForm.service} onChange={e => setContactForm({ ...contactForm, service: e.target.value })}>
                <option value="">{isAr ? 'نوع الخدمة (اختياري)' : 'Service Type (optional)'}</option>
                {['Corporate Video', 'Wedding/Event', 'Social Media Content', 'Real Estate', 'Product Shoot', 'Documentary', 'Other'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={contactForm.source} onChange={e => setContactForm({ ...contactForm, source: e.target.value })}>
                <option value="">{isAr ? 'كيف وجدتني؟ (اختياري)' : 'How did you find me? (optional)'}</option>
                {['Instagram', 'TikTok', 'WhatsApp', 'Google', 'YouTube', 'Referral / Friend', 'Other'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <textarea placeholder={isAr ? 'رسالتك' : 'Your Message'} value={contactForm.message} onChange={e => setContactForm({ ...contactForm, message: e.target.value })} required />
              <button type="submit" className="btn-primary">{isAr ? 'إرسال' : 'Send Message'}</button>
            </form>
          </div>
        </div>
      </section>

      <div className="availability-ribbon" aria-label={isAr ? 'حالة التوفر' : 'Availability status'}>
        <span className="avail-dot" aria-hidden="true" />
        <span>{isAr ? 'متاح للمشاريع الجديدة' : 'Available for new projects'}</span>
        <span className="avail-divider" aria-hidden="true">·</span>
        <span>{settings?.location ? settings.location.split(',')[0] : 'Dubai'} &amp; Remote</span>
        <span className="avail-divider" aria-hidden="true">·</span>
        <a href="#contact">{isAr ? 'احجز جلسة' : 'Book a session'}</a>
      </div>

      <footer className="public-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <img src={BRAND_LOGO_WHITE_SRC} alt={siteTitle} className="footer-logo" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
            <span style={{ display: 'none' }}>{siteTitle}</span>
            <p className="footer-tagline">{siteDesc}</p>
          </div>
          <nav className="footer-nav" aria-label={isAr ? 'روابط التنقل' : 'Site navigation'}>
            <a href="#portfolio">{isAr ? 'الأعمال' : 'Work'}</a>
            {settings?.about_text && <a href="#about">{isAr ? 'عني' : 'About'}</a>}
            {testimonials.length > 0 && <a href="#testimonials">{isAr ? 'آراء العملاء' : 'Reviews'}</a>}
            <a href="#contact">{isAr ? 'تواصل' : 'Contact'}</a>
          </nav>
          <div className="footer-right">
            {settings?.location && <span className="footer-location">📍 {settings.location}</span>}
            <div className="footer-socials">
              {settings?.whatsapp && <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" title="WhatsApp" style={{ color: '#25D366' }}>WA</a>}
              {settings?.instagram && <a href={settings.instagram} target="_blank" rel="noreferrer">IG</a>}
              {settings?.youtube && <a href={settings.youtube} target="_blank" rel="noreferrer">YT</a>}
              {settings?.tiktok && <a href={settings.tiktok} target="_blank" rel="noreferrer">TT</a>}
              {settings?.linkedin && <a href={settings.linkedin} target="_blank" rel="noreferrer">LI</a>}
            </div>
          </div>
        </div>
        <div className="footer-strip">
          <span>© {new Date().getFullYear()} {siteTitle}. {isAr ? 'جميع الحقوق محفوظة' : 'All rights reserved.'}</span>
        </div>
      </footer>

      {settings?.whatsapp && (
        <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="whatsapp-float" aria-label="WhatsApp">
          <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </a>
      )}

      <CookieConsent lang={lang} />
      {selectedItem && <VideoModal item={selectedItem} onClose={() => setSelectedItem(null)} lang={lang} whatsapp={settings?.whatsapp} />}
      {qrItem && <QRModal url={getPortfolioShareUrl(qrItem)} title={qrItem.title} onClose={() => setQrItem(null)} />}
    </div>
  );
}

// Shared collaborator helpers (also used by the admin chunk)

function parseCollaborators(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  // Legacy: comma-separated handles
  return raw.split(',').map(h => ({ handle: h.trim(), role: '' })).filter(c => c.handle);
}

function collabLinkHref(c) {
  if (c.url) return c.url;
  const clean = (c.handle || '').replace('@', '');
  return clean ? `https://instagram.com/${clean}` : '#';
}

function collabPlatformLabel(c) {
  if (!c.url) return 'IG';
  if (/vimeo\.com/i.test(c.url)) return 'Vimeo';
  if (/instagram\.com/i.test(c.url)) return 'IG';
  if (/youtube\.com|youtu\.be/i.test(c.url)) return 'YT';
  return '↗';
}


// Admin/login/review/delivery routes load on demand so the public bundle stays small.
const loadAdmin = () => import('./admin');
const LoginPage = React.lazy(() => loadAdmin().then(m => ({ default: m.LoginPage })));
const AdminDashboard = React.lazy(() => loadAdmin().then(m => ({ default: m.AdminDashboard })));
const ReviewPortal = React.lazy(() => loadAdmin().then(m => ({ default: m.ReviewPortal })));
const DeliveryPage = React.lazy(() => loadAdmin().then(m => ({ default: m.DeliveryPage })));
const ReviewQRPage = React.lazy(() => loadAdmin().then(m => ({ default: m.ReviewQRPage })));

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const params = new URLSearchParams(window.location.search);
  const reviewToken = params.get('review');
  const deliveryToken = params.get('delivery');
  const qrMode = params.get('qr');
  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const isAdminRoute = normalizedPath === '/admin';
  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) manifestLink.setAttribute('href', isAdminRoute ? '/manifest-admin.json' : '/manifest.json');
    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle) appleTitle.setAttribute('content', isAdminRoute ? 'LM Admin' : 'Mahmoud Adel');
    document.title = isAdminRoute ? 'Lens Mania Admin' : 'Mahmoud Adel - Videographer';
  }, [isAdminRoute]);
  const goHome = () => { window.location.href = '/'; };
  const handleLogin = (t) => {
    setToken(t);
    if (!isAdminRoute) window.history.replaceState(null, '', '/admin');
  };
  const handleLogout = () => { localStorage.removeItem('token'); setToken(null); };

  let content = <PublicSite />;
  if (qrMode === 'review') content = <ReviewQRPage />;
  else if (deliveryToken) content = <DeliveryPage deliveryToken={deliveryToken} />;
  else if (reviewToken) content = <ReviewPortal reviewToken={reviewToken} />;
  else if (isAdminRoute && !token) content = <LoginPage onLogin={handleLogin} onBack={goHome} />;
  else if (isAdminRoute && token) content = <AdminDashboard token={token} onLogout={handleLogout} onBack={goHome} />;

  return (
    <>
      <React.Suspense fallback={null}>{content}</React.Suspense>
      <PwaUpdateToast />
    </>
  );
}

export {
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
};

export default App;
