import { Icon } from './Icon'

interface Props {
  onOpenFiles(): void
  onOpenFolder(): void
  onDemo(): void
  onPaste(): void
  error?: string
}

export function EmptyState({ onOpenFiles, onOpenFolder, onDemo, onPaste, error }: Props) {
  return (
    <div className="empty">
      <div className="empty-card">
        <div className="empty-mark" aria-hidden="true">
          <svg viewBox="0 0 40 40" width="40" height="40">
            <rect width="40" height="40" rx="11" fill="var(--accent)" />
            <path d="M10 28V12h4l5 8.5L24 12h4v16h-3.6v-9.7L19.6 26h-1.2l-4.8-7.7V28z" fill="#fff" />
          </svg>
        </div>

        <h1 className="empty-title">Markdown 预览器</h1>
        <p className="empty-lead">
          把 <code>.md</code> 文件或整个文档目录拖进来，立刻看到渲染结果。不上传、不落盘，全部在本地完成。
        </p>

        {error && <p className="empty-error">{error}</p>}

        <div className="empty-actions">
          <button type="button" className="btn btn-primary" onClick={onOpenFiles}>
            <Icon name="file" />
            打开文件
          </button>
          <button type="button" className="btn" onClick={onOpenFolder}>
            <Icon name="folder" />
            打开文件夹
          </button>
        </div>

        <div className="empty-links">
          <button type="button" className="link-btn" onClick={onDemo}>
            先看一份示例文档
          </button>
          <span className="dot-sep" aria-hidden="true" />
          <button type="button" className="link-btn" onClick={onPaste}>
            粘贴 Markdown 文本
          </button>
        </div>

        <dl className="empty-facts">
          <div>
            <dt>解析</dt>
            <dd>CommonMark 0.31 + GFM 扩展</dd>
          </div>
          <div>
            <dt>安全</dt>
            <dd>渲染后白名单净化</dd>
          </div>
          <div>
            <dt>启动</dt>
            <dd>静态页面，无后端进程</dd>
          </div>
        </dl>
      </div>

      <p className="empty-tip">
        提示：<kbd>Ctrl</kbd> + <kbd>F</kbd> 是浏览器自带的页内查找，对渲染后的正文同样有效。
      </p>
    </div>
  )
}
