const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ra", {
  getConfig:       ()      => ipcRenderer.invoke("get-config"),
  saveConfig:      (cfg)   => ipcRenderer.invoke("save-config", cfg),
  testConnection:  ()      => ipcRenderer.invoke("test-connection"),
  openDashboard:   ()      => ipcRenderer.invoke("open-dashboard"),
  getLastMatch:    ()      => ipcRenderer.invoke("get-last-match"),

  onStatus:        (cb)    => ipcRenderer.on("status",     (_, d) => cb(d)),
  onLog:           (cb)    => ipcRenderer.on("log",        (_, d) => cb(d)),
  onLastMatch:     (cb)    => ipcRenderer.on("last-match", (_, d) => cb(d)),

  windowMinimize:  ()      => ipcRenderer.send("window-minimize"),
  windowClose:     ()      => ipcRenderer.send("window-close"),
});
