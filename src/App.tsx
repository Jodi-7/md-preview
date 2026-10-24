import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ContentWidth,
  FontSize,
  Library,
  LibraryKind,
  OutlineItem,
  Tab,
  Theme,
  ViewMode,
} from './types'
import {
  filesFromDataTransfer,
  libraryFromDirectoryHandle,
  libraryFromFileHandle,
  libraryFromFiles,
  libraryFromText,
  type FsDirHandle,
  type FsFileHandle,
} from './lib/files'
import { countWords, renderMarkdown } from './lib/markdown'
import { loadPrefs, savePrefs, type Prefs } from './lib/prefs'
import {
  ensureReadPermission,
  loadSession,
  saveSession,
  type StoredTab,
} from './lib/session'
import { desktopBridge, libraryFromDesktop } from './lib/desktop'
import { useScrollSync } from './lib/useScrollSync'
import { FileTree } from './components/FileTree'
import { Outline } from './components/Outline'
import { Toolbar } from './components/Toolbar'
import { TabBar } from './components/TabBar'
import { Editor } from './components/Editor'
import { DocumentView } from './components/DocumentView'
import { EmptyState } from './components/EmptyState'
import { PasteDialog } from './components/PasteDialog'

type SidebarTab = 'files' | 'outline'

const FONT_SCALE: Record<FontSize, number> = { sm: 0.92, md: 1, lg: 1.13 }
const WATCH_INTERVAL = 900

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FsDirHandle>
  showOpenFilePicker?: (options?: {
    multiple?: boolean
    types?: { description?: string; accept: Record<string, string[]> }[]
  }) => Promise<FsFileHandle[]>
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export default function App() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [view, setView] = useState<ViewMode>('read')
  const [library, setLibrary] = useState<Library | null>(null)
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [activeHeading, setActiveHeading] = useState('')
  const [tab, setTab] = useState<SidebarTab>('files')
  const [query, setQuery] = useState('')
  const [dragging, setDragging] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [restoreCandidates, setRestoreCandidates] = useState<StoredTab[]>([])

  const contentRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)

  const tabsRef = useRef<Tab[]>([])
  const activeIdRef = useRef<string | null>(null)
  const librariesRef = useRef<Library[]>([])
  const scrollMap = useRef(new Map<string, number>())
  const watchBusy = useRef(false)
  const pendingFocus = useRef<string | null>(null)
  const editTimer = useRef<number | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    tabsRef.current = tabs
  }, [tabs])

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme
    savePrefs(prefs)
  }, [prefs])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const activeTab = useMemo(() => tabs.find((item) => item.id === activeId) ?? null, [tabs, activeId])

  /* ---------------- 打开文档 ---------------- */

  const openTab = useCallback(async (lib: Library, path: string, name: string): Promise<string | null> => {
    const id = `${lib.rootName}::${path}`
    if (tabsRef.current.some((item) => item.id === id)) {
      setActiveId(id)
      return id
    }

    setLoading(true)
    try {
      const text = await lib.readDoc(path)
      const stat = lib.stat ? await lib.stat(path) : null
      const next: Tab = {
        id,
        path,
        name,
        rootName: lib.rootName,
        lib,
        text,
        savedText: text,
        html: renderMarkdown(text),
        mtime: stat?.mtime ?? Date.now(),
        source: lib.origin,
        read: () => lib.readDoc(path),
        stat: lib.stat ? () => lib.stat!(path) : undefined,
        write: lib.writeDoc ? (value: string) => lib.writeDoc!(path, value) : undefined,
      }
      setTabs((prev) => (prev.some((item) => item.id === id) ? prev : [...prev, next]))
      setActiveId(id)
      return id
    } catch (error) {
      setToast(`打开失败：${messageOf(error)}`)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const adoptLibrary = useCallback(
    (lib: Library, announce?: string) => {
      librariesRef.current.push(lib)
      setLibrary(lib)
      setQuery('')
      setTab('files')
      if (lib.docs[0]) void openTab(lib, lib.docs[0].path, lib.docs[0].name)
      if (announce) setToast(announce)
    },
    [openTab],
  )

  const openFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      const relative = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath
      const kind: LibraryKind = files.length === 1 && !relative ? 'single' : 'directory'
      const lib = libraryFromFiles(files, kind)

      if (lib.docs.length === 0) {
        lib.dispose()
        setToast(
          kind === 'single'
            ? '这个文件不是 Markdown，只支持 .md / .markdown / .mdown / .mkd'
            : '这个目录里没有 Markdown 文件',
        )
        return
      }
      adoptLibrary(
        lib,
        lib.watchable
          ? undefined
          : kind === 'directory'
            ? `已打开 ${lib.docs.length} 篇 Markdown（拖入的模式不支持自动刷新）`
            : undefined,
      )
    },
    [adoptLibrary],
  )

  const handleDropped = useCallback(
    async (dataTransfer: DataTransfer) => {
      // 桌面版：拖进来的东西带真实路径，直接按路径打开，能拿到监听与保存能力
      if (desktopBridge) {
        const dropped = Array.from(dataTransfer.files ?? []) as (File & { path?: string })[]
        const target = dropped.find((file) => file.path)?.path
        if (target) {
          const looksMarkdown = /\.(md|markdown|mdown|mkd)$/i.test(target)
          try {
            const lib = await libraryFromDesktop(looksMarkdown ? 'file' : 'dir', target)
            if (lib.docs.length === 0) {
              setToast('这个目录里没有 Markdown 文件')
              return
            }
            adoptLibrary(lib)
          } catch (error) {
            setToast(`打开失败：${messageOf(error)}`)
          }
          return
        }
      }

      try {
        const files = await filesFromDataTransfer(dataTransfer)
        if (files.length === 0) {
          setToast('没有识别到文件，试试用「打开文件夹」')
          return
        }
        await openFiles(files)
      } catch {
        setToast('读取拖入的文件失败，请改用「打开文件夹」')
      }
    },
    [adoptLibrary, openFiles],
  )

  const openFolderPicker = useCallback(async () => {
    if (desktopBridge) {
      const target = await desktopBridge.openFolderDialog()
      if (!target) return
      try {
        const lib = await libraryFromDesktop('dir', target)
        if (lib.docs.length === 0) {
          setToast('这个目录里没有 Markdown 文件')
          return
        }
        adoptLibrary(lib, `已打开 ${lib.docs.length} 篇 Markdown，改动会自动刷新`)
      } catch (error) {
        setToast(`打开目录失败：${messageOf(error)}`)
      }
      return
    }

    const picker = (window as PickerWindow).showDirectoryPicker
    if (!picker) {
      folderInputRef.current?.click()
      return
    }
    try {
      const dir = await picker.call(window, { mode: 'read' })
      const lib = await libraryFromDirectoryHandle(dir)
      if (lib.docs.length === 0) {
        setToast('这个目录里没有 Markdown 文件')
        return
      }
      adoptLibrary(lib, `已打开 ${lib.docs.length} 篇 Markdown，改动会自动刷新`)
    } catch (error) {
      if (!isAbort(error)) setToast(`打开目录失败：${messageOf(error)}`)
    }
  }, [adoptLibrary])

  const openFilePicker = useCallback(async () => {
    if (desktopBridge) {
      const target = await desktopBridge.openFileDialog()
      if (!target) return
      try {
        adoptLibrary(await libraryFromDesktop('file', target))
      } catch (error) {
        setToast(`打开失败：${messageOf(error)}`)
      }
      return
    }

    const picker = (window as PickerWindow).showOpenFilePicker
    if (!picker) {
      fileInputRef.current?.click()
      return
    }
    try {
      const [handle] = await picker.call(window, {
        multiple: false,
        types: [
          {
            description: 'Markdown',
            accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.mkd'] },
          },
        ],
      })
      const lib = await libraryFromFileHandle(handle)
      adoptLibrary(lib)
    } catch (error) {
      if (!isAbort(error)) setToast(`打开失败：${messageOf(error)}`)
    }
  }, [adoptLibrary])

  /* ---------------- 标签页 ---------------- */

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const index = prev.findIndex((item) => item.id === id)
      const next = prev.filter((item) => item.id !== id)
      if (activeIdRef.current === id) {
        const target = next[Math.min(index, next.length - 1)]
        setActiveId(target ? target.id : null)
      }
      return next
    })
    scrollMap.current.delete(id)
  }, [])

  const closeAll = useCallback(() => {
    setTabs([])
    setActiveId(null)
    scrollMap.current.clear()
  }, [])

  const closeOthers = useCallback(() => {
    const current = activeIdRef.current
    if (!current) return
    setTabs((prev) => prev.filter((item) => item.id === current))
    for (const key of [...scrollMap.current.keys()]) {
      if (key !== current) scrollMap.current.delete(key)
    }
  }, [])

  /* ---------------- 会话恢复 ---------------- */

  const restoreTabs = useCallback(
    async (items: StoredTab[], preferredId: string | null) => {
      const groups = new Map<string, StoredTab[]>()
      for (const item of items) {
        const key = `${item.kind}:${item.rootName}`
        const list = groups.get(key) ?? []
        list.push(item)
        groups.set(key, list)
      }

      const openedIds: string[] = []
      const failed: StoredTab[] = []

      for (const list of groups.values()) {
        const head = list[0]
        try {
          const lib =
            head.kind === 'demo'
              ? libraryFromFiles([], 'demo')
              : head.kind === 'path'
                ? await libraryFromDesktop(head.isDir ? 'dir' : 'file', head.target ?? '')
                : head.kind === 'dir'
                  ? await libraryFromDirectoryHandle(head.handle as FsDirHandle)
                  : await libraryFromFileHandle(head.handle as FsFileHandle)

          librariesRef.current.push(lib)
          setLibrary(lib)

          for (const item of list) {
            const doc = lib.docs.find((entry) => entry.path === item.path)
            if (!doc) continue
            await openTab(lib, doc.path, doc.name)
            const id = `${lib.rootName}::${doc.path}`
            openedIds.push(id)
            if (item.scrollTop) scrollMap.current.set(id, item.scrollTop)
          }
        } catch {
          failed.push(...list)
        }
      }

      if (preferredId && openedIds.includes(preferredId)) setActiveId(preferredId)
      if (failed.length > 0) setRestoreCandidates(failed)
    },
    [openTab],
  )

  const resumeRestore = useCallback(async () => {
    const items = restoreCandidates
    setRestoreCandidates([])

    const granted: StoredTab[] = []
    const denied: StoredTab[] = []
    for (const item of items) {
      if (item.kind === 'demo') {
        granted.push(item)
        continue
      }
      if (await ensureReadPermission(item.handle)) granted.push(item)
      else denied.push(item)
    }

    if (granted.length > 0) await restoreTabs(granted, null)
    if (denied.length > 0) {
      setRestoreCandidates(denied)
      setToast('还有文档没有拿到授权，可以再点一次「恢复」')
    }
  }, [restoreCandidates, restoreTabs])

  // 只在首次挂载时恢复一次
  const restoredRef = useRef(false)
  const restorePromise = useRef<Promise<void> | null>(null)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    restorePromise.current = (async () => {
      const stored = await loadSession()
      if (!stored || stored.tabs.length === 0) return
      await restoreTabs(stored.tabs, stored.activeId)
    })()
  }, [restoreTabs])

  // 启动参数带来的文件最终要压过会话恢复的结果
  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    if (!tabs.some((item) => item.id === target)) return
    pendingFocus.current = null
    setActiveId(target)
  }, [tabs])

  // 标签或当前文档变化后，把会话写回 IndexedDB
  const persistSession = useCallback(() => {
    const records: StoredTab[] = tabs
      .filter((item) => item.source)
      .map((item) => ({
        id: item.id,
        path: item.path,
        name: item.name,
        rootName: item.rootName,
        kind: item.source!.kind,
        handle: item.source!.handle,
        target: item.source!.root,
        isDir: item.source!.isDir,
        scrollTop: scrollMap.current.get(item.id) ?? 0,
      }))
    void saveSession({ version: 1, updatedAt: Date.now(), activeId, tabs: records })
  }, [tabs, activeId])

  useEffect(() => {
    const timer = window.setTimeout(persistSession, 800)
    return () => window.clearTimeout(timer)
  }, [persistSession])

  // 刷新/关闭页面前再存一次，保证滚动位置是最新的
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') persistSession()
    }
    window.addEventListener('pagehide', persistSession)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', persistSession)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [persistSession])

  /* ---------------- 编辑与保存 ---------------- */

  const updateText = useCallback((text: string) => {
    const id = activeIdRef.current
    if (!id) return
    setTabs((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)))
    window.clearTimeout(editTimer.current)
    editTimer.current = window.setTimeout(() => {
      setTabs((prev) =>
        prev.map((item) => (item.id === id ? { ...item, html: renderMarkdown(item.text) } : item)),
      )
    }, 140)
  }, [])

  const saveActive = useCallback(async () => {
    const id = activeIdRef.current
    const current = tabsRef.current.find((item) => item.id === id)
    if (!current) return
    if (!current.write) {
      setToast('这个来源不支持写回文件，请用「打开文件夹」重新打开')
      return
    }
    try {
      await current.write(current.text)
      const stat = current.stat ? await current.stat() : null
      setTabs((prev) =>
        prev.map((item) =>
          item.id === current.id ? { ...item, savedText: current.text, mtime: stat?.mtime ?? Date.now() } : item,
        ),
      )
      setToast('已保存')
    } catch (error) {
      setToast(`保存失败：${messageOf(error)}`)
    }
  }, [])

  /* ---------------- 文件监听 ---------------- */

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || watchBusy.current) return
      const watchable = tabsRef.current.filter((item) => item.stat)
      if (watchable.length === 0) return

      watchBusy.current = true
      void (async () => {
        try {
          for (const watched of watchable) {
            const stat = await watched.stat?.()
            if (!stat) continue
            const current = tabsRef.current.find((item) => item.id === watched.id)
            if (!current || stat.mtime === current.mtime) continue

            if (current.text !== current.savedText) {
              setToast('磁盘上的文件已更新，但你有未保存的修改，先保存再刷新')
              continue
            }

            try {
              const text = await current.read()
              setTabs((prev) =>
                prev.map((item) =>
                  item.id === current.id
                    ? { ...item, text, savedText: text, html: renderMarkdown(text), mtime: stat.mtime }
                    : item,
                ),
              )
              setToast('检测到文件变化，已自动刷新')
            } catch {
              /* 文件可能被临时占用，下一轮再试 */
            }
          }
        } finally {
          watchBusy.current = false
        }
      })()
    }, WATCH_INTERVAL)

    return () => window.clearInterval(timer)
  }, [])

  /* ---------------- 滚动位置 ---------------- */

  const handleScroll = useCallback(() => {
    const element = contentRef.current
    const id = activeIdRef.current
    if (!element || !id) return
    scrollMap.current.set(id, element.scrollTop)
  }, [])

  useEffect(() => {
    const element = contentRef.current
    if (!element) return
    element.scrollTop = activeId ? (scrollMap.current.get(activeId) ?? 0) : 0
  }, [activeId, view])

  useScrollSync({
    editorRef: textareaRef,
    mirrorRef,
    previewRef: contentRef,
    text: activeTab?.text ?? '',
    enabled: view === 'split' && activeTab !== null,
  })

  /* ---------------- 其余交互 ---------------- */

  const handleOutline = useCallback((items: OutlineItem[]) => setOutline(items), [])
  const handleActiveHeading = useCallback((id: string) => setActiveHeading(id), [])

  const jumpTo = useCallback((id: string) => {
    const target = document.getElementById(id)
    const scroller = contentRef.current
    if (!target || !scroller) return
    const offset = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    scroller.scrollTo({ top: Math.max(0, offset - 20), behavior: 'smooth' })
    setActiveHeading(id)
  }, [])

  const updatePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }))
  }, [])

  const openDemo = useCallback(() => {
    adoptLibrary(libraryFromFiles([], 'demo'))
  }, [adoptLibrary])

  const applyPaste = useCallback(
    (text: string) => {
      setPasteOpen(false)
      adoptLibrary(libraryFromText('粘贴的内容.md', text))
    },
    [adoptLibrary],
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('demo') || window.location.hash === '#demo') openDemo()
  }, [openDemo])

  // 桌面版：启动参数里的文件、菜单打开的文件、第二个实例传入的文件
  useEffect(() => {
    if (!desktopBridge) return
    let disposed = false

    const openPaths = async (paths: string[]) => {
      for (const target of paths) {
        if (disposed) return
        try {
          const lib = await libraryFromDesktop('file', target)
          const doc = lib.docs[0]
          if (!doc) continue
          librariesRef.current.push(lib)
          setLibrary(lib)
          setQuery('')
          setTab('files')
          const id = await openTab(lib, doc.path, doc.name)
          // 会话恢复可能比这里晚完成，用 pendingFocus 保证「刚点开的文件」最终在前台
          if (id) pendingFocus.current = id
        } catch (error) {
          setToast(`打开失败：${messageOf(error)}`)
        }
      }
    }

    // 必须等会话恢复完再打开命令行带来的文件，
    // 否则恢复出来的标签会把「刚点开的文件」顶掉
    // 无论是命令行参数还是第二个实例，都要等会话恢复完再打开，
    // 否则恢复出来的标签会把「刚点开的文件」顶掉
    const scheduleOpen = async (paths: string[]) => {
      await restorePromise.current
      if (!disposed) await openPaths(paths)
    }

    void (async () => {
      await restorePromise.current
      const paths = await desktopBridge.initialFiles()
      if (disposed || paths.length === 0) return
      await openPaths(paths)
    })()

    const offFiles = desktopBridge.onOpenFiles((paths) => void scheduleOpen(paths))
    const offFolder = desktopBridge.onOpenFolder((folder) => {
      void (async () => {
        try {
          const lib = await libraryFromDesktop('dir', folder)
          if (lib.docs.length === 0) {
            setToast('这个目录里没有 Markdown 文件')
            return
          }
          adoptLibrary(lib, `已打开 ${lib.docs.length} 篇 Markdown`)
        } catch (error) {
          setToast(`打开目录失败：${messageOf(error)}`)
        }
      })()
    })

    return () => {
      disposed = true
      offFiles()
      offFolder()
    }
  }, [adoptLibrary])

  // 整页拖放
  useEffect(() => {
    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files')
    let depth = 0

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth += 1
      setDragging(true)
    }
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      if (event.dataTransfer) void handleDropped(event.dataTransfer)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [handleDropped])

  // 全局快捷键：Ctrl/⌘ + S 保存
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveActive()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveActive])

  const dirty = activeTab ? activeTab.text !== activeTab.savedText : false
  const meta = useMemo(() => {
    if (!activeTab) return ''
    return `${countWords(activeTab.text).toLocaleString('zh-CN')} 字`
  }, [activeTab])

  const openPaths = useMemo(() => new Set(tabs.map((item) => item.path)), [tabs])

  const preview = activeTab ? (
    <DocumentView
      html={activeTab.html}
      docPath={activeTab.path}
      library={activeTab.lib}
      fontScale={FONT_SCALE[prefs.fontSize]}
      wide={prefs.width === 'wide'}
      dark={prefs.theme === 'dark'}
      onOutline={handleOutline}
      onActiveHeading={handleActiveHeading}
    />
  ) : null

  return (
    <div className="app">
      <aside className={`sidebar${sidebarOpen ? ' is-open' : ''}`} aria-label="侧栏">
        <div className="side-brand">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <div className="brand-text">
            <strong>Markdown 预览器</strong>
            <span>{library ? `${library.rootName} · 仅 Markdown` : '还没有打开文档'}</span>
          </div>
          <button
            type="button"
            className="icon-btn side-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="收起侧栏"
          >
            ×
          </button>
        </div>

        <div className="side-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'files'}
            className={`tab${tab === 'files' ? ' is-active' : ''}`}
            onClick={() => setTab('files')}
          >
            文件
            {library && <span className="tab-count">{library.docs.length}</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'outline'}
            className={`tab${tab === 'outline' ? ' is-active' : ''}`}
            onClick={() => setTab('outline')}
          >
            大纲
            {outline.length > 0 && <span className="tab-count">{outline.length}</span>}
          </button>
        </div>

        <div className="side-body">
          {tab === 'files' ? (
            <FileTree
              library={library}
              activePath={activeTab?.path ?? null}
              openPaths={openPaths}
              query={query}
              onQueryChange={setQuery}
              onSelect={(path) => {
                if (!library) return
                const doc = library.docs.find((item) => item.path === path)
                if (doc) void openTab(library, doc.path, doc.name)
              }}
              onOpenFiles={() => void openFilePicker()}
              onOpenFolder={() => void openFolderPicker()}
            />
          ) : (
            <Outline outline={outline} activeId={activeHeading} onJump={jumpTo} />
          )}
        </div>

        <div className="side-foot">
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setSidebarOpen(false)
              setPasteOpen(true)
            }}
          >
            粘贴文本
          </button>
          <span className="dot-sep" aria-hidden="true" />
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setSidebarOpen(false)
              openDemo()
            }}
          >
            示例文档
          </button>
        </div>
      </aside>

      <main className="main">
        <Toolbar
          title={activeTab?.name ?? 'Markdown 预览器'}
          path={activeTab ? `${activeTab.rootName} / ${activeTab.path}` : ''}
          meta={meta}
          theme={prefs.theme as Theme}
          fontSize={prefs.fontSize as FontSize}
          width={prefs.width as ContentWidth}
          view={view}
          dirty={dirty}
          canSave={Boolean(activeTab?.write)}
          onTheme={(next) => updatePrefs({ theme: next })}
          onFontSize={(next) => updatePrefs({ fontSize: next })}
          onWidth={(next) => updatePrefs({ width: next })}
          onView={setView}
          onSave={() => void saveActive()}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
        />

        <TabBar
          tabs={tabs}
          activeId={activeId}
          onSelect={setActiveId}
          onClose={closeTab}
          onCloseOthers={closeOthers}
          onCloseAll={closeAll}
        />

        {restoreCandidates.length > 0 && (
          <div className="restore-bar">
            <span>
              上次打开的 {restoreCandidates.length} 个文档需要重新授权才能读取
            </span>
            <button type="button" className="btn btn-primary btn-xs" onClick={() => void resumeRestore()}>
              恢复
            </button>
            <button type="button" className="btn btn-xs" onClick={() => setRestoreCandidates([])}>
              忽略
            </button>
          </div>
        )}

        {loading && <div className="loading-bar" aria-hidden="true" />}

        {view === 'split' && activeTab ? (
          <div className="workspace">
            <Editor
              value={activeTab.text}
              dirty={dirty}
              onChange={updateText}
              onSave={() => void saveActive()}
              textareaRef={textareaRef}
              mirrorRef={mirrorRef}
            />
            <div className="content" ref={contentRef} onScroll={handleScroll}>
              {preview}
            </div>
          </div>
        ) : (
          <div className="content" ref={contentRef} onScroll={handleScroll}>
            {activeTab ? preview : (
              <EmptyState
                onOpenFiles={() => void openFilePicker()}
                onOpenFolder={() => void openFolderPicker()}
                onDemo={openDemo}
                onPaste={() => setPasteOpen(true)}
              />
            )}
          </div>
        )}
      </main>

      {sidebarOpen && (
        <button
          type="button"
          className="scrim"
          aria-label="收起侧栏"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {dragging && (
        <div className="drop-overlay">
          <div className="drop-card">
            <strong>松手即可预览</strong>
            <span>支持单个 .md 文件，也支持整个文档目录</span>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {pasteOpen && <PasteDialog onClose={() => setPasteOpen(false)} onApply={applyPaste} />}

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.mdown,.mkd,text/markdown"
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          void openFiles(files)
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        hidden
        // @ts-expect-error webkitdirectory 是 Chromium/Safari 的非标准属性，React 类型里没有
        webkitdirectory=""
        directory=""
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          void openFiles(files)
        }}
      />
    </div>
  )
}
