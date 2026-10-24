import type { OutlineItem } from '../types'

interface Props {
  outline: OutlineItem[]
  activeId: string
  onJump(id: string): void
}

export function Outline({ outline, activeId, onJump }: Props) {
  if (outline.length === 0) {
    return <p className="tree-hint">这份文档没有标题。用 <code>#</code> 写几级标题，这里就会出现大纲。</p>
  }

  return (
    <nav className="outline" aria-label="文档大纲">
      {outline.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`outline-item level-${item.level}${item.id === activeId ? ' is-active' : ''}`}
          onClick={() => onJump(item.id)}
          title={item.text}
        >
          {item.text}
        </button>
      ))}
    </nav>
  )
}
