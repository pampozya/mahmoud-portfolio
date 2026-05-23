# 📚 Complete Step-by-Step Guide
## Mahmoud Adel Full-Stack Portfolio Setup

---

## 🎯 PHASE 1: DOWNLOAD & ORGANIZE (5 minutes)

### Step 1: Create Project Folder on Your Computer

**Windows:**
1. Open File Explorer
2. Go to Documents folder
3. Right-click → New → Folder
4. Name it: `mahmoud-portfolio`
5. Open this folder

**Mac/Linux:**
1. Open Terminal/Finder
2. Go to Documents
3. Create folder: `mkdir mahmoud-portfolio`
4. Open folder: `cd mahmoud-portfolio`

### Step 2: Download All Files

All files are ready in the outputs folder. Download these files:

```
Files to download:
✓ backend_main.py
✓ App.jsx
✓ App.css
✓ requirements.txt
✓ package.json
✓ .env.example
✓ SETUP_GUIDE.md
✓ README.md
```

### Step 3: Organize Files in Your Folder

```
mahmoud-portfolio/
├── backend/
│   ├── main.py (rename from backend_main.py)
│   ├── requirements.txt
│   └── .env (copy from .env.example)
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── App.css
│   └── package.json
├── SETUP_GUIDE.md
└── README.md
```

**How to organize:**
1. Create folder named `backend` inside `mahmoud-portfolio`
2. Move `backend_main.py` → rename to `main.py` inside `backend` folder
3. Move `requirements.txt` into `backend` folder
4. Copy `.env.example` and rename to `.env` inside `backend` folder
5. Create folder named `frontend` inside `mahmoud-portfolio`
6. Create `src` folder inside `frontend`
7. Move `App.jsx` and `App.css` into `frontend/src` folder
8. Move `package.json` into `frontend` folder

---

## 🔧 PHASE 2: CUSTOMIZE FOR YOUR BRAND (15 minutes)

### Step 4: Customize Colors

