import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DOMPurify from 'dompurify';
import './App.css';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
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
};

// Preserve these records in the admin/database, but do not advertise projects
// whose original Cloudinary video and thumbnail assets are no longer available.
const UNAVAILABLE_PUBLIC_PORTFOLIO_IDS = new Set([13, 14, 22]);

function resolveUrl(url, type = 'auto') {
  if (!url) return null;
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
    if (canvasRef.current) QRCode.toCanvas(canvasRef.current, url, { width: 256, color: { dark: '#5B0E2D', light: '#ffffff' } });
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
    ? resolveUrl(featuredItem.video_url, 'video')
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
          <div className="hero-topline">
            <span className="hero-topline-mark">
              {settings?.available_for_booking !== false
                ? (isAr ? 'متاح للحجز' : 'Available for booking')
                : (isAr ? 'محجوز حالياً' : 'Currently booked')}
            </span>
            <img src={BRAND_LOGO_WHITE_SRC} alt="" className="hero-logo-mark" aria-hidden="true" />
          </div>

          <div className="hero-name-wrap">
            <h1 className="hero-name">
              {firstName}
              {lastName && <span className="hero-name-em">{lastName}</span>}
            </h1>
            <span className="hero-rule" aria-hidden="true" />
          </div>

          <div className="hero-bottomline">
            <button type="button" className="hero-scroll-cue" onClick={scrollToNext}>
              <span className="hero-scroll-cue-line" aria-hidden="true" />
              <span>{isAr ? 'اكتشف الأعمال' : 'Scroll to explore'}</span>
            </button>
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
        <span className="spotlight-chapter">03 — {isAr ? 'في الواجهة' : 'Spotlight'}</span>
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

// ==================== COMMERCIAL & HEALTHCARE RAIL ====================

const COMMERCIAL_HEALTHCARE_IDS = [45, 46, 44, 42, 47, 22];

function CommercialHealthcareSection({ portfolio, categories, onOpen, isAr }) {
  const items = COMMERCIAL_HEALTHCARE_IDS
    .map(id => portfolio.find(p => p.id === id))
    .filter(Boolean);
  if (items.length === 0) return null;

  return (
    <section className="commercial-rail-section fade-in-section" aria-label={isAr ? 'شركاء طبيون وتجاريون' : 'Commercial & Healthcare Partners'}>
      <span className="ghost-watermark ghost-watermark--left" aria-hidden="true">CLINICS</span>
      <div className="section-inner">
        <h2 className="section-title">{isAr ? 'شركاء طبيون وتجاريون' : 'Commercial & Healthcare Partners'}</h2>
        <p className="section-intro">
          {isAr ? 'أعمال مختارة مع أبرز العيادات والعلامات التجارية.' : 'Curated films for leading clinics, brands, and events.'}
        </p>
      </div>
      <div className="commercial-rail-shell">
        <div className="commercial-rail" aria-label={isAr ? 'أعمال مختارة' : 'Featured commercial work'}>
          {items.map(item => {
            const cat = categories.find(c => c.id === item.category_id);
            const thumb = getThumbnail(item);
            return (
              <button
                key={item.id}
                type="button"
                className="commercial-rail-card"
                onClick={() => onOpen(item)}
                style={thumb ? { '--category-thumb': `url(${thumb})` } : undefined}
              >
                <span className="commercial-rail-meta">
                  {cat && <span className="commercial-rail-tag">{cat.name}</span>}
                </span>
                <strong className="commercial-rail-title">{item.title}</strong>
              </button>
            );
          })}
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

function VideoModal({ item, onClose, lang }) {
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
            <a href="#contact" onClick={onClose}>Start a project →</a>
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

      // About — image slides from left, text children stagger up (includes section title)
      gsap.from('.about-img-wrap', {
        x: -50, opacity: 0, duration: 1.1, ease: 'expo.out',
        scrollTrigger: { trigger: '.about-section', start: 'top 78%', toggleActions: 'play none none none' },
      });
      gsap.from('.about-text > *', {
        y: 28, opacity: 0, duration: 0.85, stagger: 0.1, ease: 'expo.out',
        scrollTrigger: { trigger: '.about-section', start: 'top 78%', toggleActions: 'play none none none' },
      });

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
  }, [portfolio, sort, activeCategory, isMobileDevice]);

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
    <div id="top" className="public-site" dir="auto">
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

      <CommercialHealthcareSection portfolio={portfolio} categories={categories} onOpen={openItem} isAr={isAr} />

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
            <div className="portfolio-masonry">
              {filteredItems.map(item => {
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
      {selectedItem && <VideoModal item={selectedItem} onClose={() => setSelectedItem(null)} lang={lang} />}
      {qrItem && <QRModal url={getPortfolioShareUrl(qrItem)} title={qrItem.title} onClose={() => setQrItem(null)} />}
    </div>
  );
}

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

function parseCollaborators(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  // Legacy: comma-separated handles
  return raw.split(',').map(h => ({ handle: h.trim(), role: '' })).filter(c => c.handle);
}

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
      {content}
      <PwaUpdateToast />
    </>
  );
}

export default App;
