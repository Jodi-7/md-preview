// 预加载脚本：只把必要的文件能力暴露给界面，界面拿不到 Node。
const { contextBridge, ipcRenderer } = require('electron')

function toFileUrl(filePath) {
  const normalized = filePath.replace(/\\/g, '/')
  const encoded = normalized
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `file:///${encoded.replace(/^\/+/, '')}`
}

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,

  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  scan: (root) => ipcRenderer.invoke('fs:scan', root),
  read: (filePath) => ipcRenderer.invoke('fs:read', filePath),
  write: (filePath, text) => ipcRenderer.invoke('fs:write', filePath, text),
  stat: (filePath) => ipcRenderer.invoke('fs:stat', filePath),
  exists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
  toUrl: (filePath) => toFileUrl(filePath),
  reveal: (filePath) => ipcRenderer.send('shell:reveal', filePath),
  initialFiles: () => ipcRenderer.invoke('app:initial'),

  onOpenFiles: (callback) => {
    const listener = (_event, files) => callback(files)
    ipcRenderer.on('app:open-files', listener)
    return () => ipcRenderer.removeListener('app:open-files', listener)
  },
  onOpenFolder: (callback) => {
    const listener = (_event, folder) => callback(folder)
    ipcRenderer.on('app:open-folder', listener)
    return () => ipcRenderer.removeListener('app:open-folder', listener)
  },
})
