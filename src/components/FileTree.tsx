import { useId } from 'react'
import type { Library, SearchHit } from '../types'
import { Icon } from './Icon'

export type SearchMode = 'name' | 'content'

interface Props {
  library: Library | null
  activePath: string | null
  /** 已经打开成标签页的路径，用来在列表里标记 */
  openPaths?: Set<string>
  query: string
  onQueryChange(value: string): void
  searchMode: SearchMode
  onSearchModeChange(mode: SearchMode): void
  /** 内容模式下的搜索结果；null 表示还没搜过 */
  searchResults: SearchHit[] | null
  searching: boolean
  onJumpToHit(hit: SearchHit): void
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
  searchMode,
  onSearchModeChange,
  searchResults,
  searching,
  onJumpToHit,
  onSelect,
  onOpenFiles,
  onOpenFolder,
}: Props) {
  const keyword = query.trim().toLowerCase()
  const groups = groupDocs(library, keyword)
  const total = library?.docs.length ?? 0
  const contentSupported = library?.search !== undefined
  const listId = useId()

  const showContent = searchMode === 'content' && contentSupported

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
          placeholder={showContent ? '搜索文档内容' : '搜索文件名'}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label={showContent ? '搜索文档内容' : '搜索文件名'}
        />
      </label>

      {contentSupported && (
        <div className="search-mode" role="tablist" aria-label="搜索模式">
          <button
            type="button"
            role="tab"
            aria-selected={searchMode === 'name'}
            className={`mode-btn${searchMode === 'name' ? ' is-active' : ''}`}
            onClick={() => onSearchModeChange('name')}
          >
            文件名
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={searchMode === 'content'}
            className={`mode-btn${searchMode === 'content' ? ' is-active' : ''}`}
            onClick={() => onSearchModeChange('content')}
          >
            内容
          </button>
        </div>
      )}

      <div className="tree-scroll" id={listId}>
        {total === 0 && (
          <p className="tree-hint">
            还没有打开文档。拖一个 <code>.md</code> 文件进来，或者直接选整个文档目录。
          </p>
        )}

        {showContent && keyword.length >= 2 && searching && (
          <p className="tree-hint">正在搜索「{query}」…</p>
        )}

        {showContent && keyword.length < 2 && (
          <p className="tree-hint">输入至少 2 个字符，在当前目录的所有文档里查找内容。</p>
        )}

        {showContent && keyword.length >= 2 && !searching && searchResults?.length === 0 && (
          <p className="tree-hint">没有文档包含「{query}」。</p>
        )}

        {showContent && searchResults && searchResults.length > 0 && (
          <div className="search-hits">
            {searchResults.map((hit, index) => (
              <button
                key={`${hit.path}:${hit.line}:${index}`}
                type="button"
                className="search-hit"
                onClick={() => onJumpToHit(hit)}
                title={`跳到 ${hit.path} 第 ${hit.line} 行`}
              >
                <span className="search-hit-head">
                  <Icon name="doc" className="tree-item-icon" />
                  <span className="search-hit-name">{hit.name}</span>
                  <span className="search-hit-line">L{hit.line}</span>
                </span>
                <span className="search-hit-snippet">{hit.snippet}</span>
              </button>
            ))}
          </div>
        )}

        {!showContent && total > 0 && groups.length === 0 && (
          <p className="tree-hint">没有匹配「{query}」的文件。</p>
        )}

        {!showContent &&
          groups.map((group) => (
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
