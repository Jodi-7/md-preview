import { Icon } from './Icon'
import type { ContentWidth, FontSize, Theme, ViewMode } from '../types'

interface Props {
  title: string
  path: string
  meta: string
  theme: Theme
  fontSize: FontSize
  width: ContentWidth
  view: ViewMode
  dirty: boolean
  canSave: boolean
  onTheme(theme: Theme): void
  onFontSize(size: FontSize): void
  onWidth(width: ContentWidth): void
  onView(view: ViewMode): void
  onSave(): void
  onToggleSidebar(): void
}

const FONT_STEPS: FontSize[] = ['sm', 'md', 'lg']

export function Toolbar({
  title,
  path,
  meta,
  theme,
  fontSize,
  width,
  view,
  dirty,
  canSave,
  onTheme,
  onFontSize,
  onWidth,
  onView,
  onSave,
  onToggleSidebar,
}: Props) {
  const step = (delta: number) => {
    const index = FONT_STEPS.indexOf(fontSize)
    onFontSize(FONT_STEPS[Math.min(FONT_STEPS.length - 1, Math.max(0, index + delta))])
  }

  const split = view === 'split'

  return (
    <header className="toolbar">
      <button type="button" className="icon-btn toolbar-menu" onClick={onToggleSidebar} aria-label="切换侧栏">
        <Icon name="menu" />
      </button>

      <div className="toolbar-title">
        <span className="toolbar-name" title={path || title}>
          {title}
          {dirty && <span className="toolbar-dirty" title="有未保存的修改" />}
        </span>
        {path && <span className="toolbar-meta">{meta ? `${path} · ${meta}` : path}</span>}
      </div>

      <div className="toolbar-actions">
        <button
          type="button"
          className={`icon-btn${split ? ' is-on' : ''}`}
          onClick={() => onView(split ? 'read' : 'split')}
          title={split ? '回到阅读模式' : '双栏编辑（左源码 / 右预览）'}
          aria-label={split ? '回到阅读模式' : '双栏编辑'}
          aria-pressed={split}
        >
          <Icon name={split ? 'book' : 'columns'} />
        </button>

        {split && (
          <button
            type="button"
            className="btn btn-save"
            onClick={onSave}
            disabled={!dirty && canSave}
            title={canSave ? '保存到文件（Ctrl / ⌘ + S）' : '这个来源不支持写回，可用 Ctrl+S 复制内容'}
          >
            <Icon name="save" />
            {dirty ? '保存' : '已保存'}
          </button>
        )}

        <div className="seg" role="group" aria-label="字号">
          <button
            type="button"
            className="seg-btn"
            onClick={() => step(-1)}
            disabled={fontSize === 'sm'}
            aria-label="调小字号"
            title="调小字号"
          >
            A−
          </button>
          <button
            type="button"
            className="seg-btn"
            onClick={() => step(1)}
            disabled={fontSize === 'lg'}
            aria-label="调大字号"
            title="调大字号"
          >
            A+
          </button>
        </div>

        {!split && (
          <button
            type="button"
            className={`icon-btn${width === 'wide' ? ' is-on' : ''}`}
            onClick={() => onWidth(width === 'narrow' ? 'wide' : 'narrow')}
            title={width === 'narrow' ? '切换到宽版' : '切换到标准宽度'}
            aria-label="切换正文宽度"
          >
            <Icon name="width" />
          </button>
        )}

        <button
          type="button"
          className="icon-btn"
          onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? '切换到浅色' : '切换到深色'}
          aria-label="切换主题"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
  )
}
