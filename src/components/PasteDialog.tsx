import { useEffect, useState } from 'react'
import { Icon } from './Icon'

interface Props {
  onClose(): void
  onApply(text: string): void
}

const SAMPLE = `# 粘贴的 Markdown

这一段来自剪贴板，不会写入任何文件。

- 支持列表
- **加粗**、\`行内代码\`

| 列 A | 列 B |
| --- | --- |
| 1 | 2 |
`

export function PasteDialog({ onClose, onApply }: Props) {
  const [text, setText] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paste-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <h2 id="paste-title">粘贴 Markdown</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <Icon name="close" />
          </button>
        </header>

        <textarea
          className="modal-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="把 Markdown 文本粘贴到这里…"
          spellCheck={false}
          autoFocus
        />

        <footer className="modal-foot">
          <button type="button" className="link-btn" onClick={() => setText(SAMPLE)}>
            填入示例
          </button>
          <div className="modal-foot-actions">
            <button type="button" className="btn" onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={text.trim().length === 0}
              onClick={() => onApply(text)}
            >
              预览
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