Your colors are: **Maroon (#5B0E2D) & Peach (#FFA781)**

**To change colors:**

1. Open file: `frontend/src/App.css`
2. Find this section at the top:
```css
:root {
  --color-dark: #5B0E2D;
  --color-peach: #FFA781;
  --color-maroon: #2D0A1A;
  --color-black: #000000;
  --color-text: #FFA781;
  --color-text-muted: #E8C4B3;
}
```

3. You can change these colors to any hex code you want
4. Save the file

### Step 5: Customize Admin Login Credentials

1. Open file: `backend/.env`
2. Find these lines:
```
ADMIN_EMAIL=admin@lensmania.ae
ADMIN_PASSWORD=change-this-password-immediately
```

3. Change to YOUR credentials:
```
ADMIN_EMAIL=your-email@example.com
ADMIN_PASSWORD=your-secure-password
```

4. Save the file

### Step 6: Customize Site Title & Description

1. Open file: `backend/.env`
2. The settings will be configured when you run the system
3. You'll set them through the admin dashboard later

### Step 7: Change Database Type (Optional)

For local testing, SQLite is fine. But if you want to change:

1. Open file: `backend/.env`
2. Find: `DATABASE_URL=sqlite:///./portfolio.db`
3. For PostgreSQL, change to:
```
DATABASE_URL=postgresql://username:password@localhost/portfolio_db
```

---

## 💻 PHASE 3: LOCAL SETUP - BACKEND (10 minutes)

### Step 8: Open Terminal/Command Prompt

**Windows:**
1. Press `Win + R`
2. Type `cmd`
3. Press Enter

**Mac:**
1. Press `Cmd + Space`
2. Type `terminal`
3. Press Enter

**Linux:**
- Open your terminal application

### Step 9: Navigate to Backend Folder

Copy this command and paste in terminal:

```bash
cd path/to/mahmoud-portfolio/backend
```

Replace `path/to/` with your actual path. For example:
- Windows: `cd C:\Users\YourName\Documents\mahmoud-portfolio\backend`
- Mac: `cd ~/Documents/mahmoud-portfolio/backend`

### Step 10: Create Virtual Environment

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**Mac/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

You should see `(venv)` at the start of your terminal line.

### Step 11: Install Python Dependencies

Copy and paste this command:

```bash
pip install -r requirements.txt
```

This will download and install all required Python packages. **Wait for it to complete** (usually 2-3 minutes).

### Step 12: Initialize the Database

Copy and paste this command:

```bash
python main.py
```

When you see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Your backend is running!** ✅

Leave this terminal window open and running.

---

## 🎨 PHASE 4: LOCAL SETUP - FRONTEND (10 minutes)

### Step 13: Open New Terminal Window

**Keep the backend terminal running!** Open a NEW terminal window:

**Windows:**
1. Press `Win + R`
2. Type `cmd`
3. Press Enter

**Mac:**
1. Press `Cmd + Space`
2. Type `terminal`
3. Press Enter

### Step 14: Navigate to Frontend Folder

```bash
cd path/to/mahmoud-portfolio/frontend
```

### Step 15: Install Node Modules

```bash
npm install
```

This will download React and other packages. **Wait for it to complete** (3-5 minutes).

### Step 16: Start Frontend Server

```bash
npm start
```

Your browser should automatically open at `http://localhost:3000`

If not, manually go to: **http://localhost:3000**

You should see the **Admin Login Page** ✅

---

## 🔑 PHASE 5: FIRST LOGIN & SETUP (5 minutes)

### Step 17: Login to Admin Dashboard

Use the credentials you set in Step 5:

**Example:**
- Email: `your-email@example.com`
- Password: `your-secure-password`

Click **Login**

### Step 18: Setup Site Settings

1. Click **⚙️ Settings** tab
2. Fill in your information:
   - **Site Title:** Mahmoud Adel
   - **Site Description:** Professional Cinematographer & Videographer
   - **Email:** info@lensmania.ae
   - **Phone:** +971 XX XXX XXXX
   - **Location:** Dubai, UAE
   - **Instagram:** https://instagram.com/mahmoud.diido
   - **YouTube:** https://youtube.com/@yourhandle
   - **LinkedIn:** https://linkedin.com/in/yourprofile
3. Click **Save Settings**

### Step 19: Create Portfolio Categories

1. Click **📁 Categories** tab
2. Create these categories (one at a time):
   - **Work** (slug: work)
   - **Events** (slug: events)
   - **Social Media** (slug: social-media)
   - **Food** (slug: food)
   - **Podcasts** (slug: podcasts)
   - **YouTube Videos** (slug: youtube-videos)

### Step 20: Add Your First Portfolio Item

1. Click **📹 Portfolio** tab
2. Click **➕ Add New Item**
3. Fill in:
   - **Category:** Choose one from dropdown
   - **Title:** Name of your project (e.g., "Dubai Real Estate Video")
   - **Description:** Brief description
   - **Video URL:** YouTube or Vimeo link
   - **Video Type:** Select YouTube or Vimeo
   - **Featured:** Check if it's your best work
4. Click **Save**

✅ **Your portfolio item is live!**

---

## 🌐 PHASE 6: DEPLOYMENT (30 minutes)

### Option A: Deploy on Render.com (Recommended)

**Step 21: Create Render Account**
1. Go to https://render.com
2. Click "Get Started"
3. Sign up with GitHub or email

**Step 22: Deploy Backend**
1. Push your code to GitHub
2. On Render.com, click "New" → "Web Service"
3. Connect your GitHub repository
4. Settings:
   - **Name:** mahmoud-portfolio-api
   - **Environment:** Python 3.11
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port 8000`
5. Add Environment Variables:
   - `SECRET_KEY`: Generate a random string
   - `DATABASE_URL`: (PostgreSQL from Render)
   - `ADMIN_EMAIL`: Your email
   - `ADMIN_PASSWORD`: Your password
6. Click "Create Web Service"

**Step 23: Deploy Frontend**
1. Build React app:
   ```bash
   npm run build
   ```
2. Deploy to Vercel:
   - Go to https://vercel.com
   - Import from GitHub
   - Deploy
3. Update frontend `.env` with Render API URL

### Option B: Deploy on Hostinger (If you already have hosting)

**Step 24: Prepare Files**
1. Build React:
   ```bash
   npm run build
   ```
2. Upload `build` folder to Hostinger via FTP

**Step 25: Deploy Backend**
- Use PythonAnywhere.com (free tier)
- Or upgrade Hostinger to support Python

---

## ✅ CHECKLIST: You're Done When...

- [ ] Files organized in folders
- [ ] Colors customized
- [ ] Admin credentials set
- [ ] Backend running locally (http://localhost:8000)
- [ ] Frontend running locally (http://localhost:3000)
- [ ] Can login to admin dashboard
- [ ] Settings filled in
- [ ] Categories created
- [ ] At least 1 portfolio item added
- [ ] Ready to deploy

---

## 🎓 PHASE 7: TROUBLESHOOTING

### Problem: "Port already in use"
**Solution:**
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :8000
kill -9 <PID>
```

### Problem: "npm not found"
**Solution:**
- Download Node.js from https://nodejs.org
- Restart terminal after installation
- Try `npm install` again

### Problem: "Python not found"
**Solution:**
- Download Python from https://python.org
- During installation, CHECK "Add Python to PATH"
- Restart terminal
- Try `python --version`

### Problem: "Can't login"
**Solution:**
- Check `.env` file has correct email/password
- Make sure backend is running
- Check browser console for errors (F12)

### Problem: "Videos not loading"
**Solution:**
- Make sure YouTube video is PUBLIC (not private)
- Check URL is correct
- Try embedding directly in YouTube

---

## 📞 NEED HELP?

**Reference Files:**
1. `README.md` - Overview of project
2. `SETUP_GUIDE.md` - Detailed technical guide
3. Backend API Docs: http://localhost:8000/docs

**Common Commands:**

```bash
# Backend - Start server
cd backend
source venv/bin/activate (Mac/Linux) or venv\Scripts\activate (Windows)
python main.py

# Frontend - Start React
cd frontend
npm start

# Frontend - Build for production
npm run build

# Stop any server
Press Ctrl + C
```

---

## 🎉 NEXT STEPS AFTER LOCAL TESTING

1. ✅ Test everything locally
2. ✅ Customize all content
3. ✅ Add all your portfolio items
4. ✅ Follow Phase 6 deployment
5. ✅ Test in production
6. ✅ Set up custom domain
7. ✅ Configure email notifications

---

## 📧 QUICK REFERENCE

**Folder Structure:**
```
mahmoud-portfolio/
├── backend/main.py
├── backend/requirements.txt
├── backend/.env
├── frontend/src/App.jsx
├── frontend/src/App.css
├── frontend/package.json
└── README.md
```

**Key URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

**Default Ports:**
- Frontend: 3000
- Backend: 8000

**Admin Dashboard:**
- Login at: http://localhost:3000
- Email: (from your .env)
- Password: (from your .env)

---

**You've got this! Follow these steps in order and you'll have a fully operational portfolio. 🚀**

**Questions?** Each phase is independent - you can take breaks between phases!
