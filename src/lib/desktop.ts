import type { DocEntry, Library } from '../types'

export interface DesktopScan {
  rootName: string
  files: { rel: string; size: number; mtime: number }[]
}

export interface DesktopBridge {
  isDesktop: true
  platform: string
  openFileDialog(): Promise<string | null>
  openFolderDialog(): Promise<string | null>
  scan(root: string): Promise<DesktopScan>
  read(filePath: string): Promise<string>
  write(filePath: string, text: string): Promise<{ mtime: number; size: number }>
  stat(filePath: string): Promise<{ mtime: number; size: number } | null>
  exists(filePath: string): Promise<boolean>
  toUrl(filePath: string): string
  reveal(filePath: string): void
  initialFiles(): Promise<string[]>
  onOpenFiles(callback: (files: string[]) => void): () => void
  onOpenFolder(callback: (folder: string) => void): () => void
}

type WindowWithDesktop = Window & { desktop?: DesktopBridge }

export const desktopBridge: DesktopBridge | null =
  typeof window !== 'undefined' ? ((window as WindowWithDesktop).desktop ?? null) : null

export const isDesktop = desktopBridge !== null

function joinPath(root: string, rel: string): string {
  const base = root.replace(/[\\/]+$/, '')
  const separator = base.includes('\\') ? '\\' : '/'
  return `${base}${separator}${rel.split('/').join(separator)}`
}

function dirName(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return index < 0 ? '' : filePath.slice(0, index)
}

function baseName(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return index < 0 ? filePath : filePath.slice(index + 1)
}

function dirOf(rel: string): string {
  const index = rel.lastIndexOf('/')
  return index < 0 ? '' : rel.slice(0, index)
}

function rank(doc: DocEntry): number {
  return /(^|\/)readme\.md$/i.test(doc.path) ? 0 : 1
}

function compareDocs(a: DocEntry, b: DocEntry): number {
  const byRank = rank(a) - rank(b)
  if (byRank !== 0) return byRank
  return a.path.localeCompare(b.path, 'zh-Hans-CN', { numeric: true })
}

/** 把相对路径解析成绝对路径；越出根目录则返回 null */
function resolveInside(root: string, docPath: string, src: string): string | null {
  const decoded = decodeURIComponent(src.split(/[?#]/)[0])
  if (decoded.startsWith('/') || /^[a-zA-Z]:/.test(decoded)) return null
  const base = docPath.includes('/') ? docPath.slice(0, docPath.lastIndexOf('/')) : ''
  const segments = `${base}/${decoded}`.split('/')
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
  return joinPath(root, stack.join('/'))
}

/**
 * 桌面版文档库：直接读写本地路径，不需要浏览器授权，
 * 所以刷新后也能凭路径恢复（origin.kind === 'path'）。
 */
export async function libraryFromDesktop(mode: 'file' | 'dir', target: string): Promise<Library> {
  const api = desktopBridge
  if (!api) throw new Error('桌面能力不可用')

  if (mode === 'file') {
    const stat = await api.stat(target)
    if (!stat) throw new Error(`文件不存在：${target}`)
    const name = baseName(target)
    const entry: DocEntry = { path: name, name, dir: '', size: stat.size, mtime: stat.mtime }

    return {
      kind: 'single',
      rootName: name,
      docs: [entry],
      watchable: true,
      origin: { kind: 'path', root: target, isDir: false },
      readDoc: () => api.read(target),
      stat: () => api.stat(target),
      writeDoc: async (_path, text) => {
        await api.write(target, text)
      },
      async resolveAsset(_docPath, src) {
        if (!src || /^(https?:|data:|blob:|mailto:|\/\/|#)/i.test(src)) return null
        const resolved = resolveInside(dirName(target), '', src)
        if (!resolved) return null
        return (await api.exists(resolved)) ? api.toUrl(resolved) : null
      },
      dispose() {
        /* 路径来源没有需要释放的资源 */
      },
    }
  }

  const { rootName, files } = await api.scan(target)
  const docs = files
    .map((file) => ({
      path: file.rel,
      name: baseName(file.rel),
      dir: dirOf(file.rel),
      size: file.size,
      mtime: file.mtime,
    }))
    .sort(compareDocs)

  return {
    kind: 'directory',
    rootName,
    docs,
    watchable: true,
    origin: { kind: 'path', root: target, isDir: true },
    readDoc: (path) => api.read(joinPath(target, path)),
    stat: (path) => api.stat(joinPath(target, path)),
    writeDoc: async (path, text) => {
      await api.write(joinPath(target, path), text)
    },
    async resolveAsset(docPath, src) {
      if (!src || /^(https?:|data:|blob:|mailto:|\/\/|#)/i.test(src)) return null
      const resolved = resolveInside(target, docPath, src)
      if (!resolved) return null
      return (await api.exists(resolved)) ? api.toUrl(resolved) : null
    },
    dispose() {
      /* 路径来源没有需要释放的资源 */
    },
  }
}

export function pathExtension(filePath: string): string {
  const name = baseName(filePath)
  const index = name.lastIndexOf('.')
  return index < 0 ? '' : name.slice(index).toLowerCase()
}

export { baseName as desktopBaseName, dirName as desktopDirName }
