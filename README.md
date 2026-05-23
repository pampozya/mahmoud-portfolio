# 🎬 Mahmoud Adel - Full Stack Portfolio

A complete full-stack portfolio website with admin dashboard for managing videography work.

**Features:**
- ✅ **Modern React Frontend** - Beautiful, responsive design with Peach & Maroon color scheme
- ✅ **FastAPI Backend** - Fast, secure Python API with JWT authentication
- ✅ **Admin Dashboard** - Manage portfolio items, categories, settings, and analytics
- ✅ **Database** - SQLAlchemy with SQLite (dev) / PostgreSQL (prod)
- ✅ **Video Management** - Support for YouTube, Vimeo, and direct uploads
- ✅ **Mobile Optimized** - Works perfectly on all devices
- ✅ **SEO Ready** - Structured data and meta tags
- ✅ **Production Ready** - Deploy anywhere

---

## 📁 What's Included

```
Complete Full-Stack Project:
├── backend/
│   ├── main.py                  # FastAPI application (1000+ lines)
│   ├── requirements.txt          # Python dependencies
│   └── .env.example             # Configuration template
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # React app with dashboard
│   │   └── App.css             # Professional styling
│   ├── package.json            # NPM dependencies
│   └── .env.example            # Frontend config
├── SETUP_GUIDE.md              # Complete setup instructions
└── README.md                   # This file
```

---

## 🎯 What You Get

### Backend (FastAPI)
- ✅ User authentication with JWT
- ✅ Portfolio CRUD operations
- ✅ Category management
- ✅ About section editor
- ✅ Site settings management
- ✅ View tracking analytics
- ✅ CORS configured
- ✅ Error handling
- ✅ Auto-generated API docs

### Frontend (React)
- ✅ Modern admin login
- ✅ Portfolio item manager
- ✅ Category editor
- ✅ Settings panel
- ✅ Real-time updates
- ✅ Responsive design
- ✅ Error messages
- ✅ Success notifications
- ✅ Video embed support

### Database (SQLAlchemy)
- ✅ Users table
- ✅ Categories table
- ✅ Portfolio items table
- ✅ About section table
- ✅ Settings table
- ✅ Relationships & constraints

---

## 🚀 Quick Start

### 1. Clone/Download the Project
```bash
git clone your-repo
cd portfolio-fullstack
```

### 2. Backend Setup (5 minutes)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 main.py
```
✅ Backend running at http://localhost:8000

### 3. Frontend Setup (5 minutes)
```bash
cd frontend
npm install
npm start
```
✅ Frontend running at http://localhost:3000

### 4. Login to Admin Dashboard
- **Email:** admin@lensmania.ae
- **Password:** (from .env file)

---

## 📝 Admin Dashboard Features

### Portfolio Manager
- Add/edit/delete portfolio items
- Upload videos (YouTube, Vimeo, direct)
- Mark items as featured
- Organize by category
- View analytics

### Category Manager
- Create custom categories
- Manage category order
- Edit descriptions

### Settings Manager
- Site title & description
- Contact information
- Social media links
- Location/timezone

---

## 🎨 Customize for Your Brand

All files are ready to customize:

1. **Colors** - Edit CSS variables in `App.css`
2. **Branding** - Update site name in admin settings
3. **Categories** - Create your portfolio categories
4. **Content** - Add your portfolio items and details

---

## 🌐 Deployment Options

### Option 1: Render.com (Recommended)
- ✅ Free tier available
- ✅ Automatic deploys from GitHub
- ✅ PostgreSQL support
- ✅ Custom domain

### Option 2: Vercel + PythonAnywhere
- ✅ Frontend: Vercel (free tier)
- ✅ Backend: PythonAnywhere (free tier)
- ✅ Database: PostgreSQL (included)

### Option 3: Docker + AWS/DigitalOcean
- ✅ Full control
- ✅ Scalable
- ✅ Professional infrastructure

See `SETUP_GUIDE.md` for detailed deployment instructions.

---

## 🔐 Security Features

- ✅ JWT token authentication
- ✅ Password hashing ready (implement bcrypt)
- ✅ CORS protection
- ✅ Environment variables for secrets
- ✅ API route protection

**Important:** In production:
1. Use strong SECRET_KEY
2. Hash passwords with bcrypt
3. Use HTTPS
4. Set secure CORS origins
5. Use PostgreSQL instead of SQLite

---

## 📊 API Documentation

Once running, visit:
- **Interactive Docs:** http://localhost:8000/docs
- **Alternative Docs:** http://localhost:8000/redoc

All endpoints are documented with examples.

---

## 🛠️ Tech Stack

**Backend:**
- FastAPI - Modern web framework
- SQLAlchemy - ORM
- Pydantic - Data validation
- JWT - Authentication
- Python 3.11+

**Frontend:**
- React 18+
- CSS3 with variables
- Responsive design
- No external UI library (lightweight)

**Database:**
- SQLite (development)
- PostgreSQL (production)

---

## 📚 File Breakdown

### Backend (main.py)
- **Models:** User, Category, Portfolio, About, Settings
- **Routes:** Auth, Portfolio CRUD, Settings, Categories
- **Dependencies:** Database, JWT verification
- **CORS:** Configured for local & production

### Frontend (App.jsx)
- **LoginPage:** Admin authentication
- **AdminDashboard:** Main interface
- **PortfolioManager:** CRUD operations
- **CategoriesManager:** Category management
- **SettingsManager:** Site configuration

### Styling (App.css)
- **Theme:** Maroon & Peach
- **Responsive:** Mobile-first design
- **Components:** Login, Dashboard, Forms, Lists
- **Animations:** Smooth transitions

---

## 🎓 Learning Path

1. **Understand the Structure** - Review file breakdown above
2. **Run Locally** - Follow quick start guide
3. **Explore API** - Check /docs endpoint
4. **Make Changes** - Add custom fields
5. **Deploy** - Choose hosting option

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors | Update allowed origins in main.py |
| Login fails | Verify admin credentials in .env |
| Videos not showing | Check YouTube/Vimeo video is public |
| Database errors | Delete portfolio.db and reinit |
| Port already in use | Change port in startup command |

---

## 📞 Support & Resources

- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **React Docs:** https://react.dev/
- **SQLAlchemy:** https://www.sqlalchemy.org/
- **JWT Guide:** https://jwt.io/introduction

---

## 📈 Future Enhancements

Ready to extend? Here are ideas:

- [ ] Email contact form
- [ ] Blog/articles section
- [ ] Client testimonials
- [ ] Newsletter signup
- [ ] Image gallery
- [ ] Live chat integration
- [ ] Payment processing
- [ ] Advanced analytics

---

## ✅ Checklist Before Launch

- [ ] Change admin password
- [ ] Update site settings (email, phone, social)
- [ ] Create portfolio categories
- [ ] Add portfolio items with videos
- [ ] Set up domain
- [ ] Configure email
- [ ] Test all forms
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Test in production
- [ ] Set up backups

---

## 📜 License

Built for Mahmoud Adel (@mahmoud.diido)

---

## 🎉 Ready to Launch?

1. ✅ Download all files
2. ✅ Follow SETUP_GUIDE.md
3. ✅ Customize for your brand
4. ✅ Deploy to production
5. ✅ Start managing your portfolio!

**Questions?** Check the SETUP_GUIDE.md for detailed instructions.

---

**Made with ❤️ for Professional Cinematographers**
