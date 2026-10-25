/**
 * 会话持久化：把「上次打开了哪些文档」写进 IndexedDB。
 * 句柄/路径来源存引用，刷新后重读；拖拽/粘贴快照存内容本身（有大小上限）。
 */

const DB_NAME = 'md-preview'
const STORE = 'session'
const KEY = 'current'
const VERSION = 1

export interface StoredTab {
  id: string
  path: string
  name: string
  rootName: string
  kind: 'dir' | 'file' | 'demo' | 'path' | 'snapshot'
  handle?: unknown
  /** 桌面版按绝对路径恢复，不需要授权 */
  target?: string
  isDir?: boolean
  /** 快照来源：把内容一起存下，恢复成只读标签 */
  text?: string
  scrollTop: number
}

export interface StoredSession {
  version: 1
  updatedAt: number
  activeId: string | null
  tabs: StoredTab[]
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const db = await openDb()
    const session = await new Promise<StoredSession | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(KEY)
      request.onsuccess = () => resolve((request.result as StoredSession) ?? null)
      request.onerror = () => reject(request.error)
    })
    db.close()
    if (!session || session.version !== VERSION) return null
    return session
  } catch {
    return null
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(session, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    db.close()
  } catch {
    /* 隐私模式或存储被禁用时静默失败，不影响使用 */
  }
}

/** 请求句柄的读取权限；已授权则直接返回 true */
export async function ensureReadPermission(handle: unknown): Promise<boolean> {
  const target = handle as {
    queryPermission?: (descriptor: { mode: 'read' }) => Promise<PermissionState>
    requestPermission?: (descriptor: { mode: 'read' }) => Promise<PermissionState>
  }
  try {
    const state = await target.queryPermission?.({ mode: 'read' })
    if (state === 'granted') return true
    if (!target.requestPermission) return false
    return (await target.requestPermission({ mode: 'read' })) === 'granted'
  } catch {
    return false
  }
}

/** 快照入会话的上限：单文件 2 MB，总会话 12 MB */
export const SNAPSHOT_MAX_FILE_BYTES = 2 * 1024 * 1024
export const SNAPSHOT_MAX_TOTAL_BYTES = 12 * 1024 * 1024
