# Mahmoud Dessoki Portfolio - Full Stack Setup Guide

## 📋 Project Structure

```
portfolio-fullstack/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt      # Python dependencies
│   ├── .env                 # Environment variables
│   └── portfolio.db         # SQLite database (auto-created)
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React component
│   │   └── App.css         # Styling
│   ├── package.json        # NPM dependencies
│   └── .env.local          # Frontend environment
└── README.md
```

---

## 🚀 LOCAL DEVELOPMENT SETUP

### Backend Setup

1. **Create Python Virtual Environment**
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Create Environment File**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Initialize Database & Create Admin User**
   ```bash
   python3 -c "
   from main import SessionLocal, User, engine, Base
   import os
   
   Base.metadata.create_all(bind=engine)
   db = SessionLocal()
   
   # Create default admin user
   admin = User(
       email=os.getenv('ADMIN_EMAIL', 'admin@lensmania.ae'),
       password_hash=os.getenv('ADMIN_PASSWORD', 'change-me'),
       is_active=True
   )
   db.add(admin)
   db.commit()
   print('✅ Database initialized, admin user created')
   "
   ```

5. **Run Backend Server**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   API will be available at: http://localhost:8000
   API Docs: http://localhost:8000/docs

### Frontend Setup

1. **Create React App**
   ```bash
   cd frontend
   npx create-react-app .
   # Or if using Vite:
   npm create vite@latest . -- --template react
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Create .env.local**
   ```
   REACT_APP_API_URL=http://localhost:8000/api
   ```

4. **Replace Files**
   - Copy `App.jsx` to `src/App.jsx`
   - Copy `App.css` to `src/App.css`
   - Update `src/index.js` (if needed)

5. **Run Frontend**
   ```bash
   npm start
   # Or with Vite:
   npm run dev
   ```
   Frontend will be available at: http://localhost:3000

---

## 🔒 Creating Default Categories

Run this script after initializing the database:

```python
from main import SessionLocal, Category

db = SessionLocal()

categories = [
    Category(name="Work", slug="work", order=1),
    Category(name="Events", slug="events", order=2),
    Category(name="Social Media", slug="social-media", order=3),
    Category(name="Food", slug="food", order=4),
    Category(name="Podcasts", slug="podcasts", order=5),
    Category(name="YouTube Videos", slug="youtube-videos", order=6),
]

for cat in categories:
    db.add(cat)

db.commit()
print("✅ Categories created")
```

---

## 📦 PRODUCTION DEPLOYMENT

### Option 1: Deploy on Render.com (Recommended for FastAPI)

**Backend Deployment:**

1. Push code to GitHub
2. Create new Web Service on Render.com
3. Connect GitHub repository
4. Set environment variables:
   ```
   DATABASE_URL=postgresql://...
   SECRET_KEY=your-production-secret
   ADMIN_EMAIL=your-admin@email.com
   ADMIN_PASSWORD=secure-password
   ```
5. Build command: `pip install -r requirements.txt`
6. Start command: `uvicorn main:app --host 0.0.0.0 --port 8000`

**Frontend Deployment:**

1. Build React app:
   ```bash
   npm run build
   ```
2. Deploy build folder to Vercel, Netlify, or any static hosting
3. Update `.env.production` with production API URL

### Option 2: Deploy on Hostinger (Shared Hosting)

**For shared hosting, consider:**

1. **Option A: Use PythonAnywhere** (for FastAPI backend)
   - Free tier available
   - Easy Python hosting
   - PostgreSQL support

2. **Option B: Frontend-only on Hostinger + API elsewhere**
   - Host React build on Hostinger (static files)
   - Host FastAPI backend on Render.com or PythonAnywhere

### Option 3: Docker Deployment

1. **Create Dockerfile** for backend:
   ```dockerfile
   FROM python:3.11-slim
   
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install -r requirements.txt
   
   COPY main.py .
   
   CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
   ```

2. **Deploy to Docker Hub or cloud provider**

---

## 🔑 Admin Dashboard Credentials

Default credentials (change immediately in production):
- **Email:** admin@lensmania.ae
- **Password:** (from .env file)

Access admin dashboard at: `/admin` (after frontend build)

---

## 📝 API ENDPOINTS

### Authentication
- `POST /api/auth/login` - Admin login

### Categories
- `GET /api/categories` - List all categories
- `POST /api/categories` - Create category (auth required)

### Portfolio
- `GET /api/portfolio` - List all portfolio items
- `GET /api/portfolio?category=work` - Filter by category
- `GET /api/portfolio/{id}` - Get single item
- `POST /api/portfolio` - Create item (auth required)
- `PUT /api/portfolio/{id}` - Update item (auth required)
- `DELETE /api/portfolio/{id}` - Delete item (auth required)

### About Section
- `GET /api/about` - Get about content
- `PUT /api/about` - Update about (auth required)

### Settings
- `GET /api/settings` - Get site settings
- `PUT /api/settings` - Update settings (auth required)

---

## 🎨 Customization

### Change Colors
Edit the CSS variables in `App.css`:
```css
:root {
  --color-dark: #5B0E2D;
  --color-peach: #FFA781;
  --color-maroon: #2D0A1A;
  /* ... etc */
}
```

### Add More Fields
1. Update SQLAlchemy models in `main.py`
2. Create Pydantic schemas
3. Add API routes
4. Update React forms in `App.jsx`

---

## 🔧 Troubleshooting

**CORS Errors?**
- Update `CORS` settings in `main.py`
- Check `ALLOWED_ORIGINS` in `.env`

**Database Errors?**
- Delete `portfolio.db` and reinitialize
- Check `DATABASE_URL` in `.env`

**Login Not Working?**
- Verify admin credentials in database
- Check `SECRET_KEY` is set
- Ensure token is stored in localStorage

**Videos Not Loading?**
- Verify YouTube/Vimeo URLs are correct
- Check video privacy settings (should be public or unlisted)

---

## 📚 Next Steps

1. **Customize Categories** - Adjust to match your portfolio
2. **Add Portfolio Items** - Use admin dashboard
3. **Update Settings** - Add your contact info & social links
4. **Deploy Backend** - Choose hosting option
5. **Deploy Frontend** - Build and deploy React app
6. **Configure Domain** - Point your domain to hosting

---

## 🎓 Learning Resources

- FastAPI: https://fastapi.tiangolo.com/
- React: https://react.dev/
- SQLAlchemy: https://www.sqlalchemy.org/
- JWT: https://jwt.io/

---

## 📞 Support

For issues or questions, refer to:
- FastAPI docs: http://localhost:8000/docs
- React error messages in browser console
- Database logs in console

---

**Built with ❤️ for Mahmoud Dessoki Portfolio**
