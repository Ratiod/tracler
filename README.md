# Ticra - Turso Backend Setup Guide

## 🚀 Quick Setup

### Step 1: Sign up for Turso (FREE)

1. Go to [turso.tech](https://turso.tech)
2. Click **Sign Up** (use GitHub or email - no credit card needed)
3. Once logged in, you'll be at the Turso dashboard

### Step 2: Create a Turso Database

In your terminal (make sure you have Turso CLI installed):

```bash
# Install Turso CLI (one-time setup)
# macOS/Linux:
curl -sSfL https://get.tur.so/install.sh | bash

# Windows:
# Download from https://docs.turso.tech/cli/installation

# Login to Turso
turso auth login

# Create a new database called "ticra"
turso db create ticra

# Get your database URL
turso db show ticra --url

# Create an authentication token
turso db tokens create ticra
```

Save these two values:
- **TURSO_DATABASE_URL** - looks like `libsql://ticra-yourname.turso.io`
- **TURSO_AUTH_TOKEN** - long string starting with `eyJ...`

### Step 3: Deploy Backend on Render

1. Push your updated code to GitHub:
```bash
cd Downloads\ticra-turso
git init
git add .
git commit -m "add turso backend"
git remote add origin https://github.com/Ratiod/tracler.git
git branch -M main
git push -f origin main
```

2. Go to [render.com](https://render.com)
3. Click **New → Web Service**
4. Connect your GitHub repo
5. Configure:
   - **Name**: ticra-api (or whatever you want)
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   
6. Click **Advanced** and add environment variables:
   - **TURSO_DATABASE_URL** = your database URL from Step 2
   - **TURSO_AUTH_TOKEN** = your auth token from Step 2

7. Click **Create Web Service**
8. Copy the URL it gives you (e.g., `https://ticra-api.onrender.com`)

### Step 4: Deploy Frontend on Render

1. Go to [render.com](https://render.com)
2. Click **New → Static Site**
3. Connect your GitHub repo again
4. Configure:
   - **Name**: ticra
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   
5. Add environment variable:
   - **VITE_API_URL** = your backend URL from Step 3

6. Click **Create Static Site**

Done! Your app will be live in ~2 minutes at the URL Render gives you.

---

## 🔧 Alternative: No Turso CLI Setup

If you don't want to install the Turso CLI, you can create the database through the web UI:

1. Go to [turso.tech](https://turso.tech) and sign in
2. Click **Create Database**
3. Name it `ticra`
4. Click on the database name
5. Go to the **Settings** tab
6. Copy the **URL** (your TURSO_DATABASE_URL)
7. Click **Create Token** and copy it (your TURSO_AUTH_TOKEN)

Then follow Steps 3-4 above normally.

---

## 📝 What Changed from SQLite?

- **Before**: Data stored in a local file (`ticra.db`) that required a disk mount
- **After**: Data stored in Turso's cloud, no disk needed, survives all restarts
- **Cost**: Turso is free for up to 500 databases and 9 GB storage

---

## 🆘 Troubleshooting

### "Cannot find module @libsql/client"
Make sure Render is running `npm install` in the `server` directory. Check that **Root Directory** is set to `server`.

### "TURSO_DATABASE_URL is not defined"
Go to your Render backend service → Settings → Environment → add the two environment variables from Step 2.

### Frontend can't connect to backend
Make sure **VITE_API_URL** in your frontend environment variables matches your backend URL exactly (no trailing slash).

---

## 💾 Data Persistence

With Turso, your data persists:
- ✅ Between deploys
- ✅ During server restarts
- ✅ Forever (as long as your Turso account is active)

No data loss on Render's free tier!
