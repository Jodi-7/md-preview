import { useEffect, useRef, type RefObject } from 'react'
import { lineAtOffset, measureLineOffsets, previewLineAtTop, scrollPreviewToLine } from '../lib/scrollSync'

interface Options {
  editorRef: RefObject<HTMLTextAreaElement | null>
  mirrorRef: RefObject<HTMLDivElement | null>
  previewRef: RefObject<HTMLElement | null>
  text: string
  enabled: boolean
}

/**
 * 双栏滚动同步。
 * 编辑器是 textarea，软换行会把一行折成多行，所以用一份同样式、同宽度的镜像
 * 元素量出每行源码的真实纵向位置，再做双向映射。
 */
export function useScrollSync({ editorRef, mirrorRef, previewRef, text, enabled }: Options): void {
  const offsets = useRef<number[]>([])
  const guard = useRef(0)

  // 文本或宽度变化后重新量一次行位置
  useEffect(() => {
    if (!enabled) return
    const editor = editorRef.current
    const mirror = mirrorRef.current
    if (!editor || !mirror) return

    let frame = 0
    const measure = () => {
      const style = getComputedStyle(editor)
      const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const paddingY = parseFloat(style.paddingTop)
      mirror.style.width = `${Math.max(40, editor.clientWidth - paddingX)}px`
      offsets.current = measureLineOffsets(mirror, paddingY)
    }

    frame = requestAnimationFrame(measure)
    const observer = new ResizeObserver(measure)
    observer.observe(editor)
    const timer = window.setTimeout(measure, 80)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [text, enabled, editorRef, mirrorRef])

  useEffect(() => {
    if (!enabled) return
    const editor = editorRef.current
    const preview = previewRef.current
    if (!editor || !preview) return

    const onEditorScroll = () => {
      if (performance.now() < guard.current) return
      guard.current = performance.now() + 120
      const line = lineAtOffset(offsets.current, editor.scrollTop + 4)
      scrollPreviewToLine(preview, line)
    }

    const onPreviewScroll = () => {
      if (performance.now() < guard.current) return
      guard.current = performance.now() + 120
      const line = previewLineAtTop(preview)
      const offset = offsets.current[line]
      editor.scrollTop = Math.max(0, (offset ?? 0) - 8)
    }

    editor.addEventListener('scroll', onEditorScroll, { passive: true })
    preview.addEventListener('scroll', onPreviewScroll, { passive: true })
    return () => {
      editor.removeEventListener('scroll', onEditorScroll)
      preview.removeEventListener('scroll', onPreviewScroll)
    }
  }, [enabled, text, editorRef, previewRef])
}
