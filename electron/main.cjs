// Electron 主进程：开一个原生窗口，把 dist/ 里的界面装进去，
// 并负责文件系统相关的 IPC（读写、目录扫描、本地图片路径）。
const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

const MARKDOWN_RE = /\.(md|markdown|mdown|mkd)$/i
const SKIP_DIRS = new Set([
  '.git', '.svn', '.hg', 'node_modules', 'dist', 'build', 'out',
  '.next', '.nuxt', '.cache', '.turbo', 'coverage', 'vendor',
])
const MAX_FILES = 4000
const MAX_DEPTH = 12

let mainWindow = null
/** 启动时命令行带来的文件（用于「双击 .md 打开」） */
let pendingFiles = []

function fileFromArgv(argv) {
  // 打包后 argv[0] 是 exe；开发时 argv[1] 是项目目录
  return argv
    .slice(1)
    .filter((arg) => !arg.startsWith('-') && MARKDOWN_RE.test(arg))
    .map((arg) => path.resolve(arg))
}

function sendOpenFiles(files) {
  if (files.length === 0) return
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:open-files', files)
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  } else {
    pendingFiles = files
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: '#f5f6f9',
    title: 'Markdown 预览器',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const devUrl = process.env.MDP_DEV_URL
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingFiles.length > 0) {
      sendOpenFiles(pendingFiles)
      pendingFiles = []
    }
  })

  // 站外链接交给系统浏览器，不要在应用窗口里打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开文件…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              title: '打开 Markdown 文件',
              properties: ['openFile'],
              filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }],
            })
            if (!result.canceled && result.filePaths[0]) sendOpenFiles([result.filePaths[0]])
          },
        },
        {
          label: '打开文件夹…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              title: '打开文档目录',
              properties: ['openDirectory'],
            })
            if (!result.canceled && result.filePaths[0]) {
              mainWindow.webContents.send('app:open-folder', result.filePaths[0])
            }
          },
        },
        { type: 'separator' },
        { label: '关闭窗口', role: 'close' },
        { label: '退出', role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/* ------------------------------------------------------------------ */
/* 文件系统 IPC                                                         */
/* ------------------------------------------------------------------ */

async function scanDirectory(root) {
  const files = []
  async function walk(dir, prefix, depth) {
    if (files.length >= MAX_FILES || depth > MAX_DEPTH) return
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) return
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
      const full = path.join(dir, entry.name)
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        await walk(full, rel, depth + 1)
        continue
      }
      if (!MARKDOWN_RE.test(entry.name)) continue
      try {
        const stat = await fs.stat(full)
        files.push({ rel, size: stat.size, mtime: stat.mtimeMs })
      } catch {
        /* 单个文件读不到就跳过 */
      }
    }
  }
  await walk(root, '', 0)
  return { rootName: path.basename(root), files }
}

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 Markdown 文件',
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }],
  })
  return result.canceled ? null : result.filePaths[0] ?? null
})

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开文档目录',
    properties: ['openDirectory'],
  })
  return result.canceled ? null : result.filePaths[0] ?? null
})

ipcMain.handle('fs:scan', async (_event, root) => scanDirectory(root))

ipcMain.handle('fs:read', async (_event, filePath) => fs.readFile(filePath, 'utf8'))

ipcMain.handle('fs:write', async (_event, filePath, text) => {
  await fs.writeFile(filePath, text, 'utf8')
  const stat = await fs.stat(filePath)
  return { mtime: stat.mtimeMs, size: stat.size }
})

ipcMain.handle('fs:stat', async (_event, filePath) => {
  try {
    const stat = await fs.stat(filePath)
    return { mtime: stat.mtimeMs, size: stat.size }
  } catch {
    return null
  }
})

ipcMain.handle('fs:exists', async (_event, filePath) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
})

ipcMain.on('shell:reveal', (_event, filePath) => {
  shell.showItemInFolder(filePath)
})

ipcMain.handle('app:initial', () => {
  const files = pendingFiles
  pendingFiles = []
  return files
})

/* ------------------------------------------------------------------ */
/* 启动                                                                 */
/* ------------------------------------------------------------------ */

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  pendingFiles = fileFromArgv(process.argv)

  app.on('second-instance', (_event, argv) => {
    const files = fileFromArgv(argv)
    if (files.length > 0) sendOpenFiles(files)
    else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    buildMenu()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
