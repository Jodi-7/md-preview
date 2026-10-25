import type { DocEntry, DocStat, Library, LibraryKind } from '../types'
import { DEMO_MARKDOWN } from './demo'
import { searchDocs } from './search'

const MARKDOWN_RE = /\.(md|markdown|mdown|mkd)$/i
const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i

/** 体积保护：误选一个巨型仓库时不至于卡死 */
const MAX_FILES = 4000
const MAX_DEPTH = 12
const SKIP_DIRS = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.cache',
  '.turbo',
  'coverage',
  'vendor',
])

export function isMarkdownFile(name: string): boolean {
  return MARKDOWN_RE.test(name)
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/')
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/')
  return i < 0 ? '' : path.slice(0, i)
}

function baseOf(path: string): string {
  const i = path.lastIndexOf('/')
  return i < 0 ? path : path.slice(i + 1)
}

/** 从文档路径出发解析相对资源路径，并挡住跳出根目录的 ../ */
function resolveRelative(docPath: string, src: string): string | null {
  const decoded = decodeURIComponent(src.split(/[?#]/)[0])
  const startDir = decoded.startsWith('/') ? '' : dirOf(docPath)
  const segments = `${startDir}/${decoded.replace(/^\//, '')}`.split('/')
  const stack: string[] = []

  for (const segment of segments) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (stack.length === 0) return null
      stack.pop()
      continue
    }
    stack.push(segment)
  }
  return stack.join('/')
}

function compareDocs(a: DocEntry, b: DocEntry): number {
  const rank = (d: DocEntry) => (/(^|\/)readme\.md$/i.test(d.path) ? 0 : 1)
  const byRank = rank(a) - rank(b)
  if (byRank !== 0) return byRank
  return a.path.localeCompare(b.path, 'zh-Hans-CN', { numeric: true })
}

/* ------------------------------------------------------------------ */
/* 来源一：File 列表（拖拽、普通选择器）——快照，无法监听改动            */
/* ------------------------------------------------------------------ */

export function libraryFromFiles(files: File[], kind: LibraryKind): Library {
  if (kind === 'demo') return demoLibrary()

  const withPath = files.map((file) => ({
    file,
    raw: normalizePath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name),
  }))

  const roots = new Set(withPath.map((item) => item.raw.split('/')[0]))
  const hasNested = withPath.some((item) => item.raw.includes('/'))
  const root = kind === 'directory' && hasNested && roots.size === 1 ? [...roots][0] : ''
  const stripLen = root ? root.length + 1 : 0

  const fileMap = new Map<string, File>()
  for (const item of withPath) {
    const path = kind === 'directory' ? item.raw.slice(stripLen) : baseOf(item.raw)
    if (path) fileMap.set(path, item.file)
  }

  // 只把 Markdown 收进文档列表；其余文件只用于解析图片等引用
  const docs: DocEntry[] = []
  for (const [path, file] of fileMap) {
    if (!MARKDOWN_RE.test(path)) continue
    docs.push({ path, name: baseOf(path), dir: dirOf(path), size: file.size, mtime: file.lastModified })
  }
  docs.sort(compareDocs)

  const objectUrls: string[] = []
  const cache = new Map<string, string>()

  const toObjectUrl = (key: string, file: File): string => {
    const cached = cache.get(key)
    if (cached) return cached
    const url = URL.createObjectURL(file)
    cache.set(key, url)
    objectUrls.push(url)
    return url
  }

  return {
    kind,
    rootName: kind === 'single' ? baseOf(files[0]?.name ?? '未命名') : root || '已打开的目录',
    docs,
    watchable: false,
    // 拖拽/普通选择器拿到的是一次性快照；带 origin 后内容会存进会话，刷新可恢复
    origin: { kind: 'snapshot' },
    async readDoc(path) {
      const file = fileMap.get(path)
      if (!file) throw new Error(`找不到文件：${path}`)
      return file.text()
    },
    search(query) {
      return searchDocs(docs, query, (path) => {
        const file = fileMap.get(path)
        if (!file) throw new Error(`找不到文件：${path}`)
        return file.text()
      })
    },
    async resolveAsset(docPath, src) {
      if (!src || /^(https?:|data:|blob:|mailto:|\/\/|#)/i.test(src)) return null
      const target = resolveRelative(docPath, src)
      if (!target) return null

      const exact = fileMap.get(target)
      if (exact) return toObjectUrl(target, exact)

      for (const [path, file] of fileMap) {
        if (IMAGE_RE.test(path) && path.endsWith(`/${target}`)) return toObjectUrl(path, file)
      }
      return null
    },
    dispose() {
      for (const url of objectUrls) URL.revokeObjectURL(url)
      objectUrls.length = 0
      cache.clear()
    },
  }
}

/** 用一段文本构造临时文档库 */
export function libraryFromText(name: string, text: string): Library {
  const path = MARKDOWN_RE.test(name) ? name : `${name || '未命名'}.md`
  return {
    kind: 'single',
    rootName: path,
    docs: [{ path, name: path, dir: '', size: text.length, mtime: Date.now() }],
    watchable: false,
    origin: { kind: 'snapshot' },
    async readDoc() {
      return text
    },
    search(query) {
      return searchDocs(
        [{ path, name: path, dir: '', size: text.length, mtime: Date.now() }],
        query,
        async () => text,
      )
    },
    async resolveAsset() {
      return null
    },
    dispose() {
      /* 文本来源没有需要释放的资源 */
    },
  }
}

/**
 * 用内存文本重建一个快照库（会话恢复用）。
 * 快照没有目录上下文，相对图片解析不了，与单文件模式的降级一致。
 */
export function libraryFromSnapshot(
  entries: { path: string; name: string; text: string }[],
  rootName: string,
): Library {
  const contents = new Map(entries.map((entry) => [entry.path, entry.text]))
  const docs: DocEntry[] = entries.map((entry) => ({
    path: entry.path,
    name: entry.name,
    dir: dirOf(entry.path),
    size: entry.text.length,
    mtime: Date.now(),
  }))
  docs.sort(compareDocs)

  return {
    kind: entries.length > 1 ? 'directory' : 'single',
    rootName,
    docs,
    watchable: false,
    origin: { kind: 'snapshot' },
    async readDoc(path) {
      const text = contents.get(path)
      if (text === undefined) throw new Error(`找不到文件：${path}`)
      return text
    },
    search(query) {
      return searchDocs(docs, query, async (path) => {
        const text = contents.get(path)
        if (text === undefined) throw new Error(`找不到文件：${path}`)
        return text
      })
    },
    async resolveAsset() {
      return null
    },
    dispose() {
      contents.clear()
    },
  }
}

/* ------------------------------------------------------------------ */
/* 来源二：文件系统句柄（File System Access API）——可监听、可写回        */
/* ------------------------------------------------------------------ */

export interface FsFileHandle {
  name: string
  kind: 'file'
  getFile(): Promise<File>
  createWritable(options?: { keepExistingData?: boolean }): Promise<{
    write(data: string): Promise<void>
    close(): Promise<void>
  }>
  queryPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
}

export interface FsDirHandle {
  name: string
  kind: 'directory'
  values(): AsyncIterableIterator<FsFileHandle | FsDirHandle>
  getDirectoryHandle(name: string): Promise<FsDirHandle>
  getFileHandle(name: string): Promise<FsFileHandle>
  queryPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
}

type FsHandle = FsFileHandle | FsDirHandle

/** 递归扫描目录，只收 Markdown；其余类型一律跳过 */
async function scanDirectory(root: FsDirHandle): Promise<{ docs: DocEntry[]; files: Map<string, FsFileHandle> }> {
  const files = new Map<string, FsFileHandle>()
  const docs: DocEntry[] = []

  async function walk(dir: FsDirHandle, prefix: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || files.size >= MAX_FILES) return
    for await (const entry of dir.values()) {
      if (files.size >= MAX_FILES) return
      const path = `${prefix}${entry.name}`

      if (entry.kind === 'directory') {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
        await walk(entry, `${path}/`, depth + 1)
        continue
      }

      // 需求：打开文件夹时只收 Markdown 文档
      if (!MARKDOWN_RE.test(entry.name)) continue

      try {
        const file = await entry.getFile()
        files.set(path, entry)
        docs.push({
          path,
          name: entry.name,
          dir: dirOf(path),
          size: file.size,
          mtime: file.lastModified,
        })
      } catch {
        /* 单个文件读不了就跳过 */
      }
    }
  }

  await walk(root, '', 0)
  docs.sort(compareDocs)
  return { docs, files }
}

async function handleByPath(root: FsDirHandle, rel: string): Promise<FsFileHandle | null> {
  const parts = rel.split('/').filter(Boolean)
  if (parts.length === 0) return null
  try {
    let dir = root
    for (let i = 0; i < parts.length - 1; i += 1) {
      dir = await dir.getDirectoryHandle(parts[i])
    }
    return await dir.getFileHandle(parts[parts.length - 1])
  } catch {
    return null
  }
}

function handleLibrary(root: FsDirHandle, kind: LibraryKind): Promise<Library> {
  return scanDirectory(root).then(({ docs, files }) => {
    const objectUrls: string[] = []
    const assetCache = new Map<string, string>()

    return {
      kind,
      rootName: root.name,
      docs,
      watchable: true,
      origin: { kind: 'dir', handle: root },
      async readDoc(path) {
        const handle = files.get(path)
        if (!handle) throw new Error(`找不到文件：${path}`)
        const file = await handle.getFile()
        return file.text()
      },
      async stat(path): Promise<DocStat | null> {
        const handle = files.get(path)
        if (!handle) return null
        const file = await handle.getFile()
        return { mtime: file.lastModified, size: file.size }
      },
      async writeDoc(path, text) {
        const handle = files.get(path)
        if (!handle) throw new Error(`找不到文件：${path}`)

        const permission = await root.queryPermission?.({ mode: 'readwrite' })
        if (permission && permission !== 'granted') {
          const next = await root.requestPermission?.({ mode: 'readwrite' })
          if (next !== 'granted') throw new Error('没有写入权限')
        }

        const writable = await handle.createWritable()
        await writable.write(text)
        await writable.close()
      },
      search(query) {
        return searchDocs(docs, query, (path) => {
          const handle = files.get(path)
          if (!handle) throw new Error(`找不到文件：${path}`)
          return handle.getFile().then((file) => file.text())
        })
      },
      async resolveAsset(docPath, src) {
        if (!src || /^(https?:|data:|blob:|mailto:|\/\/|#)/i.test(src)) return null
        const target = resolveRelative(docPath, src)
        if (!target) return null

        const cached = assetCache.get(target)
        if (cached) return cached

        const handle = await handleByPath(root, target)
        if (!handle) return null
        try {
          const file = await handle.getFile()
          const url = URL.createObjectURL(file)
          assetCache.set(target, url)
          objectUrls.push(url)
          return url
        } catch {
          return null
        }
      },
      dispose() {
        for (const url of objectUrls) URL.revokeObjectURL(url)
        objectUrls.length = 0
        assetCache.clear()
      },
    }
  })
}

/** 打开整个目录（可监听、可保存） */
export function libraryFromDirectoryHandle(root: FsDirHandle): Promise<Library> {
  return handleLibrary(root, 'directory')
}

/** 打开单个文件（可监听、可保存） */
export async function libraryFromFileHandle(handle: FsFileHandle): Promise<Library> {
  const file = await handle.getFile()
  if (!MARKDOWN_RE.test(handle.name)) {
    throw new Error('只能打开 Markdown 文件（.md / .markdown / .mdown / .mkd）')
  }

  const entry: DocEntry = {
    path: handle.name,
    name: handle.name,
    dir: '',
    size: file.size,
    mtime: file.lastModified,
  }

  return {
    kind: 'single',
    rootName: handle.name,
    docs: [entry],
    watchable: true,
    origin: { kind: 'file', handle },
    async readDoc() {
      return (await handle.getFile()).text()
    },
    async stat() {
      const next = await handle.getFile()
      return { mtime: next.lastModified, size: next.size }
    },
    async writeDoc(_path, text) {
      const permission = await handle.queryPermission?.({ mode: 'readwrite' })
      if (permission && permission !== 'granted') {
        const asked = await handle.requestPermission?.({ mode: 'readwrite' })
        if (asked !== 'granted') throw new Error('没有写入权限')
      }
      const writable = await handle.createWritable()
      await writable.write(text)
      await writable.close()
    },
    search(query) {
      return searchDocs([entry], query, async () => (await handle.getFile()).text())
    },
    async resolveAsset() {
      return null
    },
    dispose() {
      /* 单文件没有需要释放的资源 */
    },
  }
}

/* ------------------------------------------------------------------ */
/* 示例                                                                 */
/* ------------------------------------------------------------------ */

function demoLibrary(): Library {
  return {
    kind: 'demo',
    rootName: '示例文档',
    docs: [{ path: 'Demo.md', name: 'Demo.md', dir: '', size: DEMO_MARKDOWN.length, mtime: Date.now() }],
    watchable: false,
    origin: { kind: 'demo' },
    async readDoc() {
      return DEMO_MARKDOWN
    },
    search(query) {
      return searchDocs(
        [{ path: 'Demo.md', name: 'Demo.md', dir: '', size: DEMO_MARKDOWN.length, mtime: Date.now() }],
        query,
        async () => DEMO_MARKDOWN,
      )
    },
    async resolveAsset() {
      return null
    },
    dispose() {
      /* 示例文档没有需要释放的资源 */
    },
  }
}

/* ------------------------------------------------------------------ */
/* 拖放                                                                 */
/* ------------------------------------------------------------------ */

export async function filesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const items = Array.from(dataTransfer.items ?? [])

  // webkitGetAsEntry 只在事件的同步阶段有效，先一次性取完再异步读内容
  const entries = items
    .filter((item) => item.kind === 'file')
    .map((item) => (typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null))

  if (entries.some((entry) => entry !== null)) {
    const out: File[] = []
    for (const entry of entries) {
      if (entry) await walkEntry(entry, '', out, 0)
    }
    return out
  }

  return Array.from(dataTransfer.files ?? [])
}

async function walkEntry(entry: FileSystemEntry, prefix: string, out: File[], depth: number): Promise<void> {
  if (out.length >= MAX_FILES || depth > MAX_DEPTH) return

  if (entry.isFile) {
    try {
      const file = await new Promise<File>((resolve, reject) => {
        ;(entry as FileSystemFileEntry).file(resolve, reject)
      })
      Object.defineProperty(file, 'webkitRelativePath', {
        value: `${prefix}${entry.name}`,
        configurable: true,
      })
      out.push(file)
    } catch {
      /* 单个文件读不了就跳过，不影响其余文档 */
    }
    return
  }

  if (!entry.isDirectory) return
  if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) return

  const reader = (entry as FileSystemDirectoryEntry).createReader()
  const all: FileSystemEntry[] = []
  // readEntries 每次最多返回 100 条，必须循环读到空数组为止
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    if (batch.length === 0) break
    all.push(...batch)
  }

  for (const child of all) {
    await walkEntry(child, `${prefix}${entry.name}/`, out, depth + 1)
  }
}

export type { FsHandle }
