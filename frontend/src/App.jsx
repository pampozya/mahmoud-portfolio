import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
const BASE_URL = process.env.REACT_APP_BASE_URL || '';

const api = {
  login: (email, password) =>
    fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(r => r.json()),

  getCategories: () => fetch(`${API_URL}/categories`).then(r => r.json()),

  createCategory: (token, data) =>
    fetch(`${API_URL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  getPortfolio: (category) =>
    fetch(`${API_URL}/portfolio${category ? `?category=${category}` : ''}`).then(r => r.json()),

  createPortfolio: (token, data) =>
    fetch(`${API_URL}/portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  updatePortfolio: (token, id, data) =>
    fetch(`${API_URL}/portfolio/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  deletePortfolio: (token, id) =>
    fetch(`${API_URL}/portfolio/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()),

  getSettings: () => fetch(`${API_URL}/settings`).then(r => r.json()),

  updateSettings: (token, data) =>
    fetch(`${API_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  uploadFile: (token, file) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }).then(r => r.json());
  },
};

// ==================== VIDEO UTILS ====================

function getYouTubeId(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function getVimeoId(url) {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

function getEmbedUrl(item) {
  if (!item.video_url) return null;
  if (item.video_type === 'youtube') {
    const id = getYouTubeId(item.video_url);
    return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : null;
  }
  if (item.video_type === 'vimeo') {
    const id = getVimeoId(item.video_url);
    return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : null;
  }
  return null;
}

function resolveUrl(url) {
  if (!url) return null;
  return url.startsWith('/') ? `${BASE_URL}${url}` : url;
}

function getThumbnail(item) {
  if (item.thumbnail_url) return resolveUrl(item.thumbnail_url);
  if (item.video_type === 'youtube' && item.video_url) {
    const id = getYouTubeId(item.video_url);
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }
  return null;
}

// ==================== VIDEO MODAL ====================

function VideoModal({ item, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const embedUrl = getEmbedUrl(item);
  const directUrl = item.video_type === 'direct' ? resolveUrl(item.video_url) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="video-wrapper">
          {embedUrl && (
            <iframe
              src={embedUrl}
              title={item.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
          {directUrl && (
            <video controls autoPlay src={directUrl} />
          )}
          {!embedUrl && !directUrl && (
            <div className="no-video">No video available</div>
          )}
        </div>
        <div className="modal-info">
          <h3>{item.title}</h3>
          {item.description && <p>{item.description}</p>}
        </div>
      </div>
    </div>
  );
}

// ==================== PUBLIC SITE ====================

function PublicSite({ onAdminClick }) {
  const [categories, setCategories] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getCategories(), api.getPortfolio(), api.getSettings()])
      .then(([cats, items, sett]) => {
        setCategories(cats || []);
        setPortfolio(Array.isArray(items) ? items : []);
        setSettings(sett);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredItems = activeCategory === 'all'
    ? portfolio
    : portfolio.filter(item => {
        const cat = categories.find(c => c.id === item.category_id);
        return cat && cat.slug === activeCategory;
      });

  const siteTitle = settings?.site_title || 'Mahmoud Dessoki';
  const siteDesc = settings?.site_description || 'Professional Cinematographer & Videographer';

  return (
    <div className="public-site">
      <header className="public-header">
        <div className="header-inner">
          <div className="site-logo">{siteTitle}</div>
          <nav className="header-nav">
            <a href="#portfolio">Portfolio</a>
            <a href="#contact">Contact</a>
            <button className="admin-link" onClick={onAdminClick}>Admin</button>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">{siteTitle}</h1>
          <p className="hero-tagline">{siteDesc}</p>
          <a href="#portfolio" className="hero-cta">View Portfolio</a>
        </div>
      </section>

      <section className="portfolio-section" id="portfolio">
        <div className="section-inner">
          <h2 className="section-title">Portfolio</h2>

          {categories.length > 0 && (
            <div className="category-tabs">
              <button
                className={activeCategory === 'all' ? 'tab-btn tab-active' : 'tab-btn'}
                onClick={() => setActiveCategory('all')}
              >All</button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={activeCategory === cat.slug ? 'tab-btn tab-active' : 'tab-btn'}
                  onClick={() => setActiveCategory(cat.slug)}
                >{cat.name}</button>
              ))}
            </div>
          )}

          {loading ? (
            <p className="state-text">Loading…</p>
          ) : filteredItems.length === 0 ? (
            <p className="state-text">No portfolio items yet.</p>
          ) : (
            <div className="portfolio-grid">
              {filteredItems.map(item => {
                const thumb = getThumbnail(item);
                return (
                  <div
                    key={item.id}
                    className={`video-card${item.featured ? ' video-card--featured' : ''}`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="card-thumb">
                      {thumb
                        ? <img src={thumb} alt={item.title} />
                        : <div className="thumb-placeholder"><span className="play-icon">▶</span></div>
                      }
                      <div className="play-overlay"><span>▶</span></div>
                    </div>
                    <div className="card-body">
                      <h3>{item.title}</h3>
                      {item.description && <p>{item.description}</p>}
                      {item.featured && <span className="featured-badge">Featured</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {settings && (
        <section className="contact-section" id="contact">
          <div className="section-inner">
            <h2 className="section-title">Contact</h2>
            <div className="contact-info">
              {settings.email && (
                <a href={`mailto:${settings.email}`} className="contact-item">✉ {settings.email}</a>
              )}
              {settings.phone && <span className="contact-item">📞 {settings.phone}</span>}
              {settings.location && <span className="contact-item">📍 {settings.location}</span>}
            </div>
            <div className="social-links">
              {settings.instagram && (
                <a href={settings.instagram} target="_blank" rel="noreferrer" className="social-btn">Instagram</a>
              )}
              {settings.youtube && (
                <a href={settings.youtube} target="_blank" rel="noreferrer" className="social-btn">YouTube</a>
              )}
              {settings.linkedin && (
                <a href={settings.linkedin} target="_blank" rel="noreferrer" className="social-btn">LinkedIn</a>
              )}
            </div>
          </div>
        </section>
      )}

      <footer className="public-footer">
        <p>© {new Date().getFullYear()} {siteTitle}. All rights reserved.</p>
      </footer>

      {selectedItem && (
        <VideoModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

// ==================== LOGIN PAGE ====================

function LoginPage({ onLogin, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.login(email, password);
      if (data.access_token) {
        localStorage.setItem('token', data.access_token);
        onLogin(data.access_token);
      } else {
        setError(data.detail || 'Login failed');
      }
    } catch (err) {
      setError('Connection error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Admin Login</h1>
        <p>Mahmoud Dessoki Portfolio</p>
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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, c, s] = await Promise.all([
        api.getPortfolio(),
        api.getCategories(),
        api.getSettings(),
      ]);
      setPortfolio(Array.isArray(p) ? p : []);
      setCategories(c || []);
      setSettings(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
        <button className={activeTab === 'portfolio' ? 'active' : ''} onClick={() => setActiveTab('portfolio')}>📹 Portfolio</button>
        <button className={activeTab === 'categories' ? 'active' : ''} onClick={() => setActiveTab('categories')}>📁 Categories</button>
        <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>⚙️ Settings</button>
      </nav>

      <main className="admin-content">
        {loading && <p>Loading…</p>}
        {activeTab === 'portfolio' && (
          <PortfolioManager portfolio={portfolio} categories={categories} token={token} onUpdate={loadData} />
        )}
        {activeTab === 'categories' && (
          <CategoriesManager categories={categories} token={token} onUpdate={loadData} />
        )}
        {activeTab === 'settings' && settings && (
          <SettingsManager settings={settings} token={token} onUpdate={loadData} />
        )}
      </main>
    </div>
  );
}

// ==================== PORTFOLIO MANAGER ====================

const EMPTY_FORM = {
  category_id: '',
  title: '',
  description: '',
  video_url: '',
  video_type: 'youtube',
  thumbnail_url: '',
  featured: false,
  order: 0,
};

function PortfolioManager({ portfolio, categories, token, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  const set = (patch) => setForm(prev => ({ ...prev, ...patch }));

  const handleUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(`Uploading ${file.name}…`);
    try {
      const res = await api.uploadFile(token, file);
      if (res.url) {
        set({ [field]: res.url });
        setUploadMsg(`✅ Uploaded: ${file.name}`);
      } else {
        setUploadMsg(`❌ ${res.detail || 'Upload failed'}`);
      }
    } catch (err) {
      setUploadMsg(`❌ ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, category_id: parseInt(form.category_id) };
    try {
      if (editId) {
        await api.updatePortfolio(token, editId, payload);
      } else {
        await api.createPortfolio(token, payload);
      }
      cancelForm();
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (item) => {
    setForm({
      category_id: item.category_id,
      title: item.title,
      description: item.description || '',
      video_url: item.video_url || '',
      video_type: item.video_type || 'youtube',
      thumbnail_url: item.thumbnail_url || '',
      featured: item.featured,
      order: item.order || 0,
    });
    setEditId(item.id);
    setShowForm(true);
    setUploadMsg('');
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setUploadMsg('');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this item?')) {
      await api.deletePortfolio(token, id);
      onUpdate();
    }
  };

  return (
    <div className="manager-section">
      <div className="section-header">
        <h2>Portfolio Items ({portfolio.length})</h2>
        {!showForm && (
          <button className="btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); }}>
            ➕ Add New Item
          </button>
        )}
      </div>

      {showForm && (
        <form className="portfolio-form" onSubmit={handleSubmit}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--color-peach)' }}>
            {editId ? '✏️ Edit Item' : '➕ New Item'}
          </h3>

          <label className="field-label">Category *</label>
          <select value={form.category_id} onChange={e => set({ category_id: e.target.value })} required>
            <option value="">Select category…</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <label className="field-label">Title *</label>
          <input
            type="text"
            placeholder="e.g. Dubai Real Estate Showreel"
            value={form.title}
            onChange={e => set({ title: e.target.value })}
            required
          />

          <label className="field-label">Description</label>
          <textarea
            placeholder="Brief description of the project…"
            value={form.description}
            onChange={e => set({ description: e.target.value })}
          />

          <label className="field-label">Video Type</label>
          <select value={form.video_type} onChange={e => set({ video_type: e.target.value, video_url: '' })}>
            <option value="youtube">YouTube</option>
            <option value="vimeo">Vimeo</option>
            <option value="direct">Direct Upload (MP4 / MOV)</option>
          </select>

          {form.video_type === 'youtube' || form.video_type === 'vimeo' ? (
            <>
              <label className="field-label">
                {form.video_type === 'youtube' ? 'YouTube URL' : 'Vimeo URL'}
              </label>
              <input
                type="url"
                placeholder={
                  form.video_type === 'youtube'
                    ? 'https://www.youtube.com/watch?v=…'
                    : 'https://vimeo.com/…'
                }
                value={form.video_url}
                onChange={e => set({ video_url: e.target.value })}
              />
            </>
          ) : (
            <>
              <label className="field-label">Upload Video File</label>
              <div className="upload-area">
                <label className="upload-label">
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/avi"
                    onChange={e => handleUpload(e, 'video_url')}
                    disabled={uploading}
                  />
                  <span>Choose video file…</span>
                </label>
                {form.video_url && (
                  <p className="upload-preview">✅ {form.video_url.split('/').pop()}</p>
                )}
              </div>
            </>
          )}

          <label className="field-label">Thumbnail Image (optional)</label>
          <div className="upload-area">
            <label className="upload-label">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={e => handleUpload(e, 'thumbnail_url')}
                disabled={uploading}
              />
              <span>Choose thumbnail image…</span>
            </label>
            {form.thumbnail_url && (
              <div className="thumb-preview">
                <img src={resolveUrl(form.thumbnail_url)} alt="Thumbnail preview" />
              </div>
            )}
          </div>

          {uploadMsg && (
            <p className={`upload-status ${uploadMsg.startsWith('✅') ? 'upload-ok' : uploadMsg.startsWith('❌') ? 'upload-err' : ''}`}>
              {uploadMsg}
            </p>
          )}

          <label className="featured-label">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={e => set({ featured: e.target.checked })}
            />
            ⭐ Mark as Featured
          </label>

          <div className="form-buttons">
            <button type="submit" className="btn-primary" disabled={uploading}>
              {editId ? '💾 Update' : '💾 Save'}
            </button>
            <button type="button" className="btn-secondary" onClick={cancelForm}>Cancel</button>
          </div>
        </form>
      )}

      <div className="portfolio-list">
        {portfolio.map(item => {
          const thumb = getThumbnail(item);
          return (
            <div key={item.id} className="portfolio-item-card">
              {thumb && <img src={thumb} alt={item.title} className="card-thumb-admin" />}
              <div className="card-body-admin">
                <h3>{item.title}</h3>
                {item.description && <p>{item.description}</p>}
                <div className="item-meta">
                  <span>👁 {item.views}</span>
                  <span className="type-badge">{item.video_type}</span>
                  {item.featured && <span>⭐</span>}
                </div>
              </div>
              <div className="card-actions">
                <button className="btn-secondary btn-sm" onClick={() => openEdit(item)}>✏️ Edit</button>
                <button className="btn-danger btn-sm" onClick={() => handleDelete(item.id)}>🗑 Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== CATEGORIES MANAGER ====================

function CategoriesManager({ categories, token, onUpdate }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    await api.createCategory(token, { name, slug });
    setName('');
    setSlug('');
    onUpdate();
  };

  return (
    <div className="manager-section">
      <h2>Portfolio Categories</h2>
      <form className="category-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="Category Name (e.g. Work)"
          value={name}
          onChange={e => {
            setName(e.target.value);
            setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
          }}
          required
        />
        <input
          type="text"
          placeholder="Slug (e.g. work)"
          value={slug}
          onChange={e => setSlug(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary">Add Category</button>
      </form>
      <div className="categories-list">
        {categories.map(cat => (
          <div key={cat.id} className="category-item">
            <h3>{cat.name}</h3>
            <p>/{cat.slug}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== SETTINGS MANAGER ====================

function SettingsManager({ settings, token, onUpdate }) {
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await api.updateSettings(token, form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    onUpdate();
  };

  const field = (label, name, type = 'text') => (
    <div className="form-group">
      <label>{label}</label>
      <input
        type={type}
        name={name}
        value={form[name] || ''}
        onChange={e => setForm({ ...form, [name]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="manager-section">
      <h2>Site Settings</h2>
      {saved && <div className="success-message">✅ Settings saved!</div>}
      <form className="settings-form" onSubmit={handleSubmit}>
        {field('Site Title', 'site_title')}
        <div className="form-group">
          <label>Site Description</label>
          <textarea
            value={form.site_description || ''}
            onChange={e => setForm({ ...form, site_description: e.target.value })}
          />
        </div>
        {field('Email', 'email', 'email')}
        {field('Phone', 'phone', 'tel')}
        {field('Location', 'location')}
        {field('Instagram URL', 'instagram', 'url')}
        {field('YouTube URL', 'youtube', 'url')}
        {field('LinkedIn URL', 'linkedin', 'url')}
        <button type="submit" className="btn-primary">Save Settings</button>
      </form>
    </div>
  );
}

// ==================== MAIN APP ====================

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [page, setPage] = useState('public');

  const handleLogin = (newToken) => {
    setToken(newToken);
    setPage('admin');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setPage('public');
  };

  const handleAdminClick = () => {
    setPage(token ? 'admin' : 'login');
  };

  if (page === 'login') return <LoginPage onLogin={handleLogin} onBack={() => setPage('public')} />;
  if (page === 'admin' && token) return <AdminDashboard token={token} onLogout={handleLogout} onBack={() => setPage('public')} />;
  return <PublicSite onAdminClick={handleAdminClick} />;
}

export default App;
