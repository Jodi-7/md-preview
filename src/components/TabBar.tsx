import { useState } from 'react'
import type { Tab } from '../types'

interface Props {
  tabs: Tab[]
  activeId: string | null
  onSelect(id: string): void
  onClose(id: string): void
  onCloseOthers(): void
  onCloseAll(): void
}

export function TabBar({ tabs, activeId, onSelect, onClose, onCloseOthers, onCloseAll }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  if (tabs.length === 0) return null

  const run = (action: () => void) => {
    setMenuOpen(false)
    action()
  }

  return (
    <div className="tabbar" role="tablist" aria-label="已打开的文档">
      <div className="tabbar-scroll">
        {tabs.map((tab) => {
          const dirty = tab.text !== tab.savedText
          const active = tab.id === activeId
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              className={`doc-tab${active ? ' is-active' : ''}`}
              title={`${tab.rootName} / ${tab.path}`}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(tab.id)
                }
              }}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault()
                  onClose(tab.id)
                }
              }}
            >
              <span className={`doc-tab-dot${dirty ? ' is-dirty' : ''}`} aria-hidden="true" />
              <span className="doc-tab-name">{tab.name}</span>
              <button
                type="button"
                className="doc-tab-close"
                aria-label={`关闭 ${tab.name}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onClose(tab.id)
                }}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      <div className="tabbar-actions">
        <button
          type="button"
          className="icon-btn tab-more"
          aria-label="批量关闭"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="批量关闭"
          onClick={() => setMenuOpen((open) => !open)}
        >
          ⋯
        </button>

        {menuOpen && (
          <>
            <button
              type="button"
              className="menu-scrim"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setMenuOpen(false)}
            />
            <div className="tab-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                disabled={tabs.length <= 1}
                onClick={() => run(onCloseOthers)}
              >
                关闭其他标签
                <span className="tab-menu-count">{Math.max(0, tabs.length - 1)}</span>
              </button>
              <button type="button" role="menuitem" onClick={() => run(onCloseAll)}>
                全部关闭
                <span className="tab-menu-count">{tabs.length}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
