const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } = require("electron");
const path   = require("path");
const fs     = require("fs");
const chokidar = require("chokidar");

// electron-store for persisting config
let Store;
try { Store = require("electron-store"); } catch { Store = null; }

const store = Store ? new Store() : {
  _d: {}, get(k,d){ return this._d[k]??d; }, set(k,v){ this._d[k]=v; }
};

let mainWindow = null;
let tray       = null;
let watcher    = null;
let isQuitting = false;

// ── Valorant match file path ──────────────────────────────────────────────────
// Riot stores match history in %LocalAppData%\VALORANT\Saved\Logs\
// The actual raw match JSON is written to ShooterGame\Saved\Logs after each match.
// We watch: %LocalAppData%\Packages\*ValorantLogs*\  (newer)
// and the classic path as fallback.
function getValorantWatchPaths() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const appData      = process.env.APPDATA || "";
  return [
    // Classic install path — match files land here
    path.join(localAppData, "VALORANT", "Saved", "Logs"),
    path.join(localAppData, "Riot Games", "VALORANT", "live", "ShooterGame", "Saved", "Logs"),
    // Dev / custom path override
    store.get("customWatchPath", ""),
  ].filter(Boolean);
}

// ── Upload a match file ───────────────────────────────────────────────────────
async function uploadMatch(filePath) {
  const apiUrl    = store.get("apiUrl", "");
  const apiKey    = store.get("apiKey", "");
  const riotId    = store.get("riotId", "");

  if (!apiUrl || !apiKey) return { error: "Not configured" };

  let raw;
  try { raw = JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch { return { error: "Failed to parse match file" }; }

  // Only process files that look like Valorant match data
  if (!raw?.matchInfo && !raw?.players) return { error: "Not a match file" };

  const matchData = raw;

  try {
    const endpoint = apiUrl.replace(/\/$/, "") + "/api/tracker/upload";
    const res = await fetch(endpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-tracker-key": apiKey },
      body:    JSON.stringify({ matchData, myRiotId: riotId }),
    });
    const data = await res.json();
    if (res.status === 409) return { duplicate: true, ...data };
    if (!res.ok)            return { error: data.error || `HTTP ${res.status}` };
    return { success: true, ...data };
  } catch (err) { return { error: err.message }; }
}

// ── Start watching ────────────────────────────────────────────────────────────
function startWatcher() {
  if (watcher) { watcher.close(); watcher = null; }
  const paths = getValorantWatchPaths();
  const validPaths = paths.filter(p => { try { return fs.existsSync(p); } catch { return false; } });

  if (!validPaths.length) {
    sendStatus("watching", false);
    sendLog("⚠ Valorant log folder not found. Will retry when a match finishes.");
    return;
  }

  watcher = chokidar.watch(validPaths, {
    ignored:    /^\./, persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 200 },
  });

  watcher.on("add",    filePath => handleNewFile(filePath));
  watcher.on("change", filePath => handleNewFile(filePath));
  sendStatus("watching", true);
  sendLog("👀 Watching for new matches…");
}

const recentUploads = new Set();
async function handleNewFile(filePath) {
  if (!filePath.endsWith(".json")) return;
  if (recentUploads.has(filePath)) return;
  recentUploads.add(filePath);
  setTimeout(() => recentUploads.delete(filePath), 30000);

  sendLog(`📂 New file detected: ${path.basename(filePath)}`);
  const result = await uploadMatch(filePath);

  if (result.duplicate) {
    sendLog("⏭ Already uploaded — skipping.");
  } else if (result.success) {
    sendLog(`✅ Match uploaded! ${result.scrim?.map || ""} vs ${result.scrim?.opp || ""}`);
    sendLastMatch(result.scrim);
  } else if (result.error === "Not a match file") {
    // Silently ignore non-match files
    recentUploads.delete(filePath);
  } else {
    sendLog(`❌ Upload failed: ${result.error}`);
  }
}

function sendStatus(key, val) {
  mainWindow?.webContents?.send("status", { key, val });
}
function sendLog(msg) {
  mainWindow?.webContents?.send("log", { msg, ts: new Date().toLocaleTimeString() });
}
function sendLastMatch(scrim) {
  mainWindow?.webContents?.send("last-match", scrim);
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle("get-config", () => ({
  apiUrl:  store.get("apiUrl",  "https://tracker2-ten.vercel.app"),
  apiKey:  store.get("apiKey",  ""),
  riotId:  store.get("riotId",  ""),
}));

ipcMain.handle("save-config", (_, cfg) => {
  store.set("apiUrl",  cfg.apiUrl  || "");
  store.set("apiKey",  cfg.apiKey  || "");
  store.set("riotId",  cfg.riotId  || "");
  startWatcher();
  return { success: true };
});

ipcMain.handle("test-connection", async () => {
  const apiUrl = store.get("apiUrl", "");
  const apiKey = store.get("apiKey", "");
  if (!apiUrl || !apiKey) return { error: "Fill in API URL and API Key first" };
  try {
    const res = await fetch(apiUrl.replace(/\/$/, "") + "/api/scrims", {
      headers: { "x-tracker-key": apiKey },
    });
    // 401 = key auth not on this endpoint but server reached
    if (res.status === 401 || res.status === 200) return { success: true };
    return { error: `Server returned ${res.status}` };
  } catch (err) { return { error: err.message }; }
});

ipcMain.handle("open-dashboard", () => {
  const url = store.get("apiUrl", "https://tracker2-ten.vercel.app")
    .replace("tracker2-ten.vercel.app", "tracker2-cje.pages.dev");
  shell.openExternal(url);
});

ipcMain.handle("get-last-match", () => store.get("lastMatch", null));

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:  440,
    height: 680,
    resizable: false,
    frame: false,         // custom title bar
    transparent: false,
    backgroundColor: "#0d0d0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration:  false,
    },
    icon: path.join(__dirname, "../assets/icon.ico"),
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.on("close", e => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, "../assets/icon.ico");
  const img = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = new Tray(img.resize({ width: 16, height: 16 }));
  tray.setToolTip("RA Tracker");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open RA Tracker", click: () => mainWindow?.show() },
    { label: "Open Dashboard",  click: () => ipcMain.emit("open-dashboard") },
    { type: "separator" },
    { label: "Quit",            click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on("double-click", () => mainWindow?.show());
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  startWatcher();
});

app.on("window-all-closed", e => e.preventDefault()); // stay in tray
app.on("before-quit",       () => { isQuitting = true; });

// Title bar drag / controls
ipcMain.on("window-minimize", () => mainWindow?.minimize());
ipcMain.on("window-close",    () => mainWindow?.hide());
