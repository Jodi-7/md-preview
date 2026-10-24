import type { Library } from '../types'
import { Icon } from './Icon'

interface Props {
  library: Library | null
  activePath: string | null
  /** 已经打开成标签页的路径，用来在列表里标记 */
  openPaths?: Set<string>
  query: string
  onQueryChange(value: string): void
  onSelect(path: string): void
  onOpenFiles(): void
  onOpenFolder(): void
}

interface Group {
  dir: string
  docs: { path: string; name: string; size: number }[]
}

function groupDocs(library: Library | null, keyword: string): Group[] {
  const groups = new Map<string, Group>()
  for (const doc of library?.docs ?? []) {
    if (keyword && !doc.path.toLowerCase().includes(keyword)) continue
    const group = groups.get(doc.dir) ?? { dir: doc.dir, docs: [] }
    group.docs.push({ path: doc.path, name: doc.name, size: doc.size })
    groups.set(doc.dir, group)
  }
  return [...groups.values()]
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function FileTree({
  library,
  activePath,
  openPaths,
  query,
  onQueryChange,
  onSelect,
  onOpenFiles,
  onOpenFolder,
}: Props) {
  const keyword = query.trim().toLowerCase()
  const groups = groupDocs(library, keyword)
  const total = library?.docs.length ?? 0

  return (
    <div className="tree">
      <div className="tree-actions">
        <button type="button" className="btn btn-ghost" onClick={onOpenFiles}>
          <Icon name="file" />
          打开文件
        </button>
        <button type="button" className="btn btn-ghost" onClick={onOpenFolder}>
          <Icon name="folder" />
          打开文件夹
        </button>
      </div>

      <label className="search">
        <Icon name="search" className="search-icon" />
        <input
          type="search"
          value={query}
          placeholder="搜索文件名"
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label="搜索文件名"
        />
      </label>

      <div className="tree-scroll">
        {total === 0 && (
          <p className="tree-hint">
            还没有打开文档。拖一个 <code>.md</code> 文件进来，或者直接选整个文档目录。
          </p>
        )}

        {total > 0 && groups.length === 0 && <p className="tree-hint">没有匹配「{query}」的文件。</p>}

        {groups.map((group) => (
          <section key={group.dir || '__root'} className="tree-group">
            <h3 className="tree-group-title">{group.dir || '根目录'}</h3>
            {group.docs.map((doc) => (
              <button
                key={doc.path}
                type="button"
                className={`tree-item${doc.path === activePath ? ' is-active' : ''}`}
                onClick={() => onSelect(doc.path)}
                title={doc.path}
              >
                <Icon name="doc" className="tree-item-icon" />
                <span className="tree-item-name">{doc.name}</span>
                {openPaths?.has(doc.path) && <span className="tree-item-open" title="已打开" />}
                <span className="tree-item-size">{formatSize(doc.size)}</span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
