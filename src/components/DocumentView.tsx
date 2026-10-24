import { useEffect, useRef, type CSSProperties } from 'react'
import type { Library, OutlineItem } from '../types'
import { loadMermaid } from '../lib/mermaid'
import { loadKatex } from '../lib/katex'

interface Props {
  html: string
  docPath: string
  library: Library
  fontScale: number
  wide: boolean
  dark: boolean
  onOutline(items: OutlineItem[]): void
  onActiveHeading(id: string): void
}

const HEADING_SELECTOR = 'h1[id], h2[id], h3[id], h4[id]'

export function DocumentView({
  html,
  docPath,
  library,
  fontScale,
  wide,
  dark,
  onOutline,
  onActiveHeading,
}: Props) {
  const articleRef = useRef<HTMLElement>(null)

  // 代码块复制按钮
  useEffect(() => {
    const root = articleRef.current
    if (!root) return
    const blocks = root.querySelectorAll<HTMLPreElement>('pre.hljs')
    const listeners: Array<() => void> = []

    blocks.forEach((pre) => {
      if (pre.dataset.enhanced === '1') return
      pre.dataset.enhanced = '1'

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'code-copy'
      button.textContent = '复制'

      const onClick = async () => {
        const code = pre.querySelector('code')?.textContent ?? ''
        try {
          await navigator.clipboard.writeText(code)
          button.textContent = '已复制'
        } catch {
          button.textContent = '复制失败'
        }
        window.setTimeout(() => {
          button.textContent = '复制'
        }, 1600)
      }

      button.addEventListener('click', onClick)
      pre.appendChild(button)
      listeners.push(() => button.removeEventListener('click', onClick))
    })

    return () => {
      for (const off of listeners) off()
    }
  }, [html])

  // 相对路径图片：解析成 blob URL
  useEffect(() => {
    const root = articleRef.current
    if (!root) return
    let cancelled = false

    root.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      const src = img.getAttribute('src') ?? ''
      if (!src || img.dataset.local === '1') return
      void library.resolveAsset(docPath, src).then((url) => {
        if (cancelled) return
        img.dataset.local = '1'
        if (url) img.src = url
        else img.classList.add('is-missing')
      })
    })

    return () => {
      cancelled = true
    }
  }, [html, docPath, library])

  // Mermaid：只有出现图表时才加载渲染器
  useEffect(() => {
    const root = articleRef.current
    if (!root) return
    const blocks = Array.from(root.querySelectorAll<HTMLPreElement>('pre.mermaid-src'))
    if (blocks.length === 0) return

    let cancelled = false
    void (async () => {
      const mermaid = await loadMermaid(dark)
      for (const [index, pre] of blocks.entries()) {
        if (cancelled) return
        const source = pre.textContent ?? ''
        try {
          const result = await mermaid.render(`mermaid-${Date.now()}-${index}`, source)
          if (cancelled) return
          const figure = document.createElement('div')
          figure.className = 'mermaid-figure'
          figure.innerHTML = typeof result === 'string' ? result : result.svg
          pre.replaceWith(figure)
        } catch (error) {
          if (cancelled) return
          const note = document.createElement('div')
          note.className = 'mermaid-error'
          note.textContent = `Mermaid 渲染失败：${(error as Error).message}`
          pre.replaceWith(note)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [html, dark])

  // 公式：KaTeX 同样按需加载
  useEffect(() => {
    const root = articleRef.current
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.math-inline, .math-block'))
    if (nodes.length === 0) return

    let cancelled = false
    void (async () => {
      const katex = await loadKatex()
      if (cancelled) return
      for (const node of nodes) {
        const tex = decodeURIComponent(node.dataset.tex ?? '')
        try {
          katex.render(tex, node, {
            displayMode: node.classList.contains('math-block'),
            throwOnError: false,
            output: 'html',
          })
        } catch {
          node.textContent = `公式错误：${tex}`
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [html])

  // 大纲
  useEffect(() => {
    const root = articleRef.current
    if (!root) return
    const items: OutlineItem[] = Array.from(root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)).map(
      (heading) => ({
        id: heading.id,
        text: heading.textContent?.trim() ?? '',
        level: Number(heading.tagName.slice(1)),
      }),
    )
    onOutline(items)
  }, [html, onOutline])

  // 滚动联动：取当前视口内最靠上的标题
  useEffect(() => {
    const root = articleRef.current
    if (!root) return
    const scroller = root.closest('.content')
    const headings = Array.from(root.querySelectorAll<HTMLElement>(HEADING_SELECTOR))
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) onActiveHeading(visible[0].target.id)
      },
      { root: scroller, rootMargin: '-16px 0px -68% 0px', threshold: 0 },
    )

    headings.forEach((heading) => observer.observe(heading))
    return () => observer.disconnect()
  }, [html, onActiveHeading])

  const style = { '--doc-scale': String(fontScale) } as CSSProperties

  return (
    <article ref={articleRef} className={`md${wide ? ' is-wide' : ''}`} style={style}>
      <div className="md-body" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  )
}
