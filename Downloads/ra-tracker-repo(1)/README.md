# RA Tracker

Valorant scrim tracker for competitive teams. Auto-uploads match data and displays stats on a web dashboard.

---

## Repo Structure

```
ra-tracker/
├── tracker-app/          # Electron desktop app (Windows)
│   ├── src/
│   │   ├── main.js       # Main process — polls Riot API, uploads matches
│   │   ├── preload.js    # Context bridge
│   │   └── index.html    # UI
│   ├── assets/           # Icons
│   └── package.json
│
├── web/                  # Vercel-deployed dashboard
│   ├── api/
│   │   ├── index.js      # Express API (serverless on Vercel)
│   │   └── package.json
│   ├── client/
│   │   ├── src/
│   │   │   ├── App.jsx   # React frontend
│   │   │   └── main.jsx
│   │   ├── public/
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.js
│   └── vercel.json       # Vercel routing config
│
├── .github/
│   └── workflows/
│       └── build.yml     # Auto-builds .exe on new tag/release
│
├── .gitignore
└── README.md
```

---

## Desktop App (tracker-app)

The Electron app runs on Windows and automatically detects and uploads Valorant matches to your dashboard.

### Keybinds
| Key | Action |
|-----|--------|
| `P` | Pause / Resume tracking |

### Dev Setup
```bash
cd tracker-app
npm install
npm run dev
```

### Build (.exe)
```bash
cd tracker-app
npm install
npm run build
# Output: tracker-app/dist/RA Tracker Setup x.x.x.exe
```

Or push a version tag to GitHub and the Actions workflow builds it automatically:
```bash
git tag v1.0.1
git push origin v1.0.1
```

---

## Web Dashboard (web/)

React frontend + Node/Express API, deployed on Vercel with a Supabase (Postgres) database.

### Dev Setup
```bash
# API
cd web/api
npm install
node index.js

# Client (separate terminal)
cd web/client
npm install
npm run dev
```

### Environment Variables
Create a `.env` file in `web/api/` (never commit this):
```
DATABASE_URL=postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres
JWT_SECRET=your-secret-here
ADMIN_PASSWORD=your-admin-password
GROQ_API_KEY=your-groq-key
```

### Deploy to Vercel
See `DEPLOY_GUIDE.md` for the full setup. Short version:
1. Push to GitHub
2. Import repo on vercel.com
3. Add environment variables
4. Deploy — Vercel auto-redeploys on every push

---

## Releasing a New Version

1. Update version in `tracker-app/package.json`
2. Commit and push
3. Tag the release:
   ```bash
   git tag v1.x.x
   git push origin v1.x.x
   ```
4. GitHub Actions builds the `.exe` and attaches it to the release automatically
