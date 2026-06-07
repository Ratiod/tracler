# Racker — Free Hosting Guide
## Vercel (frontend + backend) + Supabase (database)

This guide migrates your app from Railway to a completely **free** stack that your whole team can use.

---

## What You Need (all free)
- GitHub account (you already have this)
- Vercel account → vercel.com
- Supabase account → supabase.com
- Groq API key → console.groq.com (for OCR scanner)

---

## Step 1 — Set Up Supabase (your new database)

1. Go to **supabase.com** and sign up with GitHub
2. Click **New Project**
3. Give it a name (e.g. `racker`) and set a database password — **save this password**
4. Choose a region close to you, click **Create Project**
5. Wait ~2 minutes for it to set up
6. Go to **Project Settings** (gear icon) → **Database**
7. Scroll down to **Connection string** → select **URI**
8. Copy the connection string — it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres
   ```
9. Replace `[YOUR-PASSWORD]` with the password you saved

**Keep this connection string — you'll need it in Step 3.**

---

## Step 2 — Push the New Code to GitHub

You have a new folder structure from me. Your repo should look like this:

```
your-repo/
├── vercel.json
├── api/
│   ├── index.js
│   └── package.json
└── client/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        └── main.jsx
```

1. Replace the files in your GitHub repo with the new ones I gave you
2. **Delete** the old `server/` folder from your repo — you don't need it anymore
3. Commit and push everything

---

## Step 3 — Deploy on Vercel

1. Go to **vercel.com** and sign up with GitHub
2. Click **Add New Project**
3. Import your GitHub repo
4. Vercel will auto-detect the config — **don't change anything**
5. Before clicking Deploy, click **Environment Variables** and add these:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Supabase connection string from Step 1 |
| `JWT_SECRET` | Any random string e.g. `racker-super-secret-2024` |
| `ADMIN_PASSWORD` | Your admin login password |
| `GROQ_API_KEY` | Your Groq key from console.groq.com |

6. Click **Deploy**
7. Wait ~2 minutes — Vercel builds your frontend and deploys the API

---

## Step 4 — Test It

1. Vercel gives you a URL like `racker.vercel.app`
2. Open it — you should see the login screen
3. Log in with username `admin` and the `ADMIN_PASSWORD` you set
4. Everything should work exactly as before

**Share the Vercel URL with your team** — they can all log in with accounts you create in the Admin panel.

---

## Setting Up Team Accounts

1. Log in as admin
2. Go to the **Admin Panel** (bottom of sidebar)
3. Click **Create User** for each teammate
4. Give them a username and temporary password
5. Share the Vercel URL and their login details

---

## Troubleshooting

**"Database connection failed"**
→ Check your `DATABASE_URL` in Vercel environment variables. Make sure you replaced `[YOUR-PASSWORD]` in the Supabase connection string.

**"Invalid token" on login**
→ Make sure `JWT_SECRET` is set in Vercel env vars.

**OCR Scanner not working**
→ Make sure `GROQ_API_KEY` is set. Get a free key at console.groq.com.

**Changes not showing after push**
→ Vercel auto-deploys on every GitHub push. Check the Deployments tab on Vercel to see if it's still building.

---

## Updating the App

Every time you push to GitHub, Vercel automatically redeploys — no manual steps needed. Just push and it's live within ~1 minute.
