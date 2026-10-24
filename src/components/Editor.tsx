import type { RefObject } from 'react'

interface Props {
  value: string
  dirty: boolean
  onChange(value: string): void
  onSave(): void
  textareaRef: RefObject<HTMLTextAreaElement | null>
  mirrorRef: RefObject<HTMLDivElement | null>
}

export function Editor({ value, dirty, onChange, onSave, textareaRef, mirrorRef }: Props) {
  const lines = value.split('\n')

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      onSave()
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      const element = event.currentTarget
      const start = element.selectionStart
      const end = element.selectionEnd
      onChange(`${value.slice(0, start)}  ${value.slice(end)}`)
      requestAnimationFrame(() => {
        element.selectionStart = start + 2
        element.selectionEnd = start + 2
      })
    }
  }

  return (
    <section className="editor" aria-label="Markdown 源码">
      <header className="editor-head">
        <span className="editor-title">源码</span>
        {dirty && <span className="editor-dirty">未保存</span>}
        <span className="editor-hint">
          <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>S</kbd> 保存
        </span>
      </header>

      <div className="editor-body">
        <textarea
          ref={textareaRef}
          className="editor-input"
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Markdown 源码编辑区"
        />
        <div className="editor-mirror" ref={mirrorRef} aria-hidden="true">
          {lines.map((line, index) => (
            <div key={index}>{line === '' ? '\u200b' : line}</div>
          ))}
        </div>
      </div>
    </section>
  )
}
